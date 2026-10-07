#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const pkg = require('../../package.json');
const {
    PHYSICS2D_BACKEND_CONTRACT_ID,
    PHYSICS2D_CONTRACT,
    PHYSICS2D_DEFAULT_SETTINGS
} = require('../../src/core/physics2d');
const {RIGIDBODY2D_CONTRACT, RIGIDBODY2D_TYPE_ID, normalizeRigidBody2DPatch} = require('../../src/core/rigidbody2d');
const {PHYSICS_MATERIAL2D_CONTRACT, PHYSICS_MATERIAL2D_RESOURCE_TYPE_ID, normalizePhysicsMaterial2D} = require('../../src/core/physics-material2d');
const {
    FUNCTIONAL_COMPONENT_TYPE_IDS,
    FUNCTIONAL_NODE_ARCHETYPE_IDS,
    FUNCTIONAL_NODE_IMPLEMENTATION_STATES,
    getFunctionalNodeArchetype
} = require('../../src/core/functional-node');
const {PHYSICS2D_RUNTIME_CAPABILITY_ID, RIGIDBODY2D_COMMAND_CAPABILITY_ID} = require('../../src/lib/physics-system');

const checks = [];
const check = (title, fn) => { fn(); checks.push(title); };
const corePhysics = read('src/core/physics2d/physics2d-contract.js');
const rigidCore = read('src/core/rigidbody2d/rigidbody2d-contract.js');
const materialCore = read('src/core/physics-material2d/physics-material2d-contract.js');
const runtime = read('src/lib/physics-system/physics2d-runtime-service.js');
const adapter = read('src/lib/physics-system/rapier2d-backend-adapter.js');
const loader = read('src/lib/physics-system/rapier2d-package-loader.js');
const sceneModule = read('src/lib/scene-system/module-definition.js');
const creationService = read('src/lib/functional-node/functional-node-creation-service.js');
const inspector = read('src/components/project-inspector/project-inspector.jsx');
const architecture = read('docs/architecture/WS-10N8-PHYSICS2D-BACKEND-POC.md');
const verification = read('docs/validation/WS-10N8-PHYSICS2D-BACKEND-POC-VERIFICATION.md');

check('N7 is frozen before N8 admission', () => {
    assert.match(read('docs/validation/WS-10N7-TILESET-TILEMAPLAYER2D-VERIFICATION.md'), /FROZEN \/ MACHINE VERIFIED \/ BROWSER VERIFIED/);
});
check('Physics2D owns a replaceable adapter contract', () => {
    assert.strictEqual(PHYSICS2D_CONTRACT.backend.contractId, PHYSICS2D_BACKEND_CONTRACT_ID);
    assert.strictEqual(PHYSICS2D_CONTRACT.backend.replaceable, true);
    assert.strictEqual(PHYSICS2D_CONTRACT.backend.selectedBackendIsSemanticIdentity, false);
});
check('Physics backend handles are never persistent identity', () => {
    assert.strictEqual(PHYSICS2D_CONTRACT.backend.handlesPersistent, false);
    assert.strictEqual(PHYSICS2D_CONTRACT.identity.backendRigidBodyHandlePersistent, false);
    assert.strictEqual(PHYSICS2D_CONTRACT.identity.backendColliderHandlePersistent, false);
});
check('Physics scheduler has bounded fixed-step defaults', () => {
    assert.strictEqual(PHYSICS2D_DEFAULT_SETTINGS.fixedDeltaSeconds, 1 / 60);
    assert(PHYSICS2D_DEFAULT_SETTINGS.maxCatchUpSteps > 0);
    assert(PHYSICS2D_DEFAULT_SETTINGS.maxFrameDeltaSeconds > 0);
});
check('Dynamic physics writes runtime Transform2D only and Stop restores authored state', () => {
    assert.strictEqual(PHYSICS2D_CONTRACT.transform.runtimeAuthority, 'Transform2DRuntimeStore');
    assert.strictEqual(PHYSICS2D_CONTRACT.transform.dynamicRuntimeWritesPersistentProject, false);
    assert.strictEqual(PHYSICS2D_CONTRACT.transform.stopRestoresAuthoredTransform, true);
    assert.match(runtime, /patchRuntimeTransform/);
    assert.match(runtime, /hydrateNodeFromPersistent/);
});
check('RigidBody2D stable identity is its Runtime ComponentId', () => {
    assert.strictEqual(RIGIDBODY2D_CONTRACT.typeId, RIGIDBODY2D_TYPE_ID);
    assert.strictEqual(RIGIDBODY2D_CONTRACT.identity.rigidBodyIdSource, 'Runtime ComponentId');
    assert.strictEqual(RIGIDBODY2D_CONTRACT.identity.backendHandlePersistent, false);
    assert.strictEqual(RIGIDBODY2D_CONTRACT.identity.nodeIdIsRigidBodyId, false);
});
check('RigidBody runtime velocity is not persistent frame state', () => {
    assert.strictEqual(RIGIDBODY2D_CONTRACT.persistence.runtimeVelocityPersistent, false);
    assert.strictEqual(RIGIDBODY2D_CONTRACT.persistence.authoredVelocityMeaning, 'initial-runtime-state');
});
check('RigidBody patch explicitly rejects backend identity', () => {
    assert.throws(() => normalizeRigidBody2DPatch({backendHandle: 1}), error => error && error.code === 'NGVGE_RIGIDBODY2D_PATCH_FIELD_UNSUPPORTED');
});
check('PhysicsMaterial2D is a global ResourceId resource', () => {
    assert.strictEqual(PHYSICS_MATERIAL2D_CONTRACT.resourceTypeId, PHYSICS_MATERIAL2D_RESOURCE_TYPE_ID);
    assert.strictEqual(PHYSICS_MATERIAL2D_CONTRACT.identity.resourceIdAuthority, 'ngvge:resource:*');
    assert.strictEqual(PHYSICS_MATERIAL2D_CONTRACT.identity.backendMaterialHandlePersistent, false);
});
check('PhysicsMaterial P0 owns friction/restitution while density is deferred', () => {
    assert.deepStrictEqual(normalizePhysicsMaterial2D({density: 99, friction: 0.2, restitution: 0.3}), {friction: 0.2, restitution: 0.3});
    assert.strictEqual(PHYSICS_MATERIAL2D_CONTRACT.massPolicy.densityDeferred, true);
    assert.strictEqual(PHYSICS_MATERIAL2D_CONTRACT.massPolicy.rigidBodyMassAuthority, 'ngvge.rigidbody2d.mass');
});
check('RigidBody2D Functional Node has graduated with Transform + Collider + RigidBody components', () => {
    const archetype = getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.RIGID_BODY_2D);
    assert(archetype);
    assert.strictEqual(archetype.implementation, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED);
    assert.deepStrictEqual(archetype.components.map(item => item.typeId), [
        FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D,
        FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D,
        FUNCTIONAL_COMPONENT_TYPE_IDS.RIGIDBODY_2D
    ]);
});
check('RigidBody product admission fails closed until Physics backend is ready', () => {
    assert.match(creationService, /physics2DBackendReady/);
    assert.match(creationService, /status && status\.backendReady/);
});
check('Physics runtime capability and RigidBody command capability are explicit', () => {
    assert.strictEqual(PHYSICS2D_RUNTIME_CAPABILITY_ID, 'ngvge.physics2d-runtime');
    assert.strictEqual(RIGIDBODY2D_COMMAND_CAPABILITY_ID, 'ngvge.rigidbody2d-command');
});
check('Scene System publishes Physics before Functional Node product admission', () => {
    assert.match(sceneModule, /createPhysics2DRuntimeService/);
    assert.match(sceneModule, /PHYSICS2D_RUNTIME_CAPABILITY_ID/);
    assert.match(sceneModule, /RIGIDBODY2D_COMMAND_CAPABILITY_ID/);
    assert.match(sceneModule, /physics2DRuntime:/);
});
check('Module provider seam carries backend adapter instead of raw Rapier constructors', () => {
    assert.match(sceneModule, /physics2d-backend-adapter/);
    assert.doesNotMatch(sceneModule, /physics2d-backend-loader/);
});
check('Production Rapier package import is isolated from semantic core/runtime contract', () => {
    assert.match(loader, /@dimforge\/rapier2d-compat/);
    assert.doesNotMatch(corePhysics, /@dimforge|Rapier|Box2D/);
    assert.doesNotMatch(rigidCore, /@dimforge|Rapier|Box2D/);
    assert.doesNotMatch(materialCore, /@dimforge|Rapier|Box2D/);
});
check('Rapier adapter keeps private body/collider maps', () => {
    assert.match(adapter, /new Map\(\)/);
    assert.match(adapter, /backendHandle/);
});
check('Public Physics runtime strips backend handle value', () => {
    assert.match(runtime, /backendHandlePresent/);
    assert.doesNotMatch(runtime, /backendHandle:\s*state\.backendHandle/);
});
check('Rapier adapter applies RigidBody mass through collider mass, not additional mass', () => {
    assert.match(adapter, /setMass/);
    assert.doesNotMatch(adapter, /setAdditionalMass/);
});
check('Physics world synchronizes semantic Collider projections instead of renderer handles', () => {
    assert.match(runtime, /colliderRuntimeService\.listColliders/);
    assert.match(runtime, /worldPoints/);
    assert.doesNotMatch(runtime, /drawableId|renderer\._/);
});
check('RigidBody persistent editor writes cross a semantic command capability', () => {
    assert.match(inspector, /createRigidBody2DEditorClient/);
    assert.match(inspector, /RigidBody2D/);
    assert.doesNotMatch(inspector, /backendHandle\s*=/);
});
check('Inspector exposes P0 authored rigid-body properties and runtime diagnostics', () => {
    ['Mass', 'Gravity Scale', 'Linear Damping', 'Angular Damping', 'Freeze Rotation', 'CCD', 'Sleeping']
        .forEach(label => assert(inspector.includes(label)));
    assert(inspector.includes('backendHandlePresent') || inspector.includes('Backend Handle'));
});
check('Dependency is pinned exactly and bun.lock carries the exact package', () => {
    assert.strictEqual(pkg.dependencies['@dimforge/rapier2d-compat'], '0.19.3');
    assert(read('bun.lock').includes('@dimforge/rapier2d-compat@0.19.3'));
});
check('N8 architecture explicitly forbids backend handles as semantic identity', () => {
    assert.match(architecture, /Backend body\/collider handles are adapter-private/);
    assert.match(architecture, /not NodeId, ColliderId, RigidBodyId/);
});
check('N8 records real-package execution as pending rather than faking evidence', () => {
    assert.match(architecture, /REAL RAPIER PACKAGE EXECUTION PENDING/);
    assert.match(verification, /REAL RAPIER PACKAGE EXECUTION PENDING/);
    assert.match(verification, /test-only/);
});
check('N8 browser verification remains pending until real backend execution is tested', () => {
    assert.match(verification, /BROWSER EVIDENCE PENDING/);
    assert.match(verification, /RigidBody2D/);
    assert.match(verification, /Stop/);
});
check('N8 keeps .ne native and .sb3 non-native for rigid physics semantics', () => {
    assert.strictEqual(RIGIDBODY2D_CONTRACT.persistence.nativeProject, '.ne');
    assert.strictEqual(RIGIDBODY2D_CONTRACT.persistence.scratchProjection, 'native-only');
    assert.strictEqual(PHYSICS_MATERIAL2D_CONTRACT.persistence.scratchProjection, 'native-only');
});

console.log(`WS-10N8 Physics2D Backend POC Conformance PASS (${checks.length}/${checks.length}).`);
