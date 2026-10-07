'use strict';

const {
    CLONE_BUDGET_MODES,
    COMPATIBILITY_STATUS,
    EXECUTION_BACKEND_MODES,
    PRESENTATION_DOMAIN_MODES,
    RESOURCE_RISK,
    RUNTIME_POLICY_PROFILE_IDS,
    createCompatibilityAnalyzer,
    createRuntimePolicyProfileRegistry,
    createScratchBackendCapabilitySnapshot,
    createScratchProjectCompatibilitySnapshot
} = require('../../../../src/lib/runtime-policy');

const clone = value => JSON.parse(JSON.stringify(value));

const createVM = (opcodes, options = {}) => {
    const blocks = {};
    opcodes.forEach((opcode, index) => {
        blocks[`block-${index}`] = {opcode};
    });
    return {
        renderer: options.renderer === false ? null : {setUseHighQualityRender: () => {}},
        runtime: {
            extensionManager: {_loadedExtensions: new Map(options.loadedExtensions || [])},
            stageHeight: options.stageHeight || 360,
            stageWidth: options.stageWidth || 480,
            targets: [{blocks: {_blocks: blocks}, isStage: false}]
        },
        setCompilerOptions: options.compilerControl === false ? undefined : () => {},
        setFramerate: () => {},
        setInterpolation: options.interpolation === false ? undefined : () => {},
        setRuntimeOptions: () => {},
        setStageSize: options.stageGeometry === false ? undefined : () => {},
        setTurboMode: options.turboMode === false ? undefined : () => {}
    };
};

const analyze = (policy, opcodes, options = {}) => {
    const vm = createVM(opcodes, options.backend || {});
    return createCompatibilityAnalyzer(options.analyzer).analyze({
        backend: createScratchBackendCapabilitySnapshot(vm),
        legacy: options.legacy || null,
        policy,
        project: createScratchProjectCompatibilitySnapshot(vm, {
            extensionDescriptors: options.extensionDescriptors
        })
    });
};

describe('LRC-4 Compatibility Analyzer', () => {
    const profiles = createRuntimePolicyProfileRegistry();

    test('reports pure transform motion as compatible with the high-refresh transform presenter', () => {
        const policy = profiles.createPolicySet(RUNTIME_POLICY_PROFILE_IDS.NGVGE_HIGH_REFRESH);
        const report = analyze(policy, ['motion_movesteps', 'motion_turnright']);
        expect(report.sections.presentation.status).toBe(COMPATIBILITY_STATUS.COMPATIBLE);
        expect(report.sections.presentation.domains[0].domainId).toBe('scratch.sprite.transform');
        expect(report.sections.presentation.domains[0].capability.supportsInterpolation).toBe(true);
    });

    test('reports Pen and Stamp as partial on high refresh rather than claiming project-wide interpolation', () => {
        const policy = profiles.createPolicySet(RUNTIME_POLICY_PROFILE_IDS.NGVGE_HIGH_REFRESH);
        const report = analyze(policy, ['motion_movesteps', 'pen_penDown', 'pen_stamp']);
        expect(report.sections.presentation.status).toBe(COMPATIBILITY_STATUS.PARTIAL);
        expect(report.sections.presentation.diagnostics).toEqual(expect.arrayContaining([
            expect.objectContaining({code: 'compat.presentation.exact-tick-domain-on-high-refresh'})
        ]));
        expect(report.recommendations.join(' ')).toMatch(/exact-tick presentation/);
    });

    test('keeps Pen presentation compatible under exact-tick Scratch presentation', () => {
        const policy = profiles.createPolicySet(RUNTIME_POLICY_PROFILE_IDS.SCRATCH_COMPATIBLE);
        const report = analyze(policy, ['pen_penDown', 'pen_setPenSizeTo']);
        expect(report.sections.presentation.status).toBe(COMPATIBILITY_STATUS.COMPATIBLE);
    });

    test('reports timer-sensitive logic as partial when simulation tick deviates from Scratch 30 Hz', () => {
        const policy = clone(profiles.createPolicySet(RUNTIME_POLICY_PROFILE_IDS.CUSTOM));
        policy.execution.simulationTickRate = 60;
        const report = analyze(policy, ['control_wait', 'sensing_timer']);
        expect(report.sections.execution.status).toBe(COMPATIBILITY_STATUS.PARTIAL);
        expect(report.sections.execution.diagnostics[0].code).toBe(
            'compat.execution.tick-sensitive-nondefault-rate'
        );
    });

    test('separates backend capability failure from semantic presentation compatibility', () => {
        const policy = profiles.createPolicySet(RUNTIME_POLICY_PROFILE_IDS.NGVGE_HIGH_REFRESH);
        const report = analyze(policy, ['motion_movesteps'], {backend: {interpolation: false}});
        expect(report.sections.presentation.status).toBe(COMPATIBILITY_STATUS.COMPATIBLE);
        expect(report.sections.backend.status).toBe(COMPATIBILITY_STATUS.INCOMPATIBLE);
        expect(report.sections.backend.diagnostics[0].code).toBe('compat.backend.interpolation-unavailable');
    });

    test('reports unknown custom extension capability explicitly instead of assuming compatibility', () => {
        const policy = profiles.createPolicySet(RUNTIME_POLICY_PROFILE_IDS.NGVGE_BALANCED);
        const report = analyze(policy, ['mystery_draw'], {
            backend: {loadedExtensions: [['mystery', 'service.mystery']]},
            extensionDescriptors: [{
                extensionId: 'mystery',
                visualDomains: ['extension.mystery.visual']
            }]
        });
        expect(report.sections.presentation.status).toBe(COMPATIBILITY_STATUS.UNKNOWN);
        expect(report.sections.presentation.diagnostics).toEqual(expect.arrayContaining([
            expect.objectContaining({code: 'compat.presentation.capability-missing'})
        ]));
    });

    test('reports clone-heavy legacy unbounded intent as bounded resource risk rather than infinite authority', () => {
        const policy = clone(profiles.createPolicySet(RUNTIME_POLICY_PROFILE_IDS.CUSTOM));
        policy.safety.cloneBudget = {
            hostHardCeiling: 300,
            mode: CLONE_BUDGET_MODES.LEGACY_UNBOUNDED_REQUEST,
            requestedLimit: null
        };
        const report = analyze(policy, Array.from({length: 8}, () => 'control_create_clone_of'));
        expect(report.sections.resource.risk).toBe(RESOURCE_RISK.MEDIUM);
        expect(report.sections.resource.status).toBe(COMPATIBILITY_STATUS.PARTIAL);
        expect(report.sections.resource.diagnostics).toEqual(expect.arrayContaining([
            expect.objectContaining({code: 'compat.resource.legacy-unbounded-request-bounded'})
        ]));
    });

    test('reports unsupported Legacy migrations as a separate incompatible Legacy result', () => {
        const policy = profiles.createPolicySet(RUNTIME_POLICY_PROFILE_IDS.SCRATCH_COMPATIBLE);
        const report = analyze(policy, ['event_whenflagclicked'], {
            legacy: {
                diagnostics: [{severity: 'error'}],
                migrationRecords: [{legacyPath: 'futureFlag', status: 'unsupported'}],
                precedenceSnapshot: {}
            }
        });
        expect(report.sections.legacy.status).toBe(COMPATIBILITY_STATUS.INCOMPATIBLE);
        expect(report.sections.execution.status).toBe(COMPATIBILITY_STATUS.COMPATIBLE);
    });

    test('reports backend execution override requirements independently', () => {
        const policy = clone(profiles.createPolicySet(RUNTIME_POLICY_PROFILE_IDS.CUSTOM));
        policy.executionBackend.mode = EXECUTION_BACKEND_MODES.INTERPRETER;
        const report = analyze(policy, ['event_whenflagclicked'], {backend: {compilerControl: false}});
        expect(report.sections.backend.status).toBe(COMPATIBILITY_STATUS.INCOMPATIBLE);
        expect(report.sections.backend.diagnostics).toEqual(expect.arrayContaining([
            expect.objectContaining({code: 'compat.backend.execution-mode-unavailable'})
        ]));
    });

    test('fails visibly when an unsupported presenter mode is explicitly requested', () => {
        const policy = clone(profiles.createPolicySet(RUNTIME_POLICY_PROFILE_IDS.CUSTOM));
        policy.presentation.domainPolicies.push({
            domainId: 'scratch.pen',
            interpolation: PRESENTATION_DOMAIN_MODES.IF_SUPPORTED,
            requiresExactTickPresentation: true,
            resampling: PRESENTATION_DOMAIN_MODES.DISABLED
        });
        const report = analyze(policy, ['pen_penDown']);
        expect(report.sections.presentation.status).toBe(COMPATIBILITY_STATUS.INCOMPATIBLE);
        expect(report.sections.presentation.diagnostics).toEqual(expect.arrayContaining([
            expect.objectContaining({code: 'compat.presentation.interpolation-unsupported'})
        ]));
    });
});
