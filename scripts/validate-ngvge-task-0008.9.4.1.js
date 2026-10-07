#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;
class FakeZip {
    file () { return this; }
    folder () { return this; }
    async generateAsync () { return Buffer.from(''); }
    static async loadAsync () { return new FakeZip(); }
}
Module._load = function (request, parent, isMain) {
    if (request === '@turbowarp/jszip') return FakeZip;
    return originalLoad(request, parent, isMain);
};

const {
    MODULE_AVAILABILITY,
    MODULE_KINDS,
    MODULE_PERMISSIONS,
    createModuleManager,
    registerBuiltInModules
} = require('../src/lib/first-party-modules');
const {
    RUNTIME_NODE_MODEL_CAPABILITY_ID,
    RUNTIME_NODE_TYPE_REGISTRATION_CAPABILITY_ID,
    SCENE_SYSTEM_MODULE_ID
} = require('../src/lib/scene-system');
const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    RuntimeNodeGraph,
    createRuntimeComponentTypeRegistry,
    createRuntimeNodeModelHost
} = require('../src/lib/runtime-nodes');

const clone = value => JSON.parse(JSON.stringify(value));
const scene = {id: 'scene-a', name: 'Scene A'};

const createNodeRecord = components => ({
    components,
    enabled: true,
    id: 'node-a',
    metadata: {},
    name: 'Node A',
    parentId: null,
    sceneId: scene.id,
    scope: 'scene',
    typeId: BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE
});

const createComponentRecord = (typeId, schemaVersion, data = {}) => ({
    allowMultiple: false,
    data,
    enabled: true,
    extensionData: {},
    id: 'component-a',
    schemaVersion,
    typeId
});

const createSnapshot = component => ({
    activeSceneId: scene.id,
    nodes: [createNodeRecord([component])],
    scenes: [scene],
    version: 1
});

// Fresh Registry import must preserve the private implicit Descriptor authority.
{
    const source = new RuntimeNodeGraph({activeSceneId: scene.id, scenes: [scene]});
    source.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'node-a',
        sceneId: scene.id
    }).addComponent({
        data: {opaque: true},
        id: 'component-a',
        schemaVersion: 7,
        typeId: 'test.fresh-unknown'
    });
    const state = source.exportState();
    source.dispose();

    const freshRegistry = createRuntimeComponentTypeRegistry();
    const rebuilt = RuntimeNodeGraph.createFromState(state, {
        componentTypeRegistry: freshRegistry
    }).graph;
    assert.strictEqual(rebuilt.componentTypeRegistry.isImplicit('test.fresh-unknown'), true);
    assert.strictEqual(
        rebuilt.componentTypeRegistry.get('test.fresh-unknown').ownerModuleId,
        'ngvge.runtime.compat.import'
    );
    rebuilt.componentTypeRegistry.register({
        cardinality: 'one',
        ownerModuleId: 'test.real-owner',
        schemaVersion: 7,
        typeId: 'test.fresh-unknown'
    }, {replace: true});
    assert.strictEqual(rebuilt.componentTypeRegistry.isImplicit('test.fresh-unknown'), false);
    assert.strictEqual(
        rebuilt.componentTypeRegistry.get('test.fresh-unknown').ownerModuleId,
        'test.real-owner'
    );
    rebuilt.dispose();
}

// A migration clone and every active Graph bound to its Registry lineage share one execution guard.
{
    const registry = createRuntimeComponentTypeRegistry([{
        cardinality: 'one',
        ownerModuleId: 'test.guard-owner',
        schemaVersion: 2,
        typeId: 'test.guard'
    }]);
    const activeGraph = new RuntimeNodeGraph({
        activeSceneId: scene.id,
        componentTypeRegistry: registry,
        scenes: [scene]
    });
    activeGraph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'victim',
        sceneId: scene.id
    });

    let project = {activeSceneId: scene.id, extensionData: {}, scenes: [scene]};
    const listeners = new Set();
    const host = createRuntimeNodeModelHost({
        getStatus: () => ({}),
        readProject: () => clone(project),
        subscribe: listener => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        writeProject: nextProject => {
            project = clone(nextProject);
            listeners.forEach(listener => listener({type: 'data'}));
            return clone(project);
        }
    }, {componentTypeRegistry: registry});

    const attempts = {};
    let unbind = null;
    unbind = registry.bindMigration('test.guard', 1, ({data}) => {
        try {
            activeGraph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
                id: 'side-effect',
                sceneId: scene.id
            });
        } catch (error) {
            attempts.graph = error.code;
        }
        try {
            registry.register({
                cardinality: 'one',
                ownerModuleId: 'test.guard-owner',
                schemaVersion: 2,
                typeId: 'test.guard'
            }, {replace: true});
        } catch (error) {
            attempts.registry = error.code;
        }
        try {
            unbind();
        } catch (error) {
            attempts.unbind = error.code;
        }
        const mutation = host.publicCapability.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'public-side-effect',
            sceneId: scene.id
        });
        attempts.publicMutation = mutation.error && mutation.error.code;
        return {data: Object.assign({}, data, {migrated: true})};
    }, {ownerModuleId: 'test.guard-owner'});

    const beforeGraph = activeGraph.exportState();
    const beforeModel = host.publicCapability.exportState();
    const beforeDescriptors = clone(registry.list());
    const beforeMigrations = clone(registry.listMigrations());
    assert.throws(() => RuntimeNodeGraph.createFromState(
        createSnapshot(createComponentRecord('test.guard', 1, {old: true})),
        {componentTypeRegistry: registry}
    ), error => (
        error && Array.isArray(error.errors) &&
        error.errors.some(issue => issue.code === 'RUNTIME_COMPONENT_MIGRATION_REENTRANT_MUTATION')
    ));
    assert.deepStrictEqual(attempts, {
        graph: 'RUNTIME_COMPONENT_MIGRATION_REENTRANT_MUTATION',
        publicMutation: 'RUNTIME_COMPONENT_MIGRATION_REENTRANT_MUTATION',
        registry: 'RUNTIME_COMPONENT_MIGRATION_REENTRANT_MUTATION',
        unbind: 'RUNTIME_COMPONENT_MIGRATION_REENTRANT_MUTATION'
    });
    assert.deepStrictEqual(activeGraph.exportState(), beforeGraph);
    assert.deepStrictEqual(host.publicCapability.exportState(), beforeModel);
    assert.deepStrictEqual(clone(registry.list()), beforeDescriptors);
    assert.deepStrictEqual(clone(registry.listMigrations()), beforeMigrations);
    assert.strictEqual(activeGraph.getNode('side-effect'), null);
    assert.strictEqual(host.publicCapability.getNode('public-side-effect'), null);
    host.dispose();
    activeGraph.dispose();
}

// Real module startup: registration capability is available before Scene restore, Runtime Model after it.
{
    const providerModuleId = 'test.schema-bootstrap';
    const manager = createModuleManager();
    registerBuiltInModules(manager);
    let completeEnableObservedMigratedState = false;
    let deserializeObservedMigratedState = false;
    manager.registerModule({
        manifest: {
            apiVersion: '1',
            availability: MODULE_AVAILABILITY.AVAILABLE,
            capabilities: [],
            defaultEnabled: false,
            dependencies: [SCENE_SYSTEM_MODULE_ID],
            description: 'Schema bootstrap validation provider.',
            id: providerModuleId,
            kind: MODULE_KINDS.FIRST_PARTY,
            name: 'Schema Bootstrap Validation',
            permissions: [MODULE_PERMISSIONS.RUNTIME, MODULE_PERMISSIONS.SERIALIZATION],
            version: '1'
        },
        hooks: {
            completeEnable: context => {
                const model = context.capabilities.require(RUNTIME_NODE_MODEL_CAPABILITY_ID);
                const component = model.getComponent('node-a', 'component-a');
                completeEnableObservedMigratedState = Boolean(
                    component && component.schemaVersion === 2 && component.data.migrated === true
                );
            },
            deserializeProject: (context) => {
                const model = context.capabilities.require(RUNTIME_NODE_MODEL_CAPABILITY_ID);
                const component = model.getComponent('node-a', 'component-a');
                deserializeObservedMigratedState = Boolean(
                    component && component.schemaVersion === 2 && component.data.migrated === true
                );
            },
            enable: context => {
                assert.strictEqual(context.capabilities.get(RUNTIME_NODE_MODEL_CAPABILITY_ID), null);
                const registration = context.capabilities.require(
                    RUNTIME_NODE_TYPE_REGISTRATION_CAPABILITY_ID
                );
                registration.registerComponentTypeDescriptor({
                    cardinality: 'one',
                    ownerModuleId: providerModuleId,
                    schemaVersion: 2,
                    typeId: 'module.comp'
                });
                registration.bindComponentMigration('module.comp', 1, ({data}) => ({
                    data: Object.assign({}, data, {migrated: true})
                }), {ownerModuleId: providerModuleId});
            }
        }
    });
    manager.initializeAll();
    manager.enableDefaults({silent: true});

    const storedRuntimeState = createSnapshot(createComponentRecord('module.comp', 1, {old: true}));
    manager.deserializeProject({
        frameworkVersion: 1,
        moduleData: {
            [SCENE_SYSTEM_MODULE_ID]: {
                activeSceneId: scene.id,
                extensionData: {runtimeNodeModel: storedRuntimeState},
                scenes: [{id: scene.id, name: scene.name, snapshot: null, variables: []}],
                schemaVersion: 1,
                variables: []
            }
        },
        modules: {
            [SCENE_SYSTEM_MODULE_ID]: {enabled: true, version: '0.8.9.4.1'},
            [providerModuleId]: {enabled: true, version: '1'}
        }
    });

    const model = manager.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID);
    assert(model);
    assert.strictEqual(completeEnableObservedMigratedState, true);
    assert.strictEqual(deserializeObservedMigratedState, true);
    assert.deepStrictEqual(model.getComponent('node-a', 'component-a').data, {
        migrated: true,
        old: true
    });
    assert.strictEqual(model.getComponent('node-a', 'component-a').schemaVersion, 2);
    assert.strictEqual(model.getImportStatus().error, null);
    manager.dispose();
}

Module._load = originalLoad;
console.log('NGVGE TASK 0008.9.4.1 migration bootstrap and execution isolation validation passed.');
