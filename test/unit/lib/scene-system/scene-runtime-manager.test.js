import {
    createSceneDataModelService,
    createSceneRuntimeManager
} from '../../../../src/lib/scene-system';

const createSnapshot = sceneId => ({
    archive: Buffer.from(`snapshot-${sceneId}`).toString('base64'),
    byteLength: 16,
    encoding: 'base64',
    format: 'ngvge-sb3-scene',
    metadata: {
        assetCount: 1,
        hasStage: true,
        projectVersion: 3,
        sceneId,
        spriteCount: 0,
        targetCount: 1
    },
    schemaVersion: 1
});

const createContext = () => {
    let data = null;
    const listeners = new Set();
    return {
        data: {
            get: fallback => data || fallback,
            set: value => {
                data = JSON.parse(JSON.stringify(value));
                listeners.forEach(listener => listener({moduleId: 'ngvge.scene-system'}));
            },
            subscribe: listener => {
                listeners.add(listener);
                return () => listeners.delete(listener);
            }
        },
        moduleId: 'ngvge.scene-system',
        vm: {stopAll: jest.fn()}
    };
};

const createRuntimeHarness = () => {
    const context = createContext();
    const dataModel = createSceneDataModelService(context);
    dataModel.ensureProject();
    const project = dataModel.readProject();
    project.scenes[0].snapshot = createSnapshot(project.scenes[0].id);
    const secondScene = dataModel.createScene({name: 'Second'});
    secondScene.snapshot = createSnapshot(secondScene.id);
    project.scenes.push(secondScene);
    dataModel.writeProject(project);

    const preloaded = new Set();
    let resolvePreload;
    const snapshotSerializer = {
        captureScene: jest.fn(() => Promise.resolve()),
        getCacheConfiguration: jest.fn(() => ({budgetBytes: null, mode: 'automatic'})),
        getCacheStatus: jest.fn(() => ({budgetBytes: 32 * 1024 * 1024})),
        getRecommendedPreloadCount: jest.fn(() => 1),
        isScenePreloaded: jest.fn(sceneId => preloaded.has(sceneId)),
        preloadScene: jest.fn(sceneId => new Promise(resolve => {
            resolvePreload = () => {
                preloaded.add(sceneId);
                resolve({cacheHit: false, materialized: true, preloaded: true});
            };
        })),
        restoreScene: jest.fn(sceneId => Promise.resolve({
            cacheHit: preloaded.has(sceneId),
            materialized: preloaded.has(sceneId),
            restored: true
        })),
        setActiveScene: jest.fn(),
        setCacheBudgetBytes: jest.fn(budgetBytes => ({budgetBytes}))
    };
    const runtime = createSceneRuntimeManager(context, dataModel, snapshotSerializer);
    return {dataModel, resolvePreload: () => resolvePreload(), runtime, secondScene, snapshotSerializer};
};

describe('NGVGE scene runtime preloading', () => {
    test('deduplicates preload requests and reports cache hits during scene loading', async () => {
        const harness = createRuntimeHarness();
        const firstRequest = harness.runtime.preloadScene(harness.secondScene.id);
        const secondRequest = harness.runtime.preloadScene(harness.secondScene.id);

        expect(firstRequest).toBe(secondRequest);
        expect(harness.snapshotSerializer.preloadScene).toHaveBeenCalledTimes(1);
        expect(harness.runtime.getStatus().preloadingSceneIds).toEqual([harness.secondScene.id]);

        harness.resolvePreload();
        await firstRequest;

        expect(harness.runtime.isPreloaded(harness.secondScene.id)).toBe(true);
        expect(harness.runtime.getStatus().preloadingSceneIds).toEqual([]);

        const loadResult = await harness.runtime.loadScene(harness.secondScene.id, {preloadAdjacent: false});

        expect(loadResult).toMatchObject({cacheHit: true, materialized: true, restored: true});
        expect(harness.snapshotSerializer.captureScene).toHaveBeenCalledTimes(1);
        expect(harness.snapshotSerializer.restoreScene).toHaveBeenCalledWith(harness.secondScene.id, {});
        expect(harness.snapshotSerializer.setActiveScene).toHaveBeenLastCalledWith(harness.secondScene.id);
        expect(harness.runtime.getRecommendedPreloadCount()).toBe(1);
        expect(harness.runtime.getCacheStatus()).toEqual({budgetBytes: 32 * 1024 * 1024});
        expect(harness.runtime.setCacheBudgetBytes(8 * 1024 * 1024)).toEqual({budgetBytes: 8 * 1024 * 1024});
    });
});
