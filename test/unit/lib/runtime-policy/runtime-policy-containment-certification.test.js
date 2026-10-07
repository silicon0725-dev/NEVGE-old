'use strict';

const ExtendedJSON = require('@turbowarp/json');
const {
    CLONE_BUDGET_MODES,
    COMPATIBILITY_STATUS,
    LEGACY_RUNTIME_SOURCE_IDS,
    LEGACY_TWCONFIG_MAGIC,
    PRESENTATION_DOMAIN_MODES,
    PRESENTATION_REFRESH_POLICIES,
    RUNTIME_POLICY_DOMAIN_IDS,
    RUNTIME_POLICY_PROFILE_IDS,
    SCRATCH_TRANSFORM_PRESENTATION_DOMAIN,
    createRuntimePolicyProfileRegistry,
    getRuntimePolicyClient,
    installLegacyRuntimeSettingsCompatibilityService,
    installRuntimeCompatibilityService,
    installRuntimePolicyService,
    unwrapRuntimePolicyCommandResult
} = require('../../../../src/lib/runtime-policy');

const createFakeVM = (opcodes = [], options = {}) => {
    const calls = [];
    const blocks = {};
    opcodes.forEach((opcode, index) => {
        blocks[`block-${index}`] = {opcode};
    });
    const stage = {
        comments: {},
        createComment: (id, blockId, text) => {
            stage.comments[id] = {id, text};
            calls.push(['createComment', text]);
        },
        isStage: true
    };
    const loadedExtensions = new Map();
    (options.loadedExtensions || []).forEach(extensionId => {
        loadedExtensions.set(extensionId, `service.${extensionId}`);
    });
    const runtime = {
        compilerOptions: {enabled: true, warpTimer: false},
        extensionManager: {_loadedExtensions: loadedExtensions},
        frameLoop: {framerate: 30, opsPerFrame: 1},
        getTargetForStage: () => stage,
        interpolationEnabled: false,
        runtimeOptions: {
            fencing: true,
            maxClones: 300,
            miscLimits: true,
            offscreenDrawableCulling: false
        },
        stageHeight: 360,
        stageWidth: 480,
        targets: [stage, {blocks: {_blocks: blocks}, isStage: false}],
        turboMode: false
    };
    const renderer = {
        setUseHighQualityRender: value => {
            renderer.useHighQualityRender = value;
            calls.push(['setUseHighQualityRender', value]);
        },
        useHighQualityRender: false
    };
    const vm = {
        calls,
        editingTarget: stage,
        renderer,
        runtime,
        emitWorkspaceUpdate: () => calls.push(['emitWorkspaceUpdate']),
        setCompilerOptions: value => {
            Object.assign(runtime.compilerOptions, value);
            calls.push(['setCompilerOptions', value]);
        },
        setFramerate: value => {
            runtime.frameLoop.framerate = value;
            calls.push(['setFramerate', value]);
        },
        setInterpolation: value => {
            runtime.interpolationEnabled = value;
            calls.push(['setInterpolation', value]);
        },
        setOpsPerFrame: value => {
            runtime.frameLoop.opsPerFrame = value;
            calls.push(['setOpsPerFrame', value]);
        },
        setRuntimeOptions: value => {
            Object.assign(runtime.runtimeOptions, value);
            calls.push(['setRuntimeOptions', value]);
        },
        setStageSize: (width, height) => {
            runtime.stageWidth = width;
            runtime.stageHeight = height;
            calls.push(['setStageSize', width, height]);
        },
        setTurboMode: value => {
            runtime.turboMode = value;
            calls.push(['setTurboMode', value]);
        }
    };
    runtime.emitProjectChanged = () => calls.push(['emitProjectChanged']);
    return {stage, vm};
};

const installStack = (vm, options = {}) => {
    installRuntimePolicyService(vm);
    const legacy = installLegacyRuntimeSettingsCompatibilityService(vm);
    const compatibility = installRuntimeCompatibilityService(vm, options);
    return {
        compatibility,
        legacy,
        runtimePolicy: getRuntimePolicyClient(vm.runtime)
    };
};

const setHighRefreshPresentation = runtimePolicy => unwrapRuntimePolicyCommandResult(runtimePolicy.patchDomain(
    RUNTIME_POLICY_DOMAIN_IDS.PRESENTATION,
    {
        domainPolicies: [{
            domainId: SCRATCH_TRANSFORM_PRESENTATION_DOMAIN,
            interpolation: PRESENTATION_DOMAIN_MODES.IF_SUPPORTED,
            requiresExactTickPresentation: false,
            resampling: PRESENTATION_DOMAIN_MODES.DISABLED
        }],
        refreshPolicy: PRESENTATION_REFRESH_POLICIES.DISPLAY
    }
));

const makeTwconfigComment = options => [
    'Configuration for https://turbowarp.org/',
    `${ExtendedJSON.stringify(options)}${LEGACY_TWCONFIG_MAGIC}`
].join('\n');

describe('LRC-G1 Runtime Policy Containment Certification', () => {
    test('keeps Execution and Presentation mutations independent through the production command path', () => {
        const {vm} = createFakeVM(['motion_movesteps']);
        const {runtimePolicy} = installStack(vm);

        vm.calls.length = 0;
        setHighRefreshPresentation(runtimePolicy);
        expect(vm.calls).toEqual(expect.arrayContaining([
            ['setInterpolation', true]
        ]));
        expect(vm.calls.some(call => call[0] === 'setFramerate')).toBe(false);
        expect(runtimePolicy.getSnapshot().execution.simulationTickRate).toBe(30);

        vm.calls.length = 0;
        unwrapRuntimePolicyCommandResult(runtimePolicy.patchDomain(
            RUNTIME_POLICY_DOMAIN_IDS.EXECUTION,
            {simulationTickRate: 60}
        ));
        expect(vm.calls).toEqual(expect.arrayContaining([
            ['setFramerate', 60]
        ]));
        expect(vm.calls.some(call => call[0] === 'setInterpolation')).toBe(false);
        expect(runtimePolicy.getSnapshot().presentation.refreshPolicy).toBe(PRESENTATION_REFRESH_POLICIES.DISPLAY);
    });

    test('represents 30 Hz Scratch simulation with display-refresh transform presentation', () => {
        const {vm} = createFakeVM(['motion_movesteps']);
        const {compatibility} = installStack(vm);
        const profile = createRuntimePolicyProfileRegistry().createPolicySet(
            RUNTIME_POLICY_PROFILE_IDS.NGVGE_HIGH_REFRESH
        );
        const report = compatibility.previewPolicy(profile);

        expect(profile.execution.simulationTickRate).toBe(30);
        expect(profile.presentation.refreshPolicy).toBe(PRESENTATION_REFRESH_POLICIES.DISPLAY);
        expect(report.sections.execution.status).toBe(COMPATIBILITY_STATUS.COMPATIBLE);
        expect(report.sections.presentation.status).toBe(COMPATIBILITY_STATUS.COMPATIBLE);
    });

    test('detects Pen and Stamp exact-tick limitations instead of hiding them behind transform interpolation', () => {
        const {vm} = createFakeVM(['motion_movesteps', 'pen_penDown', 'pen_stamp']);
        const {compatibility} = installStack(vm);
        const profile = createRuntimePolicyProfileRegistry().createPolicySet(
            RUNTIME_POLICY_PROFILE_IDS.NGVGE_HIGH_REFRESH
        );
        const report = compatibility.previewPolicy(profile);

        expect(report.sections.presentation.status).toBe(COMPATIBILITY_STATUS.PARTIAL);
        expect(report.sections.presentation.diagnostics).toEqual(expect.arrayContaining([
            expect.objectContaining({code: 'compat.presentation.exact-tick-domain-on-high-refresh'})
        ]));
        expect(report.sections.presentation.domains).toEqual(expect.arrayContaining([
            expect.objectContaining({
                capability: expect.objectContaining({requiresExactTickPresentation: true}),
                domainId: 'scratch.pen'
            }),
            expect.objectContaining({
                capability: expect.objectContaining({requiresExactTickPresentation: true}),
                domainId: 'scratch.stamp'
            })
        ]));
    });

    test('reports backend interpolation absence separately from semantic Presentation compatibility', () => {
        const {vm} = createFakeVM(['motion_movesteps']);
        const {compatibility} = installStack(vm);
        const profile = createRuntimePolicyProfileRegistry().createPolicySet(
            RUNTIME_POLICY_PROFILE_IDS.NGVGE_HIGH_REFRESH
        );
        delete vm.setInterpolation;

        const report = compatibility.previewPolicy(profile);
        expect(report.sections.presentation.status).toBe(COMPATIBILITY_STATUS.COMPATIBLE);
        expect(report.sections.backend.status).toBe(COMPATIBILITY_STATUS.INCOMPATIBLE);
    });

    test('keeps Legacy project FPS scoped to Execution and preserves active Presentation policy', () => {
        const {vm} = createFakeVM(['motion_movesteps']);
        const {legacy, runtimePolicy} = installStack(vm);
        setHighRefreshPresentation(runtimePolicy);

        legacy.importLegacyProjectOptions({framerate: 60});
        const policy = runtimePolicy.getSnapshot();
        expect(policy.execution.simulationTickRate).toBe(60);
        expect(policy.presentation.refreshPolicy).toBe(PRESENTATION_REFRESH_POLICIES.DISPLAY);
        expect(vm.runtime.interpolationEnabled).toBe(true);
    });

    test('retains per-key session intent under project precedence and restores it after project claim clears', () => {
        const {vm} = createFakeVM();
        const {legacy} = installStack(vm);

        legacy.setFramerate(120, LEGACY_RUNTIME_SOURCE_IDS.URL_SESSION);
        legacy.importLegacyProjectOptions({framerate: 60});
        expect(vm.runtime.frameLoop.framerate).toBe(60);

        legacy.setFramerate(144, LEGACY_RUNTIME_SOURCE_IDS.URL_SESSION);
        expect(vm.runtime.frameLoop.framerate).toBe(60);

        legacy.importLegacyProjectOptions({});
        expect(vm.runtime.frameLoop.framerate).toBe(144);
    });

    test('contains _twconfig_ to explicit Legacy import/export and never emits it for Native mutation', () => {
        const {stage, vm} = createFakeVM();
        stage.comments.config = {id: 'config', text: makeTwconfigComment({framerate: 50})};
        const {legacy, runtimePolicy} = installStack(vm);

        const imported = vm.runtime.parseProjectOptions();
        expect(imported.found).toBe(true);
        expect(runtimePolicy.getSnapshot().execution.simulationTickRate).toBe(50);

        stage.comments = {};
        unwrapRuntimePolicyCommandResult(runtimePolicy.patchDomain(
            RUNTIME_POLICY_DOMAIN_IDS.EXECUTION,
            {simulationTickRate: 30}
        ));
        expect(Object.keys(stage.comments)).toHaveLength(0);

        legacy.exportLegacyProjectOptionsToProject();
        expect(Object.values(stage.comments)[0].text).toContain(LEGACY_TWCONFIG_MAGIC);
    });

    test('bounds Legacy infinite clone intent by Host hard ceiling', () => {
        const {vm} = createFakeVM();
        const {legacy, runtimePolicy} = installStack(vm);
        legacy.importLegacyProjectOptions({runtimeOptions: {maxClones: Infinity}});

        const budget = runtimePolicy.getSnapshot().safety.cloneBudget;
        expect(budget.mode).toBe(CLONE_BUDGET_MODES.LEGACY_UNBOUNDED_REQUEST);
        expect(budget.requestedLimit).toBeNull();
        expect(vm.runtime.runtimeOptions.maxClones).toBe(budget.hostHardCeiling);
        expect(vm.runtime.runtimeOptions.maxClones).not.toBe(Infinity);
    });

    test('keeps profile preview query-only and fails visibly for unknown renderer domains', () => {
        const {vm} = createFakeVM(['render3d_drawMesh'], {loadedExtensions: ['render3d']});
        const {compatibility, runtimePolicy} = installStack(vm, {
            extensionDescriptors: [{extensionId: 'render3d', visualDomains: ['extension.renderer.3d']}]
        });
        const profile = createRuntimePolicyProfileRegistry().createPolicySet(
            RUNTIME_POLICY_PROFILE_IDS.NGVGE_HIGH_REFRESH
        );
        const beforePolicy = runtimePolicy.getSnapshot();
        const beforeCalls = vm.calls.slice();

        const report = compatibility.previewPolicy(profile);
        expect(report.sections.presentation.status).toBe(COMPATIBILITY_STATUS.UNKNOWN);
        expect(report.sections.presentation.diagnostics).toEqual(expect.arrayContaining([
            expect.objectContaining({code: 'compat.presentation.capability-missing'})
        ]));
        expect(runtimePolicy.getSnapshot()).toEqual(beforePolicy);
        expect(vm.calls).toEqual(beforeCalls);
    });
});
