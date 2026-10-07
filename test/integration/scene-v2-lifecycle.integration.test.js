'use strict';

const VM = require('scratch-vm');

const {
    MODULE_PERMISSIONS,
    createModuleManager,
    registerBuiltInModules
} = require('../../src/lib/first-party-modules');
const {createVMProjectIOService} = require('../../src/lib/first-party-modules/vm-project-io-service');
const {installNodeDatabase} = require('../../src/lib/project-nodes/node-database');
const {installProjectPersistence} = require('../../src/lib/project-inspector/project-persistence');
const {getSceneSnapshotProjection} = require('../../src/lib/project-explorer/scene-snapshot-projection');
const {RUNTIME_NODE_MODEL_CAPABILITY_ID} = require('../../src/lib/runtime-nodes/constants');
const {
    createPortableProjectPayload,
    encodeBase64Bytes,
    toUint8Array
} = require('../../src/lib/first-party-modules/portable-project-files');
const {createBlankSceneFiles} = require('../../src/lib/scene-system/blank-scene-project');
const {
    SCENE_CONTROLLER_CAPABILITY_ID,
    SCENE_SYSTEM_MODULE_ID,
    SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID
} = require('../../src/lib/scene-system/constants');

const createPortablePayloadFromFiles = async files => {
    const records = [];
    for (const name of Object.keys(files).sort()) {
        const bytes = await toUint8Array(files[name], name);
        records.push({data: encodeBase64Bytes(bytes), name});
    }
    return createPortableProjectPayload(records);
};

describe('Scene V2 lifecycle integration', () => {
    test('real VM creates, switches, disables, re-enables and switches scenes through primitive controller protocol', async () => {
        const vm = new VM();
        const projectIO = createVMProjectIOService(vm);
        const initialPayload = await createPortablePayloadFromFiles(createBlankSceneFiles({stageName: 'Initial Stage'}));
        await projectIO.restorePortableProject(initialPayload, {emitProjectLoaded: false, stopRuntime: false});

        const manager = createModuleManager({
            services: {
                runtime: {permission: MODULE_PERMISSIONS.RUNTIME, value: vm.runtime},
                vm: {permission: MODULE_PERMISSIONS.RUNTIME, value: vm},
                'vm-project-io': {permission: MODULE_PERMISSIONS.RUNTIME, value: projectIO}
            }
        });

        try {
            registerBuiltInModules(manager);
            manager.initializeAll();
            manager.enableDefaults({silent: true});
            manager.enableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});

            const controller = manager.client.getCapability(SCENE_CONTROLLER_CAPABILITY_ID);
            const initialView = JSON.parse(controller.getViewStateJSON());
            expect(initialView.scenes).toHaveLength(1);
            const firstSceneId = initialView.scenes[0].id;

            const secondScene = JSON.parse(await controller.execute(
                'create-and-load',
                JSON.stringify({name: 'Scene Two'})
            ));
            expect(secondScene.id).toBeTruthy();

            let view = JSON.parse(controller.getViewStateJSON());
            expect(view.loadedSceneId).toBe(secondScene.id);
            expect(view.scenes).toHaveLength(2);

            await controller.execute('enter', JSON.stringify({sceneId: firstSceneId}));
            view = JSON.parse(controller.getViewStateJSON());
            expect(view.loadedSceneId).toBe(firstSceneId);

            const runtimeNodeModelBeforeDisable = manager.client.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID);
            const scratchAdapterBeforeDisable = manager.client.getCapability(SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID);
            const runtimeNodeTeardown = runtimeNodeModelBeforeDisable.subscribe(() => {});
            const scratchAdapterTeardown = scratchAdapterBeforeDisable.subscribe(() => {});

            manager.disableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});
            expect(manager.client.getModuleState(SCENE_SYSTEM_MODULE_ID).enabled).toBe(false);
            expect(() => runtimeNodeModelBeforeDisable.listNodes()).toThrow(
                expect.objectContaining({code: 'MODULE_CAPABILITY_AUTHORITY_REVOKED'})
            );
            expect(() => scratchAdapterBeforeDisable.listBindings()).toThrow(
                expect.objectContaining({code: 'MODULE_CAPABILITY_AUTHORITY_REVOKED'})
            );
            expect(typeof runtimeNodeTeardown.apply).toBe('function');
            expect(typeof scratchAdapterTeardown.apply).toBe('function');
            expect(() => runtimeNodeTeardown.apply(undefined)).not.toThrow();
            expect(() => scratchAdapterTeardown.apply(undefined)).not.toThrow();
            expect(runtimeNodeTeardown()).toBe(false);
            expect(scratchAdapterTeardown()).toBe(false);

            manager.enableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});
            const reenabledController = manager.client.getCapability(SCENE_CONTROLLER_CAPABILITY_ID);
            const reenabledView = JSON.parse(reenabledController.getViewStateJSON());
            expect(reenabledView.scenes).toHaveLength(2);

            const thirdScene = JSON.parse(await reenabledController.execute(
                'create-and-load',
                JSON.stringify({name: 'Scene Three'})
            ));
            let finalView = JSON.parse(reenabledController.getViewStateJSON());
            expect(finalView.loadedSceneId).toBe(thirdScene.id);
            expect(finalView.scenes).toHaveLength(3);

            await reenabledController.execute('rename', JSON.stringify({sceneId: thirdScene.id, name: 'Final Scene'}));
            await reenabledController.execute('set-startup', JSON.stringify({sceneId: thirdScene.id}));
            const duplicate = JSON.parse(await reenabledController.execute(
                'duplicate-and-load',
                JSON.stringify({sceneId: thirdScene.id})
            ));
            expect(duplicate.id).not.toBe(thirdScene.id);

            await reenabledController.execute('move', JSON.stringify({sceneId: duplicate.id, index: 0}));
            finalView = JSON.parse(reenabledController.getViewStateJSON());
            expect(finalView.scenes[0].id).toBe(duplicate.id);
            expect(finalView.loadedSceneId).toBe(duplicate.id);
            expect(finalView.startupSceneId).toBe(thirdScene.id);
            expect(finalView.scenes.find(scene => scene.id === thirdScene.id).name).toBe('Final Scene');

            await reenabledController.execute('delete', JSON.stringify({sceneId: duplicate.id}));
            finalView = JSON.parse(reenabledController.getViewStateJSON());
            expect(finalView.scenes).toHaveLength(3);
            expect(finalView.scenes.some(scene => scene.id === duplicate.id)).toBe(false);
            expect(finalView.loadedSceneId).not.toBe(duplicate.id);
        } finally {
            manager.dispose();
        }
    });

    test('inactive scenes retain native and editor nodes for cross-scene projection without loading them', async () => {
        const vm = new VM();
        const nodeDatabase = installNodeDatabase(vm);
        installProjectPersistence(vm);
        const projectIO = createVMProjectIOService(vm);
        const initialPayload = await createPortablePayloadFromFiles(createBlankSceneFiles({stageName: 'Scope Stage'}));
        await projectIO.restorePortableProject(initialPayload, {emitProjectLoaded: false, stopRuntime: false});

        const manager = createModuleManager({
            services: {
                runtime: {permission: MODULE_PERMISSIONS.RUNTIME, value: vm.runtime},
                vm: {permission: MODULE_PERMISSIONS.RUNTIME, value: vm},
                'vm-project-io': {permission: MODULE_PERMISSIONS.RUNTIME, value: projectIO}
            }
        });

        try {
            registerBuiltInModules(manager);
            manager.initializeAll();
            manager.enableDefaults({silent: true});
            manager.enableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});

            const controller = manager.client.getCapability(SCENE_CONTROLLER_CAPABILITY_ID);
            const runtimeNodeModel = manager.client.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID);
            const firstSceneId = JSON.parse(controller.getViewStateJSON()).loadedSceneId;
            const secondScene = JSON.parse(await controller.execute(
                'create-and-load',
                JSON.stringify({name: 'Scene B'})
            ));

            const customB = nodeDatabase.createNode('ngvge.node2d', null, {name: 'Scene B Editor Node'});
            const sceneRootB = runtimeNodeModel.getSceneRoot(secondScene.id);
            const nativeResult = runtimeNodeModel.createNode('ngvge.node', {
                name: 'Scene B Native Node',
                parentId: sceneRootB.id,
                sceneId: secondScene.id,
                scope: 'scene'
            });
            expect(nativeResult.applied).toBe(true);

            await controller.execute('enter', JSON.stringify({sceneId: firstSceneId}));

            const sceneProject = manager.client.getModuleData(SCENE_SYSTEM_MODULE_ID, null);
            const inactiveScene = sceneProject.scenes.find(scene => scene.id === secondScene.id);
            const projection = getSceneSnapshotProjection(inactiveScene);
            expect(projection).toBeTruthy();
            expect(projection.source).toBe('metadata');
            expect(projection.nodes.some(node => node.id === customB.id && node.name === 'Scene B Editor Node')).toBe(true);
            expect(runtimeNodeModel.listNodes({sceneId: secondScene.id}).some(node => (
                node.name === 'Scene B Native Node'
            ))).toBe(true);
            expect(JSON.parse(controller.getViewStateJSON()).loadedSceneId).toBe(firstSceneId);
        } finally {
            manager.dispose();
        }
    });
});
