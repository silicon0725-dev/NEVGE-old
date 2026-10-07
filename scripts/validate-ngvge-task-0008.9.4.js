#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    COMPONENT_CARDINALITIES,
    RuntimeComponent,
    RuntimeNodeGraph,
    createRuntimeComponentTypeRegistry,
    createRuntimeNodeModelService,
    getRuntimeNodeModelHost
} = require('../src/lib/runtime-nodes');

const clone = value => JSON.parse(JSON.stringify(value));

const createGraph = registry => new RuntimeNodeGraph({
    activeSceneId: 'scene-a',
    componentTypeRegistry: registry,
    scenes: [{id: 'scene-a', name: 'Scene A'}]
});

const createNode = (graph, id = 'node') => graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
    id,
    sceneId: 'scene-a'
});

const createRegistry = (schemaVersion = 3, cardinality = COMPONENT_CARDINALITIES.ONE) => (
    createRuntimeComponentTypeRegistry([{
        cardinality,
        ownerModuleId: 'test.schema-owner',
        schemaVersion,
        typeId: 'test.schema'
    }])
);

const bindCompleteMigration = registry => {
    registry.bindMigration('test.schema', 1, ({data, extensionData}, context) => {
        assert.deepStrictEqual(context, {
            fromVersion: 1,
            toVersion: 2,
            typeId: 'test.schema'
        });
        return {
            data: Object.assign({}, data, {migratedTo2: true}),
            extensionData
        };
    }, {ownerModuleId: 'test.schema-owner'});
    registry.bindMigration('test.schema', 2, ({data, extensionData}) => ({
        data: Object.assign({}, data, {migratedTo3: true}),
        extensionData: Object.assign({}, extensionData, {
            'test.schema-owner': {migrated: true}
        })
    }), {ownerModuleId: 'test.schema-owner'});
};

const assertRoundTrip = (state, registry) => {
    const first = RuntimeNodeGraph.createFromState(state, {componentTypeRegistry: registry}).graph;
    const exported = first.exportState();
    const second = RuntimeNodeGraph.createFromState(exported, {
        componentTypeRegistry: first.componentTypeRegistry
    }).graph;
    assert.deepStrictEqual(second.exportState(), exported);
    second.dispose();
    first.dispose();
    return exported;
};

// Public/local creation: omitted version derives from Descriptor; supplied version is only an assertion.
{
    const registry = createRegistry(3, COMPONENT_CARDINALITIES.MANY);
    const graph = createGraph(registry);
    const node = createNode(graph);
    const derived = graph.addComponent(node.id, {id: 'derived', typeId: 'test.schema'});
    assert.strictEqual(derived.schemaVersion, 3);
    const matching = graph.addComponent(node.id, {
        id: 'matching',
        schemaVersion: 3,
        typeId: 'test.schema'
    });
    assert.strictEqual(matching.schemaVersion, 3);
    assert.throws(() => graph.addComponent(node.id, {
        id: 'mismatch',
        schemaVersion: 2,
        typeId: 'test.schema'
    }), error => error && error.code === 'RUNTIME_COMPONENT_SCHEMA_VERSION_CONFLICT');
    assert.strictEqual(node.getComponents('test.schema').length, 2);
    graph.dispose();
}

// Preconstructed instances cannot carry a different version into an explicit Descriptor boundary.
{
    const registry = createRegistry(3);
    const graph = createGraph(registry);
    const node = createNode(graph);
    const preconstructed = new RuntimeComponent({
        id: 'preconstructed',
        schemaVersion: 2,
        typeId: 'test.schema'
    }, registry.get('test.schema'));
    assert.throws(() => node.addComponent(preconstructed), error => (
        error && error.code === 'RUNTIME_COMPONENT_SCHEMA_VERSION_CONFLICT'
    ));
    assert.strictEqual(node.getComponents().length, 0);
    graph.dispose();
}

// Schema transitions aggregate usage across shared Graphs; downgrade is always forbidden.
{
    const registry = createRegistry(1);
    const graphA = createGraph(registry);
    const graphB = createGraph(registry);
    createNode(graphA, 'a').addComponent({id: 'component-a', typeId: 'test.schema'});
    createNode(graphB, 'b').addComponent({id: 'component-b', typeId: 'test.schema'});
    assert.throws(() => registry.register({
        cardinality: COMPONENT_CARDINALITIES.ONE,
        ownerModuleId: 'test.schema-owner',
        schemaVersion: 2,
        typeId: 'test.schema'
    }, {replace: true}), error => (
        error &&
        error.code === 'RUNTIME_COMPONENT_SCHEMA_TRANSITION_IN_USE' &&
        error.instanceCount === 2
    ));
    graphA.dispose();
    graphB.dispose();
    assert.throws(() => registry.register({
        cardinality: COMPONENT_CARDINALITIES.ONE,
        ownerModuleId: 'test.schema-owner',
        schemaVersion: 0,
        typeId: 'test.schema'
    }, {replace: true}), error => error && (
        error.code === 'RUNTIME_COMPONENT_SCHEMA_VERSION_INVALID' ||
        error.code === 'RUNTIME_COMPONENT_SCHEMA_DOWNGRADE_FORBIDDEN'
    ));
    registry.register({
        cardinality: COMPONENT_CARDINALITIES.ONE,
        ownerModuleId: 'test.schema-owner',
        schemaVersion: 2,
        typeId: 'test.schema'
    }, {replace: true});
    assert.throws(() => registry.register({
        cardinality: COMPONENT_CARDINALITIES.ONE,
        ownerModuleId: 'test.schema-owner',
        schemaVersion: 1,
        typeId: 'test.schema'
    }, {replace: true}), error => (
        error && error.code === 'RUNTIME_COMPONENT_SCHEMA_DOWNGRADE_FORBIDDEN'
    ));
}

// Migration ownership is Descriptor-owner-bound and migration resources are released on unregister.
{
    const registry = createRegistry(3);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(registry, '_migrationBindings'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(registry, '_implicitTypeIds'), false);
    assert.throws(() => registry.bindMigration('test.schema', undefined, value => value, {
        ownerModuleId: 'test.schema-owner'
    }), error => error && error.code === 'RUNTIME_COMPONENT_MIGRATION_VERSION_INVALID');
    assert.throws(() => registry.bindMigration('test.schema', 1, value => value, {
        ownerModuleId: 'other.module'
    }), error => error && error.code === 'RUNTIME_COMPONENT_MIGRATION_OWNER_MISMATCH');
    bindCompleteMigration(registry);
    assert.deepStrictEqual(registry.listMigrations('test.schema').map(binding => binding.fromVersion), [1, 2]);
    assert.strictEqual(registry.unregister('test.schema'), true);
    assert.strictEqual(registry.listMigrations('test.schema').length, 0);
}

// A complete contiguous chain migrates detached records before Component construction.
{
    const registry = createRegistry(3);
    bindCompleteMigration(registry);
    const graph = createGraph(registry);
    const node = createNode(graph);
    node.addComponent({id: 'component', typeId: 'test.schema'});
    const oldState = graph.exportState();
    oldState.nodes[0].components[0].data = {original: true};
    oldState.nodes[0].components[0].schemaVersion = 1;
    graph.dispose();

    const migrated = assertRoundTrip(oldState, registry);
    const component = migrated.nodes[0].components[0];
    assert.strictEqual(component.schemaVersion, 3);
    assert.deepStrictEqual(component.data, {
        migratedTo2: true,
        migratedTo3: true,
        original: true
    });
    assert.deepStrictEqual(component.extensionData, {
        'test.schema-owner': {migrated: true}
    });
}

// Missing, throwing and invalid migration edges reject the full import without touching the active Graph.
{
    const baseRegistry = createRegistry(3);
    const baseGraph = createGraph(baseRegistry);
    const node = createNode(baseGraph);
    node.addComponent({id: 'component', typeId: 'test.schema'});
    const liveBefore = baseGraph.exportState();
    const oldState = clone(liveBefore);
    oldState.nodes[0].components[0].schemaVersion = 1;

    baseRegistry.bindMigration('test.schema', 1, ({data}) => ({data}), {
        ownerModuleId: 'test.schema-owner'
    });
    assert.throws(() => baseGraph.importState(oldState), error => (
        error &&
        error.code === 'RUNTIME_NODE_IMPORT_INVALID' &&
        error.errors.some(issue => issue.code === 'RUNTIME_COMPONENT_MIGRATION_PATH_MISSING')
    ));
    assert.deepStrictEqual(baseGraph.exportState(), liveBefore);
    baseGraph.dispose();

    const throwingRegistry = createRegistry(3);
    throwingRegistry.bindMigration('test.schema', 1, () => {
        throw new Error('provider failed');
    }, {ownerModuleId: 'test.schema-owner'});
    throwingRegistry.bindMigration('test.schema', 2, ({data}) => ({data}), {
        ownerModuleId: 'test.schema-owner'
    });
    assert.throws(() => RuntimeNodeGraph.createFromState(oldState, {
        componentTypeRegistry: throwingRegistry
    }), error => (
        error && error.errors.some(issue => issue.code === 'RUNTIME_COMPONENT_MIGRATION_FAILED')
    ));

    const invalidRegistry = createRegistry(3);
    invalidRegistry.bindMigration('test.schema', 1, ({data}) => ({
        data,
        ownerId: 'injected'
    }), {ownerModuleId: 'test.schema-owner'});
    invalidRegistry.bindMigration('test.schema', 2, ({data}) => ({data}), {
        ownerModuleId: 'test.schema-owner'
    });
    assert.throws(() => RuntimeNodeGraph.createFromState(oldState, {
        componentTypeRegistry: invalidRegistry
    }), error => (
        error && error.errors.some(issue => issue.code === 'RUNTIME_COMPONENT_MIGRATION_RESULT_INVALID')
    ));
}

// Future known versions enter persistence read-only preservation mode and do not overwrite project payload.
{
    const registry = createRegistry(3);
    const seedGraph = createGraph(registry);
    createNode(seedGraph).addComponent({id: 'component', typeId: 'test.schema'});
    const futureState = seedGraph.exportState();
    futureState.nodes[0].components[0].data = {future: true};
    futureState.nodes[0].components[0].schemaVersion = 9;
    seedGraph.dispose();

    let project = {
        activeSceneId: 'scene-a',
        extensionData: {runtimeNodeModel: futureState},
        scenes: [{id: 'scene-a', name: 'Scene A'}]
    };
    const originalProject = clone(project);
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
    const model = createRuntimeNodeModelService(sceneDataModel, {componentTypeRegistry: registry});
    const status = model.getImportStatus();
    assert.strictEqual(status.persistenceReadOnly, true);
    assert.strictEqual(status.persistenceReadOnlyReason, 'component-schema');
    assert.strictEqual(status.unsupportedComponentSchemas[0].recordVersion, 9);
    assert.throws(() => model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        sceneId: 'scene-a'
    }), error => error && error.code === 'RUNTIME_NODE_STATE_READ_ONLY');
    model.persistState();
    assert.deepStrictEqual(project, originalProject);
    model.dispose();
}

// Unknown types remain opaque and preserve their observed schemaVersion without owner-invented migration.
{
    const graph = new RuntimeNodeGraph({
        activeSceneId: 'scene-a',
        scenes: [{id: 'scene-a', name: 'Scene A'}]
    });
    createNode(graph).addComponent({
        data: {opaque: true},
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
    const first = graph.exportState();
    const rebuilt = RuntimeNodeGraph.createFromState(first, {
        componentTypeRegistry: graph.componentTypeRegistry
    }).graph;
    assert.deepStrictEqual(rebuilt.exportState(), first);
    assert.strictEqual(rebuilt.getNode('node').getComponentById('unknown').schemaVersion, 7);
    rebuilt.dispose();

    assert.throws(() => graph.componentTypeRegistry.register({
        cardinality: COMPONENT_CARDINALITIES.ONE,
        ownerModuleId: 'ngvge.runtime.compat.spoofed-explicit-owner',
        schemaVersion: 7,
        typeId: 'unknown.component'
    }, {replace: true}), error => (
        error && error.code === 'RUNTIME_COMPONENT_SCHEMA_VERSION_CONFLICT'
    ));
    olderNode.removeComponent('unknown-older');
    graph.componentTypeRegistry.register({
        cardinality: COMPONENT_CARDINALITIES.ONE,
        ownerModuleId: 'ngvge.runtime.compat.spoofed-explicit-owner',
        schemaVersion: 7,
        typeId: 'unknown.component'
    }, {replace: true});
    assert.strictEqual(graph.componentTypeRegistry.isImplicit('unknown.component'), false);
    assert.throws(() => olderNode.addComponent({
        id: 'after-promotion',
        schemaVersion: 2,
        typeId: 'unknown.component'
    }), error => error && error.code === 'RUNTIME_COMPONENT_SCHEMA_VERSION_CONFLICT');
    graph.dispose();
}

// Adoption compatibility checks schema before Resolver transfer; successful adoption retains migration guards.
{
    const registry = createRegistry(3);
    bindCompleteMigration(registry);
    const graph = createGraph(registry);
    createNode(graph).addComponent({id: 'component', typeId: 'test.schema'});
    const incompatibleRegistry = createRegistry(4);
    const replacement = createGraph(incompatibleRegistry);
    const originalResolverCount = registry.getDebugSnapshot().usageResolverCount;
    const replacementResolverCount = incompatibleRegistry.getDebugSnapshot().usageResolverCount;
    assert.throws(() => graph._adoptGraph(replacement), error => (
        error && error.code === 'RUNTIME_COMPONENT_SCHEMA_VERSION_CONFLICT'
    ));
    assert.strictEqual(graph.componentTypeRegistry, registry);
    assert.strictEqual(registry.getDebugSnapshot().usageResolverCount, originalResolverCount);
    assert.strictEqual(incompatibleRegistry.getDebugSnapshot().usageResolverCount, replacementResolverCount);
    replacement.dispose();

    const state = graph.exportState();
    assert.strictEqual(graph.importState(state).success, true);
    const adoptedRegistry = graph.componentTypeRegistry;
    assert.strictEqual(adoptedRegistry.getDebugSnapshot().usageResolverCount, 1);
    assert.throws(() => adoptedRegistry.register({
        cardinality: COMPONENT_CARDINALITIES.ONE,
        ownerModuleId: 'test.schema-owner',
        schemaVersion: 4,
        typeId: 'test.schema'
    }, {replace: true}), error => (
        error && error.code === 'RUNTIME_COMPONENT_SCHEMA_TRANSITION_IN_USE'
    ));
    assert.deepStrictEqual(graph.exportState(), state);
    graph.dispose();
    assert.strictEqual(adoptedRegistry.getDebugSnapshot().usageResolverCount, 0);
}

// Restricted Host capability exposes migration binding, not migration callbacks through portable state.
{
    let project = {
        activeSceneId: 'scene-a',
        extensionData: {},
        scenes: [{id: 'scene-a', name: 'Scene A'}]
    };
    const sceneDataModel = {
        getStatus: () => ({}),
        readProject: () => clone(project),
        subscribe: () => () => {},
        writeProject: nextProject => {
            project = clone(nextProject);
        }
    };
    const model = createRuntimeNodeModelService(sceneDataModel);
    const host = getRuntimeNodeModelHost(model);
    const registration = host.typeRegistrationCapability;
    assert.strictEqual(registration.version, '1.2');
    registration.registerComponentTypeDescriptor({
        cardinality: COMPONENT_CARDINALITIES.ONE,
        ownerModuleId: 'test.capability-owner',
        schemaVersion: 2,
        typeId: 'test.capability'
    });
    const unbind = registration.bindComponentMigration(
        'test.capability',
        1,
        ({data}) => ({data}),
        {ownerModuleId: 'test.capability-owner'}
    );
    assert.deepStrictEqual(registration.listComponentMigrations('test.capability'), [{
        fromVersion: 1,
        ownerModuleId: 'test.capability-owner',
        toVersion: 2,
        typeId: 'test.capability'
    }]);
    assert.strictEqual(typeof unbind, 'function');
    assert.strictEqual(unbind(), true);
    model.dispose();
}

const moduleSource = fs.readFileSync(path.join(__dirname, '../src/lib/scene-system/module-definition.js'), 'utf8');
assert(/version:\s*'0\.8\.9\.(?:4(?:\.1(?:\.[123456])?)?|5|6(?:\.1(?:\.1)?)?|7)'/.test(moduleSource));

console.log('NGVGE 0008.9.4 Component Schema Version and Migration Authority Freeze smoke passed.');
