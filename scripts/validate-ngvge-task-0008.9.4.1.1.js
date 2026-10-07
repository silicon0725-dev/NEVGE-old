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
    createModuleManager
} = require('../src/lib/first-party-modules');
const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    RuntimeNodeGraph,
    createRuntimeComponentTypeRegistry
} = require('../src/lib/runtime-nodes');

const scene = {id: 'scene-a', name: 'Scene A'};
const clone = value => JSON.parse(JSON.stringify(value));

const createManifest = (id, dependencies = []) => ({
    apiVersion: '1',
    availability: MODULE_AVAILABILITY.AVAILABLE,
    capabilities: [],
    defaultEnabled: false,
    dependencies: dependencies.map(dependencyId => ({id: dependencyId, optional: false})),
    description: `${id} validation module.`,
    id,
    kind: MODULE_KINDS.FIRST_PARTY,
    name: id,
    permissions: [],
    version: '1'
});

const createMigrationSnapshot = () => ({
    activeSceneId: scene.id,
    nodes: [{
        components: [{
            allowMultiple: false,
            data: {legacy: true},
            enabled: true,
            extensionData: {},
            id: 'candidate-component',
            schemaVersion: 1,
            typeId: 'test.live-state'
        }],
        enabled: true,
        id: 'candidate-node',
        metadata: {},
        name: 'Candidate',
        parentId: null,
        sceneId: scene.id,
        scope: 'scene',
        source: {},
        typeId: BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE
    }],
    scenes: [scene],
    version: 1
});

// Captured live Node / Component references cannot bypass the Registry-lineage migration guard.
{
    const registry = createRuntimeComponentTypeRegistry([{
        cardinality: 'one',
        ownerModuleId: 'test.live-state-owner',
        schemaVersion: 2,
        typeId: 'test.live-state'
    }]);
    const activeGraph = new RuntimeNodeGraph({
        activeSceneId: scene.id,
        componentTypeRegistry: registry,
        scenes: [scene]
    });
    const capturedNode = activeGraph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'victim',
        metadata: {nested: {safe: true}},
        name: 'Victim',
        sceneId: scene.id,
        source: {origin: {safe: true}}
    });
    const capturedComponent = capturedNode.addComponent({
        data: {nested: {safe: true}, value: 1},
        extensionData: {test: {safe: true}},
        id: 'victim-component',
        typeId: 'test.live-state'
    });
    const beforeGraph = clone(activeGraph.exportState());
    const beforeDescriptors = clone(registry.list());
    const rejectionCodes = [];

    registry.bindMigration('test.live-state', 1, ({data}) => {
        const attempts = [
            () => { capturedNode.name = 'MUTATED'; },
            () => { capturedNode.metadata.hacked = true; },
            () => { capturedNode.metadata.nested.safe = false; },
            () => { Object.getOwnPropertyDescriptor(capturedNode.metadata, 'nested').value.safe = false; },
            () => { capturedNode.source.origin.safe = false; },
            () => { capturedNode.childIds.push('forged-child'); },
            () => { capturedNode.enabledSelf = false; },
            () => { capturedNode.parentId = 'forged-parent'; },
            () => { capturedNode.state = 'destroyed'; },
            () => { capturedComponent.data.value = 999; },
            () => { capturedComponent.data.nested.safe = false; },
            () => { capturedComponent.enabled = false; },
            () => { capturedComponent.activeInHierarchy = false; },
            () => { capturedComponent.state = 'destroyed'; },
            () => { capturedComponent._extensionData.test.safe = false; },
            () => { capturedNode._bindGraph(null); },
            () => { capturedNode._replaceGraphBinding(null); },
            () => { capturedNode.components._replaceGraphBinding(null); },
            () => { capturedComponent._replaceGraphBinding(null); }
        ];
        attempts.forEach(attempt => {
            try {
                attempt();
            } catch (error) {
                rejectionCodes.push(error && error.code);
            }
        });
        return {data: Object.assign({}, data, {migrated: true})};
    }, {ownerModuleId: 'test.live-state-owner'});
    const beforeMigrations = clone(registry.listMigrations());

    assert.throws(() => RuntimeNodeGraph.createFromState(createMigrationSnapshot(), {
        componentTypeRegistry: registry
    }), error => (
        error && Array.isArray(error.errors) &&
        error.errors.some(issue => issue.code === 'RUNTIME_COMPONENT_MIGRATION_REENTRANT_MUTATION')
    ));
    assert.strictEqual(rejectionCodes.length, 19);
    rejectionCodes.forEach(code => {
        assert.strictEqual(code, 'RUNTIME_COMPONENT_MIGRATION_REENTRANT_MUTATION');
    });
    assert.deepStrictEqual(clone(activeGraph.exportState()), beforeGraph);
    assert.deepStrictEqual(clone(registry.list()), beforeDescriptors);
    assert.deepStrictEqual(clone(registry.listMigrations()), beforeMigrations);
    assert.strictEqual(capturedNode._graph, undefined);
    assert.strictEqual(capturedNode.components.graph, undefined);
    assert.strictEqual(capturedComponent._graph, undefined);
    assert.throws(
        () => capturedNode._replaceGraphBinding(null),
        error => error && error.code === 'RUNTIME_NODE_INTERNAL_AUTHORITY_REQUIRED'
    );
    assert.throws(
        () => capturedNode.components._replaceGraphBinding(null),
        error => error && error.code === 'RUNTIME_COMPONENT_INTERNAL_AUTHORITY_REQUIRED'
    );
    assert.throws(
        () => capturedComponent._replaceGraphBinding(null),
        error => error && error.code === 'RUNTIME_COMPONENT_INTERNAL_AUTHORITY_REQUIRED'
    );
    assert.throws(() => {
        capturedNode._graph = null;
    }, TypeError);
    assert.throws(() => {
        capturedNode.components.graph = null;
    }, TypeError);
    assert.throws(() => {
        capturedComponent._graph = null;
    }, TypeError);
    assert.throws(() => {
        Object.defineProperty(capturedNode, 'toPersistentRecord', {value: () => ({id: 'forged'})});
    }, TypeError);
    assert.throws(() => {
        Object.defineProperty(capturedNode.components, 'toPersistentRecords', {value: () => []});
    }, TypeError);
    activeGraph.dispose();
}

// A dependent enable failure cannot strand an already registration-complete dependency.
{
    const manager = createModuleManager();
    let coreCompletionCount = 0;
    manager.registerModule({
        manifest: createManifest('test.enable-core'),
        hooks: {
            completeEnable: context => {
                coreCompletionCount += 1;
                context.capabilities.provide('test.runtime-capability', Object.freeze({ready: true}));
            },
            enable: context => {
                context.capabilities.provide('test.registration-capability', Object.freeze({ready: true}));
            }
        }
    });
    manager.registerModule({
        manifest: createManifest('test.enable-failure', ['test.enable-core']),
        hooks: {
            enable: () => {
                throw new Error('dependent enable failure');
            }
        }
    });

    assert.throws(() => manager.enableModule('test.enable-failure'), /dependent enable failure/);
    const coreState = manager.getModuleState('test.enable-core');
    const failedState = manager.getModuleState('test.enable-failure');
    assert.strictEqual(coreState.enabled, true);
    assert.strictEqual(coreState.enableCompletion, 'completed');
    assert.strictEqual(coreState.state, 'enabled');
    assert.strictEqual(coreCompletionCount, 1);
    assert(manager.getCapability('test.registration-capability'));
    assert(manager.getCapability('test.runtime-capability'));
    assert.strictEqual(failedState.enabled, false);
    assert.strictEqual(failedState.enableCompletion, 'failed');
    assert.strictEqual(failedState.state, 'error');
    assert.strictEqual(manager.enableModule('test.enable-core'), true);
    assert.strictEqual(coreCompletionCount, 1);
    manager.dispose();
}

// completeEnable failure rolls back the failed dependency and pending dependents, then permits retry.
{
    const manager = createModuleManager();
    let failCompletion = true;
    let coreEnableCount = 0;
    let dependentEnableCount = 0;
    manager.registerModule({
        manifest: createManifest('test.completion-core'),
        hooks: {
            completeEnable: context => {
                if (failCompletion) throw new Error('completeEnable failure');
                context.capabilities.provide('test.completed-runtime', Object.freeze({ready: true}));
            },
            enable: context => {
                coreEnableCount += 1;
                context.capabilities.provide('test.pending-registration', Object.freeze({ready: true}));
            }
        }
    });
    manager.registerModule({
        manifest: createManifest('test.completion-dependent', ['test.completion-core']),
        hooks: {
            enable: () => {
                dependentEnableCount += 1;
            }
        }
    });

    assert.throws(() => manager.enableModule('test.completion-dependent'), /completeEnable failure/);
    ['test.completion-core', 'test.completion-dependent'].forEach(moduleId => {
        const state = manager.getModuleState(moduleId);
        assert.strictEqual(state.enabled, false);
        assert.strictEqual(state.enableCompletion, 'failed');
        assert.strictEqual(state.state, 'error');
    });
    assert.strictEqual(manager.getCapability('test.pending-registration'), null);
    assert.strictEqual(manager.getCapability('test.completed-runtime'), null);

    failCompletion = false;
    assert.strictEqual(manager.enableModule('test.completion-dependent'), true);
    ['test.completion-core', 'test.completion-dependent'].forEach(moduleId => {
        const state = manager.getModuleState(moduleId);
        assert.strictEqual(state.enabled, true);
        assert.strictEqual(state.enableCompletion, 'completed');
        assert.strictEqual(state.state, 'enabled');
    });
    assert(manager.getCapability('test.pending-registration'));
    assert(manager.getCapability('test.completed-runtime'));
    assert.strictEqual(coreEnableCount, 2);
    assert.strictEqual(dependentEnableCount, 2);
    manager.dispose();
}

Module._load = originalLoad;
console.log('NGVGE TASK 0008.9.4.1.1 live-state isolation and enable-batch recovery validation passed.');
