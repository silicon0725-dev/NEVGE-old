#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    NODE_SCOPES,
    RUNTIME_NODE_REVISION_CONTRACT_ID,
    RuntimeNode,
    RuntimeNodeGraph,
    createRuntimeComponentTypeRegistry,
    createRuntimeNodeModelHost,
    createRuntimeNodeRevisionToken,
    createRuntimeNodeTypeRegistry
} = require('../src/lib/runtime-nodes');

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

// Registry revision must already be authoritative inside an earlier listener.
const registry = createRuntimeNodeTypeRegistry();
let snapshots = null;
let earlySnapshot = null;
registry.subscribe(change => {
    if (change.typeId === 'test.early-revision') {
        earlySnapshot = snapshots.capture({includeHidden: true, kind: 'node-types'});
    }
});
const host = createRuntimeNodeModelHost(createSceneDataModel(), {typeRegistry: registry});
snapshots = host.snapshotCapability;
const before = snapshots.capture({includeHidden: true, kind: 'node-types'});
host.typeRegistrationCapability.registerNodeTypeDescriptor({
    allowedScopes: [NODE_SCOPES.SCENE],
    defaultScope: NODE_SCOPES.SCENE,
    label: 'Early Revision',
    ownerModuleId: 'test.owner',
    typeId: 'test.early-revision',
    version: '1'
}, {activate: false});
host.typeRegistrationCapability.bindNodeTypeProvider('test.early-revision', {ctor: RuntimeNode});
assert(earlySnapshot);
assert(earlySnapshot.snapshot.some(type => type.id === 'test.early-revision'));
assert.notDeepStrictEqual(earlySnapshot.revision, before.revision);
assert.strictEqual(snapshots.isCurrent(earlySnapshot.revision), true);


// Component Registry revision must also be authoritative inside an earlier listener.
const componentRegistry = createRuntimeComponentTypeRegistry();
let componentSnapshots = null;
let earlyComponentSnapshot = null;
componentRegistry.subscribe(change => {
    if (change.typeId === 'test.early-component') {
        earlyComponentSnapshot = componentSnapshots.capture({includeHidden: true, kind: 'node-types'});
    }
});
const componentHost = createRuntimeNodeModelHost(createSceneDataModel(), {
    componentTypeRegistry: componentRegistry
});
componentSnapshots = componentHost.snapshotCapability;
const componentBefore = componentSnapshots.getRevision();
componentHost.typeRegistrationCapability.registerComponentTypeDescriptor({
    cardinality: 'one',
    ownerModuleId: 'test.owner',
    schemaVersion: 1,
    typeId: 'test.early-component'
});
assert(earlyComponentSnapshot);
assert.notDeepStrictEqual(earlyComponentSnapshot.revision, componentBefore);
assert.strictEqual(componentSnapshots.isCurrent(earlyComponentSnapshot.revision), true);

// Node type Registry binding is owned by the Graph and cannot be replaced/redefined.
const graph = new RuntimeNodeGraph({
    activeSceneId: 'scene-a',
    scenes: [{id: 'scene-a', name: 'Scene A'}]
});
const originalRegistry = graph.typeRegistry;
const replacementRegistry = createRuntimeNodeTypeRegistry();
assert.throws(
    () => { graph.typeRegistry = replacementRegistry; },
    error => error && error.code === 'RUNTIME_NODE_TYPE_REGISTRY_REPLACEMENT_FORBIDDEN'
);
assert.throws(
    () => Object.defineProperty(graph, 'typeRegistry', {value: replacementRegistry})
);
assert.strictEqual(graph.typeRegistry, originalRegistry);

// Provider overrides cannot intercept Graph binding or receive the raw Graph.
let capturedGraph = null;
let capturedNode = null;
class CaptureNode extends RuntimeNode {
    constructor (options) {
        super(options);
        capturedNode = this;
    }
    _bindGraph (nextGraph) {
        capturedGraph = nextGraph;
        return super._bindGraph(nextGraph);
    }
    _transition () {
        throw new Error('Provider transition override must not be invoked.');
    }
    _invoke () {
        throw new Error('Provider invoke override must not be invoked.');
    }
}
const providerRegistry = createRuntimeNodeTypeRegistry();
providerRegistry.register({
    allowedScopes: [NODE_SCOPES.SCENE],
    ctor: CaptureNode,
    defaultScope: NODE_SCOPES.SCENE,
    id: 'test.capture-node',
    label: 'Capture Node',
    owner: 'test.provider'
});
const providerGraph = new RuntimeNodeGraph({
    activeSceneId: 'scene-a',
    scenes: [{id: 'scene-a', name: 'Scene A'}],
    typeRegistry: providerRegistry
});
const created = providerGraph.createNode('test.capture-node', {
    id: 'captured',
    sceneId: 'scene-a'
});
assert.strictEqual(created, capturedNode);
assert.strictEqual(capturedGraph, null);
assert.strictEqual(capturedNode._graph, undefined);
assert.strictEqual(capturedNode.components.graph, undefined);
assert.strictEqual(Object.prototype.hasOwnProperty.call(capturedNode, '_graph'), false);

const bindDescriptor = Object.getOwnPropertyDescriptor(capturedNode, '_bindGraph');
const transitionDescriptor = Object.getOwnPropertyDescriptor(capturedNode, '_transition');
const invokeDescriptor = Object.getOwnPropertyDescriptor(capturedNode, '_invoke');
[bindDescriptor, transitionDescriptor, invokeDescriptor].forEach(descriptor => {
    assert(descriptor);
    assert.strictEqual(descriptor.configurable, false);
    assert.strictEqual(descriptor.writable, false);
});
assert.strictEqual(capturedNode._bindGraph, RuntimeNode.prototype._bindGraph);
assert.strictEqual(capturedNode._transition, RuntimeNode.prototype._transition);
assert.strictEqual(capturedNode._invoke, RuntimeNode.prototype._invoke);

// Retained live-object writes cannot change snapshot semantics under an unchanged Graph revision.
const beforeDirectNodeWrite = providerGraph.getStatus().revision;
capturedNode.name = 'Retained Provider Write';
const afterDirectNodeScalarWrite = providerGraph.getStatus().revision;
capturedNode.metadata.providerWrite = true;
const afterDirectNodeNestedWrite = providerGraph.getStatus().revision;
const retainedComponent = capturedNode.addComponent({
    data: {value: 1},
    id: 'retained-component',
    typeId: 'test.retained-component'
});
const beforeDirectComponentWrite = providerGraph.getStatus().revision;
retainedComponent.data.value = 2;
const afterDirectComponentWrite = providerGraph.getStatus().revision;
assert(afterDirectNodeScalarWrite > beforeDirectNodeWrite);
assert(afterDirectNodeNestedWrite > afterDirectNodeScalarWrite);
assert(afterDirectComponentWrite > beforeDirectComponentWrite);

// Snapshot ordering must be independent of host localeCompare behavior.
['a', 'A', 'ä', 'z', '中'].forEach(id => {
    host.publicCapability.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id,
        name: id,
        sceneId: 'scene-a'
    });
});
const originalLocaleCompare = String.prototype.localeCompare;
let localeCompareCalls = 0;
String.prototype.localeCompare = function () {
    localeCompareCalls += 1;
    return -originalLocaleCompare.apply(this, arguments);
};
let ordered;
let orderedTypes;
try {
    ordered = snapshots.capture({
        includeRoots: false,
        kind: 'node-list',
        sceneId: 'scene-a'
    }).snapshot.map(node => node.id).filter(id => ['a', 'A', 'ä', 'z', '中'].includes(id));
    ['test.A', 'test.a', 'test.z', 'test.ä', 'test.中'].forEach(typeId => {
        host.typeRegistrationCapability.registerNodeTypeDescriptor({
            allowedScopes: [NODE_SCOPES.SCENE],
            defaultScope: NODE_SCOPES.SCENE,
            label: typeId,
            ownerModuleId: 'test.locale-owner',
            typeId,
            version: '1'
        }, {activate: false});
        host.typeRegistrationCapability.bindNodeTypeProvider(typeId, {ctor: RuntimeNode});
    });
    orderedTypes = snapshots.capture({includeHidden: true, kind: 'node-types'}).snapshot
        .map(type => type.id)
        .filter(id => id.startsWith('test.') && ['test.A', 'test.a', 'test.z', 'test.ä', 'test.中'].includes(id));
} finally {
    String.prototype.localeCompare = originalLocaleCompare;
}
assert.deepStrictEqual(ordered, ['A', 'a', 'z', 'ä', '中']);
assert.deepStrictEqual(orderedTypes, ['test.A', 'test.a', 'test.z', 'test.ä', 'test.中']);
assert.strictEqual(localeCompareCalls, 0);

// Frozen query contract rejects implicit coercion.
[
    {kind: 'subtree', order: 'garbage', rootNodeId: 'a'},
    {includeRoots: 'false', kind: 'node-list'},
    {includeHidden: 'true', kind: 'node-types'},
    {includeRoot: 1, kind: 'subtree', rootNodeId: 'a'},
    {kind: 1}
].forEach(query => {
    assert.throws(
        () => snapshots.capture(query),
        error => error && error.code === 'RUNTIME_NODE_SNAPSHOT_QUERY_INVALID'
    );
});

// Tokens use safe integers and normalize -0.
const normalizedNegativeZero = createRuntimeNodeRevisionToken({
    graphRevision: -0,
    registryRevision: -0,
    runtimeGeneration: 1
});
assert.strictEqual(normalizedNegativeZero.graphRevision, 0);
assert.strictEqual(normalizedNegativeZero.registryRevision, 0);
assert.strictEqual(Object.is(normalizedNegativeZero.graphRevision, -0), false);
assert.strictEqual(Object.is(normalizedNegativeZero.registryRevision, -0), false);
assert.throws(
    () => snapshots.isCurrent({
        contractId: RUNTIME_NODE_REVISION_CONTRACT_ID,
        graphRevision: Number.MAX_SAFE_INTEGER + 1,
        registryRevision: 0,
        runtimeGeneration: 1
    }),
    error => error && error.code === 'RUNTIME_NODE_REVISION_TOKEN_INVALID'
);

providerGraph.dispose();
graph.dispose();
componentHost.dispose();
host.dispose();
console.log('NGVGE TASK 0008.9.6.1 revision authority and canonical snapshot closure validation passed.');
