const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    COMPONENT_CARDINALITIES,
    COMPONENT_LIFECYCLE_STATES,
    RuntimeComponent,
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
const createHost = () => createRuntimeNodeModelHost(createSceneDataModel());
const createNode = host => {
    const result = host.publicCapability.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'node',
        sceneId: 'scene-a'
    });
    expect(result.applied).toBe(true);
    expect(result.persisted).toBe(true);
};
const expectPersisted = result => {
    expect(result.applied).toBe(true);
    expect(result.persisted).toBe(true);
};
const expectHostRoundTrip = host => {
    const first = host.publicCapability.exportState();
    const imported = host.persistenceController.importState(first);
    expect(imported.applied).toBe(true);
    expect(imported.persisted).toBe(true);
    expect(host.publicCapability.exportState()).toEqual(first);
};
const expectGraphRoundTrip = graph => {
    const first = graph.exportState();
    const rebuilt = RuntimeNodeGraph.createFromState(first, {
        componentTypeRegistry: graph.componentTypeRegistry
    }).graph;
    expect(rebuilt.exportState()).toEqual(first);
    rebuilt.dispose();
};

describe('0008.9.3.1.1 Component Cardinality Authority Transition Hotfix', () => {
    test('blocks implicit one to explicit many while an instance is live', () => {
        const host = createHost();
        createNode(host);
        expectPersisted(host.publicCapability.addComponent('node', {
            id: 'a',
            typeId: 'test.promoted'
        }));

        expect(() => host.typeRegistrationCapability.registerComponentTypeDescriptor({
            cardinality: COMPONENT_CARDINALITIES.MANY,
            ownerModuleId: 'test.module',
            schemaVersion: 1,
            typeId: 'test.promoted'
        })).toThrow(expect.objectContaining({
            code: 'RUNTIME_COMPONENT_CARDINALITY_TRANSITION_IN_USE',
            existingCardinality: COMPONENT_CARDINALITIES.ONE,
            instanceCount: 1,
            nextCardinality: COMPONENT_CARDINALITIES.MANY
        }));
        expect(host.typeRegistrationCapability.getComponentTypeDescriptor('test.promoted').cardinality).toBe(
            COMPONENT_CARDINALITIES.ONE
        );
        expectHostRoundTrip(host);
        host.localHostCapability.dispose();
    });

    test('blocks explicit many to explicit one with even one live instance', () => {
        const host = createHost();
        host.typeRegistrationCapability.registerComponentTypeDescriptor({
            cardinality: COMPONENT_CARDINALITIES.MANY,
            ownerModuleId: 'test.module',
            schemaVersion: 1,
            typeId: 'test.explicit-many'
        });
        createNode(host);
        expectPersisted(host.publicCapability.addComponent('node', {
            id: 'a',
            typeId: 'test.explicit-many'
        }));

        expect(() => host.typeRegistrationCapability.registerComponentTypeDescriptor({
            cardinality: COMPONENT_CARDINALITIES.ONE,
            ownerModuleId: 'test.module',
            schemaVersion: 1,
            typeId: 'test.explicit-many'
        }, {replace: true})).toThrow(expect.objectContaining({
            code: 'RUNTIME_COMPONENT_CARDINALITY_TRANSITION_IN_USE',
            instanceCount: 1
        }));
        expectPersisted(host.publicCapability.addComponent('node', {
            id: 'b',
            typeId: 'test.explicit-many'
        }));
        expectHostRoundTrip(host);
        host.localHostCapability.dispose();
    });

    test('blocks descriptor unregister until every instance is removed', () => {
        const host = createHost();
        host.typeRegistrationCapability.registerComponentTypeDescriptor({
            cardinality: COMPONENT_CARDINALITIES.ONE,
            ownerModuleId: 'test.module',
            schemaVersion: 1,
            typeId: 'test.rebind'
        });
        createNode(host);
        expectPersisted(host.publicCapability.addComponent('node', {
            id: 'one',
            typeId: 'test.rebind'
        }));

        expect(() => host.typeRegistrationCapability.unregisterComponentTypeDescriptor('test.rebind')).toThrow(
            expect.objectContaining({code: 'RUNTIME_COMPONENT_TYPE_DESCRIPTOR_IN_USE', instanceCount: 1})
        );
        expectHostRoundTrip(host);

        expectPersisted(host.publicCapability.removeComponent('node', 'one'));
        expect(host.typeRegistrationCapability.unregisterComponentTypeDescriptor('test.rebind')).toBe(true);
        host.typeRegistrationCapability.registerComponentTypeDescriptor({
            cardinality: COMPONENT_CARDINALITIES.MANY,
            ownerModuleId: 'test.module',
            schemaVersion: 1,
            typeId: 'test.rebind'
        });
        expectPersisted(host.publicCapability.addComponent('node', {id: 'many-a', typeId: 'test.rebind'}));
        expectPersisted(host.publicCapability.addComponent('node', {id: 'many-b', typeId: 'test.rebind'}));
        expectHostRoundTrip(host);
        host.localHostCapability.dispose();
    });

    test('rejects a preconstructed component whose cardinality conflicts with the graph descriptor', () => {
        const graph = createGraph();
        graph.componentTypeRegistry.register({
            cardinality: COMPONENT_CARDINALITIES.MANY,
            ownerModuleId: 'test.module',
            schemaVersion: 1,
            typeId: 'test.preconstructed'
        });
        const node = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {id: 'node', sceneId: 'scene-a'});
        const component = new RuntimeComponent({
            id: 'component',
            typeId: 'test.preconstructed'
        }, {cardinality: COMPONENT_CARDINALITIES.ONE});

        expect(() => node.addComponent(component)).toThrow(expect.objectContaining({
            code: 'RUNTIME_COMPONENT_CARDINALITY_CONFLICT',
            componentCardinality: COMPONENT_CARDINALITIES.ONE,
            descriptorCardinality: COMPONENT_CARDINALITIES.MANY
        }));
        expect(component.ownerId).toBeNull();
        expect(component.state).toBe(COMPONENT_LIFECYCLE_STATES.CREATED);
        expect(node.getComponents('test.preconstructed')).toHaveLength(0);
        expectGraphRoundTrip(graph);
        graph.dispose();
    });
});
