#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    COMPONENT_CARDINALITIES,
    RuntimeNodeGraph,
    createRuntimeComponentTypeRegistry
} = require('../src/lib/runtime-nodes');

const createRegistry = cardinality => createRuntimeComponentTypeRegistry([{
    cardinality,
    ownerModuleId: 'test.module',
    schemaVersion: 1,
    typeId: 'test.binding'
}]);

const assertGraphRoundTrip = graph => {
    const first = graph.exportState();
    const rebuilt = RuntimeNodeGraph.createFromState(first, {
        componentTypeRegistry: graph.componentTypeRegistry
    }).graph;
    assert.deepStrictEqual(rebuilt.exportState(), first);
    rebuilt.dispose();
};

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

const bindingDescriptor = Object.getOwnPropertyDescriptor(graph, 'componentTypeRegistry');
assert(bindingDescriptor);
assert.strictEqual(bindingDescriptor.configurable, false);
assert.strictEqual(bindingDescriptor.enumerable, true);
assert.strictEqual(typeof bindingDescriptor.get, 'function');
assert.strictEqual(typeof bindingDescriptor.set, 'function');
assert.strictEqual(registryA.getDebugSnapshot().usageResolverCount, 1);
assert.strictEqual(registryB.getDebugSnapshot().usageResolverCount, 0);

// Direct field replacement is rejected before the active binding changes.
assert.throws(() => {
    graph.componentTypeRegistry = registryB;
}, error => error && error.code === 'RUNTIME_COMPONENT_TYPE_REGISTRY_REPLACEMENT_FORBIDDEN');
assert.strictEqual(graph.componentTypeRegistry, registryA);
assert.strictEqual(registryA.getDebugSnapshot().usageResolverCount, 1);
assert.strictEqual(registryB.getDebugSnapshot().usageResolverCount, 0);

// The internal-looking method is also authority-gated; ordinary local code cannot call it.
assert.throws(() => graph._replaceComponentTypeRegistry(registryB), error => (
    error && error.code === 'RUNTIME_COMPONENT_TYPE_REGISTRY_REPLACEMENT_FORBIDDEN'
));
assert.strictEqual(graph.componentTypeRegistry, registryA);
assert.strictEqual(registryA.getDebugSnapshot().usageResolverCount, 1);
assert.strictEqual(registryB.getDebugSnapshot().usageResolverCount, 0);
assert.throws(() => node.addComponent({id: 'b', typeId: 'test.binding'}), error => (
    error && error.code === 'RUNTIME_COMPONENT_CARDINALITY_VIOLATION'
));
assertGraphRoundTrip(graph);

// Import adopts a shadow Graph through the private authority path and transfers resolver ownership atomically.
const beforeAdoptionRegistry = graph.componentTypeRegistry;
const snapshot = graph.exportState();
const imported = graph.importState(snapshot);
assert.strictEqual(imported.success, true);
assert.deepStrictEqual(graph.exportState(), snapshot);
const afterAdoptionRegistry = graph.componentTypeRegistry;
assert.notStrictEqual(afterAdoptionRegistry, beforeAdoptionRegistry);
assert.strictEqual(beforeAdoptionRegistry.getDebugSnapshot().usageResolverCount, 0);
assert.strictEqual(afterAdoptionRegistry.getDebugSnapshot().usageResolverCount, 1);
assert.throws(() => afterAdoptionRegistry.register({
    cardinality: COMPONENT_CARDINALITIES.MANY,
    ownerModuleId: 'test.module',
    schemaVersion: 1,
    typeId: 'test.binding'
}, {replace: true}), error => (
    error &&
    error.code === 'RUNTIME_COMPONENT_CARDINALITY_TRANSITION_IN_USE' &&
    error.instanceCount === 1
));
assertGraphRoundTrip(graph);

graph.dispose();
assert.strictEqual(afterAdoptionRegistry.getDebugSnapshot().usageResolverCount, 0);

const moduleSource = fs.readFileSync(path.join(__dirname, '../src/lib/scene-system/module-definition.js'), 'utf8');
assert(/version:\s*'(?:0\.8\.9\.3\.1\.2|0\.8\.9\.(?:4(?:\.1(?:\.[123456])?)?|5|6(?:\.1(?:\.1)?)?|7))'/.test(moduleSource));

console.log('NGVGE 0008.9.3.1.2 Component Registry Binding Ownership Closure smoke passed.');
