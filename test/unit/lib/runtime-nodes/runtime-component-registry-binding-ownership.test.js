const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    COMPONENT_CARDINALITIES,
    RuntimeNodeGraph,
    createRuntimeComponentTypeRegistry
} = require('../../../../src/lib/runtime-nodes');

const createRegistry = cardinality => createRuntimeComponentTypeRegistry([{
    cardinality,
    ownerModuleId: 'test.module',
    schemaVersion: 1,
    typeId: 'test.binding'
}]);

const expectGraphRoundTrip = graph => {
    const first = graph.exportState();
    const rebuilt = RuntimeNodeGraph.createFromState(first, {
        componentTypeRegistry: graph.componentTypeRegistry
    }).graph;
    expect(rebuilt.exportState()).toEqual(first);
    rebuilt.dispose();
};

describe('0008.9.3.1.2 Component Registry Binding Ownership Closure', () => {
    test('rejects direct Registry replacement before any binding side effect', () => {
        const registryA = createRegistry(COMPONENT_CARDINALITIES.ONE);
        const registryB = createRegistry(COMPONENT_CARDINALITIES.MANY);
        const graph = new RuntimeNodeGraph({
            activeSceneId: 'scene-a',
            componentTypeRegistry: registryA,
            scenes: [{id: 'scene-a', name: 'Scene A'}]
        });
        const node = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'node',
            sceneId: 'scene-a'
        });
        node.addComponent({id: 'a', typeId: 'test.binding'});

        expect(() => {
            graph.componentTypeRegistry = registryB;
        }).toThrow(expect.objectContaining({
            code: 'RUNTIME_COMPONENT_TYPE_REGISTRY_REPLACEMENT_FORBIDDEN'
        }));
        expect(graph.componentTypeRegistry).toBe(registryA);
        expect(registryA.getDebugSnapshot().usageResolverCount).toBe(1);
        expect(registryB.getDebugSnapshot().usageResolverCount).toBe(0);
        expect(() => node.addComponent({id: 'b', typeId: 'test.binding'})).toThrow(expect.objectContaining({
            code: 'RUNTIME_COMPONENT_CARDINALITY_VIOLATION'
        }));
        expectGraphRoundTrip(graph);
        graph.dispose();
    });

    test('does not expose the internal replacement authority through the underscore method', () => {
        const registryA = createRegistry(COMPONENT_CARDINALITIES.ONE);
        const registryB = createRegistry(COMPONENT_CARDINALITIES.MANY);
        const graph = new RuntimeNodeGraph({
            componentTypeRegistry: registryA,
            scenes: [{id: 'scene-a', name: 'Scene A'}]
        });

        expect(() => graph._replaceComponentTypeRegistry(registryB)).toThrow(expect.objectContaining({
            code: 'RUNTIME_COMPONENT_TYPE_REGISTRY_REPLACEMENT_FORBIDDEN'
        }));
        expect(graph.componentTypeRegistry).toBe(registryA);
        expect(registryA.getDebugSnapshot().usageResolverCount).toBe(1);
        expect(registryB.getDebugSnapshot().usageResolverCount).toBe(0);
        graph.dispose();
    });

    test('uses the private authority path during Graph adoption and transfers resolver ownership', () => {
        const registry = createRegistry(COMPONENT_CARDINALITIES.ONE);
        const graph = new RuntimeNodeGraph({
            activeSceneId: 'scene-a',
            componentTypeRegistry: registry,
            scenes: [{id: 'scene-a', name: 'Scene A'}]
        });
        const node = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'node',
            sceneId: 'scene-a'
        });
        node.addComponent({id: 'a', typeId: 'test.binding'});
        const first = graph.exportState();
        const previousRegistry = graph.componentTypeRegistry;

        expect(graph.importState(first).success).toBe(true);
        const adoptedRegistry = graph.componentTypeRegistry;
        expect(adoptedRegistry).not.toBe(previousRegistry);
        expect(previousRegistry.getDebugSnapshot().usageResolverCount).toBe(0);
        expect(adoptedRegistry.getDebugSnapshot().usageResolverCount).toBe(1);
        expect(graph.exportState()).toEqual(first);
        expect(() => adoptedRegistry.register({
            cardinality: COMPONENT_CARDINALITIES.MANY,
            ownerModuleId: 'test.module',
            schemaVersion: 1,
            typeId: 'test.binding'
        }, {replace: true})).toThrow(expect.objectContaining({
            code: 'RUNTIME_COMPONENT_CARDINALITY_TRANSITION_IN_USE',
            instanceCount: 1
        }));
        expectGraphRoundTrip(graph);

        graph.dispose();
        expect(adoptedRegistry.getDebugSnapshot().usageResolverCount).toBe(0);
    });

    test('keeps the public binding property non-configurable and enumerable', () => {
        const graph = new RuntimeNodeGraph();
        const descriptor = Object.getOwnPropertyDescriptor(graph, 'componentTypeRegistry');

        expect(descriptor).toEqual(expect.objectContaining({
            configurable: false,
            enumerable: true
        }));
        expect(typeof descriptor.get).toBe('function');
        expect(typeof descriptor.set).toBe('function');
        expect(() => Object.defineProperty(graph, 'componentTypeRegistry', {
            value: createRegistry(COMPONENT_CARDINALITIES.ONE)
        })).toThrow();
        graph.dispose();
    });
});
