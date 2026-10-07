'use strict';

const ExtendedJSON = require('@turbowarp/json');
const {
    BACKEND_HINT_VALUES,
    CLONE_BUDGET_MODES,
    LEGACY_RUNTIME_PRECEDENCE,
    LEGACY_RUNTIME_SOURCE_IDS,
    LEGACY_TWCONFIG_MAGIC,
    PRESENTATION_REFRESH_POLICIES,
    RENDER_QUALITY_POLICIES,
    SCRATCH_COMPATIBILITY_TOKENS,
    createLegacyProjectOptionsMigrationPlan,
    installLegacyRuntimeSettingsCompatibilityService,
    parseLegacyProjectOptionsCommentText
} = require('../../../../src/lib/runtime-policy');

const createFakeVM = () => {
    const calls = [];
    const stage = {
        comments: {},
        createComment: (id, blockId, text) => {
            stage.comments[id] = {id, text};
            calls.push(['createComment', text]);
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

const makeComment = options => [
    'Configuration for https://turbowarp.org/',
    `${ExtendedJSON.stringify(options)}${LEGACY_TWCONFIG_MAGIC}`
].join('\n');

describe('LRC-3 Legacy Runtime Settings Compatibility Adapter', () => {
    test('parses ExtendedJSON _twconfig_ without invoking a Runtime setter', () => {
        const parsed = parseLegacyProjectOptionsCommentText(makeComment({
            framerate: 60,
            runtimeOptions: {maxClones: Infinity}
        }));
        expect(parsed.found).toBe(true);
        expect(parsed.options.framerate).toBe(60);
        expect(parsed.options.runtimeOptions.maxClones).toBe(Infinity);
        expect(parsed.diagnostics).toEqual([]);
    });

    test('creates a migration record for every known field and keeps mixed semantics out of Native Policy fields', () => {
        const plan = createLegacyProjectOptionsMigrationPlan({
            framerate: 60,
            height: 360,
            hq: true,
            interpolation: true,
            opsPerFrame: 2,
            runtimeOptions: {
                fencing: false,
                maxClones: Infinity,
                miscLimits: true,
                offscreenDrawableCulling: true
            },
            turbo: true,
            width: 640
        });
        const paths = plan.records.map(record => record.legacyPath);
        expect(paths).toEqual(expect.arrayContaining([
            'framerate',
            'opsPerFrame',
            'turbo',
            'interpolation',
            'runtimeOptions.maxClones',
            'runtimeOptions.fencing',
            'runtimeOptions.miscLimits',
            'runtimeOptions.offscreenDrawableCulling',
            'hq',
            'width',
            'height'
        ]));
        expect(plan.sourceValues['legacy.scheduler.opsPerFrame']).toBe(2);
        expect(plan.sourceValues['project.viewport.width']).toBe(640);
        expect(plan.sourceValues['presentation.renderQuality']).toBe(RENDER_QUALITY_POLICIES.HIGH);
        expect(plan.sourceValues['scratchCompatibility.penSizeLimits']).toBe(false);
        expect(plan.sourceValues.opsPerFrame).toBeUndefined();
        expect(plan.sourceValues.miscLimits).toBeUndefined();
    });

    test('fails visibly for unknown top-level and nested Legacy fields', () => {
        const plan = createLegacyProjectOptionsMigrationPlan({
            mystery: 1,
            runtimeOptions: {unknownLimit: false}
        });
        expect(plan.records).toEqual(expect.arrayContaining([
            expect.objectContaining({legacyPath: 'mystery', status: 'unsupported'}),
            expect.objectContaining({legacyPath: 'runtimeOptions.unknownLimit', status: 'unsupported'})
        ]));
        expect(plan.diagnostics.map(entry => entry.code)).toEqual(expect.arrayContaining([
            'legacy-runtime.project-options.unknown-field',
            'legacy-runtime.project-options.unknown-runtime-option'
        ]));
        expect(plan.diagnostics.every(entry => entry.severity === 'error')).toBe(true);
    });

    test('routes a complete Legacy project import to explicit owners and bounded backend projections', () => {
        const {vm} = createFakeVM();
        const service = installLegacyRuntimeSettingsCompatibilityService(vm);
        const result = service.importLegacyProjectOptions({
            framerate: 60,
            height: 400,
            hq: true,
            interpolation: true,
            opsPerFrame: 2,
            runtimeOptions: {
                fencing: false,
                maxClones: Infinity,
                miscLimits: true,
                offscreenDrawableCulling: true
            },
            turbo: true,
            width: 640
        });
        const policy = vm.runtime.ngvgeRuntimePolicy.getSnapshot();

        expect(result.records).toHaveLength(11);
        expect(policy.execution.simulationTickRate).toBe(60);
        expect(policy.execution.legacyScratchTurboMode).toBe(true);
        expect(policy.presentation.refreshPolicy).toBe(PRESENTATION_REFRESH_POLICIES.DISPLAY);
        expect(policy.presentation.renderQuality).toBe(RENDER_QUALITY_POLICIES.HIGH);
        expect(policy.safety.cloneBudget.mode).toBe(CLONE_BUDGET_MODES.LEGACY_UNBOUNDED_REQUEST);
        expect(policy.safety.cloneBudget.requestedLimit).toBeNull();
        expect(policy.scratchCompatibility.fencing).toBe(false);
        expect(policy.scratchCompatibility.penSizeLimits).toBe(false);
        expect(policy.scratchCompatibility.soundEffectLimits).toBe(true);
        expect(policy.scratchCompatibility.soundYieldSemantics).toBe(
            SCRATCH_COMPATIBILITY_TOKENS.SCRATCH_COMPATIBLE
        );
        expect(policy.backendHints.offscreenDrawableCulling).toBe(BACKEND_HINT_VALUES.ON);
        expect(vm.runtime.runtimeOptions.maxClones).toBe(300);
        expect(vm.runtime.frameLoop.opsPerFrame).toBe(2);
        expect(vm.runtime.stageWidth).toBe(640);
        expect(vm.runtime.stageHeight).toBe(400);
        expect(vm.runtime.turboMode).toBe(true);
    });

    test('keeps HQ pen compatibility split intact when Remove Limits is turned back off', () => {
        const {vm} = createFakeVM();
        const service = installLegacyRuntimeSettingsCompatibilityService(vm);
        service.setHighQualityPen(true, LEGACY_RUNTIME_SOURCE_IDS.ADVANCED_SETTINGS);
        service.setRemoveLimits(true, LEGACY_RUNTIME_SOURCE_IDS.ADVANCED_SETTINGS);
        service.setRemoveLimits(false, LEGACY_RUNTIME_SOURCE_IDS.ADVANCED_SETTINGS);

        const policy = vm.runtime.ngvgeRuntimePolicy.getSnapshot();
        expect(policy.presentation.renderQuality).toBe(RENDER_QUALITY_POLICIES.HIGH);
        expect(policy.scratchCompatibility.penSizeLimits).toBe(false);
        expect(policy.scratchCompatibility.soundEffectLimits).toBe(true);
        expect(vm.runtime.runtimeOptions.miscLimits).toBe(true);
    });

    test('uses per-key precedence: project import wins over session, then session resumes after project claim clears', () => {
        const {vm} = createFakeVM();
        const service = installLegacyRuntimeSettingsCompatibilityService(vm);

        service.setFramerate(144, LEGACY_RUNTIME_SOURCE_IDS.URL_SESSION);
        expect(vm.runtime.frameLoop.framerate).toBe(144);

        service.importLegacyProjectOptions({framerate: 60});
        expect(vm.runtime.frameLoop.framerate).toBe(60);
        expect(service.getPrecedenceSnapshot()['execution.simulationTickRate']).toMatchObject({
            precedence: LEGACY_RUNTIME_PRECEDENCE.LEGACY_PROJECT_IMPORT,
            sourceId: LEGACY_RUNTIME_SOURCE_IDS.LEGACY_PROJECT_IMPORT,
            value: 60
        });

        const blocked = service.setFramerate(120, LEGACY_RUNTIME_SOURCE_IDS.URL_SESSION);
        expect(vm.runtime.frameLoop.framerate).toBe(60);
        expect(blocked.blocked).toEqual([
            expect.objectContaining({
                key: 'execution.simulationTickRate',
                winnerSourceId: LEGACY_RUNTIME_SOURCE_IDS.LEGACY_PROJECT_IMPORT
            })
        ]);

        service.importLegacyProjectOptions({});
        expect(vm.runtime.frameLoop.framerate).toBe(120);
        expect(service.getPrecedenceSnapshot()['execution.simulationTickRate'].sourceId).toBe(
            LEGACY_RUNTIME_SOURCE_IDS.URL_SESSION
        );
    });

    test('native project semantics outrank Legacy project import on the same key', () => {
        const {vm} = createFakeVM();
        const service = installLegacyRuntimeSettingsCompatibilityService(vm);
        service.updateSource(LEGACY_RUNTIME_SOURCE_IDS.NATIVE_PROJECT, {
            'execution.simulationTickRate': 75
        });
        const imported = service.importLegacyProjectOptions({framerate: 60});

        expect(vm.runtime.frameLoop.framerate).toBe(75);
        expect(imported.result.blocked).toEqual([
            expect.objectContaining({winnerSourceId: LEGACY_RUNTIME_SOURCE_IDS.NATIVE_PROJECT})
        ]);
    });

    test('shadows the Scratch VM legacy parser so import crosses the NGVGE compatibility boundary once', () => {
        const {stage, vm} = createFakeVM();
        let originalParserCalls = 0;
        let originalExporterCalls = 0;
        vm.runtime.parseProjectOptions = () => {
            originalParserCalls += 1;
        };
        vm.runtime.storeProjectOptions = () => {
            originalExporterCalls += 1;
        };
        stage.comments.config = {id: 'config', text: makeComment({framerate: 50})};

        installLegacyRuntimeSettingsCompatibilityService(vm);
        const imported = vm.runtime.parseProjectOptions();
        const exported = vm.runtime.storeProjectOptions();

        expect(imported.found).toBe(true);
        expect(exported.explicitLegacyExport).toBe(true);
        expect(originalParserCalls).toBe(0);
        expect(originalExporterCalls).toBe(0);
        expect(vm.runtime.frameLoop.framerate).toBe(50);
    });

    test('does not recreate _twconfig_ during Native mutations; export is an explicit compatibility operation', () => {
        const {stage, vm} = createFakeVM();
        const service = installLegacyRuntimeSettingsCompatibilityService(vm);
        service.setFramerate(60, LEGACY_RUNTIME_SOURCE_IDS.ADVANCED_SETTINGS);
        expect(Object.keys(stage.comments)).toHaveLength(0);

        const exported = service.exportLegacyProjectOptionsToProject();
        expect(exported.explicitLegacyExport).toBe(true);
        expect(Object.values(stage.comments)[0].text).toContain(LEGACY_TWCONFIG_MAGIC);
    });
});
