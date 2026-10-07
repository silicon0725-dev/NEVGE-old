import VM from 'scratch-vm';
import {runInNewContext} from 'vm';

import {
    MODULE_PERMISSIONS,
    createModuleManager,
    registerBuiltInModules
} from '../../../../src/lib/first-party-modules';
import {createVMProjectIOService} from '../../../../src/lib/first-party-modules/vm-project-io-service';
import {
    BLANK_BACKDROP_FILE_NAME,
    BLANK_BACKDROP_SVG,
    createBlankSceneProjectJSON
} from '../../../../src/lib/scene-system/blank-scene-project';
import {
    SCENE_MANAGER_CAPABILITY_ID,
    SCENE_RUNTIME_CAPABILITY_ID,
    SCENE_SYSTEM_MODULE_ID
} from '../../../../src/lib/scene-system/constants';

describe('NGVGE scene runtime Service boundary', () => {
    test('creates and restores a blank scene without sending JSZip across the module Service membrane', async () => {
        const vm = new VM();
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
        registerBuiltInModules(manager);
        manager.initializeAll();
        manager.enableDefaults({silent: true});
        manager.enableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});

        const sceneManager = manager.client.getCapability(SCENE_MANAGER_CAPABILITY_ID);
        const sceneRuntime = manager.client.getCapability(SCENE_RUNTIME_CAPABILITY_ID);
        const created = await sceneManager.createScene({name: 'Boundary Scene'});

        await expect(sceneRuntime.loadScene(created.id, {preloadAdjacent: false})).resolves.toBeDefined();
        expect(sceneRuntime.isLoaded(created.id)).toBe(true);
    });

    test('captures binary assets without relying on VM JSZip serialization across the module boundary', async () => {
        const vm = new VM();
        const projectJSON = createBlankSceneProjectJSON();
        const encodedProject = new TextEncoder().encode(JSON.stringify(projectJSON));
        const encodedAsset = runInNewContext(`new Uint8Array(${JSON.stringify(Array.from(new TextEncoder().encode(BLANK_BACKDROP_SVG)))})`);
        const jsZipFailure = new Error(
            `Can't read the data of '${BLANK_BACKDROP_FILE_NAME}'. ` +
            'Is it in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?'
        );

        const saveProjectSb3 = jest.fn(() => Promise.reject(jsZipFailure));
        const saveProjectSb3DontZip = jest.fn(() => ({
            [BLANK_BACKDROP_FILE_NAME]: encodedAsset,
            'project.json': encodedProject
        }));
        vm.saveProjectSb3 = saveProjectSb3;
        vm.saveProjectSb3DontZip = saveProjectSb3DontZip;

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
        registerBuiltInModules(manager);
        manager.initializeAll();
        manager.enableDefaults({silent: true});
        manager.enableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});

        const sceneManager = manager.client.getCapability(SCENE_MANAGER_CAPABILITY_ID);
        const sceneRuntime = manager.client.getCapability(SCENE_RUNTIME_CAPABILITY_ID);
        const originalScene = sceneManager.listScenes()[0];
        const created = await sceneManager.createScene({name: 'Binary Boundary Scene'});

        await expect(sceneRuntime.loadScene(created.id, {preloadAdjacent: false})).resolves.toBeDefined();
        expect(saveProjectSb3).not.toHaveBeenCalled();
        expect(saveProjectSb3DontZip).toHaveBeenCalled();
        expect(encodedAsset instanceof Uint8Array).toBe(false);
        expect(ArrayBuffer.isView(encodedAsset)).toBe(true);
        expect(sceneManager.getScene(originalScene.id).snapshot.metadata.assetCount).toBe(1);
    });

});
