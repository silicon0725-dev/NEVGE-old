import {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    RUNTIME_NODE_MODEL_CAPABILITY_ID,
    SCENE_DATA_MODEL_CAPABILITY_ID,
    SCENE_SYSTEM_MODULE_ID
} from '../../../../src/lib/scene-system';
import {
    createModuleManager,
    registerBuiltInModules
} from '../../../../src/lib/first-party-modules';
import {
    NODE_SCOPES,
    RuntimeNode,
    createRuntimeNodeModelService,
    createRuntimeNodeTypeRegistry
} from '../../../../src/lib/runtime-nodes';

describe('Runtime node model first-party capability', () => {
    const createEnabledManager = () => {
        const manager = createModuleManager();
        registerBuiltInModules(manager);
        manager.initializeAll();
        manager.enableDefaults({silent: true});
        manager.enableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});
        return manager;
    };

    test('creates a global root and one scene root for every scene record', () => {
        const manager = createEnabledManager();
        const sceneData = manager.getCapability(SCENE_DATA_MODEL_CAPABILITY_ID);
        const nodeModel = manager.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID);
        const project = sceneData.readProject();

        expect(nodeModel.capabilityId).toBe(RUNTIME_NODE_MODEL_CAPABILITY_ID);
        expect(nodeModel.getGlobalRoot().scope).toBe('global');
        expect(nodeModel.getSceneRoot(project.activeSceneId).activeInHierarchy).toBe(true);
        expect(nodeModel.getStatus()).toMatchObject({sceneCount: 1, version: 1});
    });

    test('synchronizes scene roots when the scene data model changes', () => {
        const manager = createEnabledManager();
        const sceneData = manager.getCapability(SCENE_DATA_MODEL_CAPABILITY_ID);
        const nodeModel = manager.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID);
        const project = sceneData.readProject();
        const secondScene = sceneData.createScene({id: 'scene-two', name: 'Scene Two'});
        project.scenes.push(secondScene);
        project.activeSceneId = secondScene.id;
        sceneData.writeProject(project);

        expect(nodeModel.getSceneRoot(secondScene.id).name).toBe('Scene Two');
        expect(nodeModel.getSceneRoot(secondScene.id).activeInHierarchy).toBe(true);

        const nodeResult = nodeModel.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            sceneId: secondScene.id
        });
        expect(nodeResult).toMatchObject({applied: true, persisted: true});
        expect(nodeResult.snapshot.sceneId).toBe(secondScene.id);
    });

    test('does not recursively resynchronize when scene data is only read', () => {
        const manager = createEnabledManager();
        const sceneData = manager.getCapability(SCENE_DATA_MODEL_CAPABILITY_ID);
        const nodeModel = manager.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID);
        const before = nodeModel.getStatus().revision;

        for (let index = 0; index < 10; index++) sceneData.readProject();

        expect(nodeModel.getStatus().revision).toBe(before);
    });

    test('revokes and disposes the runtime node capability when Scene System is disabled', () => {
        const manager = createEnabledManager();
        const nodeModel = manager.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID);

        manager.disableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});

        expect(manager.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID)).toBeNull();
        expect(() => nodeModel.getStatus()).toThrow(/disposed/i);
    });
    test('persists native runtime nodes in Scene System extension data', () => {
        const manager = createEnabledManager();
        const sceneData = manager.getCapability(SCENE_DATA_MODEL_CAPABILITY_ID);
        const nodeModel = manager.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID);
        const project = sceneData.readProject();
        const serviceNodeResult = nodeModel.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.SERVICE_NODE, {
            name: 'GameManager',
            scope: 'global'
        });
        const sceneNodeResult = nodeModel.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            name: 'Gameplay',
            sceneId: project.activeSceneId
        });
        const serviceNode = serviceNodeResult.snapshot;
        const sceneNode = sceneNodeResult.snapshot;
        expect(serviceNodeResult).toMatchObject({applied: true, persisted: true});
        expect(sceneNodeResult).toMatchObject({applied: true, persisted: true});

        const stored = sceneData.readProject();
        expect(stored.extensionData.runtimeNodeModel.nodes.map(node => node.id)).toEqual(
            expect.arrayContaining([serviceNode.id, sceneNode.id])
        );

        manager.disableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});
        manager.enableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});
        const restored = manager.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID);
        expect(restored.getNode(serviceNode.id).name).toBe('GameManager');
        expect(restored.getNode(sceneNode.id).sceneId).toBe(project.activeSceneId);
    });

    test('returns frozen read views and does not expose mutable graph or type registry', () => {
        const manager = createEnabledManager();
        const sceneData = manager.getCapability(SCENE_DATA_MODEL_CAPABILITY_ID);
        const nodeModel = manager.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID);
        const project = sceneData.readProject();
        const createdResult = nodeModel.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            metadata: {tag: 'original'},
            name: 'Original',
            sceneId: project.activeSceneId
        });
        expect(createdResult).toMatchObject({applied: true, persisted: true});
        const created = createdResult.snapshot;
        const view = nodeModel.getNode(created.id);

        expect(nodeModel.graph).toBeUndefined();
        expect(nodeModel.nodeTypes).toBeUndefined();
        expect(Object.isFrozen(view)).toBe(true);
        expect(Object.isFrozen(view.metadata)).toBe(true);
        expect(Object.isFrozen(view.components)).toBe(true);

        try {
            view.name = 'Bypassed';
            view.metadata.tag = 'bypassed';
        } catch (error) {
            // Strict-mode assignment to a frozen read view is expected to throw.
        }

        expect(nodeModel.getNode(created.id)).toMatchObject({
            metadata: {tag: 'original'},
            name: 'Original'
        });
        expect(nodeModel.getNodeType(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE).label).toBe('Node');
    });

    test('persists node and component mutations made through the capability boundary', () => {
        const manager = createEnabledManager();
        const sceneData = manager.getCapability(SCENE_DATA_MODEL_CAPABILITY_ID);
        const nodeModel = manager.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID);
        const project = sceneData.readProject();
        const nodeResult = nodeModel.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            metadata: {kind: 'old'},
            name: 'Logic',
            sceneId: project.activeSceneId
        });
        expect(nodeResult).toMatchObject({applied: true, persisted: true});
        const node = nodeResult.snapshot;
        const componentResult = nodeModel.addComponent(node.id, {
            data: {speed: 1},
            typeId: 'example.logic'
        });
        expect(componentResult).toMatchObject({applied: true, persisted: true});
        const component = componentResult.snapshot;

        nodeModel.patchNode(node.id, {name: 'Player Logic'});
        nodeModel.patchNodeMetadata(node.id, {kind: 'player'});
        nodeModel.patchComponentData(node.id, component.id, {speed: 10});
        nodeModel.setComponentEnabled(node.id, component.id, false);

        const readView = nodeModel.getNode(node.id);
        expect(readView).toMatchObject({
            metadata: {kind: 'player'},
            name: 'Player Logic'
        });
        expect(readView.components[0]).toMatchObject({
            data: {speed: 10},
            enabled: false
        });

        const storedNode = sceneData.readProject().extensionData.runtimeNodeModel.nodes
            .find(record => record.id === node.id);
        expect(storedNode).toMatchObject({
            metadata: {kind: 'player'},
            name: 'Player Logic'
        });
        expect(storedNode.components[0]).toMatchObject({
            data: {speed: 10},
            enabled: false
        });
    });

    test('rolls back a mutation after a persistence write failure', () => {
        let project = {
            activeSceneId: 'scene-a',
            extensionData: {},
            scenes: [{id: 'scene-a', name: 'Scene A'}]
        };
        let failWrites = false;
        const listeners = new Set();
        const sceneDataModel = {
            getStatus: () => ({}),
            readProject: () => JSON.parse(JSON.stringify(project)),
            subscribe: listener => {
                listeners.add(listener);
                return () => listeners.delete(listener);
            },
            writeProject: nextProject => {
                if (failWrites) throw new Error('write failed');
                project = JSON.parse(JSON.stringify(nextProject));
                listeners.forEach(listener => listener({type: 'data'}));
            }
        };
        const nodeModel = createRuntimeNodeModelService(sceneDataModel, {
            idFactory: () => 'runtime-node:test'
        });
        const node = nodeModel.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            sceneId: 'scene-a'
        });

        const beforeName = nodeModel.getNode(node.id).name;
        failWrites = true;
        expect(() => nodeModel.patchNode(node.id, {name: 'Retry Me'})).toThrow(/write failed/i);
        failWrites = false;

        expect(nodeModel.getNode(node.id).name).toBe(beforeName);
        expect(nodeModel.persistState()).toBe(false);
        expect(project.extensionData.runtimeNodeModel.nodes.find(record => record.id === node.id).name)
            .toBe(beforeName);
    });


    test('keeps service subscribers and the current graph when import fails', () => {
        let project = {
            activeSceneId: 'scene-a',
            extensionData: {},
            scenes: [{id: 'scene-a', name: 'Scene A'}]
        };
        const listeners = new Set();
        const sceneDataModel = {
            getStatus: () => ({}),
            readProject: () => JSON.parse(JSON.stringify(project)),
            subscribe: listener => {
                listeners.add(listener);
                return () => listeners.delete(listener);
            },
            writeProject: nextProject => {
                project = JSON.parse(JSON.stringify(nextProject));
                listeners.forEach(listener => listener({type: 'data'}));
            }
        };
        const nodeModel = createRuntimeNodeModelService(sceneDataModel);
        const existing = nodeModel.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'existing',
            sceneId: 'scene-a'
        });
        const changes = [];
        nodeModel.subscribe(change => changes.push(change));

        expect(() => nodeModel.importState({
            activeSceneId: 'scene-a',
            nodes: [
                {
                    components: [],
                    id: 'a',
                    parentId: 'b',
                    sceneId: 'scene-a',
                    scope: NODE_SCOPES.SCENE,
                    typeId: BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE
                },
                {
                    components: [],
                    id: 'b',
                    parentId: 'a',
                    sceneId: 'scene-a',
                    scope: NODE_SCOPES.SCENE,
                    typeId: BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE
                }
            ],
            scenes: [{id: 'scene-a', name: 'Scene A'}],
            version: 1
        })).toThrow(/validation failed/i);
        expect(nodeModel.getNode(existing.id)).toMatchObject({id: existing.id});

        nodeModel.renameNode(existing.id, 'Still Active');
        expect(changes.some(change => change.type === 'node:rename')).toBe(true);
        expect(nodeModel.getImportStatus().errors.length).toBeGreaterThan(0);
    });

    test('reifies opaque nodes when their provider registers later', () => {
        let project = {
            activeSceneId: 'scene-a',
            extensionData: {
                runtimeNodeModel: {
                    activeSceneId: 'scene-a',
                    nodes: [{
                        activeInHierarchy: true,
                        childIds: ['derived-child'],
                        components: [],
                        id: 'plugin-node',
                        name: 'Plugin Node',
                        parentId: 'runtime-node:scene-root:scene-a',
                        sceneId: 'scene-a',
                        scope: NODE_SCOPES.SCENE,
                        state: 'ready',
                        typeId: 'test.plugin-node',
                        vendorPayload: {value: 42}
                    }],
                    scenes: [{id: 'scene-a', name: 'Scene A'}],
                    version: 1
                }
            },
            scenes: [{id: 'scene-a', name: 'Scene A'}]
        };
        const listeners = new Set();
        const sceneDataModel = {
            getStatus: () => ({}),
            readProject: () => JSON.parse(JSON.stringify(project)),
            subscribe: listener => {
                listeners.add(listener);
                return () => listeners.delete(listener);
            },
            writeProject: nextProject => {
                project = JSON.parse(JSON.stringify(nextProject));
                listeners.forEach(listener => listener({type: 'data'}));
            }
        };
        const registry = createRuntimeNodeTypeRegistry();
        const nodeModel = createRuntimeNodeModelService(sceneDataModel, {typeRegistry: registry});

        expect(nodeModel.getNode('plugin-node')).toMatchObject({
            originalTypeId: 'test.plugin-node',
            typeId: BUILTIN_RUNTIME_NODE_TYPE_IDS.UNKNOWN_NODE
        });

        const opaquePersistentRecord = nodeModel.exportState().nodes.find(record => record.id === 'plugin-node');
        expect(opaquePersistentRecord).not.toHaveProperty('activeInHierarchy');
        expect(opaquePersistentRecord).not.toHaveProperty('childIds');
        expect(opaquePersistentRecord).not.toHaveProperty('state');

        class PluginNode extends RuntimeNode {}
        registry.register({
            allowedScopes: [NODE_SCOPES.SCENE],
            ctor: PluginNode,
            defaultScope: NODE_SCOPES.SCENE,
            id: 'test.plugin-node',
            label: 'Plugin Node'
        });

        expect(nodeModel.getNode('plugin-node')).toMatchObject({
            typeId: 'test.plugin-node'
        });
        expect(nodeModel.getNode('plugin-node').originalTypeId).toBeUndefined();
        expect(nodeModel.getStatus().unknownNodeCount).toBe(0);
        expect(project.extensionData.runtimeNodeModel.nodes[0].typeId).toBe('test.plugin-node');
        expect(project.extensionData.runtimeNodeModel.nodes[0].vendorPayload).toEqual({value: 42});
    });


    test('separates persistent DTOs from runtime debug DTOs', () => {
        const manager = createEnabledManager();
        const sceneData = manager.getCapability(SCENE_DATA_MODEL_CAPABILITY_ID);
        const nodeModel = manager.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID);
        const project = sceneData.readProject();
        const nodeResult = nodeModel.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            sceneId: project.activeSceneId
        });
        expect(nodeResult).toMatchObject({applied: true, persisted: true});
        const node = nodeResult.snapshot;
        const componentResult = nodeModel.addComponent(node.id, {
            data: {value: 1},
            typeId: 'test.component'
        });
        expect(componentResult).toMatchObject({applied: true, persisted: true});
        const component = componentResult.snapshot;

        const persistentNode = nodeModel.exportState().nodes.find(record => record.id === node.id);
        expect(persistentNode).not.toHaveProperty('activeInHierarchy');
        expect(persistentNode).not.toHaveProperty('childIds');
        expect(persistentNode).not.toHaveProperty('state');
        expect(persistentNode.components.find(record => record.id === component.id)).not.toHaveProperty('state');

        const debugNode = nodeModel.getDebugSnapshot().nodes.find(record => record.id === node.id);
        expect(debugNode).toHaveProperty('activeInHierarchy');
        expect(debugNode).toHaveProperty('state');
        expect(debugNode.components.find(record => record.id === component.id)).toHaveProperty('state');
    });

    test('forwards node type registry revisions and transaction ids through capability subscriptions', () => {
        let project = {
            activeSceneId: 'scene-a',
            extensionData: {},
            scenes: [{id: 'scene-a', name: 'Scene A'}]
        };
        const listeners = new Set();
        const sceneDataModel = {
            getStatus: () => ({}),
            readProject: () => JSON.parse(JSON.stringify(project)),
            subscribe: listener => {
                listeners.add(listener);
                return () => listeners.delete(listener);
            },
            writeProject: nextProject => {
                project = JSON.parse(JSON.stringify(nextProject));
                listeners.forEach(listener => listener({type: 'data'}));
            }
        };
        const registry = createRuntimeNodeTypeRegistry();
        const nodeModel = createRuntimeNodeModelService(sceneDataModel, {typeRegistry: registry});
        const changes = [];
        nodeModel.subscribe(change => changes.push(change));

        const node = nodeModel.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            sceneId: 'scene-a',
            transactionId: 'tx-create-node'
        });
        nodeModel.patchNode(node.id, {name: 'Transactional'}, {transactionId: 'tx-rename-node'});

        class DynamicNode extends RuntimeNode {}
        registry.register({
            allowedScopes: [NODE_SCOPES.SCENE],
            ctor: DynamicNode,
            id: 'test.dynamic-node',
            label: 'Dynamic Node',
            owner: 'test.dynamic'
        });

        expect(changes.some(change => change.transactionId === 'tx-create-node')).toBe(true);
        expect(changes.some(change => change.transactionId === 'tx-rename-node')).toBe(true);
        expect(changes.some(change => (
            change.type === 'registry:change' && change.typeId === 'test.dynamic-node'
        ))).toBe(true);
        expect(nodeModel.getNodeTypeRegistryRevision()).toBe(registry.getRevision());
    });


    test('preserves a newer runtime node state in persistence read-only mode', () => {
        const futureState = {
            activeSceneId: 'scene-a',
            futureField: true,
            nodes: [],
            scenes: [{id: 'scene-a', name: 'Scene A'}],
            version: 99
        };
        let project = {
            activeSceneId: 'scene-a',
            extensionData: {runtimeNodeModel: futureState},
            scenes: [{id: 'scene-a', name: 'Scene A'}]
        };
        const listeners = new Set();
        const sceneDataModel = {
            getStatus: () => ({}),
            readProject: () => JSON.parse(JSON.stringify(project)),
            subscribe: listener => {
                listeners.add(listener);
                return () => listeners.delete(listener);
            },
            writeProject: nextProject => {
                project = JSON.parse(JSON.stringify(nextProject));
                listeners.forEach(listener => listener({type: 'data'}));
            }
        };
        const nodeModel = createRuntimeNodeModelService(sceneDataModel);

        expect(nodeModel.getImportStatus()).toMatchObject({
            persistenceReadOnly: true,
            storedStateVersion: 99
        });
        let thrown = null;
        try {
            nodeModel.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {sceneId: 'scene-a'});
        } catch (error) {
            thrown = error;
        }
        expect(thrown).toMatchObject({code: 'RUNTIME_NODE_STATE_READ_ONLY'});
        expect(nodeModel.persistState()).toBe(false);
        expect(project.extensionData.runtimeNodeModel).toEqual(futureState);
    });

});
