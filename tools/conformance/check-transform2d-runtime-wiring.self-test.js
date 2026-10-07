#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    RuntimeNodeGraph
} = require('../../src/lib/runtime-nodes');
const {
    createTransform2DComponentOptions,
    createTransform2DRuntimeStore,
    registerTransform2DRuntimeComponent
} = require('../../src/lib/transform-system');

const cases = [];
const run = (name, callback) => {
    callback();
    cases.push(name);
};
const makeGraph = () => new RuntimeNodeGraph({
    activeSceneId: 'scene-a',
    scenes: [{id: 'scene-a', name: 'Scene A'}]
});
const addNode = graph => graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE_2D, {
    id: 'ngvge:node:0009bselftest',
    sceneId: 'scene-a'
});

run('descriptor-registration', () => {
    const graph = makeGraph();
    assert.strictEqual(registerTransform2DRuntimeComponent(graph.componentTypeRegistry).typeId, 'ngvge.transform2d');
});
run('component-options', () => {
    assert.deepStrictEqual(createTransform2DComponentOptions({componentId: 'component:transform:0009babc'}), {
        data: {position: [0, 0], rotation: 0, scale: [1, 1]},
        enabled: true,
        id: 'component:transform:0009babc',
        schemaVersion: 1,
        typeId: 'ngvge.transform2d'
    });
});
run('backend-field-rejected', () => {
    assert.throws(() => createTransform2DComponentOptions({targetRuntimeId: 'volatile'}),
        error => error && error.code === 'NGVGE_TRANSFORM2D_COMPONENT_OPTION_FORBIDDEN');
});
run('persistent-to-runtime-hydrate', () => {
    const graph = makeGraph();
    const node = addNode(graph);
    const store = createTransform2DRuntimeStore(graph);
    store.ensureTransformComponent(node.id, {data: {position: [1, 2], rotation: 3, scale: [4, 5]}});
    assert.deepStrictEqual(store.getRuntimeTransform(node.id), {position: [1, 2], rotation: 3, scale: [4, 5]});
    store.dispose();
});
run('runtime-write-isolated', () => {
    const graph = makeGraph();
    const node = addNode(graph);
    const store = createTransform2DRuntimeStore(graph);
    store.ensureTransformComponent(node.id);
    const before = JSON.stringify(graph.exportState());
    const revision = graph.getStatus().revision;
    store.patchRuntimeTransform(node.id, {position: [50, 60]});
    assert.strictEqual(JSON.stringify(graph.exportState()), before);
    assert.strictEqual(graph.getStatus().revision, revision);
    store.dispose();
});
run('explicit-rehydrate', () => {
    const graph = makeGraph();
    const node = addNode(graph);
    const store = createTransform2DRuntimeStore(graph);
    const component = store.ensureTransformComponent(node.id);
    store.patchRuntimeTransform(node.id, {position: [8, 9]});
    graph.patchComponentData(node.id, component.id, {position: [2, 3]});
    assert.deepStrictEqual(store.getRuntimeTransform(node.id).position, [8, 9]);
    store.hydrateNodeFromPersistent(node.id);
    assert.deepStrictEqual(store.getRuntimeTransform(node.id).position, [2, 3]);
    store.dispose();
});
run('component-removal-cleans-runtime', () => {
    const graph = makeGraph();
    const node = addNode(graph);
    const store = createTransform2DRuntimeStore(graph);
    const component = store.ensureTransformComponent(node.id);
    graph.removeComponent(node.id, component.id);
    assert.strictEqual(store.getRuntimeTransform(node.id), null);
    store.dispose();
});
run('round-trip-rehydrates-persistent', () => {
    const graph = makeGraph();
    const node = addNode(graph);
    const store = createTransform2DRuntimeStore(graph);
    store.ensureTransformComponent(node.id, {data: {position: [6, 7], rotation: 8, scale: [1, -1]}});
    store.patchRuntimeTransform(node.id, {position: [100, 200]});
    const state = graph.exportState();
    store.dispose();
    const rebuilt = RuntimeNodeGraph.createFromState(state, {componentTypeRegistry: graph.componentTypeRegistry}).graph;
    const rebuiltStore = createTransform2DRuntimeStore(rebuilt);
    assert.deepStrictEqual(rebuiltStore.getRuntimeTransform(node.id), {position: [6, 7], rotation: 8, scale: [1, -1]});
    rebuiltStore.dispose();
});

process.stdout.write(`0009-B Transform2D Runtime / Persistent Wiring self-test PASS (${cases.length}/${cases.length}).\n`);
