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
    NODE_SCOPES,
    RUNTIME_NODE_LIFECYCLE_CONTRACT,
    RuntimeNode,
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
        return () => `closure-node-${++index}`;
    })(),
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

const assertHookReentrancyClosure = () => {
    const graph = createGraph();
    const node = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        hooks: {
            onDisable: () => graph.setNodeEnabled('reentrant-enable', true)
        },
        id: 'reentrant-enable',
        sceneId: 'scene-a'
    });

    graph.setNodeEnabled(node.id, false);
    assert.strictEqual(node.enabledSelf, false);
    assert.strictEqual(node.activeInHierarchy, false);
    assert.strictEqual(node.state, NODE_LIFECYCLE_STATES.DISABLED);

    const nodeTrace = graph.getLifecycleTrace({nodeId: node.id});
    const reentrantError = nodeTrace.find(event => (
        event.type === RUNTIME_NODE_LIFECYCLE_CONTRACT.hookErrorEventType &&
        event.code === RUNTIME_NODE_LIFECYCLE_CONTRACT.hookReentrancyErrorCode
    ));
    assert(reentrantError);
    assert.strictEqual(reentrantError.operation, 'setNodeEnabled');
    const finalLifecycle = nodeTrace.filter(event => event.type === RUNTIME_NODE_LIFECYCLE_CONTRACT.eventType).pop();
    assert.strictEqual(finalLifecycle.phase, LIFECYCLE_PHASES.DISABLE);
    assert.strictEqual(finalLifecycle.toState, NODE_LIFECYCLE_STATES.DISABLED);
    assert(finalLifecycle.sequence > reentrantError.sequence);

    const selfDestroy = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        hooks: {
            onAttach: () => graph.destroyNode('reentrant-destroy')
        },
        id: 'reentrant-destroy',
        sceneId: 'scene-a'
    });
    assert.strictEqual(graph.getNode(selfDestroy.id), selfDestroy);
    assert.strictEqual(selfDestroy.state, NODE_LIFECYCLE_STATES.ACTIVE);
    const selfDestroyTrace = graph.getLifecycleTrace({nodeId: selfDestroy.id});
    assert(selfDestroyTrace.some(event => (
        event.type === RUNTIME_NODE_LIFECYCLE_CONTRACT.hookErrorEventType &&
        event.code === 'RUNTIME_LIFECYCLE_REENTRANT_MUTATION'
    )));
    assert.strictEqual(selfDestroyTrace.some(event => event.phase === LIFECYCLE_PHASES.DESTROY), false);
    assert.deepStrictEqual(
        selfDestroyTrace.filter(event => event.type === 'lifecycle').map(event => event.phase),
        [
            LIFECYCLE_PHASES.CREATE,
            LIFECYCLE_PHASES.ATTACH,
            LIFECYCLE_PHASES.READY,
            LIFECYCLE_PHASES.ENABLE
        ]
    );

    const componentOwner = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'component-owner',
        sceneId: 'scene-a'
    });
    const component = componentOwner.addComponent({
        data: {value: 1},
        hooks: {
            onDisable: () => graph.patchComponentData('component-owner', 'reentrant-component', {value: 2})
        },
        id: 'reentrant-component',
        typeId: 'test.reentrant-component'
    });
    graph.setNodeEnabled(componentOwner.id, false);
    assert.deepStrictEqual(component.data, {value: 1});
    assert(graph.getLifecycleTrace({componentId: component.id}).some(event => (
        event.type === 'lifecycle:error' && event.code === 'RUNTIME_LIFECYCLE_REENTRANT_MUTATION'
    )));
    graph.dispose();
};

const assertGenerationClosure = () => {
    const graph = createGraph();
    graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {id: 'generation-node', sceneId: 'scene-a'});
    const state = graph.exportState();
    const before = graph.getStatus();
    graph.importState(state);
    const after = graph.getStatus();
    assert.strictEqual(after.runtimeGeneration, before.runtimeGeneration + 1);
    assert.strictEqual(after.lifecycleSequence, 1);
    const trace = graph.getLifecycleTrace();
    assert.strictEqual(trace.length, 1);
    assert.strictEqual(trace[0].type, RUNTIME_NODE_LIFECYCLE_CONTRACT.replacementEventType);
    assert.strictEqual(trace[0].runtimeGeneration, after.runtimeGeneration);
    assert.strictEqual(trace[0].previousRuntimeGeneration, before.runtimeGeneration);
    assert.strictEqual(trace[0].sequence, 1);

    const failedBefore = graph.getStatus();
    assert.throws(() => graph.importState({version: 999, scenes: [], nodes: []}));
    const failedAfter = graph.getStatus();
    assert.strictEqual(failedAfter.runtimeGeneration, failedBefore.runtimeGeneration);
    assert.strictEqual(failedAfter.lifecycleSequence, failedBefore.lifecycleSequence);

    graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {id: 'post-import', sceneId: 'scene-a'});
    graph.getLifecycleTrace().forEach(event => {
        assert.strictEqual(event.runtimeGeneration, after.runtimeGeneration);
        assert(Number.isInteger(event.sequence) && event.sequence > 0);
        assert.doesNotThrow(() => assertPortableData(event));
    });
    assert.strictEqual(Object.prototype.hasOwnProperty.call(graph.exportState(), 'runtimeGeneration'), false);
    graph.dispose();
};

const assertCapturedPublicCapabilityReentrancy = () => {
    const host = createRuntimeNodeModelHost(createSceneDataModel());
    const model = host.publicCapability;
    class ReentrantProviderNode extends RuntimeNode {
        constructor (options) {
            super(Object.assign({}, options, {
                hooks: {
                    onAttach: () => model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
                        id: 'nested-public-mutation',
                        sceneId: 'scene-a'
                    })
                }
            }));
        }
    }
    host.typeRegistrationCapability.registerNodeTypeDescriptor({
        allowedScopes: [NODE_SCOPES.SCENE],
        label: 'Reentrant Provider Node',
        ownerModuleId: 'test.lifecycle-closure',
        typeId: 'test.reentrant-provider',
        version: '1'
    });
    host.typeRegistrationCapability.bindNodeTypeProvider('test.reentrant-provider', {
        ctor: ReentrantProviderNode
    });
    const events = [];
    model.subscribe(event => events.push(event));
    const result = model.createNode('test.reentrant-provider', {
        id: 'provider-node',
        sceneId: 'scene-a'
    });
    assert.strictEqual(result.applied, true);
    assert.strictEqual(model.getNodeSnapshot('nested-public-mutation'), null);
    assert(events.some(event => (
        event.type === 'lifecycle:error' &&
        event.code === 'RUNTIME_LIFECYCLE_REENTRANT_MUTATION' &&
        event.nodeId === 'provider-node'
    )));
    host.dispose();
};


const assertShadowImportReentrancyClosure = () => {
    const host = createRuntimeNodeModelHost(createSceneDataModel());
    const model = host.publicCapability;
    let mutateDuringAttach = false;

    class ShadowImportProviderNode extends RuntimeNode {
        constructor (options) {
            super(Object.assign({}, options, {
                hooks: {
                    onAttach: () => {
                        if (mutateDuringAttach) {
                            model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
                                id: 'shadow-import-nested-mutation',
                                sceneId: 'scene-a'
                            });
                        }
                    }
                }
            }));
        }
    }

    host.typeRegistrationCapability.registerNodeTypeDescriptor({
        allowedScopes: [NODE_SCOPES.SCENE],
        label: 'Shadow Import Provider Node',
        ownerModuleId: 'test.lifecycle-closure',
        typeId: 'test.shadow-import-provider',
        version: '1'
    });
    host.typeRegistrationCapability.bindNodeTypeProvider('test.shadow-import-provider', {
        ctor: ShadowImportProviderNode
    });

    const created = model.createNode('test.shadow-import-provider', {
        id: 'shadow-import-source',
        sceneId: 'scene-a'
    });
    assert.strictEqual(created.applied, true);
    const state = model.exportState();
    const before = model.getStatus();

    mutateDuringAttach = true;
    const imported = host.persistenceController.importState(state);
    const after = model.getStatus();

    assert.strictEqual(imported.applied, true);
    assert.strictEqual(model.getNodeSnapshot('shadow-import-nested-mutation'), null);
    assert.strictEqual(after.runtimeGeneration, before.runtimeGeneration + 1);
    assert(after.lifecycleHookErrorCount > before.lifecycleHookErrorCount);
    assert.strictEqual(after.lifecycleSequence, 1);
    host.dispose();
};

const assertPublicObserverDiagnostics = () => {
    const host = createRuntimeNodeModelHost(createSceneDataModel());
    const model = host.publicCapability;
    const observed = [];
    model.subscribe(() => {
        throw new Error('public observer failed');
    });
    model.subscribe(event => observed.push(event));

    const created = model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'public-observer-node',
        sceneId: 'scene-a'
    });
    assert.strictEqual(created.applied, true);
    const status = model.getStatus();
    assert(status.observerErrorCount > 0);
    assert.strictEqual(
        status.listenerErrorCount,
        status.graphListenerErrorCount + status.observerErrorCount
    );
    assert(observed.length > 0);

    const beforeGeneration = status.runtimeGeneration;
    const imported = host.persistenceController.importState(model.exportState());
    assert.strictEqual(imported.applied, true);
    const importedStatus = model.getStatus();
    assert.strictEqual(importedStatus.runtimeGeneration, beforeGeneration + 1);
    const replacement = observed.find(event => (
        event.type === RUNTIME_NODE_LIFECYCLE_CONTRACT.replacementEventType &&
        event.runtimeGeneration === importedStatus.runtimeGeneration
    ));
    const stateImport = observed.find(event => (
        event.type === 'state:import' && event.runtimeGeneration === importedStatus.runtimeGeneration
    ));
    assert(replacement);
    assert(stateImport);
    assert.strictEqual(replacement.sequence, 1);
    assert.strictEqual(stateImport.lifecycleSequence, 1);

    const debug = model.getDebugSnapshot();
    assert.strictEqual(debug.lifecycle.runtimeGeneration, importedStatus.runtimeGeneration);
    assert.strictEqual(debug.status.observerErrorCount, importedStatus.observerErrorCount);
    assert.doesNotThrow(() => assertPortableData(debug));
    host.dispose();
};

const assertSameStateAndDetachSemantics = () => {
    const graph = createGraph();
    let enableHookCount = 0;
    const node = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        hooks: {onEnable: () => { enableHookCount += 1; }},
        id: 'same-state-node',
        sceneId: 'scene-a'
    });
    const component = node.addComponent({
        hooks: {onEnable: () => { enableHookCount += 1; }},
        id: 'same-state-component',
        typeId: 'test.same-state'
    });
    const initialHookCount = enableHookCount;
    const initialStatus = graph.getStatus();
    const initialTraceLength = graph.getLifecycleTrace().length;

    assert.strictEqual(node._transition(
        NODE_LIFECYCLE_STATES.ACTIVE,
        LIFECYCLE_PHASES.ENABLE,
        'onEnable'
    ), false);
    assert.strictEqual(component._transition(
        COMPONENT_LIFECYCLE_STATES.ACTIVE,
        LIFECYCLE_PHASES.ENABLE,
        'onEnable',
        node,
        graph
    ), false);
    assert.strictEqual(enableHookCount, initialHookCount);
    assert.strictEqual(graph.getStatus().lifecycleSequence, initialStatus.lifecycleSequence);
    assert.strictEqual(graph.getLifecycleTrace().length, initialTraceLength);

    const destroyedNode = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'destroyed-same-state-node',
        sceneId: 'scene-a'
    });
    const destroyedComponent = destroyedNode.addComponent({
        id: 'destroyed-same-state-component',
        typeId: 'test.destroyed-same-state'
    });
    graph.destroyNode(destroyedNode.id);
    const destroyedStatus = graph.getStatus();
    const destroyedTraceLength = graph.getLifecycleTrace().length;
    assert.strictEqual(destroyedNode._transition(
        NODE_LIFECYCLE_STATES.DESTROYED,
        LIFECYCLE_PHASES.DESTROY,
        'onDestroy'
    ), false);
    assert.strictEqual(destroyedComponent._transition(
        COMPONENT_LIFECYCLE_STATES.DESTROYED,
        LIFECYCLE_PHASES.DESTROY,
        'onDestroy',
        destroyedNode,
        graph
    ), false);
    assert.strictEqual(graph.getStatus().lifecycleSequence, destroyedStatus.lifecycleSequence);
    assert.strictEqual(graph.getLifecycleTrace().length, destroyedTraceLength);

    assert.throws(() => assertLifecycleTransition(
        LIFECYCLE_ENTITY_KINDS.NODE,
        NODE_LIFECYCLE_STATES.ACTIVE,
        NODE_LIFECYCLE_STATES.ACTIVE
    ), error => error && error.code === 'RUNTIME_LIFECYCLE_TRANSITION_INVALID');
    assert.throws(() => assertLifecycleTransition(
        LIFECYCLE_ENTITY_KINDS.NODE,
        NODE_LIFECYCLE_STATES.ATTACHED,
        NODE_LIFECYCLE_STATES.ACTIVE
    ), error => error && error.code === 'RUNTIME_LIFECYCLE_TRANSITION_INVALID');
    assert.doesNotThrow(() => assertLifecycleTransition(
        LIFECYCLE_ENTITY_KINDS.NODE,
        NODE_LIFECYCLE_STATES.ATTACHED,
        NODE_LIFECYCLE_STATES.ACTIVE,
        {readyInvoked: true}
    ));

    const detachMarker = graph.getStatus().lifecycleSequence;
    graph.detachNode(node.id);
    const detachTrace = graph.getLifecycleTrace().filter(event => event.sequence > detachMarker);
    assert.strictEqual(node.state, NODE_LIFECYCLE_STATES.DETACHED);
    assert.strictEqual(component.state, COMPONENT_LIFECYCLE_STATES.DISABLED);
    assert.strictEqual(component.ownerId, node.id);
    assert.strictEqual(detachTrace.some(event => (
        event.componentId === component.id && event.phase === LIFECYCLE_PHASES.DETACH
    )), false);

    const removeMarker = graph.getStatus().lifecycleSequence;
    graph.removeComponent(node.id, component.id);
    const removeTrace = graph.getLifecycleTrace().filter(event => event.sequence > removeMarker);
    assert(removeTrace.some(event => (
        event.componentId === component.id && event.phase === LIFECYCLE_PHASES.DETACH
    )));
    assert(removeTrace.some(event => (
        event.componentId === component.id && event.phase === LIFECYCLE_PHASES.DESTROY
    )));
    graph.dispose();
};

const assertContractAndVersion = () => {
    assert.strictEqual(RUNTIME_NODE_LIFECYCLE_CONTRACT.contractVersion, '1');
    assert.strictEqual(
        RUNTIME_NODE_LIFECYCLE_CONTRACT.hookReentrancyPolicy,
        'reject-synchronous-runtime-semantic-mutation'
    );
    assert.strictEqual(
        RUNTIME_NODE_LIFECYCLE_CONTRACT.eventSchema.orderingIdentity,
        '(runtimeGeneration, sequence)'
    );
    assert.strictEqual(
        RUNTIME_NODE_LIFECYCLE_CONTRACT.detachSemantics.nodeDetachRemovesComponentOwnership,
        false
    );
    assert.doesNotThrow(() => assertPortableData(RUNTIME_NODE_LIFECYCLE_CONTRACT));
    const moduleDefinitionSource = fs.readFileSync(
        path.join(__dirname, '../src/lib/scene-system/module-definition.js'),
        'utf8'
    );
    assert(/version:\s*'0\.8\.9\.(?:2\.[12]|3(?:\.1(?:\.[1234])?)?|4(?:\.1(?:\.[123456])?)?|5|6(?:\.1(?:\.1)?)?|7)'/.test(moduleDefinitionSource));
};

assertHookReentrancyClosure();
assertGenerationClosure();
assertCapturedPublicCapabilityReentrancy();
assertShadowImportReentrancyClosure();
assertPublicObserverDiagnostics();
assertSameStateAndDetachSemantics();
assertContractAndVersion();
console.log('NGVGE 0008.9.2.1 Runtime Lifecycle Reentrancy and Generation Closure smoke passed.');
