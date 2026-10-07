const {cloneSerializable} = require('./serializable');

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return Object.freeze(value);
};

const createReadonlyComponentSnapshot = component => {
    if (!component) return null;
    return deepFreeze({
        activeInHierarchy: Boolean(component.activeInHierarchy),
        data: cloneSerializable(component.data),
        enabled: Boolean(component.enabled),
        id: component.id,
        ownerId: component.ownerId,
        schemaVersion: component.schemaVersion,
        state: component.state,
        typeId: component.typeId,
        allowMultiple: Boolean(component.allowMultiple),
        cardinality: component.cardinality,
        extensionData: cloneSerializable(component._extensionData || {})
    });
};

const createReadonlyNodeSnapshot = node => {
    if (!node) return null;
    const snapshot = {
        activeInHierarchy: Boolean(node.activeInHierarchy),
        childIds: Array.isArray(node.childIds) ? node.childIds.slice() : [],
        components: node.components && typeof node.components.list === 'function' ?
            node.components.list().map(createReadonlyComponentSnapshot) : [],
        enabled: Boolean(node.enabledSelf),
        enabledSelf: Boolean(node.enabledSelf),
        family: node.family,
        id: node.id,
        metadata: cloneSerializable(node.metadata),
        name: node.name,
        parentId: node.parentId,
        protected: Boolean(node.protected),
        sceneId: node.sceneId,
        scope: node.scope,
        source: cloneSerializable(node.source),
        state: node.state,
        typeId: node.typeId
    };
    if (node.originalTypeId) {
        snapshot.missingProvider = node.missingProvider || node.originalTypeId;
        snapshot.missingVersion = node.missingVersion || null;
        snapshot.originalTypeId = node.originalTypeId;
    }
    return deepFreeze(snapshot);
};

const createReadonlySceneSnapshot = (graph, sceneId) => {
    const root = graph.getSceneRoot(sceneId);
    if (!root) return null;
    const nodes = graph.listNodes({includeRoots: false, sceneId}).map(createReadonlyNodeSnapshot);
    return deepFreeze({
        active: Boolean(root.activeInHierarchy),
        nodeCount: nodes.length,
        nodes,
        root: createReadonlyNodeSnapshot(root),
        sceneId: root.sceneId
    });
};

const createReadonlySubtreeResult = (graph, query = {}) => {
    const rootNodeId = typeof query.rootNodeId === 'string' ? query.rootNodeId : '';
    if (!rootNodeId) throw new TypeError('Runtime subtree query requires rootNodeId.');
    const order = query.order === 'post' || query.order === 'breadth' ? query.order : 'pre';
    const includeRoot = query.includeRoot !== false;
    let maxDepth = null;
    if (query.maxDepth !== null && typeof query.maxDepth !== 'undefined') {
        if (!Number.isInteger(query.maxDepth) || query.maxDepth < 0) {
            throw new TypeError('Runtime subtree query maxDepth must be a non-negative integer or null.');
        }
        maxDepth = query.maxDepth;
    }
    const root = graph.getNode(rootNodeId);
    if (!root) throw new Error(`Unknown runtime node: ${rootNodeId}`);
    const entries = [];
    if (order === 'breadth') {
        const queue = [{depth: 0, node: root}];
        while (queue.length) {
            const current = queue.shift();
            if ((includeRoot || current.depth > 0) && (maxDepth === null || current.depth <= maxDepth)) {
                entries.push(deepFreeze({depth: current.depth, node: createReadonlyNodeSnapshot(current.node)}));
            }
            if (maxDepth !== null && current.depth >= maxDepth) continue;
            current.node.childIds.forEach(childId => {
                const child = graph.getNode(childId);
                if (child) queue.push({depth: current.depth + 1, node: child});
            });
        }
    } else {
        graph.traverse(rootNodeId, (node, depth) => {
            if (!includeRoot && depth === 0) return;
            if (maxDepth !== null && depth > maxDepth) return;
            entries.push(deepFreeze({depth, node: createReadonlyNodeSnapshot(node)}));
        }, {order});
    }
    return deepFreeze({
        nodes: entries,
        query: deepFreeze({includeRoot, maxDepth, order, rootNodeId})
    });
};

const createLifecycleQueryFacade = graph => Object.freeze({
    getComponentSnapshot: (nodeId, componentId) => {
        const node = graph.getNode(nodeId);
        return node ? createReadonlyComponentSnapshot(node.getComponentById(componentId)) : null;
    },
    getNodeSnapshot: nodeId => createReadonlyNodeSnapshot(graph.getNode(nodeId)),
    getSceneSnapshot: sceneId => createReadonlySceneSnapshot(graph, sceneId),
    querySubtree: query => createReadonlySubtreeResult(graph, query)
});

const createProviderResourceContext = resourceStore => Object.freeze({
    delete: key => resourceStore.delete(String(key)),
    get: key => resourceStore.get(String(key)),
    has: key => resourceStore.has(String(key)),
    set: (key, value) => {
        resourceStore.set(String(key), value);
        return value;
    }
});

const createLifecycleHookContext = ({component = null, extra = {}, graph, node, resources}) => {
    const status = graph && typeof graph.getStatus === 'function' ? graph.getStatus() : {};
    const source = extra && typeof extra === 'object' ? extra : {};
    const context = {
        component: createReadonlyComponentSnapshot(component),
        componentId: component ? component.id : null,
        fromState: typeof source.fromState === 'string' ? source.fromState : null,
        node: createReadonlyNodeSnapshot(node),
        nodeId: node ? node.id : null,
        phase: typeof source.phase === 'string' ? source.phase : null,
        query: createLifecycleQueryFacade(graph),
        reason: typeof source.reason === 'string' ? source.reason : null,
        resources,
        runtimeGeneration: Number.isInteger(status.runtimeGeneration) ? status.runtimeGeneration : 1,
        sequence: Number.isInteger(status.lifecycleSequence) ? status.lifecycleSequence : 0,
        toState: typeof source.toState === 'string' ? source.toState : null
    };
    return Object.freeze(context);
};

module.exports = {
    createLifecycleHookContext,
    createLifecycleQueryFacade,
    createProviderResourceContext,
    createReadonlyComponentSnapshot,
    createReadonlyNodeSnapshot,
    createReadonlySceneSnapshot,
    createReadonlySubtreeResult,
    deepFreeze
};
