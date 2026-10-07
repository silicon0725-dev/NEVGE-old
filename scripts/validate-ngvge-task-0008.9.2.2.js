#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    NODE_LIFECYCLE_STATES,
    RUNTIME_NODE_LIFECYCLE_CONTRACT,
    RuntimeNodeGraph,
    createRuntimeNodeModelHost
} = require('../src/lib/runtime-nodes');

const clone = value => JSON.parse(JSON.stringify(value));

const createGraph = () => new RuntimeNodeGraph({
    activeSceneId: 'scene-a',
    scenes: [{id: 'scene-a', name: 'Scene A'}]
});

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
        writeProject: nextProject => {
            project = clone(nextProject);
            listeners.forEach(listener => listener({type: 'data'}));
        }
    };
};


const assertContractAndRelease = () => {
    assert.strictEqual(
        RUNTIME_NODE_LIFECYCLE_CONTRACT.hookObservationBoundary.nodeValue,
        'detached-deep-frozen-plain-snapshot'
    );
    assert.strictEqual(RUNTIME_NODE_LIFECYCLE_CONTRACT.hookObservationBoundary.graphExposed, false);
    assert.strictEqual(
        RUNTIME_NODE_LIFECYCLE_CONTRACT.observerReentrancyPolicy.policy,
        'reject-synchronous-runtime-semantic-mutation'
    );
    assert.strictEqual(
        RUNTIME_NODE_LIFECYCLE_CONTRACT.observerReentrancyPolicy.diagnostic,
        'local-only-no-recursive-event'
    );
    const moduleSource = fs.readFileSync(path.join(
        __dirname,
        '../src/lib/scene-system/module-definition.js'
    ), 'utf8');
    assert(/version:\s*'0\.8\.9\.(?:2\.2|3(?:\.1(?:\.[1234])?)?|4(?:\.1(?:\.[123456])?)?|5|6(?:\.1(?:\.1)?)?|7)'/.test(moduleSource));
};

const assertHookObservationBoundary = () => {
    const graph = createGraph();
    let nodeContext = null;
    const node = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        hooks: {
            onDisable: context => {
                nodeContext = context;
                assert.strictEqual(Reflect.set(context.node, 'enabledSelf', true), false);
                assert.strictEqual(Reflect.set(context.node, 'name', 'hook-mutated'), false);
                assert.strictEqual(Reflect.set(context.node.metadata, 'hacked', true), false);
                context.resources.set('render-handle', {local: true});
            }
        },
        id: 'readonly-node',
        metadata: {safe: true},
        name: 'Original',
        sceneId: 'scene-a'
    });

    graph.setNodeEnabled(node.id, false);
    assert(nodeContext);
    assert.strictEqual(node.enabledSelf, false);
    assert.strictEqual(node.activeInHierarchy, false);
    assert.strictEqual(node.state, NODE_LIFECYCLE_STATES.DISABLED);
    assert.strictEqual(node.name, 'Original');
    assert.deepStrictEqual(node.metadata, {safe: true});
    assert.strictEqual(Object.prototype.hasOwnProperty.call(nodeContext, 'graph'), false);
    assert.strictEqual(Object.isFrozen(nodeContext), true);
    assert.strictEqual(Object.isFrozen(nodeContext.node), true);
    assert.strictEqual(Object.isFrozen(nodeContext.node.metadata), true);
    assert.strictEqual(Object.getPrototypeOf(nodeContext.node), Object.prototype);
    assert.strictEqual(typeof nodeContext.node.setEnabled, 'undefined');
    assert.strictEqual(typeof nodeContext.node.setParent, 'undefined');
    assert.deepStrictEqual(Object.keys(nodeContext.query).sort(), [
        'getComponentSnapshot',
        'getNodeSnapshot',
        'getSceneSnapshot',
        'querySubtree'
    ]);
    assert.strictEqual(nodeContext.resources.get('render-handle').local, true);
    assert.strictEqual(nodeContext.query.getNodeSnapshot(node.id).state, NODE_LIFECYCLE_STATES.DISABLED);

    let componentContext = null;
    const component = node.addComponent({
        data: {value: 1},
        hooks: {
            onDisable: context => {
                componentContext = context;
                Reflect.set(context.component, 'enabled', false);
                Reflect.set(context.component.data, 'value', 999);
            }
        },
        id: 'readonly-component',
        typeId: 'test.readonly-component'
    });
    graph.setNodeEnabled(node.id, true);
    graph.setNodeEnabled(node.id, false);
    assert(componentContext);
    assert.strictEqual(Object.isFrozen(componentContext.component), true);
    assert.strictEqual(Object.isFrozen(componentContext.component.data), true);
    assert.strictEqual(Object.getPrototypeOf(componentContext.component), Object.prototype);
    assert.strictEqual(typeof componentContext.component.patchData, 'undefined');
    assert.strictEqual(component.enabled, true);
    assert.deepStrictEqual(component.data, {value: 1});

    const exported = graph.exportState();
    const record = exported.nodes.find(candidate => candidate.id === node.id);
    assert(record);
    assert.strictEqual(record.name, 'Original');
    assert.deepStrictEqual(record.metadata, {safe: true});
    assert.deepStrictEqual(record.components[0].data, {value: 1});
    assert.strictEqual(Object.prototype.hasOwnProperty.call(record.metadata, 'hacked'), false);
    graph.dispose();
};

const assertObserverBoundary = () => {
    const sceneDataModel = createSceneDataModel();
    const host = createRuntimeNodeModelHost(sceneDataModel);
    const model = host.publicCapability;
    let rejectedResult = null;
    const received = [];
    let throwingObserverCalls = 0;
    let lifecycleErrorEvents = 0;

    const unsubscribeMutationObserver = model.subscribe(event => {
        if (event.type === 'lifecycle:error') lifecycleErrorEvents += 1;
        if (event.type === 'lifecycle' && event.phase === 'attach' && event.nodeId === 'victim') {
            rejectedResult = model.destroyNode(event.nodeId);
        }
    });
    const unsubscribeReceivingObserver = model.subscribe(event => received.push(event));
    const unsubscribeThrowingObserver = model.subscribe(event => {
        if (event.type === 'lifecycle' && event.phase === 'attach' && event.nodeId === 'victim') {
            throwingObserverCalls += 1;
            throw new Error('observer failed');
        }
    });

    const created = model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'victim',
        sceneId: 'scene-a'
    });
    assert.strictEqual(created.applied, true);
    assert.strictEqual(created.persisted, true);
    assert(rejectedResult);
    assert.strictEqual(rejectedResult.applied, false);
    assert.strictEqual(rejectedResult.persisted, false);
    assert.strictEqual(rejectedResult.error.code, 'RUNTIME_LIFECYCLE_REENTRANT_MUTATION');
    assert.strictEqual(rejectedResult.error.details.originKind, 'observer');
    assert.strictEqual(rejectedResult.error.details.eventType, 'lifecycle');
    assert.strictEqual(rejectedResult.error.details.phase, 'attach');
    assert.strictEqual(rejectedResult.error.details.nodeId, 'victim');
    assert(Number.isInteger(rejectedResult.error.details.runtimeGeneration));
    assert(Number.isInteger(rejectedResult.error.details.sequence));
    assert(model.getNodeSnapshot('victim'));
    assert.strictEqual(model.getNodeSnapshot('victim').state, NODE_LIFECYCLE_STATES.ACTIVE);
    assert.strictEqual(received.some(event => (
        event.type === 'lifecycle' && event.phase === 'ready' && event.nodeId === 'victim'
    )), true);
    assert.strictEqual(received.some(event => (
        event.type === 'lifecycle' && event.phase === 'destroy' && event.nodeId === 'victim'
    )), false);
    assert.strictEqual(throwingObserverCalls, 1);
    assert.strictEqual(lifecycleErrorEvents, 0);

    const status = model.getStatus();
    assert(status.observerReentrantMutationCount > 0);
    assert(status.observerErrorCount > 0);
    assert.strictEqual(status.listenerErrorCount, status.graphListenerErrorCount + status.observerErrorCount);

    unsubscribeMutationObserver();
    unsubscribeReceivingObserver();
    unsubscribeThrowingObserver();

    const afterDispatch = model.destroyNode('victim');
    assert.strictEqual(afterDispatch.applied, true);
    assert.strictEqual(afterDispatch.persisted, true);
    assert.strictEqual(model.getNodeSnapshot('victim'), null);
    host.dispose();
};

assertContractAndRelease();
assertHookObservationBoundary();
assertObserverBoundary();
console.log('NGVGE 0008.9.2.2 Lifecycle Observation Boundary Closure smoke passed.');
