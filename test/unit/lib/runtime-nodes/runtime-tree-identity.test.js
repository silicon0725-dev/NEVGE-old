import {
    GLOBAL_ROOT_NODE_ID,
    GLOBAL_SCOPE_TREE_NODE_ID,
    getRuntimeRootIdFromTreeId,
    getRuntimeRootTreeId,
    getSceneRootNodeId,
    getSceneTreeNodeId,
    isRuntimeRootTreeId
} from '../../../../src/lib/runtime-nodes';

describe('Runtime tree identity mapping', () => {
    test('maps GlobalRoot and SceneRoot between runtime and editor identities', () => {
        expect(getRuntimeRootTreeId({id: GLOBAL_ROOT_NODE_ID, scope: 'global'}))
            .toBe(GLOBAL_SCOPE_TREE_NODE_ID);
        expect(getRuntimeRootTreeId({sceneId: 'scene-a', scope: 'scene'}))
            .toBe('scene:scene-a');
        expect(getRuntimeRootIdFromTreeId(GLOBAL_SCOPE_TREE_NODE_ID)).toBe(GLOBAL_ROOT_NODE_ID);
        expect(getRuntimeRootIdFromTreeId(getSceneTreeNodeId('scene-a'))).toBe(getSceneRootNodeId('scene-a'));
        expect(isRuntimeRootTreeId('scene:scene-a')).toBe(true);
        expect(isRuntimeRootTreeId('runtime-node:ordinary')).toBe(false);
    });
});
