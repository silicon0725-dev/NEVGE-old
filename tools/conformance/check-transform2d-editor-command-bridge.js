#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {EventEmitter} = require('events');
const {
    createScratchSpriteNodeAdapterService,
    createScratchTransformCommandBridge,
    createScratchTransformProjectionService
} = require('../../src/lib/scratch-sprite-adapter');
const {
    createRuntimeNodeModelService,
    getRuntimeNodeModelHost
} = require('../../src/lib/runtime-nodes');
const {
    TRANSFORM2D_COMMAND_CAPABILITY_ID,
    TRANSFORM2D_COMMAND_CONTRACT,
    createTransform2DCommandCapability,
    createTransform2DEditorClient,
    createTransform2DRuntimeStoreForModel
} = require('../../src/lib/transform-system');
const {validateProtocolDTO} = require('../../src/core/protocol');

const ROOT = path.resolve(__dirname, '../..');
const clone = value => JSON.parse(JSON.stringify(value));

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
const runtimeNodeModel = createRuntimeNodeModelService(sceneDataModel);
const host = getRuntimeNodeModelHost(runtimeNodeModel);
const runtime = new EventEmitter();
const vm = new EventEmitter();
const target = {
    direction: 90,
    id: 'scratch-target:0009d',
    isOriginal: true,
    isStage: false,
    size: 100,
    sprite: {name: 'Editor Bridge Sprite'},
    x: 4,
    y: -3,
    setXY (x, y) {
        this.x = x;
        this.y = y;
    },
    setDirection (direction) {
        this.direction = direction;
    },
    setSize (size) {
        this.size = Math.max(20, size);
    }
};
runtime.targets = [target];
runtime.getTargetById = id => runtime.targets.find(candidate => candidate && candidate.id === id) || null;
vm.runtime = runtime;
const context = {vm};

const adapter = createScratchSpriteNodeAdapterService(
    context,
    sceneDataModel,
    host.publicCapability,
    {
        bindingIdFactory: () => 'scratch-binding:0009d',
        componentIdFactory: () => 'runtime-component:scratch-binding-0009d',
        nodeIdFactory: () => 'ngvge:node:0009dbridge',
        nodeTypeRegistration: host.typeRegistrationCapability,
        persistenceController: host.persistenceController
    }
);
const store = createTransform2DRuntimeStoreForModel(
    host.publicCapability,
    host.typeRegistrationCapability
);
const projection = createScratchTransformProjectionService(
    context,
    sceneDataModel,
    host.publicCapability,
    host.typeRegistrationCapability,
    adapter,
    {transformRuntimeStore: store}
);
projection.bootstrapActiveScene({reason: '0009-d-bootstrap'});
const bridge = createScratchTransformCommandBridge(
    context,
    sceneDataModel,
    host.publicCapability,
    adapter,
    projection
);
const capability = createTransform2DCommandCapability(bridge);
const editor = createTransform2DEditorClient(capability);
const nodeId = adapter.listBindings('scene-a')[0].nodeId;
const transformComponent = host.publicCapability.getNodeSnapshot(nodeId)
    .components.find(component => component.typeId === 'ngvge.transform2d');

assert.strictEqual(capability.capabilityId, TRANSFORM2D_COMMAND_CAPABILITY_ID);
assert.strictEqual(TRANSFORM2D_COMMAND_CONTRACT.editorIntent.directBackendMutation, false);
assert.strictEqual(TRANSFORM2D_COMMAND_CONTRACT.currentAuthority.authorityId, 'scratch.compat.transform');
assert.strictEqual(TRANSFORM2D_COMMAND_CONTRACT.currentAuthority.authorityReversalImplemented, false);

const projectBeforeEditorMutation = clone(project);
const result = editor.patchComponent({
    componentId: transformComponent.id,
    nodeId,
    patch: {
        position: [80, -40],
        rotation: 45,
        scale: [0.1, 0.1]
    }
});
assert.strictEqual(validateProtocolDTO(result).valid, true, 'Bridge result must remain a portable Engine Protocol DTO.');
assert.strictEqual(result.kind, 'event');
assert.strictEqual(result.type, 'PatchComponentApplied');
assert.strictEqual(result.payload.authorityId, 'scratch.compat.transform');
assert.deepStrictEqual(target.x, 80);
assert.deepStrictEqual(target.y, -40);
assert.deepStrictEqual(target.direction, 45);
assert.deepStrictEqual(target.size, 20, 'Scratch Authority clamp must be treated as canonical accepted state.');
assert.deepStrictEqual(clone(result.payload.transform), {
    position: [80, -40],
    rotation: 45,
    scale: [0.2, 0.2]
});
assert.deepStrictEqual(store.getRuntimeTransform(nodeId), clone(result.payload.transform));
assert.deepStrictEqual(store.getPersistentTransform(nodeId), clone(result.payload.transform));
assert.notDeepStrictEqual(project, projectBeforeEditorMutation,
    'Editor PatchComponent is a project mutation boundary and must commit accepted Authority state.');
assert.doesNotMatch(JSON.stringify(project.extensionData.runtimeNodeModel || {}), /scratch-target:0009d/,
    'Volatile Scratch target identity must not enter Persistent Transform records.');
assert.strictEqual(result.payload.targetRuntimeId, undefined);

const beforeUnrepresentable = {x: target.x, y: target.y, direction: target.direction, size: target.size};
const unrepresentableResult = editor.patchComponent({
    componentId: transformComponent.id,
    nodeId,
    patch: {position: [999, 999], scale: [2, 1]}
});
assert.strictEqual(unrepresentableResult.kind, 'error');
assert.strictEqual(unrepresentableResult.code, 'SCRATCH_TRANSFORM_SCALE_UNREPRESENTABLE');
assert.strictEqual(validateProtocolDTO(unrepresentableResult).valid, true);
assert.deepStrictEqual(
    {x: target.x, y: target.y, direction: target.direction, size: target.size},
    beforeUnrepresentable,
    'Unrepresentable Scratch scale must fail before any partial target mutation.'
);

const wrongComponentResult = editor.patchComponent({
    componentId: 'runtime-component:wrong-transform',
    nodeId,
    patch: {position: [1, 2]}
});
assert.strictEqual(wrongComponentResult.kind, 'error');
assert.strictEqual(wrongComponentResult.code, 'SCRATCH_TRANSFORM_COMMAND_COMPONENT_MISMATCH');
assert.strictEqual(validateProtocolDTO(wrongComponentResult).valid, true);

const editorSource = fs.readFileSync(path.join(ROOT, 'src/lib/transform-system/transform2d-command-capability.js'), 'utf8');
assert.doesNotMatch(editorSource, /scratch-vm|scratch-render|targetRuntimeId|\.setXY\s*\(|\.setDirection\s*\(|\.setSize\s*\(/,
    'Editor-facing Transform command capability must not know how Scratch targets are mutated.');

const bridgeSource = fs.readFileSync(
    path.join(ROOT, 'src/lib/scratch-sprite-adapter/scratch-transform-command-bridge.js'),
    'utf8'
);
assert.doesNotMatch(bridgeSource, /scratch-render|_allDrawables|_allSkins|_drawThese|BitmapSkin|WebGLRenderingContext|GPUDevice/,
    '0009-D Scratch Compatibility Bridge must not depend on renderer private state.');
assert.match(bridgeSource, /normalizeProtocolDTO\(command\)/,
    '0009-D bridge must validate/normalize Engine Protocol DTO input before mutation.');
assert.match(bridgeSource, /commitNodeToPersistent/,
    '0009-D editor mutation boundary must persist the actual accepted Scratch Authority snapshot.');
assert.match(bridgeSource, /createProtocolError/,
    '0009-D bridge failures must cross the Editor boundary as Protocol Error DTOs.');
assert.doesNotMatch(bridgeSource, /target\.(?:x|y|direction|size)\s*=/,
    'Scratch writer bridge must use public Scratch transform setters rather than direct target field mutation.');

bridge.dispose();
projection.dispose();
store.dispose();
adapter.dispose();
host.dispose();
process.stdout.write('0009-D Editor PatchComponent Compatibility Bridge Conformance PASS.\n');
