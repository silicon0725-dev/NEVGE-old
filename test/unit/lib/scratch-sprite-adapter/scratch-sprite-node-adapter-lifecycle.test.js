import {EventEmitter} from 'events';
import {createScratchSpriteNodeAdapterService} from '../../../../src/lib/scratch-sprite-adapter';
import {
    createRuntimeNodeModelService,
    getRuntimeNodeModelHost
} from '../../../../src/lib/runtime-nodes';

const clone = value => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(resolve => setTimeout(resolve, 10));

const createTarget = (id, name, options = {}) => ({
    id,
    isOriginal: options.isOriginal !== false,
    isStage: Boolean(options.isStage),
    sprite: {name}
});

const createHarness = () => {
    let project = {
        activeSceneId: 'scene-a',
        extensionData: {},
        scenes: [{id: 'scene-a', name: 'Scene A'}, {id: 'scene-b', name: 'Scene B'}]
    };
    const listeners = new Set();
    const sceneDataModel = {
        getStatus: () => ({}),
        readProject: () => clone(project),
        subscribe: listener => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        writeProject: nextProject => {
            project = clone(nextProject);
            listeners.forEach(listener => listener({type: 'data'}));
        }
    };
    const runtime = new EventEmitter();
    runtime.targets = [
        createTarget('stage', 'Stage', {isStage: true}),
        createTarget('target-a', 'Player')
    ];
    const vm = new EventEmitter();
    vm.runtime = runtime;
    vm.deleteSprite = jest.fn(targetId => {
        runtime.targets = runtime.targets.filter(target => target.id !== targetId);
        vm.emit('targetsUpdate');
        return true;
    });
    const runtimeNodeModel = createRuntimeNodeModelService(sceneDataModel);
    const runtimeNodeHost = getRuntimeNodeModelHost(runtimeNodeModel);
    const sceneRuntimeListeners = new Set();
    const sceneRuntime = {
        subscribe: listener => {
            sceneRuntimeListeners.add(listener);
            return () => sceneRuntimeListeners.delete(listener);
        }
    };
    let sequence = 0;
    const adapter = createScratchSpriteNodeAdapterService(
        {vm},
        sceneDataModel,
        runtimeNodeHost.publicCapability,
        {
            nodeTypeRegistration: runtimeNodeHost.typeRegistrationCapability,
            persistenceController: runtimeNodeHost.persistenceController,
            bindingIdFactory: () => `binding-${++sequence}`,
            sceneRuntime,
            componentIdFactory: () => `component-${sequence}`,
            nodeIdFactory: () => `node-${sequence}`
        }
    );
    return {
        adapter,
        emitSceneRuntime: change => sceneRuntimeListeners.forEach(listener => listener(change)),
        getProject: () => clone(project),
        runtime,
        runtimeNodeHost,
        runtimeNodeModel,
        vm,
        setActiveScene: sceneId => {
            project.activeSceneId = sceneId;
            sceneDataModel.writeProject(project);
        }
    };
};

describe('Scratch Sprite Node Adapter target lifecycle reconciliation', () => {
    test('automatically creates and permanently removes bindings from TARGETS_UPDATE', async () => {
        const harness = createHarness();
        await flush();
        harness.runtime.targets.push(createTarget('target-b', 'Enemy'));
        harness.runtime.emit('TARGETS_UPDATE');
        await flush();
        expect(harness.adapter.listBindings('scene-a')).toHaveLength(2);

        harness.runtime.targets = harness.runtime.targets.filter(target => target.id !== 'target-b');
        harness.runtime.emit('TARGETS_UPDATE');
        await flush();
        expect(harness.adapter.listBindings('scene-a')).toHaveLength(1);
        expect(harness.getProject().extensionData.scratchSpriteBindings.scenes['scene-a'].items).toHaveLength(1);
        harness.adapter.dispose();
        harness.runtimeNodeModel.dispose();
    });


    test('reconciles deletion from the public VM targetsUpdate event', async () => {
        const harness = createHarness();
        await flush();
        const binding = harness.adapter.listBindings('scene-a')[0];

        harness.runtime.targets = harness.runtime.targets.filter(target => target.id !== 'target-a');
        harness.vm.emit('targetsUpdate');
        await flush();

        expect(harness.adapter.listBindings('scene-a')).toHaveLength(0);
        expect(harness.runtimeNodeModel.getNode(binding.nodeId)).toBeNull();
        harness.adapter.dispose();
        harness.runtimeNodeModel.dispose();
    });

    test('rebinds recreated targets without changing stable identity', async () => {
        const harness = createHarness();
        await flush();
        const before = harness.adapter.listBindings('scene-a')[0];
        harness.runtime.targets = [
            createTarget('stage', 'Stage', {isStage: true}),
            createTarget('target-a-recreated', 'Player')
        ];
        harness.runtime.emit('PROJECT_LOADED');
        await flush();
        const after = harness.adapter.listBindings('scene-a')[0];
        expect(after).toMatchObject({
            bindingId: before.bindingId,
            nodeId: before.nodeId,
            status: 'bound',
            targetRuntimeId: 'target-a-recreated'
        });
        harness.adapter.dispose();
        harness.runtimeNodeModel.dispose();
    });

    test('deleting the semantic Sprite owner removes Target, Sidecar and Runtime subtree', async () => {
        const harness = createHarness();
        await flush();
        const binding = harness.adapter.listBindings('scene-a')[0];
        const child = harness.runtimeNodeModel.createNode('ngvge.node2d', {
            name: 'Attached Child',
            parentId: binding.nodeId,
            sceneId: 'scene-a'
        });

        await harness.adapter.destroyBindingByNodeId(binding.nodeId, {reason: 'test-owner-delete'});
        await flush();

        expect(harness.vm.deleteSprite).toHaveBeenCalledWith('target-a');
        expect(harness.adapter.listBindings('scene-a')).toHaveLength(0);
        expect(harness.runtimeNodeModel.getNode(binding.nodeId)).toBeNull();
        expect(harness.runtimeNodeModel.getNode(child.id)).toBeNull();
        expect(harness.getProject().extensionData.scratchSpriteBindings.scenes['scene-a'].items).toEqual([]);
        harness.adapter.dispose();
        harness.runtimeNodeModel.dispose();
    });

    test('direct Runtime Node deletion is intercepted by adapter ownership cleanup', async () => {
        const harness = createHarness();
        await flush();
        const binding = harness.adapter.listBindings('scene-a')[0];

        harness.runtimeNodeModel.destroyNode(binding.nodeId);
        await flush();

        expect(harness.vm.deleteSprite).toHaveBeenCalledWith('target-a');
        expect(harness.adapter.listBindings('scene-a')).toHaveLength(0);
        expect(harness.runtime.targets.some(target => target.id === 'target-a')).toBe(false);
        expect(harness.getProject().extensionData.scratchSpriteBindings.scenes['scene-a'].items).toEqual([]);
        harness.adapter.dispose();
        harness.runtimeNodeModel.dispose();
    });

    test('defers VM target events during scene restore and preserves inactive scene bindings', async () => {
        const harness = createHarness();
        await flush();
        const sceneABinding = harness.adapter.listBindings('scene-a')[0];

        harness.emitSceneRuntime({fromSceneId: 'scene-a', sceneId: 'scene-b', type: 'before-load'});
        harness.runtime.targets = [
            createTarget('stage-b', 'Stage', {isStage: true}),
            createTarget('target-b', 'NPC')
        ];
        harness.vm.emit('targetsUpdate');
        harness.runtime.emit('PROJECT_LOADED');
        await flush();

        expect(harness.adapter.listBindings('scene-a')[0]).toMatchObject({
            bindingId: sceneABinding.bindingId,
            nodeId: sceneABinding.nodeId,
            status: 'offline',
            targetRuntimeId: null
        });
        expect(harness.adapter.listBindings('scene-b')).toHaveLength(0);

        harness.setActiveScene('scene-b');
        harness.emitSceneRuntime({fromSceneId: 'scene-a', sceneId: 'scene-b', type: 'loaded'});
        await flush();
        const firstSceneBBinding = harness.adapter.listBindings('scene-b')[0];
        expect(firstSceneBBinding).toMatchObject({status: 'bound', targetRuntimeId: 'target-b'});

        harness.runtime.targets.push(createTarget('target-b-2', 'NPC 2'));
        harness.vm.emit('targetsUpdate');
        await flush();
        const sceneBNodeIds = harness.adapter.listBindings('scene-b').map(binding => binding.nodeId);
        expect(sceneBNodeIds).toHaveLength(2);

        harness.emitSceneRuntime({fromSceneId: 'scene-b', sceneId: 'scene-a', type: 'before-load'});
        harness.runtime.targets = [
            createTarget('stage-a-recreated', 'Stage', {isStage: true}),
            createTarget('target-a-recreated', 'Player')
        ];
        harness.vm.emit('targetsUpdate');
        harness.setActiveScene('scene-a');
        harness.emitSceneRuntime({fromSceneId: 'scene-b', sceneId: 'scene-a', type: 'loaded'});
        await flush();

        expect(harness.adapter.listBindings('scene-b')).toHaveLength(2);
        expect(harness.adapter.listBindings('scene-b').every(binding => binding.status === 'offline')).toBe(true);
        sceneBNodeIds.forEach(nodeId => expect(harness.runtimeNodeModel.getNode(nodeId)).not.toBeNull());
        harness.adapter.dispose();
        harness.runtimeNodeModel.dispose();
    });

    test('marks the previous scene offline when the active scene changes', async () => {
        const harness = createHarness();
        await flush();
        harness.runtime.targets = [
            createTarget('stage', 'Stage', {isStage: true}),
            createTarget('target-b', 'NPC')
        ];
        harness.setActiveScene('scene-b');
        await flush();
        expect(harness.adapter.listBindings('scene-a')[0].status).toBe('offline');
        expect(harness.adapter.listBindings('scene-b')[0].status).toBe('bound');
        harness.adapter.dispose();
        harness.runtimeNodeModel.dispose();
    });

    test('stops listening after dispose', async () => {
        const harness = createHarness();
        await flush();
        harness.adapter.dispose();
        harness.runtime.targets.push(createTarget('target-b', 'Enemy'));
        harness.runtime.emit('TARGETS_UPDATE');
        await flush();
        expect(harness.runtimeNodeModel.listNodes({includeRoots: false})).toHaveLength(1);
        harness.runtimeNodeModel.dispose();
    });
});
