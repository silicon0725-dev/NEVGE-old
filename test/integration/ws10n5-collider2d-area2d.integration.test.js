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
    COLLIDER2D_COMMAND_CAPABILITY_ID,
    COLLIDER2D_RUNTIME_CAPABILITY_ID,
    createCollider2DEditorClient
} = require('../../src/lib/collision-system');
const {
    TRANSFORM2D_COMMAND_CAPABILITY_ID,
    createTransform2DEditorClient
} = require('../../src/lib/transform-system');
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

describe('WS-10N5 Collider2D / Area2D integration', () => {
    test('creates native Area2D nodes, queries overlap, and follows Transform2D without Scratch targets', async () => {
        const vm = new VM();
        const projectIO = createVMProjectIOService(vm);
        const initialPayload = await createPortablePayloadFromFiles(createBlankSceneFiles({stageName: 'Stage'}));
        await projectIO.restorePortableProject(initialPayload, {emitProjectLoaded: false, stopRuntime: false});
        vm.attachRenderer(makeRenderer());
        const targetCountBefore = vm.runtime.targets.length;

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
            const colliderRuntime = manager.client.getCapability(COLLIDER2D_RUNTIME_CAPABILITY_ID);
            const colliderCommand = manager.client.getCapability(COLLIDER2D_COMMAND_CAPABILITY_ID);
            const transformCommand = manager.client.getCapability(TRANSFORM2D_COMMAND_CAPABILITY_ID);
            expect(colliderRuntime).not.toBeNull();
            expect(colliderCommand).not.toBeNull();

            const archetypes = materializePortableCapabilityValue(creation.listArchetypes({scope: 'scene'}));
            expect(archetypes.map(item => item.id)).toContain(FUNCTIONAL_NODE_ARCHETYPE_IDS.AREA_2D);
            const project = manager.client.getModuleData(SCENE_SYSTEM_MODULE_ID, null);
            const sceneRoot = runtimeNodeModel.getSceneRoot(project.activeSceneId);
            const nodeClient = createRuntimeNodeEditorClient(nodeCommand);

            const createArea = async name => {
                const plan = materializePortableCapabilityValue(creation.createPlan(
                    FUNCTIONAL_NODE_ARCHETYPE_IDS.AREA_2D,
                    {name, sceneId: project.activeSceneId, scope: 'scene'}
                ));
                return unwrapRuntimeNodeCommandResultAsync(nodeClient.createNode({
                    options: Object.assign({}, plan.options, {parentId: sceneRoot.id}),
                    typeId: plan.runtimeTypeId
                }));
            };

            const first = await createArea('Hitbox');
            const second = await createArea('Hurtbox');
            expect(vm.runtime.targets).toHaveLength(targetCountBefore);
            expect(first.node.components.map(component => component.typeId)).toEqual([
                'ngvge.transform2d',
                'ngvge.collider2d'
            ]);
            expect(first.node.components.find(component => component.typeId === 'ngvge.collider2d').data.sensor).toBe(true);
            expect(colliderRuntime.overlaps(first.node.id, second.node.id)).toBe(true);

            const events = [];
            const unsubscribe = colliderRuntime.subscribe(event => {
                if (event.type === 'area:enter' || event.type === 'area:exit') events.push(event);
            });
            const secondTransform = second.node.components.find(component => component.typeId === 'ngvge.transform2d');
            const transformEditor = createTransform2DEditorClient(transformCommand);
            const moved = transformEditor.patchComponent({
                componentId: secondTransform.id,
                nodeId: second.node.id,
                patch: {position: [250, 0]}
            });
            expect(moved.kind).toBe('event');
            expect(colliderRuntime.overlaps(first.node.id, second.node.id)).toBe(false);
            expect(events.some(event => event.type === 'area:exit' && event.areaNodeId === first.node.id &&
                event.otherNodeId === second.node.id)).toBe(true);

            const firstCollider = first.node.components.find(component => component.typeId === 'ngvge.collider2d');
            const colliderEditor = createCollider2DEditorClient(colliderCommand);
            const patched = colliderEditor.patchComponent({
                componentId: firstCollider.id,
                nodeId: first.node.id,
                patch: {shape: {type: 'circle', radius: 30}}
            });
            expect(patched.kind).toBe('event');
            expect(materializePortableCapabilityValue(colliderRuntime.getCollider(first.node.id)).config.shape)
                .toEqual({type: 'circle', radius: 30});
            expect(colliderRuntime.queryPoint([0, 0]).map(hit => hit.nodeId)).toContain(first.node.id);
            expect(colliderRuntime.raycast([-100, 0], [100, 0]).nodeId).toBe(first.node.id);
            unsubscribe();
        } finally {
            manager.dispose();
        }
    });
});
