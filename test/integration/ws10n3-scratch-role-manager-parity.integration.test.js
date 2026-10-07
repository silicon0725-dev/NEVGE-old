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
const {
    SCRATCH_ROLE_MANAGER_PARITY_CAPABILITY_ID
} = require('../../src/lib/scratch-sprite-adapter');
const {createBlankSceneFiles} = require('../../src/lib/scene-system/blank-scene-project');
const {
    RUNTIME_NODE_MODEL_CAPABILITY_ID,
    SCENE_SYSTEM_MODULE_ID,
    SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID
} = require('../../src/lib/scene-system/constants');

const createPortablePayloadFromFiles = async files => {
    const records = [];
    for (const name of Object.keys(files).sort()) {
        records.push({
            data: encodeBase64Bytes(await toUint8Array(files[name], name)),
            name
        });
    }
    return createPortableProjectPayload(records);
};

const originalSpriteTargets = vm => vm.runtime.targets.filter(target => target && !target.isStage && target.isOriginal !== false);

describe('WS-10N3 Scratch Role Manager parity', () => {
    test('keeps selection identity stable and routes rename/order/delete through Runtime Node commands', async () => {
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
            const scratchAdapter = manager.client.getCapability(SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID);
            const parity = manager.client.getCapability(SCRATCH_ROLE_MANAGER_PARITY_CAPABILITY_ID);
            const commandCapability = manager.client.getCapability(RUNTIME_NODE_COMMAND_CAPABILITY_ID);
            const client = createRuntimeNodeEditorClient(commandCapability);
            const project = manager.client.getModuleData(SCENE_SYSTEM_MODULE_ID, null);
            const sceneId = project.activeSceneId;
            const sceneRoot = runtimeNodeModel.getSceneRoot(sceneId);

            const createSprite = async name => {
                const plan = materializePortableCapabilityValue(creation.createPlan(
                    FUNCTIONAL_NODE_ARCHETYPE_IDS.SPRITE_2D,
                    {name, sceneId, scope: 'scene'}
                ));
                return unwrapRuntimeNodeCommandResultAsync(client.createNode({
                    options: Object.assign({}, plan.options, {parentId: sceneRoot.id}),
                    typeId: plan.runtimeTypeId
                }));
            };

            const first = await createSprite('Player');
            const second = await createSprite('Enemy');
            const firstBinding = scratchAdapter.getBindingByNodeId(first.node.id);
            const secondBinding = scratchAdapter.getBindingByNodeId(second.node.id);

            expect(parity).not.toBeNull();
            expect(parity.resolveTargetRuntimeIdForNode(first.node.id)).toBe(firstBinding.targetRuntimeId);
            expect(parity.resolveNodeIdForTarget(firstBinding.targetRuntimeId, sceneId)).toBe(first.node.id);

            const renamed = await unwrapRuntimeNodeCommandResultAsync(client.patchNode({
                nodeId: first.node.id,
                patch: {name: 'Hero'}
            }));
            expect(renamed.node.id).toBe(first.node.id);
            expect(vm.runtime.getTargetById(firstBinding.targetRuntimeId).getName()).toBe('Hero');

            const spriteCountBeforeDuplicate = originalSpriteTargets(vm).length;
            const duplicated = await unwrapRuntimeNodeCommandResultAsync(client.duplicateNode({
                nodeId: first.node.id
            }));
            // duplicateSprite() causes compatibility TARGETS_UPDATE reconciliation on the next task.
            // Settle it before reading capability facades or disposing the module manager.
            await new Promise(resolve => setTimeout(resolve, 50));
            const duplicatedBinding = scratchAdapter.getBindingByNodeId(duplicated.node.id);
            expect(duplicated.node.id).not.toBe(first.node.id);
            expect(duplicatedBinding).toMatchObject({nodeId: duplicated.node.id, status: 'bound'});
            expect(originalSpriteTargets(vm)).toHaveLength(spriteCountBeforeDuplicate + 1);
            expect(vm.runtime.getTargetById(duplicatedBinding.targetRuntimeId)).toBeDefined();

            await unwrapRuntimeNodeCommandResultAsync(client.destroyNode({nodeId: duplicated.node.id}));
            await new Promise(resolve => setTimeout(resolve, 100));
            expect(vm.runtime.getTargetById(duplicatedBinding.targetRuntimeId)).toBeUndefined();
            expect(runtimeNodeModel.getNodeSnapshot(duplicated.node.id)).toBeNull();

            const reordered = await unwrapRuntimeNodeCommandResultAsync(client.reparentNode({
                nodeId: second.node.id,
                parentId: sceneRoot.id,
                options: {index: 0}
            }));
            expect(reordered.node.id).toBe(second.node.id);
            expect(runtimeNodeModel.getChildren(sceneRoot.id).slice(0, 2).map(node => node.id)).toEqual([
                second.node.id,
                first.node.id
            ]);
            expect(originalSpriteTargets(vm).slice(0, 2).map(target => target.id)).toEqual([
                secondBinding.targetRuntimeId,
                firstBinding.targetRuntimeId
            ]);

            // Legacy ordering remains a compatibility input. Reconcile it back to relative
            // top-level bound Node order without changing NodeId identity.
            const firstTargetIndex = vm.runtime.targets.findIndex(target => target.id === firstBinding.targetRuntimeId);
            const secondTargetIndex = vm.runtime.targets.findIndex(target => target.id === secondBinding.targetRuntimeId);
            vm.reorderTarget(firstTargetIndex, secondTargetIndex);
            scratchAdapter.reconcileActiveScene({reason: 'targets-update'});
            expect(runtimeNodeModel.getChildren(sceneRoot.id).slice(0, 2).map(node => node.id)).toEqual([
                first.node.id,
                second.node.id
            ]);

            await unwrapRuntimeNodeCommandResultAsync(client.destroyNode({nodeId: first.node.id}));
            // Scratch VM deleteSprite() eagerly starts an async sprite export for its undo
            // restore closure even though deleteSprite itself returns synchronously. Let that
            // compatibility-side export settle before Jest tears down the module environment.
            await new Promise(resolve => setTimeout(resolve, 100));
            expect(vm.runtime.getTargetById(firstBinding.targetRuntimeId)).toBeUndefined();
            expect(runtimeNodeModel.getNodeSnapshot(first.node.id)).toBeNull();
            expect(parity.resolveNodeIdForTarget(firstBinding.targetRuntimeId, sceneId)).toBeNull();
        } finally {
            manager.dispose();
        }
    });
});
