'use strict';

const VM = require('scratch-vm');

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
const {COLLIDER2D_RUNTIME_CAPABILITY_ID} = require('../../src/lib/collision-system');
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

const componentOf = (node, typeId) => node.components.find(component => component.typeId === typeId);

describe('WS-10N6-HF1 semantic-parent Collider2D world projection', () => {
    test('Scratch-bound parent transforms place child StaticBody2D/CharacterBody2D in distinct world positions', async () => {
        const vm = new VM();
        const projectIO = createVMProjectIOService(vm);
        const initialPayload = await createPortablePayloadFromFiles(createBlankSceneFiles({stageName: 'Stage'}));
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
            manager.client.enableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});

            const creation = manager.client.getCapability(FUNCTIONAL_NODE_CREATION_CAPABILITY_ID);
            const runtimeNodeModel = manager.client.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID);
            const colliderRuntime = manager.client.getCapability(COLLIDER2D_RUNTIME_CAPABILITY_ID);
            const nodeClient = createRuntimeNodeEditorClient(
                manager.client.getCapability(RUNTIME_NODE_COMMAND_CAPABILITY_ID)
            );
            const transformEditor = createTransform2DEditorClient(
                manager.client.getCapability(TRANSFORM2D_COMMAND_CAPABILITY_ID)
            );
            const project = manager.client.getModuleData(SCENE_SYSTEM_MODULE_ID, null);
            const sceneRoot = runtimeNodeModel.getSceneRoot(project.activeSceneId);

            const createNode = async (archetypeId, name, parentId) => {
                const plan = materializePortableCapabilityValue(creation.createPlan(archetypeId, {
                    name,
                    sceneId: project.activeSceneId,
                    scope: 'scene'
                }));
                return unwrapRuntimeNodeCommandResultAsync(nodeClient.createNode({
                    options: Object.assign({}, plan.options, {parentId}),
                    typeId: plan.runtimeTypeId
                }));
            };
            const patchTransform = (created, position) => transformEditor.patchComponent({
                componentId: componentOf(created.node, 'ngvge.transform2d').id,
                nodeId: created.node.id,
                patch: {position}
            });

            const leftSprite = await createNode(FUNCTIONAL_NODE_ARCHETYPE_IDS.SPRITE_2D, 'edge', sceneRoot.id);
            const rightSprite = await createNode(FUNCTIONAL_NODE_ARCHETYPE_IDS.SPRITE_2D, 'edge2', sceneRoot.id);
            patchTransform(leftSprite, [-120, 0]);
            patchTransform(rightSprite, [120, 0]);

            const staticBody = await createNode(
                FUNCTIONAL_NODE_ARCHETYPE_IDS.STATIC_BODY_2D,
                'StaticBody2D',
                leftSprite.node.id
            );
            const characterBody = await createNode(
                FUNCTIONAL_NODE_ARCHETYPE_IDS.CHARACTER_BODY_2D,
                'CharacterBody2D',
                rightSprite.node.id
            );

            const leftCollider = materializePortableCapabilityValue(colliderRuntime.getCollider(staticBody.node.id));
            const rightCollider = materializePortableCapabilityValue(colliderRuntime.getCollider(characterBody.node.id));
            expect(leftCollider.worldOrigin[0]).toBeCloseTo(-120);
            expect(rightCollider.worldOrigin[0]).toBeCloseTo(120);
            expect(colliderRuntime.overlaps(characterBody.node.id, staticBody.node.id)).toBe(false);

            patchTransform(rightSprite, [-120, 0]);
            expect(colliderRuntime.overlaps(characterBody.node.id, staticBody.node.id)).toBe(true);
        } finally {
            manager.dispose();
        }
    });
});
