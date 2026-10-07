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
    createCollider2DEditorClient
} = require('../../src/lib/collision-system');
const {
    CHARACTER_CONTROLLER2D_COMMAND_CAPABILITY_ID,
    CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_ID,
    createCharacterController2DEditorClient
} = require('../../src/lib/character-controller-system');
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

const componentOf = (node, typeId) => node.components.find(component => component.typeId === typeId);

describe('WS-10N6 CharacterBody2D / CharacterController2D integration', () => {
    test('moves and slides against native StaticBody2D without adding Scratch targets', async () => {
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
            const transformEditor = createTransform2DEditorClient(
                manager.client.getCapability(TRANSFORM2D_COMMAND_CAPABILITY_ID)
            );
            const colliderEditor = createCollider2DEditorClient(
                manager.client.getCapability(COLLIDER2D_COMMAND_CAPABILITY_ID)
            );
            const characterRuntime = manager.client.getCapability(CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_ID);
            const characterEditor = createCharacterController2DEditorClient(
                manager.client.getCapability(CHARACTER_CONTROLLER2D_COMMAND_CAPABILITY_ID)
            );
            expect(characterRuntime).not.toBeNull();
            expect(await characterRuntime.initializeShapeQueryBackend()).toBe(true);
            expect(materializePortableCapabilityValue(characterRuntime.getStatus()).shapeQueryBackendState).toBe('ready');

            const archetypeIds = materializePortableCapabilityValue(creation.listArchetypes({scope: 'scene'}))
                .map(item => item.id);
            expect(archetypeIds).toContain(FUNCTIONAL_NODE_ARCHETYPE_IDS.STATIC_BODY_2D);
            expect(archetypeIds).toContain(FUNCTIONAL_NODE_ARCHETYPE_IDS.CHARACTER_BODY_2D);

            const project = manager.client.getModuleData(SCENE_SYSTEM_MODULE_ID, null);
            const sceneRoot = runtimeNodeModel.getSceneRoot(project.activeSceneId);
            const nodeClient = createRuntimeNodeEditorClient(nodeCommand);
            const createNode = async (archetypeId, name) => {
                const plan = materializePortableCapabilityValue(creation.createPlan(archetypeId, {
                    name,
                    sceneId: project.activeSceneId,
                    scope: 'scene'
                }));
                return unwrapRuntimeNodeCommandResultAsync(nodeClient.createNode({
                    options: Object.assign({}, plan.options, {parentId: sceneRoot.id}),
                    typeId: plan.runtimeTypeId
                }));
            };

            const floor = await createNode(FUNCTIONAL_NODE_ARCHETYPE_IDS.STATIC_BODY_2D, 'Floor');
            const wall = await createNode(FUNCTIONAL_NODE_ARCHETYPE_IDS.STATIC_BODY_2D, 'Wall');
            const character = await createNode(FUNCTIONAL_NODE_ARCHETYPE_IDS.CHARACTER_BODY_2D, 'Player');
            expect(vm.runtime.targets).toHaveLength(targetCountBefore);
            expect(character.node.components.map(component => component.typeId)).toEqual([
                'ngvge.transform2d',
                'ngvge.collider2d',
                'ngvge.character-controller2d'
            ]);
            expect(componentOf(character.node, 'ngvge.collider2d').data.sensor).toBe(false);

            const patchTransform = (created, patch) => transformEditor.patchComponent({
                componentId: componentOf(created.node, 'ngvge.transform2d').id,
                nodeId: created.node.id,
                patch
            });
            const patchCollider = (created, patch) => colliderEditor.patchComponent({
                componentId: componentOf(created.node, 'ngvge.collider2d').id,
                nodeId: created.node.id,
                patch
            });

            patchTransform(floor, {position: [0, 0]});
            patchCollider(floor, {shape: {type: 'rectangle', size: [300, 40]}});
            patchTransform(wall, {position: [150, 70]});
            patchCollider(wall, {shape: {type: 'rectangle', size: [40, 300]}});
            patchTransform(character, {position: [0, 100]});

            const controllerComponent = componentOf(character.node, 'ngvge.character-controller2d');
            const controllerPatch = characterEditor.patchComponent({
                componentId: controllerComponent.id,
                nodeId: character.node.id,
                patch: {floorSnapLength: 8, maxSlopeDegrees: 50, stepHeight: 4}
            });
            expect(controllerPatch.kind).toBe('event');

            characterRuntime.setVelocity(character.node.id, [0, -100]);
            const floorResult = materializePortableCapabilityValue(
                characterRuntime.moveUsingVelocity(character.node.id, 1)
            );
            expect(floorResult.onFloor).toBe(true);
            expect(floorResult.collisions.some(hit => hit.nodeId === floor.node.id)).toBe(true);
            let view = materializePortableCapabilityValue(characterRuntime.getController(character.node.id));
            expect(view.state.floorNormal[0]).toBeCloseTo(0);
            expect(view.state.floorNormal[1]).toBeCloseTo(1);
            expect(view.state.velocity[1]).toBeCloseTo(0);
            expect(view.state.stableFloorNodeId).toBe(floor.node.id);
            expect(view.transform.position[1]).toBeCloseTo(70, 1);

            characterRuntime.setVelocity(character.node.id, [200, 0]);
            const wallResult = materializePortableCapabilityValue(
                characterRuntime.moveUsingVelocity(character.node.id, 1)
            );
            expect(wallResult.onWall).toBe(true);
            expect(wallResult.collisions.some(hit => hit.nodeId === wall.node.id)).toBe(true);
            view = materializePortableCapabilityValue(characterRuntime.getController(character.node.id));
            expect(view.state.wallNormal[0]).toBeCloseTo(-1);
            expect(view.state.wallNormal[1]).toBeCloseTo(0);
            expect(view.state.stableWallNodeId).toBe(wall.node.id);
            expect(view.state.velocity[0]).toBeCloseTo(0);

            // HF14: Circle and Capsule are queried through Rapier primitives instead of 32/34-gon SAT.
            const originalCharacterShape = {type: 'rectangle', size: [100, 100]};
            patchTransform(character, {position: [0, 100]});
            patchCollider(character, {shape: {type: 'circle', radius: 50}});
            characterRuntime.setVelocity(character.node.id, [0, -100]);
            const circleFloor = materializePortableCapabilityValue(characterRuntime.moveUsingVelocity(character.node.id, 1));
            expect(circleFloor.onFloor).toBe(true);
            expect(circleFloor.collisions.some(hit => hit.nodeId === floor.node.id)).toBe(true);

            patchTransform(character, {position: [0, 100]});
            patchCollider(character, {shape: {type: 'capsule', radius: 25, height: 100}});
            characterRuntime.setVelocity(character.node.id, [0, -100]);
            const capsuleFloor = materializePortableCapabilityValue(characterRuntime.moveUsingVelocity(character.node.id, 1));
            expect(capsuleFloor.onFloor).toBe(true);
            expect(capsuleFloor.collisions.some(hit => hit.nodeId === floor.node.id)).toBe(true);
            patchCollider(character, {shape: originalCharacterShape});

            // Re-establish the floor contact, then move the platform. The next zero-motion slide carries translation.
            patchTransform(character, {position: [0, 100]});
            characterRuntime.setVelocity(character.node.id, [0, -100]);
            characterRuntime.moveUsingVelocity(character.node.id, 1);
            const beforeCarry = materializePortableCapabilityValue(characterRuntime.getController(character.node.id));
            patchTransform(floor, {position: [20, 0]});
            characterRuntime.moveAndSlide(character.node.id, [0, 0]);
            const afterCarry = materializePortableCapabilityValue(characterRuntime.getController(character.node.id));
            expect(afterCarry.transform.position[0] - beforeCarry.transform.position[0]).toBeCloseTo(20, 4);

            // External transform corruption can place a CharacterBody inside solid geometry.
            // HF3 keeps the last legal runtime transform and restores it instead of leaving an invalid body behind.
            const lastSafeBeforeCorruption = afterCarry.state.lastSafeWorldOrigin.slice();
            patchTransform(character, {position: [20, 0]});
            const recovered = materializePortableCapabilityValue(
                characterRuntime.moveAndSlide(character.node.id, [0, 0])
            );
            expect(recovered.recovered).toBe(true);
            view = materializePortableCapabilityValue(characterRuntime.getController(character.node.id));
            expect(view.state.recoveryStatus).toBe('restored-last-safe');
            expect(view.state.recoveryCount).toBeGreaterThan(0);
            expect(view.worldOrigin[0]).toBeCloseTo(lastSafeBeforeCorruption[0], 4);
            expect(view.worldOrigin[1]).toBeCloseTo(lastSafeBeforeCorruption[1], 4);

            // Restore the authored baseline before the existing stop/restart lifecycle assertion.
            patchTransform(character, {position: [0, 100]});

            // Runtime movement is ephemeral: stop restores authored Transform2D and clears velocity/contact state.
            characterRuntime.setVelocity(character.node.id, [15, 25]);
            characterRuntime.moveAndSlide(character.node.id, [10, 0]);
            vm.runtime.emit('PROJECT_STOP_ALL');
            view = materializePortableCapabilityValue(characterRuntime.getController(character.node.id));
            expect(view.transform.position).toEqual([0, 100]);
            expect(view.state.velocity).toEqual([0, 0]);
            expect(view.state.onFloor).toBe(false);
            expect(view.state.onWall).toBe(false);
        } finally {
            manager.dispose();
        }
    });
});
