const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    COMPONENT_CARDINALITIES,
    RuntimeComponent,
    RuntimeNodeGraph,
    createRuntimeComponentTypeRegistry,
    createRuntimeNodeModelService,
    getRuntimeNodeModelHost
} = require('../../../../src/lib/runtime-nodes');

const clone = value => JSON.parse(JSON.stringify(value));

const createRegistry = (schemaVersion = 3, cardinality = COMPONENT_CARDINALITIES.ONE) => (
    createRuntimeComponentTypeRegistry([{
        cardinality,
        ownerModuleId: 'test.schema-owner',
        schemaVersion,
        typeId: 'test.schema'
    }])
);

const createGraph = registry => new RuntimeNodeGraph({
    activeSceneId: 'scene-a',
    componentTypeRegistry: registry,
    scenes: [{id: 'scene-a', name: 'Scene A'}]
});

const createNode = (graph, id = 'node') => graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
    id,
    sceneId: 'scene-a'
});

const bindCompleteMigration = registry => {
    registry.bindMigration('test.schema', 1, ({data, extensionData}) => ({
        data: Object.assign({}, data, {v2: true}),
        extensionData
    }), {ownerModuleId: 'test.schema-owner'});
    registry.bindMigration('test.schema', 2, ({data, extensionData}) => ({
        data: Object.assign({}, data, {v3: true}),
        extensionData: Object.assign({}, extensionData, {'test.schema-owner': {migrated: true}})
    }), {ownerModuleId: 'test.schema-owner'});
};

describe('0008.9.4 Component Schema Version and Migration Authority Freeze', () => {
    test('derives omitted schemaVersion and rejects caller version injection', () => {
        const registry = createRegistry(3, COMPONENT_CARDINALITIES.MANY);
        const graph = createGraph(registry);
        const node = createNode(graph);

        expect(graph.addComponent(node.id, {id: 'derived', typeId: 'test.schema'}).schemaVersion).toBe(3);
        expect(graph.addComponent(node.id, {
            id: 'matching',
            schemaVersion: 3,
            typeId: 'test.schema'
        }).schemaVersion).toBe(3);
        expect(() => graph.addComponent(node.id, {
            id: 'mismatch',
            schemaVersion: 2,
            typeId: 'test.schema'
        })).toThrow(expect.objectContaining({
            code: 'RUNTIME_COMPONENT_SCHEMA_VERSION_CONFLICT'
        }));

        graph.dispose();
    });

    test('rejects preconstructed version mismatch and live Descriptor transition', () => {
        const registry = createRegistry(3);
        const graph = createGraph(registry);
        const node = createNode(graph);
        const component = new RuntimeComponent({
            id: 'preconstructed',
            schemaVersion: 2,
            typeId: 'test.schema'
        }, registry.get('test.schema'));

        expect(() => node.addComponent(component)).toThrow(expect.objectContaining({
            code: 'RUNTIME_COMPONENT_SCHEMA_VERSION_CONFLICT'
        }));
        node.addComponent({id: 'live', typeId: 'test.schema'});
        expect(() => registry.register({
            cardinality: COMPONENT_CARDINALITIES.ONE,
            ownerModuleId: 'test.schema-owner',
            schemaVersion: 4,
            typeId: 'test.schema'
        }, {replace: true})).toThrow(expect.objectContaining({
            code: 'RUNTIME_COMPONENT_SCHEMA_TRANSITION_IN_USE',
            instanceCount: 1
        }));

        graph.dispose();
    });

    test('aggregates shared Registry usage and forbids Descriptor downgrade', () => {
        const registry = createRegistry(1);
        const graphA = createGraph(registry);
        const graphB = createGraph(registry);
        createNode(graphA, 'a').addComponent({id: 'component-a', typeId: 'test.schema'});
        createNode(graphB, 'b').addComponent({id: 'component-b', typeId: 'test.schema'});

        expect(() => registry.register({
            cardinality: COMPONENT_CARDINALITIES.ONE,
            ownerModuleId: 'test.schema-owner',
            schemaVersion: 2,
            typeId: 'test.schema'
        }, {replace: true})).toThrow(expect.objectContaining({
            code: 'RUNTIME_COMPONENT_SCHEMA_TRANSITION_IN_USE',
            instanceCount: 2
        }));
        graphA.dispose();
        graphB.dispose();
        registry.register({
            cardinality: COMPONENT_CARDINALITIES.ONE,
            ownerModuleId: 'test.schema-owner',
            schemaVersion: 2,
            typeId: 'test.schema'
        }, {replace: true});
        expect(() => registry.register({
            cardinality: COMPONENT_CARDINALITIES.ONE,
            ownerModuleId: 'test.schema-owner',
            schemaVersion: 1,
            typeId: 'test.schema'
        }, {replace: true})).toThrow(expect.objectContaining({
            code: 'RUNTIME_COMPONENT_SCHEMA_DOWNGRADE_FORBIDDEN'
        }));
    });

    test('binds owner-authorized contiguous migrations and releases them on unregister', () => {
        const registry = createRegistry(3);

        expect(Object.prototype.hasOwnProperty.call(registry, '_migrationBindings')).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(registry, '_implicitTypeIds')).toBe(false);
        expect(() => registry.bindMigration('test.schema', undefined, value => value, {
            ownerModuleId: 'test.schema-owner'
        })).toThrow(expect.objectContaining({
            code: 'RUNTIME_COMPONENT_MIGRATION_VERSION_INVALID'
        }));
        expect(() => registry.bindMigration('test.schema', 1, value => value, {
            ownerModuleId: 'other.module'
        })).toThrow(expect.objectContaining({
            code: 'RUNTIME_COMPONENT_MIGRATION_OWNER_MISMATCH'
        }));
        bindCompleteMigration(registry);
        expect(registry.listMigrations('test.schema')).toEqual([
            expect.objectContaining({fromVersion: 1, toVersion: 2}),
            expect.objectContaining({fromVersion: 2, toVersion: 3})
        ]);
        expect(registry.unregister('test.schema')).toBe(true);
        expect(registry.listMigrations('test.schema')).toEqual([]);
    });

    test('migrates 1 -> 2 -> 3 before live construction and preserves canonical round-trip', () => {
        const registry = createRegistry(3);
        bindCompleteMigration(registry);
        const graph = createGraph(registry);
        createNode(graph).addComponent({id: 'component', typeId: 'test.schema'});
        const oldState = graph.exportState();
        oldState.nodes[0].components[0].data = {original: true};
        oldState.nodes[0].components[0].schemaVersion = 1;
        graph.dispose();

        const rebuilt = RuntimeNodeGraph.createFromState(oldState, {componentTypeRegistry: registry}).graph;
        const migrated = rebuilt.exportState();
        expect(migrated.nodes[0].components[0]).toEqual(expect.objectContaining({
            data: {original: true, v2: true, v3: true},
            extensionData: {'test.schema-owner': {migrated: true}},
            schemaVersion: 3
        }));
        const roundTrip = RuntimeNodeGraph.createFromState(migrated, {
            componentTypeRegistry: rebuilt.componentTypeRegistry
        }).graph;
        expect(roundTrip.exportState()).toEqual(migrated);
        roundTrip.dispose();
        rebuilt.dispose();
    });

    test('rejects missing, throwing and authority-injecting migrations atomically', () => {
        const registry = createRegistry(3);
        const graph = createGraph(registry);
        createNode(graph).addComponent({id: 'component', typeId: 'test.schema'});
        const before = graph.exportState();
        const oldState = clone(before);
        oldState.nodes[0].components[0].schemaVersion = 1;
        registry.bindMigration('test.schema', 1, ({data}) => ({data}), {
            ownerModuleId: 'test.schema-owner'
        });

        expect(() => graph.importState(oldState)).toThrow(expect.objectContaining({
            errors: expect.arrayContaining([
                expect.objectContaining({code: 'RUNTIME_COMPONENT_MIGRATION_PATH_MISSING'})
            ])
        }));
        expect(graph.exportState()).toEqual(before);
        graph.dispose();

        const throwing = createRegistry(3);
        throwing.bindMigration('test.schema', 1, () => {
            throw new Error('provider failed');
        }, {ownerModuleId: 'test.schema-owner'});
        throwing.bindMigration('test.schema', 2, ({data}) => ({data}), {
            ownerModuleId: 'test.schema-owner'
        });
        expect(() => RuntimeNodeGraph.createFromState(oldState, {
            componentTypeRegistry: throwing
        })).toThrow(expect.objectContaining({
            errors: expect.arrayContaining([
                expect.objectContaining({code: 'RUNTIME_COMPONENT_MIGRATION_FAILED'})
            ])
        }));

        const injecting = createRegistry(3);
        injecting.bindMigration('test.schema', 1, ({data}) => ({data, ownerId: 'injected'}), {
            ownerModuleId: 'test.schema-owner'
        });
        injecting.bindMigration('test.schema', 2, ({data}) => ({data}), {
            ownerModuleId: 'test.schema-owner'
        });
        expect(() => RuntimeNodeGraph.createFromState(oldState, {
            componentTypeRegistry: injecting
        })).toThrow(expect.objectContaining({
            errors: expect.arrayContaining([
                expect.objectContaining({code: 'RUNTIME_COMPONENT_MIGRATION_RESULT_INVALID'})
            ])
        }));
    });

    test('preserves future known versions in persistence read-only mode', () => {
        const registry = createRegistry(3);
        const seed = createGraph(registry);
        createNode(seed).addComponent({id: 'component', typeId: 'test.schema'});
        const futureState = seed.exportState();
        futureState.nodes[0].components[0].schemaVersion = 9;
        seed.dispose();
        let project = {
            activeSceneId: 'scene-a',
            extensionData: {runtimeNodeModel: futureState},
            scenes: [{id: 'scene-a', name: 'Scene A'}]
        };
        const original = clone(project);
        const sceneDataModel = {
            getStatus: () => ({}),
            readProject: () => clone(project),
            subscribe: () => () => {},
            writeProject: nextProject => {
                project = clone(nextProject);
            }
        };
        const model = createRuntimeNodeModelService(sceneDataModel, {componentTypeRegistry: registry});

        expect(model.getImportStatus()).toMatchObject({
            persistenceReadOnly: true,
            persistenceReadOnlyReason: 'component-schema',
            unsupportedComponentSchemas: [expect.objectContaining({recordVersion: 9})]
        });
        expect(() => model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            sceneId: 'scene-a'
        })).toThrow(expect.objectContaining({code: 'RUNTIME_NODE_STATE_READ_ONLY'}));
        model.persistState();
        expect(project).toEqual(original);
        model.dispose();
    });

    test('keeps unknown types opaque and exposes migration binding only through restricted Host capability', () => {
        const graph = createGraph(createRuntimeComponentTypeRegistry());
        createNode(graph).addComponent({
            id: 'unknown',
            schemaVersion: 7,
            typeId: 'unknown.component'
        });
        const olderNode = createNode(graph, 'older-node');
        olderNode.addComponent({
            id: 'unknown-older',
            schemaVersion: 2,
            typeId: 'unknown.component'
        });
        const state = graph.exportState();
        const rebuilt = RuntimeNodeGraph.createFromState(state, {
            componentTypeRegistry: graph.componentTypeRegistry
        }).graph;
        expect(rebuilt.exportState()).toEqual(state);
        rebuilt.dispose();

        expect(() => graph.componentTypeRegistry.register({
            cardinality: COMPONENT_CARDINALITIES.ONE,
            ownerModuleId: 'ngvge.runtime.compat.spoofed-explicit-owner',
            schemaVersion: 7,
            typeId: 'unknown.component'
        }, {replace: true})).toThrow(expect.objectContaining({
            code: 'RUNTIME_COMPONENT_SCHEMA_VERSION_CONFLICT'
        }));
        olderNode.removeComponent('unknown-older');
        graph.componentTypeRegistry.register({
            cardinality: COMPONENT_CARDINALITIES.ONE,
            ownerModuleId: 'ngvge.runtime.compat.spoofed-explicit-owner',
            schemaVersion: 7,
            typeId: 'unknown.component'
        }, {replace: true});
        expect(graph.componentTypeRegistry.isImplicit('unknown.component')).toBe(false);
        graph.dispose();

        let project = {
            activeSceneId: 'scene-a',
            extensionData: {},
            scenes: [{id: 'scene-a', name: 'Scene A'}]
        };
        const model = createRuntimeNodeModelService({
            getStatus: () => ({}),
            readProject: () => clone(project),
            subscribe: () => () => {},
            writeProject: nextProject => {
                project = clone(nextProject);
            }
        });
        const registration = getRuntimeNodeModelHost(model).typeRegistrationCapability;
        expect(registration.version).toBe('1.2');
        expect(registration).toEqual(expect.objectContaining({
            bindComponentMigration: expect.any(Function),
            listComponentMigrations: expect.any(Function),
            unbindComponentMigration: expect.any(Function)
        }));
        model.dispose();
    });
});
