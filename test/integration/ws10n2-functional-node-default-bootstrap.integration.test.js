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
const {
    FUNCTIONAL_NODE_ARCHETYPE_IDS
} = require('../../src/core/functional-node');
const {
    FUNCTIONAL_NODE_CREATION_CAPABILITY_ID
} = require('../../src/lib/functional-node');
const {
    RUNTIME_NODE_COMMAND_CAPABILITY_ID,
    createRuntimeNodeEditorClient,
    unwrapRuntimeNodeCommandResultAsync
} = require('../../src/lib/runtime-nodes');
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

describe('WS-10N2-HF1 functional-node product activation', () => {
    test('host-client activation publishes Node2D + Sprite2D and creates a real Scratch-backed Sprite2D', async () => {
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

            expect(manager.client.getModuleState(SCENE_SYSTEM_MODULE_ID).enabled).toBe(false);
            manager.client.enableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});
            expect(manager.client.getModuleState(SCENE_SYSTEM_MODULE_ID).enabled).toBe(true);

            const creation = manager.client.getCapability(FUNCTIONAL_NODE_CREATION_CAPABILITY_ID);
            const runtimeNodeModel = manager.client.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID);
            const scratchAdapter = manager.client.getCapability(SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID);
            const commandCapability = manager.client.getCapability(RUNTIME_NODE_COMMAND_CAPABILITY_ID);
            expect(creation).not.toBeNull();
            expect(runtimeNodeModel).not.toBeNull();
            expect(scratchAdapter).not.toBeNull();
            expect(commandCapability).not.toBeNull();

            const archetypes = materializePortableCapabilityValue(creation.listArchetypes({scope: 'scene'}));
            const archetypeIds = archetypes.map(item => item.id);
            expect(archetypeIds).toEqual(expect.arrayContaining([
                FUNCTIONAL_NODE_ARCHETYPE_IDS.NODE_2D,
                FUNCTIONAL_NODE_ARCHETYPE_IDS.SPRITE_2D
            ]));
            expect(new Set(archetypeIds).size).toBe(archetypeIds.length);

            const sceneProject = manager.client.getModuleData(SCENE_SYSTEM_MODULE_ID, null);
            const sceneId = sceneProject.activeSceneId;
            const sceneRoot = runtimeNodeModel.getSceneRoot(sceneId);
            const targetCountBefore = vm.runtime.targets.length;
            const plan = materializePortableCapabilityValue(creation.createPlan(
                FUNCTIONAL_NODE_ARCHETYPE_IDS.SPRITE_2D,
                {name: 'Player', sceneId, scope: 'scene'}
            ));

            expect(Array.isArray(plan.options.components)).toBe(true);
            expect(Array.isArray(plan.options.components[0].data.position)).toBe(true);
            expect(Array.isArray(plan.options.components[0].data.scale)).toBe(true);

            const client = createRuntimeNodeEditorClient(commandCapability);
            const protocolResult = await client.createNode({
                options: Object.assign({}, plan.options, {parentId: sceneRoot.id}),
                typeId: plan.runtimeTypeId
            });
            const payload = await unwrapRuntimeNodeCommandResultAsync(protocolResult);

            expect(payload.node.typeId).toBe('ngvge.sprite-node');
            expect(payload.node.name).toBe('Player');
            expect(vm.runtime.targets.length).toBe(targetCountBefore + 1);
            expect(vm.runtime.targets.some(target => !target.isStage && target.getName() === 'Player')).toBe(true);
            expect(scratchAdapter.getBindingByNodeId(payload.node.id)).toMatchObject({
                nodeId: payload.node.id,
                status: 'bound'
            });
        } finally {
            manager.dispose();
        }
    });
});
