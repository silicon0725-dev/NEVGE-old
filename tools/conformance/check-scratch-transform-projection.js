#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {EventEmitter} = require('events');
const {
    SCRATCH_TRANSFORM_PROJECTION_CONTRACT,
    createScratchSpriteNodeAdapterService,
    createScratchTransformProjectionService,
    readScratchTargetTransform
} = require('../../src/lib/scratch-sprite-adapter');
const {
    createRuntimeNodeModelService,
    getRuntimeNodeModelHost
} = require('../../src/lib/runtime-nodes');
const {
    TRANSFORM2D_RUNTIME_CAPABILITY_ID,
    createTransform2DRuntimeCapability,
    createTransform2DRuntimeStoreForModel
} = require('../../src/lib/transform-system');

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
const runtimeNodeHost = getRuntimeNodeModelHost(runtimeNodeModel);
const runtime = new EventEmitter();
const vm = new EventEmitter();
const target = {
    direction: 90,
    id: 'scratch-target:0009c',
    isOriginal: true,
    isStage: false,
    size: 100,
    sprite: {name: 'Projection Sprite'},
    x: 5,
    y: -6
};
runtime.targets = [
    {id: 'stage-runtime', isOriginal: true, isStage: true, sprite: {name: 'Stage'}},
    target
];
vm.runtime = runtime;
const context = {vm};

const adapter = createScratchSpriteNodeAdapterService(
    context,
    sceneDataModel,
    runtimeNodeHost.publicCapability,
    {
        bindingIdFactory: () => 'scratch-binding:0009c',
        componentIdFactory: () => 'runtime-component:scratch-binding-0009c',
        nodeIdFactory: () => 'ngvge:node:0009cprojection',
        nodeTypeRegistration: runtimeNodeHost.typeRegistrationCapability,
        persistenceController: runtimeNodeHost.persistenceController
    }
);
const store = createTransform2DRuntimeStoreForModel(
    runtimeNodeHost.publicCapability,
    runtimeNodeHost.typeRegistrationCapability
);
const runtimeCapability = createTransform2DRuntimeCapability(store);
const projection = createScratchTransformProjectionService(
    context,
    sceneDataModel,
    runtimeNodeHost.publicCapability,
    runtimeNodeHost.typeRegistrationCapability,
    adapter,
    {transformRuntimeStore: store}
);

assert.strictEqual(SCRATCH_TRANSFORM_PROJECTION_CONTRACT.direction, 'Scratch -> NGVGE');
assert.strictEqual(SCRATCH_TRANSFORM_PROJECTION_CONTRACT.authority.sourceAuthorityId, 'scratch.compat.transform');
assert.strictEqual(SCRATCH_TRANSFORM_PROJECTION_CONTRACT.authority.projectionId, 'ngvge.semantic.transform');
assert.strictEqual(SCRATCH_TRANSFORM_PROJECTION_CONTRACT.highFrequency.persistentWrite, false);
assert.strictEqual(SCRATCH_TRANSFORM_PROJECTION_CONTRACT.representationBoundary.rendererPrivateStateRequired, false);
assert.strictEqual(runtimeCapability.capabilityId, TRANSFORM2D_RUNTIME_CAPABILITY_ID);
assert.strictEqual(typeof runtimeCapability.patchRuntimeTransform, 'undefined',
    'Published Runtime Transform capability must not expose an ungoverned Writer mutation method.');

projection.bootstrapActiveScene({reason: '0009-c-conformance-bootstrap'});
const nodeId = adapter.listBindings('scene-a')[0].nodeId;
const node = runtimeNodeHost.publicCapability.getNodeSnapshot(nodeId);
const transformComponent = node.components.find(component => component.typeId === 'ngvge.transform2d');
assert.ok(transformComponent, 'Scratch-bound semantic node must own Transform2D after explicit bootstrap.');
assert.deepStrictEqual(transformComponent.data, readScratchTargetTransform(target));
assert.strictEqual(transformComponent.data.targetRuntimeId, undefined);
assert.strictEqual(transformComponent.data.drawableId, undefined);

const projectAfterBootstrap = clone(project);
const persistentStateAfterBootstrap = runtimeNodeHost.publicCapability.exportState();
for (let index = 0; index < 180; index++) {
    target.x = index * 0.75;
    target.y = index * -0.5;
    target.direction = ((index + 179) % 360) - 179;
    target.size = 100 + (index % 40);
    projection.projectActiveScene({reason: '0009-c-high-frequency'});
}
assert.deepStrictEqual(project, projectAfterBootstrap,
    'High-frequency Scratch projection must not write project source.');
assert.deepStrictEqual(runtimeNodeHost.publicCapability.exportState(), persistentStateAfterBootstrap,
    'High-frequency Scratch projection must not mutate Persistent Transform records.');
assert.deepStrictEqual(store.getRuntimeTransform(nodeId), readScratchTargetTransform(target),
    'Runtime Transform must follow current Scratch Authority state.');
assert.strictEqual(store.isRuntimeDivergedFromPersistent(nodeId), true);

projection.commitActiveSceneToPersistent({reason: '0009-c-explicit-commit'});
assert.deepStrictEqual(store.getPersistentTransform(nodeId), readScratchTargetTransform(target));
assert.notDeepStrictEqual(project, projectAfterBootstrap,
    'Explicit commit boundary must be able to persist the current Authority snapshot.');
assert.doesNotMatch(JSON.stringify(project.extensionData.runtimeNodeModel || {}), /scratch-target:0009c/,
    'Volatile Scratch target runtime identity must not enter Transform persistence.');

const projectionSourcePath = path.join(ROOT, 'src/lib/scratch-sprite-adapter/scratch-transform-projection-service.js');
const projectionSource = fs.readFileSync(projectionSourcePath, 'utf8');
assert.doesNotMatch(projectionSource,
    /scratch-render|_allDrawables|_allSkins|_drawThese|BitmapSkin|WebGLRenderingContext|GPUDevice/,
    '0009-C projection may read Scratch Target semantic fields but must not depend on Scratch renderer private state.');
assert.doesNotMatch(projectionSource, /\.setXY\s*\(|\.setDirection\s*\(|\.setSize\s*\(/,
    '0009-C must remain a one-way Scratch -> NGVGE projection and must not write back to Scratch.');

const transformRuntimeRoot = path.join(ROOT, 'src/lib/transform-system');
fs.readdirSync(transformRuntimeRoot).filter(name => name.endsWith('.js')).forEach(name => {
    const source = fs.readFileSync(path.join(transformRuntimeRoot, name), 'utf8');
    assert.doesNotMatch(source, /scratch-vm|scratch-render|targetRuntimeId|_allDrawables|_allSkins|_drawThese/,
        `Backend-independent Transform runtime layer must remain Scratch-free: src/lib/transform-system/${name}`);
});

projection.dispose();
store.dispose();
adapter.dispose();
runtimeNodeHost.dispose();
process.stdout.write('0009-C Scratch Compatibility Transform Projection Conformance PASS.\n');
