const {
    COMPONENT_LIFECYCLE_STATES
} = require('./constants');
const {createRuntimeId} = require('./id');
const {
    LIFECYCLE_ENTITY_KINDS,
    LIFECYCLE_PHASES,
    assertLifecycleTransition,
    normalizeLifecycleDetails
} = require('./runtime-node-lifecycle');
const {cloneSerializable} = require('./serializable');
const {clonePortableData} = require('./portable-data');
const {createGuardedSemanticValue} = require('./guarded-semantic-value');
const {
    COMPONENT_CARDINALITIES,
    assertSafeComponentDataKeys,
    isComponentSchemaVersionSpecified,
    normalizeComponentData,
    normalizeComponentSchemaVersion,
    normalizeExtensionData,
    normalizeImportedComponentRecord,
    normalizeLocalComponentOptions,
    normalizePublicComponentOptions
} = require('./runtime-component-contract');
const {
    createLifecycleHookContext,
    createProviderResourceContext
} = require('./runtime-node-lifecycle-observation');

const componentOwnerIds = new WeakMap();

const componentGraphs = new WeakMap();
const componentSemanticStates = new WeakMap();
const componentInternalStates = new WeakMap();
const componentContainerOwners = new WeakMap();
const componentContainerGraphs = new WeakMap();
const componentContainerComponents = new WeakMap();
const componentMutationDepths = new WeakMap();
const componentContainerMutationDepths = new WeakMap();
const RUNTIME_COMPONENT_BINDING_AUTHORITY = Object.freeze({});
const RUNTIME_COMPONENT_INTERNAL_METHOD_NAMES = Object.freeze([
    '_replaceGraphBinding',
    '_invoke',
    '_recordLifecycle',
    '_transition',
    '_create',
    '_attach',
    '_ready',
    '_setActive',
    '_setEnabled',
    '_detach',
    '_destroy',
    'patchData',
    'setData'
]);
const RUNTIME_COMPONENT_CONTAINER_INTERNAL_METHOD_NAMES = Object.freeze([
    '_replaceGraphBinding',
    '_readyAll',
    '_setActiveAll',
    '_destroyAll',
    'add',
    'remove'
]);
let RUNTIME_COMPONENT_INTERNAL_OPS = null;
let RUNTIME_COMPONENT_CONTAINER_INTERNAL_OPS = null;

const createRuntimeComponentAuthorityError = operation => {
    const error = new Error('Attached Runtime Component mutation requires Runtime Graph authority.');
    error.code = 'RUNTIME_COMPONENT_MODEL_AUTHORITY_REQUIRED';
    error.operation = operation;
    return error;
};

const assertRuntimeComponentSemanticMutation = (component, operation, path = null) => {
    const graph = componentGraphs.get(component);
    if (!graph) return true;
    const normalizedOperation = path ? `${operation}:${path}` : operation;
    if (typeof graph._assertMutationAllowed === 'function') graph._assertMutationAllowed(normalizedOperation);
    if (graph._modelMutationAuthorityRequired === true &&
        (componentMutationDepths.get(component) || 0) < 1) {
        throw createRuntimeComponentAuthorityError(normalizedOperation);
    }
    return true;
};

const withRuntimeComponentMutationAuthority = (component, graph, operation, callback) => {
    const currentGraph = componentGraphs.get(component);
    if (currentGraph && currentGraph !== graph) throw createRuntimeComponentAuthorityError(operation);
    if (graph && typeof graph._assertMutationAllowed === 'function') graph._assertMutationAllowed(operation);
    componentMutationDepths.set(component, (componentMutationDepths.get(component) || 0) + 1);
    try {
        return callback();
    } finally {
        const nextDepth = (componentMutationDepths.get(component) || 1) - 1;
        if (nextDepth > 0) componentMutationDepths.set(component, nextDepth);
        else componentMutationDepths.delete(component);
    }
};

const createRuntimeComponentContainerAuthorityError = operation => {
    const error = new Error('Runtime Component Container mutation requires Runtime Graph authority.');
    error.code = 'RUNTIME_COMPONENT_MODEL_AUTHORITY_REQUIRED';
    error.operation = operation;
    return error;
};

const assertRuntimeComponentContainerMutation = (container, operation) => {
    const graph = componentContainerGraphs.get(container);
    if (!graph) return true;
    if (typeof graph._assertMutationAllowed === 'function') graph._assertMutationAllowed(operation);
    if (graph._modelMutationAuthorityRequired === true &&
        (componentContainerMutationDepths.get(container) || 0) < 1) {
        throw createRuntimeComponentContainerAuthorityError(operation);
    }
    return true;
};

const withRuntimeComponentContainerMutationAuthority = (container, graph, operation, callback) => {
    const currentGraph = componentContainerGraphs.get(container);
    if (currentGraph && currentGraph !== graph) throw createRuntimeComponentContainerAuthorityError(operation);
    if (graph && typeof graph._assertMutationAllowed === 'function') graph._assertMutationAllowed(operation);
    componentContainerMutationDepths.set(container, (componentContainerMutationDepths.get(container) || 0) + 1);
    try {
        return callback();
    } finally {
        const nextDepth = (componentContainerMutationDepths.get(container) || 1) - 1;
        if (nextDepth > 0) componentContainerMutationDepths.set(container, nextDepth);
        else componentContainerMutationDepths.delete(container);
    }
};

const notifyRuntimeComponentSemanticMutation = component => {
    const graph = componentGraphs.get(component);
    if (graph && typeof graph._touchSemanticRevision === 'function') graph._touchSemanticRevision();
};

const cloneComponentDataAssignedValue = (value, path, property) => {
    if (typeof property === 'string' && ['__proto__', 'constructor', 'prototype'].includes(property)) {
        const error = new TypeError(`Runtime component data key is forbidden at ${path}.`);
        error.code = 'RUNTIME_COMPONENT_DATA_KEY_FORBIDDEN';
        error.path = path;
        throw error;
    }
    const cloned = clonePortableData(value, {allowTopLevelUndefined: true});
    assertSafeComponentDataKeys(cloned, path);
    return cloned;
};

const createGuardedComponentValue = (component, field, value, normalizeAssigned) =>
    createGuardedSemanticValue(value, {
        assertMutation: (operation, path) => assertRuntimeComponentSemanticMutation(component, operation, path),
        didMutate: () => notifyRuntimeComponentSemanticMutation(component),
        normalizeAssigned,
        operationPrefix: `component.${field}`,
        rootPath: `$.${field}`
    });

const defineGuardedComponentField = (component, field, initialValue, options = {}) => {
    const state = componentSemanticStates.get(component);
    const normalize = typeof options.normalize === 'function' ? options.normalize : value => value;
    const guarded = options.guarded === true;
    const normalizeAssigned = typeof options.normalizeAssigned === 'function' ?
        options.normalizeAssigned : value => clonePortableData(value, {allowTopLevelUndefined: true});
    state[field] = guarded ?
        createGuardedComponentValue(component, field, normalize(initialValue), normalizeAssigned) :
        normalize(initialValue);
    Object.defineProperty(component, field, {
        configurable: false,
        enumerable: options.enumerable !== false,
        get: () => componentSemanticStates.get(component)[field],
        set: value => {
            assertRuntimeComponentSemanticMutation(component, `component.${field}.set`, `$.${field}`);
            componentSemanticStates.get(component)[field] = guarded ?
                createGuardedComponentValue(component, field, normalize(value), normalizeAssigned) :
                normalize(value);
            notifyRuntimeComponentSemanticMutation(component);
        }
    });
};

const defineFinalRuntimeComponentInternalMethods = component => {
    if (!RUNTIME_COMPONENT_INTERNAL_OPS) {
        throw new Error('Runtime Component internal operations are not initialized.');
    }
    RUNTIME_COMPONENT_INTERNAL_METHOD_NAMES.forEach(methodName => {
        Object.defineProperty(component, methodName, {
            configurable: false,
            enumerable: false,
            value: RUNTIME_COMPONENT_INTERNAL_OPS[methodName],
            writable: false
        });
    });
};

const defineFinalRuntimeComponentContainerInternalMethods = container => {
    if (!RUNTIME_COMPONENT_CONTAINER_INTERNAL_OPS) {
        throw new Error('Runtime Component Container internal operations are not initialized.');
    }
    RUNTIME_COMPONENT_CONTAINER_INTERNAL_METHOD_NAMES.forEach(methodName => {
        Object.defineProperty(container, methodName, {
            configurable: false,
            enumerable: false,
            value: RUNTIME_COMPONENT_CONTAINER_INTERNAL_OPS[methodName],
            writable: false
        });
    });
};

class RuntimeComponent {
    constructor (options = {}, descriptor = null) {
        if (typeof options.typeId !== 'string' || !options.typeId.trim()) {
            throw new TypeError('Runtime component typeId must be a non-empty string.');
        }
        const normalizedId = typeof options.id === 'string' && options.id.trim() ?
            options.id.trim() : createRuntimeId('runtime-component');
        const normalizedTypeId = options.typeId.trim();
        const normalizedSchemaVersion = normalizeComponentSchemaVersion(
            typeof options.schemaVersion === 'undefined' && descriptor ? descriptor.schemaVersion : options.schemaVersion
        );
        const cardinality = descriptor && descriptor.cardinality === COMPONENT_CARDINALITIES.MANY ?
            COMPONENT_CARDINALITIES.MANY : COMPONENT_CARDINALITIES.ONE;

        componentOwnerIds.set(this, null);
        componentGraphs.set(this, null);
        componentMutationDepths.delete(this);
        componentSemanticStates.set(this, Object.create(null));
        const providerResources = new Map();
        componentInternalStates.set(this, {
            createInvoked: false,
            hooks: options.hooks && typeof options.hooks === 'object' ? options.hooks : {},
            providerResourceContext: createProviderResourceContext(providerResources),
            providerResources,
            readyInvoked: false
        });

        Object.defineProperties(this, {
            allowMultiple: {
                configurable: false,
                enumerable: true,
                get: () => cardinality === COMPONENT_CARDINALITIES.MANY
            },
            cardinality: {
                configurable: false,
                enumerable: true,
                value: cardinality,
                writable: false
            },
            id: {
                configurable: false,
                enumerable: true,
                value: normalizedId,
                writable: false
            },
            ownerId: {
                configurable: false,
                enumerable: true,
                get: () => componentOwnerIds.get(this) || null
            },
            schemaVersion: {
                configurable: false,
                enumerable: true,
                value: normalizedSchemaVersion,
                writable: false
            },
            typeId: {
                configurable: false,
                enumerable: true,
                value: normalizedTypeId,
                writable: false
            }
        });
        defineGuardedComponentField(this, 'enabled', options.enabled !== false, {normalize: Boolean});
        defineGuardedComponentField(this, 'activeInHierarchy', false, {normalize: Boolean});
        defineGuardedComponentField(this, 'data', normalizeComponentData(options.data), {
            guarded: true,
            normalize: normalizeComponentData,
            normalizeAssigned: cloneComponentDataAssignedValue
        });
        defineGuardedComponentField(this, '_extensionData', normalizeExtensionData(options.extensionData), {
            guarded: true,
            normalize: normalizeExtensionData
        });
        defineGuardedComponentField(this, 'state', COMPONENT_LIFECYCLE_STATES.CREATED);
        Object.defineProperties(this, {
            _createInvoked: {
                configurable: false,
                enumerable: true,
                get: () => componentInternalStates.get(this).createInvoked,
                set: value => {
                    assertRuntimeComponentSemanticMutation(this, 'component.createInvoked.set', '$._createInvoked');
                    componentInternalStates.get(this).createInvoked = Boolean(value);
                }
            },
            _readyInvoked: {
                configurable: false,
                enumerable: true,
                get: () => componentInternalStates.get(this).readyInvoked,
                set: value => {
                    assertRuntimeComponentSemanticMutation(this, 'component.readyInvoked.set', '$._readyInvoked');
                    componentInternalStates.get(this).readyInvoked = Boolean(value);
                }
            }
        });
        defineFinalRuntimeComponentInternalMethods(this);
        Object.seal(this);
    }

    _replaceGraphBinding (graph, authority) {
        assertRuntimeComponentSemanticMutation(this, 'component.replaceGraphBinding', '$._graph');
        if (authority !== RUNTIME_COMPONENT_BINDING_AUTHORITY) {
            const error = new Error('Runtime component Graph rebinding is private to the Runtime Graph.');
            error.code = 'RUNTIME_COMPONENT_INTERNAL_AUTHORITY_REQUIRED';
            error.operation = 'replaceGraphBinding';
            throw error;
        }
        componentGraphs.set(this, graph || null);
        return this;
    }

    _invoke (hookName, payload) {
        const internal = componentInternalStates.get(this);
        const hook = internal.hooks[hookName];
        if (typeof hook !== 'function') return null;
        try {
            const graph = payload && payload.graph;
            const owner = payload && payload.node;
            const hookPayload = createLifecycleHookContext({
                component: this,
                extra: payload,
                graph,
                node: owner,
                resources: internal.providerResourceContext
            });
            if (graph && typeof graph._runLifecycleHook === 'function') {
                graph._runLifecycleHook({
                    componentId: this.id,
                    componentTypeId: this.typeId,
                    entityKind: LIFECYCLE_ENTITY_KINDS.COMPONENT,
                    hookName,
                    nodeId: owner ? owner.id : this.ownerId,
                    phase: payload && payload.phase ? payload.phase : null,
                    state: this.state
                }, () => hook(hookPayload));
            } else {
                hook(hookPayload);
            }
            return null;
        } catch (error) {
            const graph = payload && payload.graph;
            if (graph && typeof graph._reportLifecycleHookError === 'function') {
                graph._reportLifecycleHookError({
                    componentId: this.id,
                    componentTypeId: this.typeId,
                    entityKind: LIFECYCLE_ENTITY_KINDS.COMPONENT,
                    hookName,
                    nodeId: payload && payload.node ? payload.node.id : this.ownerId,
                    phase: payload && payload.phase ? payload.phase : null,
                    state: this.state
                }, error);
            }
            return error;
        }
    }

    _recordLifecycle (graph, owner, phase, fromState, toState, extra = {}) {
        if (!graph || typeof graph._recordLifecycle !== 'function') return;
        graph._recordLifecycle(normalizeLifecycleDetails(Object.assign({
            componentId: this.id,
            componentTypeId: this.typeId,
            entityKind: LIFECYCLE_ENTITY_KINDS.COMPONENT,
            fromState,
            nodeId: owner ? owner.id : this.ownerId,
            phase,
            toState
        }, extra)));
    }

    _transition (state, phase, hookName, owner, graph, extra = {}) {
        const previousState = this.state;
        if (previousState === state) return false;
        if (graph && typeof graph._assertMutationAllowed === 'function') {
            graph._assertMutationAllowed('component.transition');
        }
        assertLifecycleTransition(LIFECYCLE_ENTITY_KINDS.COMPONENT, previousState, state);
        this.state = state;
        if (hookName) invokeRuntimeComponentHook(this, hookName, Object.assign({
            component: this,
            fromState: previousState,
            graph,
            node: owner,
            phase,
            toState: state
        }, extra));
        recordRuntimeComponentLifecycle(this, graph, owner, phase, previousState, state, extra);
        return previousState !== state;
    }

    _create (owner, graph) {
        if (this._createInvoked) return false;
        if (graph && typeof graph._assertMutationAllowed === 'function') {
            graph._assertMutationAllowed('component.create');
        }
        componentGraphs.set(this, graph);
        this._createInvoked = true;
        invokeRuntimeComponentHook(this, 'onCreate', {
            component: this,
            fromState: null,
            graph,
            node: owner,
            phase: LIFECYCLE_PHASES.CREATE,
            toState: this.state
        });
        recordRuntimeComponentLifecycle(
            this,
            graph,
            owner,
            LIFECYCLE_PHASES.CREATE,
            null,
            this.state
        );
        return true;
    }

    _attach (owner, graph) {
        if (graph && typeof graph._assertMutationAllowed === 'function') {
            graph._assertMutationAllowed('component.attach');
        }
        componentOwnerIds.set(this, owner.id);
        transitionRuntimeComponent(
            this,
            COMPONENT_LIFECYCLE_STATES.ATTACHED,
            LIFECYCLE_PHASES.ATTACH,
            'onAttach',
            owner,
            graph
        );
    }

    _ready (owner, graph) {
        if (this._readyInvoked) return false;
        if (graph && typeof graph._assertMutationAllowed === 'function') {
            graph._assertMutationAllowed('component.ready');
        }
        this._readyInvoked = true;
        transitionRuntimeComponent(
            this,
            COMPONENT_LIFECYCLE_STATES.READY,
            LIFECYCLE_PHASES.READY,
            'onReady',
            owner,
            graph
        );
        return true;
    }

    _setActive (active, owner, graph, extra = {}) {
        const nextActive = Boolean(active) && this.enabled;
        const nextState = nextActive ? COMPONENT_LIFECYCLE_STATES.ACTIVE : COMPONENT_LIFECYCLE_STATES.DISABLED;
        const stateCanChange = this.state !== COMPONENT_LIFECYCLE_STATES.CREATED &&
            this.state !== COMPONENT_LIFECYCLE_STATES.DETACHED &&
            this.state !== COMPONENT_LIFECYCLE_STATES.DESTROYED;
        const activeChanged = this.activeInHierarchy !== nextActive;
        const stateChanged = stateCanChange && this.state !== nextState;
        if (!activeChanged && !stateChanged) return false;
        if (graph && typeof graph._assertMutationAllowed === 'function') {
            graph._assertMutationAllowed('component.setActive');
        }
        this.activeInHierarchy = nextActive;
        if (stateCanChange) {
            transitionRuntimeComponent(
                this,
                nextState,
                nextActive ? LIFECYCLE_PHASES.ENABLE : LIFECYCLE_PHASES.DISABLE,
                nextActive ? 'onEnable' : 'onDisable',
                owner,
                graph,
                extra
            );
        }
        return true;
    }

    _setEnabled (enabled, owner, graph) {
        if (graph && typeof graph._assertMutationAllowed === 'function') {
            graph._assertMutationAllowed('component.setEnabled');
        }
        const nextEnabled = Boolean(enabled);
        if (this.enabled === nextEnabled) return false;
        this.enabled = nextEnabled;
        setRuntimeComponentActive(this, owner.activeInHierarchy, owner, graph, {reason: 'component-enabled'});
        return true;
    }

    _detach (owner, graph, extra = {}) {
        if (this.state === COMPONENT_LIFECYCLE_STATES.DESTROYED ||
            this.state === COMPONENT_LIFECYCLE_STATES.DETACHED) return false;
        if (graph && typeof graph._assertMutationAllowed === 'function') {
            graph._assertMutationAllowed('component.detach');
        }
        setRuntimeComponentActive(this, false, owner, graph, Object.assign({reason: 'component-detach'}, extra));
        transitionRuntimeComponent(
            this,
            COMPONENT_LIFECYCLE_STATES.DETACHED,
            LIFECYCLE_PHASES.DETACH,
            'onDetach',
            owner,
            graph,
            extra
        );
        componentOwnerIds.set(this, null);
        return true;
    }

    _destroy (owner, graph, extra = {}) {
        if (this.state === COMPONENT_LIFECYCLE_STATES.DESTROYED) return false;
        if (graph && typeof graph._assertMutationAllowed === 'function') {
            graph._assertMutationAllowed('component.destroy');
        }
        if (this.state !== COMPONENT_LIFECYCLE_STATES.DETACHED &&
            this.state !== COMPONENT_LIFECYCLE_STATES.CREATED) detachRuntimeComponent(this, owner, graph, extra);
        transitionRuntimeComponent(
            this,
            COMPONENT_LIFECYCLE_STATES.DESTROYED,
            LIFECYCLE_PHASES.DESTROY,
            'onDestroy',
            owner,
            graph,
            extra
        );
        componentOwnerIds.set(this, null);
        componentGraphs.set(this, null);
        return true;
    }

    patchData (patch) {
        assertRuntimeComponentSemanticMutation(this, 'component.patchData');
        const graph = componentGraphs.get(this);
        if (graph && typeof graph._assertMutationAllowed === 'function') {
            graph._assertMutationAllowed('component.patchData');
        }
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
            throw new TypeError('Runtime component data patch must be an object.');
        }
        const current = normalizeComponentData(this.data);
        const normalizedPatch = normalizeComponentData(patch);
        const candidate = {};
        Object.entries(current).forEach(([key, value]) => {
            Object.defineProperty(candidate, key, {
                configurable: true,
                enumerable: true,
                value,
                writable: true
            });
        });
        Object.entries(normalizedPatch).forEach(([key, value]) => {
            Object.defineProperty(candidate, key, {
                configurable: true,
                enumerable: true,
                value,
                writable: true
            });
        });
        this.data = normalizeComponentData(candidate);
        return this;
    }

    setData (data) {
        assertRuntimeComponentSemanticMutation(this, 'component.setData');
        const graph = componentGraphs.get(this);
        if (graph && typeof graph._assertMutationAllowed === 'function') {
            graph._assertMutationAllowed('component.setData');
        }
        this.data = normalizeComponentData(data);
        return this;
    }

    toPersistentRecord () {
        const record = {
            allowMultiple: this.allowMultiple,
            data: cloneSerializable(this.data),
            enabled: this.enabled,
            id: this.id,
            schemaVersion: this.schemaVersion,
            typeId: this.typeId
        };
        if (Object.keys(this._extensionData).length) {
            record.extensionData = cloneSerializable(this._extensionData);
        }
        delete record.activeInHierarchy;
        delete record.ownerId;
        delete record.ready;
        delete record.state;
        return record;
    }

    toDebugJSON () {
        return Object.assign({}, this.toPersistentRecord(), {
            activeInHierarchy: this.activeInHierarchy,
            cardinality: this.cardinality,
            ownerId: this.ownerId,
            ready: this._readyInvoked,
            state: this.state
        });
    }

    toJSON () {
        return this.toDebugJSON();
    }
}

class RuntimeComponentContainer {
    constructor (owner, graph) {
        componentContainerOwners.set(this, owner);
        componentContainerGraphs.set(this, graph);
        componentContainerComponents.set(this, new Map());
        componentContainerMutationDepths.delete(this);
        Object.defineProperties(this, {
            owner: {
                configurable: false,
                enumerable: true,
                get: () => componentContainerOwners.get(this) || null
            }
        });
        defineFinalRuntimeComponentContainerInternalMethods(this);
        Object.seal(this);
    }

    _replaceGraphBinding (graph, authority) {
        assertRuntimeComponentContainerMutation(this, 'component-container.replaceGraphBinding');
        const currentGraph = componentContainerGraphs.get(this);
        if (currentGraph && typeof currentGraph._assertMutationAllowed === 'function') {
            currentGraph._assertMutationAllowed('component-container.replaceGraphBinding');
        }
        if (authority !== RUNTIME_COMPONENT_BINDING_AUTHORITY) {
            const error = new Error('Runtime component container Graph rebinding is private to the Runtime Graph.');
            error.code = 'RUNTIME_COMPONENT_INTERNAL_AUTHORITY_REQUIRED';
            error.operation = 'replaceGraphBinding';
            throw error;
        }
        componentContainerGraphs.set(this, graph || null);
        return this;
    }

    add (options = {}, addOptions = {}) {
        assertRuntimeComponentContainerMutation(this, 'component-container.add');
        const graph = componentContainerGraphs.get(this);
        const owner = componentContainerOwners.get(this);
        if (graph && typeof graph._assertMutationAllowed === 'function') {
            graph._assertMutationAllowed('component-container.add');
        }
        const source = addOptions.source === 'import' ? 'import' : (addOptions.source === 'public' ? 'public' : 'local');
        let normalizedOptions = options;
        if (!(options instanceof RuntimeComponent)) {
            if (source === 'import') normalizedOptions = normalizeImportedComponentRecord(options);
            else if (source === 'public') normalizedOptions = normalizePublicComponentOptions(options);
            else normalizedOptions = normalizeLocalComponentOptions(options);
        }
        const componentTypeId = options instanceof RuntimeComponent ? options.typeId : normalizedOptions.typeId;
        const descriptor = graph._resolveComponentTypeDescriptor(
            componentTypeId,
            {
                allowMultiple: options instanceof RuntimeComponent ?
                    options.allowMultiple : normalizedOptions.allowMultiple,
                allowMultipleSpecified: options instanceof RuntimeComponent ?
                    true : normalizedOptions.allowMultipleSpecified,
                schemaVersion: options instanceof RuntimeComponent ?
                    options.schemaVersion : normalizedOptions.schemaVersion,
                schemaVersionSpecified: options instanceof RuntimeComponent ?
                    true : isComponentSchemaVersionSpecified(normalizedOptions),
                source
            }
        );
        const implicitDescriptor = graph.componentTypeRegistry &&
            typeof graph.componentTypeRegistry.isImplicit === 'function' &&
            graph.componentTypeRegistry.isImplicit(componentTypeId);
        if (!(options instanceof RuntimeComponent) &&
            (!isComponentSchemaVersionSpecified(normalizedOptions) ||
                !implicitDescriptor)) {
            normalizedOptions.schemaVersion = descriptor.schemaVersion;
        }
        const component = options instanceof RuntimeComponent ?
            options : new RuntimeComponent(normalizedOptions, descriptor);
        if (component.cardinality !== descriptor.cardinality) {
            const error = new Error(
                `Runtime component cardinality conflicts with descriptor for type: ${component.typeId}`
            );
            error.code = 'RUNTIME_COMPONENT_CARDINALITY_CONFLICT';
            error.componentCardinality = component.cardinality;
            error.descriptorCardinality = descriptor.cardinality;
            error.typeId = component.typeId;
            throw error;
        }
        if (!implicitDescriptor &&
            component.schemaVersion !== descriptor.schemaVersion) {
            const error = new Error(
                `Runtime component schemaVersion conflicts with descriptor for type: ${component.typeId}`
            );
            error.code = 'RUNTIME_COMPONENT_SCHEMA_VERSION_CONFLICT';
            error.componentSchemaVersion = component.schemaVersion;
            error.descriptorSchemaVersion = descriptor.schemaVersion;
            error.typeId = component.typeId;
            throw error;
        }
        if (componentContainerComponents.get(this).has(component.id)) {
            throw new Error(`Runtime component id already exists on node: ${component.id}`);
        }
        const existingByType = this.getAllByType(component.typeId);
        if (existingByType.length && descriptor.cardinality !== COMPONENT_CARDINALITIES.MANY) {
            const error = new Error(`Node already has a component of cardinality one: ${component.typeId}`);
            error.code = 'RUNTIME_COMPONENT_CARDINALITY_VIOLATION';
            error.typeId = component.typeId;
            throw error;
        }
        if (component.state !== COMPONENT_LIFECYCLE_STATES.CREATED) {
            throw new Error(`Runtime component cannot be attached from lifecycle state: ${component.state}`);
        }
        componentContainerComponents.get(this).set(component.id, component);
        try {
            createRuntimeComponent(component, owner, graph);
            attachRuntimeComponent(component, owner, graph);
            if (owner.isReady()) {
                readyRuntimeComponent(component, owner, graph);
                setRuntimeComponentActive(component, owner.activeInHierarchy, owner, graph, {reason: 'component-add'});
            }
            return component;
        } catch (error) {
            componentContainerComponents.get(this).delete(component.id);
            try {
                destroyRuntimeComponent(component, owner, graph, {reason: 'component-add-rollback'});
            } catch (cleanupError) {
                // Preserve the original construction error; the detached component is not retained by the owner.
            }
            throw error;
        }
    }

    remove (componentId) {
        assertRuntimeComponentContainerMutation(this, 'component-container.remove');
        const graph = componentContainerGraphs.get(this);
        const owner = componentContainerOwners.get(this);
        if (graph && typeof graph._assertMutationAllowed === 'function') {
            graph._assertMutationAllowed('component-container.remove');
        }
        const component = componentContainerComponents.get(this).get(componentId);
        if (!component) return false;
        detachRuntimeComponent(component, owner, graph);
        destroyRuntimeComponent(component, owner, graph);
        componentContainerComponents.get(this).delete(componentId);
        return true;
    }

    get (componentId) {
        return componentContainerComponents.get(this).get(componentId) || null;
    }

    getByType (typeId) {
        return Array.from(componentContainerComponents.get(this).values()).find(component => component.typeId === typeId) || null;
    }

    getAllByType (typeId) {
        return Array.from(componentContainerComponents.get(this).values()).filter(component => component.typeId === typeId);
    }

    list () {
        return Array.from(componentContainerComponents.get(this).values());
    }

    _readyAll () {
        assertRuntimeComponentContainerMutation(this, 'component-container.readyAll');
        const owner = componentContainerOwners.get(this);
        const graph = componentContainerGraphs.get(this);
        componentContainerComponents.get(this).forEach(component => readyRuntimeComponent(component, owner, graph));
    }

    _setActiveAll (active, extra = {}) {
        assertRuntimeComponentContainerMutation(this, 'component-container.setActiveAll');
        const owner = componentContainerOwners.get(this);
        const graph = componentContainerGraphs.get(this);
        componentContainerComponents.get(this).forEach(component => setRuntimeComponentActive(component, active, owner, graph, extra));
    }

    _destroyAll () {
        assertRuntimeComponentContainerMutation(this, 'component-container.destroyAll');
        Array.from(componentContainerComponents.get(this).values()).forEach(component => {
            const owner = componentContainerOwners.get(this);
            const graph = componentContainerGraphs.get(this);
            detachRuntimeComponent(component, owner, graph, {reason: 'node-destroy'});
            destroyRuntimeComponent(component, owner, graph, {reason: 'node-destroy'});
        });
        componentContainerComponents.get(this).clear();
    }

    toPersistentRecords () {
        return this.list().map(component => component.toPersistentRecord());
    }

    toDebugJSON () {
        return this.list().map(component => component.toDebugJSON());
    }

    toJSON () {
        return this.toDebugJSON();
    }
}


const captureInternalOperations = (prototype, methodNames, label) => {
    const operations = Object.create(null);
    methodNames.forEach(methodName => {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);
        if (!descriptor || typeof descriptor.value !== 'function') {
            throw new Error(`Missing ${label} internal operation: ${methodName}`);
        }
        operations[methodName] = descriptor.value;
        Object.defineProperty(prototype, methodName, {
            configurable: false,
            enumerable: descriptor.enumerable === true,
            value: descriptor.value,
            writable: false
        });
    });
    return Object.freeze(operations);
};

RUNTIME_COMPONENT_INTERNAL_OPS = captureInternalOperations(
    RuntimeComponent.prototype,
    RUNTIME_COMPONENT_INTERNAL_METHOD_NAMES,
    'Runtime Component'
);
RUNTIME_COMPONENT_CONTAINER_INTERNAL_OPS = captureInternalOperations(
    RuntimeComponentContainer.prototype,
    RUNTIME_COMPONENT_CONTAINER_INTERNAL_METHOD_NAMES,
    'Runtime Component Container'
);

const replaceRuntimeComponentGraphBinding = (component, graph, expectedCurrentGraph) => {
    const currentGraph = componentGraphs.get(component);
    if (currentGraph !== expectedCurrentGraph) {
        const error = new Error('Runtime component graph binding replacement requires the current Graph authority.');
        error.code = 'RUNTIME_COMPONENT_INTERNAL_AUTHORITY_REQUIRED';
        throw error;
    }
    return withRuntimeComponentMutationAuthority(component, currentGraph,
        'component.replaceGraphBinding', () => RUNTIME_COMPONENT_INTERNAL_OPS._replaceGraphBinding.call(
            component,
            graph,
            RUNTIME_COMPONENT_BINDING_AUTHORITY
        ));
};
const invokeRuntimeComponentHook = (component, hookName, payload) =>
    RUNTIME_COMPONENT_INTERNAL_OPS._invoke.call(component, hookName, payload);
const recordRuntimeComponentLifecycle = (component, graph, owner, phase, fromState, toState, extra = {}) =>
    RUNTIME_COMPONENT_INTERNAL_OPS._recordLifecycle.call(
        component,
        graph,
        owner,
        phase,
        fromState,
        toState,
        extra
    );
const transitionRuntimeComponent = (component, state, phase, hookName, owner, graph, extra = {}) =>
    withRuntimeComponentMutationAuthority(component, graph, 'component.transition', () =>
        RUNTIME_COMPONENT_INTERNAL_OPS._transition.call(
            component,
            state,
            phase,
            hookName,
            owner,
            graph,
            extra
        ));
const createRuntimeComponent = (component, owner, graph) =>
    withRuntimeComponentMutationAuthority(component, graph, 'component.create', () =>
        RUNTIME_COMPONENT_INTERNAL_OPS._create.call(component, owner, graph));
const attachRuntimeComponent = (component, owner, graph) =>
    withRuntimeComponentMutationAuthority(component, graph, 'component.attach', () =>
        RUNTIME_COMPONENT_INTERNAL_OPS._attach.call(component, owner, graph));
const readyRuntimeComponent = (component, owner, graph) =>
    withRuntimeComponentMutationAuthority(component, graph, 'component.ready', () =>
        RUNTIME_COMPONENT_INTERNAL_OPS._ready.call(component, owner, graph));
const setRuntimeComponentActive = (component, active, owner, graph, extra = {}) =>
    withRuntimeComponentMutationAuthority(component, graph, 'component.setActive', () =>
        RUNTIME_COMPONENT_INTERNAL_OPS._setActive.call(component, active, owner, graph, extra));
const setRuntimeComponentEnabled = (component, enabled, owner, graph) =>
    withRuntimeComponentMutationAuthority(component, graph, 'component.setEnabled', () =>
        RUNTIME_COMPONENT_INTERNAL_OPS._setEnabled.call(component, enabled, owner, graph));
const detachRuntimeComponent = (component, owner, graph, extra = {}) =>
    withRuntimeComponentMutationAuthority(component, graph, 'component.detach', () =>
        RUNTIME_COMPONENT_INTERNAL_OPS._detach.call(component, owner, graph, extra));
const destroyRuntimeComponent = (component, owner, graph, extra = {}) =>
    withRuntimeComponentMutationAuthority(component, graph, 'component.destroy', () =>
        RUNTIME_COMPONENT_INTERNAL_OPS._destroy.call(component, owner, graph, extra));
const readyAllRuntimeComponents = (container, graph) =>
    withRuntimeComponentContainerMutationAuthority(container, graph, 'component-container.readyAll', () =>
        RUNTIME_COMPONENT_CONTAINER_INTERNAL_OPS._readyAll.call(container));
const setAllRuntimeComponentsActive = (container, active, graph, extra = {}) =>
    withRuntimeComponentContainerMutationAuthority(container, graph, 'component-container.setActiveAll', () =>
        RUNTIME_COMPONENT_CONTAINER_INTERNAL_OPS._setActiveAll.call(container, active, extra));
const destroyAllRuntimeComponents = (container, graph) =>
    withRuntimeComponentContainerMutationAuthority(container, graph, 'component-container.destroyAll', () =>
        RUNTIME_COMPONENT_CONTAINER_INTERNAL_OPS._destroyAll.call(container));
const replaceRuntimeComponentContainerGraphBinding = (container, graph, expectedCurrentGraph) => {
    const currentGraph = componentContainerGraphs.get(container);
    if (currentGraph !== expectedCurrentGraph) {
        const error = new Error('Runtime component container Graph binding replacement requires the current Graph authority.');
        error.code = 'RUNTIME_COMPONENT_INTERNAL_AUTHORITY_REQUIRED';
        throw error;
    }
    return withRuntimeComponentContainerMutationAuthority(
        container,
        currentGraph,
        'component-container.replaceGraphBinding',
        () => RUNTIME_COMPONENT_CONTAINER_INTERNAL_OPS._replaceGraphBinding.call(
            container,
            graph,
            RUNTIME_COMPONENT_BINDING_AUTHORITY
        )
    );
};
const addRuntimeComponentToContainer = (container, options, addOptions, graph) =>
    withRuntimeComponentContainerMutationAuthority(container, graph, 'component-container.add', () =>
        RUNTIME_COMPONENT_CONTAINER_INTERNAL_OPS.add.call(container, options, addOptions));
const removeRuntimeComponentFromContainer = (container, componentId, graph) =>
    withRuntimeComponentContainerMutationAuthority(container, graph, 'component-container.remove', () =>
        RUNTIME_COMPONENT_CONTAINER_INTERNAL_OPS.remove.call(container, componentId));
const patchRuntimeComponentData = (component, patch, graph) =>
    withRuntimeComponentMutationAuthority(component, graph, 'component.patchData', () =>
        RUNTIME_COMPONENT_INTERNAL_OPS.patchData.call(component, patch));
const setRuntimeComponentData = (component, data, graph) =>
    withRuntimeComponentMutationAuthority(component, graph, 'component.setData', () =>
        RUNTIME_COMPONENT_INTERNAL_OPS.setData.call(component, data));


const RUNTIME_COMPONENT_GUARDED_CHECKPOINT_FIELDS = new Set(['data', '_extensionData']);

const captureRuntimeComponentSemanticCheckpoint = component => {
    const semantic = componentSemanticStates.get(component);
    const internal = componentInternalStates.get(component);
    if (!semantic || !internal) throw new TypeError('Invalid Runtime Component checkpoint target.');
    const semanticState = Object.create(null);
    Object.keys(semantic).forEach(field => {
        semanticState[field] = cloneSerializable(semantic[field]);
    });
    return Object.freeze({
        graph: componentGraphs.get(component) || null,
        internal: Object.freeze({
            createInvoked: Boolean(internal.createInvoked),
            providerResources: Array.from(internal.providerResources.entries()),
            readyInvoked: Boolean(internal.readyInvoked)
        }),
        ownerId: componentOwnerIds.get(component) || null,
        semanticState: Object.freeze(semanticState)
    });
};

const restoreRuntimeComponentSemanticCheckpoint = (component, checkpoint, graph) => {
    if (!checkpoint || checkpoint.graph !== graph) {
        const error = new Error('Runtime Component checkpoint restoration requires the original Graph authority.');
        error.code = 'RUNTIME_COMPONENT_CHECKPOINT_AUTHORITY_REQUIRED';
        throw error;
    }
    const semantic = componentSemanticStates.get(component);
    const internal = componentInternalStates.get(component);
    if (!semantic || !internal) throw new TypeError('Invalid Runtime Component checkpoint target.');
    Object.keys(semantic).forEach(field => {
        if (!Object.prototype.hasOwnProperty.call(checkpoint.semanticState, field)) delete semantic[field];
    });
    Object.keys(checkpoint.semanticState).forEach(field => {
        const value = cloneSerializable(checkpoint.semanticState[field]);
        semantic[field] = RUNTIME_COMPONENT_GUARDED_CHECKPOINT_FIELDS.has(field) ?
            createGuardedComponentValue(
                component,
                field,
                value,
                field === 'data' ? cloneComponentDataAssignedValue : cloneSerializable
            ) : value;
    });
    componentOwnerIds.set(component, checkpoint.ownerId || null);
    componentGraphs.set(component, graph);
    internal.createInvoked = Boolean(checkpoint.internal.createInvoked);
    internal.readyInvoked = Boolean(checkpoint.internal.readyInvoked);
    internal.providerResources.clear();
    checkpoint.internal.providerResources.forEach(([key, value]) => internal.providerResources.set(key, value));
    return component;
};

const captureRuntimeComponentContainerCheckpoint = container => Object.freeze({
    components: Array.from(componentContainerComponents.get(container).entries()),
    graph: componentContainerGraphs.get(container) || null,
    owner: componentContainerOwners.get(container) || null
});

const restoreRuntimeComponentContainerCheckpoint = (container, checkpoint, graph) => {
    if (!checkpoint || checkpoint.graph !== graph) {
        const error = new Error('Runtime Component Container checkpoint restoration requires the original Graph authority.');
        error.code = 'RUNTIME_COMPONENT_CHECKPOINT_AUTHORITY_REQUIRED';
        throw error;
    }
    componentContainerOwners.set(container, checkpoint.owner || null);
    componentContainerGraphs.set(container, graph);
    const components = componentContainerComponents.get(container);
    components.clear();
    checkpoint.components.forEach(([componentId, component]) => components.set(componentId, component));
    return container;
};

module.exports = {
    RuntimeComponent,
    RuntimeComponentContainer
};


Object.defineProperties(module.exports, {
    captureRuntimeComponentContainerCheckpoint: {value: captureRuntimeComponentContainerCheckpoint},
    captureRuntimeComponentSemanticCheckpoint: {value: captureRuntimeComponentSemanticCheckpoint},
    addRuntimeComponentToContainer: {value: addRuntimeComponentToContainer},
    destroyAllRuntimeComponents: {value: destroyAllRuntimeComponents},
    patchRuntimeComponentData: {value: patchRuntimeComponentData},
    readyAllRuntimeComponents: {value: readyAllRuntimeComponents},
    removeRuntimeComponentFromContainer: {value: removeRuntimeComponentFromContainer},
    restoreRuntimeComponentContainerCheckpoint: {value: restoreRuntimeComponentContainerCheckpoint},
    restoreRuntimeComponentSemanticCheckpoint: {value: restoreRuntimeComponentSemanticCheckpoint},
    replaceRuntimeComponentContainerGraphBinding: {value: replaceRuntimeComponentContainerGraphBinding},
    replaceRuntimeComponentGraphBinding: {value: replaceRuntimeComponentGraphBinding},
    setAllRuntimeComponentsActive: {value: setAllRuntimeComponentsActive},
    setRuntimeComponentData: {value: setRuntimeComponentData},
    setRuntimeComponentEnabled: {value: setRuntimeComponentEnabled}
});
