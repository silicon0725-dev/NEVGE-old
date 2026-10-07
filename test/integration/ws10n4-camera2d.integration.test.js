'use strict';

const {EventEmitter} = require('events');
const VM = require('scratch-vm');
const twgl = require('twgl.js');

const {
    MODULE_PERMISSIONS,
    createModuleManager,
    registerBuiltInModules
} = require('../../src/lib/first-party-modules');
const {materializePortableCapabilityValue} = require(
    '../../src/lib/first-party-modules/materialize-portable-capability-value'
);
const {createVMProjectIOService} = require('../../src/lib/first-party-modules/vm-project-io-service');
const {
    createPortableProjectPayload,
    encodeBase64Bytes,
    toUint8Array
} = require('../../src/lib/first-party-modules/portable-project-files');
const {FUNCTIONAL_NODE_ARCHETYPE_IDS} = require('../../src/core/functional-node');
const {FUNCTIONAL_NODE_CREATION_CAPABILITY_ID} = require('../../src/lib/functional-node');
const {
    RUNTIME_NODE_COMMAND_CAPABILITY_ID,
    createRuntimeNodeEditorClient,
    unwrapRuntimeNodeCommandResultAsync
} = require('../../src/lib/runtime-nodes');
const {
    CAMERA2D_COMMAND_CAPABILITY_ID,
    CAMERA2D_RUNTIME_CAPABILITY_ID,
    createCamera2DEditorClient
} = require('../../src/lib/camera-system');
const {createBlankSceneFiles} = require('../../src/lib/scene-system/blank-scene-project');
const {
    RUNTIME_NODE_MODEL_CAPABILITY_ID,
    SCENE_SYSTEM_MODULE_ID
} = require('../../src/lib/scene-system/constants');

const createPortablePayloadFromFiles = async files => {
    const records = [];
    for (const name of Object.keys(files).sort()) {
        records.push({data: encodeBase64Bytes(await toUint8Array(files[name], name)), name});
    }
    return createPortableProjectPayload(records);
};

const makeRenderer = () => {
    const renderer = new EventEmitter();
    renderer.exports = {twgl};
    renderer._nativeSize = [480, 360];
    renderer._xLeft = -240;
    renderer._xRight = 240;
    renderer._yBottom = -180;
    renderer._yTop = 180;
    renderer._projection = twgl.m4.ortho(-240, 240, -180, 180, -1, 1);
    renderer.offscreenDrawableCulling = true;
    renderer.setLayerGroupOrdering = jest.fn();
    renderer.dirty = false;
    return renderer;
};

describe('WS-10N4 Camera2D integration', () => {
    test('admits a native Camera2D, drives Scratch renderer projection, and keeps Legacy Sprite count unchanged', async () => {
        const vm = new VM();
        const projectIO = createVMProjectIOService(vm);
        const initialPayload = await createPortablePayloadFromFiles(createBlankSceneFiles({stageName: 'Stage'}));
        await projectIO.restorePortableProject(initialPayload, {emitProjectLoaded: false, stopRuntime: false});
        vm.attachRenderer(makeRenderer());
        const targetCountBefore = vm.runtime.targets.length;
        const baselineProjection = Array.from(vm.renderer._projection);

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
            manager.client.enableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});

            const creation = manager.client.getCapability(FUNCTIONAL_NODE_CREATION_CAPABILITY_ID);
            const runtimeNodeModel = manager.client.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID);
            const nodeCommand = manager.client.getCapability(RUNTIME_NODE_COMMAND_CAPABILITY_ID);
            const cameraRuntime = manager.client.getCapability(CAMERA2D_RUNTIME_CAPABILITY_ID);
            const cameraCommand = manager.client.getCapability(CAMERA2D_COMMAND_CAPABILITY_ID);
            expect(cameraRuntime).not.toBeNull();
            expect(cameraCommand).not.toBeNull();

            const archetypes = materializePortableCapabilityValue(creation.listArchetypes({scope: 'scene'}));
            const archetypeIds = archetypes.map(item => item.id);
            [
                FUNCTIONAL_NODE_ARCHETYPE_IDS.NODE_2D,
                FUNCTIONAL_NODE_ARCHETYPE_IDS.SPRITE_2D,
                FUNCTIONAL_NODE_ARCHETYPE_IDS.CAMERA_2D,
                FUNCTIONAL_NODE_ARCHETYPE_IDS.AREA_2D
            ].forEach(archetypeId => expect(archetypeIds).toContain(archetypeId));

            const project = manager.client.getModuleData(SCENE_SYSTEM_MODULE_ID, null);
            const sceneRoot = runtimeNodeModel.getSceneRoot(project.activeSceneId);
            const plan = materializePortableCapabilityValue(creation.createPlan(
                FUNCTIONAL_NODE_ARCHETYPE_IDS.CAMERA_2D,
                {name: 'Main Camera', sceneId: project.activeSceneId, scope: 'scene'}
            ));
            const nodeClient = createRuntimeNodeEditorClient(nodeCommand);
            const created = await unwrapRuntimeNodeCommandResultAsync(nodeClient.createNode({
                options: Object.assign({}, plan.options, {parentId: sceneRoot.id}),
                typeId: plan.runtimeTypeId
            }));

            expect(created.node.name).toBe('Main Camera');
            expect(vm.runtime.targets).toHaveLength(targetCountBefore);
            expect(materializePortableCapabilityValue(cameraRuntime.getViewportState()).activeCameraNodeId)
                .toBe(created.node.id);

            const cameraComponent = created.node.components.find(component => component.typeId === 'ngvge.camera2d');
            const editor = createCamera2DEditorClient(cameraCommand);
            const result = editor.patchComponent({
                componentId: cameraComponent.id,
                nodeId: created.node.id,
                patch: {zoom: [2, 2]}
            });
            expect(result.kind).toBe('event');
            expect(Array.from(vm.renderer._projection)).not.toEqual(baselineProjection);
            expect(vm.renderer.offscreenDrawableCulling).toBe(false);

            editor.patchComponent({
                componentId: cameraComponent.id,
                nodeId: created.node.id,
                patch: {enabled: false}
            });
            expect(materializePortableCapabilityValue(cameraRuntime.getViewportState()).activeCameraNodeId).toBeNull();
            expect(Array.from(vm.renderer._projection)).toEqual(baselineProjection);
            expect(vm.renderer.offscreenDrawableCulling).toBe(true);
        } finally {
            manager.dispose();
        }
    });
});
