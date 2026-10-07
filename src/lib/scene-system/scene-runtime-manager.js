const {
    SCENE_RUNTIME_CAPABILITY_ID
} = require('./constants');
const {cloneSerializable, getSceneById} = require('./scene-data-model');

const getContextVM = context => {
    if (!context) return null;
    if (typeof context.getService === 'function') return context.getService('vm');
    return context.vm || null;
};

const createSceneRuntimeManager = (context, sceneDataModel, snapshotSerializer) => {
    const listeners = new Set();
    const preloadOperations = new Map();
    const preloadErrors = new Map();
    const project = sceneDataModel.readProject();
    let loadedSceneId = project.activeSceneId || null;
    let operation = null;
    let error = null;
    let disposed = false;

    if (snapshotSerializer && typeof snapshotSerializer.setActiveScene === 'function') {
        snapshotSerializer.setActiveScene(loadedSceneId);
    }

    const emit = event => {
        if (disposed) return;
        const payload = Object.assign({
            activeSceneId: sceneDataModel.readProject().activeSceneId,
            loadedSceneId,
            operation,
            timestamp: new Date().toISOString()
        }, event);
        listeners.forEach(listener => listener(cloneSerializable(payload)));
    };

    const assertAvailable = () => {
        if (disposed) {
            const nextError = new Error('Scene runtime manager has been disposed.');
            nextError.code = 'SCENE_RUNTIME_DISPOSED';
            throw nextError;
        }
    };

    const assertIdle = () => {
        assertAvailable();
        if (!operation) return;
        const nextError = new Error(`Scene runtime manager is busy with operation: ${operation}.`);
        nextError.code = 'SCENE_RUNTIME_BUSY';
        throw nextError;
    };

    const requireScene = sceneId => {
        const currentProject = sceneDataModel.readProject();
        const scene = getSceneById(currentProject, sceneId);
        if (!scene) {
            const nextError = new Error(`Unknown scene: ${sceneId}`);
            nextError.code = 'SCENE_NOT_FOUND';
            throw nextError;
        }
        return {project: currentProject, scene};
    };

    const setOperation = (nextOperation, nextError = null) => {
        operation = nextOperation;
        error = nextError ? (nextError.message || String(nextError)) : null;
        emit({error, type: 'status'});
    };

    const setActiveSceneId = sceneId => {
        const currentProject = sceneDataModel.readProject();
        if (currentProject.activeSceneId === sceneId) return currentProject;
        currentProject.activeSceneId = sceneId;
        return sceneDataModel.writeProject(currentProject);
    };

    const isScenePreloaded = sceneId => Boolean(
        snapshotSerializer &&
        typeof snapshotSerializer.isScenePreloaded === 'function' &&
        snapshotSerializer.isScenePreloaded(sceneId)
    );

    const preloadScene = (sceneId, options = {}) => {
        assertAvailable();
        const target = requireScene(sceneId);
        if (!target.scene.snapshot || loadedSceneId === sceneId) {
            return Promise.resolve({
                preloaded: false,
                reason: loadedSceneId === sceneId ? 'already-loaded' : 'snapshot-missing',
                sceneId
            });
        }
        if (!snapshotSerializer || typeof snapshotSerializer.preloadScene !== 'function') {
            return Promise.resolve({preloaded: false, reason: 'unsupported', sceneId});
        }
        if (isScenePreloaded(sceneId)) {
            return Promise.resolve({cacheHit: true, preloaded: true, sceneId});
        }
        if (preloadOperations.has(sceneId)) return preloadOperations.get(sceneId);

        preloadErrors.delete(sceneId);
        emit({sceneId, type: 'before-preload'});
        const promise = snapshotSerializer.preloadScene(sceneId, options).then(result => {
            preloadErrors.delete(sceneId);
            emit({sceneId, type: 'preloaded'});
            return Object.assign({sceneId}, result);
        }).catch(nextError => {
            preloadErrors.set(sceneId, nextError.message || String(nextError));
            emit({message: nextError.message, sceneId, type: 'preload-error'});
            throw nextError;
        }).finally(() => {
            preloadOperations.delete(sceneId);
        });
        preloadOperations.set(sceneId, promise);
        return promise;
    };

    const preloadScenes = async (sceneIds, options = {}) => {
        assertAvailable();
        const uniqueSceneIds = Array.from(new Set(Array.isArray(sceneIds) ? sceneIds : []));
        return Promise.all(uniqueSceneIds.map(sceneId => preloadScene(sceneId, options).catch(nextError => ({
            error: nextError && nextError.message ? nextError.message : String(nextError),
            preloaded: false,
            sceneId
        }))));
    };

    const getRecommendedPreloadCount = () => {
        if (!snapshotSerializer || typeof snapshotSerializer.getRecommendedPreloadCount !== 'function') return 2;
        return snapshotSerializer.getRecommendedPreloadCount();
    };

    const getNearbySceneIds = (sceneId, count = getRecommendedPreloadCount()) => {
        const currentProject = sceneDataModel.readProject();
        const index = currentProject.scenes.findIndex(scene => scene.id === sceneId);
        if (index < 0) return [];
        return currentProject.scenes
            .map((scene, sceneIndex) => ({distance: Math.abs(sceneIndex - index), scene, sceneIndex}))
            .filter(candidate => (
                candidate.sceneIndex !== index &&
                candidate.scene.snapshot
            ))
            .sort((first, second) => (
                first.distance - second.distance || first.sceneIndex - second.sceneIndex
            ))
            .slice(0, Math.max(0, count))
            .map(candidate => candidate.scene.id);
    };

    const scheduleNearbyPreload = sceneId => {
        Promise.resolve().then(() => {
            if (disposed || operation) return;
            const nearbySceneIds = getNearbySceneIds(sceneId);
            if (!nearbySceneIds.length) return;
            preloadScenes(nearbySceneIds).catch(() => {});
        });
    };

    const loadScene = async (sceneId, options = {}) => {
        assertIdle();
        const target = requireScene(sceneId);
        setOperation('load');
        emit({fromSceneId: loadedSceneId, sceneId, type: 'before-load'});
        try {
            const previousSceneId = loadedSceneId;
            if (options.captureCurrent !== false && previousSceneId && previousSceneId !== sceneId) {
                await snapshotSerializer.captureScene(previousSceneId, options.captureOptions || {});
            }

            // A scene without a snapshot can represent the VM state currently open in the editor.
            // It is therefore loadable only when it is already the active loaded scene.
            let restoreResult = null;
            if (target.scene.snapshot) {
                restoreResult = await snapshotSerializer.restoreScene(sceneId, options.restoreOptions || {});
            } else if (previousSceneId !== sceneId) {
                const nextError = new Error(`Scene "${target.scene.name}" does not have a captured snapshot.`);
                nextError.code = 'SCENE_SNAPSHOT_MISSING';
                throw nextError;
            }

            loadedSceneId = sceneId;
            setActiveSceneId(sceneId);
            if (snapshotSerializer && typeof snapshotSerializer.setActiveScene === 'function') {
                snapshotSerializer.setActiveScene(sceneId);
            }
            setOperation(null);
            emit({
                cacheHit: Boolean(restoreResult && restoreResult.cacheHit),
                fromSceneId: previousSceneId,
                materialized: Boolean(restoreResult && restoreResult.materialized),
                sceneId,
                type: 'loaded'
            });
            if (options.preloadAdjacent !== false) scheduleNearbyPreload(sceneId);
            return {
                activeSceneId: sceneId,
                cacheHit: Boolean(restoreResult && restoreResult.cacheHit),
                loadedSceneId,
                materialized: Boolean(restoreResult && restoreResult.materialized),
                restored: Boolean(target.scene.snapshot)
            };
        } catch (nextError) {
            setOperation(null, nextError);
            emit({sceneId, type: 'load-error', message: nextError.message});
            throw nextError;
        }
    };

    const reloadScene = async (sceneId = loadedSceneId, options = {}) => {
        assertIdle();
        const targetId = sceneId || sceneDataModel.readProject().activeSceneId;
        requireScene(targetId);
        setOperation('reload');
        emit({sceneId: targetId, type: 'before-reload'});
        try {
            const restoreResult = await snapshotSerializer.restoreScene(targetId, options.restoreOptions || {});
            loadedSceneId = targetId;
            setActiveSceneId(targetId);
            if (snapshotSerializer && typeof snapshotSerializer.setActiveScene === 'function') {
                snapshotSerializer.setActiveScene(targetId);
            }
            setOperation(null);
            emit({
                cacheHit: Boolean(restoreResult && restoreResult.cacheHit),
                materialized: Boolean(restoreResult && restoreResult.materialized),
                sceneId: targetId,
                type: 'reloaded'
            });
            if (options.preloadAdjacent !== false) scheduleNearbyPreload(targetId);
            return {
                activeSceneId: targetId,
                cacheHit: Boolean(restoreResult && restoreResult.cacheHit),
                loadedSceneId,
                materialized: Boolean(restoreResult && restoreResult.materialized),
                restored: true
            };
        } catch (nextError) {
            setOperation(null, nextError);
            emit({sceneId: targetId, type: 'reload-error', message: nextError.message});
            throw nextError;
        }
    };

    const unloadScene = async (sceneId = loadedSceneId, options = {}) => {
        assertIdle();
        if (!sceneId || loadedSceneId !== sceneId) return false;
        requireScene(sceneId);
        setOperation('unload');
        emit({sceneId, type: 'before-unload'});
        try {
            if (options.capture !== false) {
                await snapshotSerializer.captureScene(sceneId, options.captureOptions || {});
            }
            if (getContextVM(context) && options.stopRuntime !== false && typeof getContextVM(context).stopAll === 'function') {
                getContextVM(context).stopAll();
            }
            loadedSceneId = null;
            if (snapshotSerializer && typeof snapshotSerializer.setActiveScene === 'function') {
                snapshotSerializer.setActiveScene(null);
            }
            setOperation(null);
            emit({sceneId, type: 'unloaded'});
            return true;
        } catch (nextError) {
            setOperation(null, nextError);
            emit({sceneId, type: 'unload-error', message: nextError.message});
            throw nextError;
        }
    };

    return Object.freeze({
        capabilityId: SCENE_RUNTIME_CAPABILITY_ID,
        dispose: () => {
            disposed = true;
            preloadOperations.clear();
            preloadErrors.clear();
            listeners.clear();
        },
        getActiveSceneId: () => sceneDataModel.readProject().activeSceneId,
        getCacheConfiguration: () => (
            snapshotSerializer && typeof snapshotSerializer.getCacheConfiguration === 'function' ?
                snapshotSerializer.getCacheConfiguration() : {budgetBytes: null, mode: 'automatic'}
        ),
        getCacheStatus: () => (
            snapshotSerializer && typeof snapshotSerializer.getCacheStatus === 'function' ?
                snapshotSerializer.getCacheStatus() : null
        ),
        getLoadedScenes: () => loadedSceneId ? [loadedSceneId] : [],
        getRecommendedPreloadCount,
        getStatus: () => {
            const currentProject = sceneDataModel.readProject();
            return {
                activeSceneId: currentProject.activeSceneId,
                busy: Boolean(operation),
                error,
                loadedSceneId,
                operation,
                preloadedSceneIds: currentProject.scenes
                    .filter(scene => scene.snapshot && isScenePreloaded(scene.id))
                    .map(scene => scene.id),
                preloadErrors: Object.fromEntries(preloadErrors),
                preloadingSceneIds: Array.from(preloadOperations.keys()),
                sceneCache: snapshotSerializer && typeof snapshotSerializer.getCacheStatus === 'function' ?
                    snapshotSerializer.getCacheStatus() : null,
                singleSceneMode: true
            };
        },
        isLoaded: sceneId => loadedSceneId === sceneId,
        isPreloaded: isScenePreloaded,
        loadScene,
        preloadScene,
        preloadScenes,
        reloadScene,
        setCacheBudgetBytes: budgetBytes => {
            assertAvailable();
            if (!snapshotSerializer || typeof snapshotSerializer.setCacheBudgetBytes !== 'function') {
                const nextError = new Error('Scene cache configuration is not supported by this serializer.');
                nextError.code = 'SCENE_CACHE_CONFIGURATION_UNSUPPORTED';
                throw nextError;
            }
            return snapshotSerializer.setCacheBudgetBytes(budgetBytes);
        },
        setActiveScene: async (sceneId, options = {}) => loadScene(sceneId, options),
        subscribe: listener => {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        unloadScene
    });
};

module.exports = {
    createSceneRuntimeManager
};
