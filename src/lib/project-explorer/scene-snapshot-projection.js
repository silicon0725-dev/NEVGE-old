import {readPortableTextFile} from '../first-party-modules/portable-project-files';
import {
    NODE_TREE_SECTION_ID,
    createSceneEditorProjection,
    isSceneEditorProjection
} from '../scene-system/scene-editor-projection';

const SNAPSHOT_NODE_PREFIX = 'scene-snapshot-node:';
const SNAPSHOT_TARGET_PREFIX = 'scene-snapshot-target:';
const MAX_PROJECTION_CACHE_ENTRIES = 32;

const projectionCache = new Map();

const getSnapshotSignature = scene => {
    const snapshot = scene && scene.snapshot;
    if (!snapshot || typeof snapshot.payload !== 'string' || !snapshot.payload) return null;
    const metadata = snapshot.metadata && typeof snapshot.metadata === 'object' ? snapshot.metadata : {};
    const prefix = snapshot.payload.slice(0, 24);
    const suffix = snapshot.payload.slice(-24);
    return [
        scene.id,
        snapshot.schemaVersion,
        snapshot.byteLength,
        metadata.capturedAt || '',
        snapshot.payload.length,
        prefix,
        suffix
    ].join('|');
};

const rememberProjection = (key, projection) => {
    if (projectionCache.has(key)) projectionCache.delete(key);
    projectionCache.set(key, projection);
    while (projectionCache.size > MAX_PROJECTION_CACHE_ENTRIES) {
        const oldestKey = projectionCache.keys().next().value;
        projectionCache.delete(oldestKey);
    }
};

const getSceneSnapshotNodeTreeId = (sceneId, nodeId) => (
    `${SNAPSHOT_NODE_PREFIX}${encodeURIComponent(sceneId)}:${encodeURIComponent(nodeId)}`
);

const getSceneSnapshotTargetTreeId = (sceneId, targetIndex) => (
    `${SNAPSHOT_TARGET_PREFIX}${encodeURIComponent(sceneId)}:${targetIndex}`
);

const createProjection = (scene, serializedProjection, source) => {
    const nodeById = new Map();
    const childrenByParentId = new Map();
    serializedProjection.nodes.forEach(node => {
        if (!node || typeof node.id !== 'string' || !node.id || nodeById.has(node.id)) return;
        nodeById.set(node.id, Object.assign({}, node, {
            childIds: Array.isArray(node.childIds) ? node.childIds.slice() : []
        }));
    });
    nodeById.forEach(node => {
        const parentId = node.parentId || null;
        if (!childrenByParentId.has(parentId)) childrenByParentId.set(parentId, []);
        childrenByParentId.get(parentId).push(node);
    });

    const targets = serializedProjection.targets.map(target => Object.assign({}, target));
    const targetNodeIds = new Set(targets.map(target => target.nodeId).filter(Boolean));
    const rootCustomNodes = (childrenByParentId.get(null) || []).filter(node => !targetNodeIds.has(node.id));

    return {
        getChildren: parentId => (childrenByParentId.get(parentId || null) || []).slice(),
        getNode: nodeId => nodeById.get(nodeId) || null,
        getTarget: targetIndex => targets.find(target => target.index === targetIndex) || null,
        nodeById,
        nodes: Array.from(nodeById.values()),
        rootCustomNodes,
        sceneId: scene.id,
        source,
        targetNodeIds,
        targets,
        version: 1
    };
};

const getSceneSnapshotProjection = scene => {
    const key = getSnapshotSignature(scene);
    if (!key) return null;
    if (projectionCache.has(key)) {
        const cached = projectionCache.get(key);
        projectionCache.delete(key);
        projectionCache.set(key, cached);
        return cached;
    }
    try {
        const metadataProjection = scene.snapshot.metadata && scene.snapshot.metadata.editorProjection;
        let serializedProjection;
        let source;
        if (isSceneEditorProjection(metadataProjection)) {
            serializedProjection = metadataProjection;
            source = 'metadata';
        } else {
            const text = readPortableTextFile(scene.snapshot.payload, 'project.json');
            if (!text) return null;
            serializedProjection = createSceneEditorProjection(JSON.parse(text));
            source = 'payload';
        }
        const projection = createProjection(scene, serializedProjection, source);
        rememberProjection(key, projection);
        return projection;
    } catch {
        return null;
    }
};

const clearSceneSnapshotProjectionCache = () => projectionCache.clear();

export {
    NODE_TREE_SECTION_ID,
    SNAPSHOT_NODE_PREFIX,
    SNAPSHOT_TARGET_PREFIX,
    clearSceneSnapshotProjectionCache,
    getSceneSnapshotNodeTreeId,
    getSceneSnapshotProjection,
    getSceneSnapshotTargetTreeId
};
