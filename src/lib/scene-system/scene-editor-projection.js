const NGVGE_DATA_KEY = 'ngvge';
const NODE_TREE_SECTION_ID = 'ngvge-node-tree';
const SCENE_EDITOR_PROJECTION_VERSION = 1;

const cloneMinimalNode = node => ({
    childIds: Array.isArray(node && node.childIds) ? node.childIds.filter(id => typeof id === 'string') : [],
    enabled: !node || node.enabled !== false,
    id: node && typeof node.id === 'string' ? node.id : '',
    name: node && typeof node.name === 'string' && node.name ? node.name : 'Node',
    parentId: node && typeof node.parentId === 'string' && node.parentId ? node.parentId : null,
    pluginId: node && typeof node.pluginId === 'string' ? node.pluginId : null,
    typeId: node && typeof node.typeId === 'string' && node.typeId ? node.typeId : 'ngvge.node2d'
});

const createSceneEditorProjection = projectJSON => {
    const projectData = projectJSON && projectJSON[NGVGE_DATA_KEY];
    const projectSections = projectData && typeof projectData === 'object' ? projectData.projectSections : null;
    const nodeTree = projectSections && typeof projectSections === 'object' ? projectSections[NODE_TREE_SECTION_ID] : null;
    const records = nodeTree && Array.isArray(nodeTree.nodes) ? nodeTree.nodes : [];
    const targetBindings = nodeTree && Array.isArray(nodeTree.targetBindings) ? nodeTree.targetBindings : [];
    const seenNodeIds = new Set();
    const nodes = [];
    records.forEach(record => {
        const node = cloneMinimalNode(record);
        if (!node.id || seenNodeIds.has(node.id)) return;
        seenNodeIds.add(node.id);
        nodes.push(node);
    });
    const targets = (projectJSON && Array.isArray(projectJSON.targets) ? projectJSON.targets : []).map((target, index) => ({
        index,
        isStage: Boolean(target && target.isStage),
        name: target && typeof target.name === 'string' && target.name ? target.name : (index === 0 ? 'Stage' : `Sprite ${index}`),
        nodeId: typeof targetBindings[index] === 'string' && targetBindings[index] ? targetBindings[index] : null
    }));
    return {
        nodes,
        targets,
        version: SCENE_EDITOR_PROJECTION_VERSION
    };
};

const isSceneEditorProjection = value => Boolean(
    value &&
    value.version === SCENE_EDITOR_PROJECTION_VERSION &&
    Array.isArray(value.nodes) &&
    Array.isArray(value.targets)
);

module.exports = {
    NODE_TREE_SECTION_ID,
    SCENE_EDITOR_PROJECTION_VERSION,
    createSceneEditorProjection,
    isSceneEditorProjection
};
