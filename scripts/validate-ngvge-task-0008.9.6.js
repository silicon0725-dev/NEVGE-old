#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    COMPONENT_CARDINALITIES,
    NODE_SCOPES,
    RUNTIME_NODE_REVISION_CONTRACT_ID,
    RUNTIME_NODE_SNAPSHOT_CAPABILITY_ID,
    RUNTIME_NODE_SNAPSHOT_CONTRACT_ID,
    RUNTIME_NODE_SNAPSHOT_ENVELOPE_FIELDS,
    RUNTIME_NODE_SNAPSHOT_PUBLIC_SURFACE_KEYS,
    RuntimeComponentTypeRegistry,
    RuntimeNode,
    RuntimeNodeGraph,
    RuntimeNodeTypeRegistry,
    createRuntimeNodeModelHost,
    createRuntimeNodeSnapshotEnvelope
} = require('../src/lib/runtime-nodes');
const {validatePersistentData} = require('../src/lib/persistence/persistent-data');
const fs = require('fs');
const path = require('path');

const clone = value => JSON.parse(JSON.stringify(value));
const createSceneDataModel = () => {
    let project = {
        activeSceneId: 'scene-a',
        extensionData: {},
        scenes: [{id: 'scene-a', name: 'Scene A'}]
    };
    const listeners = new Set();
    return {
        getProject: () => clone(project),
        getStatus: () => ({readOnly: false}),
        readProject: () => clone(project),
        subscribe: listener => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        writeProject: next => {
            project = clone(next);
            listeners.forEach(listener => listener({type: 'data'}));
        }
    };
};

const assertPortableFrozen = value => {
    assert.strictEqual(validatePersistentData(value).valid, true);
    const visit = current => {
        if (!current || typeof current !== 'object') return;
        assert.strictEqual(Object.isFrozen(current), true);
        Object.keys(current).forEach(key => visit(current[key]));
    };
    visit(value);
};

const host = createRuntimeNodeModelHost(createSceneDataModel());
const model = host.publicCapability;
const snapshotApi = host.snapshotCapability;
const registration = host.typeRegistrationCapability;

assert.deepStrictEqual(Reflect.ownKeys(snapshotApi).sort(), Array.from(RUNTIME_NODE_SNAPSHOT_PUBLIC_SURFACE_KEYS));
assert.strictEqual(snapshotApi.capabilityId, RUNTIME_NODE_SNAPSHOT_CAPABILITY_ID);
assert.strictEqual(snapshotApi.contractId, RUNTIME_NODE_SNAPSHOT_CONTRACT_ID);
assert.strictEqual(snapshotApi.version, '1');
assert.strictEqual(snapshotApi.getContract().semantics.transactionRevision, false);
assert.strictEqual(snapshotApi.getContract().semantics.mixedRevisionSnapshotsAllowed, false);

const initialRevision = snapshotApi.getRevision();
assert.deepStrictEqual(Object.keys(initialRevision), [
    'contractId',
    'runtimeGeneration',
    'graphRevision',
    'registryRevision'
]);
assert.strictEqual(initialRevision.contractId, RUNTIME_NODE_REVISION_CONTRACT_ID);
assert.strictEqual(snapshotApi.isCurrent(initialRevision), true);
assert.strictEqual(snapshotApi.assertCurrent(initialRevision), true);
assertPortableFrozen(initialRevision);

const graphRevisionAuthorityProbe = new RuntimeNodeGraph({
    activeSceneId: 'probe-scene',
    scenes: [{id: 'probe-scene', name: 'Probe'}]
});
const graphRevisionBeforeSpoof = graphRevisionAuthorityProbe.getStatus().revision;
try {
    graphRevisionAuthorityProbe._revision = graphRevisionBeforeSpoof + 1000;
} catch (error) {
    // Strict runtimes may reject assignment to the private read-only compatibility projection.
}
assert.strictEqual(graphRevisionAuthorityProbe.getStatus().revision, graphRevisionBeforeSpoof);
assert.strictEqual(Object.getOwnPropertyDescriptor(graphRevisionAuthorityProbe, '_revision').set, undefined);

graphRevisionAuthorityProbe.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
    id: 'probe-node',
    sceneId: 'probe-scene'
});
assert.ok(graphRevisionAuthorityProbe.getStatus().revision > graphRevisionBeforeSpoof);
graphRevisionAuthorityProbe.dispose();

const nodeRegistryAuthorityProbe = new RuntimeNodeTypeRegistry();
assert.strictEqual(nodeRegistryAuthorityProbe._types, undefined);
assert.strictEqual(nodeRegistryAuthorityProbe._listeners, undefined);
assert.strictEqual(Object.isSealed(nodeRegistryAuthorityProbe), true);
assert.throws(() => Object.defineProperty(nodeRegistryAuthorityProbe, '_types', {value: new Map()}));
const nodeRegistryRevisionBefore = nodeRegistryAuthorityProbe.getRevision();
const removeProbeType = nodeRegistryAuthorityProbe.register({
    allowedScopes: [NODE_SCOPES.SCENE],
    ctor: RuntimeNode,
    id: 'probe.type',
    label: 'Probe Type'
});
assert.ok(nodeRegistryAuthorityProbe.getRevision() > nodeRegistryRevisionBefore);
const nodeRegistryRevisionAfterRegister = nodeRegistryAuthorityProbe.getRevision();
assert.strictEqual(removeProbeType(), true);
assert.ok(nodeRegistryAuthorityProbe.getRevision() > nodeRegistryRevisionAfterRegister);

const componentRegistryAuthorityProbe = new RuntimeComponentTypeRegistry();
assert.strictEqual(componentRegistryAuthorityProbe._descriptors, undefined);
assert.strictEqual(componentRegistryAuthorityProbe._usageResolvers, undefined);
assert.strictEqual(componentRegistryAuthorityProbe._listeners, undefined);
assert.strictEqual(Object.isSealed(componentRegistryAuthorityProbe), true);
assert.throws(() => Object.defineProperty(componentRegistryAuthorityProbe, '_descriptors', {value: new Map()}));
const componentRegistryRevisionBefore = componentRegistryAuthorityProbe.getRevision();
componentRegistryAuthorityProbe.register({
    cardinality: COMPONENT_CARDINALITIES.ONE,
    ownerModuleId: 'probe.owner',
    schemaVersion: 2,
    typeId: 'probe.component'
});
assert.ok(componentRegistryAuthorityProbe.getRevision() > componentRegistryRevisionBefore);
const componentRegistryRevisionAfterDescriptor = componentRegistryAuthorityProbe.getRevision();
const unbindProbeMigration = componentRegistryAuthorityProbe.bindMigration(
    'probe.component',
    1,
    ({data}) => ({data}),
    {ownerModuleId: 'probe.owner'}
);
assert.ok(componentRegistryAuthorityProbe.getRevision() > componentRegistryRevisionAfterDescriptor);
const componentRegistryRevisionAfterMigration = componentRegistryAuthorityProbe.getRevision();
assert.strictEqual(unbindProbeMigration(), true);
assert.ok(componentRegistryAuthorityProbe.getRevision() > componentRegistryRevisionAfterMigration);

const mutableEnvelopeQuery = {kind: 'graph'};
const mutableEnvelopeSnapshot = {nodes: [{id: 'snapshot-source'}]};
const normalizedEnvelope = createRuntimeNodeSnapshotEnvelope({
    kind: 'graph',
    query: mutableEnvelopeQuery,
    revision: {
        contractId: RUNTIME_NODE_REVISION_CONTRACT_ID,
        graphRevision: 0,
        registryRevision: 0,
        runtimeGeneration: 1
    },
    snapshot: mutableEnvelopeSnapshot
});
mutableEnvelopeQuery.kind = 'node';
mutableEnvelopeSnapshot.nodes[0].id = 'mutated';
assert.strictEqual(normalizedEnvelope.query.kind, 'graph');
assert.strictEqual(normalizedEnvelope.snapshot.nodes[0].id, 'snapshot-source');
assertPortableFrozen(normalizedEnvelope);
assert.throws(
    () => snapshotApi.isCurrent(Object.assign({}, initialRevision, {extra: true})),
    error => error && error.code === 'RUNTIME_NODE_REVISION_TOKEN_INVALID'
);

registration.registerComponentTypeDescriptor({
    cardinality: COMPONENT_CARDINALITIES.MANY,
    ownerModuleId: 'test.snapshot',
    schemaVersion: 1,
    typeId: 'test.snapshot-component'
});

const createB = model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
    id: 'node-b',
    name: 'B',
    sceneId: 'scene-a'
});
const createA = model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
    id: 'node-a',
    name: 'A',
    sceneId: 'scene-a'
});
assert.strictEqual(createB.applied && createB.persisted, true);
assert.strictEqual(createA.applied && createA.persisted, true);
assert.strictEqual(model.addComponent('node-a', {
    id: 'component-z',
    typeId: 'test.snapshot-component'
}).persisted, true);
assert.strictEqual(model.addComponent('node-a', {
    id: 'component-a',
    typeId: 'test.snapshot-component'
}).persisted, true);

assert.strictEqual(snapshotApi.isCurrent(initialRevision), false);
assert.throws(
    () => snapshotApi.assertCurrent(initialRevision),
    error => error && error.code === 'RUNTIME_NODE_REVISION_STALE' &&
        error.expectedRevision.runtimeGeneration === initialRevision.runtimeGeneration
);

const graphEnvelope = snapshotApi.capture({kind: 'graph'});
assert.deepStrictEqual(Object.keys(graphEnvelope), Array.from(RUNTIME_NODE_SNAPSHOT_ENVELOPE_FIELDS));
assert.strictEqual(graphEnvelope.contractId, RUNTIME_NODE_SNAPSHOT_CONTRACT_ID);
assert.strictEqual(graphEnvelope.kind, 'graph');
assert.strictEqual(snapshotApi.isCurrent(graphEnvelope.revision), true);
assert.deepStrictEqual(
    graphEnvelope.snapshot.nodes.map(node => node.id),
    graphEnvelope.snapshot.nodes.map(node => node.id).slice().sort()
);
assertPortableFrozen(graphEnvelope);

const listEnvelope = snapshotApi.capture({
    includeRoots: false,
    kind: 'node-list',
    sceneId: 'scene-a'
});
assert.deepStrictEqual(listEnvelope.snapshot.map(node => node.id), ['node-a', 'node-b']);
assertPortableFrozen(listEnvelope);

const nodeEnvelope = snapshotApi.capture({kind: 'node', nodeId: 'node-a'});
assert.deepStrictEqual(nodeEnvelope.snapshot.components.map(component => component.id), [
    'component-a',
    'component-z'
]);
assert.strictEqual(nodeEnvelope.revision.runtimeGeneration, listEnvelope.revision.runtimeGeneration);
assert.strictEqual(nodeEnvelope.revision.graphRevision, listEnvelope.revision.graphRevision);
assertPortableFrozen(nodeEnvelope);

const componentEnvelope = snapshotApi.capture({
    componentId: 'component-a',
    kind: 'component',
    nodeId: 'node-a'
});
assert.strictEqual(componentEnvelope.snapshot.id, 'component-a');
assertPortableFrozen(componentEnvelope);

const sceneEnvelope = snapshotApi.capture({kind: 'scene', sceneId: 'scene-a'});
assert.deepStrictEqual(sceneEnvelope.snapshot.nodes.map(node => node.id), ['node-a', 'node-b']);
assertPortableFrozen(sceneEnvelope);

model.setParent('node-b', 'node-a');
const subtreeEnvelope = snapshotApi.capture({
    includeRoot: true,
    kind: 'subtree',
    order: 'pre',
    rootNodeId: 'node-a'
});
assert.deepStrictEqual(subtreeEnvelope.snapshot.nodes.map(entry => [entry.node.id, entry.depth]), [
    ['node-a', 0],
    ['node-b', 1]
]);
assertPortableFrozen(subtreeEnvelope);

const beforeRegistryChange = snapshotApi.getRevision();
registration.registerNodeTypeDescriptor({
    allowedScopes: [NODE_SCOPES.SCENE, NODE_SCOPES.GLOBAL],
    label: 'Snapshot Type',
    ownerModuleId: 'test.snapshot',
    typeId: 'test.snapshot-node',
    version: '1'
});
registration.bindNodeTypeProvider('test.snapshot-node', {ctor: RuntimeNode});
const afterRegistryChange = snapshotApi.getRevision();
assert.strictEqual(afterRegistryChange.runtimeGeneration, beforeRegistryChange.runtimeGeneration);
assert.strictEqual(afterRegistryChange.graphRevision, beforeRegistryChange.graphRevision);
assert.ok(afterRegistryChange.registryRevision > beforeRegistryChange.registryRevision);
assert.strictEqual(snapshotApi.isCurrent(beforeRegistryChange), false);

const typesEnvelope = snapshotApi.capture({includeHidden: true, kind: 'node-types'});
assert.deepStrictEqual(
    typesEnvelope.snapshot.map(type => type.id),
    typesEnvelope.snapshot.map(type => type.id).slice().sort()
);
const customType = typesEnvelope.snapshot.find(type => type.id === 'test.snapshot-node');
assert.deepStrictEqual(customType.allowedScopes, [NODE_SCOPES.GLOBAL, NODE_SCOPES.SCENE]);
assertPortableFrozen(typesEnvelope);

const observedChanges = [];
const unsubscribe = model.subscribe(change => observedChanges.push(change));
const eventMutation = model.patchNode('node-a', {name: 'Renamed'});
assert.strictEqual(eventMutation.applied && eventMutation.persisted, true);
unsubscribe();
assert.ok(observedChanges.length > 0);
observedChanges.forEach(change => {
    assert.strictEqual(change.revisionToken.contractId, RUNTIME_NODE_REVISION_CONTRACT_ID);
    assert.strictEqual(change.revision, change.revisionToken.graphRevision);
    assert.strictEqual(change.graphRevision, change.revisionToken.graphRevision);
    assert.strictEqual(change.registryRevision, change.revisionToken.registryRevision);
    assert.strictEqual(change.runtimeGeneration, change.revisionToken.runtimeGeneration);
    assertPortableFrozen(change.revisionToken);
});

const beforeImport = snapshotApi.getRevision();
const importResult = host.persistenceController.importState(model.exportState());
assert.strictEqual(importResult.applied && importResult.persisted, true);
const afterImport = snapshotApi.getRevision();
assert.ok(afterImport.runtimeGeneration > beforeImport.runtimeGeneration);
assert.strictEqual(snapshotApi.isCurrent(beforeImport), false);
assert.strictEqual(snapshotApi.isCurrent(afterImport), true);

assert.throws(
    () => snapshotApi.capture({kind: 'graph', unexpected: true}),
    error => error && error.code === 'RUNTIME_NODE_SNAPSHOT_QUERY_INVALID'
);
assert.throws(
    () => snapshotApi.capture({kind: 'unknown'}),
    error => error && error.code === 'RUNTIME_NODE_SNAPSHOT_KIND_UNSUPPORTED'
);
assert.throws(
    () => snapshotApi.isCurrent({
        contractId: RUNTIME_NODE_REVISION_CONTRACT_ID,
        graphRevision: -1,
        registryRevision: 0,
        runtimeGeneration: 1
    }),
    error => error && error.code === 'RUNTIME_NODE_REVISION_TOKEN_INVALID'
);

const sceneModuleSource = fs.readFileSync(path.join(
    __dirname, '..', 'src', 'lib', 'scene-system', 'module-definition.js'
), 'utf8');
assert.ok(/version:\s*'0\.8\.9\.(?:6(?:\.1(?:\.1)?)?|7)'/.test(sceneModuleSource));
assert.ok(sceneModuleSource.includes('RUNTIME_NODE_SNAPSHOT_CAPABILITY_ID'));

host.dispose();
console.log('NGVGE TASK 0008.9.6 runtime revision and snapshot consistency validation passed.');
