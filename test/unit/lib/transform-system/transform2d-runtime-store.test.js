const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    RuntimeNodeGraph
} = require('../../../../src/lib/runtime-nodes');
const {
    TRANSFORM2D_RUNTIME_COMPONENT_DESCRIPTOR,
    TRANSFORM2D_RUNTIME_CONTRACT,
    createTransform2DComponentOptions,
    createTransform2DRuntimeStore,
    registerTransform2DRuntimeComponent
} = require('../../../../src/lib/transform-system');

const NODE_ID = 'ngvge:node:transformtest01';
const COMPONENT_ID = 'runtime-component:transformtest01';

const createGraph = () => new RuntimeNodeGraph({
    activeSceneId: 'scene-a',
    scenes: [{id: 'scene-a', name: 'Scene A'}]
});

const createNode = graph => graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE_2D, {
    id: NODE_ID,
    name: 'Transform Owner',
    sceneId: 'scene-a'
});

describe('0009-B Transform2D Runtime / Persistent Component Wiring', () => {
    test('registers Transform2D as a single-instance Runtime Component owned by the Transform System', () => {
        const graph = createGraph();
        const descriptor = registerTransform2DRuntimeComponent(graph.componentTypeRegistry);
        expect(descriptor).toEqual(TRANSFORM2D_RUNTIME_COMPONENT_DESCRIPTOR);
        expect(registerTransform2DRuntimeComponent(graph.componentTypeRegistry)).toBe(descriptor);
        expect(TRANSFORM2D_RUNTIME_CONTRACT.separation.runtimeStateStoredInComponentData).toBe(false);
        expect(TRANSFORM2D_RUNTIME_CONTRACT.ownership.scratchTargetIsOwner).toBe(false);
    });

    test('creates one persistent Transform component on semantic Node ownership without backend fields', () => {
        const graph = createGraph();
        const node = createNode(graph);
        const store = createTransform2DRuntimeStore(graph);
        const component = store.ensureTransformComponent(node.id, {
            componentId: COMPONENT_ID,
            data: {position: [12, -5], rotation: 30, scale: [2, 0.5]}
        });

        expect(component.ownerId).toBe(NODE_ID);
        expect(component.typeId).toBe('ngvge.transform2d');
        expect(node.getComponents('ngvge.transform2d')).toHaveLength(1);
        expect(component.toPersistentRecord()).toEqual({
            allowMultiple: false,
            data: {position: [12, -5], rotation: 30, scale: [2, 0.5]},
            enabled: true,
            id: COMPONENT_ID,
            schemaVersion: 1,
            typeId: 'ngvge.transform2d'
        });
        expect(() => store.ensureTransformComponent(node.id, {
            data: {position: [99, 99], rotation: 0, scale: [1, 1]}
        })).not.toThrow();
        expect(node.getComponents('ngvge.transform2d')).toHaveLength(1);
        store.dispose();
    });

    test('seeds Runtime Transform from Persistent Transform through an explicit hydrate boundary', () => {
        const graph = createGraph();
        const node = createNode(graph);
        registerTransform2DRuntimeComponent(graph.componentTypeRegistry);
        graph.addComponent(node.id, createTransform2DComponentOptions({
            componentId: COMPONENT_ID,
            data: {position: [3, 4], rotation: 45, scale: [1.25, 2]}
        }));

        const store = createTransform2DRuntimeStore(graph);
        expect(store.getRuntimeSnapshot(node.id)).toEqual({
            componentId: COMPONENT_ID,
            nodeId: NODE_ID,
            revision: 1,
            transform: {position: [3, 4], rotation: 45, scale: [1.25, 2]}
        });
        expect(store.isRuntimeDivergedFromPersistent(node.id)).toBe(false);
        store.dispose();
    });

    test('keeps high-frequency Runtime Transform writes out of Persistent Component data and graph revision', () => {
        const graph = createGraph();
        const node = createNode(graph);
        const store = createTransform2DRuntimeStore(graph);
        store.ensureTransformComponent(node.id, {
            componentId: COMPONENT_ID,
            data: {position: [0, 0], rotation: 0, scale: [1, 1]}
        });
        const persistentBefore = graph.exportState();
        const graphRevisionBefore = graph.getStatus().revision;

        for (let index = 0; index < 240; index++) {
            store.patchRuntimeTransform(node.id, {
                position: [index * 0.25, -index * 0.5],
                rotation: index
            });
        }

        expect(store.getRuntimeTransform(node.id)).toEqual({
            position: [239 * 0.25, -239 * 0.5],
            rotation: 239,
            scale: [1, 1]
        });
        expect(store.isRuntimeDivergedFromPersistent(node.id)).toBe(true);
        expect(graph.getStatus().revision).toBe(graphRevisionBefore);
        expect(graph.exportState()).toEqual(persistentBefore);
        expect(store.getPersistentTransform(node.id)).toEqual({
            position: [0, 0],
            rotation: 0,
            scale: [1, 1]
        });
        store.dispose();
    });

    test('does not let a Persistent patch silently overwrite live Runtime state', () => {
        const graph = createGraph();
        const node = createNode(graph);
        const store = createTransform2DRuntimeStore(graph);
        const component = store.ensureTransformComponent(node.id, {
            componentId: COMPONENT_ID,
            data: {position: [1, 2], rotation: 0, scale: [1, 1]}
        });
        store.patchRuntimeTransform(node.id, {position: [50, 60]});
        graph.patchComponentData(node.id, component.id, {position: [7, 8]});

        expect(store.getPersistentTransform(node.id).position).toEqual([7, 8]);
        expect(store.getRuntimeTransform(node.id).position).toEqual([50, 60]);
        store.hydrateNodeFromPersistent(node.id);
        expect(store.getRuntimeTransform(node.id).position).toEqual([7, 8]);
        store.dispose();
    });

    test('round-trips Persistent Transform and reconstructs Runtime state without serializing runtime revision', () => {
        const graph = createGraph();
        const node = createNode(graph);
        const store = createTransform2DRuntimeStore(graph);
        store.ensureTransformComponent(node.id, {
            componentId: COMPONENT_ID,
            data: {position: [-8, 6], rotation: -90, scale: [-1, 1]}
        });
        store.patchRuntimeTransform(node.id, {position: [999, 999]});
        const persistentState = graph.exportState();
        store.dispose();

        const rebuilt = RuntimeNodeGraph.createFromState(persistentState, {
            componentTypeRegistry: graph.componentTypeRegistry
        }).graph;
        const rebuiltStore = createTransform2DRuntimeStore(rebuilt);
        expect(rebuiltStore.getPersistentTransform(NODE_ID)).toEqual({
            position: [-8, 6],
            rotation: -90,
            scale: [-1, 1]
        });
        expect(rebuiltStore.getRuntimeTransform(NODE_ID)).toEqual({
            position: [-8, 6],
            rotation: -90,
            scale: [-1, 1]
        });
        const record = rebuiltStore.getPersistentComponentRecord(NODE_ID);
        expect(record.runtimeRevision).toBeUndefined();
        expect(record.nodeId).toBeUndefined();
        expect(record.data.runtimeRevision).toBeUndefined();
        rebuiltStore.dispose();
    });

    test('cleans Runtime state when the Transform component or semantic Node is removed', () => {
        const graph = createGraph();
        const node = createNode(graph);
        const store = createTransform2DRuntimeStore(graph);
        const component = store.ensureTransformComponent(node.id, {componentId: COMPONENT_ID});
        expect(store.getRuntimeTransform(node.id)).not.toBeNull();

        graph.removeComponent(node.id, component.id);
        expect(store.getRuntimeTransform(node.id)).toBeNull();

        store.ensureTransformComponent(node.id, {componentId: 'runtime-component:transformtest02'});
        graph.destroyNode(node.id);
        expect(store.getRuntimeTransform(node.id)).toBeNull();
        expect(store.getStatus().entryCount).toBe(0);
        store.dispose();
    });

    test('fails closed when Scratch/backend representation is supplied as Transform component or runtime data', () => {
        expect(() => createTransform2DComponentOptions({
            targetRuntimeId: 'scratch-target-a'
        })).toThrow(expect.objectContaining({code: 'NGVGE_TRANSFORM2D_COMPONENT_OPTION_FORBIDDEN'}));
        expect(() => createTransform2DComponentOptions({
            data: {position: [0, 0], rotation: 0, scale: [1, 1], targetRuntimeId: 'scratch-target-a'}
        })).toThrow();

        const graph = createGraph();
        const node = createNode(graph);
        const store = createTransform2DRuntimeStore(graph);
        store.ensureTransformComponent(node.id, {componentId: COMPONENT_ID});
        expect(() => store.replaceRuntimeTransform(node.id, {
            position: [0, 0],
            rotation: 0,
            scale: [1, 1],
            drawableId: 4
        })).toThrow();
        store.dispose();
    });
});
