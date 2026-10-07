#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {assertRuntimeDetachedPersistenceContract} = require('../test/regression/contracts/runtime-detached-persistence');
const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    NODE_SCOPES,
    RuntimeNode,
    createRuntimeNodeModelHost
} = require('../src/lib/runtime-nodes');

const clone = value => JSON.parse(JSON.stringify(value));

const createSceneDataModel = () => {
    let project = {
        activeSceneId: 'scene-a',
        extensionData: {},
        scenes: [{id: 'scene-a', name: 'Scene A'}]
    };
    let failureMode = null;
    let writeCount = 0;
    const listeners = new Set();
    const service = {
        getStatus: () => ({}),
        readProject: () => clone(project),
        subscribe: listener => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        writeProject: nextProject => {
            writeCount += 1;
            if (failureMode === 'before-write') {
                const error = new Error('Synthetic persistence failure before write.');
                error.code = 'SYNTHETIC_PERSISTENCE_FAILURE';
                throw error;
            }
            project = clone(nextProject);
            listeners.forEach(listener => listener({type: 'data'}));
            if (failureMode === 'after-write') {
                const error = new Error('Synthetic observer failure after authoritative write.');
                error.code = 'SYNTHETIC_POST_WRITE_FAILURE';
                throw error;
            }
        }
    };
    return {
        getProject: () => clone(project),
        getWriteCount: () => writeCount,
        service,
        setFailureMode: mode => { failureMode = mode; }
    };
};

const getPersistedRuntimeState = data => {
    const project = data.getProject();
    return project.extensionData && project.extensionData.runtimeNodeModel || null;
};

const assertContract = model => {
    const contract = model.getApiContract().mutationResultContract;
    assert.strictEqual(contract.transactionSemantics, 'single-command-atomic');
    assert.strictEqual(contract.commitEventsAfterPersistence, true);
    assert.strictEqual(contract.failedMutationApplied, false);
    assert.strictEqual(contract.rollbackPreservesRuntimeGeneration, true);
    assert.strictEqual(contract.multiCommandTransactions, false);
    assert.deepStrictEqual(contract.fields, ['applied', 'error', 'persisted', 'snapshot']);
};

const assertCreateRollback = () => {
    const data = createSceneDataModel();
    const host = createRuntimeNodeModelHost(data.service);
    const model = host.publicCapability;
    const events = [];
    model.subscribe(event => events.push(event));
    const beforeGeneration = model.getStatus().runtimeGeneration;
    const beforeToken = host.snapshotCapability.getRevision();

    data.setFailureMode('before-write');
    const result = model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'failed-create',
        sceneId: 'scene-a'
    }, {transactionId: 'tx:create-fail'});

    assert.strictEqual(result.applied, false);
    assert.strictEqual(result.persisted, false);
    assert.strictEqual(result.snapshot, null);
    assert.strictEqual(result.error.code, 'SYNTHETIC_PERSISTENCE_FAILURE');
    assert.strictEqual(model.getNodeSnapshot('failed-create'), null);
    assert.strictEqual(events.length, 0);
    assert.strictEqual(model.getStatus().runtimeGeneration, beforeGeneration);
    const afterToken = host.snapshotCapability.getRevision();
    assert.strictEqual(afterToken.runtimeGeneration, beforeToken.runtimeGeneration);
    assert(afterToken.graphRevision > beforeToken.graphRevision,
        'Failed attempts must advance, not rewind, the monotonic Graph revision.');
    assert.strictEqual(getPersistedRuntimeState(data), null);
    host.dispose();
};

const assertPatchRollbackAndCommitEventOrder = () => {
    const data = createSceneDataModel();
    const host = createRuntimeNodeModelHost(data.service);
    const model = host.publicCapability;
    assert(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'patch-target',
        name: 'Before',
        sceneId: 'scene-a'
    }).applied);
    const before = model.getNodeSnapshot('patch-target');
    const events = [];
    model.subscribe(event => events.push(event));

    data.setFailureMode('before-write');
    const failed = model.patchNode('patch-target', {name: 'After'}, {
        transactionId: 'tx:patch-fail'
    });
    assert.strictEqual(failed.applied, false);
    assert.deepStrictEqual(model.getNodeSnapshot('patch-target'), before);
    assert.strictEqual(events.length, 0);
    const failedToken = host.snapshotCapability.getRevision();

    data.setFailureMode(null);
    let persistedBeforeObserver = false;
    const unsubscribe = model.subscribe(event => {
        if (event.transactionId !== 'tx:patch-success') return;
        const state = getPersistedRuntimeState(data);
        const record = state.nodes.find(node => node.id === 'patch-target');
        persistedBeforeObserver = Boolean(record && record.name === 'Committed');
    });
    const committed = model.patchNode('patch-target', {name: 'Committed'}, {
        transactionId: 'tx:patch-success'
    });
    unsubscribe();
    assert.strictEqual(committed.applied, true);
    assert.strictEqual(committed.persisted, true);
    assert.strictEqual(committed.snapshot.name, 'Committed');
    assert.strictEqual(persistedBeforeObserver, true, 'Observer event was published before Project Source commit.');
    const committedToken = host.snapshotCapability.getRevision();
    assert(committedToken.graphRevision > failedToken.graphRevision,
        'A failed-attempt revision must never be reused by a later committed state.');
    host.dispose();
};

const assertDestroyRollbackPreservesLiveIdentityAndDefersHooks = () => {
    const data = createSceneDataModel();
    let retainedNode = null;
    let resources = null;
    let destroyHookCount = 0;
    let createHookCount = 0;
    let projectVisibleDuringDestroyHook = null;
    const host = createRuntimeNodeModelHost(data.service);

    class TransactionNode extends RuntimeNode {
        constructor (options) {
            super(Object.assign({}, options, {
                hooks: {
                    onCreate: context => {
                        createHookCount += 1;
                        resources = context.resources;
                        resources.set('resource', {id: 'resource-1'});
                    },
                    onDestroy: context => {
                        destroyHookCount += 1;
                        const state = getPersistedRuntimeState(data);
                        projectVisibleDuringDestroyHook = Boolean(state && !state.nodes.some(node => node.id === 'tx-node'));
                        context.resources.delete('resource');
                    }
                }
            }));
            retainedNode = this;
        }
    }

    host.typeRegistrationCapability.registerNodeTypeDescriptor({
        allowedScopes: [NODE_SCOPES.SCENE],
        defaultScope: NODE_SCOPES.SCENE,
        label: 'Transaction Node',
        ownerModuleId: 'test.transaction',
        typeId: 'test.transaction-node',
        version: '1'
    });
    host.typeRegistrationCapability.bindNodeTypeProvider('test.transaction-node', {ctor: TransactionNode});

    const created = host.publicCapability.createNode('test.transaction-node', {
        id: 'tx-node',
        sceneId: 'scene-a'
    });
    assert.strictEqual(created.applied, true);
    assert.strictEqual(createHookCount, 1);
    assert(resources && resources.has('resource'));
    const originalNode = retainedNode;
    const originalSnapshot = host.publicCapability.getNodeSnapshot('tx-node');
    const events = [];
    host.publicCapability.subscribe(event => events.push(event));

    data.setFailureMode('before-write');
    const failedDestroy = host.publicCapability.destroyNode('tx-node', {transactionId: 'tx:destroy-fail'});
    assert.strictEqual(failedDestroy.applied, false);
    assert.strictEqual(destroyHookCount, 0, 'onDestroy ran before persistence commit.');
    assert.strictEqual(retainedNode, originalNode);
    assert.deepStrictEqual(host.publicCapability.getNodeSnapshot('tx-node'), originalSnapshot);
    assert.strictEqual(originalNode.state, originalSnapshot.state);
    assert.strictEqual(resources.has('resource'), true);
    assert.strictEqual(events.length, 0);

    data.setFailureMode(null);
    const committedDestroy = host.publicCapability.destroyNode('tx-node', {transactionId: 'tx:destroy-success'});
    assert.strictEqual(committedDestroy.applied, true);
    assert.strictEqual(destroyHookCount, 1);
    assert.strictEqual(projectVisibleDuringDestroyHook, true,
        'onDestroy ran before the committed Project Source no longer contained the Node.');
    assert.strictEqual(resources.has('resource'), false);
    assert.strictEqual(host.publicCapability.getNodeSnapshot('tx-node'), null);
    host.dispose();
};

const assertComponentRollbackAndImplicitDescriptorRollback = () => {
    const data = createSceneDataModel();
    const host = createRuntimeNodeModelHost(data.service);
    const model = host.publicCapability;
    assert(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'component-owner',
        sceneId: 'scene-a'
    }).applied);
    const registryRevisionBefore = host.snapshotCapability.getRevision().registryRevision;

    data.setFailureMode('before-write');
    const failedAdd = model.addComponent('component-owner', {
        data: {value: 1},
        id: 'failed-component',
        typeId: 'test.failed-implicit'
    });
    assert.strictEqual(failedAdd.applied, false);
    assert.strictEqual(model.getComponentSnapshot('component-owner', 'failed-component'), null);
    assert.strictEqual(host.typeRegistrationCapability.getComponentTypeDescriptor('test.failed-implicit'), null,
        'Implicit descriptor leaked from failed Component mutation.');
    assert(host.snapshotCapability.getRevision().registryRevision > registryRevisionBefore,
        'Registry revision must remain monotonic after implicit Descriptor rollback.');

    data.setFailureMode(null);
    const added = model.addComponent('component-owner', {
        data: {value: 1},
        id: 'component-1',
        typeId: 'test.component'
    });
    assert.strictEqual(added.applied, true);
    const before = model.getComponentSnapshot('component-owner', 'component-1');
    data.setFailureMode('before-write');
    const failedPatch = model.patchComponent('component-owner', 'component-1', {value: 2});
    assert.strictEqual(failedPatch.applied, false);
    assert.deepStrictEqual(model.getComponentSnapshot('component-owner', 'component-1'), before);
    const failedRemove = model.removeComponent('component-owner', 'component-1');
    assert.strictEqual(failedRemove.applied, false);
    assert.deepStrictEqual(model.getComponentSnapshot('component-owner', 'component-1'), before);
    host.dispose();
};

const assertParentAndEnabledRollback = () => {
    const data = createSceneDataModel();
    const host = createRuntimeNodeModelHost(data.service);
    const model = host.publicCapability;
    assert(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {id: 'parent-a', sceneId: 'scene-a'}).applied);
    assert(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {id: 'parent-b', sceneId: 'scene-a'}).applied);
    assert(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'child', parentId: 'parent-a', sceneId: 'scene-a'
    }).applied);
    const beforeChild = model.getNodeSnapshot('child');
    const beforeA = model.getNodeSnapshot('parent-a');
    const beforeB = model.getNodeSnapshot('parent-b');

    data.setFailureMode('before-write');
    assert.strictEqual(model.setParent('child', 'parent-b').applied, false);
    assert.deepStrictEqual(model.getNodeSnapshot('child'), beforeChild);
    assert.deepStrictEqual(model.getNodeSnapshot('parent-a'), beforeA);
    assert.deepStrictEqual(model.getNodeSnapshot('parent-b'), beforeB);
    assert.strictEqual(model.setNodeEnabled('child', false).applied, false);
    assert.deepStrictEqual(model.getNodeSnapshot('child'), beforeChild);
    host.dispose();
};

const assertPortableMutationSurfaceRollsBackExactly = () => {
    const mutationCases = [
        {
            name: 'addComponent',
            run: model => model.addComponent('child-a', {
                data: {value: 2}, id: 'component-new', typeId: 'test.atomic-new'
            })
        },
        {
            name: 'createNode',
            run: model => model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
                id: 'created-fail', sceneId: 'scene-a'
            })
        },
        {name: 'destroyNode-subtree', run: model => model.destroyNode('parent-a')},
        {name: 'detachNode', run: model => model.detachNode('child-a')},
        {name: 'duplicateNode-subtree', run: model => model.duplicateNode('parent-a', {name: 'Parent Copy'})},
        {name: 'patchComponent', run: model => model.patchComponent('child-a', 'component-a', {value: 9})},
        {name: 'patchComponentData-alias', run: model => model.patchComponentData('child-a', 'component-a', {value: 9})},
        {name: 'patchNode', run: model => model.patchNode('child-a', {name: 'Patched'})},
        {name: 'patchNodeMetadata', run: model => model.patchNodeMetadata('child-a', {atomic: true})},
        {name: 'removeComponent', run: model => model.removeComponent('child-a', 'component-a')},
        {name: 'reorderChild', run: model => model.reorderChild('child-b', 0)},
        {name: 'renameNode-alias', run: model => model.renameNode('child-a', 'Renamed')},
        {name: 'setComponentData', run: model => model.setComponentData('child-a', 'component-a', {value: 10})},
        {name: 'setComponentEnabled', run: model => model.setComponentEnabled('child-a', 'component-a', false)},
        {name: 'setNodeEnabled', run: model => model.setNodeEnabled('child-a', false)},
        {name: 'setParent', run: model => model.setParent('child-a', 'parent-b')}
    ];

    const coveredMethods = new Set([
        'addComponent', 'createNode', 'destroyNode', 'detachNode', 'duplicateNode', 'patchComponent',
        'patchNode', 'patchNodeMetadata', 'removeComponent', 'reorderChild', 'setComponentData',
        'setComponentEnabled', 'setNodeEnabled', 'setParent'
    ]);
    const contractHostData = createSceneDataModel();
    const contractHost = createRuntimeNodeModelHost(contractHostData.service);
    contractHost.publicCapability.getApiContract().portableMutationMethods.forEach(method => {
        assert(coveredMethods.has(method), `Portable mutation rollback matrix is missing ${method}.`);
    });
    contractHost.dispose();

    mutationCases.forEach(testCase => {
        let nextId = 0;
        const data = createSceneDataModel();
        const host = createRuntimeNodeModelHost(data.service, {
            idFactory: () => `atomic-generated-${++nextId}`
        });
        const model = host.publicCapability;
        assert(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'parent-a', sceneId: 'scene-a'
        }).applied);
        assert(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'parent-b', sceneId: 'scene-a'
        }).applied);
        assert(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'child-a', parentId: 'parent-a', sceneId: 'scene-a'
        }).applied);
        assert(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'child-b', parentId: 'parent-a', sceneId: 'scene-a'
        }).applied);
        assert(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'grandchild-a', parentId: 'child-a', sceneId: 'scene-a'
        }).applied);
        assert(model.addComponent('child-a', {
            data: {value: 1}, id: 'component-a', typeId: 'test.atomic'
        }).applied);

        const beforeState = model.exportState();
        const beforeGeneration = model.getStatus().runtimeGeneration;
        const beforeRevision = host.snapshotCapability.getRevision();
        const events = [];
        model.subscribe(event => events.push(event));
        data.setFailureMode('before-write');

        const result = testCase.run(model);
        assert.strictEqual(result.applied, false, `${testCase.name} escaped failed persistence.`);
        assert.strictEqual(result.persisted, false, `${testCase.name} incorrectly reported persistence.`);
        assert.strictEqual(result.snapshot, null, `${testCase.name} exposed a failed snapshot.`);
        assert.deepStrictEqual(model.exportState(), beforeState,
            `${testCase.name} did not restore the exact persistent semantic state.`);
        assert.strictEqual(model.getStatus().runtimeGeneration, beforeGeneration,
            `${testCase.name} replaced the Runtime generation during rollback.`);
        assert.strictEqual(events.length, 0, `${testCase.name} published an event before commit.`);
        const afterRevision = host.snapshotCapability.getRevision();
        assert(afterRevision.graphRevision >= beforeRevision.graphRevision,
            `${testCase.name} rewound Graph revision.`);
        assert(!(
            afterRevision.graphRevision === beforeRevision.graphRevision &&
            afterRevision.registryRevision < beforeRevision.registryRevision
        ), `${testCase.name} rewound Registry revision.`);
        host.dispose();
    });
};

const assertHierarchyOrderAndDetachedStateAreDurable = () => {
    const data = createSceneDataModel();
    let host = createRuntimeNodeModelHost(data.service);
    let model = host.publicCapability;
    assert(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {id: 'parent', sceneId: 'scene-a'}).applied);
    assert(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'child-a', parentId: 'parent', sceneId: 'scene-a'
    }).applied);
    assert(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'child-b', parentId: 'parent', sceneId: 'scene-a'
    }).applied);
    assert.strictEqual(model.reorderChild('child-b', 0).applied, true);
    assert.strictEqual(model.detachNode('child-a').applied, true);
    const stored = getPersistedRuntimeState(data);
    assert.strictEqual(stored.nodes.find(node => node.id === 'child-a').parentId, null);
    assert.deepStrictEqual(stored.nodes.filter(node => node.parentId === 'parent').map(node => node.id), ['child-b']);
    host.dispose();

    host = createRuntimeNodeModelHost(data.service);
    model = host.publicCapability;
    assert.strictEqual(model.getNodeSnapshot('child-a').parentId, null);
    assert.deepStrictEqual(model.getChildren('parent').map(node => node.id), ['child-b']);
    host.dispose();
};

const assertAuthoritativeWriteConfirmation = () => {
    const data = createSceneDataModel();
    const host = createRuntimeNodeModelHost(data.service);
    const model = host.publicCapability;
    data.setFailureMode('after-write');
    const result = model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'confirmed-after-error',
        sceneId: 'scene-a'
    });
    assert.strictEqual(result.applied, true);
    assert.strictEqual(result.persisted, true);
    assert.strictEqual(result.error, null);
    assert(model.getNodeSnapshot('confirmed-after-error'));
    const state = getPersistedRuntimeState(data);
    assert(state.nodes.some(node => node.id === 'confirmed-after-error'));
    host.dispose();
};

const main = () => {
    const baseline = createSceneDataModel();
    const host = createRuntimeNodeModelHost(baseline.service);
    assertContract(host.publicCapability);
    host.dispose();
    assertCreateRollback();
    assertPatchRollbackAndCommitEventOrder();
    assertDestroyRollbackPreservesLiveIdentityAndDefersHooks();
    assertComponentRollbackAndImplicitDescriptorRollback();
    assertParentAndEnabledRollback();
    assertPortableMutationSurfaceRollsBackExactly();
    assertHierarchyOrderAndDetachedStateAreDurable();
    assertRuntimeDetachedPersistenceContract();
    assertAuthoritativeWriteConfirmation();
    console.log('NGVGE TASK 0008.9.7 single-command mutation commit validation passed.');
};

main();
