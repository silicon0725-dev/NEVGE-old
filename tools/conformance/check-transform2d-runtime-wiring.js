#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    RuntimeNodeGraph
} = require('../../src/lib/runtime-nodes');
const {
    TRANSFORM2D_RUNTIME_COMPONENT_DESCRIPTOR,
    TRANSFORM2D_RUNTIME_CONTRACT,
    createTransform2DRuntimeStore,
    registerTransform2DRuntimeComponent
} = require('../../src/lib/transform-system');

const ROOT = path.resolve(__dirname, '../..');
const transformRuntimeRoot = path.join(ROOT, 'src/lib/transform-system');
const NODE_ID = 'ngvge:node:0009bconformance';
const COMPONENT_ID = 'runtime-component:0009bconformance';

assert.strictEqual(TRANSFORM2D_RUNTIME_COMPONENT_DESCRIPTOR.typeId, 'ngvge.transform2d');
assert.strictEqual(TRANSFORM2D_RUNTIME_COMPONENT_DESCRIPTOR.schemaVersion, 1);
assert.strictEqual(TRANSFORM2D_RUNTIME_COMPONENT_DESCRIPTOR.cardinality, 'one');
assert.strictEqual(TRANSFORM2D_RUNTIME_CONTRACT.ownership.semanticOwnerKey, 'NodeId');
assert.strictEqual(TRANSFORM2D_RUNTIME_CONTRACT.ownership.scratchTargetIsOwner, false);
assert.strictEqual(TRANSFORM2D_RUNTIME_CONTRACT.separation.runtimeStateStoredInComponentData, false);
assert.strictEqual(TRANSFORM2D_RUNTIME_CONTRACT.separation.runtimeWritesTouchProjectSource, false);

const graph = new RuntimeNodeGraph({
    activeSceneId: 'scene-a',
    scenes: [{id: 'scene-a', name: 'Scene A'}]
});
registerTransform2DRuntimeComponent(graph.componentTypeRegistry);
const node = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE_2D, {
    id: NODE_ID,
    sceneId: 'scene-a'
});
const store = createTransform2DRuntimeStore(graph);
const component = store.ensureTransformComponent(node.id, {
    componentId: COMPONENT_ID,
    data: {position: [10, 20], rotation: 15, scale: [1, 1]}
});
assert.strictEqual(component.ownerId, NODE_ID, 'Transform2D must be owned by semantic NodeId.');
assert.strictEqual(node.getComponents('ngvge.transform2d').length, 1,
    'Transform2D must be a cardinality-one Runtime Component.');

const exportedBefore = JSON.stringify(graph.exportState());
const graphRevisionBefore = graph.getStatus().revision;
for (let index = 0; index < 180; index++) {
    store.patchRuntimeTransform(node.id, {position: [index, -index], rotation: index * 0.5});
}
assert.strictEqual(graph.getStatus().revision, graphRevisionBefore,
    'High-frequency Runtime Transform writes must not mutate Runtime Node semantic revision.');
assert.strictEqual(JSON.stringify(graph.exportState()), exportedBefore,
    'High-frequency Runtime Transform writes must not alter Persistent Runtime Node state.');
assert.strictEqual(store.isRuntimeDivergedFromPersistent(node.id), true,
    'Runtime Transform must be allowed to diverge from Persistent Transform.');

const persistentRecord = store.getPersistentComponentRecord(node.id);
assert.strictEqual(persistentRecord.data.targetRuntimeId, undefined);
assert.strictEqual(persistentRecord.runtimeRevision, undefined);
assert.deepStrictEqual(persistentRecord.data, {position: [10, 20], rotation: 15, scale: [1, 1]});

const sourceFiles = fs.readdirSync(transformRuntimeRoot)
    .filter(name => name.endsWith('.js'))
    .map(name => path.join(transformRuntimeRoot, name));
const backendLeakPattern = /scratch-vm|scratch-render|targetRuntimeId|_allDrawables|_allSkins|_drawThese|BitmapSkin|Drawable|WebGLRenderingContext|GPUDevice/;
sourceFiles.forEach(file => {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, backendLeakPattern,
        `0009-B Runtime wiring must not import Scratch/backend representation: ${path.relative(ROOT, file)}`);
});

store.dispose();
process.stdout.write('0009-B Transform2D Runtime / Persistent Wiring Conformance PASS.\n');
