'use strict';

const {
    CLONE_BUDGET_MODES,
    LEGACY_TWCONFIG_MAGIC,
    RUNTIME_POLICY_RUNTIME_PROPERTY,
    createLegacyAdvancedSettingsBridge
} = require('../../../../src/lib/runtime-policy');

const createFakeVM = () => {
    const calls = [];
    const stage = {
        comments: {},
        createComment: (id, blockId, text) => {
            stage.comments[id] = {id, text};
            calls.push(['createLegacyConfigComment']);
        },
        isStage: true
    };
    const runtime = {
        compilerOptions: {enabled: true, warpTimer: false},
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
        turboMode: false
    };
    runtime.emitProjectChanged = () => calls.push(['emitProjectChanged']);
    const renderer = {
        setUseHighQualityRender: value => calls.push(['renderer.setUseHighQualityRender', value]),
        useHighQualityRender: false
    };
    const vm = {
        calls,
        editingTarget: stage,
        renderer,
        runtime,
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
        },
        emitWorkspaceUpdate: () => calls.push(['emitWorkspaceUpdate'])
    };
    return vm;
};

describe('LRC-2B Legacy Advanced Settings bridge', () => {
    test('routes Runtime Policy-owned controls through the installed Runtime Policy client', () => {
        const vm = createFakeVM();
        const bridge = createLegacyAdvancedSettingsBridge(vm);
        expect(vm.runtime[RUNTIME_POLICY_RUNTIME_PROPERTY]).toBeDefined();

        bridge.setFramerate(60);
        bridge.setInterpolation(true);
        bridge.setHighQualityPen(true);
        bridge.setFencing(false);
        bridge.setRemoveLimits(true);
        bridge.setOffscreenDrawableCulling(true);
        bridge.setDisableCompiler(true);

        expect(vm.calls).toEqual([
            ['setFramerate', 60],
            ['setInterpolation', true],
            ['renderer.setUseHighQualityRender', false],
            ['setInterpolation', true],
            ['renderer.setUseHighQualityRender', true],
            ['setRuntimeOptions', {fencing: true, miscLimits: true}],
            ['setRuntimeOptions', {fencing: false, miscLimits: true}],
            ['setRuntimeOptions', {fencing: false, miscLimits: false}],
            ['setRuntimeOptions', {offscreenDrawableCulling: true}],
            ['setCompilerOptions', {enabled: false}]
        ]);
    });

    test('does not grant unbounded clone authority to the Legacy Infinite Clones checkbox', () => {
        const vm = createFakeVM();
        const bridge = createLegacyAdvancedSettingsBridge(vm);
        bridge.setInfiniteClones(true);
        const policy = vm.runtime[RUNTIME_POLICY_RUNTIME_PROPERTY].getSnapshot();
        expect(policy.safety.cloneBudget.mode).toBe(CLONE_BUDGET_MODES.LEGACY_UNBOUNDED_REQUEST);
        expect(policy.safety.cloneBudget.hostHardCeiling).toBe(300);
        expect(vm.calls).toEqual([['setRuntimeOptions', {maxClones: 300}]]);
    });

    test('keeps OpsPerFrame, Warp Timer and stage geometry quarantined and exports _twconfig_ only explicitly', () => {
        const vm = createFakeVM();
        const bridge = createLegacyAdvancedSettingsBridge(vm);
        expect(bridge.quarantineId).toBe('ngvge.legacy-runtime-settings-quarantine@1');
        bridge.setOpsPerFrame(2);
        bridge.setWarpTimer(true);
        bridge.setStageSize(640, 360);
        const exported = bridge.storeLegacyProjectOptions();

        expect(vm.calls.slice(0, 3)).toEqual([
            ['setOpsPerFrame', 2],
            ['setCompilerOptions', {warpTimer: true}],
            ['setStageSize', 640, 360]
        ]);
        expect(exported.explicitLegacyExport).toBe(true);
        const comment = Object.values(vm.editingTarget.comments)[0];
        expect(comment.text).toContain(LEGACY_TWCONFIG_MAGIC);
        expect(comment.text).toContain('"opsPerFrame":2');
        expect(comment.text).toContain('"width":640');
        expect(comment.text).not.toContain('\"height\"');
        expect(vm.calls).not.toContainEqual(['storeProjectOptions']);
        expect(vm.calls).toContainEqual(['emitProjectChanged']);
        expect(vm.calls).toContainEqual(['emitWorkspaceUpdate']);
    });
});
