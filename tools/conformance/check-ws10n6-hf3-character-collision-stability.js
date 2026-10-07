#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const contract = require(path.join(ROOT, 'src/core/character-controller2d'));
const runtimeSource = read('src/lib/character-controller-system/character-controller2d-runtime-service.js');
const debugSource = read('src/components/stage/character-controller2d-debug.jsx');
const stageSource = read('src/components/stage/stage.jsx');
const inspectorSource = read('src/components/project-inspector/project-inspector.jsx');
const runtimeTest = read('test/unit/lib/character-controller-system/character-controller2d-runtime-service.test.js');
const integrationTest = read('test/integration/ws10n6-character-controller2d.integration.test.js');
const debugTest = read('test/unit/components/character-controller2d-debug.test.jsx');
const verificationDoc = read('docs/validation/WS-10N6-HF3-CHARACTER-COLLISION-STABILITY-VERIFICATION.md');

const checks = [];
const check = (title, fn) => {
    fn();
    checks.push(title);
};

check('Character contract keeps stability and recovery runtime-only', () => {
    assert.strictEqual(contract.CHARACTER_CONTROLLER2D_CONTRACT.runtimeState.lastSafeTransformPersistent, false);
    assert.strictEqual(contract.CHARACTER_CONTROLLER2D_CONTRACT.runtimeState.recoveryPersistent, false);
    assert.strictEqual(
        contract.CHARACTER_CONTROLLER2D_CONTRACT.movement.stableSurfaceSelection,
        'alignment + previous-contact stability'
    );
});

check('runtime collision solver has explicit contact slop and safe separation', () => {
    assert.match(runtimeSource, /const CONTACT_SLOP = 1e-4/);
    assert.match(runtimeSource, /separationMargin = Math\.max\(controller\.config\.safeMargin, CONTACT_SLOP \* 0\.5\)/);
    assert.match(runtimeSource, /penetration\.depth > CONTACT_SLOP/);
});

check('runtime keeps a last-safe Transform/world anchor', () => {
    assert.match(runtimeSource, /lastSafeTransform/);
    assert.match(runtimeSource, /lastSafeWorldOrigin/);
    assert.match(runtimeSource, /captureSafePlacement/);
});

check('invalid runtime placement can restore a still-legal anchor', () => {
    assert.match(runtimeSource, /restoreLastSafePlacement/);
    assert.match(runtimeSource, /failed-anchor-invalid/);
    assert.match(runtimeSource, /restored-last-safe/);
    assert.match(runtimeSource, /state\.velocity = \[0, 0\]/);
});

check('floor and wall selection use previous-contact stability', () => {
    assert.match(runtimeSource, /contactStabilityBonus/);
    assert.match(runtimeSource, /stableFloorNodeId/);
    assert.match(runtimeSource, /stableWallNodeId/);
    assert.match(runtimeSource, /finalizeStableContacts/);
});

check('selected CharacterBody2D gets editor-only runtime vectors', () => {
    assert.match(debugSource, /data-ngvge-character-debug-overlay/);
    assert.match(debugSource, /velocity/);
    assert.match(debugSource, /floor-normal/);
    assert.match(debugSource, /wall-normal/);
    assert.match(debugSource, /last-safe/);
    assert.match(stageSource, /CharacterController2DDebug/);
});

check('Inspector exposes read-only stability/recovery diagnostics', () => {
    assert.match(inspectorSource, /Last Safe X/);
    assert.match(inspectorSource, /Recovery/);
    assert.match(inspectorSource, /Stable Floor/);
    assert.match(inspectorSource, /Stable Wall/);
});

check('focused tests cover contact slop, recovery and debug vectors', () => {
    assert.match(runtimeTest, /sub-slop resting penetration/);
    assert.match(integrationTest, /restored-last-safe/);
    assert.match(integrationTest, /stableFloorNodeId/);
    assert.match(integrationTest, /stableWallNodeId/);
    assert.match(debugTest, /velocity, contact normals and last-safe anchor/);
});

check('HF3 does not import a Rigidbody backend into CharacterController2D', () => {
    assert.doesNotMatch(runtimeSource, /Rapier|Box2D|rigidBodyHandle|physicsHandle/);
});

check('browser verification remains pending until real editor evidence', () => {
    assert.match(verificationDoc, /BROWSER EVIDENCE PENDING/);
    assert.match(verificationDoc, /floor seam\/corner/);
    assert.match(verificationDoc, /last-safe anchor/);
});

process.stdout.write(`WS-10N6-HF3 Character Collision Stability Conformance PASS (${checks.length}/${checks.length}).\n`);
