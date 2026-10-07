#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    RUNTIME_NODE_MODEL_API_VERSION,
    createRuntimeNodeModelService
} = require('../src/lib/runtime-nodes');

const clone = value => JSON.parse(JSON.stringify(value));


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
            SCENE_SYSTEM_MODULE_ID
        } = require('../src/lib/scene-system');
        const manager = createModuleManager();
        registerBuiltInModules(manager);
        manager.initializeAll();
        manager.enableDefaults({silent: true});
        manager.enableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});
        const record = manager.getCapabilityRecord(RUNTIME_NODE_MODEL_CAPABILITY_ID);
        assert(record, 'Runtime Node Model capability must be published.');
        assert.strictEqual(record.version, RUNTIME_NODE_MODEL_API_VERSION);
        assert.strictEqual(record.value.apiVersion, RUNTIME_NODE_MODEL_API_VERSION);
    } finally {
        Module._load = originalLoad;
    }
};

const createHarness = () => {
    let project = {
        activeSceneId: 'scene-a',
        extensionData: {},
        scenes: [{id: 'scene-a', name: 'Scene A'}]
    };
    const listeners = new Set();
    const sceneDataModel = {
        getStatus: () => ({}),
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
    return {
        getProject: () => clone(project),
        nodeModel: createRuntimeNodeModelService(sceneDataModel)
    };
};

const main = () => {
    assertCapabilityPublication();
    const first = createHarness();
    const model = first.nodeModel;
    const contract = model.getApiContract();

    assert.strictEqual(model.apiVersion, RUNTIME_NODE_MODEL_API_VERSION);
    assert.strictEqual(Object.isFrozen(model), true);
    assert.strictEqual(Object.isFrozen(contract), true);
    assert.strictEqual(Object.isFrozen(contract.portableQueryMethods), true);
    assert.strictEqual(Object.isFrozen(contract.portableMutationMethods), true);
    assert.strictEqual(contract.returnsMutableRuntimeInstances, false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(model, 'graph'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(model, 'typeRegistry'), false);

    [...contract.portableQueryMethods, ...contract.portableMutationMethods, ...contract.localMethods]
        .forEach(method => assert.strictEqual(typeof model[method], 'function', `Missing public method: ${method}`));

    const parent = model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'stable-parent',
        metadata: {nested: {value: 1}},
        name: 'Parent',
        sceneId: 'scene-a'
    });
    const firstChild = model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'stable-child-a',
        name: 'First',
        parentId: parent.id
    });
    const secondChild = model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'stable-child-b',
        name: 'Second',
        parentId: parent.id
    });
    const component = model.addComponent(firstChild.id, {
        data: {speed: 1},
        id: 'stable-component',
        typeId: 'test.movement'
    });

    assert.strictEqual(parent.constructor, Object);
    assert.strictEqual(component.constructor, Object);
    const snapshot = model.getNodeSnapshot(parent.id);
    assert.strictEqual(Object.isFrozen(snapshot), true);
    assert.strictEqual(Object.isFrozen(snapshot.metadata), true);
    assert.strictEqual(Object.isFrozen(snapshot.metadata.nested), true);
    try {
        snapshot.metadata.nested.value = 99;
    } catch (error) {
        // Expected in strict mode.
    }
    assert.strictEqual(model.getNodeSnapshot(parent.id).metadata.nested.value, 1);

    model.patchNode(parent.id, {name: 'Renamed Parent'}, {transactionId: 'tx-node-patch'});
    model.patchComponent(firstChild.id, component.id, {speed: 12}, {transactionId: 'tx-component-patch'});
    assert.strictEqual(model.getNodeSnapshot(parent.id).name, 'Renamed Parent');
    assert.strictEqual(model.getComponentSnapshot(firstChild.id, component.id).data.speed, 12);

    model.reorderChild(secondChild.id, 0, {transactionId: 'tx-reorder'});
    assert.deepStrictEqual(model.getChildren(parent.id).map(node => node.id), [secondChild.id, firstChild.id]);

    const sceneSnapshot = model.getSceneSnapshot('scene-a');
    assert.strictEqual(Object.isFrozen(sceneSnapshot), true);
    assert.strictEqual(Object.isFrozen(sceneSnapshot.nodes), true);
    assert.strictEqual(sceneSnapshot.nodeCount, 3);
    assert.strictEqual(sceneSnapshot.nodes.some(node => node.id === parent.id), true);

    assert.deepStrictEqual(model.getNode(parent.id), model.getNodeSnapshot(parent.id));
    assert.deepStrictEqual(
        model.getComponent(firstChild.id, component.id),
        model.getComponentSnapshot(firstChild.id, component.id)
    );

    const exported = model.exportState();
    const second = createHarness();
    second.nodeModel.importState(exported);
    assert.strictEqual(second.nodeModel.getNodeSnapshot(parent.id).id, parent.id);
    assert.strictEqual(second.nodeModel.getNodeSnapshot(firstChild.id).parentId, parent.id);
    assert.strictEqual(
        second.nodeModel.getComponentSnapshot(firstChild.id, component.id).id,
        component.id
    );

    const stored = first.getProject().extensionData.runtimeNodeModel;
    assert(stored && stored.nodes.some(node => node.id === parent.id));

    model.dispose();
    second.nodeModel.dispose();
    console.log('NGVGE 0008.9.1 Runtime Node API Freeze smoke passed.');
};

main();
