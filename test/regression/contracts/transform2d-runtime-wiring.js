const assert = require('assert');

const assertTransform2DRuntimeWiringContract = () => {
    const {
        BUILTIN_RUNTIME_NODE_TYPE_IDS,
        RuntimeNodeGraph
    } = require('../../../src/lib/runtime-nodes');
    const {
        createTransform2DRuntimeStore
    } = require('../../../src/lib/transform-system');

    const nodeId = 'ngvge:node:0009bregression';
    const graph = new RuntimeNodeGraph({
        activeSceneId: 'scene-a',
        scenes: [{id: 'scene-a', name: 'Scene A'}]
    });
    const node = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE_2D, {id: nodeId, sceneId: 'scene-a'});
    const store = createTransform2DRuntimeStore(graph);
    const component = store.ensureTransformComponent(node.id, {
        componentId: 'runtime-component:0009bregression',
        data: {position: [4, 5], rotation: 6, scale: [1, 1]}
    });
    const persistentBefore = graph.exportState();
    const revisionBefore = graph.getStatus().revision;

    store.patchRuntimeTransform(node.id, {position: [40, 50], rotation: 60});
    assert.deepStrictEqual(store.getRuntimeTransform(node.id), {
        position: [40, 50],
        rotation: 60,
        scale: [1, 1]
    });
    assert.deepStrictEqual(component.data, {position: [4, 5], rotation: 6, scale: [1, 1]});
    assert.deepStrictEqual(graph.exportState(), persistentBefore);
    assert.strictEqual(graph.getStatus().revision, revisionBefore);
    assert.strictEqual(component.ownerId, nodeId);
    assert.strictEqual(component.typeId, 'ngvge.transform2d');
    assert.strictEqual(component.toPersistentRecord().data.targetRuntimeId, undefined);

    store.dispose();
    return {
        persistentRuntimeSeparated: true,
        runtimeWritesDoNotTouchProjectSource: true,
        semanticNodeOwnership: true,
        transformComponentRegistered: true
    };
};

module.exports = {
    assertTransform2DRuntimeWiringContract
};
