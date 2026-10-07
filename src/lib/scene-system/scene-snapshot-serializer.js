const {SCENE_SNAPSHOT_CAPABILITY_ID} = require('./constants');
const {createBlankSceneFiles} = require('./blank-scene-project');
const {
    createPortableProjectPayload,
    encodeBase64Bytes,
    getPortablePayloadByteLength,
    parsePortableProjectPayload,
    readPortableTextFile,
    replacePortableTextFile,
    toUint8Array
} = require('../first-party-modules/portable-project-files');
const {createVMProjectIOService} = require('../first-party-modules/vm-project-io-service');
const {cloneSerializable, getSceneById} = require('./scene-data-model');
const {
    assertSupportedSceneSnapshot,
    createSceneSnapshot,
    isLegacySceneSnapshot,
    sanitizeProjectJSONForSceneSnapshot,
    validateSceneSnapshot
} = require('./scene-snapshot');
const {migrateLegacySceneSnapshot} = require('./legacy-scene-snapshot-migrator');
const {createSceneEditorProjection} = require('./scene-editor-projection');

const createSceneSnapshotError = (code, message) => {
    const error = new Error(message);
    error.code = code;
    return error;
};

const createSceneSnapshotSerializer = (context, sceneDataModel, options = {}) => {
    const listeners = new Set();
    const preloadedSceneIds = new Set();
    let disposed = false;
    let operation = null;
    let error = null;
    let lastRollback = null;
    let activeSceneId = null;

    const assertAvailable = () => {
        if (disposed) throw createSceneSnapshotError('SCENE_SNAPSHOT_DISPOSED', 'Scene snapshot serializer is disposed.');
    };

    const assertIdle = () => {
        assertAvailable();
        if (operation) {
            throw createSceneSnapshotError(
                'SCENE_SNAPSHOT_BUSY',
                `Scene snapshot serializer is busy with operation: ${operation}.`
            );
        }
    };

    const emit = change => listeners.forEach(listener => {
        try {
            listener(cloneSerializable(change));
        } catch (listenerError) {
            // Snapshot observers are diagnostics only. A listener must never break persistence.
        }
    });

    const setOperation = (nextOperation, nextError = null) => {
        operation = nextOperation;
        error = nextError ? (nextError.message || String(nextError)) : null;
        emit({error, operation, type: 'status'});
    };

    const getVMProjectIO = () => {
        if (options.vmProjectIO) return options.vmProjectIO;
        if (context && typeof context.getService === 'function') {
            const service = context.getService('vm-project-io');
            if (service) return service;
        }
        // Direct unit/integration callers may construct the serializer outside the
        // Module Manager. This local adapter has no module boundary to cross.
        const vm = context && context.vm;
        return vm ? createVMProjectIOService(vm) : null;
    };

    const requirePortableIO = () => {
        const io = getVMProjectIO();
        if (!io || typeof io.capturePortableProject !== 'function' ||
            typeof io.restorePortableProject !== 'function') {
            throw createSceneSnapshotError(
                'SCENE_SNAPSHOT_VM_PROJECT_IO_V2_UNAVAILABLE',
                'Scene V2 requires VM Project I/O portable capture/restore services.'
            );
        }
        return io;
    };

    const sanitizePortablePayload = payload => {
        const parsed = parsePortableProjectPayload(payload);
        const projectText = readPortableTextFile(parsed, 'project.json');
        if (!projectText) {
            throw createSceneSnapshotError(
                'SCENE_SNAPSHOT_PROJECT_JSON_MISSING',
                'Portable scene payload does not contain project.json.'
            );
        }
        const projectJSON = sanitizeProjectJSONForSceneSnapshot(JSON.parse(projectText));
        return replacePortableTextFile(parsed, 'project.json', JSON.stringify(projectJSON));
    };

    const getSnapshotMetadata = (payload, snapshotOptions = {}) => {
        const parsed = parsePortableProjectPayload(payload);
        const projectText = readPortableTextFile(parsed, 'project.json');
        if (!projectText) {
            throw createSceneSnapshotError(
                'SCENE_SNAPSHOT_PROJECT_JSON_MISSING',
                'Portable scene payload does not contain project.json.'
            );
        }
        const projectJSON = JSON.parse(projectText);
        const targets = Array.isArray(projectJSON.targets) ? projectJSON.targets : [];
        return {
            assetCount: Math.max(0, parsed.files.length - 1),
            capturedAt: typeof snapshotOptions.capturedAt === 'string' ? snapshotOptions.capturedAt :
                new Date().toISOString(),
            editorProjection: createSceneEditorProjection(projectJSON),
            hasStage: targets.some(target => target && target.isStage === true),
            projectVersion: Number.isInteger(projectJSON.projectVersion) ? projectJSON.projectVersion : 3,
            sceneId: snapshotOptions.sceneId || null,
            spriteCount: targets.filter(target => target && target.isStage === false).length,
            targetCount: targets.length,
            transport: 'portable-project-files-v2'
        };
    };

    const buildSnapshotFromPayload = (payload, snapshotOptions = {}) => {
        const sanitizedPayload = sanitizePortablePayload(payload);
        return createSceneSnapshot({
            byteLength: getPortablePayloadByteLength(sanitizedPayload),
            metadata: getSnapshotMetadata(sanitizedPayload, snapshotOptions),
            payload: sanitizedPayload
        });
    };

    const createPortablePayloadFromFiles = async files => {
        const records = [];
        for (const name of Object.keys(files).sort()) {
            const bytes = await toUint8Array(files[name], name);
            records.push({data: encodeBase64Bytes(bytes), name});
        }
        return createPortableProjectPayload(records);
    };

    const capture = async (captureOptions = {}) => {
        assertIdle();
        setOperation('capture');
        try {
            const payload = await requirePortableIO().capturePortableProject();
            const snapshot = buildSnapshotFromPayload(payload, captureOptions);
            setOperation(null);
            return snapshot;
        } catch (nextError) {
            setOperation(null, nextError);
            throw nextError;
        }
    };

    const createBlankSnapshot = async (blankOptions = {}) => {
        assertIdle();
        setOperation('create-blank');
        try {
            const payload = await createPortablePayloadFromFiles(createBlankSceneFiles(blankOptions));
            const snapshot = buildSnapshotFromPayload(payload, blankOptions);
            setOperation(null);
            return snapshot;
        } catch (nextError) {
            setOperation(null, nextError);
            throw nextError;
        }
    };

    const migrateSnapshot = async snapshot => {
        const supported = assertSupportedSceneSnapshot(snapshot);
        return isLegacySceneSnapshot(supported) ? migrateLegacySceneSnapshot(supported) : supported;
    };

    const restore = async (snapshot, restoreOptions = {}) => {
        assertIdle();
        setOperation('restore');
        const io = requirePortableIO();
        let rollbackPayload = null;
        let destructiveRestoreStarted = false;
        try {
            const migrated = await migrateSnapshot(snapshot);
            if (restoreOptions.rollback !== false) rollbackPayload = await io.capturePortableProject();
            destructiveRestoreStarted = true;
            await io.restorePortableProject(migrated.payload, {
                emitProjectLoaded: restoreOptions.emitProjectLoaded !== false,
                stopRuntime: restoreOptions.stopRuntime !== false
            });
            lastRollback = rollbackPayload ? {attempted: false, error: null, succeeded: false} : null;
            setOperation(null);
            return {
                cacheHit: preloadedSceneIds.has(migrated.metadata.sceneId),
                materialized: true,
                metadata: cloneSerializable(migrated.metadata),
                migrated: isLegacySceneSnapshot(snapshot),
                restored: true,
                rollbackProtected: Boolean(rollbackPayload)
            };
        } catch (nextError) {
            if (destructiveRestoreStarted && rollbackPayload) {
                try {
                    await io.restorePortableProject(rollbackPayload, {
                        emitProjectLoaded: restoreOptions.emitProjectLoaded !== false,
                        stopRuntime: restoreOptions.stopRuntime !== false
                    });
                    lastRollback = {attempted: true, error: null, succeeded: true};
                } catch (rollbackError) {
                    lastRollback = {
                        attempted: true,
                        error: rollbackError && rollbackError.message ? rollbackError.message : String(rollbackError),
                        succeeded: false
                    };
                }
                nextError.rollback = cloneSerializable(lastRollback);
            }
            setOperation(null, nextError);
            throw nextError;
        }
    };

    const requireScene = sceneId => {
        const project = sceneDataModel.readProject();
        const scene = getSceneById(project, sceneId);
        if (!scene) throw createSceneSnapshotError('SCENE_NOT_FOUND', `Unknown scene: ${sceneId}`);
        return {project, scene};
    };

    const captureScene = async (sceneId, captureOptions = {}) => {
        const {project, scene} = requireScene(sceneId);
        const snapshot = await capture(Object.assign({}, captureOptions, {sceneId}));
        scene.snapshot = snapshot;
        if (scene.metadata) scene.metadata.updatedAt = snapshot.metadata.capturedAt;
        sceneDataModel.writeProject(project);
        preloadedSceneIds.add(sceneId);
        return cloneSerializable(snapshot);
    };

    const captureActiveScene = captureOptions => {
        const project = sceneDataModel.readProject();
        return captureScene(project.activeSceneId, captureOptions);
    };

    const restoreScene = async (sceneId, restoreOptions = {}) => {
        const {project, scene} = requireScene(sceneId);
        if (!scene.snapshot) {
            throw createSceneSnapshotError('SCENE_SNAPSHOT_MISSING', `Scene "${scene.name}" has no snapshot.`);
        }
        const wasLegacy = isLegacySceneSnapshot(scene.snapshot);
        const migrated = wasLegacy ? await migrateSnapshot(scene.snapshot) : scene.snapshot;
        const result = await restore(migrated, Object.assign({}, restoreOptions, {sceneId}));
        if (wasLegacy) {
            scene.snapshot = migrated;
            sceneDataModel.writeProject(project);
        }
        preloadedSceneIds.add(sceneId);
        activeSceneId = sceneId;
        return Object.assign({}, result, {migrated: wasLegacy});
    };

    const preloadScene = async sceneId => {
        const {scene} = requireScene(sceneId);
        if (!scene.snapshot) throw createSceneSnapshotError('SCENE_SNAPSHOT_MISSING', `Scene "${scene.name}" has no snapshot.`);
        await migrateSnapshot(scene.snapshot);
        const cacheHit = preloadedSceneIds.has(sceneId);
        preloadedSceneIds.add(sceneId);
        return {cacheHit, materialized: true, preloaded: true, sceneId};
    };

    const getCacheConfiguration = () => {
        const project = sceneDataModel.readProject();
        const cache = project.extensionData && project.extensionData.sceneCache;
        return cache && Number.isInteger(cache.budgetBytes) ?
            {budgetBytes: cache.budgetBytes, mode: 'configured'} : {budgetBytes: null, mode: 'automatic'};
    };

    const setCacheBudgetBytes = budgetBytes => {
        assertAvailable();
        const project = sceneDataModel.readProject();
        const extensionData = Object.assign({}, project.extensionData);
        if (budgetBytes === null || typeof budgetBytes === 'undefined') {
            delete extensionData.sceneCache;
        } else {
            if (!Number.isInteger(budgetBytes) || budgetBytes <= 0) {
                throw createSceneSnapshotError(
                    'SCENE_CACHE_BUDGET_INVALID',
                    'Scene cache budget must be a positive integer byte count or null.'
                );
            }
            extensionData.sceneCache = {budgetBytes};
        }
        project.extensionData = extensionData;
        sceneDataModel.writeProject(project);
        return getCacheConfiguration();
    };

    return Object.freeze({
        capabilityId: SCENE_SNAPSHOT_CAPABILITY_ID,
        capture,
        captureActiveScene,
        captureScene,
        clearPreloadCache: () => preloadedSceneIds.clear(),
        createBlankSnapshot,
        dispose: () => {
            disposed = true;
            listeners.clear();
            preloadedSceneIds.clear();
        },
        getCacheConfiguration,
        getCacheStatus: () => ({
            activeSceneId,
            preloadedSceneIds: Array.from(preloadedSceneIds),
            transport: 'portable-project-files-v2'
        }),
        getRecommendedPreloadCount: () => 2,
        getStatus: () => ({
            busy: Boolean(operation),
            error,
            lastRollback: cloneSerializable(lastRollback),
            operation
        }),
        isPreloaded: snapshot => {
            const sceneId = snapshot && snapshot.metadata && snapshot.metadata.sceneId;
            return Boolean(sceneId && preloadedSceneIds.has(sceneId));
        },
        isScenePreloaded: sceneId => preloadedSceneIds.has(sceneId),
        migrateSnapshot,
        preload: async snapshot => {
            const migrated = await migrateSnapshot(snapshot);
            const sceneId = migrated.metadata && migrated.metadata.sceneId;
            const cacheHit = Boolean(sceneId && preloadedSceneIds.has(sceneId));
            if (sceneId) preloadedSceneIds.add(sceneId);
            return {cacheHit, materialized: true, preloaded: true};
        },
        preloadScene,
        restore,
        restoreScene,
        setActiveScene: sceneId => {
            activeSceneId = sceneId || null;
        },
        setCacheBudgetBytes,
        subscribe: listener => {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        validate: validateSceneSnapshot
    });
};

module.exports = {
    createSceneSnapshotSerializer
};
