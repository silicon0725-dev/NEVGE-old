'use strict';

const {
    COMPATIBILITY_STATUS,
    RUNTIME_COMPATIBILITY_SERVICE_ID,
    RUNTIME_POLICY_PROFILE_IDS,
    createRuntimePolicyProfileRegistry,
    getRuntimePolicyClient,
    installLegacyRuntimeSettingsCompatibilityService,
    installRuntimeCompatibilityService,
    installRuntimePolicyService
} = require('../../../../src/lib/runtime-policy');

const createFakeVM = opcodes => {
    const calls = [];
    const blocks = {};
    opcodes.forEach((opcode, index) => {
        blocks[`block-${index}`] = {opcode};
    });
    const runtime = {
        compilerOptions: {enabled: true, warpTimer: false},
        extensionManager: {_loadedExtensions: new Map()},
        frameLoop: {framerate: 30, opsPerFrame: 1},
        interpolationEnabled: false,
        runtimeOptions: {
            fencing: true,
            maxClones: 300,
            miscLimits: true,
            offscreenDrawableCulling: false
        },
        stageHeight: 360,
        stageWidth: 480,
        targets: [{blocks: {_blocks: blocks}, isStage: false}],
        turboMode: false
    };
    const renderer = {
        setUseHighQualityRender: value => calls.push(['setUseHighQualityRender', value]),
        useHighQualityRender: false
    };
    const vm = {
        calls,
        renderer,
        runtime,
        setCompilerOptions: value => calls.push(['setCompilerOptions', value]),
        setFramerate: value => calls.push(['setFramerate', value]),
        setInterpolation: value => calls.push(['setInterpolation', value]),
        setOpsPerFrame: value => calls.push(['setOpsPerFrame', value]),
        setRuntimeOptions: value => calls.push(['setRuntimeOptions', value]),
        setStageSize: (width, height) => calls.push(['setStageSize', width, height]),
        setTurboMode: value => calls.push(['setTurboMode', value])
    };
    return vm;
};

describe('LRC-4 Runtime Compatibility Service', () => {
    test('analyzes and previews policies without mutating Runtime Policy or Scratch backend state', () => {
        const vm = createFakeVM(['pen_penDown', 'motion_movesteps']);
        installRuntimePolicyService(vm);
        installLegacyRuntimeSettingsCompatibilityService(vm);
        const service = installRuntimeCompatibilityService(vm);
        const runtimePolicy = getRuntimePolicyClient(vm.runtime);
        const beforePolicy = runtimePolicy.getSnapshot();
        const beforeCalls = vm.calls.slice();

        const current = service.analyzeCurrent();
        const highRefresh = createRuntimePolicyProfileRegistry().createPolicySet(
            RUNTIME_POLICY_PROFILE_IDS.NGVGE_HIGH_REFRESH
        );
        const preview = service.previewPolicy(highRefresh);

        expect(service.id).toBe(RUNTIME_COMPATIBILITY_SERVICE_ID);
        expect(current.sections.presentation.status).toBe(COMPATIBILITY_STATUS.COMPATIBLE);
        expect(current.sections.legacy.status).toBe(COMPATIBILITY_STATUS.COMPATIBLE);
        expect(preview.sections.presentation.status).toBe(COMPATIBILITY_STATUS.PARTIAL);
        expect(runtimePolicy.getSnapshot()).toEqual(beforePolicy);
        expect(vm.calls).toEqual(beforeCalls);
    });

    test('exposes immutable project and backend query snapshots', () => {
        const vm = createFakeVM(['control_wait', 'pen_stamp']);
        installRuntimePolicyService(vm);
        installLegacyRuntimeSettingsCompatibilityService(vm);
        const service = installRuntimeCompatibilityService(vm);
        const project = service.scanProject();
        const backend = service.scanBackend();
        expect(Object.isFrozen(project)).toBe(true);
        expect(Object.isFrozen(backend)).toBe(true);
        expect(project.features.usesStamp).toBe(true);
        expect(project.features.exactTickSensitive).toBe(true);
        expect(backend.capabilities.interpolation).toBe(true);
    });

    test('surfaces active Legacy precedence as a separate report section', () => {
        const vm = createFakeVM(['motion_movesteps']);
        installRuntimePolicyService(vm);
        const legacy = installLegacyRuntimeSettingsCompatibilityService(vm);
        const service = installRuntimeCompatibilityService(vm);
        legacy.setFramerate(60, 'legacy-runtime.url-session');
        const report = service.analyzeCurrent();
        expect(report.sections.legacy.status).toBe(COMPATIBILITY_STATUS.PARTIAL);
        expect(report.sections.legacy.diagnostics).toEqual(expect.arrayContaining([
            expect.objectContaining({code: 'compat.legacy.override-active'})
        ]));
    });
});
