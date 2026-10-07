const {SCENE_MANAGER_CAPABILITY_ID} = require('./constants');
const {cloneSerializable, getSceneById} = require('./scene-data-model');

const DEFAULT_NAME_PREFIX = 'Scene';
const DUPLICATE_SUFFIX = 'Copy';
const MAX_SCENE_NAME_LENGTH = 120;

const createSceneManagerError = (code, message) => {
    const error = new Error(message);
    error.code = code;
    return error;
};

const normalizeName = name => {
    if (typeof name !== 'string' || !name.trim()) {
        throw createSceneManagerError('SCENE_NAME_REQUIRED', 'Scene name must be a non-empty string.');
    }
    const normalized = name.trim();
    if (normalized.length > MAX_SCENE_NAME_LENGTH) {
        throw createSceneManagerError(
            'SCENE_NAME_TOO_LONG',
            `Scene name must not exceed ${MAX_SCENE_NAME_LENGTH} characters.`
        );
    }
    return normalized;
};

const getUniqueName = (project, preferredName, excludeSceneId = null) => {
    const usedNames = new Set(project.scenes
        .filter(scene => scene.id !== excludeSceneId)
        .map(scene => scene.name.toLocaleLowerCase()));
    if (!usedNames.has(preferredName.toLocaleLowerCase())) return preferredName;

    let copyIndex = 2;
    while (usedNames.has(`${preferredName} ${copyIndex}`.toLocaleLowerCase())) copyIndex += 1;
    return `${preferredName} ${copyIndex}`;
};

const getNextDefaultName = project => {
    const usedNames = new Set(project.scenes.map(scene => scene.name.toLocaleLowerCase()));
    let index = 1;
    while (usedNames.has(`${DEFAULT_NAME_PREFIX} ${index}`.toLocaleLowerCase())) index += 1;
    return `${DEFAULT_NAME_PREFIX} ${index}`;
};

const getDuplicateName = (project, sourceScene) => {
    const baseName = `${sourceScene.name} ${DUPLICATE_SUFFIX}`;
    return getUniqueName(project, baseName);
};

const clampIndex = (index, length) => Math.max(0, Math.min(index, Math.max(0, length - 1)));

const createSceneSummary = (scene, index, project) => ({
    createdAt: scene.metadata.createdAt,
    hasSnapshot: Boolean(scene.snapshot),
    id: scene.id,
    index,
    isActive: project.activeSceneId === scene.id,
    isStartup: project.startupSceneId === scene.id,
    metadata: {
        color: scene.metadata.color,
        tags: cloneSerializable(scene.metadata.tags),
        thumbnailAssetId: scene.metadata.thumbnailAssetId
    },
    name: scene.name,
    snapshotByteLength: scene.snapshot && Number.isInteger(scene.snapshot.byteLength) ?
        scene.snapshot.byteLength : 0,
    updatedAt: scene.metadata.updatedAt
});

const createSceneManager = (context, sceneDataModel, snapshotSerializer, sceneRuntime, options = {}) => {
    const listeners = new Set();
    const nowFactory = typeof options.nowFactory === 'function' ?
        options.nowFactory : () => new Date().toISOString();
    const sceneIdFactory = options.sceneIdFactory;
    let operation = null;
    let error = null;
    let disposed = false;

    const now = () => {
        const timestamp = nowFactory();
        if (typeof timestamp !== 'string' || Number.isNaN(Date.parse(timestamp))) {
            throw new TypeError('Scene manager nowFactory must return an ISO-compatible timestamp string.');
        }
        return timestamp;
    };

    const assertAvailable = () => {
        if (disposed) throw createSceneManagerError('SCENE_MANAGER_DISPOSED', 'Scene manager has been disposed.');
    };

    const assertIdle = () => {
        assertAvailable();
        if (operation) {
            throw createSceneManagerError(
                'SCENE_MANAGER_BUSY',
                `Scene manager is busy with operation: ${operation}.`
            );
        }
    };

    const emit = event => {
        const project = sceneDataModel.readProject();
        const payload = Object.assign({
            activeSceneId: project.activeSceneId,
            operation,
            sceneCount: project.scenes.length,
            timestamp: now()
        }, event);
        listeners.forEach(listener => listener(cloneSerializable(payload)));
    };

    const setOperation = (nextOperation, nextError = null) => {
        operation = nextOperation;
        error = nextError ? (nextError.message || String(nextError)) : null;
        emit({error, type: 'status'});
    };

    const requireScene = (project, sceneId) => {
        const index = project.scenes.findIndex(scene => scene.id === sceneId);
        if (index < 0) throw createSceneManagerError('SCENE_NOT_FOUND', `Unknown scene: ${sceneId}`);
        return {index, scene: project.scenes[index]};
    };

    const assertNameAvailable = (project, name, excludeSceneId = null, allowDuplicateName = false) => {
        if (allowDuplicateName) return name;
        const conflict = project.scenes.some(scene => (
            scene.id !== excludeSceneId && scene.name.toLocaleLowerCase() === name.toLocaleLowerCase()
        ));
        if (conflict) {
            throw createSceneManagerError('SCENE_NAME_CONFLICT', `A scene named "${name}" already exists.`);
        }
        return name;
    };

    const normalizeSnapshotForScene = (snapshot, sceneId) => {
        if (!snapshot) return null;
        const normalized = cloneSerializable(snapshot);
        normalized.metadata = Object.assign({}, normalized.metadata, {sceneId});
        return normalized;
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

        const suppliedSnapshot = createOptions.snapshot ?
            normalizeSnapshotForScene(createOptions.snapshot, scene.id) : null;
        scene.snapshot = suppliedSnapshot || await snapshotSerializer.createBlankSnapshot({
            backdropName: createOptions.backdropName,
            capturedAt: timestamp,
            sceneId: scene.id,
            stageName: createOptions.stageName
        });
        return scene;
    };

    const runAsyncOperation = async (name, callback) => {
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

    const ensureSceneTimestamps = () => {
        const project = sceneDataModel.readProject();
        const timestamp = now();
        let changed = false;
        project.scenes.forEach(scene => {
            if (!scene.metadata.createdAt) {
                scene.metadata.createdAt = timestamp;
                changed = true;
            }
            if (!scene.metadata.updatedAt) {
                scene.metadata.updatedAt = scene.metadata.createdAt;
                changed = true;
            }
        });
        if (changed) sceneDataModel.writeProject(project);
    };

    ensureSceneTimestamps();

    const listScenes = () => {
        assertAvailable();
        const project = sceneDataModel.readProject();
        return project.scenes.map((scene, index) => createSceneSummary(scene, index, project));
    };

    const getScene = sceneId => {
        assertAvailable();
        return cloneSerializable(getSceneById(sceneDataModel.readProject(), sceneId));
    };

    const getActiveScene = () => {
        assertAvailable();
        const project = sceneDataModel.readProject();
        return cloneSerializable(getSceneById(project, project.activeSceneId));
    };

    const createScene = createOptions => runAsyncOperation('create', async () => {
        const project = sceneDataModel.readProject();
        const scene = await createSceneRecord(project, createOptions || {});
        const requestedIndex = createOptions && Number.isInteger(createOptions.index) ?
            createOptions.index : project.scenes.length;
        const insertionIndex = Math.max(0, Math.min(requestedIndex, project.scenes.length));
        project.scenes.splice(insertionIndex, 0, scene);
        if (createOptions && createOptions.setActive === true) project.activeSceneId = scene.id;
        sceneDataModel.writeProject(project);
        emit({scene: createSceneSummary(scene, insertionIndex, project), type: 'created'});
        return cloneSerializable(scene);
    });

    const duplicateScene = (sceneId, duplicateOptions = {}) => runAsyncOperation('duplicate', async () => {
        let project = sceneDataModel.readProject();
        let source = requireScene(project, sceneId);
        const sourceIsLoaded = Boolean(sceneRuntime && sceneRuntime.isLoaded(sceneId));

        if (sourceIsLoaded && duplicateOptions.captureCurrent !== false) {
            await snapshotSerializer.captureScene(sceneId, duplicateOptions.captureOptions || {});
            project = sceneDataModel.readProject();
            source = requireScene(project, sceneId);
        } else if (!source.scene.snapshot) {
            throw createSceneManagerError(
                'SCENE_SNAPSHOT_MISSING',
                `Scene "${source.scene.name}" must be loaded and captured before it can be duplicated.`
            );
        }

        const timestamp = now();
        const preferredName = duplicateOptions.name ? normalizeName(duplicateOptions.name) :
            getDuplicateName(project, source.scene);
        const name = assertNameAvailable(
            project,
            preferredName,
            null,
            duplicateOptions.allowDuplicateName === true
        );
        const duplicate = sceneDataModel.createScene({
            extensionData: source.scene.extensionData,
            idFactory: sceneIdFactory,
            metadata: Object.assign({}, source.scene.metadata, {
                createdAt: timestamp,
                updatedAt: timestamp
            }),
            name,
            snapshot: source.scene.snapshot,
            variables: source.scene.variables
        });
        duplicate.snapshot = normalizeSnapshotForScene(duplicate.snapshot, duplicate.id);

        const requestedIndex = Number.isInteger(duplicateOptions.index) ?
            duplicateOptions.index : source.index + 1;
        const insertionIndex = Math.max(0, Math.min(requestedIndex, project.scenes.length));
        project.scenes.splice(insertionIndex, 0, duplicate);
        sceneDataModel.writeProject(project);
        emit({
            scene: createSceneSummary(duplicate, insertionIndex, project),
            sourceSceneId: sceneId,
            type: 'duplicated'
        });
        return cloneSerializable(duplicate);
    });

    const renameScene = (sceneId, nextName, renameOptions = {}) => {
        assertIdle();
        const project = sceneDataModel.readProject();
        const target = requireScene(project, sceneId);
        const name = assertNameAvailable(
            project,
            normalizeName(nextName),
            sceneId,
            renameOptions.allowDuplicateName === true
        );
        if (target.scene.name === name) return cloneSerializable(target.scene);
        const previousName = target.scene.name;
        target.scene.name = name;
        target.scene.metadata.updatedAt = now();
        sceneDataModel.writeProject(project);
        emit({name, previousName, sceneId, type: 'renamed'});
        return cloneSerializable(target.scene);
    };

    const moveScene = (sceneId, targetIndex) => {
        assertIdle();
        if (!Number.isInteger(targetIndex)) {
            throw createSceneManagerError('SCENE_INDEX_INVALID', 'Scene target index must be an integer.');
        }
        const project = sceneDataModel.readProject();
        const target = requireScene(project, sceneId);
        const nextIndex = clampIndex(targetIndex, project.scenes.length);
        if (nextIndex === target.index) return listScenes();
        const [scene] = project.scenes.splice(target.index, 1);
        project.scenes.splice(nextIndex, 0, scene);
        sceneDataModel.writeProject(project);
        emit({fromIndex: target.index, sceneId, targetIndex: nextIndex, type: 'moved'});
        return listScenes();
    };

    const setActiveScene = sceneId => {
        assertIdle();
        const project = sceneDataModel.readProject();
        requireScene(project, sceneId);
        if (project.activeSceneId === sceneId) return cloneSerializable(getSceneById(project, sceneId));
        const previousSceneId = project.activeSceneId;
        project.activeSceneId = sceneId;
        sceneDataModel.writeProject(project);
        emit({previousSceneId, sceneId, type: 'active-changed'});
        return cloneSerializable(getSceneById(project, sceneId));
    };

    const setStartupScene = sceneId => {
        assertIdle();
        const project = sceneDataModel.readProject();
        const target = requireScene(project, sceneId);
        if (project.startupSceneId === sceneId) return cloneSerializable(target.scene);
        const previousSceneId = project.startupSceneId;
        project.startupSceneId = sceneId;
        sceneDataModel.writeProject(project);
        emit({previousSceneId, sceneId, type: 'startup-changed'});
        return cloneSerializable(target.scene);
    };

    const deleteScene = (sceneId, deleteOptions = {}) => runAsyncOperation('delete', async () => {
        const originalProject = sceneDataModel.readProject();
        const target = requireScene(originalProject, sceneId);
        let replacementScene = null;
        let transitionProject = originalProject;

        if (originalProject.scenes.length === 1) {
            replacementScene = await createSceneRecord(originalProject, {
                allowDuplicateName: true,
                backdropName: deleteOptions.backdropName,
                metadata: deleteOptions.replacementMetadata,
                name: deleteOptions.replacementName || target.scene.name,
                stageName: deleteOptions.stageName
            });
            transitionProject = cloneSerializable(originalProject);
            transitionProject.scenes.push(replacementScene);
            transitionProject.startupSceneId = replacementScene.id;
            sceneDataModel.writeProject(transitionProject);
        }

        const currentProject = sceneDataModel.readProject();
        const currentTarget = requireScene(currentProject, sceneId);
        const remainingScenes = currentProject.scenes.filter(scene => scene.id !== sceneId);
        const fallbackScene = replacementScene ||
            remainingScenes[Math.max(0, currentTarget.index - 1)] ||
            remainingScenes[0];
        if (!fallbackScene) {
            throw createSceneManagerError('SCENE_DELETE_INVARIANT_FAILED', 'Deleting this scene would leave no scene.');
        }

        const loaded = sceneRuntime && sceneRuntime.isLoaded(sceneId);
        try {
            if (loaded) {
                await sceneRuntime.loadScene(fallbackScene.id, Object.assign({}, deleteOptions.runtimeOptions, {
                    captureCurrent: false
                }));
            }
        } catch (nextError) {
            if (replacementScene) sceneDataModel.writeProject(originalProject);
            throw nextError;
        }

        const finalProject = sceneDataModel.readProject();
        finalProject.scenes = finalProject.scenes.filter(scene => scene.id !== sceneId);
        if (finalProject.activeSceneId === sceneId || !getSceneById(finalProject, finalProject.activeSceneId)) {
            finalProject.activeSceneId = fallbackScene.id;
        }
        if (finalProject.startupSceneId === sceneId || !getSceneById(finalProject, finalProject.startupSceneId)) {
            finalProject.startupSceneId = fallbackScene.id;
        }
        sceneDataModel.writeProject(finalProject);
        emit({
            activeSceneId: finalProject.activeSceneId,
            deletedSceneId: sceneId,
            replacementScene: replacementScene ? cloneSerializable(replacementScene) : null,
            type: 'deleted'
        });
        return {
            activeSceneId: finalProject.activeSceneId,
            deletedScene: cloneSerializable(target.scene),
            replacementScene: replacementScene ? cloneSerializable(replacementScene) : null
        };
    });

    return Object.freeze({
        capabilityId: SCENE_MANAGER_CAPABILITY_ID,
        count: () => listScenes().length,
        createScene,
        deleteScene,
        dispose: () => {
            disposed = true;
            listeners.clear();
        },
        duplicateScene,
        exists: sceneId => Boolean(getScene(sceneId)),
        getActiveScene,
        getScene,
        getStatus: () => ({
            busy: Boolean(operation),
            error,
            operation,
            sceneCount: sceneDataModel.readProject().scenes.length
        }),
        listScenes,
        moveScene,
        renameScene,
        setActiveScene,
        setStartupScene,
        subscribe: listener => {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    });
};

module.exports = {
    MAX_SCENE_NAME_LENGTH,
    createSceneManager,
    createSceneSummary,
    getDuplicateName,
    getNextDefaultName,
    getUniqueName
};
