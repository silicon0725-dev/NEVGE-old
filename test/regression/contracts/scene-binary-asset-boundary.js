'use strict';

const assert = require('assert');
const VM = require('scratch-vm');
const {runInNewContext} = require('vm');

const {
    MODULE_PERMISSIONS,
    createModuleManager,
    registerBuiltInModules
} = require('../../../src/lib/first-party-modules');
const {createVMProjectIOService} = require('../../../src/lib/first-party-modules/vm-project-io-service');
const {parsePortableProjectPayload} = require('../../../src/lib/first-party-modules/portable-project-files');
const {
    BLANK_BACKDROP_FILE_NAME,
    BLANK_BACKDROP_SVG,
    createBlankSceneProjectJSON
} = require('../../../src/lib/scene-system/blank-scene-project');
const {
    SCENE_MANAGER_CAPABILITY_ID,
    SCENE_RUNTIME_CAPABILITY_ID,
    SCENE_SNAPSHOT_FORMAT,
    SCENE_SNAPSHOT_SCHEMA_VERSION,
    SCENE_SYSTEM_MODULE_ID
} = require('../../../src/lib/scene-system/constants');

const assertSceneBinaryAssetBoundaryContract = async () => {
    const vm = new VM();
    const projectJSON = createBlankSceneProjectJSON();
    const encodedProject = new TextEncoder().encode(JSON.stringify(projectJSON));
    const assetBytes = Array.from(new TextEncoder().encode(BLANK_BACKDROP_SVG));
    const encodedAsset = runInNewContext(`new Uint8Array(${JSON.stringify(assetBytes)})`);
    assert.strictEqual(
        encodedAsset instanceof Uint8Array,
        false,
        'Regression fixture must use a cross-realm Uint8Array to exercise binary brand isolation.'
    );
    assert.strictEqual(ArrayBuffer.isView(encodedAsset), true);

    const jsZipFailure = new Error(
        `Can't read the data of '${BLANK_BACKDROP_FILE_NAME}'. ` +
        'Is it in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?'
    );
    let archiveSerializationCalls = 0;
    let hostRawFileCaptureCalls = 0;

    vm.saveProjectSb3 = () => {
        archiveSerializationCalls += 1;
        return Promise.reject(jsZipFailure);
    };
    vm.saveProjectSb3DontZip = () => {
        hostRawFileCaptureCalls += 1;
        return {
            [BLANK_BACKDROP_FILE_NAME]: encodedAsset,
            'project.json': encodedProject
        };
    };

    const manager = createModuleManager({
        services: {
            runtime: {permission: MODULE_PERMISSIONS.RUNTIME, value: vm.runtime},
            vm: {permission: MODULE_PERMISSIONS.RUNTIME, value: vm},
            'vm-project-io': {
                permission: MODULE_PERMISSIONS.RUNTIME,
                value: createVMProjectIOService(vm)
            }
        }
    });

    try {
        registerBuiltInModules(manager);
        manager.initializeAll();
        manager.enableDefaults({silent: true});
        manager.enableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});

        const sceneManager = manager.client.getCapability(SCENE_MANAGER_CAPABILITY_ID);
        const sceneRuntime = manager.client.getCapability(SCENE_RUNTIME_CAPABILITY_ID);
        const originalScene = sceneManager.listScenes()[0];
        const created = await sceneManager.createScene({name: 'Binary Boundary Regression'});

        await sceneRuntime.loadScene(created.id, {preloadAdjacent: false});

        assert.strictEqual(
            archiveSerializationCalls,
            0,
            'Scene V2 capture/load must not call vm.saveProjectSb3() or depend on VM-side JSZip archive serialization.'
        );
        assert(
            hostRawFileCaptureCalls > 0,
            'The Host Project I/O service must capture raw VM files before converting them to portable text.'
        );
        assert.strictEqual(sceneRuntime.isLoaded(created.id), true, 'The created scene must become loaded.');

        const capturedOriginal = sceneManager.getScene(originalScene.id);
        assert(capturedOriginal.snapshot, 'The previously loaded scene must be captured before switching.');
        assert.strictEqual(capturedOriginal.snapshot.format, SCENE_SNAPSHOT_FORMAT);
        assert.strictEqual(capturedOriginal.snapshot.schemaVersion, SCENE_SNAPSHOT_SCHEMA_VERSION);
        assert.strictEqual(typeof capturedOriginal.snapshot.payload, 'string');
        assert.strictEqual(
            Object.prototype.hasOwnProperty.call(capturedOriginal.snapshot, 'archive'),
            false,
            'New Scene V2 snapshots must not persist SB3 archive fields.'
        );

        const portable = parsePortableProjectPayload(capturedOriginal.snapshot.payload);
        const asset = portable.files.find(file => file.name === BLANK_BACKDROP_FILE_NAME);
        assert(asset, 'The default SVG asset must survive Scene V2 capture.');
        assert.strictEqual(typeof asset.data, 'string', 'Portable assets must be Base64 strings at the module boundary.');
        assert(asset.data.length > 0, 'Portable SVG data must not be empty.');
        assert.strictEqual(
            capturedOriginal.snapshot.metadata.assetCount,
            1,
            'The binary SVG asset must survive capture through portable VM Project I/O.'
        );

        return {
            assetCount: capturedOriginal.snapshot.metadata.assetCount,
            crossRealmAsset: true,
            loadedScene: true,
            hostRawFileCapture: true,
            portableFilePayload: true,
            snapshotSchemaVersion: capturedOriginal.snapshot.schemaVersion,
            rawTypedArrayBoundaryCrossing: false,
            vmJsZipDependency: false
        };
    } finally {
        if (manager && typeof manager.dispose === 'function') manager.dispose();
    }
};

module.exports = {
    assertSceneBinaryAssetBoundaryContract
};
