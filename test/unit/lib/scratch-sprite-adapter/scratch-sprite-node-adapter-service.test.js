import {
    SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY,
    LEGACY_SCRATCH_SPRITE_NODE_TYPE_ID,
    SPRITE_NODE_TYPE_ID,
    SCRATCH_TARGET_BINDING_COMPONENT_TYPE_ID,
    createScratchSpriteNodeAdapterService
} from '../../../../src/lib/scratch-sprite-adapter';
import {
    createRuntimeNodeModelService,
    getRuntimeNodeModelHost
} from '../../../../src/lib/runtime-nodes';

const clone = value => JSON.parse(JSON.stringify(value));

const createHarness = (targetFactory, initialProject = null) => {
    let project = initialProject ? clone(initialProject) : {
        activeSceneId: 'scene-a',
        extensionData: {},
        scenes: [{id: 'scene-a', name: 'Scene A'}]
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
    const runtimeNodeModel = createRuntimeNodeModelService(sceneDataModel);
    const runtimeNodeHost = getRuntimeNodeModelHost(runtimeNodeModel);
    const context = {
        vm: {
            runtime: {
                targets: targetFactory()
            }
        }
    };
    return {
        context,
        getProject: () => clone(project),
        runtimeNodeHost,
        runtimeNodeModel,
        sceneDataModel
    };
};

const createTargets = runtimeId => [
    {id: 'stage-runtime', isOriginal: true, isStage: true, sprite: {name: 'Stage'}},
    {id: runtimeId, isOriginal: true, isStage: false, sprite: {name: 'Player'}},
    {id: 'clone-runtime', isOriginal: false, isStage: false, sprite: {name: 'Player'}}
];

const createAdapter = (harness, options = {}) => createScratchSpriteNodeAdapterService(
    harness.context,
    harness.sceneDataModel,
    harness.runtimeNodeHost.publicCapability,
    Object.assign({
        nodeTypeRegistration: harness.runtimeNodeHost.typeRegistrationCapability,
        persistenceController: harness.runtimeNodeHost.persistenceController
    }, options)
);

describe('Scratch Sprite Node Adapter stable binding identity', () => {
    test('creates one persistent binding for each original sprite and excludes Stage and clones', () => {
        const harness = createHarness(() => createTargets('target-runtime-a'));
        const adapter = createAdapter(harness, {
                bindingIdFactory: () => 'scratch-binding:player',
                componentIdFactory: () => 'runtime-component:binding-player',
                nodeIdFactory: () => 'runtime-node:scratch-player'
            });

        expect(adapter.listBindings()).toHaveLength(1);
        expect(adapter.getBindingByTargetRuntimeId('target-runtime-a')).toMatchObject({
            bindingId: 'scratch-binding:player',
            nodeId: 'runtime-node:scratch-player',
            serializedTargetIndex: 1,
            status: 'bound'
        });
        expect(adapter.getBindingByTargetRuntimeId('stage-runtime')).toBeNull();
        expect(adapter.getBindingByTargetRuntimeId('clone-runtime')).toBeNull();

        const node = harness.runtimeNodeModel.getNode('runtime-node:scratch-player');
        expect(node).toMatchObject({
            sceneId: 'scene-a',
            typeId: SPRITE_NODE_TYPE_ID
        });
        expect(node.source).toEqual({
            adapterType: 'scratch.sprite',
            bindingId: 'scratch-binding:player',
            kind: 'compatibility-adapter',
            sceneId: 'scene-a'
        });
        expect(node.components[0]).toMatchObject({
            typeId: SCRATCH_TARGET_BINDING_COMPONENT_TYPE_ID,
            data: {
                adapterType: 'scratch.sprite',
                bindingId: 'scratch-binding:player',
                destroyPolicy: 'delete-target',
                schemaVersion: 2,
                serializedTargetIndex: 1
            }
        });
        expect(node.components[0].data).not.toHaveProperty('lifecycle');
        expect(node.components[0].data).not.toHaveProperty('targetRuntimeId');
    });

    test('discovers Scratch targets exposed as module-service array-like facades', () => {
        const harness = createHarness(() => createTargets('target-runtime-facade'));
        const rawTargets = harness.context.vm.runtime.targets;
        const facadeTargets = Object.create(null);
        Object.defineProperty(facadeTargets, 'length', {
            configurable: true,
            enumerable: false,
            value: rawTargets.length
        });
        rawTargets.forEach((target, index) => {
            Object.defineProperty(facadeTargets, index, {
                configurable: true,
                enumerable: true,
                value: target
            });
        });
        expect(Array.isArray(facadeTargets)).toBe(false);
        harness.context.getService = serviceId => serviceId === 'vm' ? {
            runtime: {targets: facadeTargets}
        } : null;

        const adapter = createAdapter(harness, {
            bindingIdFactory: () => 'scratch-binding:facade-player',
            componentIdFactory: () => 'runtime-component:facade-player',
            nodeIdFactory: () => 'runtime-node:scratch-facade-player'
        });

        expect(adapter.listBindings()).toHaveLength(1);
        expect(adapter.getBindingByTargetRuntimeId('target-runtime-facade')).toMatchObject({
            bindingId: 'scratch-binding:facade-player',
            nodeId: 'runtime-node:scratch-facade-player',
            serializedTargetIndex: 1,
            status: 'bound'
        });
    });

    test('keeps bindingId and runtime node id stable when Scratch recreates the target runtime id', () => {
        const harness = createHarness(() => createTargets('target-runtime-a'));
        const first = createAdapter(harness, {
                bindingIdFactory: () => 'scratch-binding:stable',
                componentIdFactory: () => 'runtime-component:stable',
                nodeIdFactory: () => 'runtime-node:scratch-stable'
            });
        const firstBinding = first.listBindings()[0];
        first.dispose();

        harness.context.vm.runtime.targets = createTargets('target-runtime-b');
        const second = createAdapter(harness, {
                bindingIdFactory: () => 'scratch-binding:must-not-be-used',
                componentIdFactory: () => 'runtime-component:must-not-be-used',
                nodeIdFactory: () => 'runtime-node:must-not-be-used'
            });
        const secondBinding = second.getBindingByTargetRuntimeId('target-runtime-b');

        expect(secondBinding).toMatchObject({
            bindingId: firstBinding.bindingId,
            nodeId: firstBinding.nodeId,
            targetRuntimeId: 'target-runtime-b'
        });
        expect(second.getBindingByTargetRuntimeId('target-runtime-a')).toBeNull();
        expect(harness.runtimeNodeModel.listNodes({includeRoots: false})).toHaveLength(1);
    });

    test('hydrates inactive scene bindings and runtime nodes from the project sidecar', () => {
        const initialProject = {
            activeSceneId: 'scene-a',
            extensionData: {
                [SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY]: {
                    scenes: {
                        'scene-b': {
                            items: [{
                                bindingId: 'binding-scene-b',
                                lastKnownName: 'Offline NPC',
                                nodeId: 'node-scene-b',
                                role: 'sprite',
                                serializedTargetIndex: 1
                            }]
                        }
                    },
                    schemaVersion: 1
                }
            },
            scenes: [{id: 'scene-a', name: 'Scene A'}, {id: 'scene-b', name: 'Scene B'}]
        };
        const harness = createHarness(() => createTargets('target-runtime-a'), initialProject);
        const adapter = createAdapter(harness, {
                bindingIdFactory: () => 'binding-scene-a',
                componentIdFactory: () => 'component-scene-a',
                nodeIdFactory: () => 'node-scene-a'
            });

        expect(adapter.listBindings('scene-b')).toEqual([expect.objectContaining({
            bindingId: 'binding-scene-b',
            nodeId: 'node-scene-b',
            sceneId: 'scene-b',
            status: 'offline',
            targetRuntimeId: null
        })]);
        expect(harness.runtimeNodeModel.getNode('node-scene-b')).toMatchObject({
            name: 'Offline NPC',
            sceneId: 'scene-b',
            typeId: SPRITE_NODE_TYPE_ID
        });
        expect(harness.getProject().extensionData[SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY].schemaVersion).toBe(2);
    });

    test('migrates the legacy Scratch node type without changing NodeId or BindingId', () => {
        const initialProject = {
            activeSceneId: 'scene-a',
            extensionData: {
                runtimeNodeModel: {
                    activeSceneId: 'scene-a',
                    nodes: [{
                        components: [{
                            data: {
                                bindingId: 'legacy-binding',
                                lastKnownName: 'Player',
                                role: 'sprite',
                                sceneId: 'scene-a',
                                schemaVersion: 1,
                                serializedTargetIndex: 1
                            },
                            enabled: true,
                            id: 'legacy-component',
                            typeId: SCRATCH_TARGET_BINDING_COMPONENT_TYPE_ID
                        }],
                        enabled: true,
                        id: 'legacy-node',
                        metadata: {adapterManaged: true},
                        name: 'Player',
                        parentId: 'runtime-node:scene-root:scene-a',
                        sceneId: 'scene-a',
                        scope: 'scene',
                        source: {
                            bindingId: 'legacy-binding',
                            kind: 'scratch-target',
                            role: 'sprite',
                            sceneId: 'scene-a'
                        },
                        typeId: LEGACY_SCRATCH_SPRITE_NODE_TYPE_ID
                    }],
                    scenes: [{id: 'scene-a', name: 'Scene A'}],
                    version: 1
                },
                [SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY]: {
                    scenes: {
                        'scene-a': {
                            items: [{
                                bindingId: 'legacy-binding',
                                lastKnownName: 'Player',
                                nodeId: 'legacy-node',
                                role: 'sprite',
                                serializedTargetIndex: 1
                            }]
                        }
                    },
                    schemaVersion: 1
                }
            },
            scenes: [{id: 'scene-a', name: 'Scene A'}]
        };
        const harness = createHarness(() => createTargets('target-runtime-a'), initialProject);
        const adapter = createAdapter(harness);

        expect(adapter.listBindings()[0]).toMatchObject({
            bindingId: 'legacy-binding',
            destroyPolicy: 'delete-target',
            nodeId: 'legacy-node',
            targetRuntimeId: 'target-runtime-a'
        });
        expect(harness.runtimeNodeModel.getNode('legacy-node')).toMatchObject({
            id: 'legacy-node',
            typeId: SPRITE_NODE_TYPE_ID
        });
        expect(harness.runtimeNodeModel.getNode('legacy-node').source).toEqual({
            adapterType: 'scratch.sprite',
            bindingId: 'legacy-binding',
            kind: 'compatibility-adapter',
            sceneId: 'scene-a'
        });
    });

    test('returns frozen binding views without exposing the mutable Scratch target', () => {
        const harness = createHarness(() => createTargets('target-runtime-a'));
        const adapter = createAdapter(harness);
        const binding = adapter.listBindings()[0];

        expect(Object.isFrozen(binding)).toBe(true);
        expect(binding).not.toHaveProperty('target');
        expect(binding).not.toHaveProperty('scratchTarget');
    });

    test('does not persist volatile target runtime ids in project extension data', () => {
        const harness = createHarness(() => createTargets('target-runtime-a'));
        createAdapter(harness, {
                bindingIdFactory: () => 'scratch-binding:persistent',
                componentIdFactory: () => 'runtime-component:persistent',
                nodeIdFactory: () => 'runtime-node:scratch-persistent'
            });

        const store = harness.getProject().extensionData[SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY];
        expect(store.schemaVersion).toBe(2);
        expect(store.scenes['scene-a'].items).toEqual([{
            bindingId: 'scratch-binding:persistent',
            destroyPolicy: 'delete-target',
            lastKnownName: 'Player',
            nodeId: 'runtime-node:scratch-persistent',
            role: 'sprite',
            serializedTargetIndex: 1
        }]);
        expect(JSON.stringify(store)).not.toContain('target-runtime-a');
    });



    test('keeps a future binding schema intact and exposes an error state', () => {
        const futureProject = {
            activeSceneId: 'scene-a',
            extensionData: {
                [SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY]: {
                    futureField: true,
                    scenes: {},
                    schemaVersion: 99
                }
            },
            scenes: [{id: 'scene-a', name: 'Scene A'}]
        };
        const harness = createHarness(() => createTargets('target-runtime-a'), futureProject);
        const adapter = createAdapter(harness);

        expect(adapter.getStatus().error).toMatch(/newer than supported/i);
        expect(harness.getProject().extensionData[SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY]).toEqual({
            futureField: true,
            scenes: {},
            schemaVersion: 99
        });
        expect(adapter.listBindings()).toHaveLength(0);
    });

    test('keeps the legacy Scratch node constructor protected during migration', () => {
        const harness = createHarness(() => []);
        const adapter = createAdapter(harness);

        expect(() => harness.runtimeNodeModel.createNode(LEGACY_SCRATCH_SPRITE_NODE_TYPE_ID, {
            name: 'Invalid Sprite Node',
            sceneId: 'scene-a'
        })).toThrow(/stable binding/i);
        expect(adapter.listBindings()).toHaveLength(0);
    });

    test('reconciles Legacy Sprite reorder into relative top-level bound Sprite Node order', () => {
        const harness = createHarness(() => [
            {id: 'stage-runtime', isOriginal: true, isStage: true, sprite: {name: 'Stage'}},
            {id: 'target-a', isOriginal: true, isStage: false, sprite: {name: 'A'}},
            {id: 'target-b', isOriginal: true, isStage: false, sprite: {name: 'B'}}
        ]);
        const adapter = createAdapter(harness);
        const bindingA = adapter.getBindingByTargetRuntimeId('target-a');
        const bindingB = adapter.getBindingByTargetRuntimeId('target-b');
        const root = harness.runtimeNodeModel.getSceneRoot('scene-a');

        expect(harness.runtimeNodeModel.getChildren(root.id).map(node => node.id)).toEqual([
            bindingA.nodeId,
            bindingB.nodeId
        ]);

        const targets = harness.context.vm.runtime.targets;
        const [moved] = targets.splice(2, 1);
        targets.splice(1, 0, moved);
        adapter.reconcileActiveScene({reason: 'targets-update'});

        expect(harness.runtimeNodeModel.getChildren(root.id).map(node => node.id)).toEqual([
            bindingB.nodeId,
            bindingA.nodeId
        ]);
        expect(adapter.getBindingByTargetRuntimeId('target-b').serializedTargetIndex).toBe(1);
        expect(adapter.getBindingByTargetRuntimeId('target-a').serializedTargetIndex).toBe(2);
    });

    test('is idempotent when stable identity establishment runs repeatedly', () => {
        const harness = createHarness(() => createTargets('target-runtime-a'));
        let bindingFactoryCalls = 0;
        const adapter = createAdapter(harness, {
                bindingIdFactory: () => `scratch-binding:${++bindingFactoryCalls}`,
                componentIdFactory: () => 'runtime-component:idempotent',
                nodeIdFactory: () => 'runtime-node:scratch-idempotent'
            });
        const first = adapter.listBindings()[0];
        adapter.establishBindings();
        const second = adapter.listBindings()[0];

        expect(second).toMatchObject({
            bindingId: first.bindingId,
            nodeId: first.nodeId
        });
        expect(bindingFactoryCalls).toBe(1);
        expect(harness.runtimeNodeModel.listNodes({includeRoots: false})).toHaveLength(1);
    });

    test('prunes sidecar entries after their owning scene is deleted', () => {
        const initialProject = {
            activeSceneId: 'scene-a',
            extensionData: {
                [SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY]: {
                    scenes: {
                        'scene-b': {
                            items: [{
                                bindingId: 'binding-scene-b',
                                destroyPolicy: 'detach-target',
                                lastKnownName: 'Offline NPC',
                                nodeId: 'node-scene-b',
                                role: 'sprite',
                                serializedTargetIndex: 1
                            }]
                        }
                    },
                    schemaVersion: 2
                }
            },
            scenes: [{id: 'scene-a', name: 'Scene A'}, {id: 'scene-b', name: 'Scene B'}]
        };
        const harness = createHarness(() => createTargets('target-runtime-a'), initialProject);
        const adapter = createAdapter(harness);
        const project = harness.getProject();
        project.scenes = project.scenes.filter(scene => scene.id !== 'scene-b');
        harness.sceneDataModel.writeProject(project);

        const stored = harness.getProject().extensionData[SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY];
        expect(stored.scenes['scene-b']).toBeUndefined();
        expect(adapter.validatePersistentBindings()).toMatchObject({valid: true});
    });

});
