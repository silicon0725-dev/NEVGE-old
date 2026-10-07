import {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    RUNTIME_NODE_MODEL_API_VERSION,
    createRuntimeNodeModelService
} from '../../../../src/lib/runtime-nodes';

describe('0008.9.1 Runtime Node API Freeze', () => {
    const createHarness = () => {
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
        return {
            getProject: () => JSON.parse(JSON.stringify(project)),
            nodeModel: createRuntimeNodeModelService(sceneDataModel)
        };
    };

    test('publishes the frozen public API contract and canonical methods', () => {
        const {nodeModel} = createHarness();
        const contract = nodeModel.getApiContract();

        expect(nodeModel.apiVersion).toBe(RUNTIME_NODE_MODEL_API_VERSION);
        expect(Object.isFrozen(contract)).toBe(true);
        expect(Object.isFrozen(contract.portableQueryMethods)).toBe(true);
        expect(Object.isFrozen(contract.portableMutationMethods)).toBe(true);
        expect(contract.returnsMutableRuntimeInstances).toBe(false);
        [...contract.portableQueryMethods, ...contract.portableMutationMethods, ...contract.localMethods]
            .forEach(method => expect(typeof nodeModel[method]).toBe('function'));
        expect(nodeModel).not.toHaveProperty('graph');
        expect(nodeModel).not.toHaveProperty('typeRegistry');
    });

    test('returns deeply frozen snapshots and only mutates through the service', () => {
        const {nodeModel} = createHarness();
        const node = nodeModel.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            metadata: {nested: {value: 1}},
            name: 'Player',
            sceneId: 'scene-a'
        });
        const component = nodeModel.addComponent(node.id, {
            data: {speed: 1},
            typeId: 'test.movement'
        });
        const snapshot = nodeModel.getNodeSnapshot(node.id);

        expect(snapshot.constructor).toBe(Object);
        expect(component.constructor).toBe(Object);
        expect(Object.isFrozen(snapshot)).toBe(true);
        expect(Object.isFrozen(snapshot.metadata)).toBe(true);
        expect(Object.isFrozen(snapshot.metadata.nested)).toBe(true);
        expect(Object.isFrozen(snapshot.components)).toBe(true);
        expect(Object.isFrozen(snapshot.components[0].data)).toBe(true);
        expect(() => {
            snapshot.metadata.nested.value = 99;
        }).toThrow();
        expect(nodeModel.getNodeSnapshot(node.id).metadata.nested.value).toBe(1);

        nodeModel.patchNode(node.id, {name: 'Hero'});
        nodeModel.patchComponent(node.id, component.id, {speed: 10});
        expect(nodeModel.getNodeSnapshot(node.id).name).toBe('Hero');
        expect(nodeModel.getComponentSnapshot(node.id, component.id).data.speed).toBe(10);
    });

    test('provides an explicit reorder mutation and frozen scene snapshot', () => {
        const {nodeModel} = createHarness();
        const parent = nodeModel.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            name: 'Parent',
            sceneId: 'scene-a'
        });
        const first = nodeModel.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            name: 'First',
            parentId: parent.id
        });
        const second = nodeModel.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            name: 'Second',
            parentId: parent.id
        });

        const reordered = nodeModel.reorderChild(second.id, 0);
        expect(reordered.id).toBe(second.id);
        expect(nodeModel.getChildren(parent.id).map(node => node.id)).toEqual([second.id, first.id]);

        const scene = nodeModel.getSceneSnapshot('scene-a');
        expect(Object.isFrozen(scene)).toBe(true);
        expect(Object.isFrozen(scene.nodes)).toBe(true);
        expect(scene.sceneId).toBe('scene-a');
        expect(scene.nodes.map(node => node.id)).toEqual(expect.arrayContaining([parent.id, first.id, second.id]));
    });

    test('keeps compatibility aliases without exposing mutable instances', () => {
        const {nodeModel} = createHarness();
        const node = nodeModel.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {sceneId: 'scene-a'});
        const component = nodeModel.addComponent(node.id, {
            data: {value: 1},
            typeId: 'test.data'
        });

        expect(nodeModel.getNode(node.id)).toEqual(nodeModel.getNodeSnapshot(node.id));
        expect(nodeModel.getComponent(node.id, component.id))
            .toEqual(nodeModel.getComponentSnapshot(node.id, component.id));
        nodeModel.patchComponentData(node.id, component.id, {value: 2});
        nodeModel.renameNode(node.id, 'Compatibility');
        expect(nodeModel.getNodeSnapshot(node.id)).toMatchObject({name: 'Compatibility'});
        expect(nodeModel.getComponentSnapshot(node.id, component.id).data.value).toBe(2);
    });

    test('preserves stable node identity through state transfer', () => {
        const firstHarness = createHarness();
        const created = firstHarness.nodeModel.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'stable-node',
            sceneId: 'scene-a'
        });
        const state = firstHarness.nodeModel.exportState();

        const secondHarness = createHarness();
        secondHarness.nodeModel.importState(state);
        expect(secondHarness.nodeModel.getNodeSnapshot(created.id)).toMatchObject({
            id: 'stable-node',
            sceneId: 'scene-a'
        });
    });
});
