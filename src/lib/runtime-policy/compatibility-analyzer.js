/* eslint-disable import/no-commonjs, strict */
'use strict';

const {
    CLONE_BUDGET_MODES,
    EXECUTION_BACKEND_MODES,
    PRESENTATION_DOMAIN_MODES,
    PRESENTATION_REFRESH_POLICIES,
    RENDER_QUALITY_POLICIES,
    SCRATCH_TRANSFORM_PRESENTATION_DOMAIN
} = require('./constants');
const {normalizeRuntimePolicySet} = require('./runtime-policy-contract');
const {createPresenterCapabilityRegistry} = require('./presenter-capability-registry');

const COMPATIBILITY_ANALYZER_ID = 'ngvge.compatibility-analyzer@1';
const COMPATIBILITY_REPORT_SCHEMA = 'ngvge.compatibility-report/v1';

const COMPATIBILITY_STATUS = Object.freeze({
    COMPATIBLE: 'compatible',
    INCOMPATIBLE: 'incompatible',
    NOT_APPLICABLE: 'not-applicable',
    PARTIAL: 'partial',
    UNKNOWN: 'unknown'
});

const RESOURCE_RISK = Object.freeze({
    HIGH: 'high',
    LOW: 'low',
    MEDIUM: 'medium'
});

const STATUS_RANK = Object.freeze({
    [COMPATIBILITY_STATUS.NOT_APPLICABLE]: 0,
    [COMPATIBILITY_STATUS.COMPATIBLE]: 0,
    [COMPATIBILITY_STATUS.UNKNOWN]: 1,
    [COMPATIBILITY_STATUS.PARTIAL]: 2,
    [COMPATIBILITY_STATUS.INCOMPATIBLE]: 3
});

const clone = value => {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(clone);
    const result = {};
    Object.keys(value).forEach(key => {
        result[key] = clone(value[key]);
    });
    return result;
};

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return value;
};

const createDiagnostic = (category, code, severity, message, details = {}) => deepFreeze({
    category,
    code,
    details: clone(details),
    message,
    severity
});

const combineStatus = statuses => statuses.reduce((current, candidate) => (
    STATUS_RANK[candidate] > STATUS_RANK[current] ? candidate : current
), COMPATIBILITY_STATUS.COMPATIBLE);

const getPresentationPolicy = (policy, domainId) => policy.presentation.domainPolicies.find(
    entry => entry.domainId === domainId
) || null;

const effectiveCloneLimit = cloneBudget => {
    if (cloneBudget.requestedLimit === null) return cloneBudget.hostHardCeiling;
    return Math.min(cloneBudget.requestedLimit, cloneBudget.hostHardCeiling);
};

const analyzeExecution = (policy, project) => {
    const diagnostics = [];
    let status = COMPATIBILITY_STATUS.COMPATIBLE;
    if (project.features.exactTickSensitive && policy.execution.simulationTickRate !== 30) {
        status = COMPATIBILITY_STATUS.PARTIAL;
        diagnostics.push(createDiagnostic(
            'execution',
            'compat.execution.tick-sensitive-nondefault-rate',
            'warning',
            'Timer/wait-sensitive Scratch logic is running at a non-default simulation tick rate.',
            {simulationTickRate: policy.execution.simulationTickRate}
        ));
    }
    if (project.features.broadcastHeavy) {
        diagnostics.push(createDiagnostic(
            'execution',
            'compat.execution.broadcast-heavy',
            'info',
            [
                'Project contains a high concentration of broadcast/event blocks;',
                'event ordering should be regression-tested.'
            ].join(' '),
            {broadcastBlockCount: project.counts.broadcastBlockCount}
        ));
    }
    if (policy.execution.legacyScratchTurboMode && project.features.usesTimerSensitiveLogic) {
        status = combineStatus([status, COMPATIBILITY_STATUS.PARTIAL]);
        diagnostics.push(createDiagnostic(
            'execution',
            'compat.execution.legacy-turbo-timing-sensitive',
            'warning',
            'Legacy Scratch Turbo is active in a project with timing-sensitive logic.',
            {}
        ));
    }
    return deepFreeze({diagnostics, status});
};

const analyzePresentationDomain = (policy, domainId, presenterRegistry) => {
    const capability = presenterRegistry.get(domainId);
    const requested = getPresentationPolicy(policy, domainId);
    const diagnostics = [];
    if (!capability) {
        diagnostics.push(createDiagnostic(
            'presentation',
            'compat.presentation.capability-missing',
            'warning',
            `No PresenterCapability is registered for visual domain ${domainId}.`,
            {domainId}
        ));
        return deepFreeze({
            capability: null,
            diagnostics,
            domainId,
            requestedPolicy: requested,
            status: COMPATIBILITY_STATUS.UNKNOWN
        });
    }

    let status = COMPATIBILITY_STATUS.COMPATIBLE;
    if (requested && requested.interpolation === PRESENTATION_DOMAIN_MODES.IF_SUPPORTED &&
        !capability.supportsInterpolation) {
        status = COMPATIBILITY_STATUS.INCOMPATIBLE;
        diagnostics.push(createDiagnostic(
            'presentation',
            'compat.presentation.interpolation-unsupported',
            'error',
            `Interpolation is requested for ${domainId}, but the presenter does not support it.`,
            {domainId}
        ));
    }
    if (requested && requested.resampling === PRESENTATION_DOMAIN_MODES.IF_SUPPORTED &&
        !capability.supportsResampling) {
        status = COMPATIBILITY_STATUS.INCOMPATIBLE;
        diagnostics.push(createDiagnostic(
            'presentation',
            'compat.presentation.resampling-unsupported',
            'error',
            `Resampling is requested for ${domainId}, but the presenter does not support it.`,
            {domainId}
        ));
    }
    if (capability.requiresExactTickPresentation &&
        policy.presentation.refreshPolicy !== PRESENTATION_REFRESH_POLICIES.EXACT_TICK) {
        status = combineStatus([status, COMPATIBILITY_STATUS.PARTIAL]);
        diagnostics.push(createDiagnostic(
            'presentation',
            'compat.presentation.exact-tick-domain-on-high-refresh',
            'warning',
            [
                `${domainId} has no faithful high-refresh reconstruction path.`,
                'The domain will remain tick-bound while other domains may be smoothed.'
            ].join(' '),
            {domainId, refreshPolicy: policy.presentation.refreshPolicy}
        ));
    }
    capability.diagnostics.forEach(message => diagnostics.push(createDiagnostic(
        'presentation',
        'compat.presentation.presenter-note',
        'info',
        message,
        {domainId}
    )));
    return deepFreeze({capability, diagnostics, domainId, requestedPolicy: requested, status});
};

const analyzePresentation = (policy, project, presenterRegistry) => {
    const domains = project.visualDomains.map(domainId => (
        analyzePresentationDomain(policy, domainId, presenterRegistry)
    ));
    const diagnostics = domains.reduce((all, domain) => all.concat(domain.diagnostics), []);
    let status = domains.length ?
        combineStatus(domains.map(domain => domain.status)) :
        COMPATIBILITY_STATUS.NOT_APPLICABLE;

    if (project.unknownExtensionIds.length) {
        status = combineStatus([status, COMPATIBILITY_STATUS.UNKNOWN]);
        diagnostics.push(createDiagnostic(
            'presentation',
            'compat.presentation.extension-capability-unknown',
            'warning',
            'One or more custom extensions have no visual-domain capability declaration.',
            {extensionIds: project.unknownExtensionIds}
        ));
    }

    return deepFreeze({diagnostics, domains, status});
};

const analyzeResources = (policy, project) => {
    const diagnostics = [];
    let risk = RESOURCE_RISK.LOW;
    const limit = effectiveCloneLimit(policy.safety.cloneBudget);
    if (project.features.usesClones) {
        diagnostics.push(createDiagnostic(
            'resource',
            'compat.resource.clone-budget-active',
            'info',
            'Clone creation is present and remains bounded by RuntimeSafetyPolicy.',
            {effectiveCloneLimit: limit}
        ));
    }
    if (project.features.cloneHeavy) {
        risk = RESOURCE_RISK.MEDIUM;
        diagnostics.push(createDiagnostic(
            'resource',
            'compat.resource.clone-heavy-static-signal',
            'warning',
            'Static analysis found many clone creation sites; runtime clone pressure should be measured.',
            {cloneCreateBlockCount: project.counts.cloneCreateBlockCount, effectiveCloneLimit: limit}
        ));
    }
    if (policy.safety.cloneBudget.mode === CLONE_BUDGET_MODES.LEGACY_UNBOUNDED_REQUEST) {
        risk = RESOURCE_RISK.MEDIUM;
        diagnostics.push(createDiagnostic(
            'resource',
            'compat.resource.legacy-unbounded-request-bounded',
            'warning',
            'Legacy unbounded clone intent is active, but Host hard ceilings still apply.',
            {hostHardCeiling: policy.safety.cloneBudget.hostHardCeiling}
        ));
    }
    if (project.features.highRenderLoad) {
        risk = RESOURCE_RISK.HIGH;
        diagnostics.push(createDiagnostic(
            'resource',
            'compat.resource.high-render-load',
            'warning',
            'Project size indicates a high render/runtime load and should be profiled on the target device.',
            {blockCount: project.blockCount, targetCount: project.targetCount}
        ));
    }
    return deepFreeze({
        diagnostics,
        risk,
        status: risk === RESOURCE_RISK.LOW ? COMPATIBILITY_STATUS.COMPATIBLE : COMPATIBILITY_STATUS.PARTIAL
    });
};

const analyzeBackend = (policy, project, backend) => {
    const diagnostics = [];
    let status = COMPATIBILITY_STATUS.COMPATIBLE;
    const capabilities = backend && backend.capabilities ? backend.capabilities : {};
    const transformPolicy = getPresentationPolicy(policy, SCRATCH_TRANSFORM_PRESENTATION_DOMAIN);

    const requireCapability = (required, capability, code, message) => {
        if (!required || capabilities[capability]) return;
        status = COMPATIBILITY_STATUS.INCOMPATIBLE;
        diagnostics.push(createDiagnostic('backend', code, 'error', message, {capability}));
    };

    requireCapability(
        Boolean(transformPolicy && transformPolicy.interpolation === PRESENTATION_DOMAIN_MODES.IF_SUPPORTED),
        'interpolation',
        'compat.backend.interpolation-unavailable',
        'Selected policy requires Scratch transform interpolation, but the backend does not expose it.'
    );
    requireCapability(
        policy.presentation.renderQuality === RENDER_QUALITY_POLICIES.HIGH,
        'highQualityRender',
        'compat.backend.high-quality-render-unavailable',
        'Selected policy requires high-quality rendering, but the backend does not expose it.'
    );
    requireCapability(
        policy.executionBackend.mode !== EXECUTION_BACKEND_MODES.AUTO,
        'compilerControl',
        'compat.backend.execution-mode-unavailable',
        'Selected execution backend override cannot be expressed by this backend.'
    );
    requireCapability(
        policy.execution.legacyScratchTurboMode,
        'turboMode',
        'compat.backend.turbo-unavailable',
        'Legacy Scratch Turbo is requested, but the backend does not expose Turbo control.'
    );
    requireCapability(
        project.features.customStageGeometry,
        'stageGeometry',
        'compat.backend.stage-geometry-unavailable',
        'Project uses custom stage geometry, but the backend cannot apply custom stage size.'
    );

    if (project.features.usesRendererPrivateExtension) {
        status = combineStatus([status, COMPATIBILITY_STATUS.PARTIAL]);
        diagnostics.push(createDiagnostic(
            'backend',
            'compat.backend.renderer-private-extension',
            'warning',
            'A renderer-private extension is present; compatibility depends on backend-private behavior.',
            {extensionIds: project.rendererPrivateExtensionIds}
        ));
    }
    if (project.unknownExtensionIds.length) {
        status = combineStatus([status, COMPATIBILITY_STATUS.UNKNOWN]);
        diagnostics.push(createDiagnostic(
            'backend',
            'compat.backend.extension-capability-unknown',
            'warning',
            'Backend requirements for custom extensions are unknown.',
            {extensionIds: project.unknownExtensionIds}
        ));
    }
    return deepFreeze({diagnostics, status});
};

const analyzeLegacyOverrides = legacy => {
    if (!legacy) {
        return deepFreeze({diagnostics: [], status: COMPATIBILITY_STATUS.NOT_APPLICABLE});
    }
    const diagnostics = [];
    const sourceDiagnostics = Array.isArray(legacy.diagnostics) ? legacy.diagnostics : [];
    const migrationRecords = Array.isArray(legacy.migrationRecords) ? legacy.migrationRecords : [];
    const precedenceSnapshot = legacy.precedenceSnapshot || {};
    const legacyClaims = Object.keys(precedenceSnapshot).filter(key => {
        const claim = precedenceSnapshot[key];
        return claim && typeof claim.sourceId === 'string' && claim.sourceId.startsWith('legacy-runtime.') &&
            claim.sourceId !== 'legacy-runtime.backend-automatic';
    });
    let status = COMPATIBILITY_STATUS.COMPATIBLE;

    if (legacyClaims.length) {
        status = COMPATIBILITY_STATUS.PARTIAL;
        diagnostics.push(createDiagnostic(
            'legacy',
            'compat.legacy.override-active',
            'warning',
            'Legacy compatibility overrides are active and should remain explicit in diagnostics.',
            {semanticKeys: legacyClaims}
        ));
    }
    const unsupported = migrationRecords.filter(record => record && record.status === 'unsupported');
    if (unsupported.length) {
        status = COMPATIBILITY_STATUS.INCOMPATIBLE;
        diagnostics.push(createDiagnostic(
            'legacy',
            'compat.legacy.unsupported-migration',
            'error',
            'One or more Legacy settings could not be mapped to an explicit owner.',
            {legacyPaths: unsupported.map(record => record.legacyPath)}
        ));
    }
    if (sourceDiagnostics.some(entry => entry && entry.severity === 'error')) {
        status = COMPATIBILITY_STATUS.INCOMPATIBLE;
        diagnostics.push(createDiagnostic(
            'legacy',
            'compat.legacy.error-diagnostic-present',
            'error',
            'Legacy compatibility import reported one or more error diagnostics.',
            {}
        ));
    }
    return deepFreeze({diagnostics, status});
};

const buildRecommendations = sections => {
    const recommendations = [];
    if (sections.presentation.diagnostics.some(item => item.code ===
        'compat.presentation.exact-tick-domain-on-high-refresh')) {
        recommendations.push([
            'Use exact-tick presentation for full visual fidelity,',
            'or accept partial domain smoothing.'
        ].join(' '));
    }
    if (sections.execution.diagnostics.some(item => item.code ===
        'compat.execution.tick-sensitive-nondefault-rate')) {
        recommendations.push('Prefer 30 Hz Scratch-compatible simulation for timer/wait-sensitive projects.');
    }
    if (sections.backend.status === COMPATIBILITY_STATUS.INCOMPATIBLE) {
        recommendations.push('Select a backend that exposes the capabilities required by the chosen Runtime Policy.');
    }
    if (sections.legacy.status !== COMPATIBILITY_STATUS.NOT_APPLICABLE &&
        sections.legacy.status !== COMPATIBILITY_STATUS.COMPATIBLE) {
        recommendations.push('Review active Legacy overrides and migration diagnostics before changing profiles.');
    }
    return Object.freeze(recommendations);
};

class CompatibilityAnalyzer {
    constructor (options = {}) {
        this.id = COMPATIBILITY_ANALYZER_ID;
        this.presenterRegistry = options.presenterRegistry || createPresenterCapabilityRegistry();
        Object.seal(this);
    }

    analyze (input) {
        if (!input || !input.project || !input.backend) {
            throw new TypeError('CompatibilityAnalyzer requires policy, project, and backend snapshots.');
        }
        const policy = normalizeRuntimePolicySet(input.policy);
        const sections = {
            backend: analyzeBackend(policy, input.project, input.backend),
            execution: analyzeExecution(policy, input.project),
            legacy: analyzeLegacyOverrides(input.legacy || null),
            presentation: analyzePresentation(policy, input.project, this.presenterRegistry),
            resource: analyzeResources(policy, input.project)
        };
        const status = combineStatus([
            sections.execution.status,
            sections.presentation.status,
            sections.resource.status,
            sections.backend.status,
            sections.legacy.status
        ]);
        return deepFreeze({
            analyzerId: COMPATIBILITY_ANALYZER_ID,
            policyProfileId: policy.profileId,
            recommendations: buildRecommendations(sections),
            schema: COMPATIBILITY_REPORT_SCHEMA,
            sections,
            status
        });
    }
}

const createCompatibilityAnalyzer = options => new CompatibilityAnalyzer(options);

module.exports = {
    COMPATIBILITY_ANALYZER_ID,
    COMPATIBILITY_REPORT_SCHEMA,
    COMPATIBILITY_STATUS,
    CompatibilityAnalyzer,
    RESOURCE_RISK,
    createCompatibilityAnalyzer
};
