/* eslint-disable import/no-commonjs, strict */
'use strict';

const {
    BACKEND_HINT_VALUES,
    CLONE_BUDGET_MODES,
    EXECUTION_BACKEND_MODES,
    PRESENTATION_DOMAIN_MODES,
    PRESENTATION_REFRESH_POLICIES,
    RENDER_QUALITY_POLICIES,
    RUNTIME_POLICY_DOMAIN_IDS,
    SCRATCH_COMPATIBILITY_TOKENS,
    SCRATCH_TRANSFORM_PRESENTATION_DOMAIN
} = require('./constants');
const {normalizeRuntimePolicySet} = require('./runtime-policy-contract');

const SCRATCH_RUNTIME_POLICY_ADAPTER_ID = 'ngvge.scratch-runtime-policy-adapter@1';
const SCRATCH_BACKEND_DOMAIN_APPLICATION_ID = 'ngvge.scratch-runtime-policy-domain-application@1';

const getTransformPresentationPolicy = policy => policy.presentation.domainPolicies.find(
    entry => entry.domainId === SCRATCH_TRANSFORM_PRESENTATION_DOMAIN
) || null;

const resolveCloneLimit = cloneBudget => {
    if (cloneBudget.mode === CLONE_BUDGET_MODES.LEGACY_UNBOUNDED_REQUEST) return cloneBudget.hostHardCeiling;
    if (cloneBudget.requestedLimit === null) return cloneBudget.hostHardCeiling;
    return Math.min(cloneBudget.requestedLimit, cloneBudget.hostHardCeiling);
};

const isScratchCompatibleMiscLimitBundle = compatibility => (
    compatibility.soundEffectLimits === true &&
    compatibility.penSizeLimits === true &&
    compatibility.soundYieldSemantics === SCRATCH_COMPATIBILITY_TOKENS.SCRATCH_COMPATIBLE &&
    compatibility.musicConcurrency === SCRATCH_COMPATIBILITY_TOKENS.SCRATCH_COMPATIBLE &&
    compatibility.mousePrecision === SCRATCH_COMPATIBILITY_TOKENS.SCRATCH_COMPATIBLE
);

const isHighQualityPenCompatibilityBundle = (compatibility, presentation) => (
    compatibility.soundEffectLimits === true &&
    compatibility.penSizeLimits === false &&
    compatibility.soundYieldSemantics === SCRATCH_COMPATIBILITY_TOKENS.SCRATCH_COMPATIBLE &&
    compatibility.musicConcurrency === SCRATCH_COMPATIBILITY_TOKENS.SCRATCH_COMPATIBLE &&
    compatibility.mousePrecision === SCRATCH_COMPATIBILITY_TOKENS.SCRATCH_COMPATIBLE &&
    presentation.renderQuality === RENDER_QUALITY_POLICIES.HIGH
);

const isFullyRelaxedMiscLimitBundle = compatibility => (
    compatibility.soundEffectLimits === false &&
    compatibility.penSizeLimits === false &&
    compatibility.soundYieldSemantics === SCRATCH_COMPATIBILITY_TOKENS.RELAXED &&
    compatibility.musicConcurrency === SCRATCH_COMPATIBILITY_TOKENS.RELAXED &&
    compatibility.mousePrecision === SCRATCH_COMPATIBILITY_TOKENS.HIGH_PRECISION
);

const resolveLegacyMiscLimits = (compatibility, presentation = {}) => {
    if (isScratchCompatibleMiscLimitBundle(compatibility) ||
        isHighQualityPenCompatibilityBundle(compatibility, presentation)) {
        return Object.freeze({
            diagnostics: Object.freeze([]),
            miscLimits: true,
            representableExactly: true
        });
    }
    if (isFullyRelaxedMiscLimitBundle(compatibility)) {
        return Object.freeze({
            diagnostics: Object.freeze([]),
            miscLimits: false,
            representableExactly: true
        });
    }
    return Object.freeze({
        diagnostics: Object.freeze([
            [
                'Scratch backend exposes one legacy miscLimits switch for multiple compatibility domains.',
                'The requested partial compatibility bundle is collapsed to relaxed behavior',
                'and must be diagnosed by LRC-4.'
            ].join(' ')
        ]),
        miscLimits: false,
        representableExactly: false
    });
};

const resolveScratchInterpolation = policy => {
    const transformPolicy = getTransformPresentationPolicy(policy);
    return Boolean(
        transformPolicy &&
        transformPolicy.interpolation === PRESENTATION_DOMAIN_MODES.IF_SUPPORTED &&
        policy.presentation.refreshPolicy !== PRESENTATION_REFRESH_POLICIES.EXACT_TICK
    );
};

const createScratchRuntimePolicyApplicationPlan = value => {
    const policy = normalizeRuntimePolicySet(value);
    return Object.freeze({
        framerate: policy.execution.simulationTickRate,
        interpolation: resolveScratchInterpolation(policy),
        turboMode: policy.execution.legacyScratchTurboMode,
        runtimeOptions: Object.freeze({
            fencing: policy.scratchCompatibility.fencing,
            maxClones: resolveCloneLimit(policy.safety.cloneBudget)
        })
    });
};

const createScratchRuntimePolicyDomainApplicationPlan = (value, domain) => {
    const policy = normalizeRuntimePolicySet(value);
    const plan = {
        adapterId: SCRATCH_BACKEND_DOMAIN_APPLICATION_ID,
        compilerOptions: null,
        diagnostics: [],
        domain,
        framerate: null,
        highQualityRender: null,
        interpolation: null,
        runtimeOptions: null,
        turboMode: null
    };

    if (domain === RUNTIME_POLICY_DOMAIN_IDS.EXECUTION) {
        plan.framerate = policy.execution.simulationTickRate;
        plan.turboMode = policy.execution.legacyScratchTurboMode;
    } else if (domain === RUNTIME_POLICY_DOMAIN_IDS.PRESENTATION) {
        plan.interpolation = resolveScratchInterpolation(policy);
        plan.highQualityRender = policy.presentation.renderQuality === RENDER_QUALITY_POLICIES.HIGH;
    } else if (domain === RUNTIME_POLICY_DOMAIN_IDS.SAFETY) {
        plan.runtimeOptions = {maxClones: resolveCloneLimit(policy.safety.cloneBudget)};
    } else if (domain === RUNTIME_POLICY_DOMAIN_IDS.SCRATCH_COMPATIBILITY) {
        const miscLimits = resolveLegacyMiscLimits(policy.scratchCompatibility, policy.presentation);
        plan.runtimeOptions = {
            fencing: policy.scratchCompatibility.fencing,
            miscLimits: miscLimits.miscLimits
        };
        plan.diagnostics.push(...miscLimits.diagnostics);
    } else if (domain === RUNTIME_POLICY_DOMAIN_IDS.EXECUTION_BACKEND) {
        plan.compilerOptions = {
            enabled: policy.executionBackend.mode !== EXECUTION_BACKEND_MODES.INTERPRETER
        };
    } else if (domain === RUNTIME_POLICY_DOMAIN_IDS.BACKEND_HINTS) {
        if (policy.backendHints.offscreenDrawableCulling !== BACKEND_HINT_VALUES.AUTO) {
            plan.runtimeOptions = {
                offscreenDrawableCulling: policy.backendHints.offscreenDrawableCulling === BACKEND_HINT_VALUES.ON
            };
        }
    } else {
        throw new TypeError(`Scratch Runtime Policy Adapter does not support domain: ${domain}`);
    }

    return Object.freeze(Object.assign({}, plan, {
        compilerOptions: plan.compilerOptions ? Object.freeze(plan.compilerOptions) : null,
        diagnostics: Object.freeze(plan.diagnostics.slice()),
        runtimeOptions: plan.runtimeOptions ? Object.freeze(plan.runtimeOptions) : null
    }));
};

const assertVMCorePolicySetters = vm => {
    if (!vm || typeof vm.setFramerate !== 'function' || typeof vm.setInterpolation !== 'function' ||
        typeof vm.setRuntimeOptions !== 'function') {
        throw new TypeError('Scratch Runtime Policy Adapter requires VM runtime-policy setter capabilities.');
    }
    return vm;
};

class ScratchRuntimePolicyAdapter {
    constructor (vm) {
        this.id = SCRATCH_RUNTIME_POLICY_ADAPTER_ID;
        this.vm = assertVMCorePolicySetters(vm);
        Object.seal(this);
    }

    apply (policy) {
        const plan = createScratchRuntimePolicyApplicationPlan(policy);
        this.vm.setFramerate(plan.framerate);
        const currentTurboMode = this.vm.runtime ? Boolean(this.vm.runtime.turboMode) : false;
        if (plan.turboMode !== currentTurboMode && typeof this.vm.setTurboMode === 'function') {
            this.vm.setTurboMode(plan.turboMode);
        }
        this.vm.setInterpolation(plan.interpolation);
        this.vm.setRuntimeOptions(plan.runtimeOptions);
        return plan;
    }

    applyDomain (policy, domain) {
        const plan = createScratchRuntimePolicyDomainApplicationPlan(policy, domain);
        if (plan.framerate !== null) this.vm.setFramerate(plan.framerate);
        if (plan.turboMode !== null) {
            const currentTurboMode = this.vm.runtime ? Boolean(this.vm.runtime.turboMode) : false;
            if (plan.turboMode !== currentTurboMode) {
                if (typeof this.vm.setTurboMode !== 'function') {
                    throw new TypeError('Scratch execution policy requires VM turbo mode capability.');
                }
                this.vm.setTurboMode(plan.turboMode);
            }
        }
        if (plan.interpolation !== null) this.vm.setInterpolation(plan.interpolation);
        if (plan.runtimeOptions) this.vm.setRuntimeOptions(plan.runtimeOptions);
        if (plan.highQualityRender !== null) {
            const renderer = this.vm.renderer;
            if (!renderer || typeof renderer.setUseHighQualityRender !== 'function') {
                throw new TypeError('Scratch presentation policy requires renderer high-quality render capability.');
            }
            renderer.setUseHighQualityRender(plan.highQualityRender);
        }
        if (plan.compilerOptions) {
            if (typeof this.vm.setCompilerOptions !== 'function') {
                throw new TypeError('Scratch execution backend policy requires VM compiler option capability.');
            }
            this.vm.setCompilerOptions(plan.compilerOptions);
        }
        return plan;
    }
}

const createScratchRuntimePolicyAdapter = vm => new ScratchRuntimePolicyAdapter(vm);

module.exports = {
    SCRATCH_BACKEND_DOMAIN_APPLICATION_ID,
    SCRATCH_RUNTIME_POLICY_ADAPTER_ID,
    ScratchRuntimePolicyAdapter,
    createScratchRuntimePolicyAdapter,
    createScratchRuntimePolicyApplicationPlan,
    createScratchRuntimePolicyDomainApplicationPlan,
    resolveLegacyMiscLimits
};
