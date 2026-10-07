#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const preferenceSource = read('src/lib/editor-visualization/collider-gizmo-preferences.js');
const testDriveSource = read('src/lib/editor-visualization/character-test-drive.js');
const gizmoSource = read('src/components/stage/collider2d-gizmo.jsx');
const toolbarSource = read('src/components/stage/collider2d-debug-toolbar.jsx');
const driveHostSource = read('src/components/stage/character-controller2d-test-drive.jsx');
const stageSource = read('src/components/stage/stage.jsx');
const inspectorSource = read('src/components/project-inspector/project-inspector.jsx');
const preferenceTest = read('test/unit/lib/editor-visualization/collider-gizmo-preferences.test.js');
const driveTest = read('test/unit/lib/editor-visualization/character-test-drive.test.js');
const gizmoTest = read('test/unit/components/collider2d-gizmo.test.jsx');
const verificationDoc = read('docs/validation/WS-10N6-HF4-GODOT-STYLE-COLLISION-DEBUG-TEST-DRIVE-VERIFICATION.md');

const checks = [];
const check = (title, fn) => {
    fn();
    checks.push(title);
};

check('selected Collider2D remains an authoring shape when scene debug is off', () => {
    assert.match(preferenceSource, /nodeId === selectedNodeId/);
    assert.match(preferenceSource, /COLLIDER_GIZMO_GLOBAL_MODE\.HIDDEN/);
    assert.match(preferenceTest, /selected authoring shape visible/);
});

check('Stage exposes a scene-wide visible collision shapes control', () => {
    assert.match(toolbarSource, /Visible collision shapes/);
    assert.match(toolbarSource, /COLLIDER_GIZMO_GLOBAL_MODE\.ALL/);
    assert.match(toolbarSource, /COLLIDER_GIZMO_GLOBAL_MODE\.SELECTED/);
    assert.match(toolbarSource, /COLLIDER_GIZMO_GLOBAL_MODE\.HIDDEN/);
    assert.match(stageSource, /Collider2DDebugToolbar/);
});

check('Collider debug projection makes overlap state visible', () => {
    assert.match(gizmoSource, /getOverlaps/);
    assert.match(gizmoSource, /data-ngvge-collider-overlapping/);
    assert.match(gizmoSource, /COLLISION/);
    assert.match(gizmoSource, /data-ngvge-collider-handle/);
    assert.match(gizmoTest, /marks actual overlap state/);
});

check('Character Test Drive is editor-only state', () => {
    assert.match(testDriveSource, /WeakMap/);
    assert.match(testDriveSource, /PLATFORMER/);
    assert.match(testDriveSource, /TOP_DOWN/);
    assert.match(driveTest, /does not mutate runtime project data/);
});

check('Test Drive uses CharacterController2D runtime movement, not Rigidbody authority', () => {
    assert.match(driveHostSource, /setVelocity/);
    assert.match(driveHostSource, /moveUsingVelocity/);
    assert.match(driveHostSource, /FIXED_DT = 1 \/ 60/);
    assert.match(driveHostSource, /MAX_CATCHUP_STEPS = 8/);
    assert.doesNotMatch(driveHostSource, /Rapier|Box2D|rigidBodyHandle|physicsHandle/);
});

check('Inspector exposes test controls and collision debug policy', () => {
    assert.match(inspectorSource, /Editor Test Drive/);
    assert.match(inspectorSource, /Start Test/);
    assert.match(inspectorSource, /Pause/);
    assert.match(inspectorSource, /Reset/);
    assert.match(inspectorSource, /Debug Shapes/);
});

check('Test Drive keyboard input excludes editable controls', () => {
    assert.match(driveHostSource, /isEditableTarget/);
    assert.match(driveHostSource, /input/);
    assert.match(driveHostSource, /textarea/);
    assert.match(driveHostSource, /select/);
    assert.match(driveHostSource, /isContentEditable/);
});

check('editor visualization remains absent from player-only/full-screen path', () => {
    assert.match(stageSource, /!isPlayerOnly && !isFullScreen/);
    assert.match(stageSource, /CharacterController2DTestDrive/);
});

check('HF4 browser evidence remains pending', () => {
    assert.match(verificationDoc, /BROWSER EVIDENCE PENDING/);
    assert.match(verificationDoc, /COLLISION/);
    assert.match(verificationDoc, /Platformer/);
});

process.stdout.write(`WS-10N6-HF4 Godot-style Collision Debug/Test Drive Conformance PASS (${checks.length}/${checks.length}).\n`);
