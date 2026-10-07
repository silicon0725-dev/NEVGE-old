const {
    NODE_FAMILIES,
    NODE_LIFECYCLE_STATES,
    NODE_SCOPES
} = require('./constants');
const {
    RuntimeComponentContainer,
    addRuntimeComponentToContainer,
    destroyAllRuntimeComponents,
    readyAllRuntimeComponents,
    removeRuntimeComponentFromContainer,
    setAllRuntimeComponentsActive
} = require('./component-container');
const {
    LIFECYCLE_ENTITY_KINDS,
    LIFECYCLE_PHASES,
    assertLifecycleTransition,
    normalizeLifecycleDetails
} = require('./runtime-node-lifecycle');
const {cloneSerializable, normalizeSerializableObject} = require('./serializable');
const {createGuardedSemanticValue} = require('./guarded-semantic-value');
const {
    createLifecycleHookContext,
    createProviderResourceContext
} = require('./runtime-node-lifecycle-observation');

const runtimeNodeGraphs = new WeakMap();
const runtimeNodeComponents = new WeakMap();
const runtimeNodeSemanticStates = new WeakMap();
const runtimeNodeInternalStates = new WeakMap();
const runtimeNodeMutationDepths = new WeakMap();
const RUNTIME_NODE_BINDING_AUTHORITY = Object.freeze({});
const RUNTIME_NODE_INTERNAL_METHOD_NAMES = Object.freeze([
    '_bindGraph',
    '_replaceGraphBinding',
    '_invoke',
    '_recordLifecycle',
    '_transition',
    '_markReady',
    '_setActiveInHierarchy',
    'addComponent',
    'removeComponent'
]);
let RUNTIME_NODE_INTERNAL_OPS = null;

const createRuntimeNodeAuthorityError = operation => {
    const error = new Error('Attached Runtime Node mutation requires Runtime Graph authority.');
    error.code = 'RUNTIME_NODE_MODEL_AUTHORITY_REQUIRED';
    error.operation = operation;
    return error;
};

const assertRuntimeNodeSemanticMutation = (node, operation, path = null) => {
    const graph = runtimeNodeGraphs.get(node);
    if (!graph) return true;
    const normalizedOperation = path ? `${operation}:${path}` : operation;
    if (typeof graph._assertMutationAllowed === 'function') graph._assertMutationAllowed(normalizedOperation);
    if (graph._modelMutationAuthorityRequired === true &&
        (runtimeNodeMutationDepths.get(node) || 0) < 1) {
        throw createRuntimeNodeAuthorityError(normalizedOperation);
    }
    return true;
};

const withRuntimeNodeMutationAuthority = (node, graph, operation, callback) => {
    const currentGraph = runtimeNodeGraphs.get(node);
    if (currentGraph && currentGraph !== graph) throw createRuntimeNodeAuthorityError(operation);
    if (graph && typeof graph._assertMutationAllowed === 'function') graph._assertMutationAllowed(operation);
    runtimeNodeMutationDepths.set(node, (runtimeNodeMutationDepths.get(node) || 0) + 1);
    try {
        return callback();
    } finally {
        const nextDepth = (runtimeNodeMutationDepths.get(node) || 1) - 1;
        if (nextDepth > 0) runtimeNodeMutationDepths.set(node, nextDepth);
        else runtimeNodeMutationDepths.delete(node);
    }
};

const notifyRuntimeNodeSemanticMutation = node => {
    const graph = runtimeNodeGraphs.get(node);
    if (graph && typeof graph._touchSemanticRevision === 'function') graph._touchSemanticRevision();
};

const cloneSerializableValue = value => cloneSerializable(value);

const createGuardedNodeValue = (node, field, value) => createGuardedSemanticValue(value, {
    assertMutation: (operation, path) => assertRuntimeNodeSemanticMutation(node, operation, path),
    didMutate: () => notifyRuntimeNodeSemanticMutation(node),
    normalizeAssigned: cloneSerializableValue,
    operationPrefix: `node.${field}`,
    rootPath: `$.${field}`
});

const defineImmutableNodeField = (node, field, value) => {
    Object.defineProperty(node, field, {
        configurable: false,
        enumerable: true,
        value,
        writable: false
    });
};

const defineGuardedNodeField = (node, field, initialValue, options = {}) => {
    const state = runtimeNodeSemanticStates.get(node);
    const normalize = typeof options.normalize === 'function' ? options.normalize : value => value;
    const guarded = options.guarded === true;
    state[field] = guarded ? createGuardedNodeValue(node, field, normalize(initialValue)) : normalize(initialValue);
    Object.defineProperty(node, field, {
        configurable: false,
        enumerable: options.enumerable !== false,
        get: () => runtimeNodeSemanticStates.get(node)[field],
        set: value => {
            assertRuntimeNodeSemanticMutation(node, `node.${field}.set`, `$.${field}`);
            runtimeNodeSemanticStates.get(node)[field] = guarded ?
                createGuardedNodeValue(node, field, normalize(value)) : normalize(value);
            notifyRuntimeNodeSemanticMutation(node);
        }
    });
};

const defineRuntimeNodeBindings = node => {
    Object.defineProperties(node, {
        components: {
            configurable: false,
            enumerable: true,
            get: () => runtimeNodeComponents.get(node) || null
        }
    });
};


const defineFinalRuntimeNodeInternalMethods = node => {
    if (!RUNTIME_NODE_INTERNAL_OPS) {
        throw new Error('Runtime Node internal operations are not initialized.');
    }
    RUNTIME_NODE_INTERNAL_METHOD_NAMES.forEach(methodName => {
        Object.defineProperty(node, methodName, {
            configurable: false,
            enumerable: false,
            value: RUNTIME_NODE_INTERNAL_OPS[methodName],
            writable: false
        });
    });
};

class RuntimeNode {
    constructor (options = {}) {
        if (typeof options.id !== 'string' || !options.id.trim()) {
            throw new TypeError('Runtime node id must be a non-empty string.');
        }
        if (typeof options.typeId !== 'string' || !options.typeId.trim()) {
            throw new TypeError('Runtime node typeId must be a non-empty string.');
        }
        if (!Object.values(NODE_SCOPES).includes(options.scope)) {
            throw new TypeError(`Invalid runtime node scope: ${options.scope}`);
        }
        if (options.scope === NODE_SCOPES.SCENE && (typeof options.sceneId !== 'string' || !options.sceneId.trim())) {
            throw new TypeError('Scene-scoped runtime nodes require a sceneId.');
        }
        if (options.scope === NODE_SCOPES.GLOBAL && options.sceneId) {
            throw new TypeError('Global runtime nodes cannot have a sceneId.');
        }

        runtimeNodeGraphs.set(this, null);
        runtimeNodeMutationDepths.delete(this);
        runtimeNodeComponents.set(this, null);
        runtimeNodeSemanticStates.set(this, Object.create(null));
        const providerResources = new Map();
        runtimeNodeInternalStates.set(this, {
            hooks: options.hooks && typeof options.hooks === 'object' ? options.hooks : {},
            providerResourceContext: createProviderResourceContext(providerResources),
            providerResources,
            readyInvoked: false
        });

        defineImmutableNodeField(this, 'id', options.id.trim());
        defineImmutableNodeField(this, 'typeId', options.typeId.trim());
        defineImmutableNodeField(this, 'family', options.family || NODE_FAMILIES.NODE);
        defineImmutableNodeField(this, 'scope', options.scope);
        defineImmutableNodeField(this, 'sceneId', options.scope === NODE_SCOPES.SCENE ? options.sceneId.trim() : null);
        defineImmutableNodeField(this, 'protected', Boolean(options.protected));
        defineGuardedNodeField(this, 'name',
            typeof options.name === 'string' && options.name.trim() ? options.name.trim() : 'Node');
        defineGuardedNodeField(this, 'enabledSelf', options.enabled !== false, {normalize: Boolean});
        defineGuardedNodeField(this, 'activeInHierarchy', false, {normalize: Boolean});
        defineGuardedNodeField(this, 'parentId', null);
        defineGuardedNodeField(this, 'childIds', [], {
            guarded: true,
            normalize: value => Array.isArray(value) ? cloneSerializable(value) : []
        });
        defineGuardedNodeField(this, 'metadata', normalizeSerializableObject(options.metadata), {
            guarded: true,
            normalize: normalizeSerializableObject
        });
        defineGuardedNodeField(this, 'source', normalizeSerializableObject(options.source), {
            guarded: true,
            normalize: normalizeSerializableObject
        });
        defineGuardedNodeField(this, '_persistentExtras', normalizeSerializableObject(options.persistentExtras), {
            guarded: true,
            normalize: normalizeSerializableObject
        });
        defineGuardedNodeField(this, 'state', NODE_LIFECYCLE_STATES.CREATED);
        Object.defineProperty(this, '_readyInvoked', {
            configurable: false,
            enumerable: true,
            get: () => runtimeNodeInternalStates.get(this).readyInvoked,
            set: value => {
                assertRuntimeNodeSemanticMutation(this, 'node.readyInvoked.set', '$._readyInvoked');
                runtimeNodeInternalStates.get(this).readyInvoked = Boolean(value);
            }
        });
        defineRuntimeNodeBindings(this);
        defineFinalRuntimeNodeInternalMethods(this);
    }

    _bindGraph (graph, authority) {
        assertRuntimeNodeSemanticMutation(this, 'node.bindGraph', '$._graph');
        if (authority !== RUNTIME_NODE_BINDING_AUTHORITY) {
            const error = new Error('Runtime node Graph binding is private to the Runtime Graph.');
            error.code = 'RUNTIME_NODE_INTERNAL_AUTHORITY_REQUIRED';
            error.operation = 'bindGraph';
            throw error;
        }
        runtimeNodeGraphs.set(this, graph);
        runtimeNodeComponents.set(this, new RuntimeComponentContainer(this, graph));
        invokeRuntimeNodeHook(this, 'onCreate', {phase: LIFECYCLE_PHASES.CREATE});
        recordRuntimeNodeLifecycle(this, LIFECYCLE_PHASES.CREATE, null, this.state);
    }

    _replaceGraphBinding (graph, authority) {
        assertRuntimeNodeSemanticMutation(this, 'node.replaceGraphBinding', '$._graph');
        if (authority !== RUNTIME_NODE_BINDING_AUTHORITY) {
            const error = new Error('Runtime node Graph rebinding is private to the Runtime Graph.');
            error.code = 'RUNTIME_NODE_INTERNAL_AUTHORITY_REQUIRED';
            error.operation = 'replaceGraphBinding';
            throw error;
        }
        runtimeNodeGraphs.set(this, graph || null);
        return this;
    }

    _invoke (hookName, extra = {}) {
        const internal = runtimeNodeInternalStates.get(this);
        const hook = internal.hooks[hookName];
        if (typeof hook !== 'function') return null;
        try {
            const payload = createLifecycleHookContext({
                extra,
                graph: runtimeNodeGraphs.get(this),
                node: this,
                resources: internal.providerResourceContext
            });
            const graph = runtimeNodeGraphs.get(this);
            if (graph && typeof graph._runLifecycleHook === 'function') {
                graph._runLifecycleHook({
                    entityKind: LIFECYCLE_ENTITY_KINDS.NODE,
                    hookName,
                    nodeId: this.id,
                    phase: extra.phase || null,
                    state: this.state
                }, () => hook(payload));
            } else {
                hook(payload);
            }
            return null;
        } catch (error) {
            const graph = runtimeNodeGraphs.get(this);
            if (graph && typeof graph._reportLifecycleHookError === 'function') {
                graph._reportLifecycleHookError({
                    entityKind: LIFECYCLE_ENTITY_KINDS.NODE,
                    hookName,
                    nodeId: this.id,
                    phase: extra.phase || null,
                    state: this.state
                }, error);
                return error;
            }
            return error;
        }
    }

    _recordLifecycle (phase, fromState, toState, extra = {}) {
        const graph = runtimeNodeGraphs.get(this);
        if (!graph || typeof graph._recordLifecycle !== 'function') return;
        graph._recordLifecycle(normalizeLifecycleDetails(Object.assign({
            entityKind: LIFECYCLE_ENTITY_KINDS.NODE,
            fromState,
            nodeId: this.id,
            phase,
            toState
        }, extra)));
    }

    _transition (state, phase, hookName, extra = {}) {
        const previousState = this.state;
        if (previousState === state) return false;
        const graph = runtimeNodeGraphs.get(this);
        if (graph && typeof graph._assertMutationAllowed === 'function') {
            graph._assertMutationAllowed('node.transition');
        }
        assertLifecycleTransition(LIFECYCLE_ENTITY_KINDS.NODE, previousState, state, {
            readyInvoked: this._readyInvoked
        });
        this.state = state;
        if (hookName) invokeRuntimeNodeHook(this, hookName, Object.assign({
            fromState: previousState,
            phase,
            toState: state
        }, extra));
        recordRuntimeNodeLifecycle(this, phase, previousState, state, extra);
        return previousState !== state;
    }

    _markReady (extra = {}) {
        if (this._readyInvoked) return false;
        const graph = runtimeNodeGraphs.get(this);
        if (graph && typeof graph._assertMutationAllowed === 'function') {
            graph._assertMutationAllowed('node.markReady');
        }
        this._readyInvoked = true;
        transitionRuntimeNode(this, NODE_LIFECYCLE_STATES.READY, LIFECYCLE_PHASES.READY, 'onReady', extra);
        if (this.components) readyAllRuntimeComponents(this.components, graph);
        return true;
    }

    _setActiveInHierarchy (active, extra = {}) {
        const nextActive = Boolean(active);
        const nextState = nextActive ? NODE_LIFECYCLE_STATES.ACTIVE : NODE_LIFECYCLE_STATES.DISABLED;
        const stateCanChange = this.state !== NODE_LIFECYCLE_STATES.CREATED &&
            this.state !== NODE_LIFECYCLE_STATES.DETACHED &&
            this.state !== NODE_LIFECYCLE_STATES.DESTROYED;
        const activeChanged = this.activeInHierarchy !== nextActive;
        const stateChanged = stateCanChange && this.state !== nextState;
        if (!activeChanged && !stateChanged) return false;
        const graph = runtimeNodeGraphs.get(this);
        if (graph && typeof graph._assertMutationAllowed === 'function') {
            graph._assertMutationAllowed('node.setActiveInHierarchy');
        }

        if (!nextActive && this.components) setAllRuntimeComponentsActive(this.components, false, graph, extra);
        this.activeInHierarchy = nextActive;
        if (stateCanChange) {
            transitionRuntimeNode(this,
                nextState,
                nextActive ? LIFECYCLE_PHASES.ENABLE : LIFECYCLE_PHASES.DISABLE,
                nextActive ? 'onEnable' : 'onDisable',
                extra
            );
        }
        if (nextActive && this.components) setAllRuntimeComponentsActive(this.components, true, graph, extra);
        return true;
    }

    isReady () {
        return this._readyInvoked;
    }

    getParent () {
        const graph = runtimeNodeGraphs.get(this);
        return graph && this.parentId ? graph.getNode(this.parentId) : null;
    }

    getChildren () {
        const graph = runtimeNodeGraphs.get(this);
        return graph ? this.childIds.map(childId => graph.getNode(childId)).filter(Boolean) : [];
    }

    addComponent (options, addOptions = {}) {
        assertRuntimeNodeSemanticMutation(this, 'node.addComponent');
        const graph = runtimeNodeGraphs.get(this);
        if (graph && typeof graph._assertMutationAllowed === 'function') {
            graph._assertMutationAllowed('node.addComponent');
        }
        if (this.protected) throw new Error('Protected runtime root nodes cannot own components.');
        if (!this.components) throw new Error('Runtime node is not attached to a graph.');
        const component = addRuntimeComponentToContainer(this.components, options, addOptions, graph);
        if (graph) graph._notifyComponentChange(this, component, 'component:add');
        return component;
    }

    removeComponent (componentId) {
        assertRuntimeNodeSemanticMutation(this, 'node.removeComponent');
        const graph = runtimeNodeGraphs.get(this);
        if (graph && typeof graph._assertMutationAllowed === 'function') {
            graph._assertMutationAllowed('node.removeComponent');
        }
        if (!this.components) return false;
        const component = this.components.get(componentId);
        const removed = removeRuntimeComponentFromContainer(this.components, componentId, graph);
        if (removed && graph) graph._notifyComponentChange(this, component, 'component:remove');
        return removed;
    }

    getComponent (typeId) {
        return this.components ? this.components.getByType(typeId) : null;
    }

    getComponentById (componentId) {
        return this.components ? this.components.get(componentId) : null;
    }

    getComponents (typeId) {
        if (!this.components) return [];
        return typeof typeId === 'string' ? this.components.getAllByType(typeId) : this.components.list();
    }

    setEnabled (enabled) {
        assertRuntimeNodeSemanticMutation(this, 'node.setEnabled');
        const graph = runtimeNodeGraphs.get(this);
        if (!graph) throw new Error('Runtime node is not attached to a graph.');
        return graph.setNodeEnabled(this.id, enabled);
    }

    setParent (parentId, options) {
        assertRuntimeNodeSemanticMutation(this, 'node.setParent');
        const graph = runtimeNodeGraphs.get(this);
        if (!graph) throw new Error('Runtime node is not attached to a graph.');
        return graph.setParent(this.id, parentId, options);
    }

    toPersistentRecord () {
        const record = Object.assign({}, cloneSerializable(this._persistentExtras), {
            components: this.components ? this.components.toPersistentRecords() : [],
            enabled: this.enabledSelf,
            id: this.id,
            metadata: cloneSerializable(this.metadata),
            name: this.name,
            parentId: this.parentId,
            sceneId: this.sceneId,
            scope: this.scope,
            source: cloneSerializable(this.source),
            typeId: this.typeId
        });
        delete record.activeInHierarchy;
        delete record.childIds;
        delete record.enabledSelf;
        delete record.family;
        delete record.protected;
        delete record.ready;
        delete record.state;
        return record;
    }

    toDebugJSON () {
        return Object.assign({}, this.toPersistentRecord(), {
            activeInHierarchy: this.activeInHierarchy,
            childIds: this.childIds.slice(),
            components: this.components ? this.components.toDebugJSON() : [],
            family: this.family,
            protected: this.protected,
            ready: this._readyInvoked,
            state: this.state
        });
    }

    toJSON () {
        return this.toDebugJSON();
    }
}


const captureRuntimeNodeInternalOperations = () => {
    const operations = Object.create(null);
    RUNTIME_NODE_INTERNAL_METHOD_NAMES.forEach(methodName => {
        const descriptor = Object.getOwnPropertyDescriptor(RuntimeNode.prototype, methodName);
        if (!descriptor || typeof descriptor.value !== 'function') {
            throw new Error(`Missing Runtime Node internal operation: ${methodName}`);
        }
        operations[methodName] = descriptor.value;
        Object.defineProperty(RuntimeNode.prototype, methodName, {
            configurable: false,
            enumerable: descriptor.enumerable === true,
            value: descriptor.value,
            writable: false
        });
    });
    return Object.freeze(operations);
};

RUNTIME_NODE_INTERNAL_OPS = captureRuntimeNodeInternalOperations();

const bindRuntimeNodeToGraph = (node, graph) =>
    RUNTIME_NODE_INTERNAL_OPS._bindGraph.call(node, graph, RUNTIME_NODE_BINDING_AUTHORITY);
const replaceRuntimeNodeGraphBinding = (node, graph, expectedCurrentGraph) => {
    const currentGraph = runtimeNodeGraphs.get(node);
    if (currentGraph !== expectedCurrentGraph) {
        const error = new Error('Runtime node graph binding replacement requires the current Graph authority.');
        error.code = 'RUNTIME_NODE_INTERNAL_AUTHORITY_REQUIRED';
        throw error;
    }
    return withRuntimeNodeMutationAuthority(node, currentGraph, 'node.replaceGraphBinding', () =>
        RUNTIME_NODE_INTERNAL_OPS._replaceGraphBinding.call(node, graph, RUNTIME_NODE_BINDING_AUTHORITY));
};
const invokeRuntimeNodeHook = (node, hookName, extra = {}) =>
    RUNTIME_NODE_INTERNAL_OPS._invoke.call(node, hookName, extra);
const recordRuntimeNodeLifecycle = (node, phase, fromState, toState, extra = {}) =>
    RUNTIME_NODE_INTERNAL_OPS._recordLifecycle.call(node, phase, fromState, toState, extra);
const transitionRuntimeNode = (node, state, phase, hookName, extra = {}) =>
    withRuntimeNodeMutationAuthority(node, runtimeNodeGraphs.get(node), 'node.transition', () =>
        RUNTIME_NODE_INTERNAL_OPS._transition.call(node, state, phase, hookName, extra));
const markRuntimeNodeReady = (node, extra = {}) =>
    withRuntimeNodeMutationAuthority(node, runtimeNodeGraphs.get(node), 'node.markReady', () =>
        RUNTIME_NODE_INTERNAL_OPS._markReady.call(node, extra));
const setRuntimeNodeActiveInHierarchy = (node, active, extra = {}) =>
    withRuntimeNodeMutationAuthority(node, runtimeNodeGraphs.get(node), 'node.setActiveInHierarchy', () =>
        RUNTIME_NODE_INTERNAL_OPS._setActiveInHierarchy.call(node, active, extra));
const addRuntimeNodeComponent = (node, options, addOptions, graph) =>
    withRuntimeNodeMutationAuthority(node, graph, 'node.addComponent', () =>
        RUNTIME_NODE_INTERNAL_OPS.addComponent.call(node, options, addOptions));
const removeRuntimeNodeComponent = (node, componentId, graph) =>
    withRuntimeNodeMutationAuthority(node, graph, 'node.removeComponent', () =>
        RUNTIME_NODE_INTERNAL_OPS.removeComponent.call(node, componentId));
const runRuntimeNodeSemanticMutation = (node, graph, operation, callback) =>
    withRuntimeNodeMutationAuthority(node, graph, operation, callback);

const RUNTIME_NODE_GUARDED_CHECKPOINT_FIELDS = new Set([
    'childIds',
    'metadata',
    'source',
    '_persistentExtras',
    'originalRecord'
]);

const captureRuntimeNodeSemanticCheckpoint = node => {
    const semantic = runtimeNodeSemanticStates.get(node);
    const internal = runtimeNodeInternalStates.get(node);
    if (!semantic || !internal) throw new TypeError('Invalid Runtime Node checkpoint target.');
    const semanticState = Object.create(null);
    Object.keys(semantic).forEach(field => {
        semanticState[field] = cloneSerializableValue(semantic[field]);
    });
    return Object.freeze({
        graph: runtimeNodeGraphs.get(node) || null,
        internal: Object.freeze({
            providerResources: Array.from(internal.providerResources.entries()),
            readyInvoked: Boolean(internal.readyInvoked)
        }),
        semanticState: Object.freeze(semanticState)
    });
};

const restoreRuntimeNodeSemanticCheckpoint = (node, checkpoint, graph) => {
    if (!checkpoint || checkpoint.graph !== graph) {
        const error = new Error('Runtime Node checkpoint restoration requires the original Graph authority.');
        error.code = 'RUNTIME_NODE_CHECKPOINT_AUTHORITY_REQUIRED';
        throw error;
    }
    const semantic = runtimeNodeSemanticStates.get(node);
    const internal = runtimeNodeInternalStates.get(node);
    if (!semantic || !internal) throw new TypeError('Invalid Runtime Node checkpoint target.');
    Object.keys(semantic).forEach(field => {
        if (!Object.prototype.hasOwnProperty.call(checkpoint.semanticState, field)) delete semantic[field];
    });
    Object.keys(checkpoint.semanticState).forEach(field => {
        const value = cloneSerializableValue(checkpoint.semanticState[field]);
        semantic[field] = RUNTIME_NODE_GUARDED_CHECKPOINT_FIELDS.has(field) ?
            createGuardedNodeValue(node, field, value) : value;
    });
    internal.readyInvoked = Boolean(checkpoint.internal.readyInvoked);
    internal.providerResources.clear();
    checkpoint.internal.providerResources.forEach(([key, value]) => internal.providerResources.set(key, value));
    runtimeNodeGraphs.set(node, graph);
    return node;
};

class UnknownRuntimeNode extends RuntimeNode {
    constructor (options = {}) {
        const originalTypeId = typeof options.originalTypeId === 'string' && options.originalTypeId.trim() ?
            options.originalTypeId.trim() : 'unknown';
        super(Object.assign({}, options, {
            typeId: options.typeId
        }));
        defineImmutableNodeField(this, 'originalTypeId', originalTypeId);
        defineGuardedNodeField(this, 'originalRecord', normalizeSerializableObject(options.originalRecord), {
            guarded: true,
            normalize: normalizeSerializableObject
        });
        defineImmutableNodeField(this, 'missingProvider',
            typeof options.missingProvider === 'string' && options.missingProvider.trim() ?
                options.missingProvider.trim() : originalTypeId);
        defineImmutableNodeField(this, 'missingVersion', options.missingVersion || null);
    }

    toPersistentRecord () {
        const record = Object.assign({}, cloneSerializable(this.originalRecord), super.toPersistentRecord(), {
            typeId: this.originalTypeId
        });
        if (typeof this.originalRecord.missingProvider === 'string' && this.originalRecord.missingProvider) {
            record.missingProvider = this.originalRecord.missingProvider;
        } else {
            delete record.missingProvider;
        }
        if (typeof this.originalRecord.missingVersion === 'string' && this.originalRecord.missingVersion) {
            record.missingVersion = this.originalRecord.missingVersion;
        } else {
            delete record.missingVersion;
        }
        delete record.activeInHierarchy;
        delete record.childIds;
        delete record.enabledSelf;
        delete record.family;
        delete record.protected;
        delete record.ready;
        delete record.state;
        return record;
    }

    toDebugJSON () {
        return Object.assign({}, super.toDebugJSON(), {
            missingProvider: this.missingProvider,
            missingVersion: this.missingVersion,
            originalRecord: cloneSerializable(this.originalRecord),
            originalTypeId: this.originalTypeId
        });
    }

    toJSON () {
        return this.toDebugJSON();
    }
}

class RuntimeNode2D extends RuntimeNode {
    constructor (options = {}) {
        super(Object.assign({}, options, {family: NODE_FAMILIES.NODE_2D}));
    }
}

class RuntimeServiceNode extends RuntimeNode {
    constructor (options = {}) {
        super(Object.assign({}, options, {family: NODE_FAMILIES.SERVICE}));
    }
}

class RuntimeRootNode extends RuntimeNode {
    constructor (options = {}) {
        super(Object.assign({}, options, {
            family: NODE_FAMILIES.ROOT,
            protected: true
        }));
    }
}

module.exports = {
    RuntimeNode,
    UnknownRuntimeNode,
    RuntimeNode2D,
    RuntimeRootNode,
    RuntimeServiceNode
};


Object.defineProperties(module.exports, {
    addRuntimeNodeComponent: {value: addRuntimeNodeComponent},
    bindRuntimeNodeToGraph: {value: bindRuntimeNodeToGraph},
    invokeRuntimeNodeHook: {value: invokeRuntimeNodeHook},
    markRuntimeNodeReady: {value: markRuntimeNodeReady},
    recordRuntimeNodeLifecycle: {value: recordRuntimeNodeLifecycle},
    removeRuntimeNodeComponent: {value: removeRuntimeNodeComponent},
    replaceRuntimeNodeGraphBinding: {value: replaceRuntimeNodeGraphBinding},
    captureRuntimeNodeSemanticCheckpoint: {value: captureRuntimeNodeSemanticCheckpoint},
    restoreRuntimeNodeSemanticCheckpoint: {value: restoreRuntimeNodeSemanticCheckpoint},
    runRuntimeNodeSemanticMutation: {value: runRuntimeNodeSemanticMutation},
    setRuntimeNodeActiveInHierarchy: {value: setRuntimeNodeActiveInHierarchy},
    transitionRuntimeNode: {value: transitionRuntimeNode}
});
