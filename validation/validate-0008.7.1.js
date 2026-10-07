'use strict';

const assert = require('assert');
const Module = require('module');
const path = require('path');

const PROJECT_ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..');
const runtimeNodes = require(path.join(PROJECT_ROOT, 'src', 'lib', 'runtime-nodes'));
const adapterModule = require(path.join(PROJECT_ROOT, 'src', 'lib', 'scratch-sprite-adapter'));

const {
    createRuntimeNodeModelService
} = runtimeNodes;
const {
    SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID,
    SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY,
    SCRATCH_SPRITE_NODE_TYPE_ID,
    SCRATCH_TARGET_BINDING_COMPONENT_TYPE_ID,
    createScratchSpriteNodeAdapterService
} = adapterModule;

const clone = value => JSON.parse(JSON.stringify(value));

const createSceneDataModel = initialProject => {
    let project = clone(initialProject);
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

const createTargets = runtimeId => [
    {
        id: 'stage-runtime',
        isOriginal: true,
        isStage: true,
        sprite: {name: 'Stage'}
    },
    {
        id: runtimeId,
        isOriginal: true,
        isStage: false,
        sprite: {name: 'Player'}
    },
    {
        id: 'clone-runtime',
        isOriginal: false,
        isStage: false,
        sprite: {name: 'Player'}
    }
];

const sceneData = createSceneDataModel({
    activeSceneId: 'scene-a',
    extensionData: {},
    scenes: [{id: 'scene-a', name: 'Scene A'}]
});
const nodeModel = createRuntimeNodeModelService(sceneData);
const context = {
    vm: {
        runtime: {
            targets: createTargets('target-runtime-a')
        }
    }
};

let bindingFactoryCalls = 0;
const firstAdapter = createScratchSpriteNodeAdapterService(context, sceneData, nodeModel, {
    bindingIdFactory: () => `scratch-binding:stable-${++bindingFactoryCalls}`,
    componentIdFactory: () => 'runtime-component:scratch-binding-stable',
    nodeIdFactory: () => 'runtime-node:scratch-sprite-stable'
});

assert.equal(firstAdapter.capabilityId, SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID);
assert.equal(firstAdapter.listBindings().length, 1);
assert.equal(firstAdapter.getBindingByTargetRuntimeId('stage-runtime'), null);
assert.equal(firstAdapter.getBindingByTargetRuntimeId('clone-runtime'), null);

const firstBinding = firstAdapter.listBindings()[0];
assert(Object.isFrozen(firstBinding));
assert.equal(firstBinding.status, 'bound');
assert.equal(firstBinding.serializedTargetIndex, 1);
assert(!Object.hasOwn(firstBinding, 'target'));
assert(!Object.hasOwn(firstBinding, 'scratchTarget'));

const firstNode = nodeModel.getNode(firstBinding.nodeId);
assert.equal(firstNode.typeId, SCRATCH_SPRITE_NODE_TYPE_ID);
assert.deepEqual(firstNode.source, {
    bindingId: firstBinding.bindingId,
    kind: 'scratch-target',
    role: 'sprite',
    sceneId: 'scene-a'
});
assert.equal(firstNode.components.length, 1);
assert.equal(firstNode.components[0].typeId, SCRATCH_TARGET_BINDING_COMPONENT_TYPE_ID);
assert.equal(firstNode.components[0].data.bindingId, firstBinding.bindingId);

const storedProject = sceneData.getProject();
const sidecar = storedProject.extensionData[SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY];
assert.equal(sidecar.schemaVersion, 1);
assert.equal(sidecar.scenes['scene-a'].items.length, 1);
assert.equal(sidecar.scenes['scene-a'].items[0].bindingId, firstBinding.bindingId);
assert(!JSON.stringify(sidecar).includes('target-runtime-a'));
assert(!JSON.stringify(storedProject.extensionData.runtimeNodeModel).includes('target-runtime-a'));

let directCreateError = null;
try {
    nodeModel.createNode(SCRATCH_SPRITE_NODE_TYPE_ID, {
        name: 'Invalid',
        sceneId: 'scene-a'
    });
} catch (error) {
    directCreateError = error;
}
assert(directCreateError);
assert.equal(directCreateError.code, 'SCRATCH_SPRITE_NODE_BINDING_REQUIRED');

firstAdapter.establishBindings();
assert.equal(firstAdapter.listBindings().length, 1);
assert.equal(bindingFactoryCalls, 1);
assert.equal(nodeModel.listNodes({includeRoots: false}).length, 1);

firstAdapter.dispose();
context.vm.runtime.targets = createTargets('target-runtime-b');
const secondAdapter = createScratchSpriteNodeAdapterService(context, sceneData, nodeModel, {
    bindingIdFactory: () => 'scratch-binding:must-not-be-used',
    componentIdFactory: () => 'runtime-component:must-not-be-used',
    nodeIdFactory: () => 'runtime-node:must-not-be-used'
});
const secondBinding = secondAdapter.getBindingByTargetRuntimeId('target-runtime-b');
assert(secondBinding);
assert.equal(secondBinding.bindingId, firstBinding.bindingId);
assert.equal(secondBinding.nodeId, firstBinding.nodeId);
assert.equal(secondAdapter.getBindingByTargetRuntimeId('target-runtime-a'), null);
assert.equal(nodeModel.listNodes({includeRoots: false}).length, 1);

secondAdapter.dispose();
nodeModel.dispose();

// Future Sidecar versions remain intact and place the capability in an inspectable error state.
const futureSceneData = createSceneDataModel({
    activeSceneId: 'scene-a',
    extensionData: {
        [SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY]: {
            futureField: true,
            scenes: {},
            schemaVersion: 99
        }
    },
    scenes: [{id: 'scene-a', name: 'Scene A'}]
});
const futureNodeModel = createRuntimeNodeModelService(futureSceneData);
const futureAdapter = createScratchSpriteNodeAdapterService({
    vm: {runtime: {targets: createTargets('future-target-runtime')}}
}, futureSceneData, futureNodeModel);
assert.match(futureAdapter.getStatus().error, /newer than supported/i);
assert.deepEqual(
    futureSceneData.getProject().extensionData[SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY],
    {futureField: true, scenes: {}, schemaVersion: 99}
);
assert.equal(futureAdapter.listBindings().length, 0);
futureAdapter.dispose();
futureNodeModel.dispose();

// Module wiring smoke. Stub JSZip because this validation does not exercise scene archives.
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === '@turbowarp/jszip') {
        return class JSZipStub {
            file () { return this; }
            generateAsync () { return Promise.resolve(''); }
            static loadAsync () { return Promise.reject(new Error('JSZip stub should not be used.')); }
        };
    }
    return originalLoad.call(this, request, parent, isMain);
};
try {
    const firstPartyModules = require(path.join(PROJECT_ROOT, 'src', 'lib', 'first-party-modules'));
    const sceneSystem = require(path.join(PROJECT_ROOT, 'src', 'lib', 'scene-system'));
    const manager = firstPartyModules.createModuleManager({
        vm: {
            runtime: {
                targets: createTargets('module-target-runtime')
            }
        }
    });
    firstPartyModules.registerBuiltInModules(manager);
    manager.initializeAll();
    manager.enableDefaults({silent: true});
    manager.enableModule(sceneSystem.SCENE_SYSTEM_MODULE_ID, {silent: true});
    const moduleAdapter = manager.getCapability(SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID);
    assert(moduleAdapter);
    assert.equal(moduleAdapter.listBindings().length, 1);
    manager.disableModule(sceneSystem.SCENE_SYSTEM_MODULE_ID, {silent: true});
    assert.equal(manager.getCapability(SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID), null);
} finally {
    Module._load = originalLoad;
}

console.log('0008.7.1 stable binding identity validation passed');
