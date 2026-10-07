#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    RUNTIME_COMPONENT_CONTRACT,
    RuntimeNodeGraph,
    createRuntimeNodeModelHost
} = require('../src/lib/runtime-nodes');
const clone = value => JSON.parse(JSON.stringify(value));
const createSceneDataModel = () => {
    let project = {activeSceneId: 'scene-a', extensionData: {}, scenes: [{id: 'scene-a', name: 'Scene A'}]};
    const listeners = new Set();
    return {
        getProject: () => clone(project), getStatus: () => ({readOnly: false}), readProject: () => clone(project),
        subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
        writeProject: next => { project = clone(next); listeners.forEach(listener => listener({type: 'data'})); }
    };
};
assert.strictEqual(RUNTIME_COMPONENT_CONTRACT.contractVersion, '1');
assert.strictEqual(RUNTIME_COMPONENT_CONTRACT.identity.uniqueWithinOwnerNode, true);
assert.strictEqual(RUNTIME_COMPONENT_CONTRACT.ownership.nodeDetachDoesNotDetachComponent, true);
const graph = new RuntimeNodeGraph({activeSceneId: 'scene-a', scenes: [{id: 'scene-a', name: 'Scene A'}]});
const a = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {id: 'node-a', sceneId: 'scene-a'});
const b = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {id: 'node-b', sceneId: 'scene-a'});
const component = graph.addComponent(a.id, {
    id: 'component-stable', typeId: 'test.component', schemaVersion: 2,
    data: {nested: {value: 1}}, enabled: true
});
assert.strictEqual(component.ownerId, a.id);
assert.strictEqual(component.schemaVersion, 2);
assert.strictEqual(component.allowMultiple, false);
graph.addComponent(b.id, {
    id: 'component-stable', typeId: 'test.other', data: {}
});
assert.throws(() => graph.addComponent(a.id, {
    id: 'component-stable', typeId: 'test.other', data: {}
}), error => /component id already exists/.test(error.message));
graph.detachNode(a.id);
assert.strictEqual(component.ownerId, a.id);
assert.notStrictEqual(component.state, 'detached');
const record = component.toPersistentRecord();
assert.deepStrictEqual(Object.keys(record).sort(), ['allowMultiple', 'data', 'enabled', 'id', 'schemaVersion', 'typeId']);
assert.strictEqual(Object.prototype.hasOwnProperty.call(record, 'ownerId'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(record, 'state'), false);
const exported = graph.exportState();
const imported = RuntimeNodeGraph.createFromState(exported).graph;
const importedComponent = imported.getNode(a.id).getComponentById(component.id);
assert.strictEqual(importedComponent.id, component.id);
assert.strictEqual(importedComponent.schemaVersion, 2);
assert.deepStrictEqual(importedComponent.data, {nested: {value: 1}});
assert.throws(() => RuntimeNodeGraph.createFromState({
    version: 1, activeSceneId: 'scene-a', scenes: [{id: 'scene-a', name: 'Scene A'}], nodes: [
        {id: 'x', typeId: 'ngvge.node', name: 'X', scope: 'scene', sceneId: 'scene-a', parentId: 'runtime-node:scene-root:scene-a', components: [
            {id: 'dup', typeId: 'a', data: {}}, {id: 'dup', typeId: 'b', data: {}}
        ]}
    ]
}), error => error && error.code === 'RUNTIME_NODE_IMPORT_INVALID');
const host = createRuntimeNodeModelHost(createSceneDataModel());
const model = host.publicCapability;
assert.strictEqual(model.getApiContract().componentContract.contractId, 'ngvge.runtime-component');
const nodeResult = model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {id: 'api-node', sceneId: 'scene-a'});
assert.strictEqual(nodeResult.applied, true);
const addResult = model.addComponent('api-node', {id: 'api-component', typeId: 'test.api', schemaVersion: 3, data: {value: 4}});
assert.strictEqual(addResult.applied, true);
assert.strictEqual(addResult.snapshot.schemaVersion, 3);
assert.strictEqual(Object.isFrozen(addResult.snapshot), true);
assert.strictEqual(Object.isFrozen(addResult.snapshot.data), true);
const before = model.getComponentSnapshot('api-node', 'api-component');
try { before.data.value = 99; } catch (e) { /* frozen */ }
assert.strictEqual(model.getComponentSnapshot('api-node', 'api-component').data.value, 4);
assert.strictEqual(model.addComponent('api-node', {typeId: 'bad', schemaVersion: 0, data: {}}).applied, false);
const moduleSource = fs.readFileSync(path.join(__dirname, '../src/lib/scene-system/module-definition.js'), 'utf8');
assert(/version:\s*'(?:0\.8\.9\.3(?:\.1(?:\.[1234])?)?|0\.8\.9\.(?:4(?:\.1(?:\.[123456])?)?|5|6(?:\.1(?:\.1)?)?|7))'/.test(moduleSource));
host.localHostCapability.dispose();
console.log('NGVGE 0008.9.3 Component Boundary Freeze smoke passed.');
