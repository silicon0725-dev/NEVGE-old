const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    GLOBAL_ROOT_NODE_ID,
    NODE_LIFECYCLE_STATES,
    NODE_SCOPES,
    RUNTIME_NODE_MODEL_VERSION,
    getSceneRootNodeId
} = require('./constants');
const {createRuntimeId} = require('./id');
const {createRuntimeNodeTypeRegistry} = require('./runtime-node-type-registry');
const {
    captureRuntimeComponentTypeRegistryCheckpoint,
    createRuntimeComponentTypeRegistry,
    restoreRuntimeComponentTypeRegistryCheckpoint
} = require('./runtime-component-type-registry');
const {
    captureRuntimeComponentContainerCheckpoint,
    captureRuntimeComponentSemanticCheckpoint,
    destroyAllRuntimeComponents,
    patchRuntimeComponentData,
    removeRuntimeComponentFromContainer,
    replaceRuntimeComponentContainerGraphBinding,
    restoreRuntimeComponentContainerCheckpoint,
    replaceRuntimeComponentGraphBinding,
    restoreRuntimeComponentSemanticCheckpoint,
    setRuntimeComponentData,
    setRuntimeComponentEnabled
} = require('./component-container');
const {
    LIFECYCLE_PHASES,
    RUNTIME_NODE_LIFECYCLE_CONTRACT,
    normalizeLifecycleDetails
} = require('./runtime-node-lifecycle');
const {
    UnknownRuntimeNode,
    captureRuntimeNodeSemanticCheckpoint,
    addRuntimeNodeComponent,
    bindRuntimeNodeToGraph,
    invokeRuntimeNodeHook,
    markRuntimeNodeReady,
    recordRuntimeNodeLifecycle,
    removeRuntimeNodeComponent,
    replaceRuntimeNodeGraphBinding,
    restoreRuntimeNodeSemanticCheckpoint,
    runRuntimeNodeSemanticMutation,
    setRuntimeNodeActiveInHierarchy,
    transitionRuntimeNode
} = require('./runtime-node');
const {RuntimeNodeImportError, getMissingProviderId, validateRuntimeNodeSnapshot} = require('./runtime-node-import');
const {compareCanonicalStrings} = require('./canonical-order');
const {cloneSerializable, normalizeSerializableObject} = require('./serializable');
const {
    COMPONENT_CARDINALITIES,
    normalizePublicComponentOptions
} = require('./runtime-component-contract');

const runtimeNodeGraphRevisions = new WeakMap();

const initializeRuntimeNodeGraphRevision = (graph, revision = 0) => {
    runtimeNodeGraphRevisions.set(graph, revision);
    if (!Object.prototype.hasOwnProperty.call(graph, '_revision')) {
        Object.defineProperty(graph, '_revision', {
            configurable: false,
            enumerable: true,
            get: () => runtimeNodeGraphRevisions.get(graph) || 0
        });
    }
};

const incrementRuntimeNodeGraphRevision = graph => {
    const revision = (runtimeNodeGraphRevisions.get(graph) || 0) + 1;
    runtimeNodeGraphRevisions.set(graph, revision);
    return revision;
};

const createRuntimeNodeGraphSemanticCheckpoint = graph => {
    if (!(graph instanceof RuntimeNodeGraph)) throw new TypeError('Runtime Graph checkpoint requires RuntimeNodeGraph.');
    graph._assertAvailable();
    const nodeEntries = Array.from(graph._nodes.entries());
    const nodeCheckpoints = new Map();
    const containerCheckpoints = new Map();
    const componentCheckpoints = new Map();
    nodeEntries.forEach(([, node]) => {
        nodeCheckpoints.set(node, captureRuntimeNodeSemanticCheckpoint(node));
        if (!node.components) return;
        const containerCheckpoint = captureRuntimeComponentContainerCheckpoint(node.components);
        containerCheckpoints.set(node.components, containerCheckpoint);
        containerCheckpoint.components.forEach(([, component]) => {
            componentCheckpoints.set(component, captureRuntimeComponentSemanticCheckpoint(component));
        });
    });
    return Object.freeze({
        componentCheckpoints,
        componentTypeRegistry: captureRuntimeComponentTypeRegistryCheckpoint(graph.componentTypeRegistry),
        containerCheckpoints,
        lifecycleSequence: graph._lifecycleSequence,
        lifecycleTrace: graph._lifecycleTrace.slice(),
        nodeCheckpoints,
        nodeEntries,
        runtimeGeneration: graph._runtimeGeneration,
        sceneRootEntries: Array.from(graph._sceneRootIds.entries())
    });
};

const restoreRuntimeNodeGraphSemanticCheckpoint = (graph, checkpoint) => {
    if (!(graph instanceof RuntimeNodeGraph) || !checkpoint || checkpoint.runtimeGeneration !== graph._runtimeGeneration) {
        const error = new Error('Runtime Graph checkpoint cannot be restored across Runtime generations.');
        error.code = 'RUNTIME_NODE_MUTATION_CHECKPOINT_INVALID';
        throw error;
    }
    const checkpointNodes = new Map(checkpoint.nodeEntries);
    // Dispose objects created by the failed attempt while they are still attached to the active Graph.
    Array.from(graph._nodes.entries()).forEach(([nodeId, node]) => {
        const originalNode = checkpointNodes.get(nodeId);
        if (!originalNode || originalNode !== node) {
            try {
                graph._destroyNode(node, {force: true});
            } catch (error) {
                // Structural restoration below is authoritative; provider cleanup failures cannot veto rollback.
            }
            try {
                if (node.components) replaceRuntimeComponentContainerGraphBinding(node.components, null, graph);
            } catch (error) {
                // Best-effort detachment of a failed-attempt container.
            }
            try {
                replaceRuntimeNodeGraphBinding(node, null, graph);
            } catch (error) {
                // Best-effort detachment of a failed-attempt Node.
            }
            return;
        }
        const containerCheckpoint = checkpoint.containerCheckpoints.get(node.components);
        if (!containerCheckpoint) return;
        const originalComponents = new Map(containerCheckpoint.components);
        node.components.list().forEach(component => {
            if (originalComponents.get(component.id) === component) return;
            try {
                removeRuntimeComponentFromContainer(node.components, component.id, graph);
            } catch (error) {
                // Structural restoration below is authoritative; provider cleanup failures cannot veto rollback.
            }
        });
    });

    graph._nodes = new Map(checkpoint.nodeEntries);
    graph._sceneRootIds = new Map(checkpoint.sceneRootEntries);
    checkpoint.nodeCheckpoints.forEach((nodeCheckpoint, node) => {
        restoreRuntimeNodeSemanticCheckpoint(node, nodeCheckpoint, graph);
    });
    checkpoint.containerCheckpoints.forEach((containerCheckpoint, container) => {
        restoreRuntimeComponentContainerCheckpoint(container, containerCheckpoint, graph);
    });
    checkpoint.componentCheckpoints.forEach((componentCheckpoint, component) => {
        restoreRuntimeComponentSemanticCheckpoint(component, componentCheckpoint, graph);
    });
    restoreRuntimeComponentTypeRegistryCheckpoint(graph.componentTypeRegistry, checkpoint.componentTypeRegistry);
    graph._lifecycleSequence = checkpoint.lifecycleSequence;
    graph._lifecycleTrace = checkpoint.lifecycleTrace.slice();
    // Revision counters are deliberately monotonic and are not rolled back. A failed attempt may stale old tokens,
    // but it cannot make a previously observed token identify a different future state.
    return graph;
};


const nodeTypeRegistries = new WeakMap();

const createNodeTypeRegistryReplacementError = () => {
    const error = new Error('Runtime node type registry binding cannot be replaced directly.');
    error.code = 'RUNTIME_NODE_TYPE_REGISTRY_REPLACEMENT_FORBIDDEN';
    return error;
};

const defineNodeTypeRegistryBinding = (graph, registry) => {
    nodeTypeRegistries.set(graph, registry);
    Object.defineProperty(graph, 'typeRegistry', {
        configurable: false,
        enumerable: true,
        get: () => nodeTypeRegistries.get(graph),
        set: () => {
            throw createNodeTypeRegistryReplacementError();
        }
    });
};

const componentTypeRegistries = new WeakMap();
const COMPONENT_TYPE_REGISTRY_BINDING_AUTHORITY = Object.freeze({});

const createComponentTypeRegistryReplacementError = () => {
    const error = new Error('Runtime component type registry binding cannot be replaced directly.');
    error.code = 'RUNTIME_COMPONENT_TYPE_REGISTRY_REPLACEMENT_FORBIDDEN';
    return error;
};

const defineComponentTypeRegistryBinding = (graph, registry) => {
    componentTypeRegistries.set(graph, registry);
    Object.defineProperty(graph, 'componentTypeRegistry', {
        configurable: false,
        enumerable: true,
        get: () => componentTypeRegistries.get(graph),
        set: () => {
            throw createComponentTypeRegistryReplacementError();
        }
    });
};

const normalizeSceneDescriptor = scene => {
    if (!scene || typeof scene !== 'object') throw new TypeError('Scene descriptor must be an object.');
    if (typeof scene.id !== 'string' || !scene.id.trim()) {
        throw new TypeError('Scene descriptor requires a non-empty id.');
    }
    return {
        id: scene.id.trim(),
        name: typeof scene.name === 'string' && scene.name.trim() ? scene.name.trim() : 'Scene'
    };
};

const normalizeNodeName = (name, fallback = 'Node') => {
    const normalized = typeof name === 'string' ? name.trim() : '';
    return normalized || fallback;
};

const cloneComponentOptions = component => ({
    data: component && component.data ? JSON.parse(JSON.stringify(component.data)) : {},
    enabled: !component || component.enabled !== false,
    extensionData: component && component._extensionData ?
        JSON.parse(JSON.stringify(component._extensionData)) : {},
    id: component && component.id ? component.id : undefined,
    schemaVersion: component && Number.isInteger(component.schemaVersion) ? component.schemaVersion : 1,
    typeId: component && component.typeId ? component.typeId : 'ngvge.component'
});

class RuntimeNodeGraph {
    static createFromState (snapshot, options = {}) {
        const typeRegistry = options.typeRegistry || createRuntimeNodeTypeRegistry();
        const componentTypeRegistry = options.componentTypeRegistry &&
            typeof options.componentTypeRegistry.clone === 'function' ?
            options.componentTypeRegistry.clone() : createRuntimeComponentTypeRegistry();
        const plan = validateRuntimeNodeSnapshot(snapshot, {componentTypeRegistry, typeRegistry});
        const implicitComponentTypeIds = new Set(plan.implicitComponentTypeIds || []);
        plan.componentTypeDescriptors.forEach(descriptor => {
            if (componentTypeRegistry.has(descriptor.typeId)) return;
            if (implicitComponentTypeIds.has(descriptor.typeId)) {
                componentTypeRegistry.ensureImplicit(descriptor.typeId, descriptor);
                return;
            }
            componentTypeRegistry.register(descriptor);
        });
        const graph = new RuntimeNodeGraph({
            activeSceneId: null,
            idFactory: options.idFactory,
            componentTypeRegistry,
            lifecycleGuard: options.lifecycleGuard,
            modelMutationAuthorityRequired: options.modelMutationAuthorityRequired === true,
            scenes: plan.scenes,
            typeRegistry
        });
        try {
            plan.nodes.forEach(record => graph._createImportedNode(record));
            plan.nodes.forEach(record => {
                if (record.parentId !== null) graph.setParent(record.id, record.parentId);
            });
            graph.setActiveScene(plan.activeSceneId || null);
        } catch (error) {
            try {
                graph.dispose();
            } catch (disposeError) {
                // The shadow graph is already isolated; cleanup errors must not affect the active graph.
            }
            if (error instanceof RuntimeNodeImportError) throw error;
            throw new RuntimeNodeImportError(
                `Runtime node import construction failed: ${error && error.message ? error.message : String(error)}`,
                [{
                    code: error && error.code ? error.code : 'RUNTIME_NODE_IMPORT_BUILD_FAILED',
                    message: error && error.message ? error.message : String(error),
                    nodeId: error && error.nodeId ? error.nodeId : null,
                    typeId: error && error.typeId ? error.typeId : null
                }]
            );
        }
        const missingTypeIds = Array.from(new Set(plan.warnings
            .filter(warning => warning.code === 'RUNTIME_NODE_TYPE_MISSING')
            .map(warning => warning.typeId)));
        return {
            graph,
            result: {
                importedNodeCount: plan.nodes.length,
                missingNodeCount: graph.listNodes({includeRoots: false})
                    .filter(node => node instanceof UnknownRuntimeNode).length,
                missingTypeIds,
                success: true,
                warnings: plan.warnings
            }
        };
    }

    constructor (options = {}) {
        this.version = RUNTIME_NODE_MODEL_VERSION;
        Object.defineProperty(this, '_modelMutationAuthorityRequired', {
            configurable: false,
            enumerable: false,
            value: options.modelMutationAuthorityRequired === true,
            writable: false
        });
        defineNodeTypeRegistryBinding(this, options.typeRegistry || createRuntimeNodeTypeRegistry());
        defineComponentTypeRegistryBinding(
            this,
            options.componentTypeRegistry || createRuntimeComponentTypeRegistry()
        );
        this._idFactory = typeof options.idFactory === 'function' ? options.idFactory : () => createRuntimeId('runtime-node');
        this._nodes = new Map();
        this._unbindComponentTypeUsageResolver = null;
        this._sceneRootIds = new Map();
        this._listeners = new Set();
        initializeRuntimeNodeGraphRevision(this, 0);
        this._runtimeGeneration = Number.isInteger(options.runtimeGeneration) && options.runtimeGeneration > 0 ?
            options.runtimeGeneration : 1;
        this._lifecycleSequence = 0;
        this._lifecycleTrace = [];
        this._lifecycleHookErrorCount = 0;
        this._lifecycleGuard = options.lifecycleGuard && Array.isArray(options.lifecycleGuard.stack) ?
            options.lifecycleGuard : {stack: []};
        this._lifecycleExecutionStack = this._lifecycleGuard.stack;
        this._lifecycleHookStack = this._lifecycleExecutionStack;
        this._listenerErrorCount = 0;
        this._observerReentrantMutationCount = 0;
        this._modelMutationCommitFrame = null;
        this._disposed = false;
        this._bindComponentTypeRegistryAuthority();
        this._createGlobalRoot();
        (Array.isArray(options.scenes) ? options.scenes : []).forEach(scene => this.ensureScene(scene));
        if (options.activeSceneId) this.setActiveScene(options.activeSceneId);
    }

    _assertAvailable () {
        if (!this._disposed) return;
        const error = new Error('Runtime node graph has been disposed.');
        error.code = 'RUNTIME_NODE_GRAPH_DISPOSED';
        throw error;
    }

    _touchSemanticRevision () {
        if (this._disposed) return this._revision;
        return incrementRuntimeNodeGraphRevision(this);
    }

    _emit (change) {
        if (this._disposed) return;
        const revision = incrementRuntimeNodeGraphRevision(this);
        const payload = Object.freeze(Object.assign({revision}, change));
        this._listeners.forEach(listener => {
            try {
                listener(payload);
            } catch (error) {
                this._listenerErrorCount += 1;
            }
        });
    }

    _runLifecycleExecutionContext (context, callback) {
        if (typeof callback !== 'function') return null;
        const source = context && typeof context === 'object' ? context : {};
        const normalizedContext = Object.freeze(Object.assign({}, normalizeLifecycleDetails(source), {
            depth: this._lifecycleExecutionStack.length + 1,
            eventType: typeof source.eventType === 'string' ? source.eventType : null,
            originKind: source.originKind === 'observer' ? 'observer' : 'hook',
            runtimeGeneration: Number.isInteger(source.runtimeGeneration) ?
                source.runtimeGeneration : this._runtimeGeneration,
            sequence: Number.isInteger(source.sequence) ? source.sequence : this._lifecycleSequence
        }));
        this._lifecycleExecutionStack.push(normalizedContext);
        try {
            return callback();
        } finally {
            this._lifecycleExecutionStack.pop();
        }
    }

    _runLifecycleHook (context, callback) {
        const normalizedContext = Object.assign({}, context, {
            originKind: 'hook',
            runtimeGeneration: this._runtimeGeneration,
            sequence: this._lifecycleSequence
        });
        if (this._modelMutationCommitFrame) {
            this._modelMutationCommitFrame.hooks.push({callback, context: normalizedContext});
            return null;
        }
        return this._runLifecycleExecutionContext(normalizedContext, callback);
    }

    _beginModelMutationCommit () {
        this._assertAvailable();
        if (this._modelMutationCommitFrame) {
            const error = new Error('Runtime node mutation commit is already active.');
            error.code = 'RUNTIME_NODE_MUTATION_COMMIT_REENTRANT';
            throw error;
        }
        this._modelMutationCommitFrame = {hooks: []};
        return true;
    }

    _commitModelMutationHooks () {
        const frame = this._modelMutationCommitFrame;
        this._modelMutationCommitFrame = null;
        if (!frame) return 0;
        frame.hooks.forEach(entry => {
            try {
                this._runLifecycleExecutionContext(entry.context, entry.callback);
            } catch (error) {
                this._reportLifecycleHookError(entry.context, error);
            }
        });
        return frame.hooks.length;
    }

    _rollbackModelMutationHooks () {
        const frame = this._modelMutationCommitFrame;
        this._modelMutationCommitFrame = null;
        return frame ? frame.hooks.length : 0;
    }

    _runObserverDispatch (event, callback) {
        const source = event && typeof event === 'object' ? event : {};
        return this._runLifecycleExecutionContext({
            componentId: source.componentId || null,
            entityKind: source.entityKind || null,
            eventType: typeof source.type === 'string' ? source.type : 'runtime:change',
            nodeId: source.nodeId || null,
            originKind: 'observer',
            phase: source.phase || null,
            runtimeGeneration: Number.isInteger(source.runtimeGeneration) ?
                source.runtimeGeneration : this._runtimeGeneration,
            sequence: Number.isInteger(source.sequence) ? source.sequence : this._lifecycleSequence
        }, callback);
    }

    _assertMutationAllowed (operation = 'runtime-graph-mutation') {
        if (this.componentTypeRegistry &&
            typeof this.componentTypeRegistry._assertMigrationMutationAllowed === 'function') {
            this.componentTypeRegistry._assertMigrationMutationAllowed(operation);
        }
        if (!this._lifecycleExecutionStack.length) return true;
        const context = this._lifecycleExecutionStack[this._lifecycleExecutionStack.length - 1] || {};
        const originKind = context.originKind === 'observer' ? 'observer' : 'hook';
        const error = new Error(
            `Runtime semantic graph mutation "${operation}" is not allowed during lifecycle ${originKind} execution.`
        );
        error.code = 'RUNTIME_LIFECYCLE_REENTRANT_MUTATION';
        error.operation = operation;
        error.originKind = originKind;
        error.eventType = context.eventType || null;
        error.runtimeGeneration = Number.isInteger(context.runtimeGeneration) ?
            context.runtimeGeneration : this._runtimeGeneration;
        error.sequence = Number.isInteger(context.sequence) ? context.sequence : this._lifecycleSequence;
        error.entityKind = context.entityKind || null;
        error.nodeId = context.nodeId || null;
        error.componentId = context.componentId || null;
        error.phase = context.phase || null;
        error.hookName = context.hookName || null;
        if (originKind === 'observer') this._observerReentrantMutationCount += 1;
        throw error;
    }

    _beginRuntimeGeneration (runtimeGeneration, details = {}) {
        this._assertMutationAllowed('_beginRuntimeGeneration');
        const nextGeneration = Number.isInteger(runtimeGeneration) && runtimeGeneration > 0 ?
            runtimeGeneration : this._runtimeGeneration + 1;
        const previousRuntimeGeneration = this._runtimeGeneration;
        if (nextGeneration <= previousRuntimeGeneration) {
            const error = new Error(
                `Runtime generation must increase: ${previousRuntimeGeneration} -> ${nextGeneration}`
            );
            error.code = 'RUNTIME_GENERATION_NOT_MONOTONIC';
            error.previousRuntimeGeneration = previousRuntimeGeneration;
            error.runtimeGeneration = nextGeneration;
            throw error;
        }
        this._runtimeGeneration = nextGeneration;
        this._lifecycleSequence = 0;
        this._lifecycleTrace = [];
        return this._recordRuntimeReplacement(Object.assign({
            previousRuntimeGeneration,
            reason: 'runtime-graph-replaced'
        }, details));
    }

    _recordRuntimeReplacement (details = {}) {
        if (this._disposed) return null;
        const payload = Object.freeze(Object.assign({
            lifecycleContractVersion: RUNTIME_NODE_LIFECYCLE_CONTRACT.contractVersion,
            runtimeGeneration: this._runtimeGeneration,
            sequence: ++this._lifecycleSequence,
            type: 'runtime:replaced'
        }, normalizeLifecycleDetails(details)));
        this._lifecycleTrace.push(payload);
        if (this._lifecycleTrace.length > 512) this._lifecycleTrace.shift();
        this._emit(payload);
        return payload;
    }

    _recordLifecycle (event) {
        if (this._disposed || !event || typeof event !== 'object') return null;
        this._lifecycleSequence += 1;
        const payload = Object.freeze(Object.assign({
            lifecycleContractVersion: RUNTIME_NODE_LIFECYCLE_CONTRACT.contractVersion,
            runtimeGeneration: this._runtimeGeneration,
            sequence: this._lifecycleSequence,
            type: RUNTIME_NODE_LIFECYCLE_CONTRACT.eventType
        }, normalizeLifecycleDetails(event)));
        this._lifecycleTrace.push(payload);
        if (this._lifecycleTrace.length > 512) this._lifecycleTrace.shift();
        this._emit(payload);
        return payload;
    }

    _reportLifecycleHookError (context, error) {
        this._lifecycleHookErrorCount += 1;
        const payload = Object.freeze(Object.assign({
            code: error && error.code ? error.code : 'RUNTIME_LIFECYCLE_HOOK_FAILED',
            error: error && error.message ? error.message : String(error),
            operation: error && error.operation ? error.operation : null,
            originKind: error && error.originKind ? error.originKind : 'hook',
            eventType: error && error.eventType ? error.eventType : null,
            lifecycleContractVersion: RUNTIME_NODE_LIFECYCLE_CONTRACT.contractVersion,
            runtimeGeneration: this._runtimeGeneration,
            sequence: ++this._lifecycleSequence,
            type: RUNTIME_NODE_LIFECYCLE_CONTRACT.hookErrorEventType
        }, normalizeLifecycleDetails(context)));
        this._lifecycleTrace.push(payload);
        if (this._lifecycleTrace.length > 512) this._lifecycleTrace.shift();
        this._emit(payload);
        return payload;
    }

    getLifecycleTrace (options = {}) {
        this._assertAvailable();
        const limit = Number.isInteger(options.limit) && options.limit >= 0 ? options.limit : this._lifecycleTrace.length;
        const filtered = this._lifecycleTrace.filter(event => (
            (!options.entityKind || event.entityKind === options.entityKind) &&
            (!options.nodeId || event.nodeId === options.nodeId) &&
            (!options.componentId || event.componentId === options.componentId)
        ));
        return filtered.slice(Math.max(0, filtered.length - limit));
    }

    _createGlobalRoot () {
        const root = this.typeRegistry.create(BUILTIN_RUNTIME_NODE_TYPE_IDS.GLOBAL_ROOT, {
            enabled: true,
            id: GLOBAL_ROOT_NODE_ID,
            name: 'Global',
            sceneId: null,
            scope: NODE_SCOPES.GLOBAL
        });
        this._registerNode(root);
        markRuntimeNodeReady(root, {reason: 'global-root'});
        setRuntimeNodeActiveInHierarchy(root, true, {reason: 'global-root'});
    }

    _registerNode (node) {
        this._assertMutationAllowed('_registerNode');
        if (this._nodes.has(node.id)) throw new Error(`Runtime node id already exists: ${node.id}`);
        this._nodes.set(node.id, node);
        try {
            bindRuntimeNodeToGraph(node, this);
        } catch (error) {
            this._nodes.delete(node.id);
            throw error;
        }
        this._emit({nodeId: node.id, type: 'node:create'});
        return node;
    }

    _getRequiredNode (nodeId) {
        const node = this._nodes.get(nodeId);
        if (!node) {
            const error = new Error(`Unknown runtime node: ${nodeId}`);
            error.code = 'RUNTIME_NODE_NOT_FOUND';
            throw error;
        }
        return node;
    }

    _getRequiredSceneRoot (sceneId) {
        const rootId = this._sceneRootIds.get(sceneId);
        if (!rootId) {
            const error = new Error(`Unknown runtime scene: ${sceneId}`);
            error.code = 'RUNTIME_SCENE_NOT_FOUND';
            throw error;
        }
        return this._getRequiredNode(rootId);
    }

    _validateParent (node, parent) {
        if (!parent) throw new Error('Runtime node parent does not exist.');
        const parentType = this.typeRegistry.get(parent.typeId);
        if (parentType && parentType.allowChildren === false) {
            throw new Error(`Runtime node type "${parent.typeId}" cannot contain child nodes.`);
        }
        if (node.scope !== parent.scope) {
            const error = new Error('Global and scene-scoped runtime nodes cannot be parented across scopes.');
            error.code = 'RUNTIME_NODE_SCOPE_MISMATCH';
            throw error;
        }
        if (node.scope === NODE_SCOPES.SCENE && node.sceneId !== parent.sceneId) {
            const error = new Error('Runtime nodes from different scenes cannot have a parent-child relationship.');
            error.code = 'RUNTIME_NODE_SCENE_MISMATCH';
            throw error;
        }
        let current = parent;
        while (current) {
            if (current.id === node.id) {
                const error = new Error('Runtime node parenting would create a cycle.');
                error.code = 'RUNTIME_NODE_CYCLE';
                throw error;
            }
            current = current.parentId ? this._nodes.get(current.parentId) : null;
        }
    }

    _calculateActive (node) {
        if (!node.enabledSelf) return false;
        if (!node.parentId) return node.id === GLOBAL_ROOT_NODE_ID || Boolean(node.metadata.scopeActive);
        const parent = this._nodes.get(node.parentId);
        return Boolean(parent && parent.activeInHierarchy);
    }

    _refreshActiveSubtree (node, extra = {}) {
        this._assertMutationAllowed('_refreshActiveSubtree');
        const changed = setRuntimeNodeActiveInHierarchy(node, this._calculateActive(node), extra);
        if (changed) this._emit({active: node.activeInHierarchy, nodeId: node.id, type: 'node:active'});
        node.childIds.forEach(childId => {
            const child = this._nodes.get(childId);
            if (child) this._refreshActiveSubtree(child, extra);
        });
    }

    _reorderNode (node, parent, index) {
        this._assertMutationAllowed('_reorderNode');
        const previousIndex = parent.childIds.indexOf(node.id);
        if (previousIndex === -1) throw new Error(`Runtime node is not attached to its recorded parent: ${node.id}`);
        const remaining = parent.childIds.filter(childId => childId !== node.id);
        const normalizedIndex = Math.max(0, Math.min(index, remaining.length));
        if (previousIndex === normalizedIndex) return node;
        runRuntimeNodeSemanticMutation(parent, this, 'node.reorderChildren', () => {
            parent.childIds = remaining;
            parent.childIds.splice(normalizedIndex, 0, node.id);
        });
        invokeRuntimeNodeHook(node, 'onReorder', {
            index: normalizedIndex,
            parent,
            phase: LIFECYCLE_PHASES.REORDER,
            previousIndex
        });
        recordRuntimeNodeLifecycle(node, LIFECYCLE_PHASES.REORDER, node.state, node.state, {
            index: normalizedIndex,
            parentId: parent.id,
            previousIndex
        });
        this._emit({
            index: normalizedIndex,
            nodeId: node.id,
            parentId: parent.id,
            previousIndex,
            type: 'node:reorder'
        });
        return node;
    }

    _attachNode (node, parent, index) {
        this._assertMutationAllowed('_attachNode');
        this._validateParent(node, parent);
        const previousParent = node.parentId ? this._nodes.get(node.parentId) : null;
        if (previousParent && previousParent.id === parent.id) {
            if (!Number.isInteger(index)) return node;
            return this._reorderNode(node, parent, index);
        }

        const previousParentId = previousParent ? previousParent.id : null;
        if (previousParent) this._detachNode(node);

        runRuntimeNodeSemanticMutation(node, this, 'node.attachParent', () => {
            node.parentId = parent.id;
        });
        const normalizedIndex = Number.isInteger(index) ?
            Math.max(0, Math.min(index, parent.childIds.length)) : parent.childIds.length;
        runRuntimeNodeSemanticMutation(parent, this, 'node.attachChild', () => {
            parent.childIds.splice(normalizedIndex, 0, node.id);
        });
        transitionRuntimeNode(node, NODE_LIFECYCLE_STATES.ATTACHED, LIFECYCLE_PHASES.ATTACH, 'onAttach', {
            index: normalizedIndex,
            parent,
            parentId: parent.id,
            previousParentId,
            reason: previousParentId ? 'reparent' : 'attach'
        });
        markRuntimeNodeReady(node, {parent, parentId: parent.id, reason: 'first-attach'});
        this._refreshActiveSubtree(node, {reason: previousParentId ? 'reparent' : 'attach'});
        this._emit({
            nodeId: node.id,
            parentId: parent.id,
            previousParentId,
            type: 'node:attach'
        });
        return node;
    }

    _detachNode (node) {
        this._assertMutationAllowed('_detachNode');
        if (!node.parentId) return false;
        const parent = this._nodes.get(node.parentId);
        if (parent) runRuntimeNodeSemanticMutation(parent, this, 'node.detachChild', () => {
            parent.childIds = parent.childIds.filter(childId => childId !== node.id);
        });
        if (node.activeInHierarchy || node.state === NODE_LIFECYCLE_STATES.READY ||
            node.state === NODE_LIFECYCLE_STATES.ACTIVE) {
            const changed = setRuntimeNodeActiveInHierarchy(node, false, {reason: 'detach'});
            if (changed) this._emit({active: false, nodeId: node.id, type: 'node:active'});
        }
        node.childIds.forEach(childId => {
            const child = this._nodes.get(childId);
            if (child) this._refreshActiveSubtree(child, {reason: 'ancestor-detach'});
        });
        const previousParentId = node.parentId;
        runRuntimeNodeSemanticMutation(node, this, 'node.detachParent', () => {
            node.parentId = null;
        });
        transitionRuntimeNode(node, NODE_LIFECYCLE_STATES.DETACHED, LIFECYCLE_PHASES.DETACH, 'onDetach', {
            previousParentId,
            reason: 'detach'
        });
        this._emit({nodeId: node.id, previousParentId, type: 'node:detach'});
        return true;
    }

    _destroyNode (node, options = {}) {
        this._assertMutationAllowed('_destroyNode');
        if (node.protected && options.force !== true) {
            const error = new Error(`Protected runtime node cannot be destroyed: ${node.id}`);
            error.code = 'RUNTIME_NODE_PROTECTED';
            throw error;
        }
        node.childIds.slice().forEach(childId => {
            const child = this._nodes.get(childId);
            if (child) this._destroyNode(child, {force: true});
        });
        if (node.activeInHierarchy || node.state === NODE_LIFECYCLE_STATES.READY ||
            node.state === NODE_LIFECYCLE_STATES.ACTIVE) {
            setRuntimeNodeActiveInHierarchy(node, false, {reason: 'destroy'});
        }
        if (node.parentId) this._detachNode(node);
        destroyAllRuntimeComponents(node.components, this);
        transitionRuntimeNode(node, NODE_LIFECYCLE_STATES.DESTROYED, LIFECYCLE_PHASES.DESTROY, 'onDestroy', {
            reason: 'destroy'
        });
        this._nodes.delete(node.id);
        this._emit({nodeId: node.id, type: 'node:destroy'});
        return true;
    }

    _clearNonRootNodes () {
        this._assertMutationAllowed('_clearNonRootNodes');
        const mutableRoots = this.listNodes({includeRoots: false}).filter(node => {
            if (!node.parentId) return true;
            const parent = this._nodes.get(node.parentId);
            return !parent || parent.protected;
        });
        mutableRoots.forEach(node => {
            if (this._nodes.has(node.id)) this._destroyNode(node, {force: true});
        });
    }

    _getComponentTypeUsage (typeId) {
        const normalizedTypeId = typeof typeId === 'string' ? typeId.trim() : '';
        if (!normalizedTypeId) return {componentId: null, count: 0, nodeId: null};
        let componentId = null;
        let count = 0;
        let nodeId = null;
        const schemaVersions = new Set();
        this._nodes.forEach(node => {
            if (!node || !node.components) return;
            const components = node.getComponents(normalizedTypeId);
            if (!components.length) return;
            count += components.length;
            if (!componentId) componentId = components[0].id;
            if (!nodeId) nodeId = node.id;
            components.forEach(component => schemaVersions.add(component.schemaVersion));
        });
        return {
            componentId,
            count,
            nodeId,
            schemaVersions: Array.from(schemaVersions).sort((a, b) => a - b)
        };
    }

    _bindComponentTypeRegistryAuthority () {
        if (typeof this._unbindComponentTypeUsageResolver === 'function') {
            this._unbindComponentTypeUsageResolver();
        }
        this._unbindComponentTypeUsageResolver = null;
        if (!this.componentTypeRegistry ||
            typeof this.componentTypeRegistry.bindUsageResolver !== 'function') return;
        this._unbindComponentTypeUsageResolver = this.componentTypeRegistry.bindUsageResolver(
            this,
            typeId => this._getComponentTypeUsage(typeId)
        );
    }

    _assertComponentTypeRegistryCompatibility (registry) {
        if (!registry || typeof registry.get !== 'function') {
            throw new TypeError('Runtime component type registry must provide descriptor lookup.');
        }
        this._nodes.forEach(node => {
            if (!node || !node.components) return;
            node.components.list().forEach(component => {
                const descriptor = registry.get(component.typeId);
                if (!descriptor) {
                    const error = new Error(
                        `Runtime component type descriptor is missing from replacement registry: ${component.typeId}`
                    );
                    error.code = 'RUNTIME_COMPONENT_TYPE_DESCRIPTOR_MISSING';
                    error.componentId = component.id;
                    error.nodeId = node.id;
                    error.typeId = component.typeId;
                    throw error;
                }
                if (component.cardinality !== descriptor.cardinality) {
                    const error = new Error(
                        `Runtime component cardinality conflicts with replacement registry descriptor: ${component.typeId}`
                    );
                    error.code = 'RUNTIME_COMPONENT_CARDINALITY_CONFLICT';
                    error.componentCardinality = component.cardinality;
                    error.componentId = component.id;
                    error.descriptorCardinality = descriptor.cardinality;
                    error.nodeId = node.id;
                    error.typeId = component.typeId;
                    throw error;
                }
                if ((typeof registry.isImplicit === 'function' && registry.isImplicit(component.typeId)) ||
                    component.schemaVersion === descriptor.schemaVersion) return;
                const error = new Error(
                    `Runtime component schemaVersion conflicts with replacement registry descriptor: ${component.typeId}`
                );
                error.code = 'RUNTIME_COMPONENT_SCHEMA_VERSION_CONFLICT';
                error.componentId = component.id;
                error.componentSchemaVersion = component.schemaVersion;
                error.descriptorSchemaVersion = descriptor.schemaVersion;
                error.nodeId = node.id;
                error.typeId = component.typeId;
                throw error;
            });
        });
    }

    _replaceComponentTypeRegistry (nextRegistry, authority) {
        if (authority !== COMPONENT_TYPE_REGISTRY_BINDING_AUTHORITY) {
            throw createComponentTypeRegistryReplacementError();
        }
        this._assertAvailable();
        this._assertMutationAllowed('_replaceComponentTypeRegistry');
        if (nextRegistry === this.componentTypeRegistry) return this.componentTypeRegistry;
        this._assertComponentTypeRegistryCompatibility(nextRegistry);

        const previousRegistry = this.componentTypeRegistry;
        if (typeof this._unbindComponentTypeUsageResolver === 'function') {
            this._unbindComponentTypeUsageResolver();
        }
        this._unbindComponentTypeUsageResolver = null;
        componentTypeRegistries.set(this, nextRegistry);
        try {
            this._bindComponentTypeRegistryAuthority();
        } catch (error) {
            if (typeof this._unbindComponentTypeUsageResolver === 'function') {
                this._unbindComponentTypeUsageResolver();
            }
            this._unbindComponentTypeUsageResolver = null;
            componentTypeRegistries.set(this, previousRegistry);
            try {
                this._bindComponentTypeRegistryAuthority();
            } catch (rollbackError) {
                error.registryBindingRollbackError = rollbackError && rollbackError.message ?
                    rollbackError.message : String(rollbackError);
            }
            throw error;
        }
        return previousRegistry;
    }

    _resolveComponentTypeDescriptor (typeId, options = {}) {
        this._assertAvailable();
        const normalizedTypeId = typeof typeId === 'string' ? typeId.trim() : '';
        if (!normalizedTypeId) throw new TypeError('Runtime component typeId must be a non-empty string.');
        const existing = this.componentTypeRegistry.get(normalizedTypeId);
        if (existing) {
            if (options.source === 'import' && options.allowMultipleSpecified === true) {
                const projectedCardinality = options.allowMultiple === true ?
                    COMPONENT_CARDINALITIES.MANY : COMPONENT_CARDINALITIES.ONE;
                if (existing.cardinality !== projectedCardinality) {
                    const error = new Error(
                        `Imported component cardinality conflicts with descriptor for type: ${normalizedTypeId}`
                    );
                    error.code = 'RUNTIME_COMPONENT_CARDINALITY_CONFLICT';
                    error.typeId = normalizedTypeId;
                    throw error;
                }
            }
            if (!(typeof this.componentTypeRegistry.isImplicit === 'function' &&
                this.componentTypeRegistry.isImplicit(normalizedTypeId)) &&
                options.schemaVersionSpecified === true &&
                options.schemaVersion !== existing.schemaVersion) {
                const error = new Error(
                    `Runtime component schemaVersion conflicts with descriptor for type: ${normalizedTypeId}`
                );
                error.code = 'RUNTIME_COMPONENT_SCHEMA_VERSION_CONFLICT';
                error.componentSchemaVersion = options.schemaVersion;
                error.descriptorSchemaVersion = existing.schemaVersion;
                error.typeId = normalizedTypeId;
                throw error;
            }
            return existing;
        }
        const cardinality = options.source === 'import' && options.allowMultiple === true ?
            COMPONENT_CARDINALITIES.MANY : COMPONENT_CARDINALITIES.ONE;
        return this.componentTypeRegistry.ensureImplicit(normalizedTypeId, {
            cardinality,
            ownerModuleId: options.source === 'import' ?
                'ngvge.runtime.compat.import' : 'ngvge.runtime.compat.implicit',
            schemaVersion: options.schemaVersion
        });
    }

    _notifyComponentChange (node, component, type) {
        this._emit({
            componentId: component ? component.id : null,
            componentTypeId: component ? component.typeId : null,
            nodeId: node.id,
            type
        });
    }

    _getRequiredComponent (nodeId, componentId) {
        const node = this._getRequiredNode(nodeId);
        const component = node.getComponentById(componentId);
        if (!component) {
            const error = new Error(`Unknown runtime component on node ${nodeId}: ${componentId}`);
            error.code = 'RUNTIME_COMPONENT_NOT_FOUND';
            throw error;
        }
        return {component, node};
    }

    addComponent (nodeId, options) {
        this._assertAvailable();
        this._assertMutationAllowed('addComponent');
        const node = this._getRequiredNode(nodeId);
        const normalized = normalizePublicComponentOptions(options);
        return addRuntimeNodeComponent(node, normalized, {source: 'public'}, this);
    }

    removeComponent (nodeId, componentId) {
        this._assertAvailable();
        this._assertMutationAllowed('removeComponent');
        const node = this._getRequiredNode(nodeId);
        return removeRuntimeNodeComponent(node, componentId, this);
    }

    patchComponentData (nodeId, componentId, patch) {
        this._assertAvailable();
        this._assertMutationAllowed('patchComponentData');
        const {component, node} = this._getRequiredComponent(nodeId, componentId);
        patchRuntimeComponentData(component, patch, this);
        this._notifyComponentChange(node, component, 'component:data');
        return component;
    }

    setComponentData (nodeId, componentId, data) {
        this._assertAvailable();
        this._assertMutationAllowed('setComponentData');
        const {component, node} = this._getRequiredComponent(nodeId, componentId);
        setRuntimeComponentData(component, data, this);
        this._notifyComponentChange(node, component, 'component:data');
        return component;
    }

    setComponentEnabled (nodeId, componentId, enabled) {
        this._assertAvailable();
        this._assertMutationAllowed('setComponentEnabled');
        const {component, node} = this._getRequiredComponent(nodeId, componentId);
        if (!setRuntimeComponentEnabled(component, enabled, node, this)) return component;
        this._notifyComponentChange(node, component, 'component:enabled');
        return component;
    }

    patchNodeMetadata (nodeId, patch) {
        this._assertAvailable();
        this._assertMutationAllowed('patchNodeMetadata');
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
            throw new TypeError('Runtime node metadata patch must be an object.');
        }
        const node = this._getRequiredNode(nodeId);
        if (node.protected) throw new Error('Protected runtime root node metadata cannot be modified directly.');
        runRuntimeNodeSemanticMutation(node, this, 'node.metadata.patch', () => {
            Object.assign(node.metadata, cloneSerializable(patch));
        });
        this._emit({nodeId, type: 'node:metadata'});
        return node;
    }

    patchNode (nodeId, patch) {
        this._assertAvailable();
        this._assertMutationAllowed('patchNode');
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
            throw new TypeError('Runtime node patch must be an object.');
        }
        const allowedKeys = new Set(['enabled', 'enabledSelf', 'name', 'source']);
        const unsupportedKeys = Object.keys(patch).filter(key => !allowedKeys.has(key));
        if (unsupportedKeys.length) {
            throw new Error(`Unsupported runtime node patch fields: ${unsupportedKeys.join(', ')}`);
        }
        let node = this._getRequiredNode(nodeId);
        if (Object.prototype.hasOwnProperty.call(patch, 'name')) node = this.renameNode(nodeId, patch.name);
        if (Object.prototype.hasOwnProperty.call(patch, 'enabled') ||
            Object.prototype.hasOwnProperty.call(patch, 'enabledSelf')) {
            const enabled = Object.prototype.hasOwnProperty.call(patch, 'enabled') ? patch.enabled : patch.enabledSelf;
            node = this.setNodeEnabled(nodeId, enabled);
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'source')) {
            if (node.protected) throw new Error('Protected runtime root node source cannot be modified directly.');
            runRuntimeNodeSemanticMutation(node, this, 'node.source.set', () => {
                node.source = normalizeSerializableObject(patch.source);
            });
            this._emit({nodeId, type: 'node:source'});
        }
        return node;
    }

    ensureScene (scene) {
        this._assertAvailable();
        this._assertMutationAllowed('ensureScene');
        const descriptor = normalizeSceneDescriptor(scene);
        const existingRootId = this._sceneRootIds.get(descriptor.id);
        if (existingRootId) {
            const existingRoot = this._getRequiredNode(existingRootId);
            if (existingRoot.name !== descriptor.name) {
                runRuntimeNodeSemanticMutation(existingRoot, this, 'scene.rename', () => {
                    existingRoot.name = descriptor.name;
                });
                this._emit({nodeId: existingRoot.id, sceneId: descriptor.id, type: 'scene:rename'});
            }
            return existingRoot;
        }
        const root = this.typeRegistry.create(BUILTIN_RUNTIME_NODE_TYPE_IDS.SCENE_ROOT, {
            enabled: true,
            id: getSceneRootNodeId(descriptor.id),
            metadata: {scopeActive: false},
            name: descriptor.name,
            sceneId: descriptor.id,
            scope: NODE_SCOPES.SCENE
        });
        this._registerNode(root);
        markRuntimeNodeReady(root, {reason: 'scene-root'});
        this._sceneRootIds.set(descriptor.id, root.id);
        this._refreshActiveSubtree(root, {reason: 'scene-root'});
        this._emit({nodeId: root.id, sceneId: descriptor.id, type: 'scene:add'});
        return root;
    }

    removeScene (sceneId) {
        this._assertAvailable();
        this._assertMutationAllowed('removeScene');
        const rootId = this._sceneRootIds.get(sceneId);
        if (!rootId) return false;
        const root = this._getRequiredNode(rootId);
        this._sceneRootIds.delete(sceneId);
        this._destroyNode(root, {force: true});
        this._emit({sceneId, type: 'scene:remove'});
        return true;
    }

    setActiveScene (sceneId) {
        this._assertAvailable();
        this._assertMutationAllowed('setActiveScene');
        if (sceneId !== null) this._getRequiredSceneRoot(sceneId);
        this._sceneRootIds.forEach((rootId, currentSceneId) => {
            const root = this._getRequiredNode(rootId);
            const active = currentSceneId === sceneId;
            if (Boolean(root.metadata.scopeActive) === active) return;
            runRuntimeNodeSemanticMutation(root, this, 'scene.scopeActive', () => {
                root.metadata.scopeActive = active;
            });
            this._refreshActiveSubtree(root, {reason: 'scene-active'});
        });
        this._emit({sceneId, type: 'scene:active'});
        return sceneId;
    }

    _ensureUniqueName (name, parentId, ignoreNodeId = null) {
        const base = normalizeNodeName(name);
        const parent = this._getRequiredNode(parentId);
        const usedNames = new Set(parent.childIds
            .filter(childId => childId !== ignoreNodeId)
            .map(childId => this._nodes.get(childId))
            .filter(Boolean)
            .map(child => child.name));
        if (!usedNames.has(base)) return base;
        let suffix = 2;
        while (usedNames.has(`${base} ${suffix}`)) suffix += 1;
        return `${base} ${suffix}`;
    }

    renameNode (nodeId, name) {
        this._assertAvailable();
        this._assertMutationAllowed('renameNode');
        const node = this._getRequiredNode(nodeId);
        if (node.protected) throw new Error('Protected runtime root nodes cannot be renamed directly.');
        const parentId = node.parentId || (node.scope === NODE_SCOPES.GLOBAL ?
            this.getGlobalRoot().id : this.getSceneRoot(node.sceneId).id);
        const nextName = this._ensureUniqueName(name, parentId, node.id);
        if (nextName === node.name) return node;
        const previousName = node.name;
        runRuntimeNodeSemanticMutation(node, this, 'node.rename', () => {
            node.name = nextName;
        });
        this._emit({name: nextName, nodeId, previousName, type: 'node:rename'});
        return node;
    }

    duplicateNode (nodeId, options = {}) {
        this._assertAvailable();
        this._assertMutationAllowed('duplicateNode');
        const source = this._getRequiredNode(nodeId);
        if (source.protected) throw new Error('Protected runtime root nodes cannot be duplicated.');
        const parentId = options.parentId || source.parentId;
        const parent = this._getRequiredNode(parentId);
        const duplicateSubtree = (sourceNode, targetParentId, isRoot) => {
            const name = isRoot ?
                this._ensureUniqueName(options.name || `${sourceNode.name} Copy`, targetParentId) :
                this._ensureUniqueName(sourceNode.name, targetParentId);
            let duplicate;
            if (sourceNode instanceof UnknownRuntimeNode) {
                const record = sourceNode.toPersistentRecord();
                duplicate = this._createImportedNode(Object.assign({}, record, {
                    id: this._idFactory(),
                    name,
                    parentId: targetParentId,
                    source: {}
                }));
                this.setParent(duplicate.id, targetParentId);
            } else {
                duplicate = this.createNode(sourceNode.typeId, {
                    components: sourceNode.getComponents().map(cloneComponentOptions),
                    enabled: sourceNode.enabledSelf,
                    metadata: JSON.parse(JSON.stringify(sourceNode.metadata || {})),
                    name,
                    persistentExtras: sourceNode._persistentExtras,
                    parentId: targetParentId,
                    source: {}
                });
            }
            try {
                sourceNode.getChildren().forEach(child => duplicateSubtree(child, duplicate.id, false));
                return duplicate;
            } catch (error) {
                if (this._nodes.has(duplicate.id)) this._destroyNode(duplicate, {force: true});
                throw error;
            }
        };
        return duplicateSubtree(source, parent.id, true);
    }

    createNode (typeId, options = {}, createOptions = {}) {
        this._assertAvailable();
        this._assertMutationAllowed('createNode');
        const definition = this.typeRegistry.get(typeId);
        if (!definition) throw new Error(`Unknown runtime node type: ${typeId}`);
        const parent = options.parentId ? this._getRequiredNode(options.parentId) : null;
        const scope = parent ? parent.scope : (options.scope || definition.defaultScope);
        const sceneId = scope === NODE_SCOPES.SCENE ? (parent ? parent.sceneId : options.sceneId) : null;
        if (!definition.allowedScopes.includes(scope)) {
            throw new Error(`Runtime node type "${typeId}" does not support scope "${scope}".`);
        }
        if (scope === NODE_SCOPES.SCENE && (typeof sceneId !== 'string' || !sceneId)) {
            throw new Error('Scene-scoped runtime nodes require a sceneId.');
        }
        if (scope === NODE_SCOPES.SCENE) this._getRequiredSceneRoot(sceneId);
        const id = typeof options.id === 'string' && options.id.trim() ? options.id.trim() : this._idFactory();
        if (this._nodes.has(id)) throw new Error(`Runtime node id already exists: ${id}`);
        const defaultParent = parent || (
            scope === NODE_SCOPES.GLOBAL ? this.getGlobalRoot() : this.getSceneRoot(sceneId)
        );
        const nodeName = options.attach === false ?
            normalizeNodeName(options.name || definition.label, definition.label) :
            this._ensureUniqueName(options.name || definition.label, defaultParent.id);
        const node = this.typeRegistry.create(typeId, Object.assign({}, options, {
            id,
            name: nodeName,
            sceneId,
            scope
        }));
        this._registerNode(node);
        try {
            const shouldAttach = options.attach !== false;
            if (shouldAttach) this._attachNode(node, defaultParent, options.index);
            const components = Array.isArray(options.components) ? options.components : [];
            const componentSource = createOptions.componentSource === 'import' ? 'import' :
                (createOptions.componentSource === 'public' ? 'public' : 'local');
            components.forEach(component => addRuntimeNodeComponent(node, component, {source: componentSource}, this));
            return node;
        } catch (error) {
            if (this._nodes.has(node.id)) this._destroyNode(node, {force: true});
            throw error;
        }
    }

    _createImportedNode (record) {
        const registered = this.typeRegistry.has(record.typeId);
        const runtimeTypeId = registered ? record.typeId : BUILTIN_RUNTIME_NODE_TYPE_IDS.UNKNOWN_NODE;
        try {
            return this.createNode(runtimeTypeId, {
                attach: false,
                components: record.components,
                enabled: record.enabled,
                id: record.id,
                metadata: record.metadata,
                missingProvider: registered ? null : getMissingProviderId(record.typeId),
                missingVersion: record.missingVersion || record.typeVersion || null,
                name: record.name,
                importRecord: record,
                originalRecord: registered ? null : record,
                originalTypeId: registered ? null : record.typeId,
                persistentExtras: record,
                sceneId: record.sceneId,
                scope: record.scope,
                source: record.source
            }, {componentSource: 'import'});
        } catch (error) {
            error.code = error.code || 'RUNTIME_NODE_IMPORT_CONSTRUCTION_FAILED';
            error.nodeId = record.id;
            error.typeId = record.typeId;
            throw error;
        }
    }

    _rebindNodeCollection (nodes, graph, expectedCurrentGraph) {
        nodes.forEach(node => {
            replaceRuntimeNodeGraphBinding(node, graph, expectedCurrentGraph);
            if (node.components) {
                replaceRuntimeComponentContainerGraphBinding(node.components, graph, expectedCurrentGraph);
                node.components.list().forEach(component => {
                    replaceRuntimeComponentGraphBinding(component, graph, expectedCurrentGraph);
                });
            }
        });
    }

    _adoptGraph (replacement) {
        this._assertMutationAllowed('_adoptGraph');
        this._assertComponentTypeRegistryCompatibility(replacement.componentTypeRegistry);
        const oldGraph = Object.create(RuntimeNodeGraph.prototype);
        oldGraph.version = this.version;
        defineNodeTypeRegistryBinding(oldGraph, this.typeRegistry);
        defineComponentTypeRegistryBinding(oldGraph, this.componentTypeRegistry);
        oldGraph._idFactory = this._idFactory;
        oldGraph._nodes = this._nodes;
        oldGraph._sceneRootIds = this._sceneRootIds;
        oldGraph._listeners = new Set();
        initializeRuntimeNodeGraphRevision(oldGraph, this._revision);
        oldGraph._runtimeGeneration = this._runtimeGeneration;
        oldGraph._lifecycleSequence = this._lifecycleSequence;
        oldGraph._lifecycleTrace = this._lifecycleTrace;
        oldGraph._lifecycleHookErrorCount = this._lifecycleHookErrorCount;
        oldGraph._lifecycleGuard = this._lifecycleGuard;
        oldGraph._lifecycleExecutionStack = this._lifecycleGuard.stack;
        oldGraph._lifecycleHookStack = oldGraph._lifecycleExecutionStack;
        oldGraph._listenerErrorCount = this._listenerErrorCount;
        oldGraph._observerReentrantMutationCount = this._observerReentrantMutationCount;
        oldGraph._modelMutationCommitFrame = null;
        oldGraph._disposed = false;
        oldGraph._unbindComponentTypeUsageResolver = null;
        this._rebindNodeCollection(oldGraph._nodes, oldGraph, this);
        oldGraph._bindComponentTypeRegistryAuthority();

        const previousRuntimeGeneration = this._runtimeGeneration;
        this._replaceComponentTypeRegistry(
            replacement.componentTypeRegistry,
            COMPONENT_TYPE_REGISTRY_BINDING_AUTHORITY
        );
        this._nodes = replacement._nodes;
        this._sceneRootIds = replacement._sceneRootIds;
        this._lifecycleHookErrorCount += replacement._lifecycleHookErrorCount;
        this._listenerErrorCount += replacement._listenerErrorCount;
        this._observerReentrantMutationCount += replacement._observerReentrantMutationCount;
        this._lifecycleGuard = replacement._lifecycleGuard || this._lifecycleGuard;
        this._lifecycleExecutionStack = this._lifecycleGuard.stack;
        this._lifecycleHookStack = this._lifecycleExecutionStack;
        this._rebindNodeCollection(this._nodes, this, replacement);
        if (typeof replacement._unbindComponentTypeUsageResolver === 'function') {
            replacement._unbindComponentTypeUsageResolver();
        }
        replacement._unbindComponentTypeUsageResolver = null;
        replacement._nodes = new Map();
        replacement._sceneRootIds = new Map();
        replacement._lifecycleTrace = [];
        replacement._listeners.clear();
        replacement._disposed = true;
        this._beginRuntimeGeneration(previousRuntimeGeneration + 1, {
            previousRuntimeGeneration,
            reason: 'state-import'
        });

        try {
            oldGraph.dispose();
        } catch (error) {
            this._emit({
                error: error && error.message ? error.message : String(error),
                type: 'state:cleanup-error'
            });
        } finally {
            if (typeof oldGraph._unbindComponentTypeUsageResolver === 'function') {
                oldGraph._unbindComponentTypeUsageResolver();
            }
            oldGraph._unbindComponentTypeUsageResolver = null;
        }
        this._emit({type: 'state:import'});
    }

    destroyNode (nodeId) {
        this._assertAvailable();
        this._assertMutationAllowed('destroyNode');
        return this._destroyNode(this._getRequiredNode(nodeId));
    }

    canSetParent (nodeId, parentId) {
        this._assertAvailable();
        try {
            const node = this._getRequiredNode(nodeId);
            const parent = this._getRequiredNode(parentId);
            if (node.protected) throw new Error('Runtime root nodes cannot be reparented.');
            this._validateParent(node, parent);
            return {nodeId, ok: true, parentId};
        } catch (error) {
            return {
                code: error && error.code ? error.code : 'RUNTIME_NODE_REPARENT_INVALID',
                error: error && error.message ? error.message : String(error),
                nodeId,
                ok: false,
                parentId
            };
        }
    }

    setParent (nodeId, parentId, options = {}) {
        this._assertAvailable();
        this._assertMutationAllowed('setParent');
        const node = this._getRequiredNode(nodeId);
        if (node.protected) throw new Error('Runtime root nodes cannot be reparented.');
        const parent = this._getRequiredNode(parentId);
        if (node.parentId === parent.id && !Number.isInteger(options.index)) return node;
        return this._attachNode(node, parent, options.index);
    }

    detachNode (nodeId) {
        this._assertAvailable();
        this._assertMutationAllowed('detachNode');
        const node = this._getRequiredNode(nodeId);
        if (node.protected) throw new Error('Runtime root nodes cannot be detached.');
        return this._detachNode(node);
    }

    reorderChild (nodeId, index) {
        this._assertAvailable();
        this._assertMutationAllowed('reorderChild');
        if (!Number.isInteger(index)) throw new TypeError('Runtime child index must be an integer.');
        const node = this._getRequiredNode(nodeId);
        if (node.protected) throw new Error('Runtime root nodes cannot be reordered.');
        if (!node.parentId) throw new Error(`Detached runtime node cannot be reordered: ${nodeId}`);
        return this.setParent(node.id, node.parentId, {index});
    }

    setNodeEnabled (nodeId, enabled) {
        this._assertAvailable();
        this._assertMutationAllowed('setNodeEnabled');
        const node = this._getRequiredNode(nodeId);
        if (node.protected) throw new Error('Protected runtime root nodes cannot be enabled or disabled directly.');
        const nextEnabled = Boolean(enabled);
        if (node.enabledSelf === nextEnabled) return node;
        runRuntimeNodeSemanticMutation(node, this, 'node.enabled.set', () => {
            node.enabledSelf = nextEnabled;
        });
        this._refreshActiveSubtree(node, {reason: 'node-enabled'});
        this._emit({enabled: nextEnabled, nodeId, type: 'node:enabled'});
        return node;
    }

    getNode (nodeId) {
        this._assertAvailable();
        return this._nodes.get(nodeId) || null;
    }

    getGlobalRoot () {
        this._assertAvailable();
        return this._getRequiredNode(GLOBAL_ROOT_NODE_ID);
    }

    getSceneRoot (sceneId) {
        this._assertAvailable();
        return this._getRequiredSceneRoot(sceneId);
    }

    listSceneIds () {
        this._assertAvailable();
        return Array.from(this._sceneRootIds.keys());
    }

    listNodes (options = {}) {
        this._assertAvailable();
        return Array.from(this._nodes.values()).filter(node => {
            if (options.includeRoots === false && node.protected) return false;
            if (options.scope && node.scope !== options.scope) return false;
            if (options.sceneId && node.sceneId !== options.sceneId) return false;
            return true;
        });
    }

    getChildren (nodeId) {
        this._assertAvailable();
        return this._getRequiredNode(nodeId).getChildren();
    }

    getParent (nodeId) {
        this._assertAvailable();
        return this._getRequiredNode(nodeId).getParent();
    }

    traverse (nodeId, visitor, options = {}) {
        this._assertAvailable();
        if (typeof visitor !== 'function') throw new TypeError('Runtime node visitor must be a function.');
        const root = this._getRequiredNode(nodeId);
        const order = options.order === 'post' ? 'post' : 'pre';
        const visit = (node, depth) => {
            if (order === 'pre') visitor(node, depth);
            node.childIds.forEach(childId => {
                const child = this._nodes.get(childId);
                if (child) visit(child, depth + 1);
            });
            if (order === 'post') visitor(node, depth);
        };
        visit(root, 0);
    }

    createReference (nodeId) {
        this._assertAvailable();
        const node = this._getRequiredNode(nodeId);
        return Object.freeze({
            nodeId: node.id,
            sceneId: node.sceneId,
            scope: node.scope
        });
    }

    resolveReference (reference) {
        this._assertAvailable();
        const source = typeof reference === 'string' ? {nodeId: reference} : reference;
        if (!source || typeof source !== 'object') return null;
        const nodeId = source.nodeId || source.id;
        if (typeof nodeId !== 'string') return null;
        const node = this._nodes.get(nodeId);
        if (!node) return null;
        if (source.scope && source.scope !== node.scope) return null;
        if (source.sceneId && source.sceneId !== node.sceneId) return null;
        return node;
    }

    exportState () {
        this._assertAvailable();
        const visited = new Set();
        const orderedNodes = [];
        const visit = node => {
            if (!node || node.protected || visited.has(node.id)) return;
            visited.add(node.id);
            orderedNodes.push(node);
            node.childIds.forEach(childId => visit(this._nodes.get(childId)));
        };
        const globalRoot = this.getGlobalRoot();
        globalRoot.childIds.forEach(childId => visit(this._nodes.get(childId)));
        this.listSceneIds().forEach(sceneId => {
            const root = this.getSceneRoot(sceneId);
            root.childIds.forEach(childId => visit(this._nodes.get(childId)));
        });
        this.listNodes({includeRoots: false})
            .filter(node => node.parentId === null && !visited.has(node.id))
            .sort((a, b) => compareCanonicalStrings(a.id, b.id))
            .forEach(visit);
        this.listNodes({includeRoots: false})
            .filter(node => !visited.has(node.id))
            .sort((a, b) => compareCanonicalStrings(a.id, b.id))
            .forEach(visit);
        return {
            activeSceneId: this.listSceneIds().find(sceneId => this.getSceneRoot(sceneId).activeInHierarchy) || null,
            nodes: orderedNodes.map(node => (
                typeof node.toPersistentRecord === 'function' ? node.toPersistentRecord() : node.toJSON()
            )),
            scenes: this.listSceneIds().map(sceneId => {
                const root = this.getSceneRoot(sceneId);
                return {id: sceneId, name: root.name};
            }),
            version: RUNTIME_NODE_MODEL_VERSION
        };
    }

    importState (snapshot) {
        this._assertAvailable();
        this._assertMutationAllowed('importState');
        const built = RuntimeNodeGraph.createFromState(snapshot, {
            componentTypeRegistry: this.componentTypeRegistry,
            idFactory: this._idFactory,
            lifecycleGuard: this._lifecycleGuard,
            modelMutationAuthorityRequired: this._modelMutationAuthorityRequired,
            typeRegistry: this.typeRegistry
        });
        this._adoptGraph(built.graph);
        return Object.assign({}, built.result, {state: this.exportState()});
    }

    reifyUnknownNodes (typeId = null) {
        this._assertAvailable();
        this._assertMutationAllowed('reifyUnknownNodes');
        const unknownNodes = this.listNodes({includeRoots: false}).filter(node => (
            node instanceof UnknownRuntimeNode &&
            (!typeId || node.originalTypeId === typeId) &&
            this.typeRegistry.has(node.originalTypeId)
        ));
        if (!unknownNodes.length) {
            return {
                reifiedNodeCount: 0,
                success: true,
                typeId
            };
        }
        const result = this.importState(this.exportState());
        return Object.assign({}, result, {
            reifiedNodeCount: unknownNodes.length,
            typeId
        });
    }

    getStatus () {
        this._assertAvailable();
        const nodes = this.listNodes();
        return {
            activeNodeCount: nodes.filter(node => node.activeInHierarchy).length,
            componentCount: nodes.reduce((count, node) => count + node.getComponents().length, 0),
            globalNodeCount: nodes.filter(node => node.scope === NODE_SCOPES.GLOBAL).length,
            nodeCount: nodes.length,
            unknownNodeCount: nodes.filter(node => node instanceof UnknownRuntimeNode).length,
            lifecycleContractVersion: RUNTIME_NODE_LIFECYCLE_CONTRACT.contractVersion,
            graphListenerErrorCount: this._listenerErrorCount,
            lifecycleHookErrorCount: this._lifecycleHookErrorCount,
            lifecycleSequence: this._lifecycleSequence,
            listenerErrorCount: this._listenerErrorCount,
            observerReentrantMutationCount: this._observerReentrantMutationCount,
            runtimeGeneration: this._runtimeGeneration,
            revision: this._revision,
            sceneCount: this._sceneRootIds.size,
            sceneNodeCount: nodes.filter(node => node.scope === NODE_SCOPES.SCENE).length,
            version: this.version
        };
    }

    subscribe (listener) {
        this._assertAvailable();
        if (typeof listener !== 'function') return () => {};
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    dispose () {
        if (this._disposed) return;
        this._assertMutationAllowed('dispose');
        this._sceneRootIds.forEach(rootId => {
            const root = this._nodes.get(rootId);
            if (root) this._destroyNode(root, {force: true});
        });
        const globalRoot = this._nodes.get(GLOBAL_ROOT_NODE_ID);
        if (globalRoot) this._destroyNode(globalRoot, {force: true});
        this._sceneRootIds.clear();
        this._nodes.clear();
        this._listeners.clear();
        this._modelMutationCommitFrame = null;
        if (typeof this._unbindComponentTypeUsageResolver === 'function') {
            this._unbindComponentTypeUsageResolver();
        }
        this._unbindComponentTypeUsageResolver = null;
        this._disposed = true;
    }
}

module.exports = {
    RuntimeNodeGraph,
    normalizeSceneDescriptor
};

Object.defineProperties(module.exports, {
    createRuntimeNodeGraphSemanticCheckpoint: {value: createRuntimeNodeGraphSemanticCheckpoint},
    restoreRuntimeNodeGraphSemanticCheckpoint: {value: restoreRuntimeNodeGraphSemanticCheckpoint}
});
