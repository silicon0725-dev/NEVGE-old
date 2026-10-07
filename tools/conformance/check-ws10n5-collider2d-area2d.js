#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const {
    COLLIDER2D_CONTRACT,
    COLLIDER2D_SHAPE_TYPES,
    COLLIDER2D_TRANSFORM_INHERITANCE,
    COLLIDER2D_TYPE_ID,
    isConvexPolygon,
    normalizeCollider2D
} = require('../../src/core/collider2d');
const {
    FUNCTIONAL_COMPONENT_TYPE_IDS,
    FUNCTIONAL_NODE_ARCHETYPE_IDS,
    FUNCTIONAL_NODE_IMPLEMENTATION_STATES,
    getFunctionalNodeArchetype
} = require('../../src/core/functional-node');
const {
    COLLIDER2D_COMMAND_CAPABILITY_ID,
    COLLIDER2D_RUNTIME_CAPABILITY_ID
} = require('../../src/lib/collision-system');
const {createFunctionalNodeCreationService} = require('../../src/lib/functional-node');

const checks = [];
const check = (title, fn) => {
    fn();
    checks.push(title);
};

const contractSource = read('src/core/collider2d/collider2d-contract.js');
const foundationSource = read('src/core/functional-node/functional-node-foundation.js');
const creationSource = read('src/core/functional-node/functional-node-creation.js');
const creationServiceSource = read('src/lib/functional-node/functional-node-creation-service.js');
const runtimeSource = read('src/lib/collision-system/collider2d-runtime-service.js');
const commandSource = read('src/lib/collision-system/collider2d-command-capability.js');
const blocksSource = read('src/lib/collision-system/collider2d-scratch-blocks.js');
const sceneModuleSource = read('src/lib/scene-system/module-definition.js');
const runtimeIntegrationSource = read('src/lib/first-party-modules/runtime-integration.js');
const inspectorSource = read('src/components/project-inspector/project-inspector.jsx');
const gizmoSource = read('src/components/stage/collider2d-gizmo.jsx');
const stageSource = read('src/components/stage/stage.jsx');
const stageContainerSource = read('src/containers/stage.jsx');
const architectureDoc = read('docs/architecture/WS-10N5-COLLIDER2D-AREA2D.md');
const verificationDoc = read('docs/validation/WS-10N5-COLLIDER2D-AREA2D-VERIFICATION.md');
const cameraVerificationDoc = read('docs/validation/WS-10N4-CAMERA2D-VERIFICATION.md');

check('N4 is frozen before N5 admission', () => {
    assert.match(cameraVerificationDoc, /FROZEN \/ MACHINE VERIFIED \/ BROWSER VERIFIED/);
});

check('Collider2D owns a stable backend-independent native component contract', () => {
    assert.strictEqual(COLLIDER2D_CONTRACT.typeId, COLLIDER2D_TYPE_ID);
    assert.strictEqual(COLLIDER2D_CONTRACT.schemaVersion, 1);
    assert.strictEqual(COLLIDER2D_CONTRACT.persistence.nativeProject, '.ne');
    assert.strictEqual(COLLIDER2D_CONTRACT.persistence.scratchProjection, 'native-only');
    assert.strictEqual(COLLIDER2D_CONTRACT.identity.backendHandlePersistent, false);
    assert.strictEqual(COLLIDER2D_CONTRACT.identity.nodeIdIsColliderId, false);
});

check('Collider2D explicitly separates collision/query semantics from rigid-body physics', () => {
    assert.strictEqual(COLLIDER2D_CONTRACT.querySemantics.rigidBodyRequired, false);
    assert.strictEqual(COLLIDER2D_CONTRACT.querySemantics.sensorMeaning, 'trigger-non-solid');
    assert.doesNotMatch(contractSource, /Rapier|Box2D|rigidBodyHandle|physicsHandle/);
});

check('P0 supports exactly Rectangle, Circle, Capsule and Convex Polygon profiles', () => {
    assert.deepStrictEqual(new Set(Object.values(COLLIDER2D_SHAPE_TYPES)), new Set([
        'rectangle', 'circle', 'capsule', 'convex-polygon'
    ]));
    assert.deepStrictEqual(normalizeCollider2D().shape, {size: [100, 100], type: 'rectangle'});
});

check('Convex Polygon profile rejects concave/degenerate geometry instead of feeding SAT invalid data', () => {
    assert.strictEqual(isConvexPolygon([[0, 0], [20, 0], [20, 20], [0, 20]]), true);
    assert.strictEqual(isConvexPolygon([[0, 0], [20, 0], [10, 5], [20, 20], [0, 20]]), false);
    assert.match(contractSource, /NGVGE_COLLIDER2D_SHAPE_CONVEXITY_INVALID/);
});

check('Transform2D remains node transform authority while Collider2D owns only local offset/rotation policy', () => {
    assert.strictEqual(COLLIDER2D_CONTRACT.transform.nodeSource, 'Transform2D');
    assert.strictEqual(COLLIDER2D_CONTRACT.transform.localOffsetField, 'offset');
    assert.strictEqual(COLLIDER2D_CONTRACT.transform.localRotationField, 'rotation');
    assert.deepStrictEqual(new Set(COLLIDER2D_CONTRACT.transform.supportedInheritance), new Set(
        Object.values(COLLIDER2D_TRANSFORM_INHERITANCE)
    ));
});

check('Area2D is implemented as native Node2D + Transform2D + sensor Collider2D', () => {
    const area = getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.AREA_2D);
    assert(area);
    assert.strictEqual(area.implementation, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED);
    assert.strictEqual(area.baseRuntimeTypeId, 'ngvge.node2d');
    assert.deepStrictEqual(area.components.map(component => component.typeId), [
        FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D,
        FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D
    ]);
    assert.deepStrictEqual(area.defaults[FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D], {sensor: true});
    assert.match(foundationSource, /label:\s*'Area2D'/);
});

check('N5 keeps Rigidbody2D semantically distinct while later Physics2D may graduate it independently', () => {
    const rigidBody = getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.RIGID_BODY_2D);
    assert(rigidBody);
    assert(rigidBody.components.some(item => item.typeId === FUNCTIONAL_COMPONENT_TYPE_IDS.RIGIDBODY_2D));
});

check('Functional creation provisions real Transform2D and Collider2D components for Area2D', () => {
    assert.match(creationSource, /FUNCTIONAL_NODE_ARCHETYPE_IDS\.AREA_2D/);
    assert.match(creationSource, /FUNCTIONAL_COMPONENT_TYPE_IDS\.COLLIDER_2D/);
    assert.match(creationSource, /createCollider2DComponent/);
});

check('Area2D product admission fails closed without a Collider2D provider', () => {
    assert.match(creationServiceSource, /collider2DAvailable/);
    const runtimeNodeModel = {getNodeType: () => ({abstract: false, allowedScopes: ['scene']})};
    const unavailable = createFunctionalNodeCreationService({runtimeNodeModel, scratchSpriteAdapter: null});
    assert.strictEqual(unavailable.getArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.AREA_2D), null);
    const available = createFunctionalNodeCreationService({
        collider2DAvailable: true,
        runtimeNodeModel,
        scratchSpriteAdapter: null
    });
    assert(available.getArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.AREA_2D));
});

check('Scene System publishes Collider runtime/command capabilities before Area2D creation admission', () => {
    assert.strictEqual(COLLIDER2D_RUNTIME_CAPABILITY_ID, 'ngvge.collider2d-runtime');
    assert.strictEqual(COLLIDER2D_COMMAND_CAPABILITY_ID, 'ngvge.collider2d-command');
    assert.match(sceneModuleSource, /createCollider2DRuntimeService/);
    assert.match(sceneModuleSource, /COLLIDER2D_RUNTIME_CAPABILITY_ID/);
    assert.match(sceneModuleSource, /COLLIDER2D_COMMAND_CAPABILITY_ID/);
    assert.match(sceneModuleSource, /collider2DAvailable:\s*Boolean\(colliderRuntimeService\)/);
    assert(sceneModuleSource.indexOf('createCollider2DRuntimeService') < sceneModuleSource.indexOf('collider2DAvailable: Boolean(colliderRuntimeService)'));
});

check('Collider runtime owns query/overlap services without backend handles', () => {
    ['overlaps', 'getOverlaps', 'queryPoint', 'queryShape', 'raycast', 'getGizmo'].forEach(name => {
        assert.match(runtimeSource, new RegExp(`\\b${name}\\b`));
    });
    assert.match(runtimeSource, /COMPONENT_CARDINALITIES\.ONE/);
    assert.doesNotMatch(runtimeSource, /Rapier|Box2D|rigidBodyHandle|physicsHandle/);
});

check('Collision filtering is symmetric for collider-vs-collider overlap semantics', () => {
    assert.strictEqual(COLLIDER2D_CONTRACT.querySemantics.collisionFilter, '(a.layer & b.mask) && (b.layer & a.mask)');
    assert.match(runtimeSource, /collisionFiltersMatch/);
});

check('Area runtime owns deterministic enter/exit overlap-set transitions', () => {
    assert.match(runtimeSource, /areaOverlapState/);
    assert.match(runtimeSource, /type:\s*'area:enter'/);
    assert.match(runtimeSource, /type:\s*'area:exit'/);
    assert.match(runtimeSource, /transformRuntimeStore\.subscribe/);
    assert.match(runtimeSource, /sceneRuntime\.subscribe/);
});

check('Persistent Collider2D edits cross a semantic command capability', () => {
    assert.match(commandSource, /COLLIDER2D_PATCH_COMMAND_TYPE/);
    assert.match(commandSource, /patchPersistentCollider/);
    assert.match(commandSource, /createCollider2DEditorClient/);
    assert.doesNotMatch(inspectorSource, /setComponentData\([^\n]*collider/i);
});

check('Scratch collision blocks are runtime/query consumers and never become persistence authority', () => {
    assert.match(blocksSource, /collidersOverlap/);
    assert.match(blocksSource, /pointInside/);
    assert.match(blocksSource, /overlapCount/);
    assert.match(blocksSource, /rayHitNode/);
    assert.doesNotMatch(blocksSource, /setComponentData|patchPersistentCollider|PatchCollider2D/);
});

check('Raw VM installs Collider2D Scratch blocks outside the portable Scene module facade', () => {
    assert.match(runtimeIntegrationSource, /installCollider2DScratchBlocks\(vm\)/);
    assert.doesNotMatch(sceneModuleSource, /installCollider2DScratchBlocks/);
});

check('Inspector exposes real Collider2D editing through semantic capabilities', () => {
    assert.match(inspectorSource, /COLLIDER2D_RUNTIME_CAPABILITY_ID/);
    assert.match(inspectorSource, /COLLIDER2D_COMMAND_CAPABILITY_ID/);
    assert.match(inspectorSource, /id="runtime-node:collider2d"/);
    assert.match(inspectorSource, />Rectangle</);
    assert.match(inspectorSource, />Circle</);
    assert.match(inspectorSource, />Capsule</);
    assert.match(inspectorSource, />Convex Polygon</);
    assert.match(inspectorSource, /label="Layer"/);
    assert.match(inspectorSource, /label="Mask"/);
    assert.match(inspectorSource, /Sensor/);
});

check('Stage Collider2D gizmo follows Camera2D world-to-screen projection', () => {
    assert.match(gizmoSource, /COLLIDER2D_RUNTIME_CAPABILITY_ID/);
    assert.match(gizmoSource, /CAMERA2D_RUNTIME_CAPABILITY_ID/);
    assert.match(gizmoSource, /getGizmo/);
    assert.match(gizmoSource, /worldToScreen/);
    assert.match(stageSource, /Collider2DGizmo/);
    assert.match(stageContainerSource, /selectedNodeId/);
});

check('Architecture documentation preserves .ne native identity and .sb3 non-native classification', () => {
    assert.match(architectureDoc, /\.ne/);
    assert.match(architectureDoc, /\.sb3/);
    assert.match(architectureDoc, /native-only/i);
    assert.match(architectureDoc, /does \*\*not\*\* add Rigidbody2D/i);
});

check('Browser verification explicitly protects Scratch touching semantics and Camera-aligned gizmos', () => {
    assert.match(verificationDoc, /Scratch.*touching\?/i);
    assert.match(verificationDoc, /Camera2D/i);
    assert.match(verificationDoc, /gizmo/i);
    assert.match(verificationDoc, /FROZEN \/ MACHINE VERIFIED \/ BROWSER VERIFIED/);
});

process.stdout.write(`WS-10N5 Collider2D + Area2D Conformance PASS (${checks.length}/${checks.length}).\n`);
