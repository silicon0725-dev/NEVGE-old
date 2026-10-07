'use strict';

const {EventEmitter} = require('events');
const VM = require('scratch-vm');
const twgl = require('twgl.js');

const {FUNCTIONAL_NODE_ARCHETYPE_IDS} = require('../../src/core/functional-node');
const {
    MODULE_PERMISSIONS,
    createModuleManager,
    registerBuiltInModules
} = require('../../src/lib/first-party-modules');
const {materializePortableCapabilityValue} = require('../../src/lib/first-party-modules/materialize-portable-capability-value');
const {createVMProjectIOService} = require('../../src/lib/first-party-modules/vm-project-io-service');
const {createPortableProjectPayload, encodeBase64Bytes, toUint8Array} = require('../../src/lib/first-party-modules/portable-project-files');
const {FUNCTIONAL_NODE_CREATION_CAPABILITY_ID} = require('../../src/lib/functional-node');
const {PHYSICS2D_RUNTIME_CAPABILITY_ID, RIGIDBODY2D_COMMAND_CAPABILITY_ID, createRigidBody2DEditorClient} = require('../../src/lib/physics-system');
const {RUNTIME_NODE_COMMAND_CAPABILITY_ID, createRuntimeNodeEditorClient, unwrapRuntimeNodeCommandResultAsync} = require('../../src/lib/runtime-nodes');
const {createBlankSceneFiles} = require('../../src/lib/scene-system/blank-scene-project');
const {RUNTIME_NODE_MODEL_CAPABILITY_ID, SCENE_SYSTEM_MODULE_ID} = require('../../src/lib/scene-system/constants');
const {TRANSFORM2D_COMMAND_CAPABILITY_ID, TRANSFORM2D_RUNTIME_CAPABILITY_ID, createTransform2DEditorClient} = require('../../src/lib/transform-system');
const {createTestPhysics2DBackendAdapter, createTestPhysics2DTracker} = require('../helpers/test-physics2d-backend-adapter');

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
    renderer._xLeft = -240; renderer._xRight = 240; renderer._yBottom = -180; renderer._yTop = 180;
    renderer._projection = twgl.m4.ortho(-240, 240, -180, 180, -1, 1);
    renderer.offscreenDrawableCulling = true;
    renderer.setLayerGroupOrdering = jest.fn();
    return renderer;
};
const componentOf = (node, typeId) => node.components.find(component => component.typeId === typeId);

describe('WS-10N8 Physics2D backend POC integration', () => {
    test('admits native RigidBody2D only after a backend adapter is ready and keeps backend handles outside semantic state', async () => {
        const vm = new VM();
        const projectIO = createVMProjectIOService(vm);
        await projectIO.restorePortableProject(await createPortablePayloadFromFiles(createBlankSceneFiles({stageName: 'Stage'})), {
            emitProjectLoaded: false,
            stopRuntime: false
        });
        vm.attachRenderer(makeRenderer());
        const targetCountBefore = vm.runtime.targets.length;
        const tracker = createTestPhysics2DTracker();
        const backendAdapter = createTestPhysics2DBackendAdapter(tracker);
        const manager = createModuleManager({services: {
            runtime: {permission: MODULE_PERMISSIONS.RUNTIME, value: vm.runtime},
            vm: {permission: MODULE_PERMISSIONS.RUNTIME, value: vm},
            'vm-project-io': {permission: MODULE_PERMISSIONS.RUNTIME, value: projectIO},
            'physics2d-backend-adapter': {permission: MODULE_PERMISSIONS.RUNTIME, value: backendAdapter}
        }});
        try {
            registerBuiltInModules(manager);
            manager.initializeAll();
            manager.enableDefaults({silent: true});
            manager.client.enableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});

            const physics = manager.client.getCapability(PHYSICS2D_RUNTIME_CAPABILITY_ID);
            expect(physics).not.toBeNull();
            await physics.initializeBackend();
            expect(materializePortableCapabilityValue(physics.getStatus())).toMatchObject({
                backendId: 'ngvge.physics2d.backend.test-contract',
                backendReady: true,
                backendState: 'ready'
            });

            const creation = manager.client.getCapability(FUNCTIONAL_NODE_CREATION_CAPABILITY_ID);
            const ids = materializePortableCapabilityValue(creation.listArchetypes({scope: 'scene'})).map(item => item.id);
            expect(ids).toContain(FUNCTIONAL_NODE_ARCHETYPE_IDS.RIGID_BODY_2D);

            const model = manager.client.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID);
            const nodeClient = createRuntimeNodeEditorClient(manager.client.getCapability(RUNTIME_NODE_COMMAND_CAPABILITY_ID));
            const project = manager.client.getModuleData(SCENE_SYSTEM_MODULE_ID, null);
            const root = model.getSceneRoot(project.activeSceneId);
            const plan = materializePortableCapabilityValue(creation.createPlan(FUNCTIONAL_NODE_ARCHETYPE_IDS.RIGID_BODY_2D, {
                name: 'Physics Ball', sceneId: project.activeSceneId, scope: 'scene'
            }));
            const created = await unwrapRuntimeNodeCommandResultAsync(nodeClient.createNode({
                options: Object.assign({}, plan.options, {parentId: root.id}),
                typeId: plan.runtimeTypeId
            }));
            expect(vm.runtime.targets).toHaveLength(targetCountBefore);
            expect(created.node.components.map(component => component.typeId)).toEqual([
                'ngvge.transform2d', 'ngvge.collider2d', 'ngvge.rigidbody2d'
            ]);

            const transformEditor = createTransform2DEditorClient(manager.client.getCapability(TRANSFORM2D_COMMAND_CAPABILITY_ID));
            transformEditor.patchComponent({
                componentId: componentOf(created.node, 'ngvge.transform2d').id,
                nodeId: created.node.id,
                patch: {position: [0, 100]}
            });
            const rigidEditor = createRigidBody2DEditorClient(manager.client.getCapability(RIGIDBODY2D_COMMAND_CAPABILITY_ID));
            expect(rigidEditor.patchComponent({
                componentId: componentOf(created.node, 'ngvge.rigidbody2d').id,
                nodeId: created.node.id,
                patch: {gravityScale: 1, mass: 2, velocity: [0, 0]}
            }).kind).toBe('event');

            const transforms = manager.client.getCapability(TRANSFORM2D_RUNTIME_CAPABILITY_ID);
            const authored = materializePortableCapabilityValue(transforms.getPersistentTransform(created.node.id));
            expect(authored.position).toEqual([0, 100]);

            physics.startSimulation();
            physics.stepFixed();
            const runtimeTransform = materializePortableCapabilityValue(transforms.getRuntimeTransform(created.node.id));
            expect(runtimeTransform.position[1]).toBeLessThan(100);
            const view = materializePortableCapabilityValue(physics.getRigidBody(created.node.id));
            expect(view.componentId).toBe(componentOf(created.node, 'ngvge.rigidbody2d').id);
            expect(view.state.backendHandlePresent).toBe(true);
            expect(view.state).not.toHaveProperty('backendHandle');
            expect(materializePortableCapabilityValue(transforms.getPersistentTransform(created.node.id)).position).toEqual([0, 100]);
            expect(tracker.lastDescriptors.some(item => item.bodyId === view.componentId && item.kind === 'dynamic')).toBe(true);

            physics.stopSimulation();
            expect(materializePortableCapabilityValue(transforms.getRuntimeTransform(created.node.id)).position).toEqual([0, 100]);
            expect(materializePortableCapabilityValue(physics.getRigidBody(created.node.id)).state.velocity).toEqual([0, 0]);
        } finally {
            manager.dispose();
        }
    });
});
