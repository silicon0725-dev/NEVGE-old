#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const registry = read('src/lib/project-nodes/node-type-registry.js');
const explorer = read('src/components/project-explorer/project-explorer.jsx');
const inspector = read('src/components/project-inspector/project-inspector.jsx');
const colliderGizmo = read('src/components/stage/collider2d-gizmo.jsx');
const characterDebug = read('src/components/stage/character-controller2d-debug.jsx');
const databaseTest = read('test/unit/lib/project-nodes-node-database.test.js');
const explorerTest = read('test/unit/components/project-explorer.test.jsx');
const inspectorTest = read('test/unit/components/project-inspector.test.jsx');
const colliderGizmoTest = read('test/unit/components/collider2d-gizmo.test.jsx');
const characterDebugTest = read('test/unit/components/character-controller2d-debug.test.jsx');
const verification = read('docs/validation/WS-10N6-HF6-FUNCTIONAL-COLLISION-MIGRATION-LEGACY-BOUNDARY-VERIFICATION.md');

const checks = [];
const check = (title, fn) => {
    fn();
    checks.push(title);
};

check('legacy Project collision types remain registered but creation-hidden', () => {
    assert.match(registry, /creationHidden:\s*true[\s\S]*?id:\s*'ngvge\.collider2d'/);
    assert.match(registry, /creationHidden:\s*true[\s\S]*?id:\s*'ngvge\.physics-body2d'/);
    assert.match(registry, /legacyCompatibilityOnly:\s*true/);
    assert.match(registry, /includeDeprecatedCompatibility/);
});

check('default Project-node creation list excludes creation-hidden compatibility types', () => {
    assert.match(registry, /filter\(nodeType => includeDeprecatedCompatibility \|\| !nodeType\.creationHidden\)/);
    assert.match(databaseTest, /out of new-node menus/);
});

check('compatibility Stage and Sprite Add Child routes into Functional Runtime creation', () => {
    assert.match(explorer, /openFunctionalChildDialogForCompatibilityNode/);
    assert.match(explorer, /scratchBindingByTargetRuntimeId/);
    assert.match(explorer, /openRuntimeCreateNodeDialog/);
    assert.match(explorerTest, /routes Add Child from a compatibility Stage target into the Functional Scene tree/);
});

check('Inspector identifies the old Collider2D as non-runtime compatibility data', () => {
    assert.match(inspector, /Legacy Collider2D compatibility node/);
    assert.match(inspector, /does not own an[\s\S]*ngvge\.collider2d@1 Runtime Component/);
    assert.match(inspector, /cannot render a collision gizmo/);
});

check('legacy Collider2D exposes deliberate Functional migration targets', () => {
    assert.match(inspector, /Upgrade as StaticBody2D/);
    assert.match(inspector, /Upgrade as Area2D/);
    assert.match(inspector, /FUNCTIONAL_NODE_ARCHETYPE_IDS\.STATIC_BODY_2D/);
    assert.match(inspector, /FUNCTIONAL_NODE_ARCHETYPE_IDS\.AREA_2D/);
});

check('migration provisions a Functional node and patches the real Collider2D command path', () => {
    assert.match(inspector, /FUNCTIONAL_NODE_CREATION_CAPABILITY_ID/);
    assert.match(inspector, /WORKSPACE_NODE_DOMAINS\.RUNTIME/);
    assert.match(inspector, /colliderEditorClient\.patchComponent/);
    assert.match(inspector, /legacyColliderPropertiesToPatch/);
    assert.doesNotMatch(inspector, /setComponentData\s*\(/);
});

check('migration is transactional enough to preserve legacy data on failure', () => {
    const createIndex = inspector.indexOf('workspaceNodeCommandClient.createNode');
    const patchIndex = inspector.indexOf('colliderEditorClient.patchComponent', createIndex);
    const legacyDeleteIndex = inspector.indexOf('workspaceNodeCommandClient.destroyNode({nodeId: selectedNode.id})', patchIndex);
    assert.ok(createIndex >= 0 && patchIndex > createIndex && legacyDeleteIndex > patchIndex);
    assert.match(inspector, /if \(createdNodeId\)[\s\S]*destroyNode\(\{nodeId: createdNodeId\}\)/);
});

check('focused Inspector test verifies legacy geometry transfer into a real Runtime collider', () => {
    assert.match(inspectorTest, /upgrades a legacy Collider2D compatibility node into a Functional StaticBody2D/);
    assert.match(inspectorTest, /size:\s*\[140, 60\]/);
    assert.match(inspectorTest, /offset:\s*\[12, -6\]/);
    assert.match(inspectorTest, /collisionLayer:\s*4/);
    assert.match(inspectorTest, /collisionMask:\s*8/);
});

check('focused migration failure test preserves legacy data and rolls back the replacement', () => {
    assert.match(inspectorTest, /keeps the legacy Collider2D intact when Functional migration fails/);
    assert.match(inspectorTest, /simulated migration failure/);
    assert.match(inspectorTest, /not\.toHaveBeenCalledWith\(\{nodeId: legacyCollider\.id\}\)/);
});

check('Stage materializes portable Collider2D and Camera2D capability values before array validation', () => {
    assert.match(colliderGizmo, /materializePortableCapabilityValue\(colliderRuntime\.listColliders\(\)\)/);
    assert.match(colliderGizmo, /materializePortableCapabilityValue\(colliderRuntime\.getGizmo\(nodeId\)\)/);
    assert.match(colliderGizmo, /materializePortableCapabilityValue\(cameraRuntime\.worldToScreen\(point\)\)/);
    assert.match(colliderGizmo, /materializePortableCapabilityValue\(cameraRuntime\.screenToWorld\(point\)\)/);
    assert.match(colliderGizmoTest, /renders and authors collider arrays returned through real Module capability facades/);
    assert.match(colliderGizmoTest, /createServiceFacadeFactory/);
});

check('Inspector and Character debug materialize structured Runtime capability DTOs', () => {
    assert.match(inspector, /materializePortableCapabilityValue\(runtimeNodeModel\.getNodeSnapshot/);
    assert.match(inspector, /materializePortableCapabilityValue\(colliderRuntimeCapability\.getCollider/);
    assert.match(characterDebug, /materializePortableCapabilityValue\(characterRuntime\.getController/);
    assert.match(inspectorTest, /createServiceFacadeFactory/);
    assert.match(characterDebugTest, /renders nested vector arrays returned through real Module capability facades/);
});

check('HF6 remains browser-evidence gated on both real capability projection and legacy migration', () => {
    assert.match(verification, /BROWSER EVIDENCE PENDING/);
    assert.match(verification, /production Module capability facade/);
    assert.match(verification, /Collision Shapes = All/);
    assert.match(verification, /Upgrade as Area2D/);
    assert.match(verification, /Upgrade as StaticBody2D/);
});

process.stdout.write(`WS-10N6-HF6 Functional Collision Projection & Legacy Boundary Conformance PASS (${checks.length}/${checks.length}).\n`);
