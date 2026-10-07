import JSZip from '@turbowarp/jszip';

import {
    LEGACY_SCENE_SNAPSHOT_ENCODING,
    LEGACY_SCENE_SNAPSHOT_FORMAT,
    SCENE_SNAPSHOT_CAPABILITY_ID,
    createSceneDataModelService,
    createSceneSnapshotSerializer
} from '../../../../src/lib/scene-system';
import {
    createPortableProjectPayload,
    encodeBase64Bytes,
    encodeUTF8,
    parsePortableProjectPayload,
    readPortableTextFile
} from '../../../../src/lib/first-party-modules/portable-project-files';

const createContext = (vmProjectIO = null) => {
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
        getService: id => id === 'vm-project-io' ? vmProjectIO : null,
        moduleId: 'ngvge.scene-system'
    };
};

const makePayload = (projectJSON, assets = {'asset.svg': '<svg />'}) => createPortableProjectPayload([
    ...Object.keys(assets).map(name => ({
        data: encodeBase64Bytes(encodeUTF8(assets[name])),
        name
    })),
    {
        data: encodeBase64Bytes(encodeUTF8(JSON.stringify(projectJSON))),
        name: 'project.json'
    }
]);

describe('NGVGE scene snapshot serializer V2', () => {
    test('captures a portable payload, removes recursive module data and restores through Host Project I/O', async () => {
        const projectJSON = {
            ngvge: {
                projectSections: {
                    'ngvge-first-party-modules': {recursive: true},
                    'ngvge-node-tree': {
                        nodes: [
                            {childIds: ['child-node'], enabled: true, id: 'target-stage', name: 'Stage', parentId: null, typeId: 'ngvge.stage-target'},
                            {childIds: [], enabled: true, id: 'child-node', name: 'Camera Rig', parentId: 'target-stage', typeId: 'ngvge.node2d'}
                        ],
                        targetBindings: ['target-stage', null],
                        version: 1
                    }
                },
                version: 1
            },
            projectVersion: 3,
            targets: [
                {isStage: true, name: 'Stage'},
                {isStage: false, name: 'Sprite1'}
            ]
        };
        const payload = makePayload(projectJSON);
        const vmProjectIO = {
            capturePortableProject: jest.fn(async () => payload),
            restorePortableProject: jest.fn(async () => true)
        };
        const context = createContext(vmProjectIO);
        const dataModel = createSceneDataModelService(context);
        dataModel.ensureProject();
        const serializer = createSceneSnapshotSerializer(context, dataModel);

        expect(serializer.capabilityId).toBe(SCENE_SNAPSHOT_CAPABILITY_ID);
        const snapshot = await serializer.captureActiveScene({capturedAt: '2026-08-03T00:00:00.000Z'});
        expect(snapshot.metadata).toMatchObject({
            assetCount: 1,
            editorProjection: {
                nodes: expect.arrayContaining([expect.objectContaining({id: 'child-node', name: 'Camera Rig'})]),
                targets: expect.arrayContaining([expect.objectContaining({index: 0, nodeId: 'target-stage'})]),
                version: 1
            },
            spriteCount: 1,
            targetCount: 2
        });
        expect(snapshot.payload).toEqual(expect.any(String));
        const archivedProject = JSON.parse(readPortableTextFile(parsePortableProjectPayload(snapshot.payload), 'project.json'));
        expect(archivedProject.ngvge.projectSections['ngvge-first-party-modules']).toBeUndefined();
        expect(archivedProject.ngvge.projectSections['ngvge-node-tree']).toBeDefined();

        await serializer.restore(snapshot, {rollback: false});
        expect(vmProjectIO.restorePortableProject).toHaveBeenCalledWith(
            snapshot.payload,
            expect.objectContaining({emitProjectLoaded: true, stopRuntime: true})
        );
    });

    test('preloads a portable snapshot without materializing JSZip state inside the Scene module', async () => {
        const payload = makePayload({projectVersion: 3, targets: [{isStage: true, name: 'Stage'}]});
        const vmProjectIO = {
            capturePortableProject: jest.fn(async () => payload),
            restorePortableProject: jest.fn(async () => true)
        };
        const context = createContext(vmProjectIO);
        const dataModel = createSceneDataModelService(context);
        dataModel.ensureProject();
        const serializer = createSceneSnapshotSerializer(context, dataModel);
        const snapshot = await serializer.captureActiveScene();

        serializer.clearPreloadCache();
        const preloadResult = await serializer.preload(snapshot);
        const restoreResult = await serializer.restore(snapshot, {rollback: false});

        expect(preloadResult).toMatchObject({cacheHit: false, materialized: true, preloaded: true});
        expect(restoreResult).toMatchObject({cacheHit: true, materialized: true, restored: true});
        expect(serializer.isPreloaded(snapshot)).toBe(true);
    });

    test('requires the V2 Host portable project service and never falls back to raw VM objects', async () => {
        const context = createContext({restorePortableProject: jest.fn()});
        const dataModel = createSceneDataModelService(context);
        dataModel.ensureProject();
        const serializer = createSceneSnapshotSerializer(context, dataModel);

        await expect(serializer.captureActiveScene()).rejects.toMatchObject({
            code: 'SCENE_SNAPSHOT_VM_PROJECT_IO_V2_UNAVAILABLE'
        });
    });

    test('migrates a legacy V1 archive into the V2 portable payload on restore', async () => {
        const zip = new JSZip();
        zip.file('project.json', JSON.stringify({projectVersion: 3, targets: [{isStage: true, name: 'Stage'}]}));
        zip.file('asset.svg', '<svg />');
        const archive = await zip.generateAsync({type: 'base64'});
        const legacy = {
            archive,
            byteLength: archive.length,
            encoding: LEGACY_SCENE_SNAPSHOT_ENCODING,
            format: LEGACY_SCENE_SNAPSHOT_FORMAT,
            metadata: {sceneId: 'legacy'},
            schemaVersion: 1
        };
        const vmProjectIO = {
            capturePortableProject: jest.fn(async () => makePayload({projectVersion: 3, targets: []})),
            restorePortableProject: jest.fn(async () => true)
        };
        const context = createContext(vmProjectIO);
        const dataModel = createSceneDataModelService(context);
        dataModel.ensureProject();
        const serializer = createSceneSnapshotSerializer(context, dataModel);

        const result = await serializer.restore(legacy, {rollback: false});
        expect(result.migrated).toBe(true);
        const restoredPayload = vmProjectIO.restorePortableProject.mock.calls[0][0];
        expect(parsePortableProjectPayload(restoredPayload).files.map(file => file.name)).toEqual([
            'asset.svg', 'project.json'
        ]);
    });

    test('persists and resets a project-specific cache budget override', () => {
        const vmProjectIO = {capturePortableProject: jest.fn(), restorePortableProject: jest.fn()};
        const context = createContext(vmProjectIO);
        const dataModel = createSceneDataModelService(context);
        dataModel.ensureProject();
        const serializer = createSceneSnapshotSerializer(context, dataModel);

        expect(serializer.getCacheConfiguration()).toEqual({budgetBytes: null, mode: 'automatic'});
        serializer.setCacheBudgetBytes(24 * 1024 * 1024);
        expect(serializer.getCacheConfiguration()).toEqual({budgetBytes: 24 * 1024 * 1024, mode: 'configured'});
        serializer.setCacheBudgetBytes(null);
        expect(serializer.getCacheConfiguration()).toEqual({budgetBytes: null, mode: 'automatic'});
    });

    test('rolls the VM back using another portable payload when restore fails', async () => {
        const targetPayload = makePayload({marker: 'target', projectVersion: 3, targets: [{isStage: true, name: 'Stage'}]});
        const rollbackPayload = makePayload({marker: 'before', projectVersion: 3, targets: [{isStage: true, name: 'Stage'}]});
        const restoreFailure = new Error('target restore failed');
        const vmProjectIO = {
            capturePortableProject: jest.fn(async () => rollbackPayload),
            restorePortableProject: jest.fn()
                .mockRejectedValueOnce(restoreFailure)
                .mockResolvedValueOnce(true)
        };
        const context = createContext(vmProjectIO);
        const dataModel = createSceneDataModelService(context);
        dataModel.ensureProject();
        const serializer = createSceneSnapshotSerializer(context, dataModel);
        const snapshot = await serializer.createBlankSnapshot();
        snapshot.payload = targetPayload;

        let thrown = null;
        try {
            await serializer.restore(snapshot);
        } catch (nextError) {
            thrown = nextError;
        }

        expect(thrown).toBe(restoreFailure);
        expect(thrown.rollback).toEqual({attempted: true, error: null, succeeded: true});
        expect(vmProjectIO.restorePortableProject).toHaveBeenCalledTimes(2);
        expect(vmProjectIO.restorePortableProject.mock.calls[1][0]).toBe(rollbackPayload);
    });
});
