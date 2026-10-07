#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const {
    CHARACTER_CONTROLLER2D_CONTRACT,
    CHARACTER_CONTROLLER2D_TYPE_ID,
    normalizeCharacterController2D
} = require('../../src/core/character-controller2d');
const {
    FUNCTIONAL_COMPONENT_TYPE_IDS,
    FUNCTIONAL_NODE_ARCHETYPE_IDS,
    FUNCTIONAL_NODE_IMPLEMENTATION_STATES,
    getFunctionalNodeArchetype
} = require('../../src/core/functional-node');
const {
    CHARACTER_CONTROLLER2D_COMMAND_CAPABILITY_ID,
    CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_ID
} = require('../../src/lib/character-controller-system');

const checks = [];
const check = (title, fn) => {
    fn();
    checks.push(title);
};

const contractSource = read('src/core/character-controller2d/character-controller2d-contract.js');
const runtimeSource = read('src/lib/character-controller-system/character-controller2d-runtime-service.js');
const commandSource = read('src/lib/character-controller-system/character-controller2d-command-capability.js');
const blocksSource = read('src/lib/character-controller-system/character-controller2d-scratch-blocks.js');
const foundationSource = read('src/core/functional-node/functional-node-foundation.js');
const creationSource = read('src/core/functional-node/functional-node-creation.js');
const creationServiceSource = read('src/lib/functional-node/functional-node-creation-service.js');
const sceneModuleSource = read('src/lib/scene-system/module-definition.js');
const runtimeIntegrationSource = read('src/lib/first-party-modules/runtime-integration.js');
const inspectorSource = read('src/components/project-inspector/project-inspector.jsx');
const architectureDoc = read('docs/architecture/WS-10N6-CHARACTER-CONTROLLER2D.md');
const verificationDoc = read('docs/validation/WS-10N6-CHARACTER-CONTROLLER2D-VERIFICATION.md');
const n5VerificationDoc = read('docs/validation/WS-10N5-COLLIDER2D-AREA2D-VERIFICATION.md');
const n5Hf1VerificationDoc = read('docs/validation/WS-10N5-HF1-COLLIDER2D-VISIBILITY-VERIFICATION.md');

check('N5 + HF1 are frozen before N6 admission', () => {
    assert.match(n5VerificationDoc, /FROZEN \/ MACHINE VERIFIED \/ BROWSER VERIFIED/);
    assert.match(n5Hf1VerificationDoc, /FROZEN \/ MACHINE VERIFIED \/ BROWSER VERIFIED/);
});

check('CharacterController2D owns a stable native component contract', () => {
    assert.strictEqual(CHARACTER_CONTROLLER2D_CONTRACT.typeId, CHARACTER_CONTROLLER2D_TYPE_ID);
    assert.strictEqual(CHARACTER_CONTROLLER2D_CONTRACT.schemaVersion, 1);
    assert.strictEqual(CHARACTER_CONTROLLER2D_CONTRACT.persistence.nativeProject, '.ne');
    assert.strictEqual(CHARACTER_CONTROLLER2D_CONTRACT.persistence.scratchProjection, 'native-only');
});

check('CharacterController identity excludes replaceable backend handles', () => {
    assert.strictEqual(CHARACTER_CONTROLLER2D_CONTRACT.identity.backendHandlePersistent, false);
    assert.strictEqual(CHARACTER_CONTROLLER2D_CONTRACT.identity.nodeIdIsControllerId, false);
    assert.doesNotMatch(contractSource, /Rapier|Box2D|rigidBodyHandle|physicsHandle/);
});

check('N6 is explicitly kinematic and does not require a full Rigidbody backend', () => {
    assert.strictEqual(CHARACTER_CONTROLLER2D_CONTRACT.movement.fullRigidBodyRequired, false);
    assert.strictEqual(CHARACTER_CONTROLLER2D_CONTRACT.movement.colliderSource, 'ngvge.collider2d');
    assert.strictEqual(CHARACTER_CONTROLLER2D_CONTRACT.movement.solidColliderRequired, true);
});

check('Transform2D Runtime Store remains the movement writer', () => {
    assert.strictEqual(CHARACTER_CONTROLLER2D_CONTRACT.movement.runtimeTransformWriter, 'Transform2DRuntimeStore');
    assert.match(runtimeSource, /transformRuntimeStore\.patchRuntimeTransform/);
    assert.match(runtimeSource, /transformRuntimeStore\.hydrateNodeFromPersistent/);
});

check('Velocity/contact state is runtime-only and absent from persistent patch fields', () => {
    assert.strictEqual(CHARACTER_CONTROLLER2D_CONTRACT.runtimeState.velocityPersistent, false);
    assert.strictEqual(CHARACTER_CONTROLLER2D_CONTRACT.runtimeState.contactsPersistent, false);
    assert.doesNotMatch(contractSource, /CHARACTER_CONTROLLER2D_PATCH_FIELDS[\s\S]*'velocity'/);
    assert.deepStrictEqual(normalizeCharacterController2D().upDirection, [0, 1]);
});

check('StaticBody2D graduates only as Transform2D + solid Collider2D', () => {
    const staticBody = getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.STATIC_BODY_2D);
    assert(staticBody);
    assert.strictEqual(staticBody.implementation, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED);
    assert.deepStrictEqual(staticBody.components.map(component => component.typeId), [
        FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D,
        FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D
    ]);
    assert.deepStrictEqual(staticBody.defaults[FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D], {sensor: false});
});

check('CharacterBody2D graduates as Transform2D + solid Collider2D + CharacterController2D', () => {
    const character = getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.CHARACTER_BODY_2D);
    assert(character);
    assert.strictEqual(character.implementation, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED);
    assert.deepStrictEqual(character.components.map(component => component.typeId), [
        FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D,
        FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D,
        FUNCTIONAL_COMPONENT_TYPE_IDS.CHARACTER_CONTROLLER_2D
    ]);
    assert.deepStrictEqual(character.defaults[FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D], {sensor: false});
});

check('RigidBody2D remains a distinct component preset even after later Physics2D graduation', () => {
    const rigid = getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.RIGID_BODY_2D);
    assert(rigid);
    assert(rigid.components.some(item => item.typeId === FUNCTIONAL_COMPONENT_TYPE_IDS.RIGIDBODY_2D));
});

check('Creation plan provisions native StaticBody2D and CharacterBody2D components', () => {
    assert.match(creationSource, /FUNCTIONAL_NODE_ARCHETYPE_IDS\.STATIC_BODY_2D/);
    assert.match(creationSource, /FUNCTIONAL_NODE_ARCHETYPE_IDS\.CHARACTER_BODY_2D/);
    assert.match(creationSource, /createCharacterController2DComponent/);
});

check('CharacterBody2D product admission fails closed without CharacterController2D provider', () => {
    assert.match(creationServiceSource, /characterController2DAvailable/);
    assert.match(creationServiceSource, /collider2DAvailable && characterController2DAvailable/);
});

check('Scene System publishes CharacterController runtime and command capabilities before Functional Node admission', () => {
    assert.strictEqual(CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_ID, 'ngvge.character-controller2d-runtime');
    assert.strictEqual(CHARACTER_CONTROLLER2D_COMMAND_CAPABILITY_ID, 'ngvge.character-controller2d-command');
    assert.match(sceneModuleSource, /createCharacterController2DRuntimeService/);
    assert.match(sceneModuleSource, /CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_ID/);
    assert.match(sceneModuleSource, /CHARACTER_CONTROLLER2D_COMMAND_CAPABILITY_ID/);
    assert(sceneModuleSource.indexOf('createCharacterController2DRuntimeService') <
        sceneModuleSource.indexOf('characterController2DAvailable: Boolean(characterRuntimeService)'));
});

check('Runtime performs continuous SAT translation sweep rather than discrete post-overlap only', () => {
    assert.match(runtimeSource, /sweepConvexPolygons/);
    assert.match(runtimeSource, /entryTime/);
    assert.match(runtimeSource, /exitTime/);
    assert.match(runtimeSource, /findEarliestCollision/);
});

check('Impact normal orientation is deterministic for floor/wall classification', () => {
    assert.match(runtimeSource, /movingCenterAtImpact/);
    assert.match(runtimeSource, /staticCenter/);
    assert.match(runtimeSource, /classifyNormal/);
    assert.match(runtimeSource, /Math\.cos\(config\.maxSlopeDegrees/);
});

check('P0 exposes move-and-collide and move-and-slide semantics', () => {
    assert.match(runtimeSource, /const moveAndCollide =/);
    assert.match(runtimeSource, /const moveAndSlide =/);
    assert.match(runtimeSource, /maxSlides/);
    assert.match(runtimeSource, /remainderDot/);
});

check('P0 exposes floor/wall contacts and normals', () => {
    assert.match(runtimeSource, /floorNormal/);
    assert.match(runtimeSource, /wallNormal/);
    assert.match(runtimeSource, /onFloor/);
    assert.match(runtimeSource, /onWall/);
});

check('P0 contains floor snap, basic step, and moving-platform translation carry foundations', () => {
    assert.strictEqual(CHARACTER_CONTROLLER2D_CONTRACT.stepAndSnap.floorSnap, 'implemented');
    assert.strictEqual(CHARACTER_CONTROLLER2D_CONTRACT.stepAndSnap.movingPlatformTranslationCarry, 'implemented');
    assert.strictEqual(CHARACTER_CONTROLLER2D_CONTRACT.stepAndSnap.stepFoundation, 'basic-translation-step');
    assert.match(runtimeSource, /snapToFloor/);
    assert.match(runtimeSource, /tryStep/);
    assert.match(runtimeSource, /carryByPreviousFloor/);
});

check('Run boundaries reset transient state and rehydrate authored Transform2D', () => {
    assert.match(runtimeSource, /PROJECT_START/);
    assert.match(runtimeSource, /PROJECT_STOP_ALL/);
    assert.match(runtimeSource, /resetRuntimeState/);
    assert.match(runtimeSource, /hydrateNodeFromPersistent/);
});

check('Persistent CharacterController edits cross a semantic command capability', () => {
    assert.match(commandSource, /CHARACTER_CONTROLLER2D_PATCH_COMMAND_TYPE/);
    assert.match(commandSource, /patchPersistentController/);
    assert.match(commandSource, /createCharacterController2DEditorClient/);
    assert.doesNotMatch(inspectorSource, /setComponentData\([^\n]*character/i);
});

check('Inspector exposes persistent controller config and runtime diagnostics', () => {
    assert.match(inspectorSource, /id="runtime-node:character-controller2d"/);
    assert.match(inspectorSource, /label="Max Slope"/);
    assert.match(inspectorSource, /label="Floor Snap"/);
    assert.match(inspectorSource, /label="Step Height"/);
    assert.match(inspectorSource, /label="Max Slides"/);
    assert.match(inspectorSource, /label="Safe Margin"/);
    assert.match(inspectorSource, /label="Velocity X"/);
    assert.match(inspectorSource, /label="On Floor"/);
    assert.match(inspectorSource, /label="On Wall"/);
});

check('Scratch Character2D blocks are runtime consumers and not persistence authority', () => {
    assert.match(blocksSource, /moveAndCollide/);
    assert.match(blocksSource, /moveAndSlide/);
    assert.match(blocksSource, /isOnFloor/);
    assert.match(blocksSource, /isOnWall/);
    assert.doesNotMatch(blocksSource, /setComponentData|patchPersistentController|PatchCharacterController2D/);
});

check('Raw VM installs Character2D Scratch blocks outside the Scene module facade', () => {
    assert.match(runtimeIntegrationSource, /installCharacterController2DScratchBlocks\(vm\)/);
    assert.doesNotMatch(sceneModuleSource, /installCharacterController2DScratchBlocks/);
});

check('Runtime remains free of full physics backend identity in N6', () => {
    assert.doesNotMatch(runtimeSource, /Rapier|Box2D|rigidBodyHandle|physicsHandle/);
    assert.doesNotMatch(foundationSource, /Rapier|Box2D/);
});

check('Architecture docs explicitly keep dynamic physics and push forces deferred', () => {
    assert.match(architectureDoc, /no mass, gravity, friction/i);
    assert.match(architectureDoc, /Dynamic Rigidbody pushing: deferred/i);
    assert.match(architectureDoc, /\.ne/);
    assert.match(architectureDoc, /\.sb3/);
});

check('Browser verification covers native node admission, floor/wall movement, platform carry and run reset', () => {
    assert.match(verificationDoc, /BROWSER EVIDENCE PENDING/);
    assert.match(verificationDoc, /StaticBody2D/);
    assert.match(verificationDoc, /CharacterBody2D/);
    assert.match(verificationDoc, /is on floor/i);
    assert.match(verificationDoc, /is on wall/i);
    assert.match(verificationDoc, /platform/i);
    assert.match(verificationDoc, /Stop/i);
});

process.stdout.write(`WS-10N6 CharacterBody2D / CharacterController2D Conformance PASS (${checks.length}/${checks.length}).\n`);
