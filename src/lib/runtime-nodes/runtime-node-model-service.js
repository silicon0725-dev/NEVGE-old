const {
    NODE_SCOPES,
    RUNTIME_NODE_LOCAL_HOST_CAPABILITY_ID,
    RUNTIME_NODE_MODEL_API_VERSION,
    RUNTIME_NODE_MODEL_CAPABILITY_ID,
    RUNTIME_NODE_MODEL_VERSION,
    RUNTIME_NODE_PERSISTENCE_CONTROLLER_CAPABILITY_ID,
    RUNTIME_NODE_SNAPSHOT_CAPABILITY_ID,
    RUNTIME_NODE_TYPE_REGISTRATION_CAPABILITY_ID
} = require('./constants');
const {
    RuntimeNodeGraph,
    createRuntimeNodeGraphSemanticCheckpoint,
    restoreRuntimeNodeGraphSemanticCheckpoint
} = require('./runtime-node-graph');
const {RUNTIME_NODE_MODEL_API_CONTRACT} = require('./runtime-node-api-contract');
const {
    RUNTIME_NODE_SNAPSHOT_CONTRACT,
    RUNTIME_NODE_SNAPSHOT_CONTRACT_ID,
    RUNTIME_NODE_SNAPSHOT_KINDS,
    RUNTIME_NODE_SNAPSHOT_VERSION,
    areRuntimeNodeRevisionTokensEqual,
    createRuntimeNodeRevisionToken,
    createRuntimeNodeSnapshotEnvelope,
    normalizeRuntimeNodeRevisionToken
} = require('./runtime-node-snapshot-contract');
const {
    normalizePublicComponentOptions,
    normalizeRuntimeComponentTypeDescriptor
} = require('./runtime-component-contract');
const {validateRuntimeNodeSnapshot} = require('./runtime-node-import');
const {cloneSerializable: cloneRuntimeSerializable} = require('./serializable');
const {clonePortableData} = require('./portable-data');
const {compareCanonicalStrings} = require('./canonical-order');

const RUNTIME_NODE_EXTENSION_DATA_KEY = 'runtimeNodeModel';
const runtimeNodeServiceHosts = new WeakMap();

const toPortableError = error => {
    if (!error) return null;
    const details = {};
    [
        'componentId', 'entityKind', 'eventType', 'hookName', 'nodeId', 'operation', 'originKind',
        'owner', 'parentId', 'phase', 'runtimeGeneration', 'sceneId', 'sequence', 'typeId', 'version',
        'componentSchemaVersion', 'descriptorSchemaVersion', 'descriptorVersion', 'fromVersion',
        'recordVersion', 'toVersion'
    ].forEach(key => {
        const value = error[key];
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
            details[key] = value;
        }
    });
    if (Array.isArray(error.errors)) details.issues = cloneSerializable(error.errors);
    return deepFreeze({
        code: typeof error.code === 'string' && error.code ? error.code : 'RUNTIME_NODE_OPERATION_FAILED',
        details,
        message: error && error.message ? error.message : String(error),
        name: error && error.name ? error.name : 'Error'
    });
};

const createMutationResult = ({applied, persisted, snapshot = null, error = null}) => deepFreeze({
    applied: Boolean(applied),
    error: toPortableError(error),
    persisted: Boolean(persisted),
    snapshot: typeof snapshot === 'undefined' ? null : snapshot
});

const assertRuntimeNodeMutationResult = result => {
    if (result && result.applied && result.persisted) return result.snapshot;
    const issue = result && result.error;
    const error = new Error(issue && issue.message ? issue.message : (
        result && result.applied ? 'Runtime node mutation was applied but could not be persisted.' :
            'Runtime node mutation was not applied.'
    ));
    error.code = issue && issue.code ? issue.code : (
        result && result.applied ? 'RUNTIME_NODE_PERSISTENCE_FAILED' : 'RUNTIME_NODE_MUTATION_FAILED'
    );
    error.mutationResult = result || null;
    throw error;
};

const cloneSerializable = value => {
    if (value === null || typeof value === 'undefined') return value;
    return JSON.parse(JSON.stringify(value));
};

const clonePortableObject = (value, fallback = {}) => {
    if (typeof value === 'undefined') return clonePortableData(fallback);
    const cloned = clonePortableData(value);
    if (!cloned || typeof cloned !== 'object' || Array.isArray(cloned)) {
        throw new TypeError('Portable Runtime Node payload must be a plain object.');
    }
    return cloned;
};

const validatePortableArguments = args => {
    const provided = Array.prototype.slice.call(args);
    while (provided.length && typeof provided[provided.length - 1] === 'undefined') provided.pop();
    clonePortableData(provided);
};

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return Object.freeze(value);
};

const toComponentView = component => {
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

const toNodeView = node => {
    if (!node) return null;
    const view = {
        activeInHierarchy: Boolean(node.activeInHierarchy),
        childIds: node.childIds.slice(),
        components: node.getComponents().map(toComponentView),
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
        view.missingProvider = node.missingProvider || node.originalTypeId;
        view.missingVersion = node.missingVersion || null;
        view.originalTypeId = node.originalTypeId;
    }
    return deepFreeze(view);
};

const toNodeTypeView = definition => {
    if (!definition) return null;
    return deepFreeze({
        abstract: Boolean(definition.abstract),
        allowChildren: definition.allowChildren !== false,
        allowedScopes: definition.allowedScopes.slice(),
        category: definition.category,
        defaultScope: definition.defaultScope,
        family: definition.family,
        hidden: Boolean(definition.hidden),
        id: definition.id,
        label: definition.label,
        order: definition.order,
        owner: definition.owner || null,
        registeredAt: definition.registeredAt || null,
        version: definition.version || null
    });
};

const createRuntimeNodeModelHost = (sceneDataModel, options = {}) => {
    if (!sceneDataModel || typeof sceneDataModel.readProject !== 'function') {
        throw new TypeError('Runtime node model requires the scene data model service.');
    }

    let status = {
        error: null,
        importErrors: [],
        persistenceReadOnly: false,
        persistenceReadOnlyReason: null,
        readOnly: false,
        storedStateVersion: null,
        unsupportedComponentSchemas: []
    };

    const readSceneProject = () => {
        try {
            const project = sceneDataModel.readProject();
            status = Object.assign({}, status, {error: null, readOnly: false});
            return project;
        } catch (error) {
            const sceneStatus = typeof sceneDataModel.getStatus === 'function' ? sceneDataModel.getStatus() : {};
            status = Object.assign({}, status, {
                error: error && error.message ? error.message : String(error),
                readOnly: Boolean(sceneStatus && sceneStatus.readOnly)
            });
            return {
                activeSceneId: null,
                extensionData: {},
                scenes: []
            };
        }
    };

    const getStoredState = project => {
        const extensionData = project && project.extensionData && typeof project.extensionData === 'object' ?
            project.extensionData : {};
        const state = extensionData[RUNTIME_NODE_EXTENSION_DATA_KEY];
        return state && typeof state === 'object' ? cloneRuntimeSerializable(state) : null;
    };

    const normalizeStoredState = (storedState, project) => {
        const scenes = Array.isArray(project.scenes) ? project.scenes.map(scene => ({
            id: scene.id,
            name: scene.name
        })) : [];
        const sceneIds = new Set(scenes.map(scene => scene.id));
        const records = storedState && Array.isArray(storedState.nodes) ? storedState.nodes : [];
        const nodes = records.filter(record => {
            if (!record || typeof record !== 'object') return true;
            if (record.scope === NODE_SCOPES.GLOBAL) return true;
            if (record.scope === NODE_SCOPES.SCENE) return sceneIds.has(record.sceneId);
            return true;
        });
        return {
            activeSceneId: project.activeSceneId || null,
            nodes: cloneRuntimeSerializable(nodes),
            scenes,
            version: storedState && Number.isInteger(storedState.version) ?
                storedState.version : RUNTIME_NODE_MODEL_VERSION
        };
    };

    const initialProject = readSceneProject();
    const lifecycleGuard = {stack: []};
    let graph = new RuntimeNodeGraph({
        activeSceneId: initialProject.activeSceneId,
        idFactory: options.idFactory,
        lifecycleGuard,
        modelMutationAuthorityRequired: true,
        componentTypeRegistry: options.componentTypeRegistry,
        scenes: initialProject.scenes,
        typeRegistry: options.typeRegistry
    });
    const typeRegistry = graph.typeRegistry;
    const graphListeners = new Set();
    let unsubscribeComponentRegistry = () => {};
    let unsubscribeGraph = () => {};
    let unsubscribeRegistry = () => {};
    let disposed = false;
    let synchronizing = false;
    let writingState = false;
    let restoringState = false;
    let lastStoredStateJSON = null;
    let lastImportResult = null;
    let currentMutationContext = null;
    let activeMutationCommit = null;
    let mutationCommitCount = 0;
    let mutationRollbackCount = 0;
    let mutationFailureCount = 0;
    let mutationPoisoned = false;
    let observerErrorCount = 0;
    let nodeTypeAuthorityEpoch = 0;
    const nodeTypeDescriptors = new Map();
    const nodeTypeProviders = new Map();
    const activeNodeTypeUnregisters = new Map();
    let initialRestoreComplete = false;
    let initialRestoreRunning = false;

    const assertAvailable = () => {
        if (!disposed) return;
        const error = new Error('Runtime node model service has been disposed.');
        error.code = 'RUNTIME_NODE_MODEL_DISPOSED';
        throw error;
    };

    const normalizeMutationContext = context => {
        if (typeof context === 'undefined' || context === null) return null;
        const portableContext = clonePortableObject(context);
        const transactionId = typeof portableContext.transactionId === 'string' && portableContext.transactionId.trim() ?
            portableContext.transactionId.trim() : null;
        return transactionId ? Object.freeze({transactionId}) : null;
    };

    const stripMutationContext = source => {
        if (!source || typeof source !== 'object') return source;
        const result = Object.assign({}, source);
        delete result.transactionId;
        return result;
    };

    const getRegistryRevisionForGraph = targetGraph => {
        const nodeRevision = targetGraph.typeRegistry && typeof targetGraph.typeRegistry.getRevision === 'function' ?
            targetGraph.typeRegistry.getRevision() : 0;
        const componentRevision = targetGraph.componentTypeRegistry &&
            typeof targetGraph.componentTypeRegistry.getRevision === 'function' ?
            targetGraph.componentTypeRegistry.getRevision() : 0;
        return nodeRevision + componentRevision + nodeTypeAuthorityEpoch;
    };

    const getRevisionForGraph = targetGraph => {
        const graphStatus = targetGraph.getStatus();
        return createRuntimeNodeRevisionToken({
            graphRevision: graphStatus.revision,
            registryRevision: getRegistryRevisionForGraph(targetGraph),
            runtimeGeneration: graphStatus.runtimeGeneration
        });
    };

    const deliverGraphChange = change => {
        const graphStatus = graph.getStatus();
        const revision = createRuntimeNodeRevisionToken({
            graphRevision: change && Number.isInteger(change.revision) ? change.revision : graphStatus.revision,
            registryRevision: change && Number.isSafeInteger(change.registryRevision) ?
                change.registryRevision : getRegistryRevisionForGraph(graph),
            runtimeGeneration: change && Number.isInteger(change.runtimeGeneration) ?
                change.runtimeGeneration : graphStatus.runtimeGeneration
        });
        const normalizedChange = Object.assign({}, change, {
            graphRevision: revision.graphRevision,
            registryRevision: revision.registryRevision,
            revision: revision.graphRevision,
            revisionToken: revision,
            runtimeGeneration: revision.runtimeGeneration
        });
        const payload = deepFreeze(currentMutationContext && !normalizedChange.transactionId ?
            Object.assign({}, normalizedChange, currentMutationContext) : normalizedChange);
        graphListeners.forEach(listener => {
            try {
                if (graph && typeof graph._runObserverDispatch === 'function') {
                    graph._runObserverDispatch(payload, () => listener(payload));
                } else {
                    listener(payload);
                }
            } catch (error) {
                observerErrorCount += 1;
                // Event subscribers are observers and cannot veto or interrupt Runtime lifecycle transitions.
            }
        });
    };

    const dispatchGraphChange = change => {
        if (activeMutationCommit) {
            activeMutationCommit.events.push(cloneSerializable(change));
            return;
        }
        deliverGraphChange(change);
    };

    const flushMutationCommitEvents = commit => {
        if (!commit || !Array.isArray(commit.events)) return;
        commit.events.forEach(deliverGraphChange);
    };

    const bindGraph = nextGraph => {
        unsubscribeComponentRegistry();
        unsubscribeGraph();
        graph = nextGraph;
        unsubscribeGraph = graph.subscribe(dispatchGraphChange);
        unsubscribeComponentRegistry = typeof graph.componentTypeRegistry.subscribe === 'function' ?
            graph.componentTypeRegistry.subscribe(change => {
                if (disposed || !change) return;
                dispatchGraphChange({
                    componentRegistryChangeType: change.type,
                    fromVersion: Number.isInteger(change.fromVersion) ? change.fromVersion : null,
                    sourceRegistryRevision: change.revision,
                    toVersion: Number.isInteger(change.toVersion) ? change.toVersion : null,
                    type: 'component-registry:change',
                    typeId: change.typeId || null
                });
            }) : () => {};
    };

    bindGraph(graph);

    const setImportError = error => {
        const errors = Array.isArray(error && error.errors) ? cloneSerializable(error.errors) : [];
        const runtimeVersionUnsupported = (error && error.code === 'RUNTIME_NODE_VERSION_UNSUPPORTED') ||
            errors.some(issue => issue && issue.code === 'RUNTIME_NODE_VERSION_UNSUPPORTED');
        const unsupportedComponentSchemas = errors.filter(issue => (
            issue && issue.code === 'RUNTIME_COMPONENT_SCHEMA_VERSION_UNSUPPORTED'
        ));
        const unsupported = runtimeVersionUnsupported || unsupportedComponentSchemas.length > 0;
        const versionIssue = errors.find(issue => issue && issue.code === 'RUNTIME_NODE_VERSION_UNSUPPORTED');
        status = Object.assign({}, status, {
            error: error && error.message ? error.message : String(error),
            importErrors: errors,
            persistenceReadOnly: unsupported || status.persistenceReadOnly,
            persistenceReadOnlyReason: runtimeVersionUnsupported ? 'runtime-version' : (
                unsupportedComponentSchemas.length ? 'component-schema' : status.persistenceReadOnlyReason
            ),
            storedStateVersion: runtimeVersionUnsupported ? (
                Number.isInteger(error && error.version) ? error.version :
                    (versionIssue && Number.isInteger(versionIssue.version) ? versionIssue.version : null)
            ) : status.storedStateVersion,
            unsupportedComponentSchemas: unsupportedComponentSchemas.length ?
                unsupportedComponentSchemas : status.unsupportedComponentSchemas
        });
    };

    const clearImportError = () => {
        status = Object.assign({}, status, {
            error: null,
            importErrors: [],
            persistenceReadOnly: false,
            persistenceReadOnlyReason: null,
            storedStateVersion: null,
            unsupportedComponentSchemas: []
        });
    };

    const replaceGraphFromState = snapshot => {
        graph._assertMutationAllowed('runtime-node-model.replaceGraphFromState');
        const built = RuntimeNodeGraph.createFromState(snapshot, {
            componentTypeRegistry: graph.componentTypeRegistry,
            idFactory: options.idFactory,
            lifecycleGuard,
            modelMutationAuthorityRequired: true,
            typeRegistry
        });
        const previousGraph = graph;
        const previousRuntimeGeneration = previousGraph.getStatus().runtimeGeneration;
        bindGraph(built.graph);
        graph._beginRuntimeGeneration(previousRuntimeGeneration + 1, {
            previousRuntimeGeneration,
            reason: 'state-import'
        });
        let cleanupWarning = null;
        try {
            previousGraph.dispose();
        } catch (error) {
            cleanupWarning = {
                code: 'RUNTIME_NODE_PREVIOUS_GRAPH_CLEANUP_FAILED',
                message: error && error.message ? error.message : String(error)
            };
        }
        lastImportResult = Object.assign({}, built.result, {
            state: graph.exportState(),
            warnings: cleanupWarning ? built.result.warnings.concat([cleanupWarning]) : built.result.warnings
        });
        clearImportError();
        dispatchGraphChange({
            importedNodeCount: built.result.importedNodeCount,
            lifecycleSequence: graph.getStatus().lifecycleSequence,
            missingNodeCount: built.result.missingNodeCount,
            revision: graph.getStatus().revision,
            runtimeGeneration: graph.getStatus().runtimeGeneration,
            type: 'state:import'
        });
        return lastImportResult;
    };

    const initialStoredState = getStoredState(initialProject);
    const restoreInitialState = () => {
        assertAvailable();
        if (initialRestoreComplete) {
            return deepFreeze({
                completed: true,
                error: status.error,
                restored: Boolean(lastImportResult)
            });
        }
        if (initialRestoreRunning) {
            const error = new Error('Runtime node initial restore is already running.');
            error.code = 'RUNTIME_NODE_INITIAL_RESTORE_REENTRANT';
            throw error;
        }
        initialRestoreRunning = true;
        restoringState = true;
        try {
            if (initialStoredState) {
                replaceGraphFromState(normalizeStoredState(initialStoredState, initialProject));
                lastStoredStateJSON = JSON.stringify(initialStoredState);
            }
        } catch (error) {
            setImportError(error);
        } finally {
            restoringState = false;
            initialRestoreRunning = false;
            initialRestoreComplete = true;
        }
        return deepFreeze({
            completed: true,
            error: status.error,
            restored: Boolean(lastImportResult)
        });
    };

    if (options.deferInitialRestore !== true) restoreInitialState();

    const persistStateDetailed = () => {
        if (disposed) {
            return deepFreeze({changed: false, error: toPortableError(Object.assign(
                new Error('Runtime node model service has been disposed.'),
                {code: 'RUNTIME_NODE_MODEL_DISPOSED'}
            )), persisted: false, reason: 'disposed'});
        }
        if (writingState || restoringState) {
            return deepFreeze({changed: false, error: null, persisted: false, reason: 'busy'});
        }
        if (status.readOnly || status.persistenceReadOnly) {
            const error = new Error(status.persistenceReadOnly ?
                'Runtime node state is read-only because it contains unsupported persisted runtime data.' :
                'Scene project is read-only.');
            error.code = status.persistenceReadOnly ? 'RUNTIME_NODE_STATE_READ_ONLY' : 'SCENE_PROJECT_READ_ONLY';
            error.version = status.storedStateVersion;
            return deepFreeze({changed: false, error: toPortableError(error), persisted: false, reason: 'read-only'});
        }
        let stateJSON = null;
        try {
            const state = graph.exportState();
            validateRuntimeNodeSnapshot(state, {
                componentTypeRegistry: graph.componentTypeRegistry,
                typeRegistry
            });
            stateJSON = JSON.stringify(state);
            if (stateJSON === lastStoredStateJSON) {
                return deepFreeze({changed: false, error: null, persisted: true, reason: 'already-current'});
            }
            const project = readSceneProject();
            if (status.readOnly) {
                const error = Object.assign(new Error('Scene project is read-only.'), {code: 'SCENE_PROJECT_READ_ONLY'});
                return deepFreeze({changed: false, error: toPortableError(error), persisted: false, reason: 'read-only'});
            }
            project.extensionData = Object.assign({}, project.extensionData, {
                [RUNTIME_NODE_EXTENSION_DATA_KEY]: state
            });
            writingState = true;
            try {
                sceneDataModel.writeProject(project);
                lastStoredStateJSON = stateJSON;
            } finally {
                writingState = false;
            }
            return deepFreeze({changed: true, error: null, persisted: true, reason: 'written'});
        } catch (error) {
            writingState = false;
            // Some persistence backends can commit the data before a non-authoritative observer throws.
            // Confirm the authoritative stored Runtime Node extension before declaring the commit failed.
            try {
                const confirmedProject = sceneDataModel.readProject();
                const confirmedState = getStoredState(confirmedProject);
                if (confirmedState && JSON.stringify(confirmedState) === stateJSON) {
                    lastStoredStateJSON = stateJSON;
                    return deepFreeze({
                        changed: true,
                        error: null,
                        persisted: true,
                        reason: 'written-confirmed-after-error'
                    });
                }
            } catch (confirmationError) {
                // The original persistence error remains authoritative when confirmation is unavailable.
            }
            return deepFreeze({changed: false, error: toPortableError(error), persisted: false, reason: 'write-failed'});
        }
    };

    const persistState = () => persistStateDetailed().persisted;

    const synchronizeScenes = () => {
        if (disposed || synchronizing) return false;
        graph._assertMutationAllowed('runtime-node-model.synchronizeScenes');
        synchronizing = true;
        try {
            const project = readSceneProject();
            const storedState = getStoredState(project);
            const storedJSON = storedState ? JSON.stringify(storedState) : null;
            if (!writingState && storedState && storedJSON !== lastStoredStateJSON) {
                restoringState = true;
                try {
                    replaceGraphFromState(normalizeStoredState(storedState, project));
                    lastStoredStateJSON = storedJSON;
                } catch (error) {
                    setImportError(error);
                    return false;
                } finally {
                    restoringState = false;
                }
                return true;
            }
            if (!writingState && !storedState && lastStoredStateJSON !== null) {
                restoringState = true;
                try {
                    replaceGraphFromState(normalizeStoredState(null, project));
                    lastStoredStateJSON = null;
                } catch (error) {
                    setImportError(error);
                    return false;
                } finally {
                    restoringState = false;
                }
                return true;
            }

            const nextSceneIds = new Set(project.scenes.map(scene => scene.id));
            project.scenes.forEach(scene => graph.ensureScene(scene));
            graph.listSceneIds().forEach(sceneId => {
                if (!nextSceneIds.has(sceneId)) graph.removeScene(sceneId);
            });
            graph.setActiveScene(project.activeSceneId || null);
            persistState();
            return true;
        } finally {
            synchronizing = false;
        }
    };

    const unsubscribeSceneData = sceneDataModel.subscribe(change => {
        if (!change) return;
        if (change.type === 'data') {
            if (!writingState) synchronizeScenes();
            return;
        }
        if (change.type === 'status' && change.status) {
            status = Object.assign({}, status, {
                error: change.status.error || status.error || null,
                readOnly: Boolean(change.status.readOnly)
            });
        }
    });

    const createMutationCommitError = (persistence, fallbackMessage) => {
        const issue = persistence && persistence.error;
        const error = new Error(issue && issue.message ? issue.message : fallbackMessage);
        error.code = issue && issue.code ? issue.code : 'RUNTIME_NODE_MUTATION_COMMIT_FAILED';
        error.operation = 'runtime-node-model.commit';
        return error;
    };

    const rollbackMutationCheckpoint = (checkpoint, originalError) => {
        try {
            restoreRuntimeNodeGraphSemanticCheckpoint(graph, checkpoint);
            mutationRollbackCount += 1;
            return originalError;
        } catch (rollbackError) {
            mutationPoisoned = true;
            const error = new Error(
                `Runtime node mutation rollback failed: ${rollbackError && rollbackError.message ? rollbackError.message : String(rollbackError)}`
            );
            error.code = 'RUNTIME_NODE_MUTATION_ROLLBACK_FAILED';
            error.operation = 'runtime-node-model.rollback';
            if (originalError && originalError.code) error.originalCode = originalError.code;
            return error;
        } finally {
            if (graph && typeof graph._rollbackModelMutationHooks === 'function') graph._rollbackModelMutationHooks();
        }
    };

    const mutatePortable = (operation, mapSnapshot, mutationContext = null) => {
        assertAvailable();
        if (mutationPoisoned) {
            const error = new Error('Runtime node mutation service is read-only after a failed rollback.');
            error.code = 'RUNTIME_NODE_MUTATION_RECOVERY_REQUIRED';
            return createMutationResult({applied: false, error, persisted: false});
        }
        try {
            graph._assertMutationAllowed('runtime-node-model.mutation');
        } catch (error) {
            if (error && error.code === 'RUNTIME_LIFECYCLE_REENTRANT_MUTATION' && error.originKind === 'hook') {
                throw error;
            }
            return createMutationResult({applied: false, error, persisted: false});
        }
        if (status.persistenceReadOnly) {
            const error = new Error(
                'Runtime node state is read-only because it contains unsupported persisted runtime data.'
            );
            error.code = 'RUNTIME_NODE_STATE_READ_ONLY';
            error.version = status.storedStateVersion;
            return createMutationResult({applied: false, error, persisted: false});
        }
        const previousMutationContext = currentMutationContext;
        try {
            currentMutationContext = normalizeMutationContext(mutationContext);
        } catch (error) {
            return createMutationResult({applied: false, error, persisted: false});
        }

        let checkpoint;
        try {
            checkpoint = createRuntimeNodeGraphSemanticCheckpoint(graph);
        } catch (error) {
            currentMutationContext = previousMutationContext;
            return createMutationResult({applied: false, error, persisted: false});
        }

        const commit = {events: []};
        try {
            graph._beginModelMutationCommit();
        } catch (error) {
            currentMutationContext = previousMutationContext;
            return createMutationResult({applied: false, error, persisted: false});
        }
        activeMutationCommit = commit;
        try {
            let rawResult;
            try {
                rawResult = operation();
            } catch (error) {
                mutationFailureCount += 1;
                return createMutationResult({
                    applied: false,
                    error: rollbackMutationCheckpoint(checkpoint, error),
                    persisted: false
                });
            }

            let snapshot;
            try {
                snapshot = typeof mapSnapshot === 'function' ? mapSnapshot(rawResult) : cloneSerializable(rawResult);
            } catch (error) {
                mutationFailureCount += 1;
                return createMutationResult({
                    applied: false,
                    error: rollbackMutationCheckpoint(checkpoint, error),
                    persisted: false
                });
            }

            const persistence = persistStateDetailed();
            if (!persistence.persisted) {
                mutationFailureCount += 1;
                const commitError = createMutationCommitError(
                    persistence,
                    'Runtime node mutation could not be committed to persistent project state.'
                );
                return createMutationResult({
                    applied: false,
                    error: rollbackMutationCheckpoint(checkpoint, commitError),
                    persisted: false
                });
            }

            mutationCommitCount += 1;
            if (typeof graph._commitModelMutationHooks === 'function') graph._commitModelMutationHooks();
            activeMutationCommit = null;
            flushMutationCommitEvents(commit);
            return createMutationResult({applied: true, error: null, persisted: true, snapshot});
        } finally {
            if (activeMutationCommit === commit) {
                activeMutationCommit = null;
                if (graph && typeof graph._rollbackModelMutationHooks === 'function') graph._rollbackModelMutationHooks();
            }
            currentMutationContext = previousMutationContext;
        }
    };

    const mutateNode = (operation, mutationContext) => mutatePortable(operation, toNodeView, mutationContext);
    const mutateComponent = (operation, mutationContext) => mutatePortable(operation, toComponentView, mutationContext);

    const reifyUnknownNodes = typeId => {
        assertAvailable();
        const state = graph.exportState();
        const candidateRecords = state.nodes.filter(record => (
            (!typeId || record.typeId === typeId) && typeRegistry.has(record.typeId)
        ));
        const unknownCount = graph.getStatus().unknownNodeCount;
        if (!unknownCount || !candidateRecords.length) {
            return createMutationResult({
                applied: true,
                persisted: true,
                snapshot: deepFreeze({reifiedNodeCount: 0, success: true, typeId: typeId || null})
            });
        }
        const beforeUnknownCount = unknownCount;
        return mutatePortable(() => {
            const result = replaceGraphFromState(state);
            return Object.assign({}, cloneSerializable(result), {
                reifiedNodeCount: Math.max(0, beforeUnknownCount - graph.getStatus().unknownNodeCount),
                typeId: typeId || null
            });
        }, cloneSerializable, {transactionId: `runtime-node-type:reify:${typeId || 'all'}`});
    };

    const getNodeSnapshot = nodeId => {
        assertAvailable();
        return toNodeView(graph.getNode(nodeId));
    };

    const getComponentSnapshot = (nodeId, componentId) => {
        assertAvailable();
        const node = graph.getNode(nodeId);
        return node ? toComponentView(node.getComponentById(componentId)) : null;
    };

    const getSceneSnapshot = sceneId => {
        assertAvailable();
        const root = graph.getSceneRoot(sceneId);
        const nodes = graph.listNodes({includeRoots: false, sceneId}).map(toNodeView);
        return deepFreeze({
            active: Boolean(root.activeInHierarchy),
            nodeCount: nodes.length,
            nodes,
            root: toNodeView(root),
            sceneId: root.sceneId
        });
    };

    const normalizeNodeTypeDescriptor = descriptor => {
        const portableSource = clonePortableObject(descriptor);
        const typeId = typeof portableSource.typeId === 'string' ? portableSource.typeId.trim() : '';
        if (!typeId) throw new TypeError('Runtime node type descriptor requires typeId.');
        const label = typeof portableSource.label === 'string' ? portableSource.label.trim() : '';
        if (!label) throw new TypeError(`Runtime node type descriptor "${typeId}" requires label.`);
        const ownerModuleId = typeof portableSource.ownerModuleId === 'string' && portableSource.ownerModuleId.trim() ?
            portableSource.ownerModuleId.trim() : 'anonymous';
        const validScopes = new Set(Object.values(NODE_SCOPES));
        const allowedScopes = Array.isArray(portableSource.allowedScopes) ?
            Array.from(new Set(portableSource.allowedScopes)) : Object.values(NODE_SCOPES);
        if (!allowedScopes.length || allowedScopes.some(scope => !validScopes.has(scope))) {
            throw new TypeError(`Runtime node type descriptor "${typeId}" has invalid allowedScopes.`);
        }
        const defaultScope = allowedScopes.includes(portableSource.defaultScope) ?
            portableSource.defaultScope : allowedScopes[0];
        const version = typeof portableSource.version === 'string' && portableSource.version.trim() ?
            portableSource.version.trim() : '1';
        const portable = clonePortableData({
            abstract: portableSource.abstract === true,
            allowChildren: portableSource.allowChildren !== false,
            allowedScopes,
            category: typeof portableSource.category === 'string' && portableSource.category.trim() ?
                portableSource.category.trim() : 'Core',
            defaultScope,
            family: typeof portableSource.family === 'string' && portableSource.family.trim() ?
                portableSource.family.trim() : 'node',
            hidden: portableSource.hidden === true,
            label,
            order: Number.isFinite(portableSource.order) ? portableSource.order : 0,
            ownerModuleId,
            schema: typeof portableSource.schema === 'undefined' ? null : portableSource.schema,
            typeId,
            version
        });
        return deepFreeze(portable);
    };

    const deactivateNodeType = typeId => {
        const unregister = activeNodeTypeUnregisters.get(typeId);
        if (!unregister) return false;
        activeNodeTypeUnregisters.delete(typeId);
        return unregister();
    };

    const activateNodeType = typeId => {
        const descriptor = nodeTypeDescriptors.get(typeId);
        const provider = nodeTypeProviders.get(typeId);
        if (!descriptor || !provider) return false;
        deactivateNodeType(typeId);
        const definition = {
            abstract: descriptor.abstract,
            allowChildren: descriptor.allowChildren,
            allowedScopes: descriptor.allowedScopes,
            category: descriptor.category,
            defaultScope: descriptor.defaultScope,
            family: descriptor.family,
            hidden: descriptor.hidden,
            id: descriptor.typeId,
            label: descriptor.label,
            order: descriptor.order,
            owner: descriptor.ownerModuleId,
            version: descriptor.version
        };
        if (typeof provider.create === 'function') definition.create = provider.create;
        if (typeof provider.ctor === 'function') definition.ctor = provider.ctor;
        const unregister = typeRegistry.register(definition, {
            owner: descriptor.ownerModuleId,
            replace: provider.replace === true
        });
        activeNodeTypeUnregisters.set(typeId, unregister);
        return true;
    };

    const registerNodeTypeDescriptor = (descriptor, registrationOptions = {}) => {
        assertAvailable();
        graph._assertMutationAllowed('registerNodeTypeDescriptor');
        const normalized = normalizeNodeTypeDescriptor(descriptor);
        const existing = nodeTypeDescriptors.get(normalized.typeId) || null;
        const replace = registrationOptions.replace === true;
        if (existing && !replace) {
            const error = new Error(`Runtime node type descriptor is already registered: ${normalized.typeId}`);
            error.code = 'RUNTIME_NODE_TYPE_DESCRIPTOR_ALREADY_EXISTS';
            throw error;
        }
        if (existing && existing.ownerModuleId !== normalized.ownerModuleId) {
            const error = new Error(
                `Runtime node type descriptor "${normalized.typeId}" is owned by "${existing.ownerModuleId}".`
            );
            error.code = 'RUNTIME_NODE_TYPE_DESCRIPTOR_OWNER_MISMATCH';
            error.owner = normalized.ownerModuleId;
            error.typeId = normalized.typeId;
            throw error;
        }
        nodeTypeDescriptors.set(normalized.typeId, normalized);
        nodeTypeAuthorityEpoch += 1;
        dispatchGraphChange({
            descriptorChangeType: existing ? 'replace' : 'register',
            type: 'node-descriptor:change',
            typeId: normalized.typeId
        });
        if (registrationOptions.activate !== false) activateNodeType(normalized.typeId);
        return normalized;
    };

    const unregisterNodeTypeDescriptor = typeId => {
        assertAvailable();
        graph._assertMutationAllowed('unregisterNodeTypeDescriptor');
        deactivateNodeType(typeId);
        const removed = nodeTypeDescriptors.delete(typeId);
        if (removed) {
            nodeTypeAuthorityEpoch += 1;
            dispatchGraphChange({
                descriptorChangeType: 'unregister',
                type: 'node-descriptor:change',
                typeId
            });
        }
        return removed;
    };

    const bindNodeTypeProvider = (typeId, provider, bindingOptions = {}) => {
        assertAvailable();
        graph._assertMutationAllowed('bindNodeTypeProvider');
        if (typeof typeId !== 'string' || !typeId.trim()) throw new TypeError('Node type provider requires typeId.');
        if (!provider || (typeof provider.ctor !== 'function' && typeof provider.create !== 'function')) {
            throw new TypeError(`Node type provider "${typeId}" requires ctor or create.`);
        }
        const normalizedTypeId = typeId.trim();
        if (nodeTypeProviders.has(normalizedTypeId) && bindingOptions.replace !== true) {
            const error = new Error(`Runtime node type provider is already bound: ${normalizedTypeId}`);
            error.code = 'RUNTIME_NODE_TYPE_PROVIDER_ALREADY_BOUND';
            throw error;
        }
        const binding = Object.freeze({
            create: provider.create,
            ctor: provider.ctor,
            replace: bindingOptions.replace === true
        });
        nodeTypeProviders.set(normalizedTypeId, binding);
        nodeTypeAuthorityEpoch += 1;
        activateNodeType(normalizedTypeId);
        return () => {
            if (nodeTypeProviders.get(normalizedTypeId) !== binding) return false;
            deactivateNodeType(normalizedTypeId);
            nodeTypeProviders.delete(normalizedTypeId);
            nodeTypeAuthorityEpoch += 1;
            return true;
        };
    };

    const unbindNodeTypeProvider = typeId => {
        assertAvailable();
        graph._assertMutationAllowed('unbindNodeTypeProvider');
        deactivateNodeType(typeId);
        const removed = nodeTypeProviders.delete(typeId);
        if (removed) nodeTypeAuthorityEpoch += 1;
        return removed;
    };

    const registerComponentTypeDescriptor = (descriptor, registrationOptions = {}) => {
        assertAvailable();
        graph._assertMutationAllowed('registerComponentTypeDescriptor');
        const normalized = normalizeRuntimeComponentTypeDescriptor(descriptor);
        const existing = graph.componentTypeRegistry.get(normalized.typeId);
        const implicitExisting = existing &&
            typeof graph.componentTypeRegistry.isImplicit === 'function' &&
            graph.componentTypeRegistry.isImplicit(normalized.typeId);
        return graph.componentTypeRegistry.register(normalized, {
            replace: registrationOptions.replace === true || implicitExisting
        });
    };

    const unregisterComponentTypeDescriptor = typeId => {
        assertAvailable();
        graph._assertMutationAllowed('unregisterComponentTypeDescriptor');
        return graph.componentTypeRegistry.unregister(typeId);
    };

    const bindComponentMigration = (typeId, fromVersion, migrate, bindingOptions = {}) => {
        assertAvailable();
        graph._assertMutationAllowed('bindComponentMigration');
        return graph.componentTypeRegistry.bindMigration(typeId, fromVersion, migrate, bindingOptions);
    };

    const unbindComponentMigration = (typeId, fromVersion, bindingOptions = {}) => {
        assertAvailable();
        graph._assertMutationAllowed('unbindComponentMigration');
        return graph.componentTypeRegistry.unbindMigration(typeId, fromVersion, bindingOptions);
    };

    unsubscribeRegistry = typeRegistry.subscribe(change => {
        if (disposed || !change) return;
        dispatchGraphChange({
            owner: change.owner || null,
            registryChangeType: change.type,
            sourceRegistryRevision: change.revision,
            type: 'registry:change',
            typeId: change.typeId
        });
        if (change.type !== 'register' && change.type !== 'replace') return;
        try {
            reifyUnknownNodes(change.typeId);
        } catch (error) {
            setImportError(error);
            dispatchGraphChange({
                error: error && error.message ? error.message : String(error),
                sourceRegistryRevision: change.revision,
                type: 'registry:reify-error',
                typeId: change.typeId
            });
        }
    });

    const querySubtree = query => {
        assertAvailable();
        const source = clonePortableObject(query);
        const rootNodeId = typeof source.rootNodeId === 'string' ? source.rootNodeId : '';
        if (!rootNodeId) throw new TypeError('Runtime subtree query requires rootNodeId.');
        const order = source.order === 'post' || source.order === 'breadth' ? source.order : 'pre';
        let maxDepth = null;
        if (source.maxDepth !== null && typeof source.maxDepth !== 'undefined') {
            if (!Number.isInteger(source.maxDepth) || source.maxDepth < 0) {
                throw new TypeError('Runtime subtree query maxDepth must be a non-negative integer or null.');
            }
            maxDepth = source.maxDepth;
        }
        const includeRoot = source.includeRoot !== false;
        const entries = [];
        if (order === 'breadth') {
            const queue = [{node: graph.getNode(rootNodeId), depth: 0}];
            if (!queue[0].node) throw new Error(`Unknown runtime node: ${rootNodeId}`);
            while (queue.length) {
                const current = queue.shift();
                if ((includeRoot || current.depth > 0) && (maxDepth === null || current.depth <= maxDepth)) {
                    entries.push(deepFreeze({depth: current.depth, node: toNodeView(current.node)}));
                }
                if (maxDepth !== null && current.depth >= maxDepth) continue;
                current.node.childIds.forEach(childId => {
                    const child = graph.getNode(childId);
                    if (child) queue.push({node: child, depth: current.depth + 1});
                });
            }
        } else {
            graph.traverse(rootNodeId, (node, depth) => {
                if (!includeRoot && depth === 0) return;
                if (maxDepth !== null && depth > maxDepth) return;
                entries.push(deepFreeze({depth, node: toNodeView(node)}));
            }, {order});
        }
        return deepFreeze({
            nodes: entries,
            query: deepFreeze({includeRoot, maxDepth, order, rootNodeId})
        });
    };

    const canonicalizePortableValue = value => {
        if (Array.isArray(value)) return value.map(canonicalizePortableValue);
        if (!value || typeof value !== 'object') return value;
        const result = {};
        Object.keys(value).sort(compareCanonicalStrings).forEach(key => {
            Object.defineProperty(result, key, {
                configurable: true,
                enumerable: true,
                value: canonicalizePortableValue(value[key]),
                writable: true
            });
        });
        return result;
    };

    const compareById = (first, second) => compareCanonicalStrings(
        String(first && first.id || ''),
        String(second && second.id || '')
    );

    const toCanonicalNodeView = node => {
        const view = canonicalizePortableValue(toNodeView(node));
        if (view && Array.isArray(view.components)) view.components.sort(compareById);
        return deepFreeze(view);
    };
    const toCanonicalNodeTypeView = definition => {
        const view = canonicalizePortableValue(toNodeTypeView(definition));
        if (view && Array.isArray(view.allowedScopes)) view.allowedScopes.sort(compareCanonicalStrings);
        return deepFreeze(view);
    };

    const assertSnapshotQueryKeys = (source, allowedKeys) => {
        const allowed = new Set(allowedKeys);
        const unsupported = Object.keys(source).filter(key => !allowed.has(key));
        if (!unsupported.length) return;
        const error = new Error(`Unsupported Runtime node snapshot query fields: ${unsupported.join(', ')}`);
        error.code = 'RUNTIME_NODE_SNAPSHOT_QUERY_INVALID';
        error.fields = unsupported;
        throw error;
    };

    const requireSnapshotString = (value, field) => {
        const normalized = typeof value === 'string' ? value.trim() : '';
        if (normalized) return normalized;
        const error = new Error(`Runtime node snapshot query requires ${field}.`);
        error.code = 'RUNTIME_NODE_SNAPSHOT_QUERY_INVALID';
        error.field = field;
        throw error;
    };

    const normalizeSnapshotBoolean = (source, field, defaultValue) => {
        if (typeof source[field] === 'undefined') return defaultValue;
        if (typeof source[field] !== 'boolean') {
            const error = new Error(`Runtime node snapshot query ${field} must be a Boolean.`);
            error.code = 'RUNTIME_NODE_SNAPSHOT_QUERY_INVALID';
            error.field = field;
            throw error;
        }
        return source[field];
    };

    const normalizeSnapshotOrder = source => {
        if (typeof source.order === 'undefined') return 'pre';
        if (!['pre', 'post', 'breadth'].includes(source.order)) {
            const error = new Error(`Unsupported Runtime node snapshot traversal order: ${String(source.order)}`);
            error.code = 'RUNTIME_NODE_SNAPSHOT_QUERY_INVALID';
            error.field = 'order';
            throw error;
        }
        return source.order;
    };

    const normalizeSnapshotQuery = request => {
        const source = clonePortableObject(request, {kind: RUNTIME_NODE_SNAPSHOT_KINDS.GRAPH});
        if (typeof source.kind !== 'undefined' && typeof source.kind !== 'string') {
            const error = new Error('Runtime node snapshot query kind must be a string.');
            error.code = 'RUNTIME_NODE_SNAPSHOT_QUERY_INVALID';
            error.field = 'kind';
            throw error;
        }
        const kind = typeof source.kind === 'string' ? source.kind.trim() : RUNTIME_NODE_SNAPSHOT_KINDS.GRAPH;
        if (!Object.values(RUNTIME_NODE_SNAPSHOT_KINDS).includes(kind)) {
            const error = new Error(`Unsupported Runtime node snapshot kind: ${String(kind)}`);
            error.code = 'RUNTIME_NODE_SNAPSHOT_KIND_UNSUPPORTED';
            error.kind = kind;
            throw error;
        }
        if (kind === RUNTIME_NODE_SNAPSHOT_KINDS.GRAPH) {
            assertSnapshotQueryKeys(source, ['kind']);
            return deepFreeze({kind});
        }
        if (kind === RUNTIME_NODE_SNAPSHOT_KINDS.SCENE) {
            assertSnapshotQueryKeys(source, ['kind', 'sceneId']);
            return deepFreeze({kind, sceneId: requireSnapshotString(source.sceneId, 'sceneId')});
        }
        if (kind === RUNTIME_NODE_SNAPSHOT_KINDS.NODE) {
            assertSnapshotQueryKeys(source, ['kind', 'nodeId']);
            return deepFreeze({kind, nodeId: requireSnapshotString(source.nodeId, 'nodeId')});
        }
        if (kind === RUNTIME_NODE_SNAPSHOT_KINDS.COMPONENT) {
            assertSnapshotQueryKeys(source, ['componentId', 'kind', 'nodeId']);
            return deepFreeze({
                componentId: requireSnapshotString(source.componentId, 'componentId'),
                kind,
                nodeId: requireSnapshotString(source.nodeId, 'nodeId')
            });
        }
        if (kind === RUNTIME_NODE_SNAPSHOT_KINDS.SUBTREE) {
            assertSnapshotQueryKeys(source, ['includeRoot', 'kind', 'maxDepth', 'order', 'rootNodeId']);
            const order = normalizeSnapshotOrder(source);
            let maxDepth = null;
            if (source.maxDepth !== null && typeof source.maxDepth !== 'undefined') {
                if (!Number.isSafeInteger(source.maxDepth) || source.maxDepth < 0) {
                    const error = new Error('Runtime node snapshot maxDepth must be a non-negative integer or null.');
                    error.code = 'RUNTIME_NODE_SNAPSHOT_QUERY_INVALID';
                    error.field = 'maxDepth';
                    throw error;
                }
                maxDepth = source.maxDepth;
            }
            return deepFreeze({
                includeRoot: normalizeSnapshotBoolean(source, 'includeRoot', true),
                kind,
                maxDepth,
                order,
                rootNodeId: requireSnapshotString(source.rootNodeId, 'rootNodeId')
            });
        }
        if (kind === RUNTIME_NODE_SNAPSHOT_KINDS.NODE_LIST) {
            assertSnapshotQueryKeys(source, ['includeRoots', 'kind', 'sceneId', 'scope']);
            const query = {
                includeRoots: normalizeSnapshotBoolean(source, 'includeRoots', true),
                kind,
                sceneId: null,
                scope: null
            };
            if (typeof source.sceneId !== 'undefined' && source.sceneId !== null) {
                query.sceneId = requireSnapshotString(source.sceneId, 'sceneId');
            }
            if (typeof source.scope !== 'undefined' && source.scope !== null) {
                if (!Object.values(NODE_SCOPES).includes(source.scope)) {
                    const error = new Error(`Unsupported Runtime node snapshot scope: ${String(source.scope)}`);
                    error.code = 'RUNTIME_NODE_SNAPSHOT_QUERY_INVALID';
                    error.field = 'scope';
                    throw error;
                }
                query.scope = source.scope;
            }
            return deepFreeze(query);
        }
        assertSnapshotQueryKeys(source, ['includeHidden', 'kind', 'scope']);
        const query = {
            includeHidden: normalizeSnapshotBoolean(source, 'includeHidden', false),
            kind,
            scope: null
        };
        if (typeof source.scope !== 'undefined' && source.scope !== null) {
            if (!Object.values(NODE_SCOPES).includes(source.scope)) {
                const error = new Error(`Unsupported Runtime node type snapshot scope: ${String(source.scope)}`);
                error.code = 'RUNTIME_NODE_SNAPSHOT_QUERY_INVALID';
                error.field = 'scope';
                throw error;
            }
            query.scope = source.scope;
        }
        return deepFreeze(query);
    };

    const captureSubtreeFromGraph = (targetGraph, query) => {
        const entries = [];
        const root = targetGraph.getNode(query.rootNodeId);
        if (!root) {
            const error = new Error(`Unknown runtime node: ${query.rootNodeId}`);
            error.code = 'RUNTIME_NODE_NOT_FOUND';
            error.nodeId = query.rootNodeId;
            throw error;
        }
        if (query.order === 'breadth') {
            const queue = [{depth: 0, node: root}];
            while (queue.length) {
                const current = queue.shift();
                if ((query.includeRoot || current.depth > 0) &&
                    (query.maxDepth === null || current.depth <= query.maxDepth)) {
                    entries.push(deepFreeze({depth: current.depth, node: toCanonicalNodeView(current.node)}));
                }
                if (query.maxDepth !== null && current.depth >= query.maxDepth) continue;
                current.node.childIds.forEach(childId => {
                    const child = targetGraph.getNode(childId);
                    if (child) queue.push({depth: current.depth + 1, node: child});
                });
            }
        } else {
            const visit = (node, depth) => {
                if (query.order === 'pre' && (query.includeRoot || depth > 0) &&
                    (query.maxDepth === null || depth <= query.maxDepth)) {
                    entries.push(deepFreeze({depth, node: toCanonicalNodeView(node)}));
                }
                if (query.maxDepth === null || depth < query.maxDepth) {
                    node.childIds.forEach(childId => {
                        const child = targetGraph.getNode(childId);
                        if (child) visit(child, depth + 1);
                    });
                }
                if (query.order === 'post' && (query.includeRoot || depth > 0) &&
                    (query.maxDepth === null || depth <= query.maxDepth)) {
                    entries.push(deepFreeze({depth, node: toCanonicalNodeView(node)}));
                }
            };
            visit(root, 0);
        }
        return deepFreeze({nodes: entries});
    };

    const buildSnapshotFromGraph = (targetGraph, query) => {
        if (query.kind === RUNTIME_NODE_SNAPSHOT_KINDS.GRAPH) {
            const sceneIds = targetGraph.listSceneIds().slice().sort(compareCanonicalStrings);
            const activeSceneId = sceneIds.find(sceneId => targetGraph.getSceneRoot(sceneId).activeInHierarchy) || null;
            return deepFreeze(canonicalizePortableValue({
                activeSceneId,
                nodes: targetGraph.listNodes().map(toCanonicalNodeView).sort(compareById),
                scenes: sceneIds.map(sceneId => {
                    const root = targetGraph.getSceneRoot(sceneId);
                    return {
                        active: Boolean(root.activeInHierarchy),
                        id: sceneId,
                        name: root.name,
                        rootId: root.id
                    };
                }),
                version: targetGraph.version
            }));
        }
        if (query.kind === RUNTIME_NODE_SNAPSHOT_KINDS.SCENE) {
            const root = targetGraph.getSceneRoot(query.sceneId);
            const nodes = targetGraph.listNodes({includeRoots: false, sceneId: query.sceneId})
                .map(toCanonicalNodeView)
                .sort(compareById);
            return deepFreeze(canonicalizePortableValue({
                active: Boolean(root.activeInHierarchy),
                nodeCount: nodes.length,
                nodes,
                root: toCanonicalNodeView(root),
                sceneId: query.sceneId
            }));
        }
        if (query.kind === RUNTIME_NODE_SNAPSHOT_KINDS.NODE) {
            return toCanonicalNodeView(targetGraph.getNode(query.nodeId));
        }
        if (query.kind === RUNTIME_NODE_SNAPSHOT_KINDS.COMPONENT) {
            const node = targetGraph.getNode(query.nodeId);
            return node ? deepFreeze(canonicalizePortableValue(toComponentView(node.getComponentById(query.componentId)))) : null;
        }
        if (query.kind === RUNTIME_NODE_SNAPSHOT_KINDS.SUBTREE) {
            return captureSubtreeFromGraph(targetGraph, query);
        }
        if (query.kind === RUNTIME_NODE_SNAPSHOT_KINDS.NODE_LIST) {
            const options = {
                includeRoots: query.includeRoots,
                sceneId: query.sceneId,
                scope: query.scope
            };
            return Object.freeze(targetGraph.listNodes(options).map(toCanonicalNodeView).sort(compareById));
        }
        return Object.freeze(targetGraph.typeRegistry.list({includeHidden: query.includeHidden})
            .filter(definition => !query.scope || definition.allowedScopes.includes(query.scope))
            .map(toCanonicalNodeTypeView)
            .sort(compareById));
    };

    const captureRuntimeSnapshot = request => {
        assertAvailable();
        const query = normalizeSnapshotQuery(request);
        const maxAttempts = 3;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const capturedGraph = graph;
            const before = getRevisionForGraph(capturedGraph);
            const snapshot = buildSnapshotFromGraph(capturedGraph, query);
            const after = getRevisionForGraph(capturedGraph);
            if (capturedGraph === graph && areRuntimeNodeRevisionTokensEqual(before, after)) {
                return deepFreeze(createRuntimeNodeSnapshotEnvelope({
                    kind: query.kind,
                    query,
                    revision: after,
                    snapshot
                }));
            }
        }
        const error = new Error('Runtime node snapshot could not be captured at one stable revision.');
        error.code = 'RUNTIME_NODE_SNAPSHOT_UNSTABLE';
        error.attempts = maxAttempts;
        throw error;
    };

    const getCurrentRevision = () => {
        assertAvailable();
        return getRevisionForGraph(graph);
    };

    const isCurrentRevision = token => {
        assertAvailable();
        const normalized = normalizeRuntimeNodeRevisionToken(clonePortableObject(token));
        return areRuntimeNodeRevisionTokensEqual(normalized, getCurrentRevision());
    };

    const assertCurrentRevision = token => {
        const normalized = normalizeRuntimeNodeRevisionToken(clonePortableObject(token));
        const current = getCurrentRevision();
        if (areRuntimeNodeRevisionTokensEqual(normalized, current)) return true;
        const error = new Error('Runtime node revision token is stale.');
        error.code = 'RUNTIME_NODE_REVISION_STALE';
        error.currentRevision = current;
        error.expectedRevision = normalized;
        throw error;
    };

    const snapshotCapability = Object.freeze({
        assertCurrent: assertCurrentRevision,
        capabilityId: RUNTIME_NODE_SNAPSHOT_CAPABILITY_ID,
        capture: captureRuntimeSnapshot,
        contractId: RUNTIME_NODE_SNAPSHOT_CONTRACT_ID,
        getContract: () => RUNTIME_NODE_SNAPSHOT_CONTRACT,
        getRevision: getCurrentRevision,
        isCurrent: isCurrentRevision,
        version: RUNTIME_NODE_SNAPSHOT_VERSION
    });

    const getCombinedRuntimeStatus = () => {
        const graphStatus = graph.getStatus();
        return Object.assign({}, graphStatus, {
            graphListenerErrorCount: graphStatus.graphListenerErrorCount,
            listenerErrorCount: graphStatus.graphListenerErrorCount + observerErrorCount,
            observerErrorCount
        });
    };

    const publicCapabilitySource = {
        apiVersion: RUNTIME_NODE_MODEL_API_VERSION,
        capabilityId: RUNTIME_NODE_MODEL_CAPABILITY_ID,
        nodeScopes: NODE_SCOPES,
        version: RUNTIME_NODE_MODEL_VERSION,
        canSetParent: (nodeId, parentId) => {
            assertAvailable();
            return deepFreeze(cloneSerializable(graph.canSetParent(nodeId, parentId)));
        },
        addComponent: (nodeId, component, mutationOptions) => mutateComponent(
            () => graph.addComponent(nodeId, normalizePublicComponentOptions(component)), mutationOptions
        ),
        createNode: (typeId, createOptions = {}) => mutateNode(() => {
            const portableOptions = clonePortableObject(stripMutationContext(createOptions));
            if (Array.isArray(portableOptions.components)) {
                portableOptions.components = portableOptions.components.map(normalizePublicComponentOptions);
            }
            return graph.createNode(typeId, portableOptions, {componentSource: 'public'});
        }, createOptions),
        createReference: nodeId => {
            assertAvailable();
            return deepFreeze(cloneSerializable(graph.createReference(nodeId)));
        },
        destroyNode: (nodeId, mutationOptions) => mutatePortable(
            () => graph.destroyNode(nodeId),
            destroyed => ({destroyed: Boolean(destroyed), nodeId}),
            mutationOptions
        ),
        detachNode: (nodeId, mutationOptions) => mutatePortable(
            () => graph.detachNode(nodeId),
            () => toNodeView(graph.getNode(nodeId)),
            mutationOptions
        ),
        duplicateNode: (nodeId, duplicateOptions = {}) => mutateNode(() => {
            const portableOptions = clonePortableObject(stripMutationContext(duplicateOptions));
            return graph.duplicateNode(nodeId, portableOptions);
        }, duplicateOptions),
        exportState: () => {
            assertAvailable();
            return deepFreeze(cloneSerializable(graph.exportState()));
        },
        getApiContract: () => RUNTIME_NODE_MODEL_API_CONTRACT,
        getChildren: nodeId => {
            assertAvailable();
            return Object.freeze(graph.getChildren(nodeId).map(toNodeView));
        },
        getComponent: getComponentSnapshot,
        getComponentSnapshot,
        getDebugSnapshot: () => {
            assertAvailable();
            return deepFreeze(cloneSerializable({
                lifecycle: {
                    contract: RUNTIME_NODE_MODEL_API_CONTRACT.lifecycleContract,
                    runtimeGeneration: graph.getStatus().runtimeGeneration,
                    trace: graph.getLifecycleTrace({limit: 512})
                },
                nodes: graph.listNodes().map(node => node.toDebugJSON()),
                registryRevision: getRegistryRevisionForGraph(graph),
                status: getCombinedRuntimeStatus(),
                version: RUNTIME_NODE_MODEL_VERSION
            }));
        },
        getGlobalRoot: () => {
            assertAvailable();
            return toNodeView(graph.getGlobalRoot());
        },
        getGraphSnapshot: () => {
            assertAvailable();
            return deepFreeze(cloneSerializable(graph.exportState()));
        },
        getImportStatus: () => {
            assertAvailable();
            return deepFreeze(cloneSerializable({
                error: status.error,
                errors: status.importErrors,
                lastResult: lastImportResult,
                persistenceReadOnly: status.persistenceReadOnly,
                persistenceReadOnlyReason: status.persistenceReadOnlyReason,
                storedStateVersion: status.storedStateVersion,
                unsupportedComponentSchemas: status.unsupportedComponentSchemas
            }));
        },
        getNode: getNodeSnapshot,
        getNodeSnapshot,
        getNodeType: typeId => {
            assertAvailable();
            return toNodeTypeView(typeRegistry.get(typeId));
        },
        getNodeTypeRegistryRevision: () => {
            assertAvailable();
            return typeRegistry.getRevision();
        },
        getParent: nodeId => {
            assertAvailable();
            return toNodeView(graph.getParent(nodeId));
        },
        getSceneRoot: sceneId => {
            assertAvailable();
            return toNodeView(graph.getSceneRoot(sceneId));
        },
        getSceneSnapshot,
        getStatus: () => {
            assertAvailable();
            return deepFreeze(cloneSerializable(Object.assign({}, getCombinedRuntimeStatus(), status, {
                lastImportResult,
                mutationCommitCount,
                mutationFailureCount,
                mutationPoisoned,
                mutationRollbackCount,
                persistent: true,
                persistenceKey: RUNTIME_NODE_EXTENSION_DATA_KEY,
                registryRevision: getRegistryRevisionForGraph(graph)
            })));
        },
        listNodes: listOptions => {
            assertAvailable();
            return Object.freeze(graph.listNodes(clonePortableObject(listOptions)).map(toNodeView));
        },
        listNodeTypes: (listOptions = {}) => {
            assertAvailable();
            const portableOptions = clonePortableObject(listOptions);
            const scope = portableOptions.scope || null;
            return Object.freeze(typeRegistry.list(portableOptions).filter(nodeType => (
                !scope || nodeType.allowedScopes.includes(scope)
            )).map(toNodeTypeView));
        },
        patchComponent: (nodeId, componentId, patch, mutationOptions) => mutateComponent(() => (
            graph.patchComponentData(nodeId, componentId, clonePortableObject(patch))
        ), mutationOptions),
        patchComponentData: (nodeId, componentId, patch, mutationOptions) => mutateComponent(() => (
            graph.patchComponentData(nodeId, componentId, clonePortableObject(patch))
        ), mutationOptions),
        patchNode: (nodeId, patch, mutationOptions) => mutateNode(
            () => graph.patchNode(nodeId, clonePortableObject(patch)), mutationOptions
        ),
        patchNodeMetadata: (nodeId, patch, mutationOptions) => mutateNode(
            () => graph.patchNodeMetadata(nodeId, clonePortableObject(patch)), mutationOptions
        ),
        querySubtree,
        removeComponent: (nodeId, componentId, mutationOptions) => mutatePortable(
            () => graph.removeComponent(nodeId, componentId),
            removed => ({componentId, nodeId, removed: Boolean(removed)}),
            mutationOptions
        ),
        reorderChild: (nodeId, index, mutationOptions) => mutateNode(
            () => graph.reorderChild(nodeId, index), mutationOptions
        ),
        renameNode: (nodeId, name, mutationOptions) => mutateNode(
            () => graph.patchNode(nodeId, {name}), mutationOptions
        ),
        resolveReference: reference => {
            assertAvailable();
            return toNodeView(graph.resolveReference(clonePortableObject(reference)));
        },
        setComponentData: (nodeId, componentId, data, mutationOptions) => mutateComponent(() => (
            graph.setComponentData(nodeId, componentId, clonePortableObject(data))
        ), mutationOptions),
        setComponentEnabled: (nodeId, componentId, enabled, mutationOptions) => mutateComponent(() => (
            graph.setComponentEnabled(nodeId, componentId, enabled)
        ), mutationOptions),
        setNodeEnabled: (nodeId, enabled, mutationOptions) => mutateNode(
            () => graph.setNodeEnabled(nodeId, enabled), mutationOptions
        ),
        setParent: (nodeId, parentId, setParentOptions = {}) => mutateNode(() => (
            graph.setParent(nodeId, parentId, clonePortableObject(stripMutationContext(setParentOptions)))
        ), setParentOptions),
        subscribe: listener => {
            assertAvailable();
            if (typeof listener !== 'function') return () => {};
            graphListeners.add(listener);
            return () => graphListeners.delete(listener);
        },
        validatePersistentState: snapshot => {
            assertAvailable();
            return deepFreeze(cloneSerializable(validateRuntimeNodeSnapshot(
                cloneRuntimeSerializable(snapshot),
                {componentTypeRegistry: graph.componentTypeRegistry, typeRegistry}
            )));
        }
    };

    const portableQueryNames = new Set(RUNTIME_NODE_MODEL_API_CONTRACT.portableQueryMethods);
    const portableMutationNames = new Set(RUNTIME_NODE_MODEL_API_CONTRACT.portableMutationMethods);
    RUNTIME_NODE_MODEL_API_CONTRACT.compatibilityAliases.forEach(alias => {
        if (portableQueryNames.has(alias.replacement)) portableQueryNames.add(alias.method);
        if (portableMutationNames.has(alias.replacement)) portableMutationNames.add(alias.method);
    });
    const publicCapability = Object.freeze(Object.keys(publicCapabilitySource).reduce((capability, key) => {
        const value = publicCapabilitySource[key];
        if (typeof value !== 'function' || key === 'subscribe') {
            capability[key] = value;
            return capability;
        }
        if (portableMutationNames.has(key)) {
            capability[key] = (...args) => {
                try {
                    validatePortableArguments(args);
                } catch (error) {
                    return createMutationResult({applied: false, error, persisted: false});
                }
                return value(...args);
            };
            return capability;
        }
        if (portableQueryNames.has(key)) {
            capability[key] = (...args) => {
                validatePortableArguments(args);
                return value(...args);
            };
            return capability;
        }
        capability[key] = value;
        return capability;
    }, {}));

    const persistenceController = Object.freeze({
        capabilityId: RUNTIME_NODE_PERSISTENCE_CONTROLLER_CAPABILITY_ID,
        version: '1',
        exportState: publicCapability.exportState,
        importState: (snapshot, mutationOptions) => {
            assertAvailable();
            const result = mutatePortable(
                () => replaceGraphFromState(cloneRuntimeSerializable(snapshot)),
                cloneSerializable,
                mutationOptions
            );
            if (!result.applied && result.error) {
                const error = new Error(result.error.message);
                error.code = result.error.code;
                if (result.error.details && Array.isArray(result.error.details.issues)) {
                    error.errors = cloneSerializable(result.error.details.issues);
                }
                setImportError(error);
            }
            return result;
        },
        persistState: () => {
            assertAvailable();
            return persistStateDetailed();
        },
        synchronizeScenes
    });

    const typeRegistrationCapability = Object.freeze({
        capabilityId: RUNTIME_NODE_TYPE_REGISTRATION_CAPABILITY_ID,
        version: '1.2',
        bindComponentMigration,
        bindNodeTypeProvider,
        getComponentTypeDescriptor: typeId => graph.componentTypeRegistry.get(typeId),
        getNodeTypeDescriptor: typeId => nodeTypeDescriptors.get(typeId) || null,
        listComponentMigrations: typeId => Object.freeze(graph.componentTypeRegistry.listMigrations(typeId)),
        listComponentTypeDescriptors: () => Object.freeze(graph.componentTypeRegistry.list()),
        listNodeTypeDescriptors: () => Object.freeze(Array.from(nodeTypeDescriptors.values())),
        registerComponentTypeDescriptor,
        registerNodeTypeDescriptor,
        reifyUnknownNodes,
        unbindComponentMigration,
        unbindNodeTypeProvider,
        unregisterComponentTypeDescriptor,
        unregisterNodeTypeDescriptor
    });

    const localHostCapability = Object.freeze({
        capabilityId: RUNTIME_NODE_LOCAL_HOST_CAPABILITY_ID,
        version: '1',
        dispose: () => {
            if (disposed) return;
            graph._assertMutationAllowed('runtime-node-model.dispose');
            disposed = true;
            activeNodeTypeUnregisters.forEach(unregister => {
                try { unregister(); } catch { /* noop */ }
            });
            activeNodeTypeUnregisters.clear();
            nodeTypeProviders.clear();
            nodeTypeDescriptors.clear();
            unsubscribeSceneData();
            unsubscribeComponentRegistry();
            unsubscribeRegistry();
            unsubscribeGraph();
            graph.dispose();
            graphListeners.clear();
        },
        traverse: (nodeId, visitor, traverseOptions) => {
            assertAvailable();
            if (typeof visitor !== 'function') throw new TypeError('Runtime node visitor must be a function.');
            return graph.traverse(nodeId, (node, depth) => visitor(toNodeView(node), depth), traverseOptions);
        }
    });

    const host = Object.freeze({
        dispose: localHostCapability.dispose,
        getInitialRestoreStatus: () => deepFreeze({
            complete: initialRestoreComplete,
            error: status.error,
            running: initialRestoreRunning
        }),
        localHostCapability,
        persistenceController,
        publicCapability,
        restoreInitialState,
        snapshotCapability,
        typeRegistrationCapability
    });
    runtimeNodeServiceHosts.set(publicCapability, host);
    return host;

};

const createRuntimeNodeModelService = (sceneDataModel, options = {}) => {
    const host = createRuntimeNodeModelHost(sceneDataModel, options);
    const model = host.publicCapability;
    const unwrap = result => assertRuntimeNodeMutationResult(result);
    const legacyRegisterNodeType = (definition, registrationOptions = {}) => {
        const ownerModuleId = registrationOptions.owner || definition.owner || 'anonymous';
        const replace = registrationOptions.replace === true || definition.replace === true;
        if (typeof definition.ctor !== 'function' && typeof definition.create !== 'function') {
            throw new TypeError(`Runtime node type "${definition.id || ''}" requires ctor or create.`);
        }
        const descriptorInput = {
            abstract: definition.abstract === true,
            allowChildren: definition.allowChildren !== false,
            category: definition.category || 'Core',
            family: definition.family || 'node',
            hidden: definition.hidden === true,
            label: definition.label,
            order: Number.isFinite(definition.order) ? definition.order : 0,
            ownerModuleId,
            schema: definition.schema || null,
            typeId: definition.id,
            version: definition.version || '1'
        };
        if (Array.isArray(definition.allowedScopes)) descriptorInput.allowedScopes = definition.allowedScopes;
        if (typeof definition.defaultScope === 'string') descriptorInput.defaultScope = definition.defaultScope;
        const descriptor = host.typeRegistrationCapability.registerNodeTypeDescriptor(
            descriptorInput,
            {activate: !replace, replace}
        );
        const unbind = host.typeRegistrationCapability.bindNodeTypeProvider(descriptor.typeId, {
            create: definition.create,
            ctor: definition.ctor
        }, {replace});
        return () => {
            if (host.typeRegistrationCapability.getNodeTypeDescriptor(descriptor.typeId) !== descriptor) return false;
            unbind();
            return host.typeRegistrationCapability.unregisterNodeTypeDescriptor(descriptor.typeId);
        };
    };
    const compatibilityService = Object.freeze(Object.assign({}, model, {
        addComponent: (...args) => unwrap(model.addComponent(...args)),
        createNode: (...args) => unwrap(model.createNode(...args)),
        destroyNode: (...args) => Boolean(unwrap(model.destroyNode(...args)).destroyed),
        detachNode: (...args) => {
            unwrap(model.detachNode(...args));
            return true;
        },
        dispose: host.dispose,
        duplicateNode: (...args) => unwrap(model.duplicateNode(...args)),
        importState: (...args) => unwrap(host.persistenceController.importState(...args)),
        patchComponent: (...args) => unwrap(model.patchComponent(...args)),
        patchComponentData: (...args) => unwrap(model.patchComponent(...args)),
        patchNode: (...args) => unwrap(model.patchNode(...args)),
        patchNodeMetadata: (...args) => unwrap(model.patchNodeMetadata(...args)),
        persistState: () => host.persistenceController.persistState().changed,
        registerNodeType: legacyRegisterNodeType,
        reifyUnknownNodes: typeId => unwrap(host.typeRegistrationCapability.reifyUnknownNodes(typeId)),
        removeComponent: (...args) => Boolean(unwrap(model.removeComponent(...args)).removed),
        reorderChild: (...args) => unwrap(model.reorderChild(...args)),
        renameNode: (nodeId, name, mutationOptions) => unwrap(model.patchNode(nodeId, {name}, mutationOptions)),
        setComponentData: (...args) => unwrap(model.setComponentData(...args)),
        setComponentEnabled: (...args) => unwrap(model.setComponentEnabled(...args)),
        setNodeEnabled: (...args) => unwrap(model.setNodeEnabled(...args)),
        setParent: (...args) => unwrap(model.setParent(...args)),
        synchronizeScenes: host.persistenceController.synchronizeScenes,
        traverse: host.localHostCapability.traverse
    }));
    runtimeNodeServiceHosts.set(compatibilityService, host);
    return compatibilityService;
};

const getRuntimeNodeModelHost = capability => runtimeNodeServiceHosts.get(capability) || null;

const disposeRuntimeNodeModelService = capability => {
    const host = getRuntimeNodeModelHost(capability);
    if (!host) return false;
    host.dispose();
    runtimeNodeServiceHosts.delete(capability);
    return true;
};

module.exports = {
    RUNTIME_NODE_EXTENSION_DATA_KEY,
    assertRuntimeNodeMutationResult,
    createMutationResult,
    createRuntimeNodeModelHost,
    createRuntimeNodeModelService,
    disposeRuntimeNodeModelService,
    getRuntimeNodeModelHost,
    deepFreeze,
    toComponentView,
    toNodeTypeView,
    toNodeView
};
