import {EventEmitter} from 'events';

import {
    createScratchSpriteNodeAdapterService,
    createScratchTransformProjectionService,
    readScratchTargetTransform,
    scratchDirectionToTransformRotation
} from '../../../../src/lib/scratch-sprite-adapter';
import {
    createRuntimeNodeModelService,
    getRuntimeNodeModelHost
} from '../../../../src/lib/runtime-nodes';
import {
    createTransform2DRuntimeStoreForModel
} from '../../../../src/lib/transform-system';

const clone = value => JSON.parse(JSON.stringify(value));

const createScratchTarget = (id = 'target-runtime-a', overrides = {}) => Object.assign({
    direction: 90,
    id,
    isOriginal: true,
    isStage: false,
    size: 100,
    sprite: {name: 'Player'},
    x: 12,
    y: -8
}, overrides);

const createHarness = () => {
    let project = {
        activeSceneId: 'scene-a',
        extensionData: {},
        scenes: [{id: 'scene-a', name: 'Scene A'}]
    };
    const sceneListeners = new Set();
    const sceneDataModel = {
        getStatus: () => ({}),
        readProject: () => clone(project),
        subscribe: listener => {
            sceneListeners.add(listener);
            return () => sceneListeners.delete(listener);
        },
        writeProject: nextProject => {
            project = clone(nextProject);
            sceneListeners.forEach(listener => listener({type: 'data'}));
        }
    };
    const runtimeNodeModel = createRuntimeNodeModelService(sceneDataModel);
    const runtimeNodeHost = getRuntimeNodeModelHost(runtimeNodeModel);
    const runtime = new EventEmitter();
    const vm = new EventEmitter();
    const target = createScratchTarget();
    runtime.targets = [
        {id: 'stage-runtime', isOriginal: true, isStage: true, sprite: {name: 'Stage'}},
        target
    ];
    vm.runtime = runtime;
    const context = {vm};
    const adapter = createScratchSpriteNodeAdapterService(
        context,
        sceneDataModel,
        runtimeNodeHost.publicCapability,
        {
            bindingIdFactory: () => 'scratch-binding:player',
            componentIdFactory: () => 'runtime-component:scratch-binding-player',
            nodeIdFactory: () => 'runtime-node:scratch-player',
            nodeTypeRegistration: runtimeNodeHost.typeRegistrationCapability,
            persistenceController: runtimeNodeHost.persistenceController
        }
    );
    const transformRuntimeStore = createTransform2DRuntimeStoreForModel(
        runtimeNodeHost.publicCapability,
        runtimeNodeHost.typeRegistrationCapability
    );
    const scheduledPhases = new Map();
    const phaseScheduler = {
        flush: () => {
            const tasks = Array.from(scheduledPhases.values());
            scheduledPhases.clear();
            tasks.forEach(task => task());
        },
        schedule: jest.fn((id, callback) => {
            scheduledPhases.set(id, callback);
            return true;
        })
    };
    const projection = createScratchTransformProjectionService(
        context,
        sceneDataModel,
        runtimeNodeHost.publicCapability,
        runtimeNodeHost.typeRegistrationCapability,
        adapter,
        {phaseScheduler, transformRuntimeStore}
    );

    return {
        adapter,
        context,
        getProject: () => clone(project),
        phaseScheduler,
        projection,
        runtime,
        runtimeNodeHost,
        runtimeNodeModel: runtimeNodeHost.publicCapability,
        sceneDataModel,
        target,
        transformRuntimeStore,
        vm
    };
};

const disposeHarness = harness => {
    harness.projection.dispose();
    harness.transformRuntimeStore.dispose();
    harness.adapter.dispose();
    harness.runtimeNodeHost.dispose();
};

describe('0009-C Scratch Compatibility Transform Projection', () => {
    test('maps Scratch position/direction/size into backend-independent Transform2D semantics', () => {
        expect(scratchDirectionToTransformRotation(90)).toBe(0);
        expect(scratchDirectionToTransformRotation(0)).toBe(90);
        expect(scratchDirectionToTransformRotation(-90)).toBe(-180);
        expect(scratchDirectionToTransformRotation(180)).toBe(-90);
        expect(readScratchTargetTransform(createScratchTarget('target-a', {
            direction: 45,
            size: 250,
            x: -30,
            y: 70
        }))).toEqual({
            position: [-30, 70],
            rotation: 45,
            scale: [2.5, 2.5]
        });
    });

    test('bootstraps one Persistent Transform component from current Scratch Authority state', () => {
        const harness = createHarness();
        const result = harness.projection.bootstrapActiveScene({reason: 'test-bootstrap'});
        expect(result).toHaveLength(1);
        const node = harness.runtimeNodeModel.getNodeSnapshot('runtime-node:scratch-player');
        const transform = node.components.find(component => component.typeId === 'ngvge.transform2d');

        expect(transform).toBeTruthy();
        expect(transform.data).toEqual({
            position: [12, -8],
            rotation: 0,
            scale: [1, 1]
        });
        expect(transform.data).not.toHaveProperty('targetRuntimeId');
        expect(transform.data).not.toHaveProperty('drawableId');
        expect(harness.transformRuntimeStore.getRuntimeTransform(node.id)).toEqual(transform.data);
        expect(harness.projection.getStatus().bootstrapCount).toBe(1);
        disposeHarness(harness);
    });

    test('projects high-frequency Scratch motion only into Runtime Transform and leaves project source unchanged', () => {
        const harness = createHarness();
        harness.projection.bootstrapActiveScene();
        const persistentBefore = harness.runtimeNodeModel.exportState();
        const projectBefore = harness.getProject();
        const persistentTransformBefore = harness.transformRuntimeStore.getPersistentTransform('runtime-node:scratch-player');

        for (let index = 0; index < 240; index++) {
            harness.target.x = index * 0.5;
            harness.target.y = -index * 0.25;
            harness.target.direction = ((index + 179) % 360) - 179;
            harness.target.size = 100 + index * 0.1;
            harness.projection.projectActiveScene({reason: 'high-frequency-test'});
        }

        expect(harness.getProject()).toEqual(projectBefore);
        expect(harness.runtimeNodeModel.exportState()).toEqual(persistentBefore);
        expect(harness.transformRuntimeStore.getPersistentTransform('runtime-node:scratch-player'))
            .toEqual(persistentTransformBefore);
        expect(harness.transformRuntimeStore.getRuntimeTransform('runtime-node:scratch-player')).toEqual(
            readScratchTargetTransform(harness.target)
        );
        expect(harness.transformRuntimeStore.isRuntimeDivergedFromPersistent('runtime-node:scratch-player')).toBe(true);
        disposeHarness(harness);
    });

    test('supports an explicit authority snapshot commit without turning runtime projection into per-frame persistence', () => {
        const harness = createHarness();
        harness.projection.bootstrapActiveScene();
        const projectAfterBootstrap = harness.getProject();
        harness.target.x = 222;
        harness.target.y = -111;
        harness.target.direction = 0;
        harness.target.size = 75;
        harness.projection.projectActiveScene({reason: 'before-explicit-commit'});

        expect(harness.getProject()).toEqual(projectAfterBootstrap);
        const committed = harness.projection.commitActiveSceneToPersistent({reason: 'explicit-save-boundary'});
        expect(committed).toHaveLength(1);
        expect(committed[0].transform).toEqual({
            position: [222, -111],
            rotation: 90,
            scale: [0.75, 0.75]
        });
        expect(harness.transformRuntimeStore.getPersistentTransform('runtime-node:scratch-player'))
            .toEqual(committed[0].transform);
        expect(harness.getProject()).not.toEqual(projectAfterBootstrap);
        expect(JSON.stringify(harness.getProject())).not.toContain('target-runtime-a');
        disposeHarness(harness);
    });

    test('coalesces Scratch target updates outside AFTER_EXECUTE and projects only at the scheduled phase boundary', () => {
        const harness = createHarness();
        harness.projection.start();
        const projectAfterStart = harness.getProject();
        const before = harness.transformRuntimeStore.getRuntimeTransform('runtime-node:scratch-player');
        harness.target.x = 48;
        harness.target.y = 96;
        harness.target.direction = -90;
        harness.target.size = 120;

        harness.runtime.emit('AFTER_EXECUTE');
        expect(harness.phaseScheduler.schedule).not.toHaveBeenCalled();
        expect(harness.transformRuntimeStore.getRuntimeTransform('runtime-node:scratch-player')).toEqual(before);

        harness.runtime.emit('TARGETS_UPDATE');
        harness.vm.emit('targetsUpdate');
        expect(harness.phaseScheduler.schedule).toHaveBeenCalledTimes(2);
        expect(harness.projection.getStatus()).toMatchObject({
            coalescedProjectionSignalCount: 1,
            projectionPending: true,
            scheduledProjectionCount: 1
        });
        expect(harness.transformRuntimeStore.getRuntimeTransform('runtime-node:scratch-player')).toEqual(before);

        harness.phaseScheduler.flush();
        expect(harness.transformRuntimeStore.getRuntimeTransform('runtime-node:scratch-player')).toEqual({
            position: [48, 96],
            rotation: -180,
            scale: [1.2, 1.2]
        });
        expect(harness.getProject()).toEqual(projectAfterStart);
        expect(harness.projection.getStatus()).toMatchObject({projectionPending: false, tracking: true});
        disposeHarness(harness);
    });

    test('uses transform shadow state to avoid runtime mutation when a target-update signal carries no transform change', () => {
        const harness = createHarness();
        harness.projection.start();
        harness.runtime.emit('TARGETS_UPDATE');
        harness.phaseScheduler.flush();
        const status = harness.projection.getStatus();
        expect(status.shadowSkipCount).toBeGreaterThanOrEqual(1);
        expect(status.projectionCount).toBe(0);
        disposeHarness(harness);
    });

    test('keeps semantic NodeId stable when the Scratch target runtime identity is recreated', () => {
        const harness = createHarness();
        harness.projection.bootstrapActiveScene();
        const firstComponent = harness.runtimeNodeModel.getNodeSnapshot('runtime-node:scratch-player')
            .components.find(component => component.typeId === 'ngvge.transform2d');

        const replacement = createScratchTarget('target-runtime-b', {
            direction: 180,
            size: 80,
            x: -75,
            y: 33
        });
        harness.runtime.targets = [
            {id: 'stage-runtime', isOriginal: true, isStage: true, sprite: {name: 'Stage'}},
            replacement
        ];
        harness.adapter.reconcileActiveScene({reason: 'target-recreated', preserveMissing: true});
        harness.projection.bootstrapActiveScene({reason: 'target-recreated'});

        const binding = harness.adapter.getBindingByTargetRuntimeId('target-runtime-b');
        const secondComponent = harness.runtimeNodeModel.getNodeSnapshot('runtime-node:scratch-player')
            .components.find(component => component.typeId === 'ngvge.transform2d');
        expect(binding.nodeId).toBe('runtime-node:scratch-player');
        expect(secondComponent.id).toBe(firstComponent.id);
        expect(harness.transformRuntimeStore.getRuntimeTransform(binding.nodeId)).toEqual({
            position: [-75, 33],
            rotation: -90,
            scale: [0.8, 0.8]
        });
        disposeHarness(harness);
    });

    test('fails closed on non-finite Scratch transform fields without polluting Transform data', () => {
        const harness = createHarness();
        harness.projection.bootstrapActiveScene();
        const runtimeBefore = harness.transformRuntimeStore.getRuntimeTransform('runtime-node:scratch-player');
        harness.target.x = Number.NaN;
        expect(harness.projection.projectActiveScene({reason: 'invalid-target'})).toEqual([]);
        expect(harness.transformRuntimeStore.getRuntimeTransform('runtime-node:scratch-player')).toEqual(runtimeBefore);
        expect(harness.projection.getStatus()).toMatchObject({
            errorCount: 1,
            lastReason: 'invalid-target'
        });
        disposeHarness(harness);
    });

    test('projects through Module Service Facade array-like runtime.targets without native Array identity', () => {
        const harness = createHarness();
        const nativeTargets = harness.runtime.targets;
        const facadeTargets = {length: nativeTargets.length};
        nativeTargets.forEach((target, index) => {
            facadeTargets[index] = target;
        });
        expect(Array.isArray(facadeTargets)).toBe(false);

        const facadeRuntime = new EventEmitter();
        facadeRuntime.targets = facadeTargets;
        const facadeVM = new EventEmitter();
        facadeVM.runtime = facadeRuntime;
        harness.context.getService = serviceId => serviceId === 'vm' ? facadeVM : null;
        delete harness.context.vm;

        harness.adapter.reconcileActiveScene({reason: 'service-facade-array-like'});
        const result = harness.projection.bootstrapActiveScene({reason: 'service-facade-array-like'});
        expect(result).toHaveLength(1);
        expect(harness.transformRuntimeStore.getRuntimeTransform('runtime-node:scratch-player')).toEqual({
            position: [12, -8],
            rotation: 0,
            scale: [1, 1]
        });
        disposeHarness(harness);
    });

    test('does not encode Scratch render style or renderer-private state into semantic Transform2D', () => {
        const transform = readScratchTargetTransform(createScratchTarget('target-a', {
            direction: -45,
            drawableID: 77,
            renderer: {_allDrawables: {77: {}}},
            rotationStyle: 'left-right',
            size: 150
        }));
        expect(transform).toEqual({
            position: [12, -8],
            rotation: 135,
            scale: [1.5, 1.5]
        });
        expect(Object.keys(transform).sort()).toEqual(['position', 'rotation', 'scale']);
    });
});
