#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
    NODE_SCOPES,
    RuntimeComponent,
    RuntimeNode,
    RuntimeNodeGraph,
    createRuntimeNodeModelHost,
    createRuntimeNodeTypeRegistry
} = require('../src/lib/runtime-nodes');
const {
    replaceRuntimeNodeGraphBinding
} = require('../src/lib/runtime-nodes/runtime-node');
const {
    replaceRuntimeComponentContainerGraphBinding,
    replaceRuntimeComponentGraphBinding
} = require('../src/lib/runtime-nodes/component-container');

const clone = value => JSON.parse(JSON.stringify(value));
const createSceneDataModel = () => {
    let project = {
        activeSceneId: 'scene-a',
        extensionData: {},
        scenes: [{id: 'scene-a', name: 'Scene A'}]
    };
    let writeCount = 0;
    const listeners = new Set();
    return {
        getProject: () => clone(project),
        getStatus: () => ({readOnly: false}),
        getWriteCount: () => writeCount,
        readProject: () => clone(project),
        subscribe: listener => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        writeProject: next => {
            writeCount += 1;
            project = clone(next);
            listeners.forEach(listener => listener({type: 'data'}));
            return clone(project);
        }
    };
};

const assertFinalMethod = (prototype, methodName) => {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);
    assert(descriptor, `Missing final method descriptor: ${methodName}`);
    assert.strictEqual(descriptor.configurable, false, `${methodName} must be non-configurable`);
    assert.strictEqual(descriptor.writable, false, `${methodName} must be non-writable`);
    return descriptor.value;
};

// Runtime Node internal dispatch is captured once and the base prototype cannot be monkey-patched.
let capturedGraph = null;
const nodeInternalMethods = [
    '_bindGraph',
    '_replaceGraphBinding',
    '_invoke',
    '_recordLifecycle',
    '_transition',
    '_markReady',
    '_setActiveInHierarchy'
];
nodeInternalMethods.forEach(methodName => {
    const original = assertFinalMethod(RuntimeNode.prototype, methodName);
    assert.throws(() => Object.defineProperty(RuntimeNode.prototype, methodName, {
        value: function (graph) {
            capturedGraph = graph;
        }
    }));
    assert.strictEqual(RuntimeNode.prototype[methodName], original);
});

let retainedStandaloneNode = null;
class CaptureNode extends RuntimeNode {
    constructor (options) {
        super(options);
        retainedStandaloneNode = this;
        try {
            RuntimeNode.prototype._bindGraph = function (graph) {
                capturedGraph = graph;
            };
        } catch (error) {
            // Strict-mode assignment to the frozen operation is expected to fail.
        }
    }

    _bindGraph (graph) {
        capturedGraph = graph;
        return super._bindGraph(graph);
    }

    _transition () {
        throw new Error('Provider transition override must never be dispatched.');
    }

    _invoke () {
        throw new Error('Provider invoke override must never be dispatched.');
    }
}

const standaloneRegistry = createRuntimeNodeTypeRegistry();
standaloneRegistry.register({
    allowedScopes: [NODE_SCOPES.SCENE],
    ctor: CaptureNode,
    defaultScope: NODE_SCOPES.SCENE,
    id: 'test.capture-node',
    label: 'Capture Node',
    owner: 'test.provider'
});
const standaloneGraph = new RuntimeNodeGraph({
    activeSceneId: 'scene-a',
    scenes: [{id: 'scene-a', name: 'Scene A'}],
    typeRegistry: standaloneRegistry
});
standaloneGraph.createNode('test.capture-node', {
    id: 'standalone-node',
    sceneId: 'scene-a'
});
assert.strictEqual(capturedGraph, null);
assert(retainedStandaloneNode);

// Runtime Component lifecycle dispatch uses fixed base operations, not provider virtual methods.
let componentGraph = null;
const componentInternalMethods = [
    '_replaceGraphBinding',
    '_invoke',
    '_recordLifecycle',
    '_transition',
    '_create',
    '_attach',
    '_ready',
    '_setActive',
    '_setEnabled',
    '_detach',
    '_destroy'
];
componentInternalMethods.forEach(methodName => assertFinalMethod(RuntimeComponent.prototype, methodName));

class CaptureComponent extends RuntimeComponent {
    _create (owner, graph) {
        componentGraph = graph;
        return super._create(owner, graph);
    }

    _attach (owner, graph) {
        componentGraph = graph;
        return super._attach(owner, graph);
    }

    _ready (owner, graph) {
        componentGraph = graph;
        return super._ready(owner, graph);
    }

    _setActive (active, owner, graph, extra) {
        componentGraph = graph;
        return super._setActive(active, owner, graph, extra);
    }

    _detach (owner, graph, extra) {
        componentGraph = graph;
        return super._detach(owner, graph, extra);
    }

    _destroy (owner, graph, extra) {
        componentGraph = graph;
        return super._destroy(owner, graph, extra);
    }
}

const standaloneComponent = new CaptureComponent({
    id: 'standalone-component',
    typeId: 'test.capture-component'
});
retainedStandaloneNode.addComponent(standaloneComponent);
retainedStandaloneNode.removeComponent(standaloneComponent.id);
assert.strictEqual(componentGraph, null);

// A Model-managed Graph grants mutation authority only to Graph operations.
let retainedManagedNode = null;
class ManagedProviderNode extends RuntimeNode {
    constructor (options) {
        super(options);
        retainedManagedNode = this;
    }
}
const managedRegistry = createRuntimeNodeTypeRegistry();
managedRegistry.register({
    allowedScopes: [NODE_SCOPES.SCENE],
    ctor: ManagedProviderNode,
    defaultScope: NODE_SCOPES.SCENE,
    id: 'test.managed-node',
    label: 'Managed Node',
    owner: 'test.provider'
});
const sceneDataModel = createSceneDataModel();
const host = createRuntimeNodeModelHost(sceneDataModel, {typeRegistry: managedRegistry});
const createResult = host.publicCapability.createNode('test.managed-node', {
    id: 'managed-node',
    sceneId: 'scene-a'
});
assert.strictEqual(createResult.applied, true);
assert.strictEqual(createResult.persisted, true);
assert(retainedManagedNode);

// Direct imports of non-public binding helpers still require the exact current Graph bearer.
assert.throws(
    () => replaceRuntimeNodeGraphBinding(retainedManagedNode, null),
    error => error && error.code === 'RUNTIME_NODE_INTERNAL_AUTHORITY_REQUIRED'
);
assert.throws(
    () => replaceRuntimeComponentContainerGraphBinding(retainedManagedNode.components, null),
    error => error && error.code === 'RUNTIME_COMPONENT_INTERNAL_AUTHORITY_REQUIRED'
);

const projectBeforeBypassAttempts = sceneDataModel.getProject();
const writesBeforeBypassAttempts = sceneDataModel.getWriteCount();
const expectNodeAuthority = operation => assert.throws(
    operation,
    error => error && error.code === 'RUNTIME_NODE_MODEL_AUTHORITY_REQUIRED'
);
expectNodeAuthority(() => { retainedManagedNode.name = 'Bypass Rename'; });
expectNodeAuthority(() => { retainedManagedNode.metadata.bypass = true; });
expectNodeAuthority(() => retainedManagedNode.addComponent(new CaptureComponent({
    id: 'bypass-component',
    typeId: 'test.bypass-component'
})));
assert.throws(() => retainedManagedNode.components.add({
    id: 'container-bypass',
    typeId: 'test.container-bypass'
}), error => error && error.code === 'RUNTIME_COMPONENT_MODEL_AUTHORITY_REQUIRED');
assert.strictEqual(componentGraph, null);
assert.deepStrictEqual(sceneDataModel.getProject(), projectBeforeBypassAttempts);
assert.strictEqual(sceneDataModel.getWriteCount(), writesBeforeBypassAttempts);

// Supported Model mutations still commit and persist.
const addResult = host.publicCapability.addComponent('managed-node', {
    id: 'managed-component',
    typeId: 'test.managed-component'
});
assert.strictEqual(addResult.applied, true);
assert.strictEqual(addResult.persisted, true);
const retainedManagedComponent = retainedManagedNode.getComponentById('managed-component');
assert(retainedManagedComponent);
assert.strictEqual(componentGraph, null);
assert.throws(
    () => replaceRuntimeComponentGraphBinding(retainedManagedComponent, null),
    error => error && error.code === 'RUNTIME_COMPONENT_INTERNAL_AUTHORITY_REQUIRED'
);

const projectBeforeComponentBypass = sceneDataModel.getProject();
const writesBeforeComponentBypass = sceneDataModel.getWriteCount();
const expectComponentAuthority = operation => assert.throws(
    operation,
    error => error && error.code === 'RUNTIME_COMPONENT_MODEL_AUTHORITY_REQUIRED'
);
expectComponentAuthority(() => retainedManagedComponent.patchData({value: 7}));
expectComponentAuthority(() => retainedManagedComponent.setData({value: 8}));
expectComponentAuthority(() => { retainedManagedComponent.data.value = 9; });
expectComponentAuthority(() => retainedManagedNode.components.remove('managed-component'));
assert.deepStrictEqual(sceneDataModel.getProject(), projectBeforeComponentBypass);
assert.strictEqual(sceneDataModel.getWriteCount(), writesBeforeComponentBypass);

const patchResult = host.publicCapability.patchComponentData(
    'managed-node',
    'managed-component',
    {value: 10}
);
assert.strictEqual(patchResult.applied, true);
assert.strictEqual(patchResult.persisted, true);
assert.strictEqual(retainedManagedComponent.data.value, 10);
assert.strictEqual(componentGraph, null);

host.dispose();
standaloneGraph.dispose();

console.log('NGVGE TASK 0008.9.6.1.1 internal dispatch integrity and provider graph isolation validation passed.');
