const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    COMPONENT_CARDINALITIES,
    LEGACY_COMPONENT_EXTENSION_NAMESPACE,
    RuntimeNodeGraph,
    createRuntimeNodeModelHost
} = require('../../../../src/lib/runtime-nodes');

const clone = value => JSON.parse(JSON.stringify(value));
const createSceneDataModel = () => {
    let project = {activeSceneId: 'scene-a', extensionData: {}, scenes: [{id: 'scene-a', name: 'Scene A'}]};
    const listeners = new Set();
    return {
        getProject: () => clone(project),
        getStatus: () => ({readOnly: false}),
        readProject: () => clone(project),
        subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
        writeProject: next => { project = clone(next); listeners.forEach(listener => listener({type: 'data'})); }
    };
};

const createGraph = () => new RuntimeNodeGraph({
    activeSceneId: 'scene-a',
    scenes: [{id: 'scene-a', name: 'Scene A'}]
});

describe('0008.9.3.1 Component Identity, Cardinality and Persistence Closure', () => {
    test('round-trips type-authoritative cardinality without semantic drift', () => {
        const graph = createGraph();
        graph.componentTypeRegistry.register({
            cardinality: COMPONENT_CARDINALITIES.MANY,
            ownerModuleId: 'test.module',
            schemaVersion: 2,
            typeId: 'test.tags'
        });
        const node = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {id: 'node', sceneId: 'scene-a'});
        node.addComponent({id: 'single', schemaVersion: 3, typeId: 'test.single'});
        node.addComponent({id: 'tag-a', typeId: 'test.tags'});
        node.addComponent({id: 'tag-b', typeId: 'test.tags'});

        const first = graph.exportState();
        const rebuilt = RuntimeNodeGraph.createFromState(first, {
            componentTypeRegistry: graph.componentTypeRegistry
        }).graph;
        expect(rebuilt.exportState()).toEqual(first);
        expect(first.nodes[0].components.find(component => component.id === 'single').allowMultiple).toBe(false);
        expect(first.nodes[0].components.find(component => component.id === 'tag-a').allowMultiple).toBe(true);
    });

    test('rejects conflicting legacy cardinality projections', () => {
        expect(() => RuntimeNodeGraph.createFromState({
            activeSceneId: 'scene-a',
            nodes: [{
                components: [
                    {allowMultiple: false, id: 'a', typeId: 'test.conflict'},
                    {allowMultiple: true, id: 'b', typeId: 'test.conflict'}
                ],
                id: 'node',
                parentId: 'runtime-node:scene-root:scene-a',
                sceneId: 'scene-a',
                scope: 'scene',
                typeId: 'ngvge.node'
            }],
            scenes: [{id: 'scene-a', name: 'Scene A'}],
            version: 1
        })).toThrow(expect.objectContaining({code: 'RUNTIME_NODE_IMPORT_INVALID'}));
    });

    test('normalizes legacy top-level extras once into extensionData', () => {
        const state = {
            activeSceneId: 'scene-a',
            nodes: [{
                components: [{id: 'legacy', nativeHandle: 7, typeId: 'test.legacy'}],
                id: 'node',
                parentId: 'runtime-node:scene-root:scene-a',
                sceneId: 'scene-a',
                scope: 'scene',
                typeId: 'ngvge.node'
            }],
            scenes: [{id: 'scene-a', name: 'Scene A'}],
            version: 1
        };
        const once = RuntimeNodeGraph.createFromState(state).graph.exportState();
        expect(once.nodes[0].components[0].nativeHandle).toBeUndefined();
        expect(once.nodes[0].components[0].extensionData[LEGACY_COMPONENT_EXTENSION_NAMESPACE]).toEqual({
            nativeHandle: 7
        });
        expect(RuntimeNodeGraph.createFromState(once).graph.exportState()).toEqual(once);
    });

    test('makes component identity and ownership fields machine immutable', () => {
        const graph = createGraph();
        const node = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {id: 'node', sceneId: 'scene-a'});
        const component = node.addComponent({id: 'stable', schemaVersion: 4, typeId: 'test.identity'});
        const original = component.toPersistentRecord();

        expect(() => Object.defineProperty(component, 'id', {value: 'changed'})).toThrow();
        expect(() => Object.setPrototypeOf(component, {})).toThrow();
        try { component.typeId = 'changed.type'; } catch (error) { /* immutable */ }
        try { component.schemaVersion = 99; } catch (error) { /* immutable */ }
        try { component.ownerId = 'other'; } catch (error) { /* immutable */ }

        expect(component.id).toBe('stable');
        expect(component.typeId).toBe('test.identity');
        expect(component.schemaVersion).toBe(4);
        expect(component.ownerId).toBe('node');
        expect(node.getComponentById('stable')).toBe(component);
        expect(component.toPersistentRecord()).toEqual(original);
    });

    test('rejects public persistence escape hatches before mutation', () => {
        const host = createRuntimeNodeModelHost(createSceneDataModel());
        const model = host.publicCapability;
        expect(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {id: 'node', sceneId: 'scene-a'}).applied).toBe(true);
        for (const component of [
            {allowMultiple: true, typeId: 'test.extra'},
            {persistentExtras: {nativeHandle: 1}, typeId: 'test.extra'},
            {extensionData: {'test.module': {}}, typeId: 'test.extra'}
        ]) {
            const result = model.addComponent('node', component);
            expect(result.applied).toBe(false);
            expect(result.error.code).toBe('RUNTIME_COMPONENT_PUBLIC_EXTRA_FIELDS_FORBIDDEN');
        }
        expect(model.getNodeSnapshot('node').components).toHaveLength(0);
        host.localHostCapability.dispose();
    });

    test('validates the complete data candidate before replacing live data', () => {
        const host = createRuntimeNodeModelHost(createSceneDataModel());
        const model = host.publicCapability;
        model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {id: 'node', sceneId: 'scene-a'});
        model.addComponent('node', {data: {safe: true}, id: 'component', typeId: 'test.data'});
        const result = model.patchComponent('node', 'component', JSON.parse('{"__proto__":{"polluted":true}}'));
        expect(result.applied).toBe(false);
        expect(result.error.code).toBe('RUNTIME_COMPONENT_DATA_KEY_FORBIDDEN');
        expect(model.getComponentSnapshot('node', 'component').data).toEqual({safe: true});
        expect(Object.prototype.polluted).toBeUndefined();
        host.localHostCapability.dispose();
    });
});
