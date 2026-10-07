'use strict';

const {
    TRANSFORM2D_COMPONENT_OWNER,
    TRANSFORM2D_SCHEMA_VERSION,
    TRANSFORM2D_TYPE_ID,
    normalizeTransform2D,
    normalizeTransform2DPatch
} = require('../../core/transform2d');
const {
    assertRuntimeNodeMutationResult
} = require('../runtime-nodes/runtime-node-model-service');
const {COMPONENT_CARDINALITIES} = require('../runtime-nodes/runtime-component-contract');

const TRANSFORM2D_RUNTIME_CAPABILITY_ID = 'ngvge.transform2d-runtime';

const TRANSFORM2D_RUNTIME_COMPONENT_DESCRIPTOR = Object.freeze({
    cardinality: COMPONENT_CARDINALITIES.ONE,
    ownerModuleId: TRANSFORM2D_COMPONENT_OWNER,
    schemaVersion: TRANSFORM2D_SCHEMA_VERSION,
    typeId: TRANSFORM2D_TYPE_ID
});

const TRANSFORM2D_RUNTIME_CONTRACT = Object.freeze({
    capabilityId: TRANSFORM2D_RUNTIME_CAPABILITY_ID,
    component: Object.freeze({
        cardinality: COMPONENT_CARDINALITIES.ONE,
        persistentDataAuthority: 'runtime-component-record.data',
        schemaVersion: TRANSFORM2D_SCHEMA_VERSION,
        typeId: TRANSFORM2D_TYPE_ID
    }),
    contractId: 'ngvge.transform2d-runtime-wiring',
    contractVersion: '1',
    ownership: Object.freeze({
        semanticOwnerKey: 'NodeId',
        scratchTargetIsOwner: false
    }),
    separation: Object.freeze({
        bootstrapDirection: 'persistent-to-runtime',
        persistentMutationRequiredForRuntimeWrite: false,
        runtimeStateStoredInComponentData: false,
        runtimeWritesTouchProjectSource: false
    })
});

const COMPONENT_OPTION_FIELDS = new Set(['componentId', 'data', 'enabled']);
const runtimeStoreStates = new WeakMap();

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return Object.freeze(value);
};

const cloneSerializable = value => {
    if (value === null || typeof value === 'undefined') return value;
    return JSON.parse(JSON.stringify(value));
};

const assertNodeId = nodeId => {
    const normalized = typeof nodeId === 'string' ? nodeId.trim() : '';
    if (!normalized) {
        const error = new TypeError('Transform2D Runtime Store requires a non-empty semantic NodeId.');
        error.code = 'NGVGE_TRANSFORM2D_RUNTIME_NODE_ID_INVALID';
        throw error;
    }
    return normalized;
};

const registerTransform2DRuntimeComponent = componentTypeRegistry => {
    if (!componentTypeRegistry || typeof componentTypeRegistry.register !== 'function' ||
        typeof componentTypeRegistry.get !== 'function') {
        throw new TypeError('Transform2D Runtime Component registration requires a Runtime Component Type Registry.');
    }
    const existing = componentTypeRegistry.get(TRANSFORM2D_TYPE_ID);
    if (!existing) return componentTypeRegistry.register(TRANSFORM2D_RUNTIME_COMPONENT_DESCRIPTOR);

    const isExact = existing.cardinality === TRANSFORM2D_RUNTIME_COMPONENT_DESCRIPTOR.cardinality &&
        existing.ownerModuleId === TRANSFORM2D_RUNTIME_COMPONENT_DESCRIPTOR.ownerModuleId &&
        existing.schemaVersion === TRANSFORM2D_RUNTIME_COMPONENT_DESCRIPTOR.schemaVersion;
    const isImplicit = typeof componentTypeRegistry.isImplicit === 'function' &&
        componentTypeRegistry.isImplicit(TRANSFORM2D_TYPE_ID);
    if (isExact && !isImplicit) return existing;

    return componentTypeRegistry.register(TRANSFORM2D_RUNTIME_COMPONENT_DESCRIPTOR, {replace: true});
};

const createTransform2DComponentOptions = (options = {}) => {
    const source = options && typeof options === 'object' && !Array.isArray(options) ? options : {};
    const unsupported = Object.keys(source).filter(key => !COMPONENT_OPTION_FIELDS.has(key));
    if (unsupported.length) {
        const error = new TypeError(`Transform2D component creation contains unsupported fields: ${unsupported.join(', ')}`);
        error.code = 'NGVGE_TRANSFORM2D_COMPONENT_OPTION_FORBIDDEN';
        error.fields = unsupported;
        throw error;
    }
    const result = {
        data: normalizeTransform2D(source.data),
        enabled: source.enabled !== false,
        schemaVersion: TRANSFORM2D_SCHEMA_VERSION,
        typeId: TRANSFORM2D_TYPE_ID
    };
    if (typeof source.componentId !== 'undefined') {
        if (typeof source.componentId !== 'string' || !source.componentId.trim()) {
            const error = new TypeError('Transform2D componentId must be a non-empty string when supplied.');
            error.code = 'NGVGE_TRANSFORM2D_COMPONENT_ID_INVALID';
            throw error;
        }
        result.id = source.componentId.trim();
    }
    return result;
};

const createPersistentRecordFromComponentView = component => deepFreeze({
    allowMultiple: Boolean(component.allowMultiple),
    data: cloneSerializable(component.data),
    enabled: component.enabled !== false,
    id: component.id,
    schemaVersion: component.schemaVersion,
    typeId: component.typeId
});

const wrapComponentView = component => {
    if (!component) return null;
    if (typeof component.toPersistentRecord === 'function') return component;
    return Object.freeze(Object.assign({}, component, {
        toPersistentRecord: () => createPersistentRecordFromComponentView(component)
    }));
};

const wrapNodeView = node => {
    if (!node) return null;
    if (typeof node.getComponent === 'function') return node;
    const components = Array.isArray(node.components) ? node.components : [];
    return Object.freeze(Object.assign({}, node, {
        getComponent: typeId => wrapComponentView(components.find(component => component && component.typeId === typeId) || null)
    }));
};

const createRuntimeNodeModelGraphFacade = (runtimeNodeModel, typeRegistration) => {
    if (!runtimeNodeModel || typeof runtimeNodeModel.getNodeSnapshot !== 'function' ||
        typeof runtimeNodeModel.listNodes !== 'function' || typeof runtimeNodeModel.subscribe !== 'function' ||
        typeof runtimeNodeModel.addComponent !== 'function' || typeof runtimeNodeModel.setComponentData !== 'function') {
        const error = new TypeError('Transform2D Runtime Store requires a Runtime Node Model capability.');
        error.code = 'NGVGE_TRANSFORM2D_RUNTIME_MODEL_REQUIRED';
        throw error;
    }
    if (!typeRegistration || typeof typeRegistration.getComponentTypeDescriptor !== 'function' ||
        typeof typeRegistration.registerComponentTypeDescriptor !== 'function') {
        const error = new TypeError('Transform2D Runtime Store requires Runtime Node Type Registration capability.');
        error.code = 'NGVGE_TRANSFORM2D_RUNTIME_TYPE_REGISTRATION_REQUIRED';
        throw error;
    }

    const componentTypeRegistry = Object.freeze({
        get: typeId => typeRegistration.getComponentTypeDescriptor(typeId),
        isImplicit: () => false,
        register: (descriptor, registrationOptions = {}) => typeRegistration.registerComponentTypeDescriptor(
            descriptor,
            registrationOptions
        )
    });

    return Object.freeze({
        componentTypeRegistry,
        addComponent: (nodeId, component) => wrapComponentView(assertRuntimeNodeMutationResult(
            runtimeNodeModel.addComponent(nodeId, component, {
                transactionId: `transform2d:component:add:${nodeId}`
            })
        )),
        getNode: nodeId => wrapNodeView(runtimeNodeModel.getNodeSnapshot(nodeId)),
        listNodes: options => runtimeNodeModel.listNodes(options).map(wrapNodeView),
        setComponentData: (nodeId, componentId, data, mutationOptions = {}) => wrapComponentView(
            assertRuntimeNodeMutationResult(runtimeNodeModel.setComponentData(nodeId, componentId, data, {
                transactionId: mutationOptions.transactionId || `transform2d:component:commit:${nodeId}`
            }))
        ),
        subscribe: listener => runtimeNodeModel.subscribe(listener)
    });
};

const assertRuntimeNodeSource = source => {
    if (!source || typeof source.getNode !== 'function' || typeof source.listNodes !== 'function' ||
        typeof source.subscribe !== 'function' || typeof source.addComponent !== 'function' ||
        typeof source.setComponentData !== 'function' || !source.componentTypeRegistry) {
        const error = new TypeError('Transform2D Runtime Store requires a RuntimeNodeGraph-compatible source.');
        error.code = 'NGVGE_TRANSFORM2D_RUNTIME_GRAPH_REQUIRED';
        throw error;
    }
    return source;
};

const createMutableRuntimeEntry = (nodeId, componentId, transform, revision = 0) => ({
    componentId,
    nodeId,
    revision,
    rotation: transform.rotation,
    scaleX: transform.scale[0],
    scaleY: transform.scale[1],
    x: transform.position[0],
    y: transform.position[1]
});

const runtimeTransformFromEntry = entry => normalizeTransform2D({
    position: [entry.x, entry.y],
    rotation: entry.rotation,
    scale: [entry.scaleX, entry.scaleY]
});

const createRuntimeSnapshot = entry => deepFreeze({
    componentId: entry.componentId,
    nodeId: entry.nodeId,
    revision: entry.revision,
    transform: runtimeTransformFromEntry(entry)
});

const transformsEqual = (first, second) => (
    first.position[0] === second.position[0] &&
    first.position[1] === second.position[1] &&
    first.rotation === second.rotation &&
    first.scale[0] === second.scale[0] &&
    first.scale[1] === second.scale[1]
);

class Transform2DRuntimeStore {
    constructor (graph, options = {}) {
        const normalizedGraph = assertRuntimeNodeSource(graph);
        registerTransform2DRuntimeComponent(normalizedGraph.componentTypeRegistry);
        const state = {
            entries: new Map(),
            graph: normalizedGraph,
            listenerErrorCount: 0,
            listeners: new Set(),
            revision: 0,
            unsubscribeGraph: null
        };
        runtimeStoreStates.set(this, state);
        state.unsubscribeGraph = normalizedGraph.subscribe(change => this._handleGraphChange(change));
        if (options.hydrate !== false) this.hydrateAllFromPersistent();
        Object.seal(this);
    }

    _state () {
        const state = runtimeStoreStates.get(this);
        if (!state) throw new Error('Transform2D Runtime Store is not initialized.');
        return state;
    }

    _emit (change) {
        const state = this._state();
        state.revision += 1;
        const payload = Object.freeze(Object.assign({revision: state.revision}, change));
        state.listeners.forEach(listener => {
            try {
                listener(payload);
            } catch (error) {
                state.listenerErrorCount += 1;
            }
        });
        return payload;
    }

    _getNodeAndComponent (nodeId, required = true) {
        const state = this._state();
        const normalizedNodeId = assertNodeId(nodeId);
        const node = wrapNodeView(state.graph.getNode(normalizedNodeId));
        if (!node) {
            if (!required) return {component: null, node: null, nodeId: normalizedNodeId};
            const error = new Error(`Unknown semantic Runtime Node for Transform2D: ${normalizedNodeId}`);
            error.code = 'NGVGE_TRANSFORM2D_RUNTIME_NODE_NOT_FOUND';
            error.nodeId = normalizedNodeId;
            throw error;
        }
        const component = node.getComponent(TRANSFORM2D_TYPE_ID);
        if (!component && required) {
            const error = new Error(`Runtime Node does not own a Transform2D component: ${normalizedNodeId}`);
            error.code = 'NGVGE_TRANSFORM2D_COMPONENT_NOT_FOUND';
            error.nodeId = normalizedNodeId;
            throw error;
        }
        return {component, node, nodeId: normalizedNodeId};
    }

    _replaceRuntimeEntry (nodeId, componentId, transform, eventType) {
        const state = this._state();
        const previous = state.entries.get(nodeId) || null;
        const nextRevision = previous ? previous.revision + 1 : 1;
        const entry = createMutableRuntimeEntry(nodeId, componentId, transform, nextRevision);
        state.entries.set(nodeId, entry);
        this._emit({
            componentId,
            nodeId,
            runtimeRevision: nextRevision,
            type: eventType
        });
        return createRuntimeSnapshot(entry);
    }

    _handleGraphChange (change) {
        if (!change || typeof change !== 'object') return;
        const state = this._state();
        if (change.type === 'runtime:replaced') {
            state.entries.clear();
            this.hydrateAllFromPersistent();
            this._emit({componentId: null, nodeId: null, type: 'runtime:rehydrated'});
            return;
        }
        if (change.type === 'node:destroy' && typeof change.nodeId === 'string') {
            if (state.entries.delete(change.nodeId)) {
                this._emit({componentId: null, nodeId: change.nodeId, type: 'runtime:detach'});
            }
            return;
        }
        if (change.componentTypeId !== TRANSFORM2D_TYPE_ID || typeof change.nodeId !== 'string') return;
        if (change.type === 'component:remove') {
            if (state.entries.delete(change.nodeId)) {
                this._emit({componentId: change.componentId || null, nodeId: change.nodeId, type: 'runtime:detach'});
            }
            return;
        }
        if (change.type === 'component:add') {
            this.hydrateNodeFromPersistent(change.nodeId);
        }
        // component:data deliberately does not hydrate automatically. Persistent data is a
        // project-source snapshot, not the high-frequency Runtime Writer. Call
        // hydrateNodeFromPersistent() explicitly when a bootstrap/commit boundary requires it.
    }

    ensureTransformComponent (nodeId, options = {}) {
        const state = this._state();
        const normalizedNodeId = assertNodeId(nodeId);
        const node = wrapNodeView(state.graph.getNode(normalizedNodeId));
        if (!node) {
            const error = new Error(`Unknown semantic Runtime Node for Transform2D: ${normalizedNodeId}`);
            error.code = 'NGVGE_TRANSFORM2D_RUNTIME_NODE_NOT_FOUND';
            throw error;
        }
        const existing = node.getComponent(TRANSFORM2D_TYPE_ID);
        if (existing) {
            if (!state.entries.has(normalizedNodeId)) this.hydrateNodeFromPersistent(normalizedNodeId);
            return existing;
        }
        const component = wrapComponentView(state.graph.addComponent(
            normalizedNodeId,
            createTransform2DComponentOptions(options)
        ));
        if (!state.entries.has(normalizedNodeId)) this.hydrateNodeFromPersistent(normalizedNodeId);
        return component;
    }

    hydrateNodeFromPersistent (nodeId) {
        const {component, nodeId: normalizedNodeId} = this._getNodeAndComponent(nodeId, false);
        if (!component) {
            this._state().entries.delete(normalizedNodeId);
            return null;
        }
        const transform = normalizeTransform2D(component.data);
        return this._replaceRuntimeEntry(normalizedNodeId, component.id, transform, 'runtime:hydrate');
    }

    hydrateAllFromPersistent () {
        const state = this._state();
        let count = 0;
        state.graph.listNodes({includeRoots: false}).forEach(nodeSource => {
            const node = wrapNodeView(nodeSource);
            if (!node) return;
            const component = node.getComponent(TRANSFORM2D_TYPE_ID);
            if (!component) return;
            this.hydrateNodeFromPersistent(node.id);
            count += 1;
        });
        return count;
    }

    getPersistentTransform (nodeId) {
        const {component} = this._getNodeAndComponent(nodeId);
        return normalizeTransform2D(component.data);
    }

    getPersistentComponentRecord (nodeId) {
        const {component} = this._getNodeAndComponent(nodeId);
        return deepFreeze(component.toPersistentRecord());
    }

    getRuntimeTransform (nodeId) {
        const normalizedNodeId = assertNodeId(nodeId);
        const entry = this._state().entries.get(normalizedNodeId);
        return entry ? runtimeTransformFromEntry(entry) : null;
    }

    getRuntimeSnapshot (nodeId) {
        const normalizedNodeId = assertNodeId(nodeId);
        const entry = this._state().entries.get(normalizedNodeId);
        return entry ? createRuntimeSnapshot(entry) : null;
    }

    replaceRuntimeTransform (nodeId, value) {
        const {component, nodeId: normalizedNodeId} = this._getNodeAndComponent(nodeId);
        const transform = normalizeTransform2D(value);
        const currentEntry = this._state().entries.get(normalizedNodeId);
        if (currentEntry && transformsEqual(runtimeTransformFromEntry(currentEntry), transform)) {
            return createRuntimeSnapshot(currentEntry);
        }
        return this._replaceRuntimeEntry(normalizedNodeId, component.id, transform, 'runtime:replace');
    }

    patchRuntimeTransform (nodeId, patch) {
        const {component, nodeId: normalizedNodeId} = this._getNodeAndComponent(nodeId);
        const normalizedPatch = normalizeTransform2DPatch(patch);
        const currentEntry = this._state().entries.get(normalizedNodeId);
        const current = currentEntry ? runtimeTransformFromEntry(currentEntry) : normalizeTransform2D(component.data);
        const candidate = normalizeTransform2D({
            position: Object.prototype.hasOwnProperty.call(normalizedPatch, 'position') ?
                normalizedPatch.position : current.position,
            rotation: Object.prototype.hasOwnProperty.call(normalizedPatch, 'rotation') ?
                normalizedPatch.rotation : current.rotation,
            scale: Object.prototype.hasOwnProperty.call(normalizedPatch, 'scale') ?
                normalizedPatch.scale : current.scale
        });
        if (transformsEqual(current, candidate) && currentEntry) return createRuntimeSnapshot(currentEntry);
        return this._replaceRuntimeEntry(normalizedNodeId, component.id, candidate, 'runtime:patch');
    }

    commitRuntimeToPersistent (nodeId, options = {}) {
        const state = this._state();
        const {component, nodeId: normalizedNodeId} = this._getNodeAndComponent(nodeId);
        const runtimeTransform = this.getRuntimeTransform(normalizedNodeId) || normalizeTransform2D(component.data);
        if (transformsEqual(runtimeTransform, normalizeTransform2D(component.data))) {
            return this.getPersistentComponentRecord(normalizedNodeId);
        }
        const committed = wrapComponentView(state.graph.setComponentData(
            normalizedNodeId,
            component.id,
            runtimeTransform,
            {transactionId: options.transactionId || `transform2d:runtime-commit:${normalizedNodeId}`}
        ));
        this._emit({
            componentId: component.id,
            nodeId: normalizedNodeId,
            type: 'runtime:commit'
        });
        return deepFreeze(committed.toPersistentRecord());
    }

    isRuntimeDivergedFromPersistent (nodeId) {
        const runtime = this.getRuntimeTransform(nodeId);
        if (!runtime) return false;
        return !transformsEqual(runtime, this.getPersistentTransform(nodeId));
    }

    getStatus () {
        const state = this._state();
        return Object.freeze({
            entryCount: state.entries.size,
            listenerErrorCount: state.listenerErrorCount,
            listenerCount: state.listeners.size,
            revision: state.revision
        });
    }

    subscribe (listener) {
        if (typeof listener !== 'function') return () => {};
        const listeners = this._state().listeners;
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    dispose () {
        const state = this._state();
        if (typeof state.unsubscribeGraph === 'function') state.unsubscribeGraph();
        state.unsubscribeGraph = null;
        state.entries.clear();
        state.listeners.clear();
    }
}

const createTransform2DRuntimeStore = (graph, options) => new Transform2DRuntimeStore(graph, options);

const createTransform2DRuntimeStoreForModel = (runtimeNodeModel, typeRegistration, options) => (
    new Transform2DRuntimeStore(
        createRuntimeNodeModelGraphFacade(runtimeNodeModel, typeRegistration),
        options
    )
);

const createTransform2DRuntimeCapability = store => {
    if (!store || typeof store.getRuntimeTransform !== 'function' || typeof store.subscribe !== 'function') {
        throw new TypeError('Transform2D Runtime capability requires a Transform2DRuntimeStore.');
    }
    return Object.freeze({
        capabilityId: TRANSFORM2D_RUNTIME_CAPABILITY_ID,
        version: '1',
        getPersistentTransform: nodeId => store.getPersistentTransform(nodeId),
        getRuntimeSnapshot: nodeId => store.getRuntimeSnapshot(nodeId),
        getRuntimeTransform: nodeId => store.getRuntimeTransform(nodeId),
        getStatus: () => store.getStatus(),
        isRuntimeDivergedFromPersistent: nodeId => store.isRuntimeDivergedFromPersistent(nodeId),
        subscribe: listener => store.subscribe(listener)
    });
};

module.exports = {
    TRANSFORM2D_RUNTIME_CAPABILITY_ID,
    TRANSFORM2D_RUNTIME_COMPONENT_DESCRIPTOR,
    TRANSFORM2D_RUNTIME_CONTRACT,
    Transform2DRuntimeStore,
    createRuntimeNodeModelGraphFacade,
    createTransform2DComponentOptions,
    createTransform2DRuntimeCapability,
    createTransform2DRuntimeStore,
    createTransform2DRuntimeStoreForModel,
    registerTransform2DRuntimeComponent
};
