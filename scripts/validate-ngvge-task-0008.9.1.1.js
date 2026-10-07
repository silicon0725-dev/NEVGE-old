#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    NODE_SCOPES,
    RUNTIME_NODE_MODEL_API_VERSION,
    RuntimeNode,
    assertPortableData,
    createRuntimeNodeModelHost,
    createRuntimeNodeModelService,
    validatePortableData
} = require('../src/lib/runtime-nodes');

const clone = value => JSON.parse(JSON.stringify(value));

const createSceneDataModel = (options = {}) => {
    let project = {
        activeSceneId: 'scene-a',
        extensionData: {},
        scenes: [{id: 'scene-a', name: 'Scene A'}]
    };
    const listeners = new Set();
    return {
        getProject: () => clone(project),
        service: {
            getStatus: () => ({}),
            readProject: () => clone(project),
            subscribe: listener => {
                listeners.add(listener);
                return () => listeners.delete(listener);
            },
            writeProject: nextProject => {
                if (options.failWrites === true) {
                    const error = new Error('Synthetic persistence failure.');
                    error.code = 'SYNTHETIC_PERSISTENCE_FAILURE';
                    throw error;
                }
                project = clone(nextProject);
                listeners.forEach(listener => listener({type: 'data'}));
            }
        }
    };
};

const sortKeys = value => Reflect.ownKeys(value).map(key => String(key)).sort();

const assertExactPublicSurface = model => {
    const contract = model.getApiContract();
    assert.deepStrictEqual(sortKeys(model), contract.publicSurfaceKeys.slice().sort());
    assert.strictEqual(Object.isFrozen(model), true);
    assert.strictEqual(Object.isFrozen(contract), true);
    assert.strictEqual(model.apiVersion, RUNTIME_NODE_MODEL_API_VERSION);
    ['importState', 'persistState', 'synchronizeScenes', 'registerNodeType', 'traverse', 'dispose']
        .forEach(method => assert.strictEqual(method in model, false, `${method} leaked into the public capability.`));

    Object.getOwnPropertyDescriptors(model) && Object.entries(Object.getOwnPropertyDescriptors(model)).forEach(([key, descriptor]) => {
        assert.strictEqual(typeof descriptor.get, 'undefined', `Unexpected getter on public key: ${key}`);
        assert.strictEqual(typeof descriptor.set, 'undefined', `Unexpected setter on public key: ${key}`);
    });
};

const assertNativeBridgeSuitability = model => {
    const contract = model.getApiContract();
    contract.methodDescriptors.filter(descriptor => descriptor.portability === 'portable').forEach(descriptor => {
        assert.strictEqual(descriptor.acceptsCallback, false, `${descriptor.name} accepts a callback.`);
        assert.strictEqual(descriptor.argumentsSerializable, true, `${descriptor.name} arguments are not portable.`);
        assert.strictEqual(descriptor.resultSerializable, true, `${descriptor.name} result is not portable.`);
        assert.strictEqual(descriptor.returnsFunction, false, `${descriptor.name} returns a function.`);
    });
    assert.strictEqual(contract.splitCapabilities.localHost.portability, 'local-only');
    assert.strictEqual(contract.splitCapabilities.persistenceController.portability, 'internal');
    assert.strictEqual(contract.splitCapabilities.typeRegistration.portability, 'restricted-host');
    assert.strictEqual(contract.mutationResultContract.transactionSemantics, 'single-command-atomic');
    assert.deepStrictEqual(contract.mutationResultContract.fields, ['applied', 'error', 'persisted', 'snapshot']);
};

const assertPortableQueryResults = model => {
    const parentResult = model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'portable-parent',
        metadata: {kind: 'test'},
        name: 'Parent',
        sceneId: 'scene-a'
    });
    assert.strictEqual(parentResult.applied, true);
    assert.strictEqual(parentResult.persisted, true);
    const parent = parentResult.snapshot;

    const childResult = model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'portable-child',
        name: 'Child',
        parentId: parent.id
    });
    assert.strictEqual(childResult.applied, true);
    const child = childResult.snapshot;

    const componentResult = model.addComponent(child.id, {
        data: {speed: 3},
        id: 'portable-component',
        typeId: 'test.movement'
    });
    assert.strictEqual(componentResult.applied, true);
    const component = componentResult.snapshot;
    const reference = model.createReference(child.id);
    const state = model.exportState();

    const queryResults = [
        model.canSetParent(child.id, parent.id),
        reference,
        state,
        model.getApiContract(),
        model.getChildren(parent.id),
        model.getComponentSnapshot(child.id, component.id),
        model.getDebugSnapshot(),
        model.getGlobalRoot(),
        model.getGraphSnapshot(),
        model.getImportStatus(),
        model.getNodeSnapshot(child.id),
        model.getNodeType(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE),
        model.getNodeTypeRegistryRevision(),
        model.getParent(child.id),
        model.getSceneRoot('scene-a'),
        model.getSceneSnapshot('scene-a'),
        model.getStatus(),
        model.listNodes(),
        model.listNodeTypes(),
        model.querySubtree({
            includeRoot: true,
            maxDepth: null,
            order: 'pre',
            rootNodeId: parent.id
        }),
        model.resolveReference(reference),
        model.validatePersistentState(state)
    ];

    queryResults.forEach((value, index) => {
        assert.doesNotThrow(() => assertPortableData(value), `Query result ${index} is not portable data.`);
        if (value && typeof value === 'object') assert.strictEqual(Object.isFrozen(value), true);
    });

    const subtree = model.querySubtree({rootNodeId: parent.id, order: 'breadth', includeRoot: false});
    assert.deepStrictEqual(subtree.nodes.map(entry => entry.node.id), [child.id]);
    assert.strictEqual(Object.isFrozen(subtree.nodes[0].node), true);

    [parentResult, childResult, componentResult].forEach(result => {
        assert.doesNotThrow(() => assertPortableData(result));
        assert.strictEqual(Object.isFrozen(result), true);
    });

    const nonPortableCreate = model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        hooks: {onCreate: () => {}},
        id: 'must-not-be-created',
        sceneId: 'scene-a'
    });
    assert.strictEqual(nonPortableCreate.applied, false);
    assert.strictEqual(nonPortableCreate.persisted, false);
    assert.strictEqual(model.getNodeSnapshot('must-not-be-created'), null);
    assert.strictEqual(nonPortableCreate.error.code, 'PORTABLE_DATA_VALIDATION_FAILED');
    assert.throws(
        () => model.getNodeSnapshot(() => {}),
        error => error && error.code === 'PORTABLE_DATA_VALIDATION_FAILED'
    );
    const nonPortableEnabled = model.setNodeEnabled(parent.id, () => {});
    assert.strictEqual(nonPortableEnabled.applied, false);
    assert.strictEqual(nonPortableEnabled.error.code, 'PORTABLE_DATA_VALIDATION_FAILED');
};

const assertMutationPersistenceSemantics = () => {
    const failingData = createSceneDataModel({failWrites: true});
    const failingHost = createRuntimeNodeModelHost(failingData.service);
    const model = failingHost.publicCapability;

    const applied = model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'applied-but-not-persisted',
        name: 'Unpersisted',
        sceneId: 'scene-a'
    });
    assert.strictEqual(applied.applied, false);
    assert.strictEqual(applied.persisted, false);
    assert.strictEqual(applied.snapshot, null);
    assert.strictEqual(applied.error.code, 'SYNTHETIC_PERSISTENCE_FAILURE');
    assert.strictEqual(model.getNodeSnapshot('applied-but-not-persisted'), null);
    assert.doesNotThrow(() => assertPortableData(applied));

    const rejected = model.patchNode('missing-node', {name: 'Never Applied'});
    assert.strictEqual(rejected.applied, false);
    assert.strictEqual(rejected.persisted, false);
    assert.strictEqual(rejected.snapshot, null);
    assert(rejected.error);
    assert.doesNotThrow(() => assertPortableData(rejected));
    failingHost.dispose();
};

const assertTypeRegistrationSeparation = () => {
    const data = createSceneDataModel();
    const host = createRuntimeNodeModelHost(data.service);
    const model = host.publicCapability;
    const registration = host.typeRegistrationCapability;
    const descriptor = registration.registerNodeTypeDescriptor({
        allowedScopes: [NODE_SCOPES.SCENE],
        defaultScope: NODE_SCOPES.SCENE,
        label: 'Portable Type',
        ownerModuleId: 'test.module',
        schema: {
            properties: {
                value: {default: 0, type: 'number'}
            }
        },
        typeId: 'test.portable-node',
        version: '1'
    });

    assert.doesNotThrow(() => assertPortableData(descriptor));
    assert.strictEqual(model.getNodeType('test.portable-node'), null);

    class PortableTestNode extends RuntimeNode {}
    const unregisterProvider = registration.bindNodeTypeProvider('test.portable-node', {
        ctor: PortableTestNode
    });
    assert.strictEqual(typeof unregisterProvider, 'function');
    assert.strictEqual(model.getNodeType('test.portable-node').id, 'test.portable-node');
    const created = model.createNode('test.portable-node', {
        id: 'provider-bound-node',
        sceneId: 'scene-a'
    });
    assert.strictEqual(created.applied, true);
    assert.strictEqual(created.snapshot.typeId, 'test.portable-node');

    assert.strictEqual(typeof host.localHostCapability.traverse, 'function');
    assert.strictEqual(typeof host.persistenceController.importState, 'function');
    assert.strictEqual('traverse' in model, false);
    assert.strictEqual('registerNodeType' in model, false);
    assert.strictEqual('importState' in model, false);

    unregisterProvider();
    registration.unregisterNodeTypeDescriptor('test.portable-node');
    host.dispose();
};


const assertLegacyRegistrationCompatibility = () => {
    const data = createSceneDataModel();
    const model = createRuntimeNodeModelService(data.service);
    class FirstProvider extends RuntimeNode {}
    class ReplacementProvider extends RuntimeNode {}
    const unregisterFirst = model.registerNodeType({
        allowedScopes: [NODE_SCOPES.SCENE],
        ctor: FirstProvider,
        id: 'test.legacy-registration',
        label: 'Legacy Registration',
        owner: 'test.module'
    });
    model.createNode('test.legacy-registration', {sceneId: 'scene-a'});
    const unregisterReplacement = model.registerNodeType({
        allowedScopes: [NODE_SCOPES.SCENE],
        ctor: ReplacementProvider,
        id: 'test.legacy-registration',
        label: 'Legacy Registration v2',
        owner: 'test.module',
        replace: true
    });
    assert.strictEqual(model.getNodeType('test.legacy-registration').label, 'Legacy Registration v2');
    assert.strictEqual(unregisterFirst(), false);
    assert.strictEqual(model.getNodeType('test.legacy-registration').label, 'Legacy Registration v2');
    assert.strictEqual(unregisterReplacement(), true);
    assert.strictEqual(model.getNodeType('test.legacy-registration'), null);
    model.dispose();
};

const assertPortableValidator = () => {
    const cyclic = {};
    cyclic.self = cyclic;
    const invalidValues = [
        {fn: () => {}},
        {promise: Promise.resolve()},
        {map: new Map()},
        {set: new Set()},
        {number: Number.NaN},
        cyclic
    ];
    invalidValues.forEach(value => {
        const result = validatePortableData(value);
        assert.strictEqual(result.valid, false);
        assert(result.issues.length > 0);
        assert(result.issues.every(issue => issue.code.startsWith('portable.')));
    });
};

const assertCapabilityPublication = () => {
    const Module = require('module');
    const originalLoad = Module._load;
    class FakeZip {
        file () { return this; }
        generateAsync () { return Promise.resolve(''); }
        static loadAsync () { return Promise.resolve(new FakeZip()); }
    }
    Module._load = function (request, parent, isMain) {
        if (request === '@turbowarp/jszip') return FakeZip;
        return originalLoad.call(this, request, parent, isMain);
    };
    try {
        const {createModuleManager, registerBuiltInModules} = require('../src/lib/first-party-modules');
        const {
            RUNTIME_NODE_MODEL_CAPABILITY_ID,
            RUNTIME_NODE_PERSISTENCE_CONTROLLER_CAPABILITY_ID,
            RUNTIME_NODE_TYPE_REGISTRATION_CAPABILITY_ID,
            SCENE_SYSTEM_MODULE_ID
        } = require('../src/lib/scene-system');
        const manager = createModuleManager();
        registerBuiltInModules(manager);
        manager.initializeAll();
        manager.enableDefaults({silent: true});
        manager.enableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});

        const modelRecord = manager.getCapabilityRecord(RUNTIME_NODE_MODEL_CAPABILITY_ID);
        const registrationRecord = manager.getCapabilityRecord(RUNTIME_NODE_TYPE_REGISTRATION_CAPABILITY_ID);
        const persistenceRecord = manager.getCapabilityRecord(RUNTIME_NODE_PERSISTENCE_CONTROLLER_CAPABILITY_ID);
        assert(modelRecord, 'Portable Runtime Node capability must be published.');
        assert(registrationRecord, 'Restricted type registration capability must be published.');
        assert.strictEqual(persistenceRecord, null, 'Persistence controller must remain Scene System internal.');
        assertExactPublicSurface(modelRecord.value);
    } finally {
        Module._load = originalLoad;
    }
};

const main = () => {
    const data = createSceneDataModel();
    const host = createRuntimeNodeModelHost(data.service);
    assertExactPublicSurface(host.publicCapability);
    assertNativeBridgeSuitability(host.publicCapability);
    assertPortableQueryResults(host.publicCapability);
    host.dispose();

    assertMutationPersistenceSemantics();
    assertTypeRegistrationSeparation();
    assertLegacyRegistrationCompatibility();
    assertPortableValidator();
    assertCapabilityPublication();
    console.log('NGVGE 0008.9.1.1 Runtime Node Public Boundary Cleanup smoke passed.');
};

main();
