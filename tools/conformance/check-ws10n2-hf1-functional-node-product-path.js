#!/usr/bin/env node
'use strict';

const assert = require('assert');
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
const {createBlankSceneFiles} = require('../../src/lib/scene-system/blank-scene-project');
const {
    RUNTIME_NODE_MODEL_CAPABILITY_ID,
    SCENE_SYSTEM_MODULE_ID,
    SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID
} = require('../../src/lib/scene-system/constants');

const checks = [];
const check = (title, fn) => {
    fn();
    checks.push(title);
};
const checkAsync = async (title, fn) => {
    await fn();
    checks.push(title);
};

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

const assertNoBackendIdentityLeak = value => {
    const forbidden = new Set(['bindingId', 'targetId', 'targetRuntimeId']);
    const visit = current => {
        if (!current || typeof current !== 'object') return;
        Object.keys(current).forEach(key => {
            assert.strictEqual(forbidden.has(key), false, `Creation plan leaked backend identity field: ${key}`);
            visit(current[key]);
        });
    };
    visit(value);
};

const run = async () => {
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

        check('Scene System remains opt-in before the explicit product admission action', () => {
            assert.strictEqual(manager.client.getModuleState(SCENE_SYSTEM_MODULE_ID).enabled, false);
        });

        check('The host-client admission path can explicitly enable Scene System', () => {
            manager.client.enableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});
            assert.strictEqual(manager.client.getModuleState(SCENE_SYSTEM_MODULE_ID).enabled, true);
        });

        const creation = manager.client.getCapability(FUNCTIONAL_NODE_CREATION_CAPABILITY_ID);
        const runtimeNodeModel = manager.client.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID);
        const scratchAdapter = manager.client.getCapability(SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID);
        const commandCapability = manager.client.getCapability(RUNTIME_NODE_COMMAND_CAPABILITY_ID);

        check('Admission publishes all four functional-node product capabilities', () => {
            assert.strictEqual(Boolean(creation), true);
            assert.strictEqual(Boolean(runtimeNodeModel), true);
            assert.strictEqual(Boolean(scratchAdapter), true);
            assert.strictEqual(Boolean(commandCapability), true);
        });

        const rawArchetypes = creation.listArchetypes({scope: 'scene'});
        const archetypes = materializePortableCapabilityValue(rawArchetypes);
        check('Capability facade values materialize into local arrays before reuse without freezing future provider graduation', () => {
            assert.strictEqual(Array.isArray(archetypes), true);
            const archetypeIds = archetypes.map(item => item.id);
            assert.strictEqual(archetypeIds.includes(FUNCTIONAL_NODE_ARCHETYPE_IDS.NODE_2D), true);
            assert.strictEqual(archetypeIds.includes(FUNCTIONAL_NODE_ARCHETYPE_IDS.SPRITE_2D), true);
            assert.strictEqual(new Set(archetypeIds).size, archetypeIds.length);
            assert.strictEqual(archetypes.every(item => item && typeof item.id === 'string'), true);
        });

        const sceneProject = manager.client.getModuleData(SCENE_SYSTEM_MODULE_ID, null);
        const sceneId = sceneProject.activeSceneId;
        const sceneRoot = runtimeNodeModel.getSceneRoot(sceneId);
        check('The admitted runtime publishes an active Scene root', () => {
            assert.strictEqual(Boolean(sceneId), true);
            assert.strictEqual(Boolean(sceneRoot && sceneRoot.id), true);
        });

        const rawNode2DPlan = creation.createPlan(
            FUNCTIONAL_NODE_ARCHETYPE_IDS.NODE_2D,
            {name: 'NativeNode', sceneId, scope: 'scene'}
        );
        const node2DPlan = materializePortableCapabilityValue(rawNode2DPlan);
        check('Native Node2D plan has portable Transform2D vector arrays and no backend identity', () => {
            assert.strictEqual(Array.isArray(node2DPlan.options.components), true);
            assert.strictEqual(Array.isArray(node2DPlan.options.components[0].data.position), true);
            assert.strictEqual(Array.isArray(node2DPlan.options.components[0].data.scale), true);
            assertNoBackendIdentityLeak(node2DPlan);
        });

        const commandClient = createRuntimeNodeEditorClient(commandCapability);
        let nativePayload = null;
        await checkAsync('Native Node2D creation increments Runtime Nodes without creating a Scratch target', async () => {
            const targetCountBefore = vm.runtime.targets.length;
            const result = await commandClient.createNode({
                options: Object.assign({}, node2DPlan.options, {parentId: sceneRoot.id}),
                typeId: node2DPlan.runtimeTypeId
            });
            nativePayload = await unwrapRuntimeNodeCommandResultAsync(result);
            assert.strictEqual(nativePayload.node.typeId, 'ngvge.node2d');
            assert.strictEqual(vm.runtime.targets.length, targetCountBefore);
            assert.strictEqual(scratchAdapter.getBindingByNodeId(nativePayload.node.id), null);
        });

        const rawSpritePlan = creation.createPlan(
            FUNCTIONAL_NODE_ARCHETYPE_IDS.SPRITE_2D,
            {name: 'Player', sceneId, scope: 'scene'}
        );
        const spritePlan = materializePortableCapabilityValue(rawSpritePlan);
        check('Sprite2D plan materializes recursively and keeps backend identities out of the plan', () => {
            assert.strictEqual(Array.isArray(spritePlan.options.components), true);
            assert.strictEqual(Array.isArray(spritePlan.options.components[0].data.position), true);
            assert.strictEqual(Array.isArray(spritePlan.options.components[0].data.scale), true);
            assertNoBackendIdentityLeak(spritePlan);
        });

        let spritePayload = null;
        await checkAsync('Sprite2D creation crosses the real VM boundary using a portable descriptor', async () => {
            const targetCountBefore = vm.runtime.targets.length;
            const result = await commandClient.createNode({
                options: Object.assign({}, spritePlan.options, {parentId: sceneRoot.id}),
                typeId: spritePlan.runtimeTypeId
            });
            spritePayload = await unwrapRuntimeNodeCommandResultAsync(result);
            assert.strictEqual(spritePayload.node.typeId, 'ngvge.sprite-node');
            assert.strictEqual(spritePayload.node.name, 'Player');
            assert.strictEqual(vm.runtime.targets.length, targetCountBefore + 1);
            assert.strictEqual(vm.runtime.targets.filter(target => !target.isStage && target.getName() === 'Player').length, 1);
        });

        check('The newly-created Scratch target resolves back to one stable semantic Node binding', () => {
            const binding = materializePortableCapabilityValue(
                scratchAdapter.getBindingByNodeId(spritePayload.node.id)
            );
            assert.strictEqual(binding.nodeId, spritePayload.node.id);
            assert.strictEqual(binding.status, 'bound');
            assert.strictEqual(Boolean(binding.targetRuntimeId), true);
        });

        check('Runtime Node creation produced exactly one native Node2D and one semantic Sprite2D', () => {
            const ids = runtimeNodeModel.listNodes({sceneId, scope: 'scene'}).map(node => node.id);
            assert.strictEqual(ids.includes(nativePayload.node.id), true);
            assert.strictEqual(ids.includes(spritePayload.node.id), true);
        });
    } finally {
        manager.dispose();
    }

    process.stdout.write(
        `WS-10N2-HF1 Functional Node Product Admission + Boundary Closure PASS (${checks.length}/${checks.length}).\n`
    );
};

run().catch(error => {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
});
