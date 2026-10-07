#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    COMPONENT_CARDINALITIES,
    LEGACY_COMPONENT_EXTENSION_NAMESPACE,
    RUNTIME_COMPONENT_CONTRACT,
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

assert.strictEqual(RUNTIME_COMPONENT_CONTRACT.identity.componentIdImmutable, true);
assert.strictEqual(RUNTIME_COMPONENT_CONTRACT.identity.schemaVersionImmutable, true);
assert.strictEqual(RUNTIME_COMPONENT_CONTRACT.cardinality.authority, 'component-type-descriptor');
assert.strictEqual(RUNTIME_COMPONENT_CONTRACT.persistence.extensionDataNamespaced, true);

// Canonical one/many cardinality and round-trip stability.
const graph = new RuntimeNodeGraph({activeSceneId: 'scene-a', scenes: [{id: 'scene-a', name: 'Scene A'}]});
graph.componentTypeRegistry.register({
    cardinality: COMPONENT_CARDINALITIES.MANY,
    ownerModuleId: 'test.module',
    schemaVersion: 3,
    typeId: 'test.tags'
});
const node = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {id: 'node-a', sceneId: 'scene-a'});
const single = node.addComponent({
    data: {value: 1},
    enabled: false,
    id: 'single',
    schemaVersion: 3,
    typeId: 'test.single'
});
node.addComponent({data: {tag: 'a'}, id: 'tag-a', schemaVersion: 3, typeId: 'test.tags'});
node.addComponent({data: {tag: 'b'}, id: 'tag-b', schemaVersion: 3, typeId: 'test.tags'});
assert.strictEqual(single.allowMultiple, false);
assert.strictEqual(single.cardinality, COMPONENT_CARDINALITIES.ONE);
assert.strictEqual(node.getComponentById('tag-a').allowMultiple, true);
assert.throws(() => node.addComponent({id: 'single-2', typeId: 'test.single'}), error => (
    error && error.code === 'RUNTIME_COMPONENT_CARDINALITY_VIOLATION'
));
const canonicalA = graph.exportState();
const rebuilt = RuntimeNodeGraph.createFromState(canonicalA, {
    componentTypeRegistry: graph.componentTypeRegistry
}).graph;
const canonicalB = rebuilt.exportState();
assert.deepStrictEqual(canonicalB, canonicalA);
assert.strictEqual(
    canonicalB.nodes[0].components.find(component => component.id === 'single').allowMultiple,
    false
);
assert.strictEqual(
    canonicalB.nodes[0].components.find(component => component.id === 'tag-a').allowMultiple,
    true
);

// Conflicting legacy projections are rejected before import commit.
assert.throws(() => RuntimeNodeGraph.createFromState({
    activeSceneId: 'scene-a',
    nodes: [{
        components: [
            {allowMultiple: false, data: {}, id: 'a', typeId: 'test.conflict'},
            {allowMultiple: true, data: {}, id: 'b', typeId: 'test.conflict'}
        ],
        id: 'conflict-node',
        name: 'Conflict',
        parentId: 'runtime-node:scene-root:scene-a',
        sceneId: 'scene-a',
        scope: 'scene',
        typeId: 'ngvge.node'
    }],
    scenes: [{id: 'scene-a', name: 'Scene A'}],
    version: 1
}), error => error && error.code === 'RUNTIME_NODE_IMPORT_INVALID' && error.errors.some(issue => (
    issue.code === 'RUNTIME_COMPONENT_CARDINALITY_CONFLICT'
)));


// A registered type descriptor is authoritative over legacy instance projections.
const oneAuthority = graph.componentTypeRegistry.clone();
oneAuthority.register({
    cardinality: 'one',
    ownerModuleId: 'test.module',
    schemaVersion: 1,
    typeId: 'test.registered-one'
});
assert.throws(() => RuntimeNodeGraph.createFromState({
    activeSceneId: 'scene-a',
    nodes: [{
        components: [{allowMultiple: true, id: 'bad', typeId: 'test.registered-one'}],
        id: 'registered-conflict',
        parentId: 'runtime-node:scene-root:scene-a',
        sceneId: 'scene-a',
        scope: 'scene',
        typeId: 'ngvge.node'
    }],
    scenes: [{id: 'scene-a', name: 'Scene A'}],
    version: 1
}, {componentTypeRegistry: oneAuthority}), error => (
    error && error.code === 'RUNTIME_NODE_IMPORT_INVALID' &&
    error.errors.some(issue => issue.code === 'RUNTIME_COMPONENT_CARDINALITY_CONFLICT')
));

// Legacy unknown top-level fields normalize into extensionData once, then stabilize.
const legacyState = {
    activeSceneId: 'scene-a',
    nodes: [{
        components: [{
            arbitraryField: {safe: true},
            data: {value: 2},
            enabled: true,
            id: 'legacy-component',
            nativeHandle: 77,
            typeId: 'test.legacy'
        }],
        id: 'legacy-node',
        name: 'Legacy',
        parentId: 'runtime-node:scene-root:scene-a',
        sceneId: 'scene-a',
        scope: 'scene',
        typeId: 'ngvge.node'
    }],
    scenes: [{id: 'scene-a', name: 'Scene A'}],
    version: 1
};
const normalizedOnce = RuntimeNodeGraph.createFromState(legacyState).graph.exportState();
const normalizedComponent = normalizedOnce.nodes[0].components[0];
assert.strictEqual(Object.prototype.hasOwnProperty.call(normalizedComponent, 'nativeHandle'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(normalizedComponent, 'arbitraryField'), false);
assert.strictEqual(normalizedComponent.schemaVersion, 1);
assert.deepStrictEqual(normalizedComponent.extensionData[LEGACY_COMPONENT_EXTENSION_NAMESPACE], {
    arbitraryField: {safe: true},
    nativeHandle: 77
});
const normalizedTwice = RuntimeNodeGraph.createFromState(normalizedOnce).graph.exportState();
assert.deepStrictEqual(normalizedTwice, normalizedOnce);

// Identity and ownership are machine invariants, not documentation promises.
const originalIdentity = {
    id: single.id,
    ownerId: single.ownerId,
    schemaVersion: single.schemaVersion,
    typeId: single.typeId
};
for (const action of [
    () => { single.id = 'mutated-id'; },
    () => { single.typeId = 'mutated.type'; },
    () => { single.schemaVersion = 99; },
    () => { single.ownerId = 'another-node'; },
    () => Object.defineProperty(single, 'id', {value: 'defined-id'}),
    () => { delete single.typeId; },
    () => Object.setPrototypeOf(single, {})
]) {
    try { action(); } catch (error) { /* strict immutable objects may throw */ }
}
assert.deepStrictEqual({
    id: single.id,
    ownerId: single.ownerId,
    schemaVersion: single.schemaVersion,
    typeId: single.typeId
}, originalIdentity);
assert.strictEqual(node.getComponentById('single'), single);
assert.strictEqual(node.getComponentById('mutated-id'), null);
assert.strictEqual(Object.getPrototypeOf(single).constructor.name, 'RuntimeComponent');

// Data patch validates the candidate before replacing live data.
const beforeData = clone(single.data);
const pollutionPatch = JSON.parse('{"__proto__":{"polluted":true}}');
assert.throws(() => graph.patchComponentData(node.id, single.id, pollutionPatch), error => (
    error && error.code === 'RUNTIME_COMPONENT_DATA_KEY_FORBIDDEN'
));
assert.deepStrictEqual(single.data, beforeData);
assert.strictEqual(Object.getPrototypeOf(single.data), Object.prototype);
assert.strictEqual(Object.prototype.polluted, undefined);

// Public creation does not accept instance cardinality or persistence escape hatches.
const host = createRuntimeNodeModelHost(createSceneDataModel());
const model = host.publicCapability;
const registration = host.typeRegistrationCapability;
assert.strictEqual(model.apiVersion, '1.3.1');
assert.strictEqual(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
    id: 'api-node', sceneId: 'scene-a'
}).applied, true);
for (const options of [
    {allowMultiple: true, data: {}, typeId: 'test.public-extra'},
    {data: {}, persistentExtras: {nativeHandle: 77}, typeId: 'test.public-extra'},
    {data: {}, extensionData: {'test.module': {}}, typeId: 'test.public-extra'}
]) {
    const result = model.addComponent('api-node', options);
    assert.strictEqual(result.applied, false);
    assert.strictEqual(result.persisted, false);
    assert.strictEqual(result.error.code, 'RUNTIME_COMPONENT_PUBLIC_EXTRA_FIELDS_FORBIDDEN');
}
const nestedCreate = model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
    components: [{persistentExtras: {nativeHandle: 1}, typeId: 'test.nested-extra'}],
    id: 'api-invalid-node',
    sceneId: 'scene-a'
});
assert.strictEqual(nestedCreate.applied, false);
assert.strictEqual(model.getNodeSnapshot('api-invalid-node'), null);
const implicitResult = model.addComponent('api-node', {id: 'implicit-one', typeId: 'test.promoted'});
assert.strictEqual(implicitResult.applied, true);
assert.strictEqual(implicitResult.persisted, true);
registration.registerComponentTypeDescriptor({
    cardinality: 'one',
    ownerModuleId: 'test.module',
    schemaVersion: 1,
    typeId: 'test.promoted'
});
const implicitSecond = model.addComponent('api-node', {id: 'implicit-two', typeId: 'test.promoted'});
assert.strictEqual(implicitSecond.applied, false);
assert.strictEqual(implicitSecond.persisted, false);
assert.strictEqual(implicitSecond.error.code, 'RUNTIME_COMPONENT_CARDINALITY_VIOLATION');

registration.registerComponentTypeDescriptor({
    cardinality: 'many',
    ownerModuleId: 'test.module',
    schemaVersion: 1,
    typeId: 'test.api-many'
});
assert.strictEqual(model.addComponent('api-node', {id: 'many-a', typeId: 'test.api-many'}).applied, true);
assert.strictEqual(model.addComponent('api-node', {id: 'many-b', typeId: 'test.api-many'}).applied, true);
assert.strictEqual(model.getComponentSnapshot('api-node', 'many-a').cardinality, 'many');
const publicPatchBefore = model.getComponentSnapshot('api-node', 'many-a').data;
const publicPatchResult = model.patchComponent(
    'api-node',
    'many-a',
    JSON.parse('{\"__proto__\":{\"polluted\":true}}')
);
assert.strictEqual(publicPatchResult.applied, false);
assert.strictEqual(publicPatchResult.persisted, false);
assert.strictEqual(publicPatchResult.error.code, 'RUNTIME_COMPONENT_DATA_KEY_FORBIDDEN');
assert.deepStrictEqual(model.getComponentSnapshot('api-node', 'many-a').data, publicPatchBefore);
assert.strictEqual(model.getApiContract().componentContract.identity.schemaVersionImmutable, true);
assert.strictEqual(
    model.getApiContract().componentContract.cardinality.authority,
    'component-type-descriptor'
);

const moduleSource = fs.readFileSync(path.join(__dirname, '../src/lib/scene-system/module-definition.js'), 'utf8');
assert(/version:\s*'(?:0\.8\.9\.3\.1(?:\.[1234])?|0\.8\.9\.(?:4(?:\.1(?:\.[123456])?)?|5|6(?:\.1(?:\.1)?)?|7))'/.test(moduleSource));
host.localHostCapability.dispose();
graph.dispose();
rebuilt.dispose();

console.log('NGVGE 0008.9.3.1 Component Identity, Cardinality and Persistence Closure smoke passed.');
