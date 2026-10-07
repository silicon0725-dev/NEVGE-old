const {
    GLOBAL_ROOT_NODE_ID,
    NODE_SCOPES,
    getSceneRootNodeId
} = require('./constants');

const GLOBAL_SCOPE_TREE_NODE_ID = 'scope:global';
const SCENE_SCOPE_TREE_NODE_PREFIX = 'scene:';

const getSceneTreeNodeId = sceneId => `${SCENE_SCOPE_TREE_NODE_PREFIX}${sceneId}`;

const getRuntimeRootTreeId = root => {
    if (!root || typeof root !== 'object') return null;
    if (root.scope === NODE_SCOPES.GLOBAL || root.id === GLOBAL_ROOT_NODE_ID) {
        return GLOBAL_SCOPE_TREE_NODE_ID;
    }
    if (root.scope === NODE_SCOPES.SCENE && typeof root.sceneId === 'string' && root.sceneId) {
        return getSceneTreeNodeId(root.sceneId);
    }
    return null;
};

const getRuntimeRootIdFromTreeId = treeId => {
    if (treeId === GLOBAL_SCOPE_TREE_NODE_ID) return GLOBAL_ROOT_NODE_ID;
    if (typeof treeId !== 'string' || !treeId.startsWith(SCENE_SCOPE_TREE_NODE_PREFIX)) return null;
    const sceneId = treeId.slice(SCENE_SCOPE_TREE_NODE_PREFIX.length);
    return sceneId ? getSceneRootNodeId(sceneId) : null;
};

const isRuntimeRootTreeId = treeId => Boolean(getRuntimeRootIdFromTreeId(treeId));

module.exports = {
    GLOBAL_SCOPE_TREE_NODE_ID,
    SCENE_SCOPE_TREE_NODE_PREFIX,
    getRuntimeRootIdFromTreeId,
    getRuntimeRootTreeId,
    getSceneTreeNodeId,
    isRuntimeRootTreeId
};
