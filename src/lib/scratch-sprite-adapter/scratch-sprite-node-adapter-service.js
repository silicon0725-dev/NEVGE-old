const {NODE_FAMILIES, NODE_SCOPES} = require('../runtime-nodes/constants');
const {validatePersistentData} = require('../persistence/persistent-data');
const {cloneSerializable} = require('../runtime-nodes/serializable');
const {assertRuntimeNodeMutationResult} = require('../runtime-nodes/runtime-node-model-service');
const {FRAME_PROFILER_CATEGORY, getFrameTimeProfiler} = require('../frame-profiler');
const {
    RUNTIME_PHASE_IDS,
    RUNTIME_PHASE_PRIORITIES,
    getRuntimePhaseScheduler
} = require('../runtime-scheduler');
const {ScratchSpriteRuntimeNode} = require('./scratch-sprite-node');
const {
    LEGACY_SCRATCH_SPRITE_NODE_TYPE_ID,
    SCRATCH_BINDING_DESTROY_POLICIES,
    SCRATCH_BINDING_STATUSES,
    SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID,
    SCRATCH_SPRITE_ADAPTER_VERSION,
    SCRATCH_SPRITE_BINDING_SCHEMA_VERSION,
    SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY,
    SCRATCH_SPRITE_NODE_TYPE_OWNER,
    SCRATCH_TARGET_BINDING_COMPONENT_TYPE_ID,
    SCRATCH_TARGET_ROLES,
    SPRITE_NODE_TYPE_ID
} = require('./constants');
const {
    createScratchBindingComponentId,
    createScratchBindingId,
    createScratchSpriteNodeId
} = require('./id');

const getContextVM = context => {
    if (!context) return null;
    if (typeof context.getService === 'function') return context.getService('vm');
    return context.vm || null;
};

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return Object.freeze(value);
};

const normalizeString = value => (
    typeof value === 'string' && value.trim() ? value.trim() : null
);

const getScopedTargetKey = (sceneId, targetRuntimeId) => {
    const normalizedSceneId = normalizeString(sceneId);
    const normalizedTargetRuntimeId = normalizeString(targetRuntimeId);
    return normalizedSceneId && normalizedTargetRuntimeId ? `${normalizedSceneId}\u0000${normalizedTargetRuntimeId}` : null;
};

const createAdapterSourceDescriptor = record => ({
    adapterType: 'scratch.sprite',
    bindingId: record.bindingId,
    kind: 'compatibility-adapter',
    sceneId: record.sceneId
});

const getTargetName = target => {
    if (!target || typeof target !== 'object') return 'Sprite';
    if (typeof target.getName === 'function') {
        const name = normalizeString(target.getName());
        if (name) return name;
    }
    const spriteName = target.sprite && normalizeString(target.sprite.name);
    if (spriteName) return spriteName;
    return normalizeString(target.name) || 'Sprite';
};

const getTargetRuntimeId = target => normalizeString(target && target.id);

// Module services cross the NGVGE service boundary through controlled facades. Arrays exposed by
// those services deliberately retain indexed/length semantics without preserving Array identity, so
// Array.isArray(vm.runtime.targets) is false in a real browser module context. Treat Scratch targets
// as a read-only array-like collection and copy only the indexed values we need.
const readScratchRuntimeTargets = vm => {
    if (!vm || !vm.runtime) return null;
    const targets = vm.runtime.targets;
    if (!targets || typeof targets !== 'object') return null;
    if (Array.isArray(targets)) return targets;

    let length;
    try {
        length = targets.length;
    } catch {
        return null;
    }
    if (!Number.isSafeInteger(length) || length < 0) return null;

    const copied = [];
    for (let index = 0; index < length; index++) {
        try {
            copied.push(targets[index]);
        } catch {
            return null;
        }
    }
    return copied;
};

const getOriginalSpriteTargets = (vm, excludedTargetIds = new Set()) => {
    const targets = readScratchRuntimeTargets(vm) || [];
    return targets.map((target, serializedTargetIndex) => ({
        serializedTargetIndex,
        target
    })).filter(entry => (
        entry.target &&
        !entry.target.isStage &&
        entry.target.isOriginal !== false &&
        !excludedTargetIds.has(getTargetRuntimeId(entry.target))
    ));
};

const getTargetTopologySignature = (vm, excludedTargetIds = new Set()) => getOriginalSpriteTargets(vm, excludedTargetIds)
    .map(({serializedTargetIndex, target}) => [
        serializedTargetIndex,
        getTargetRuntimeId(target) || '',
        getTargetName(target)
    ].join(':'))
    .join('|');

const normalizePersistentBinding = (value, sceneId) => {
    if (!isObject(value)) return null;
    const bindingId = normalizeString(value.bindingId);
    const nodeId = normalizeString(value.nodeId);
    if (!bindingId || !nodeId) return null;
    return {
        bindingId,
        destroyPolicy: Object.values(SCRATCH_BINDING_DESTROY_POLICIES).includes(value.destroyPolicy) ?
            value.destroyPolicy : SCRATCH_BINDING_DESTROY_POLICIES.DELETE_TARGET,
        lastKnownName: normalizeString(value.lastKnownName) || 'Sprite',
        nodeId,
        role: SCRATCH_TARGET_ROLES.SPRITE,
        sceneId,
        serializedTargetIndex: Number.isInteger(value.serializedTargetIndex) && value.serializedTargetIndex >= 0 ?
            value.serializedTargetIndex : null
    };
};

const toPersistentBinding = binding => ({
    bindingId: binding.bindingId,
    destroyPolicy: binding.destroyPolicy || SCRATCH_BINDING_DESTROY_POLICIES.DELETE_TARGET,
    lastKnownName: binding.lastKnownName,
    nodeId: binding.nodeId,
    role: SCRATCH_TARGET_ROLES.SPRITE,
    serializedTargetIndex: Number.isInteger(binding.serializedTargetIndex) ? binding.serializedTargetIndex : null
});

const toBindingView = binding => {
    if (!binding) return null;
    return deepFreeze({
        bindingId: binding.bindingId,
        destroyPolicy: binding.destroyPolicy || SCRATCH_BINDING_DESTROY_POLICIES.DELETE_TARGET,
        lastKnownName: binding.lastKnownName,
        nodeId: binding.nodeId,
        role: SCRATCH_TARGET_ROLES.SPRITE,
        sceneId: binding.sceneId,
        serializedTargetIndex: binding.serializedTargetIndex,
        status: binding.status,
        targetRuntimeId: binding.targetRuntimeId || null
    });
};

const getBindingStore = project => {
    const extensionData = project && isObject(project.extensionData) ? project.extensionData : {};
    const store = extensionData[SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY];
    if (!isObject(store)) {
        return {
            scenes: {},
            schemaVersion: SCRATCH_SPRITE_BINDING_SCHEMA_VERSION
        };
    }
    return Object.assign({}, cloneSerializable(store), {
        scenes: isObject(store.scenes) ? cloneSerializable(store.scenes) : {},
        schemaVersion: Number.isInteger(store.schemaVersion) ?
            store.schemaVersion : 1
    });
};

const assertSupportedBindingStore = store => {
    if (store.schemaVersion <= SCRATCH_SPRITE_BINDING_SCHEMA_VERSION) return;
    const error = new Error(
        `Scratch sprite binding schema version ${store.schemaVersion} is newer than supported version ` +
        `${SCRATCH_SPRITE_BINDING_SCHEMA_VERSION}.`
    );
    error.code = 'SCRATCH_BINDING_VERSION_UNSUPPORTED';
    error.version = store.schemaVersion;
    throw error;
};

const validateBindingStorePersistence = (project, store = getBindingStore(project)) => {
    const issues = [];
    const persistentValidation = validatePersistentData(store);
    if (!persistentValidation.valid) {
        persistentValidation.issues.forEach(issue => issues.push(Object.assign({}, cloneSerializable(issue), {
            sourceCode: issue.code,
            code: 'SCRATCH_BINDING_PERSISTENT_DATA_INVALID'
        })));
    }
    if (!Number.isInteger(store.schemaVersion) || store.schemaVersion < 1) {
        issues.push({
            code: 'SCRATCH_BINDING_SCHEMA_VERSION_INVALID',
            message: 'Scratch binding schemaVersion must be a positive integer.',
            path: '$.schemaVersion'
        });
    }
    if (Number.isInteger(store.schemaVersion) && store.schemaVersion > SCRATCH_SPRITE_BINDING_SCHEMA_VERSION) {
        issues.push({
            code: 'SCRATCH_BINDING_VERSION_UNSUPPORTED',
            message: `Scratch binding schema version ${store.schemaVersion} is newer than supported version ${SCRATCH_SPRITE_BINDING_SCHEMA_VERSION}.`,
            path: '$.schemaVersion',
            version: store.schemaVersion
        });
    }
    const sceneIds = new Set(project && Array.isArray(project.scenes) ?
        project.scenes.map(scene => normalizeString(scene && scene.id)).filter(Boolean) : []);
    const bindingIds = new Set();
    const nodeIds = new Set();
    const scenes = isObject(store.scenes) ? store.scenes : {};
    Object.keys(scenes).forEach(sceneId => {
        if (!sceneIds.has(sceneId)) {
            issues.push({
                code: 'SCRATCH_BINDING_SCENE_ORPHANED',
                message: `Scratch bindings reference a scene that does not exist: ${sceneId}`,
                path: `$.scenes[${JSON.stringify(sceneId)}]`,
                sceneId
            });
        }
        const sceneStore = isObject(scenes[sceneId]) ? scenes[sceneId] : {};
        const items = Array.isArray(sceneStore.items) ? sceneStore.items : [];
        items.forEach((item, index) => {
            const path = `$.scenes[${JSON.stringify(sceneId)}].items[${index}]`;
            if (isObject(item) && Object.prototype.hasOwnProperty.call(item, 'targetRuntimeId')) {
                issues.push({
                    code: 'SCRATCH_BINDING_VOLATILE_TARGET_ID_PERSISTED',
                    message: 'Scratch target runtime IDs are volatile and cannot be persisted.',
                    path: `${path}.targetRuntimeId`,
                    sceneId
                });
            }
            const normalized = normalizePersistentBinding(item, sceneId);
            if (!normalized) {
                issues.push({
                    code: 'SCRATCH_BINDING_RECORD_INVALID',
                    message: 'Scratch binding records require stable bindingId and nodeId values.',
                    path,
                    sceneId
                });
                return;
            }
            if (bindingIds.has(normalized.bindingId)) {
                issues.push({
                    bindingId: normalized.bindingId,
                    code: 'SCRATCH_BINDING_ID_DUPLICATE',
                    message: `Duplicate persistent Scratch binding id: ${normalized.bindingId}`,
                    path: `${path}.bindingId`,
                    sceneId
                });
            }
            if (nodeIds.has(normalized.nodeId)) {
                issues.push({
                    code: 'SCRATCH_BINDING_NODE_DUPLICATE',
                    message: `A Runtime Node is owned by more than one persistent Scratch binding: ${normalized.nodeId}`,
                    nodeId: normalized.nodeId,
                    path: `${path}.nodeId`,
                    sceneId
                });
            }
            bindingIds.add(normalized.bindingId);
            nodeIds.add(normalized.nodeId);
        });
    });
    return deepFreeze({issues, valid: issues.length === 0});
};

const getScenePersistentBindings = (project, sceneId, warnings) => {
    const store = getBindingStore(project);
    assertSupportedBindingStore(store);
    const sceneStore = isObject(store.scenes[sceneId]) ? store.scenes[sceneId] : {};
    const source = Array.isArray(sceneStore.items) ? sceneStore.items : [];
    const bindingIds = new Set();
    const nodeIds = new Set();
    const result = [];
    source.forEach((item, index) => {
        const normalized = normalizePersistentBinding(item, sceneId);
        if (!normalized) {
            warnings.push({
                code: 'SCRATCH_BINDING_RECORD_INVALID',
                index,
                sceneId
            });
            return;
        }
        if (bindingIds.has(normalized.bindingId)) {
            warnings.push({
                bindingId: normalized.bindingId,
                code: 'SCRATCH_BINDING_ID_DUPLICATE',
                sceneId
            });
            return;
        }
        if (nodeIds.has(normalized.nodeId)) {
            warnings.push({
                code: 'SCRATCH_BINDING_NODE_DUPLICATE',
                nodeId: normalized.nodeId,
                sceneId
            });
            return;
        }
        bindingIds.add(normalized.bindingId);
        nodeIds.add(normalized.nodeId);
        result.push(normalized);
    });
    return result;
};

const createScratchSpriteNodeAdapterService = (
    context,
    sceneDataModel,
    runtimeNodeModel,
    options = {}
) => {
    if (!sceneDataModel || typeof sceneDataModel.readProject !== 'function') {
        throw new TypeError('Scratch sprite adapter requires the scene data model capability.');
    }
    if (!runtimeNodeModel || typeof runtimeNodeModel.createNode !== 'function') {
        throw new TypeError('Scratch sprite adapter requires the runtime node model capability.');
    }
    const nodeTypeRegistration = options.nodeTypeRegistration || null;
    const persistenceController = options.persistenceController || null;
    if (!nodeTypeRegistration || typeof nodeTypeRegistration.registerNodeTypeDescriptor !== 'function' ||
        typeof nodeTypeRegistration.bindNodeTypeProvider !== 'function') {
        throw new TypeError('Scratch sprite adapter requires the Runtime Node Type Registration capability.');
    }
    if (!persistenceController || typeof persistenceController.importState !== 'function') {
        throw new TypeError('Scratch sprite adapter requires the Runtime Node Persistence Controller.');
    }

    const bindingIdFactory = options.bindingIdFactory || createScratchBindingId;
    const sceneRuntime = options.sceneRuntime || null;
    const nodeIdFactory = options.nodeIdFactory || createScratchSpriteNodeId;
    const componentIdFactory = options.componentIdFactory || createScratchBindingComponentId;
    const listeners = new Set();
    const bindingsByNodeId = new Map();
    const bindingsByBindingId = new Map();
    const bindingsByScopedTargetId = new Map();
    const targetByScopedRuntimeId = new Map();
    const adapterDestroyingNodeIds = new Set();
    const deletingTargetRuntimeIds = new Set();
    let disposed = false;
    let lastError = null;
    let warnings = [];
    let revision = 0;
    let tracking = false;
    let reconcileInFlight = null;
    let reconcilePending = null;
    let reconcileGeneration = 0;
    let reconcileTimer = null;
    let lastActiveSceneId = null;
    let sceneTransition = null;
    let deferredTransitionReconcile = null;
    let pruningOrphanedStores = false;
    let lastTargetTopologySignature = null;
    let topologySignalCount = 0;
    let topologyNoopSignalCount = 0;
    let topologyScheduledCheckCount = 0;
    let topologyCoalescedSignalCount = 0;
    let topologyCheckPending = false;
    const vmForDiagnostics = getContextVM(context);
    const frameProfiler = vmForDiagnostics && vmForDiagnostics.runtime ? getFrameTimeProfiler(vmForDiagnostics.runtime) : null;
    const phaseScheduler = options.phaseScheduler || (vmForDiagnostics && vmForDiagnostics.runtime ?
        getRuntimePhaseScheduler(vmForDiagnostics.runtime) : null);
    const lifecycleUnsubscribers = [];

    nodeTypeRegistration.registerNodeTypeDescriptor({
        abstract: false,
        allowChildren: true,
        allowedScopes: [NODE_SCOPES.SCENE],
        category: 'Compatibility',
        defaultScope: NODE_SCOPES.SCENE,
        family: NODE_FAMILIES.NODE_2D,
        hidden: true,
        label: 'Legacy Scratch Sprite',
        order: -1,
        ownerModuleId: SCRATCH_SPRITE_NODE_TYPE_OWNER,
        schema: null,
        typeId: LEGACY_SCRATCH_SPRITE_NODE_TYPE_ID,
        version: '1'
    });
    const unbindLegacyNodeTypeProvider = nodeTypeRegistration.bindNodeTypeProvider(
        LEGACY_SCRATCH_SPRITE_NODE_TYPE_ID,
        {ctor: ScratchSpriteRuntimeNode}
    );
    const unregisterLegacyNodeType = () => {
        unbindLegacyNodeTypeProvider();
        return nodeTypeRegistration.unregisterNodeTypeDescriptor(LEGACY_SCRATCH_SPRITE_NODE_TYPE_ID);
    };

    const applyRuntimeNodeMutation = result => assertRuntimeNodeMutationResult(result);

    const assertAvailable = () => {
        if (!disposed) return;
        const error = new Error('Scratch sprite node adapter has been disposed.');
        error.code = 'SCRATCH_SPRITE_ADAPTER_DISPOSED';
        throw error;
    };

    const emit = change => {
        revision += 1;
        const payload = deepFreeze(Object.assign({revision}, cloneSerializable(change)));
        listeners.forEach(listener => listener(payload));
        return payload;
    };

    const clearIndexes = () => {
        bindingsByNodeId.clear();
        bindingsByBindingId.clear();
        bindingsByScopedTargetId.clear();
        targetByScopedRuntimeId.clear();
    };

    const indexBinding = (binding, target = null) => {
        if (bindingsByNodeId.has(binding.nodeId)) {
            const error = new Error(`Scratch binding already uses runtime node: ${binding.nodeId}`);
            error.code = 'SCRATCH_BINDING_NODE_CONFLICT';
            throw error;
        }
        if (bindingsByBindingId.has(binding.bindingId)) {
            const error = new Error(`Scratch binding id already exists: ${binding.bindingId}`);
            error.code = 'SCRATCH_BINDING_ID_CONFLICT';
            throw error;
        }
        const scopedTargetKey = getScopedTargetKey(binding.sceneId, binding.targetRuntimeId);
        if (scopedTargetKey && bindingsByScopedTargetId.has(scopedTargetKey)) {
            const error = new Error(`Scratch target is already bound: ${binding.targetRuntimeId}`);
            error.code = 'SCRATCH_TARGET_ALREADY_BOUND';
            throw error;
        }
        bindingsByNodeId.set(binding.nodeId, binding);
        bindingsByBindingId.set(binding.bindingId, binding);
        if (scopedTargetKey) {
            bindingsByScopedTargetId.set(scopedTargetKey, binding);
            if (target) targetByScopedRuntimeId.set(scopedTargetKey, target);
        }
    };

    const getRuntimeNodeBindings = sceneId => {
        const nodes = runtimeNodeModel.listNodes({includeRoots: false, sceneId});
        const result = [];
        const bindingIds = new Set();
        nodes.forEach(node => {
            const component = node.components.find(candidate => (
                candidate.typeId === SCRATCH_TARGET_BINDING_COMPONENT_TYPE_ID
            ));
            if (!component) return;
            const componentData = isObject(component.data) ? component.data : {};
            const bindingId = normalizeString(componentData.bindingId);
            if (!bindingId || bindingIds.has(bindingId)) {
                if (bindingId) warnings.push({
                    bindingId,
                    code: 'SCRATCH_RUNTIME_BINDING_DUPLICATE',
                    nodeId: node.id,
                    sceneId
                });
                return;
            }
            if (node.typeId !== SPRITE_NODE_TYPE_ID && node.typeId !== LEGACY_SCRATCH_SPRITE_NODE_TYPE_ID) {
                warnings.push({
                    bindingId,
                    code: 'SCRATCH_BINDING_SEMANTIC_NODE_TYPE_INVALID',
                    nodeId: node.id,
                    sceneId
                });
                return;
            }
            bindingIds.add(bindingId);
            result.push({
                bindingId,
                destroyPolicy: Object.values(SCRATCH_BINDING_DESTROY_POLICIES).includes(componentData.destroyPolicy) ?
                    componentData.destroyPolicy : SCRATCH_BINDING_DESTROY_POLICIES.DELETE_TARGET,
                lastKnownName: normalizeString(componentData.lastKnownName) || node.name,
                nodeId: node.id,
                role: SCRATCH_TARGET_ROLES.SPRITE,
                sceneId,
                serializedTargetIndex: Number.isInteger(componentData.serializedTargetIndex) ?
                    componentData.serializedTargetIndex : null
            });
        });
        return result;
    };

    const mergePersistentAndRuntimeBindings = (project, sceneId) => {
        const persistent = getScenePersistentBindings(project, sceneId, warnings);
        const runtime = getRuntimeNodeBindings(sceneId);
        const byBindingId = new Map();
        persistent.forEach(binding => byBindingId.set(binding.bindingId, binding));
        runtime.forEach(binding => {
            const existing = byBindingId.get(binding.bindingId);
            byBindingId.set(binding.bindingId, existing ? Object.assign({}, existing, {
                lastKnownName: binding.lastKnownName || existing.lastKnownName,
                nodeId: binding.nodeId,
                serializedTargetIndex: Number.isInteger(existing.serializedTargetIndex) ?
                    existing.serializedTargetIndex : binding.serializedTargetIndex
            }) : binding);
        });
        return Array.from(byBindingId.values());
    };

    const migrateLegacyRuntimeNodes = () => {
        const snapshot = runtimeNodeModel.exportState();
        const legacyNodeIds = [];
        const nextNodes = snapshot.nodes.map(record => {
            if (!record || record.typeId !== LEGACY_SCRATCH_SPRITE_NODE_TYPE_ID) return record;
            const components = Array.isArray(record.components) ? record.components : [];
            const bindingComponent = components.find(component => (
                component && component.typeId === SCRATCH_TARGET_BINDING_COMPONENT_TYPE_ID
            ));
            const bindingId = normalizeString(bindingComponent && bindingComponent.data && bindingComponent.data.bindingId) ||
                normalizeString(record.source && record.source.bindingId);
            if (!bindingId) return record;
            legacyNodeIds.push(record.id);
            return Object.assign({}, record, {
                metadata: Object.assign({}, record.metadata, {
                    adapterManaged: true,
                    adapterType: 'scratch.sprite',
                    semanticType: 'sprite'
                }),
                source: createAdapterSourceDescriptor({
                    bindingId,
                    sceneId: record.sceneId
                }),
                typeId: SPRITE_NODE_TYPE_ID
            });
        });
        if (!legacyNodeIds.length) return Object.freeze([]);
        applyRuntimeNodeMutation(persistenceController.importState(Object.assign({}, snapshot, {nodes: nextNodes}), {
            transactionId: 'scratch-adapter:migrate-legacy-node-type'
        }));
        emit({
            migratedNodeIds: legacyNodeIds,
            type: 'adapter:legacy-node-migrated'
        });
        return Object.freeze(legacyNodeIds.slice());
    };

    const writePersistentBindings = (sceneId, bindings) => {
        const project = sceneDataModel.readProject();
        const extensionData = isObject(project.extensionData) ? cloneSerializable(project.extensionData) : {};
        const store = getBindingStore(project);
        assertSupportedBindingStore(store);
        const nextStore = Object.assign({}, store, {
            scenes: Object.assign({}, store.scenes),
            schemaVersion: SCRATCH_SPRITE_BINDING_SCHEMA_VERSION
        });
        nextStore.scenes[sceneId] = {
            items: bindings.map(toPersistentBinding)
                .sort((first, second) => (
                    (first.serializedTargetIndex === null ? Number.MAX_SAFE_INTEGER : first.serializedTargetIndex) -
                    (second.serializedTargetIndex === null ? Number.MAX_SAFE_INTEGER : second.serializedTargetIndex) ||
                    first.bindingId.localeCompare(second.bindingId)
                ))
        };
        const validation = validateBindingStorePersistence(project, nextStore);
        if (!validation.valid) {
            const error = new Error(`Invalid Scratch binding persistence state: ${validation.issues[0].message}`);
            error.code = 'SCRATCH_BINDING_PERSISTENCE_INVALID';
            error.validation = validation;
            throw error;
        }
        const previousJSON = JSON.stringify(extensionData[SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY] || null);
        const nextJSON = JSON.stringify(nextStore);
        if (previousJSON === nextJSON) return false;
        extensionData[SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY] = nextStore;
        project.extensionData = extensionData;
        sceneDataModel.writeProject(project);
        return true;
    };

    const pruneOrphanedBindingScenes = project => {
        const extensionData = project && isObject(project.extensionData) ? project.extensionData : {};
        if (!isObject(extensionData[SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY])) return false;
        const store = getBindingStore(project);
        assertSupportedBindingStore(store);
        const sceneIds = new Set((Array.isArray(project.scenes) ? project.scenes : [])
            .map(scene => normalizeString(scene && scene.id))
            .filter(Boolean));
        const orphanedSceneIds = Object.keys(store.scenes).filter(sceneId => !sceneIds.has(sceneId));
        if (!orphanedSceneIds.length) return false;
        const nextStore = Object.assign({}, store, {
            scenes: Object.assign({}, store.scenes),
            schemaVersion: SCRATCH_SPRITE_BINDING_SCHEMA_VERSION
        });
        orphanedSceneIds.forEach(sceneId => delete nextStore.scenes[sceneId]);
        const nextProject = cloneSerializable(project);
        nextProject.extensionData = Object.assign({}, nextProject.extensionData, {
            [SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY]: nextStore
        });
        sceneDataModel.writeProject(nextProject);
        emit({orphanedSceneIds, type: 'adapter:persistence-pruned'});
        return true;
    };

    const ensureRuntimeNode = (record, targetName) => {
        const source = createAdapterSourceDescriptor(record);
        const componentData = {
            adapterType: 'scratch.sprite',
            bindingId: record.bindingId,
            destroyPolicy: record.destroyPolicy || SCRATCH_BINDING_DESTROY_POLICIES.DELETE_TARGET,
            lastKnownName: targetName,
            role: SCRATCH_TARGET_ROLES.SPRITE,
            sceneId: record.sceneId,
            schemaVersion: SCRATCH_SPRITE_BINDING_SCHEMA_VERSION,
            serializedTargetIndex: record.serializedTargetIndex
        };
        let node = runtimeNodeModel.getNodeSnapshot(record.nodeId);
        if (!node) {
            node = applyRuntimeNodeMutation(runtimeNodeModel.createNode(SPRITE_NODE_TYPE_ID, {
                components: [{
                    data: componentData,
                    id: componentIdFactory(),
                    typeId: SCRATCH_TARGET_BINDING_COMPONENT_TYPE_ID
                }],
                id: record.nodeId,
                metadata: {
                    adapterManaged: true,
                    adapterType: 'scratch.sprite',
                    semanticType: 'sprite'
                },
                name: targetName,
                sceneId: record.sceneId,
                source
            }));
            return node;
        }
        if (node.sceneId !== record.sceneId) {
            const error = new Error(`Scratch sprite node belongs to another scene: ${record.nodeId}`);
            error.code = 'SCRATCH_BINDING_SCENE_CONFLICT';
            throw error;
        }
        if (node.typeId !== SPRITE_NODE_TYPE_ID) {
            const error = new Error(`Runtime node is not a semantic Sprite node: ${record.nodeId}`);
            error.code = 'SCRATCH_BINDING_NODE_TYPE_CONFLICT';
            throw error;
        }
        if (node.name !== targetName || JSON.stringify(node.source) !== JSON.stringify(source)) {
            applyRuntimeNodeMutation(runtimeNodeModel.patchNode(node.id, {name: targetName, source}));
            node = runtimeNodeModel.getNodeSnapshot(node.id);
        }
        if (!node.metadata || node.metadata.adapterType !== 'scratch.sprite' ||
            node.metadata.semanticType !== 'sprite' || node.metadata.adapterManaged !== true) {
            applyRuntimeNodeMutation(runtimeNodeModel.patchNodeMetadata(node.id, {
                adapterManaged: true,
                adapterType: 'scratch.sprite',
                semanticType: 'sprite'
            }));
            node = runtimeNodeModel.getNodeSnapshot(node.id);
        }
        const component = node.components.find(candidate => (
            candidate.typeId === SCRATCH_TARGET_BINDING_COMPONENT_TYPE_ID
        ));
        if (!component) {
            applyRuntimeNodeMutation(runtimeNodeModel.addComponent(node.id, {
                data: componentData,
                id: componentIdFactory(),
                typeId: SCRATCH_TARGET_BINDING_COMPONENT_TYPE_ID
            }));
        } else if (JSON.stringify(component.data) !== JSON.stringify(componentData)) {
            applyRuntimeNodeMutation(runtimeNodeModel.setComponentData(node.id, component.id, componentData));
        }
        return runtimeNodeModel.getNodeSnapshot(node.id);
    };

    const selectRecordForTarget = (records, usedBindingIds, targetName, serializedTargetIndex) => {
        const available = records.filter(record => !usedBindingIds.has(record.bindingId));
        const exactIndex = available.find(record => (
            record.serializedTargetIndex === serializedTargetIndex && record.lastKnownName === targetName
        ));
        if (exactIndex) return exactIndex;
        const sameName = available.filter(record => record.lastKnownName === targetName);
        if (sameName.length === 1) return sameName[0];
        return available.find(record => record.serializedTargetIndex === serializedTargetIndex) || null;
    };

    const replaceIndexes = (bindings, targetsById) => {
        clearIndexes();
        bindings.forEach(binding => {
            const target = binding.targetRuntimeId ? targetsById.get(binding.targetRuntimeId) || null : null;
            indexBinding(binding, target);
        });
    };

    const synchronizeSceneRootSpriteOrder = (sceneId, bindings) => {
        if (!runtimeNodeModel || typeof runtimeNodeModel.getSceneRoot !== 'function' ||
            typeof runtimeNodeModel.getChildren !== 'function' || typeof runtimeNodeModel.reorderChild !== 'function') {
            return false;
        }
        const root = runtimeNodeModel.getSceneRoot(sceneId);
        if (!root) return false;
        const orderedBindingNodeIds = bindings
            .filter(binding => binding && binding.status === SCRATCH_BINDING_STATUSES.BOUND && binding.targetRuntimeId)
            .slice()
            .sort((a, b) => {
                const left = Number.isInteger(a.serializedTargetIndex) ? a.serializedTargetIndex : Number.MAX_SAFE_INTEGER;
                const right = Number.isInteger(b.serializedTargetIndex) ? b.serializedTargetIndex : Number.MAX_SAFE_INTEGER;
                return left - right;
            })
            .map(binding => binding.nodeId)
            .filter(nodeId => {
                const node = runtimeNodeModel.getNodeSnapshot(nodeId);
                return node && node.parentId === root.id;
            });
        if (orderedBindingNodeIds.length < 2) return false;

        const currentChildren = runtimeNodeModel.getChildren(root.id).map(node => node.id);
        const boundSet = new Set(orderedBindingNodeIds);
        const boundSlots = currentChildren
            .map((nodeId, index) => ({index, nodeId}))
            .filter(entry => boundSet.has(entry.nodeId))
            .map(entry => entry.index);
        if (boundSlots.length !== orderedBindingNodeIds.length) return false;
        const desiredChildren = currentChildren.slice();
        boundSlots.forEach((slot, index) => {
            desiredChildren[slot] = orderedBindingNodeIds[index];
        });
        if (desiredChildren.every((nodeId, index) => nodeId === currentChildren[index])) return false;

        desiredChildren.forEach((nodeId, desiredIndex) => {
            const latestChildren = runtimeNodeModel.getChildren(root.id).map(node => node.id);
            const currentIndex = latestChildren.indexOf(nodeId);
            if (currentIndex !== desiredIndex) {
                applyRuntimeNodeMutation(runtimeNodeModel.reorderChild(nodeId, desiredIndex, {
                    transactionId: `scratch-adapter:role-order:${sceneId}:${nodeId}`
                }));
            }
        });
        return true;
    };

    const rebuildProjectBindingIndexes = (project, liveBindings = [], targetsById = new Map()) => {
        const result = [];
        const offlineBindings = [];
        const bindingIds = new Set();
        const nodeIds = new Set();
        const liveSceneIds = new Set();
        const addBinding = binding => {
            if (!binding || bindingIds.has(binding.bindingId) || nodeIds.has(binding.nodeId)) {
                warnings.push({
                    bindingId: binding && binding.bindingId,
                    code: 'SCRATCH_BINDING_PROJECT_CONFLICT',
                    nodeId: binding && binding.nodeId,
                    sceneId: binding && binding.sceneId
                });
                return false;
            }
            bindingIds.add(binding.bindingId);
            nodeIds.add(binding.nodeId);
            result.push(binding);
            return true;
        };

        liveBindings.forEach(binding => {
            if (addBinding(binding)) liveSceneIds.add(binding.sceneId);
        });

        const scenes = project && Array.isArray(project.scenes) ? project.scenes : [];
        scenes.forEach(scene => {
            if (!scene || !normalizeString(scene.id) || liveSceneIds.has(scene.id)) return;
            mergePersistentAndRuntimeBindings(project, scene.id).forEach(record => {
                if (bindingIds.has(record.bindingId) || nodeIds.has(record.nodeId)) {
                    warnings.push({
                        bindingId: record.bindingId,
                        code: 'SCRATCH_BINDING_PROJECT_CONFLICT',
                        nodeId: record.nodeId,
                        sceneId: scene.id
                    });
                    return;
                }
                ensureRuntimeNode(record, record.lastKnownName);
                const offlineBinding = Object.assign({}, record, {
                    sceneId: scene.id,
                    status: SCRATCH_BINDING_STATUSES.OFFLINE,
                    targetRuntimeId: null
                });
                if (addBinding(offlineBinding)) offlineBindings.push(offlineBinding);
            });
        });

        replaceIndexes(result, targetsById);
        return offlineBindings;
    };

    const destroyBindingNode = binding => {
        if (!binding || !runtimeNodeModel.getNodeSnapshot(binding.nodeId)) return false;
        adapterDestroyingNodeIds.add(binding.nodeId);
        try {
            applyRuntimeNodeMutation(runtimeNodeModel.destroyNode(binding.nodeId, {
                transactionId: `scratch-adapter:destroy:${binding.bindingId}`
            }));
        } finally {
            adapterDestroyingNodeIds.delete(binding.nodeId);
        }
        return true;
    };

    const removeBindingFromIndexes = binding => {
        if (!binding) return;
        bindingsByNodeId.delete(binding.nodeId);
        bindingsByBindingId.delete(binding.bindingId);
        const scopedTargetKey = getScopedTargetKey(binding.sceneId, binding.targetRuntimeId);
        if (scopedTargetKey) {
            bindingsByScopedTargetId.delete(scopedTargetKey);
            targetByScopedRuntimeId.delete(scopedTargetKey);
        }
    };

    const removePersistentBinding = binding => {
        const remainingBindings = Array.from(bindingsByNodeId.values()).filter(candidate => (
            candidate.sceneId === binding.sceneId && candidate.bindingId !== binding.bindingId
        ));
        return writePersistentBindings(binding.sceneId, remainingBindings);
    };

    const releaseTargetDeleteGuard = targetRuntimeId => {
        if (!targetRuntimeId) return;
        setTimeout(() => deletingTargetRuntimeIds.delete(targetRuntimeId), 0);
    };

    const destroyOwnedBinding = async (binding, destroyOptions = {}) => {
        assertAvailable();
        if (!binding) return false;
        const reason = normalizeString(destroyOptions.reason) || 'binding-owner-destroyed';
        const targetRuntimeId = binding.targetRuntimeId || null;
        const deleteTarget = destroyOptions.deleteTarget !== false &&
            binding.destroyPolicy === SCRATCH_BINDING_DESTROY_POLICIES.DELETE_TARGET &&
            Boolean(targetRuntimeId);
        const vm = getContextVM(context);

        if (deleteTarget) {
            deletingTargetRuntimeIds.add(targetRuntimeId);
            if (vm && typeof vm.deleteSprite === 'function') {
                try {
                    await Promise.resolve(vm.deleteSprite(targetRuntimeId));
                } catch (error) {
                    deletingTargetRuntimeIds.delete(targetRuntimeId);
                    const normalizedError = error instanceof Error ? error : new Error(String(error));
                    normalizedError.code = normalizedError.code || 'SCRATCH_BINDING_TARGET_DELETE_FAILED';
                    throw normalizedError;
                }
            } else {
                warnings.push({
                    bindingId: binding.bindingId,
                    code: 'SCRATCH_BINDING_TARGET_DELETE_UNAVAILABLE',
                    nodeId: binding.nodeId,
                    sceneId: binding.sceneId,
                    targetRuntimeId
                });
            }
        }

        removePersistentBinding(binding);
        removeBindingFromIndexes(binding);
        if (!destroyOptions.nodeAlreadyDestroyed) destroyBindingNode(binding);
        const change = emit({
            bindingId: binding.bindingId,
            nodeId: binding.nodeId,
            reason,
            sceneId: binding.sceneId,
            targetDeleted: deleteTarget,
            targetRuntimeId,
            type: 'adapter:binding-destroyed'
        });
        releaseTargetDeleteGuard(targetRuntimeId);
        scheduleReconcile('binding-destroyed', {
            delay: 0,
            preserveMissing: false,
            sceneId: binding.sceneId
        });
        return change;
    };

    const reconcileSceneInternal = (sceneId = null, reconcileOptions = {}) => {
        assertAvailable();
        const project = sceneDataModel.readProject();
        const activeSceneId = sceneId || project.activeSceneId;
        if (!normalizeString(activeSceneId)) {
            const error = new Error('Scratch sprite bindings require an active scene.');
            error.code = 'SCRATCH_BINDING_ACTIVE_SCENE_REQUIRED';
            throw error;
        }
        const reason = normalizeString(reconcileOptions.reason) || 'manual';
        const transactionId = normalizeString(reconcileOptions.transactionId);
        const vm = getContextVM(context);
        const sceneIsActive = project.activeSceneId === activeSceneId;
        const generation = reconcileOptions.generation || reconcileGeneration;
        const previousBindings = Array.from(bindingsByNodeId.values())
            .filter(binding => binding.sceneId === activeSceneId);
        const previousTargetIds = new Set(previousBindings
            .map(binding => binding.targetRuntimeId)
            .filter(Boolean));
        const graphSnapshot = runtimeNodeModel.exportState();
        const previousStore = cloneSerializable(getBindingStore(project));

        const runtimeTargets = readScratchRuntimeTargets(vm);
        if (!vm || !vm.runtime || !runtimeTargets || !sceneIsActive) {
            const liveBindings = !sceneIsActive && project.activeSceneId ?
                Array.from(bindingsByNodeId.values()).filter(binding => binding.sceneId === project.activeSceneId) : [];
            const liveTargetsById = new Map();
            liveBindings.forEach(binding => {
                const scopedTargetKey = getScopedTargetKey(binding.sceneId, binding.targetRuntimeId);
                if (scopedTargetKey && targetByScopedRuntimeId.has(scopedTargetKey)) {
                    liveTargetsById.set(binding.targetRuntimeId, targetByScopedRuntimeId.get(scopedTargetKey));
                }
            });
            const offlineBindings = rebuildProjectBindingIndexes(project, liveBindings, liveTargetsById);
            lastError = null;
            const change = emit({
                bindingRevision: revision + 1,
                createdNodeIds: [],
                missingNodeIds: [],
                offlineNodeIds: offlineBindings.map(binding => binding.nodeId),
                reason,
                reboundNodeIds: [],
                removedNodeIds: [],
                sceneId: activeSceneId,
                transactionId,
                type: 'adapter:reconcile'
            });
            const sceneBindings = Array.from(bindingsByNodeId.values())
                .filter(binding => binding.sceneId === activeSceneId)
                .map(toBindingView);
            return deepFreeze({bindings: sceneBindings, change});
        }

        warnings = [];
        const usedBindingIds = new Set();
        const nextBindings = [];
        const createdNodeIds = [];
        const reboundNodeIds = [];
        const missingNodeIds = [];
        const removedNodeIds = [];
        const targetsById = new Map();
        const targetEntries = getOriginalSpriteTargets(vm, deletingTargetRuntimeIds);
        targetEntries.forEach(({target}) => {
            const targetRuntimeId = getTargetRuntimeId(target);
            if (targetRuntimeId) targetsById.set(targetRuntimeId, target);
        });

        try {
            const records = mergePersistentAndRuntimeBindings(project, activeSceneId);
            targetEntries.forEach(({serializedTargetIndex, target}) => {
                const targetName = getTargetName(target);
                const targetRuntimeId = getTargetRuntimeId(target);
                let record = selectRecordForTarget(records, usedBindingIds, targetName, serializedTargetIndex);
                const wasExisting = Boolean(record);
                if (!record) {
                    record = {
                        bindingId: bindingIdFactory(),
                        destroyPolicy: SCRATCH_BINDING_DESTROY_POLICIES.DELETE_TARGET,
                        lastKnownName: targetName,
                        nodeId: nodeIdFactory(),
                        role: SCRATCH_TARGET_ROLES.SPRITE,
                        sceneId: activeSceneId,
                        serializedTargetIndex
                    };
                    records.push(record);
                }
                usedBindingIds.add(record.bindingId);
                const canonical = Object.assign({}, record, {
                    lastKnownName: targetName,
                    sceneId: activeSceneId,
                    serializedTargetIndex,
                    status: SCRATCH_BINDING_STATUSES.BOUND,
                    targetRuntimeId
                });
                const nodeBefore = runtimeNodeModel.getNodeSnapshot(canonical.nodeId);
                ensureRuntimeNode(canonical, targetName);
                if (!nodeBefore) createdNodeIds.push(canonical.nodeId);
                const oldBinding = bindingsByBindingId.get(canonical.bindingId);
                if (wasExisting && oldBinding && oldBinding.targetRuntimeId !== targetRuntimeId) {
                    reboundNodeIds.push(canonical.nodeId);
                }
                nextBindings.push(canonical);
            });

            records.filter(record => !usedBindingIds.has(record.bindingId)).forEach(record => {
                const node = runtimeNodeModel.getNodeSnapshot(record.nodeId);
                if (!node) return;
                const explicitDelete = reason === 'targets-update' &&
                    sceneIsActive &&
                    previousTargetIds.size > 0 &&
                    !reconcileOptions.preserveMissing;
                if (explicitDelete) {
                    destroyBindingNode(record);
                    removedNodeIds.push(record.nodeId);
                    return;
                }
                const missing = Object.assign({}, record, {
                    sceneId: activeSceneId,
                    status: SCRATCH_BINDING_STATUSES.MISSING,
                    targetRuntimeId: null
                });
                missingNodeIds.push(record.nodeId);
                nextBindings.push(missing);
            });

            if (generation !== reconcileGeneration || disposed) {
                const stale = new Error('Scratch sprite reconcile result is stale.');
                stale.code = 'SCRATCH_RECONCILE_STALE';
                throw stale;
            }

            synchronizeSceneRootSpriteOrder(activeSceneId, nextBindings);
            lastActiveSceneId = activeSceneId;
            writePersistentBindings(activeSceneId, nextBindings);
            const offlineBindings = rebuildProjectBindingIndexes(
                sceneDataModel.readProject(),
                nextBindings,
                targetsById
            );
            lastError = null;
            const change = emit({
                bindingRevision: revision + 1,
                createdNodeIds,
                missingNodeIds,
                offlineNodeIds: offlineBindings.map(binding => binding.nodeId),
                reason,
                reboundNodeIds,
                removedNodeIds,
                sceneId: activeSceneId,
                transactionId,
                type: 'adapter:reconcile',
                warningCount: warnings.length
            });
            return deepFreeze({bindings: nextBindings.map(toBindingView), change});
        } catch (error) {
            try {
                applyRuntimeNodeMutation(persistenceController.importState(
                    graphSnapshot,
                    {transactionId: transactionId || 'scratch-adapter:rollback'}
                ));
                const rollbackProject = sceneDataModel.readProject();
                const extensionData = isObject(rollbackProject.extensionData) ? cloneSerializable(rollbackProject.extensionData) : {};
                extensionData[SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY] = previousStore;
                rollbackProject.extensionData = extensionData;
                sceneDataModel.writeProject(rollbackProject);
            } catch {
                // Preserve the original reconciliation error.
            }
            lastError = error && error.message ? error.message : String(error);
            emit({error: lastError, reason, sceneId: activeSceneId, transactionId, type: 'bindings:error'});
            throw error;
        }
    };

    const reconcileScene = (sceneId = null, reconcileOptions = {}) => {
        assertAvailable();
        const generation = ++reconcileGeneration;
        const run = () => reconcileSceneInternal(sceneId, Object.assign({}, reconcileOptions, {generation}));
        const result = frameProfiler ? frameProfiler.measure(FRAME_PROFILER_CATEGORY.SCRATCH_BINDING_LIFECYCLE, run) : run();
        try {
            lastTargetTopologySignature = getTargetTopologySignature(getContextVM(context), deletingTargetRuntimeIds);
        } catch {
            lastTargetTopologySignature = null;
        }
        return result;
    };

    const reconcileActiveScene = reconcileOptions => reconcileScene(null, reconcileOptions || {});

    const runScheduledReconcile = () => {
        reconcileTimer = null;
        if (disposed || !reconcilePending) return;
        const pending = reconcilePending;
        reconcilePending = null;
        const run = () => Promise.resolve().then(() => reconcileScene(pending.sceneId, pending.options));
        reconcileInFlight = (reconcileInFlight || Promise.resolve()).then(run, run).finally(() => {
            reconcileInFlight = null;
            if (reconcilePending && !disposed) runScheduledReconcile();
        });
    };

    const scheduleReconcile = (reason = 'scheduled', scheduleOptions = {}) => {
        assertAvailable();
        if (sceneTransition && scheduleOptions.allowDuringTransition !== true) {
            deferredTransitionReconcile = {
                options: Object.assign({}, scheduleOptions, {reason}),
                reason,
                sceneId: scheduleOptions.sceneId || sceneTransition.toSceneId || null
            };
            return reconcileInFlight;
        }
        reconcilePending = {
            options: Object.assign({}, scheduleOptions, {reason}),
            sceneId: scheduleOptions.sceneId || null
        };
        if (reconcileTimer !== null) return reconcileInFlight;
        const delay = Number.isFinite(scheduleOptions.delay) ? Math.max(0, scheduleOptions.delay) : 0;
        reconcileTimer = setTimeout(runScheduledReconcile, delay);
        return reconcileInFlight;
    };

    const beginSceneTransition = change => {
        const project = sceneDataModel.readProject();
        sceneTransition = {
            fromSceneId: normalizeString(change && change.fromSceneId) || project.activeSceneId || lastActiveSceneId,
            toSceneId: normalizeString(change && change.sceneId),
            type: change && change.type ? change.type : 'before-load'
        };
        deferredTransitionReconcile = null;
        lastTargetTopologySignature = null;
        reconcileGeneration += 1;
        if (reconcileTimer !== null) {
            clearTimeout(reconcileTimer);
            reconcileTimer = null;
        }
        reconcilePending = null;
        const offlineBindings = rebuildProjectBindingIndexes(project, [], new Map());
        emit({
            fromSceneId: sceneTransition.fromSceneId,
            offlineNodeIds: offlineBindings.map(binding => binding.nodeId),
            sceneId: sceneTransition.toSceneId,
            type: 'adapter:transition-start'
        });
    };

    const finishSceneTransition = (change, failed = false) => {
        const transition = sceneTransition;
        sceneTransition = null;
        const deferred = deferredTransitionReconcile;
        deferredTransitionReconcile = null;
        const project = sceneDataModel.readProject();
        const sceneId = failed ? project.activeSceneId : (
            normalizeString(change && change.sceneId) ||
            (transition && transition.toSceneId) ||
            project.activeSceneId
        );
        if (!sceneId) return;
        scheduleReconcile(failed ? 'scene-load-error' : 'scene-loaded', {
            allowDuringTransition: true,
            delay: 0,
            preserveMissing: true,
            sceneId,
            transactionId: deferred && deferred.options && deferred.options.transactionId
        });
    };

    const addRuntimeListener = (emitter, eventName, handler) => {
        if (!emitter || typeof emitter.on !== 'function') return;
        emitter.on(eventName, handler);
        lifecycleUnsubscribers.push(() => {
            if (typeof emitter.off === 'function') emitter.off(eventName, handler);
            else if (typeof emitter.removeListener === 'function') emitter.removeListener(eventName, handler);
        });
    };

    const startLifecycleTracking = () => {
        assertAvailable();
        if (tracking) return false;
        tracking = true;
        const vm = getContextVM(context);
        const runtime = vm && vm.runtime;
        if (lastTargetTopologySignature === null) {
            try { lastTargetTopologySignature = getTargetTopologySignature(vm, deletingTargetRuntimeIds); } catch { /* retry on signal */ }
        }
        const checkTargetTopology = () => {
            topologyCheckPending = false;
            let signature = null;
            try { signature = getTargetTopologySignature(vm, deletingTargetRuntimeIds); } catch { /* fall through to reconcile */ }
            if (signature !== null && signature === lastTargetTopologySignature) {
                topologyNoopSignalCount += 1;
                return reconcileInFlight;
            }
            lastTargetTopologySignature = signature;
            return scheduleReconcile('targets-update', {delay: 0});
        };
        const scheduleTargetsUpdate = () => {
            topologySignalCount += 1;
            if (topologyCheckPending) topologyCoalescedSignalCount += 1;
            else topologyScheduledCheckCount += 1;
            topologyCheckPending = true;
            if (phaseScheduler) {
                phaseScheduler.schedule(
                    RUNTIME_PHASE_IDS.SCRATCH_BINDING_LIFECYCLE,
                    checkTargetTopology,
                    {priority: RUNTIME_PHASE_PRIORITIES.SCRATCH_BINDING_LIFECYCLE}
                );
                return reconcileInFlight;
            }
            setTimeout(checkTargetTopology, 0);
            return reconcileInFlight;
        };
        addRuntimeListener(runtime, 'TARGETS_UPDATE', scheduleTargetsUpdate);
        // Scratch GUI exposes the public VM event as `targetsUpdate`, while some
        // VM builds also emit the runtime-level `TARGETS_UPDATE`. Listening to
        // both is safe because scheduleReconcile coalesces the same event turn.
        addRuntimeListener(vm, 'targetsUpdate', scheduleTargetsUpdate);
        addRuntimeListener(runtime, 'PROJECT_LOADED', () => scheduleReconcile('project-loaded', {
            delay: 0,
            preserveMissing: true
        }));
        if (runtimeNodeModel && typeof runtimeNodeModel.subscribe === 'function') {
            const unsubscribeRuntimeNodes = runtimeNodeModel.subscribe(change => {
                if (!change || change.type !== 'node:destroy' || adapterDestroyingNodeIds.has(change.nodeId)) return;
                const binding = bindingsByNodeId.get(change.nodeId);
                if (!binding) return;
                Promise.resolve(destroyOwnedBinding(binding, {
                    nodeAlreadyDestroyed: true,
                    reason: 'runtime-node-destroyed'
                })).catch(error => {
                    lastError = error && error.message ? error.message : String(error);
                    emit({
                        bindingId: binding.bindingId,
                        error: lastError,
                        nodeId: binding.nodeId,
                        sceneId: binding.sceneId,
                        type: 'bindings:error'
                    });
                });
            });
            lifecycleUnsubscribers.push(unsubscribeRuntimeNodes);
        }
        if (sceneRuntime && typeof sceneRuntime.subscribe === 'function') {
            const unsubscribeRuntime = sceneRuntime.subscribe(change => {
                if (!change) return;
                try {
                    if (change.type === 'before-load' || change.type === 'before-reload') {
                        beginSceneTransition(change);
                        return;
                    }
                    if (change.type === 'loaded' || change.type === 'reloaded') {
                        finishSceneTransition(change, false);
                        return;
                    }
                    if (change.type === 'load-error' || change.type === 'reload-error') {
                        finishSceneTransition(change, true);
                    }
                } catch (error) {
                    lastError = error && error.message ? error.message : String(error);
                    emit({error: lastError, type: 'bindings:error'});
                }
            });
            lifecycleUnsubscribers.push(unsubscribeRuntime);
        }
        if (sceneDataModel && typeof sceneDataModel.subscribe === 'function') {
            const unsubscribe = sceneDataModel.subscribe(change => {
                if (!change || change.type !== 'data') return;
                const project = sceneDataModel.readProject();
                if (!pruningOrphanedStores) {
                    pruningOrphanedStores = true;
                    try {
                        if (pruneOrphanedBindingScenes(project)) return;
                    } finally {
                        pruningOrphanedStores = false;
                    }
                }
                if (project.activeSceneId !== lastActiveSceneId) {
                    scheduleReconcile('scene-change', {delay: 0, preserveMissing: true});
                }
            });
            lifecycleUnsubscribers.push(unsubscribe);
        }
        scheduleReconcile('tracking-start', {delay: 0, preserveMissing: true});
        return true;
    };

    const stopLifecycleTracking = () => {
        if (!tracking) return false;
        tracking = false;
        lifecycleUnsubscribers.splice(0).forEach(unsubscribe => {
            try { unsubscribe(); } catch { /* noop */ }
        });
        if (reconcileTimer !== null) {
            clearTimeout(reconcileTimer);
            reconcileTimer = null;
        }
        reconcilePending = null;
        topologyCheckPending = false;
        sceneTransition = null;
        deferredTransitionReconcile = null;
        return true;
    };

    const establishBindings = sceneId => reconcileScene(sceneId, {
        preserveMissing: true,
        reason: 'establish-bindings'
    }).bindings;

    try {
        migrateLegacyRuntimeNodes();
        establishBindings();
        startLifecycleTracking();
    } catch {
        // Keep the capability available in an error state so projects can be inspected and repaired.
    }

    return Object.freeze({
        capabilityId: SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID,
        version: SCRATCH_SPRITE_ADAPTER_VERSION,
        dispose: () => {
            if (disposed) return;
            stopLifecycleTracking();
            disposed = true;
            reconcileGeneration += 1;
            clearIndexes();
            listeners.clear();
            unregisterLegacyNodeType();
        },
        destroyBindingByNodeId: (nodeId, destroyOptions = {}) => {
            assertAvailable();
            return destroyOwnedBinding(bindingsByNodeId.get(nodeId) || null, destroyOptions);
        },
        establishBindings,
        getBinding: (sceneId, bindingId) => {
            assertAvailable();
            const binding = bindingsByBindingId.get(bindingId) || null;
            return toBindingView(binding && binding.sceneId === sceneId ? binding : null);
        },
        reconcileActiveScene,
        reconcileScene,
        scheduleReconcile,
        startLifecycleTracking,
        stopLifecycleTracking,
        getBindingByBindingId: bindingId => {
            assertAvailable();
            return toBindingView(bindingsByBindingId.get(bindingId) || null);
        },
        getBindingByNodeId: (nodeId, sceneId = null) => {
            assertAvailable();
            const binding = bindingsByNodeId.get(nodeId) || null;
            return toBindingView(binding && (!sceneId || binding.sceneId === sceneId) ? binding : null);
        },
        getBindingByTargetRuntimeId: (targetRuntimeId, sceneId = null) => {
            assertAvailable();
            const project = sceneDataModel.readProject();
            const resolvedSceneId = sceneId || project.activeSceneId;
            const scopedTargetKey = getScopedTargetKey(resolvedSceneId, targetRuntimeId);
            return toBindingView(scopedTargetKey ? bindingsByScopedTargetId.get(scopedTargetKey) || null : null);
        },
        getStatus: () => {
            assertAvailable();
            const bindings = Array.from(bindingsByNodeId.values());
            return deepFreeze({
                bindingCount: bindings.length,
                boundCount: bindings.filter(binding => binding.status === SCRATCH_BINDING_STATUSES.BOUND).length,
                error: lastError,
                missingCount: bindings.filter(binding => binding.status === SCRATCH_BINDING_STATUSES.MISSING).length,
                offlineCount: bindings.filter(binding => binding.status === SCRATCH_BINDING_STATUSES.OFFLINE).length,
                reconciling: Boolean(reconcileInFlight || reconcilePending || sceneTransition),
                tracking,
                topologyCoalescedSignalCount,
                topologyNoopSignalCount,
                topologyScheduledCheckCount,
                topologySignalCount,
                transition: sceneTransition ? cloneSerializable(sceneTransition) : null,
                revision,
                schemaVersion: SCRATCH_SPRITE_BINDING_SCHEMA_VERSION,
                warningCount: warnings.length,
                warnings: cloneSerializable(warnings)
            });
        },
        validatePersistentBindings: () => {
            assertAvailable();
            const project = sceneDataModel.readProject();
            return validateBindingStorePersistence(project);
        },
        listBindings: sceneId => {
            assertAvailable();
            return Object.freeze(Array.from(bindingsByNodeId.values())
                .filter(binding => !sceneId || binding.sceneId === sceneId)
                .map(toBindingView));
        },
        subscribe: listener => {
            assertAvailable();
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    });
};

module.exports = {
    assertSupportedBindingStore,
    createScratchSpriteNodeAdapterService,
    deepFreeze,
    getOriginalSpriteTargets,
    getTargetName,
    getTargetRuntimeId,
    normalizePersistentBinding,
    validateBindingStorePersistence,
    toBindingView,
    toPersistentBinding
};
