import {
    SCENE_MANAGER_CAPABILITY_ID,
    createSceneDataModelService,
    createSceneManager
} from '../../../../src/lib/scene-system';

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
        moduleId: 'ngvge.scene-system'
    };
};

const createSnapshot = sceneId => ({
    archive: 'ZmFrZS16aXA=',
    byteLength: 8,
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

const createServices = () => {
    const context = createContext();
    const dataModel = createSceneDataModelService(context);
    dataModel.ensureProject();
    let loadedSceneId = dataModel.readProject().activeSceneId;
    const snapshotSerializer = {
        captureScene: jest.fn(async sceneId => {
            const project = dataModel.readProject();
            project.scenes.find(scene => scene.id === sceneId).snapshot = createSnapshot(sceneId);
            dataModel.writeProject(project);
            return createSnapshot(sceneId);
        }),
        createBlankSnapshot: jest.fn(async options => createSnapshot(options.sceneId))
    };
    const sceneRuntime = {
        isLoaded: sceneId => loadedSceneId === sceneId,
        loadScene: jest.fn(async sceneId => {
            loadedSceneId = sceneId;
            return {loadedSceneId};
        })
    };
    let id = 0;
    const manager = createSceneManager(context, dataModel, snapshotSerializer, sceneRuntime, {
        nowFactory: () => '2026-08-04T00:00:00.000Z',
        sceneIdFactory: () => `scene-test-${++id}`
    });
    return {dataModel, manager, sceneRuntime, snapshotSerializer};
};

describe('NGVGE scene manager', () => {
    test('creates loadable blank scenes and returns snapshot-free list summaries', async () => {
        const {manager, snapshotSerializer} = createServices();
        const created = await manager.createScene({name: 'Battle'});

        expect(manager.capabilityId).toBe(SCENE_MANAGER_CAPABILITY_ID);
        expect(created.name).toBe('Battle');
        expect(created.snapshot.metadata.sceneId).toBe(created.id);
        expect(snapshotSerializer.createBlankSnapshot).toHaveBeenCalledWith(expect.objectContaining({
            sceneId: created.id
        }));

        const summary = manager.listScenes().find(scene => scene.id === created.id);
        expect(summary).toMatchObject({hasSnapshot: true, name: 'Battle'});
        expect(summary.snapshot).toBeUndefined();
        expect(manager.count()).toBe(2);
        expect(manager.exists(created.id)).toBe(true);
    });

    test('renames, duplicates and reorders scenes using stable ids', async () => {
        const {manager} = createServices();
        const battle = await manager.createScene({name: 'Battle'});
        const duplicate = await manager.duplicateScene(battle.id);

        expect(duplicate.id).not.toBe(battle.id);
        expect(duplicate.name).toBe('Battle Copy');
        expect(duplicate.snapshot.metadata.sceneId).toBe(duplicate.id);

        manager.renameScene(duplicate.id, 'Battle Variant');
        expect(manager.getScene(duplicate.id).name).toBe('Battle Variant');
        expect(() => manager.renameScene(duplicate.id, 'Battle')).toThrow(/already exists/i);

        manager.moveScene(duplicate.id, 0);
        expect(manager.listScenes()[0].id).toBe(duplicate.id);
    });


    test('captures the latest state before duplicating a loaded scene', async () => {
        const {manager, snapshotSerializer} = createServices();
        const source = manager.getActiveScene();

        const duplicate = await manager.duplicateScene(source.id);

        expect(snapshotSerializer.captureScene).toHaveBeenCalledWith(source.id, {});
        expect(duplicate.snapshot.metadata.sceneId).toBe(duplicate.id);
    });

    test('deleting the sole loaded scene creates and loads a blank replacement', async () => {
        const {manager, sceneRuntime} = createServices();
        const original = manager.getActiveScene();
        const result = await manager.deleteScene(original.id);

        expect(result.replacementScene).not.toBeNull();
        expect(result.replacementScene.id).not.toBe(original.id);
        expect(sceneRuntime.loadScene).toHaveBeenCalledWith(
            result.replacementScene.id,
            expect.objectContaining({captureCurrent: false})
        );
        expect(manager.count()).toBe(1);
        expect(manager.getActiveScene().id).toBe(result.replacementScene.id);
        expect(manager.exists(original.id)).toBe(false);
    });

    test('setActiveScene changes project selection without invoking runtime loading', async () => {
        const {manager, sceneRuntime} = createServices();
        const created = await manager.createScene({name: 'Menu'});
        manager.setActiveScene(created.id);

        expect(manager.getActiveScene().id).toBe(created.id);
        expect(sceneRuntime.loadScene).not.toHaveBeenCalled();
    });


    test('setStartupScene changes the project startup scene without loading it', async () => {
        const {manager, sceneRuntime} = createServices();
        const originalStartup = manager.listScenes().find(scene => scene.isStartup);
        const created = await manager.createScene({name: 'Intro'});

        manager.setStartupScene(created.id);

        const scenes = manager.listScenes();
        expect(scenes.find(scene => scene.id === created.id).isStartup).toBe(true);
        expect(scenes.find(scene => scene.id === originalStartup.id).isStartup).toBe(false);
        expect(sceneRuntime.loadScene).not.toHaveBeenCalled();
    });
});
