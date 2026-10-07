#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    COMPONENT_CARDINALITIES,
    COMPONENT_LIFECYCLE_STATES,
    RuntimeComponent,
    RuntimeNodeGraph,
    createRuntimeNodeModelHost
} = require('../src/lib/runtime-nodes');

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

const createHost = () => createRuntimeNodeModelHost(createSceneDataModel());
const createNode = host => {
    const result = host.publicCapability.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'node',
        sceneId: 'scene-a'
    });
    assert.strictEqual(result.applied, true);
    assert.strictEqual(result.persisted, true);
};
const assertPersisted = result => {
    assert.strictEqual(result.applied, true);
    assert.strictEqual(result.persisted, true);
};
const assertHostRoundTrip = host => {
    const first = host.publicCapability.exportState();
    const imported = host.persistenceController.importState(first);
    assert.strictEqual(imported.applied, true);
    assert.strictEqual(imported.persisted, true);
    assert.deepStrictEqual(host.publicCapability.exportState(), first);
};
const assertGraphRoundTrip = graph => {
    const first = graph.exportState();
    const rebuilt = RuntimeNodeGraph.createFromState(first, {
        componentTypeRegistry: graph.componentTypeRegistry
    }).graph;
    assert.deepStrictEqual(rebuilt.exportState(), first);
    rebuilt.dispose();
};

// Implicit one -> explicit many is forbidden while the implicit type has a live instance.
{
    const host = createHost();
    const model = host.publicCapability;
    const registration = host.typeRegistrationCapability;
    createNode(host);
    assertPersisted(model.addComponent('node', {id: 'promoted-a', typeId: 'test.promoted'}));
    assert.throws(() => registration.registerComponentTypeDescriptor({
        cardinality: COMPONENT_CARDINALITIES.MANY,
        ownerModuleId: 'test.module',
        schemaVersion: 1,
        typeId: 'test.promoted'
    }), error => (
        error &&
        error.code === 'RUNTIME_COMPONENT_CARDINALITY_TRANSITION_IN_USE' &&
        error.existingCardinality === COMPONENT_CARDINALITIES.ONE &&
        error.nextCardinality === COMPONENT_CARDINALITIES.MANY &&
        error.instanceCount === 1
    ));
    assert.strictEqual(
        registration.getComponentTypeDescriptor('test.promoted').cardinality,
        COMPONENT_CARDINALITIES.ONE
    );
    const second = model.addComponent('node', {id: 'promoted-b', typeId: 'test.promoted'});
    assert.strictEqual(second.applied, false);
    assert.strictEqual(second.persisted, false);
    assert.strictEqual(second.error.code, 'RUNTIME_COMPONENT_CARDINALITY_VIOLATION');
    assertHostRoundTrip(host);
    host.localHostCapability.dispose();
}

// Explicit many -> explicit one is forbidden even when only one live instance currently exists.
{
    const host = createHost();
    const model = host.publicCapability;
    const registration = host.typeRegistrationCapability;
    registration.registerComponentTypeDescriptor({
        cardinality: COMPONENT_CARDINALITIES.MANY,
        ownerModuleId: 'test.module',
        schemaVersion: 1,
        typeId: 'test.explicit-many'
    });
    createNode(host);
    assertPersisted(model.addComponent('node', {id: 'many-a', typeId: 'test.explicit-many'}));
    assert.throws(() => registration.registerComponentTypeDescriptor({
        cardinality: COMPONENT_CARDINALITIES.ONE,
        ownerModuleId: 'test.module',
        schemaVersion: 1,
        typeId: 'test.explicit-many'
    }, {replace: true}), error => (
        error &&
        error.code === 'RUNTIME_COMPONENT_CARDINALITY_TRANSITION_IN_USE' &&
        error.instanceCount === 1
    ));
    assert.strictEqual(
        registration.getComponentTypeDescriptor('test.explicit-many').cardinality,
        COMPONENT_CARDINALITIES.MANY
    );
    assertPersisted(model.addComponent('node', {id: 'many-b', typeId: 'test.explicit-many'}));
    assertHostRoundTrip(host);
    host.localHostCapability.dispose();
}

// A descriptor cannot be unregistered and rebound to another cardinality until all instances are removed.
{
    const host = createHost();
    const model = host.publicCapability;
    const registration = host.typeRegistrationCapability;
    registration.registerComponentTypeDescriptor({
        cardinality: COMPONENT_CARDINALITIES.ONE,
        ownerModuleId: 'test.module',
        schemaVersion: 1,
        typeId: 'test.rebind'
    });
    createNode(host);
    assertPersisted(model.addComponent('node', {id: 'rebind-one', typeId: 'test.rebind'}));
    assert.throws(() => registration.unregisterComponentTypeDescriptor('test.rebind'), error => (
        error &&
        error.code === 'RUNTIME_COMPONENT_TYPE_DESCRIPTOR_IN_USE' &&
        error.instanceCount === 1
    ));
    assert.strictEqual(registration.getComponentTypeDescriptor('test.rebind').cardinality, COMPONENT_CARDINALITIES.ONE);
    assertHostRoundTrip(host);

    assertPersisted(model.removeComponent('node', 'rebind-one'));
    assert.strictEqual(registration.unregisterComponentTypeDescriptor('test.rebind'), true);
    registration.registerComponentTypeDescriptor({
        cardinality: COMPONENT_CARDINALITIES.MANY,
        ownerModuleId: 'test.module',
        schemaVersion: 1,
        typeId: 'test.rebind'
    });
    assertPersisted(model.addComponent('node', {id: 'rebind-many-a', typeId: 'test.rebind'}));
    assertPersisted(model.addComponent('node', {id: 'rebind-many-b', typeId: 'test.rebind'}));
    assertHostRoundTrip(host);
    host.localHostCapability.dispose();
}

// A preconstructed RuntimeComponent cannot carry a cardinality different from the Graph descriptor.
{
    const graph = new RuntimeNodeGraph({
        activeSceneId: 'scene-a',
        scenes: [{id: 'scene-a', name: 'Scene A'}]
    });
    graph.componentTypeRegistry.register({
        cardinality: COMPONENT_CARDINALITIES.MANY,
        ownerModuleId: 'test.module',
        schemaVersion: 1,
        typeId: 'test.preconstructed'
    });
    const node = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {id: 'node', sceneId: 'scene-a'});
    const component = new RuntimeComponent({
        id: 'preconstructed',
        typeId: 'test.preconstructed'
    }, {cardinality: COMPONENT_CARDINALITIES.ONE});
    assert.throws(() => node.addComponent(component), error => (
        error &&
        error.code === 'RUNTIME_COMPONENT_CARDINALITY_CONFLICT' &&
        error.componentCardinality === COMPONENT_CARDINALITIES.ONE &&
        error.descriptorCardinality === COMPONENT_CARDINALITIES.MANY
    ));
    assert.strictEqual(component.ownerId, null);
    assert.strictEqual(component.state, COMPONENT_LIFECYCLE_STATES.CREATED);
    assert.strictEqual(node.getComponents('test.preconstructed').length, 0);
    assertGraphRoundTrip(graph);
    graph.dispose();
}

// Direct local registry operations are guarded by the same Graph-bound authority checks.
{
    const graph = new RuntimeNodeGraph({
        activeSceneId: 'scene-a',
        scenes: [{id: 'scene-a', name: 'Scene A'}]
    });
    const node = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {id: 'node', sceneId: 'scene-a'});
    node.addComponent({id: 'local', typeId: 'test.local-guard'});
    assert.throws(() => graph.componentTypeRegistry.register({
        cardinality: COMPONENT_CARDINALITIES.MANY,
        ownerModuleId: 'test.module',
        schemaVersion: 1,
        typeId: 'test.local-guard'
    }, {replace: true}), error => error && error.code === 'RUNTIME_COMPONENT_CARDINALITY_TRANSITION_IN_USE');
    assert.throws(() => graph.componentTypeRegistry.unregister('test.local-guard'), error => (
        error && error.code === 'RUNTIME_COMPONENT_TYPE_DESCRIPTOR_IN_USE'
    ));
    assertGraphRoundTrip(graph);
    graph.dispose();
}

const moduleSource = fs.readFileSync(path.join(__dirname, '../src/lib/scene-system/module-definition.js'), 'utf8');
assert(/version:\s*'(?:0\.8\.9\.3\.1\.[12]|0\.8\.9\.(?:4(?:\.1(?:\.[123456])?)?|5|6(?:\.1(?:\.1)?)?|7))'/.test(moduleSource));

console.log('NGVGE 0008.9.3.1.1 Component Cardinality Authority Transition Hotfix smoke passed.');
