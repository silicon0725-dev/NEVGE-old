#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    COMPONENT_LIFECYCLE_STATES,
    LIFECYCLE_ENTITY_KINDS,
    LIFECYCLE_PHASES,
    NODE_LIFECYCLE_STATES,
    RUNTIME_NODE_LIFECYCLE_CONTRACT,
    RuntimeNodeGraph,
    assertLifecycleTransition,
    assertPortableData,
    createRuntimeNodeModelHost
} = require('../src/lib/runtime-nodes');

const clone = value => JSON.parse(JSON.stringify(value));

const createGraph = () => new RuntimeNodeGraph({
    activeSceneId: 'scene-a',
    idFactory: (() => {
        let index = 0;
        return () => `lifecycle-node-${++index}`;
    })(),
    scenes: [
        {id: 'scene-a', name: 'Scene A'},
        {id: 'scene-b', name: 'Scene B'}
    ]
});

const phases = (events, filter) => events.filter(filter).map(event => event.phase);
const lifecycleOnly = events => events.filter(event => event.type === RUNTIME_NODE_LIFECYCLE_CONTRACT.eventType);

const assertCanonicalCreateAndReparent = () => {
    const graph = createGraph();
    const events = [];
    const hooks = [];
    graph.subscribe(event => events.push(event));

    const parentA = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'parent-a',
        sceneId: 'scene-a'
    });
    const parentB = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'parent-b',
        sceneId: 'scene-a'
    });
    const child = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        hooks: {
            onAttach: () => hooks.push('node:attach'),
            onDetach: () => hooks.push('node:detach'),
            onDisable: () => hooks.push('node:disable'),
            onEnable: () => hooks.push('node:enable'),
            onReady: () => hooks.push('node:ready'),
            onReorder: () => hooks.push('node:reorder')
        },
        id: 'child',
        parentId: parentA.id
    });
    const component = child.addComponent({
        hooks: {
            onAttach: () => hooks.push('component:attach'),
            onDetach: () => hooks.push('component:detach'),
            onDisable: () => hooks.push('component:disable'),
            onEnable: () => hooks.push('component:enable'),
            onReady: () => hooks.push('component:ready')
        },
        id: 'component',
        typeId: 'test.lifecycle'
    });
    const grandchild = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'grandchild',
        parentId: child.id
    });

    assert.strictEqual(child.state, NODE_LIFECYCLE_STATES.ACTIVE);
    assert.strictEqual(component.state, COMPONENT_LIFECYCLE_STATES.ACTIVE);
    assert.deepStrictEqual(
        phases(lifecycleOnly(events), event => event.nodeId === child.id && event.entityKind === LIFECYCLE_ENTITY_KINDS.NODE),
        [LIFECYCLE_PHASES.CREATE, LIFECYCLE_PHASES.ATTACH, LIFECYCLE_PHASES.READY, LIFECYCLE_PHASES.ENABLE]
    );
    assert.deepStrictEqual(
        phases(lifecycleOnly(events), event => event.componentId === component.id),
        [LIFECYCLE_PHASES.CREATE, LIFECYCLE_PHASES.ATTACH, LIFECYCLE_PHASES.READY, LIFECYCLE_PHASES.ENABLE]
    );

    const marker = graph.getStatus().lifecycleSequence;
    graph.setParent(child.id, parentB.id);
    const reparentEvents = graph.getLifecycleTrace().filter(event => event.sequence > marker);
    assert.deepStrictEqual(
        phases(reparentEvents, event => event.nodeId === child.id && event.entityKind === LIFECYCLE_ENTITY_KINDS.NODE),
        [LIFECYCLE_PHASES.DISABLE, LIFECYCLE_PHASES.DETACH, LIFECYCLE_PHASES.ATTACH, LIFECYCLE_PHASES.ENABLE]
    );
    assert.deepStrictEqual(
        phases(reparentEvents, event => event.componentId === component.id),
        [LIFECYCLE_PHASES.DISABLE, LIFECYCLE_PHASES.ENABLE]
    );
    assert.strictEqual(hooks.filter(value => value === 'node:ready').length, 1);
    assert.strictEqual(hooks.filter(value => value === 'component:ready').length, 1);
    assert.strictEqual(hooks.includes('component:detach'), false);
    const grandchildDisable = reparentEvents.find(event => (
        event.nodeId === grandchild.id && event.phase === LIFECYCLE_PHASES.DISABLE
    ));
    const childDetach = reparentEvents.find(event => (
        event.nodeId === child.id && event.phase === LIFECYCLE_PHASES.DETACH
    ));
    assert(grandchildDisable.sequence < childDetach.sequence);

    graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {parentId: parentB.id});
    const reorderMarker = graph.getStatus().lifecycleSequence;
    graph.reorderChild(child.id, 1);
    const reorderEvents = graph.getLifecycleTrace().filter(event => event.sequence > reorderMarker);
    assert.deepStrictEqual(
        phases(reorderEvents, event => event.nodeId === child.id),
        [LIFECYCLE_PHASES.REORDER]
    );
    assert.strictEqual(child.state, NODE_LIFECYCLE_STATES.ACTIVE);
    graph.dispose();
};

const assertSceneActivationAndDestroyOrder = () => {
    const graph = createGraph();
    const parent = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'destroy-parent',
        sceneId: 'scene-a'
    });
    const child = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'destroy-child',
        parentId: parent.id
    });
    const parentComponent = parent.addComponent({id: 'parent-component', typeId: 'test.parent'});
    const childComponent = child.addComponent({id: 'child-component', typeId: 'test.child'});

    graph.setActiveScene('scene-b');
    assert.strictEqual(parent.state, NODE_LIFECYCLE_STATES.DISABLED);
    assert.strictEqual(child.state, NODE_LIFECYCLE_STATES.DISABLED);
    assert.strictEqual(parentComponent.state, COMPONENT_LIFECYCLE_STATES.DISABLED);
    graph.setActiveScene('scene-a');
    assert.strictEqual(parent.state, NODE_LIFECYCLE_STATES.ACTIVE);
    assert.strictEqual(child.state, NODE_LIFECYCLE_STATES.ACTIVE);

    const marker = graph.getStatus().lifecycleSequence;
    graph.destroyNode(parent.id);
    const destroyed = graph.getLifecycleTrace().filter(event => event.sequence > marker);
    const findSequence = (phase, nodeId, componentId = null) => destroyed.find(event => (
        event.phase === phase && event.nodeId === nodeId && (
            componentId ? event.componentId === componentId : event.entityKind === LIFECYCLE_ENTITY_KINDS.NODE
        )
    )).sequence;

    assert(findSequence(LIFECYCLE_PHASES.DESTROY, child.id) < findSequence(LIFECYCLE_PHASES.DESTROY, parent.id));
    assert(findSequence(LIFECYCLE_PHASES.DISABLE, child.id) < findSequence(LIFECYCLE_PHASES.DETACH, child.id));
    assert(findSequence(LIFECYCLE_PHASES.DETACH, child.id) <
        findSequence(LIFECYCLE_PHASES.DESTROY, child.id, childComponent.id));
    assert(findSequence(LIFECYCLE_PHASES.DESTROY, child.id, childComponent.id) <
        findSequence(LIFECYCLE_PHASES.DESTROY, child.id));
    assert.strictEqual(parent.state, NODE_LIFECYCLE_STATES.DESTROYED);
    assert.strictEqual(child.state, NODE_LIFECYCLE_STATES.DESTROYED);
    assert.strictEqual(parentComponent.state, COMPONENT_LIFECYCLE_STATES.DESTROYED);
    assert.strictEqual(childComponent.state, COMPONENT_LIFECYCLE_STATES.DESTROYED);
    graph.dispose();
};

const assertHookAndListenerIsolation = () => {
    const graph = createGraph();
    const received = [];
    graph.subscribe(() => {
        throw new Error('listener failed');
    });
    graph.subscribe(event => received.push(event));
    const node = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        hooks: {
            onAttach: () => { throw new Error('attach failed'); },
            onDestroy: () => { throw new Error('destroy failed'); },
            onEnable: () => { throw new Error('enable failed'); }
        },
        id: 'hook-errors',
        sceneId: 'scene-a'
    });
    const component = node.addComponent({
        hooks: {
            onAttach: () => { throw new Error('component attach failed'); },
            onDestroy: () => { throw new Error('component destroy failed'); }
        },
        id: 'hook-component',
        typeId: 'test.hook-errors'
    });

    assert.strictEqual(node.state, NODE_LIFECYCLE_STATES.ACTIVE);
    assert.strictEqual(component.state, COMPONENT_LIFECYCLE_STATES.ACTIVE);
    graph.destroyNode(node.id);
    assert.strictEqual(node.state, NODE_LIFECYCLE_STATES.DESTROYED);
    assert.strictEqual(component.state, COMPONENT_LIFECYCLE_STATES.DESTROYED);
    assert(graph.getStatus().lifecycleHookErrorCount >= 5);
    assert(graph.getStatus().listenerErrorCount > 0);
    assert(received.some(event => event.type === RUNTIME_NODE_LIFECYCLE_CONTRACT.hookErrorEventType));
    received.filter(event => (
        event.type === RUNTIME_NODE_LIFECYCLE_CONTRACT.eventType ||
        event.type === RUNTIME_NODE_LIFECYCLE_CONTRACT.hookErrorEventType
    )).forEach(event => assert.doesNotThrow(() => assertPortableData(event)));
    graph.dispose();
    assert.doesNotThrow(() => graph.dispose());
};

const assertDetachedOfflineRestoreAndBoundedTrace = () => {
    const graph = createGraph();
    const detached = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        attach: false,
        components: [{id: 'detached-component', typeId: 'test.detached'}],
        id: 'detached',
        sceneId: 'scene-a'
    });
    const detachedComponent = detached.getComponentById('detached-component');
    assert.strictEqual(detached.state, NODE_LIFECYCLE_STATES.CREATED);
    assert.strictEqual(detached.isReady(), false);
    assert.strictEqual(detachedComponent.state, COMPONENT_LIFECYCLE_STATES.ATTACHED);

    graph.setParent(detached.id, graph.getSceneRoot('scene-a').id);
    assert.strictEqual(detached.state, NODE_LIFECYCLE_STATES.ACTIVE);
    assert.strictEqual(detached.isReady(), true);
    assert.strictEqual(detachedComponent.state, COMPONENT_LIFECYCLE_STATES.ACTIVE);

    const offline = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        components: [{id: 'offline-component', typeId: 'test.offline'}],
        id: 'offline',
        sceneId: 'scene-b'
    });
    assert.strictEqual(offline.state, NODE_LIFECYCLE_STATES.DISABLED);
    assert.strictEqual(offline.getComponentById('offline-component').state, COMPONENT_LIFECYCLE_STATES.DISABLED);

    const serialized = graph.exportState();
    const offlineRecord = serialized.nodes.find(node => node.id === offline.id);
    offlineRecord.state = NODE_LIFECYCLE_STATES.ACTIVE;
    offlineRecord.activeInHierarchy = true;
    offlineRecord.ready = false;
    offlineRecord.components[0].state = COMPONENT_LIFECYCLE_STATES.ACTIVE;
    offlineRecord.components[0].activeInHierarchy = true;
    const restored = RuntimeNodeGraph.createFromState(serialized).graph;
    const restoredOffline = restored.getNode(offline.id);
    assert.strictEqual(restoredOffline.state, NODE_LIFECYCLE_STATES.DISABLED);
    assert.strictEqual(restoredOffline.activeInHierarchy, false);
    assert.strictEqual(
        restoredOffline.getComponentById('offline-component').state,
        COMPONENT_LIFECYCLE_STATES.DISABLED
    );
    const restoredRecord = restored.exportState().nodes.find(node => node.id === offline.id);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(restoredRecord, 'state'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(restoredRecord, 'activeInHierarchy'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(restoredRecord.components[0], 'state'), false);
    restored.dispose();

    for (let index = 0; index < 140; index += 1) {
        const node = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: `trace-${index}`,
            sceneId: 'scene-a'
        });
        node.addComponent({id: `trace-component-${index}`, typeId: `test.trace.${index}`});
        graph.destroyNode(node.id);
    }
    const trace = graph.getLifecycleTrace();
    assert.strictEqual(trace.length, 512);
    assert.strictEqual(trace[trace.length - 1].sequence, graph.getStatus().lifecycleSequence);
    assert(trace[0].sequence > 1);
    graph.dispose();
};

const createSceneDataModel = () => {
    let project = {
        activeSceneId: 'scene-a',
        extensionData: {},
        scenes: [{id: 'scene-a', name: 'Scene A'}]
    };
    const listeners = new Set();
    return {
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

const assertPortableContractAndPersistence = () => {
    const host = createRuntimeNodeModelHost(createSceneDataModel());
    const model = host.publicCapability;
    const contract = model.getApiContract();
    assert.strictEqual(contract.lifecycleContract.contractId, 'ngvge.runtime-node-lifecycle');
    assert.strictEqual(contract.lifecycleContract.contractVersion, '1');
    assert.strictEqual(contract.lifecycleContract.hookErrorPolicy, 'isolate-and-report');
    assert.strictEqual(contract.lifecycleContract.hookPortability, 'local-provider-only');
    assert.doesNotThrow(() => assertPortableData(contract.lifecycleContract));

    const created = model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'portable-lifecycle',
        sceneId: 'scene-a'
    });
    assert.strictEqual(created.applied, true);
    assert.strictEqual(created.snapshot.state, NODE_LIFECYCLE_STATES.ACTIVE);
    const state = model.exportState();
    const record = state.nodes.find(node => node.id === 'portable-lifecycle');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(record, 'state'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(record, 'activeInHierarchy'), false);

    const debug = model.getDebugSnapshot();
    assert.strictEqual(debug.lifecycle.contract.contractVersion, '1');
    assert(debug.lifecycle.trace.some(event => event.nodeId === 'portable-lifecycle'));
    assert.doesNotThrow(() => assertPortableData(debug));
    host.dispose();
};

const assertTransitionTable = () => {
    assert.doesNotThrow(() => assertLifecycleTransition(
        LIFECYCLE_ENTITY_KINDS.NODE,
        NODE_LIFECYCLE_STATES.CREATED,
        NODE_LIFECYCLE_STATES.ATTACHED
    ));
    assert.throws(() => assertLifecycleTransition(
        LIFECYCLE_ENTITY_KINDS.NODE,
        NODE_LIFECYCLE_STATES.DESTROYED,
        NODE_LIFECYCLE_STATES.ACTIVE
    ), error => error && error.code === 'RUNTIME_LIFECYCLE_TRANSITION_INVALID');
    assert.strictEqual(Object.isFrozen(RUNTIME_NODE_LIFECYCLE_CONTRACT), true);
    assert.strictEqual(RUNTIME_NODE_LIFECYCLE_CONTRACT.readySemantics, 'once-per-instance');
    const moduleDefinitionSource = fs.readFileSync(path.join(
        __dirname,
        '../src/lib/scene-system/module-definition.js'
    ), 'utf8');
    assert(/version:\s*'0\.8\.9\.(?:2(?:\.[1234])?|3(?:\.1(?:\.[1234])?)?|4(?:\.1(?:\.[123456])?)?|5|6(?:\.1(?:\.1)?)?|7)'/.test(moduleDefinitionSource));
};

assertTransitionTable();
assertCanonicalCreateAndReparent();
assertSceneActivationAndDestroyOrder();
assertHookAndListenerIsolation();
assertDetachedOfflineRestoreAndBoundedTrace();
assertPortableContractAndPersistence();
console.log('NGVGE 0008.9.2 Runtime Node Lifecycle Conformance smoke passed.');
