const {cloneSerializable, getSceneById} = require('./scene-data-model');
const {
    SCENE_CONTROLLER_CAPABILITY_ID,
    SCENE_MANAGER_CAPABILITY_ID,
    SCENE_RUNTIME_CAPABILITY_ID
} = require('./constants');
const {
    createSceneSummary,
    getDuplicateName,
    getNextDefaultName,
    getUniqueName,
    MAX_SCENE_NAME_LENGTH
} = require('./scene-manager');

const createSceneControllerError = (code, message) => {
    const error = new Error(message);
    error.code = code;
    return error;
};

const normalizeName = name => {
    if (typeof name !== 'string' || !name.trim()) {
        throw createSceneControllerError('SCENE_NAME_REQUIRED', 'Scene name must be a non-empty string.');
    }
    const normalized = name.trim();
    if (normalized.length > MAX_SCENE_NAME_LENGTH) {
        throw createSceneControllerError(
            'SCENE_NAME_TOO_LONG',
            `Scene name must not exceed ${MAX_SCENE_NAME_LENGTH} characters.`
        );
    }
    return normalized;
};

const parseCommandOptions = value => {
    if (typeof value === 'undefined' || value === null || value === '') return {};
    if (typeof value !== 'string') {
        throw createSceneControllerError('SCENE_COMMAND_OPTIONS_INVALID', 'Scene command options must be JSON text.');
    }
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw createSceneControllerError('SCENE_COMMAND_OPTIONS_INVALID', 'Scene command options must decode to an object.');
    }
    return parsed;
};

const createSceneController = (context, sceneDataModel, snapshotSerializer, options = {}) => {
    const listeners = new Set();
    const sceneIdFactory = options.sceneIdFactory;
    const nowFactory = typeof options.nowFactory === 'function' ? options.nowFactory : () => new Date().toISOString();
    let operation = null;
    let error = null;
    let disposed = false;
    let revision = 0;
    let loadedSceneId = sceneDataModel.readProject().activeSceneId;

    const assertAvailable = () => {
        if (disposed) throw createSceneControllerError('SCENE_CONTROLLER_DISPOSED', 'Scene controller has been disposed.');
    };

    const assertIdle = () => {
        assertAvailable();
        if (operation) {
            throw createSceneControllerError(
                'SCENE_CONTROLLER_BUSY',
                `Scene controller is busy with operation: ${operation}.`
            );
        }
    };

    const now = () => {
        const value = nowFactory();
        if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
            throw new TypeError('Scene controller nowFactory must return an ISO-compatible timestamp string.');
        }
        return value;
    };

    const emit = event => {
        revision += 1;
        const payload = Object.assign({revision}, event);
        listeners.forEach(listener => {
            try {
                listener(cloneSerializable(payload));
            } catch (listenerError) {
                // Internal listeners are advisory and must not break the scene transaction.
            }
        });
    };

    const setOperation = (nextOperation, nextError = null) => {
        operation = nextOperation;
        error = nextError ? (nextError.message || String(nextError)) : null;
        emit({error, operation, type: 'status'});
    };

    const run = async (name, callback) => {
        assertIdle();
        setOperation(name);
        try {
            const result = await callback();
            setOperation(null);
            return result;
        } catch (nextError) {
            setOperation(null, nextError);
            throw nextError;
        }
    };

    const requireScene = (project, sceneId) => {
        const index = project.scenes.findIndex(scene => scene.id === sceneId);
        if (index < 0) throw createSceneControllerError('SCENE_NOT_FOUND', `Unknown scene: ${sceneId}`);
        return {index, scene: project.scenes[index]};
    };

    const listScenes = () => {
        assertAvailable();
        const project = sceneDataModel.readProject();
        return project.scenes.map((scene, index) => createSceneSummary(scene, index, project));
    };

    const getScene = sceneId => {
        assertAvailable();
        return cloneSerializable(getSceneById(sceneDataModel.readProject(), sceneId));
    };

    const getViewState = () => {
        assertAvailable();
        const project = sceneDataModel.readProject();
        return {
            activeSceneId: project.activeSceneId,
            busy: Boolean(operation),
            error,
            loadedSceneId,
            operation,
            revision,
            scenes: project.scenes.map((scene, index) => createSceneSummary(scene, index, project)),
            startupSceneId: project.startupSceneId
        };
    };

    const createSceneRecord = async (project, createOptions = {}) => {
        const timestamp = now();
        const preferredName = createOptions.name ? normalizeName(createOptions.name) : getNextDefaultName(project);
        const name = createOptions.allowDuplicateName ? preferredName : getUniqueName(project, preferredName);
        const scene = sceneDataModel.createScene({
            extensionData: createOptions.extensionData,
            idFactory: sceneIdFactory,
            metadata: Object.assign({}, createOptions.metadata, {
                createdAt: timestamp,
                updatedAt: timestamp
            }),
            name,
            variables: createOptions.variables
        });
        scene.snapshot = createOptions.snapshot ? cloneSerializable(createOptions.snapshot) :
            await snapshotSerializer.createBlankSnapshot({
                backdropName: createOptions.backdropName,
                capturedAt: timestamp,
                sceneId: scene.id,
                stageName: createOptions.stageName
            });
        return scene;
    };

    const captureSceneInternal = async (sceneId, captureOptions = {}) => {
        const snapshot = await snapshotSerializer.captureScene(sceneId, captureOptions);
        emit({sceneId, type: 'captured'});
        return snapshot;
    };

    const loadSceneInternal = async (sceneId, loadOptions = {}) => {
        let project = sceneDataModel.readProject();
        requireScene(project, sceneId);
        const previousSceneId = loadedSceneId;
        if (loadOptions.captureCurrent !== false && previousSceneId && previousSceneId !== sceneId) {
            await snapshotSerializer.captureScene(previousSceneId, loadOptions.captureOptions || {});
            project = sceneDataModel.readProject();
        }
        const currentTarget = requireScene(project, sceneId);
        if (!currentTarget.scene.snapshot) {
            throw createSceneControllerError(
                'SCENE_SNAPSHOT_MISSING',
                `Scene "${currentTarget.scene.name}" does not have a captured snapshot.`
            );
        }
        const restoreResult = await snapshotSerializer.restoreScene(sceneId, loadOptions.restoreOptions || {});
        project = sceneDataModel.readProject();
        project.activeSceneId = sceneId;
        sceneDataModel.writeProject(project);
        loadedSceneId = sceneId;
        snapshotSerializer.setActiveScene(sceneId);
        emit({fromSceneId: previousSceneId, sceneId, type: 'loaded'});
        return {
            activeSceneId: sceneId,
            cacheHit: Boolean(restoreResult && restoreResult.cacheHit),
            loadedSceneId,
            migrated: Boolean(restoreResult && restoreResult.migrated),
            restored: true
        };
    };

    const createSceneInternal = async (createOptions = {}) => {
        const project = sceneDataModel.readProject();
        const scene = await createSceneRecord(project, createOptions);
        const requestedIndex = Number.isInteger(createOptions.index) ? createOptions.index : project.scenes.length;
        const insertionIndex = Math.max(0, Math.min(requestedIndex, project.scenes.length));
        project.scenes.splice(insertionIndex, 0, scene);
        if (createOptions.setActive === true) project.activeSceneId = scene.id;
        sceneDataModel.writeProject(project);
        emit({sceneId: scene.id, type: 'created'});
        return cloneSerializable(scene);
    };

    const createScene = createOptions => run('create', () => createSceneInternal(createOptions || {}));

    const createAndLoadScene = createOptions => run('create-and-load', async () => {
        const commandOptions = createOptions || {};
        const scene = await createSceneInternal(commandOptions);
        await loadSceneInternal(scene.id, commandOptions.loadOptions || {});
        return scene;
    });

    const loadScene = (sceneId, loadOptions = {}) => run('load', () => loadSceneInternal(sceneId, loadOptions));

    const duplicateSceneInternal = async (sceneId, duplicateOptions = {}) => {
        let project = sceneDataModel.readProject();
        let source = requireScene(project, sceneId);
        if (loadedSceneId === sceneId && duplicateOptions.captureCurrent !== false) {
            await snapshotSerializer.captureScene(sceneId, duplicateOptions.captureOptions || {});
            project = sceneDataModel.readProject();
            source = requireScene(project, sceneId);
        }
        if (!source.scene.snapshot) {
            throw createSceneControllerError(
                'SCENE_SNAPSHOT_MISSING',
                `Scene "${source.scene.name}" must have a snapshot before duplication.`
            );
        }
        const timestamp = now();
        const preferredName = duplicateOptions.name ? normalizeName(duplicateOptions.name) :
            getDuplicateName(project, source.scene);
        const name = duplicateOptions.allowDuplicateName ? preferredName : getUniqueName(project, preferredName);
        const duplicate = sceneDataModel.createScene({
            extensionData: cloneSerializable(source.scene.extensionData),
            idFactory: sceneIdFactory,
            metadata: Object.assign({}, cloneSerializable(source.scene.metadata), {
                createdAt: timestamp,
                updatedAt: timestamp
            }),
            name,
            snapshot: cloneSerializable(source.scene.snapshot),
            variables: cloneSerializable(source.scene.variables)
        });
        if (duplicate.snapshot && duplicate.snapshot.metadata) duplicate.snapshot.metadata.sceneId = duplicate.id;
        project.scenes.splice(source.index + 1, 0, duplicate);
        sceneDataModel.writeProject(project);
        emit({sceneId: duplicate.id, sourceSceneId: sceneId, type: 'duplicated'});
        return cloneSerializable(duplicate);
    };

    const duplicateScene = (sceneId, duplicateOptions = {}) => run(
        'duplicate',
        () => duplicateSceneInternal(sceneId, duplicateOptions)
    );

    const duplicateAndLoadScene = (sceneId, duplicateOptions = {}) => run('duplicate-and-load', async () => {
        const previousLoadedSceneId = loadedSceneId;
        const duplicate = await duplicateSceneInternal(sceneId, duplicateOptions);
        const loadOptions = Object.assign({}, duplicateOptions.loadOptions);
        if (previousLoadedSceneId === sceneId && duplicateOptions.captureCurrent !== false) {
            loadOptions.captureCurrent = false;
        }
        await loadSceneInternal(duplicate.id, loadOptions);
        return duplicate;
    });

    const renameScene = (sceneId, name) => {
        assertIdle();
        const project = sceneDataModel.readProject();
        const target = requireScene(project, sceneId);
        const normalized = normalizeName(name);
        const conflict = project.scenes.some(scene => (
            scene.id !== sceneId && scene.name.toLocaleLowerCase() === normalized.toLocaleLowerCase()
        ));
        if (conflict) throw createSceneControllerError('SCENE_NAME_CONFLICT', `A scene named "${normalized}" already exists.`);
        target.scene.name = normalized;
        target.scene.metadata.updatedAt = now();
        sceneDataModel.writeProject(project);
        emit({sceneId, type: 'renamed'});
        return cloneSerializable(target.scene);
    };

    const moveScene = (sceneId, requestedIndex) => {
        assertIdle();
        if (!Number.isInteger(requestedIndex)) {
            throw createSceneControllerError('SCENE_INDEX_INVALID', 'Scene index must be an integer.');
        }
        const project = sceneDataModel.readProject();
        const target = requireScene(project, sceneId);
        const [scene] = project.scenes.splice(target.index, 1);
        const index = Math.max(0, Math.min(requestedIndex, project.scenes.length));
        project.scenes.splice(index, 0, scene);
        sceneDataModel.writeProject(project);
        emit({index, sceneId, type: 'moved'});
        return cloneSerializable(scene);
    };

    const setActiveScene = sceneId => {
        assertIdle();
        const project = sceneDataModel.readProject();
        requireScene(project, sceneId);
        project.activeSceneId = sceneId;
        sceneDataModel.writeProject(project);
        emit({sceneId, type: 'active-changed'});
        return getScene(sceneId);
    };

    const setStartupScene = sceneId => {
        assertIdle();
        const project = sceneDataModel.readProject();
        requireScene(project, sceneId);
        project.startupSceneId = sceneId;
        sceneDataModel.writeProject(project);
        emit({sceneId, type: 'startup-changed'});
        return getScene(sceneId);
    };

    const deleteScene = (sceneId, deleteOptions = {}) => run('delete', async () => {
        const originalProject = sceneDataModel.readProject();
        const target = requireScene(originalProject, sceneId);
        let project = originalProject;
        let replacement = null;
        if (project.scenes.length === 1) {
            replacement = await createSceneRecord(project, {
                allowDuplicateName: true,
                backdropName: deleteOptions.backdropName,
                name: deleteOptions.replacementName || target.scene.name,
                stageName: deleteOptions.stageName
            });
            project.scenes.push(replacement);
            project.startupSceneId = replacement.id;
            sceneDataModel.writeProject(project);
        }
        project = sceneDataModel.readProject();
        const currentTarget = requireScene(project, sceneId);
        const remaining = project.scenes.filter(scene => scene.id !== sceneId);
        const fallback = replacement || remaining[Math.max(0, currentTarget.index - 1)] || remaining[0];
        if (!fallback) throw createSceneControllerError('SCENE_DELETE_INVARIANT_FAILED', 'Deleting this scene would leave no scene.');
        if (loadedSceneId === sceneId) await loadSceneInternal(fallback.id, {captureCurrent: false});
        project = sceneDataModel.readProject();
        project.scenes = project.scenes.filter(scene => scene.id !== sceneId);
        if (project.activeSceneId === sceneId || !getSceneById(project, project.activeSceneId)) project.activeSceneId = fallback.id;
        if (project.startupSceneId === sceneId || !getSceneById(project, project.startupSceneId)) project.startupSceneId = fallback.id;
        sceneDataModel.writeProject(project);
        emit({sceneId, type: 'deleted'});
        return {
            activeSceneId: project.activeSceneId,
            deletedScene: cloneSerializable(target.scene),
            replacementScene: replacement ? cloneSerializable(replacement) : null
        };
    });

    const reloadScene = (sceneId = loadedSceneId, reloadOptions = {}) => run('reload', async () => {
        const targetId = sceneId || sceneDataModel.readProject().activeSceneId;
        const result = await snapshotSerializer.restoreScene(targetId, reloadOptions.restoreOptions || {});
        const project = sceneDataModel.readProject();
        project.activeSceneId = targetId;
        sceneDataModel.writeProject(project);
        loadedSceneId = targetId;
        snapshotSerializer.setActiveScene(targetId);
        emit({sceneId: targetId, type: 'reloaded'});
        return Object.assign({activeSceneId: targetId, loadedSceneId}, result);
    });

    const unloadScene = (sceneId = loadedSceneId, unloadOptions = {}) => run('unload', async () => {
        if (!sceneId || loadedSceneId !== sceneId) return false;
        if (unloadOptions.capture !== false) await snapshotSerializer.captureScene(sceneId, unloadOptions.captureOptions || {});
        loadedSceneId = null;
        snapshotSerializer.setActiveScene(null);
        emit({sceneId, type: 'unloaded'});
        return true;
    });

    const preloadScene = sceneId => snapshotSerializer.preloadScene(sceneId);
    const preloadScenes = sceneIds => Promise.all(Array.from(new Set(sceneIds || [])).map(sceneId =>
        preloadScene(sceneId).catch(nextError => ({
            error: nextError && nextError.message ? nextError.message : String(nextError),
            preloaded: false,
            sceneId
        }))));

    return Object.freeze({
        captureScene: sceneId => run('capture', () => captureSceneInternal(sceneId)),
        count: () => listScenes().length,
        createAndLoadScene,
        createScene,
        deleteScene,
        dispose: () => {
            disposed = true;
            listeners.clear();
        },
        duplicateAndLoadScene,
        duplicateScene,
        exists: sceneId => Boolean(getScene(sceneId)),
        getActiveScene: () => getScene(sceneDataModel.readProject().activeSceneId),
        getCacheConfiguration: () => snapshotSerializer.getCacheConfiguration(),
        getCacheStatus: () => snapshotSerializer.getCacheStatus(),
        getLoadedScenes: () => (loadedSceneId ? [loadedSceneId] : []),
        getRecommendedPreloadCount: () => snapshotSerializer.getRecommendedPreloadCount(),
        getScene,
        getStatus: () => {
            const project = sceneDataModel.readProject();
            return {
                activeSceneId: project.activeSceneId,
                busy: Boolean(operation),
                error,
                loadedSceneId,
                operation,
                sceneCount: project.scenes.length,
                singleSceneMode: true
            };
        },
        getViewState,
        isLoaded: sceneId => loadedSceneId === sceneId,
        isPreloaded: sceneId => snapshotSerializer.isScenePreloaded(sceneId),
        listScenes,
        loadScene,
        moveScene,
        preloadScene,
        preloadScenes,
        reloadScene,
        renameScene,
        setActiveScene,
        setCacheBudgetBytes: value => snapshotSerializer.setCacheBudgetBytes(value),
        setStartupScene,
        subscribe: listener => {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        unloadScene
    });
};

const createSceneControllerCapability = controller => Object.freeze({
    capabilityId: SCENE_CONTROLLER_CAPABILITY_ID,
    execute: async (command, optionsJSON = '{}') => {
        const options = parseCommandOptions(optionsJSON);
        let result;
        switch (command) {
        case 'create':
            result = await controller.createScene(options);
            break;
        case 'create-and-load':
            result = await controller.createAndLoadScene(options);
            break;
        case 'delete':
            result = await controller.deleteScene(options.sceneId, options);
            break;
        case 'duplicate-and-load':
            result = await controller.duplicateAndLoadScene(options.sceneId, options);
            break;
        case 'enter':
        case 'load':
            result = await controller.loadScene(options.sceneId, options);
            break;
        case 'move':
            result = controller.moveScene(options.sceneId, options.index);
            break;
        case 'rename':
            result = controller.renameScene(options.sceneId, options.name);
            break;
        case 'set-startup':
            result = controller.setStartupScene(options.sceneId);
            break;
        default:
            throw createSceneControllerError('SCENE_COMMAND_UNKNOWN', `Unknown scene command: ${command}`);
        }
        return JSON.stringify(typeof result === 'undefined' ? null : result);
    },
    getRevision: () => controller.getViewState().revision,
    getViewStateJSON: () => JSON.stringify(controller.getViewState())
});

const createSceneManagerAdapter = controller => Object.freeze({
    capabilityId: SCENE_MANAGER_CAPABILITY_ID,
    count: controller.count,
    createScene: controller.createScene,
    deleteScene: controller.deleteScene,
    dispose: () => {},
    duplicateScene: controller.duplicateScene,
    exists: controller.exists,
    getActiveScene: controller.getActiveScene,
    getScene: controller.getScene,
    getStatus: () => {
        const status = controller.getStatus();
        return {busy: status.busy, error: status.error, operation: status.operation, sceneCount: status.sceneCount};
    },
    listScenes: controller.listScenes,
    moveScene: controller.moveScene,
    renameScene: controller.renameScene,
    setActiveScene: controller.setActiveScene,
    setStartupScene: controller.setStartupScene,
    subscribe: controller.subscribe
});

const createSceneRuntimeAdapter = controller => Object.freeze({
    capabilityId: SCENE_RUNTIME_CAPABILITY_ID,
    dispose: () => {},
    getActiveSceneId: () => controller.getStatus().activeSceneId,
    getCacheConfiguration: controller.getCacheConfiguration,
    getCacheStatus: controller.getCacheStatus,
    getLoadedScenes: controller.getLoadedScenes,
    getRecommendedPreloadCount: controller.getRecommendedPreloadCount,
    getStatus: controller.getStatus,
    isLoaded: controller.isLoaded,
    isPreloaded: controller.isPreloaded,
    loadScene: controller.loadScene,
    preloadScene: controller.preloadScene,
    preloadScenes: controller.preloadScenes,
    reloadScene: controller.reloadScene,
    setActiveScene: controller.loadScene,
    setCacheBudgetBytes: controller.setCacheBudgetBytes,
    subscribe: controller.subscribe,
    unloadScene: controller.unloadScene
});

module.exports = {
    createSceneController,
    createSceneControllerCapability,
    createSceneManagerAdapter,
    createSceneRuntimeAdapter
};
