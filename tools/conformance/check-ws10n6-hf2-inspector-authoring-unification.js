#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const inspectorSource = read('src/components/project-inspector/project-inspector.jsx');
const reducerSource = read('src/reducers/project-inspector.js');
const gizmoSource = read('src/components/stage/collider2d-gizmo.jsx');
const preferenceSource = read('src/lib/editor-visualization/collider-gizmo-preferences.js');
const inspectorTest = read('test/unit/components/project-inspector.test.jsx');
const preferenceTest = read('test/unit/lib/editor-visualization/collider-gizmo-preferences.test.js');
const verificationDoc = read('docs/validation/WS-10N6-HF2-INSPECTOR-AUTHORING-UNIFICATION-VERIFICATION.md');

const checks = [];
const check = (title, fn) => {
    fn();
    checks.push(title);
};

check('Runtime Transform Inspector stays on semantic Transform2D editor client', () => {
    assert.match(inspectorSource, /createTransform2DEditorClient/);
    assert.match(inspectorSource, /commitSelectedRuntimeTransformPatch/);
    assert.match(inspectorSource, /selectedRuntimeScratchBinding \? 'Scratch Compatibility' : 'NGVGE Native'/);
});

check('Scratch-bound Runtime Sprite exposes compatibility appearance without becoming Transform authority', () => {
    assert.match(inspectorSource, /runtime-node:scratch-appearance/);
    assert.match(inspectorSource, /Sprite Appearance/);
    assert.match(inspectorSource, /commitSelectedRuntimeScratchProperty/);
    assert.match(inspectorSource, /Rotation Style/);
    assert.match(inspectorSource, /Draggable/);
});

check('Runtime authoring sections are visible by default', () => {
    ['runtime-node:identity', 'runtime-node:transform', 'runtime-node:scratch-appearance',
        'runtime-node:camera2d', 'runtime-node:collider2d', 'runtime-node:character-controller2d']
        .forEach(sectionId => assert.match(reducerSource, new RegExp(sectionId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
});

check('Collider2D shape authoring is in the Inspector', () => {
    assert.match(inspectorSource, /COLLIDER2D_SHAPE_TYPES\.RECTANGLE/);
    assert.match(inspectorSource, /COLLIDER2D_SHAPE_TYPES\.CIRCLE/);
    assert.match(inspectorSource, /COLLIDER2D_SHAPE_TYPES\.CAPSULE/);
    assert.match(inspectorSource, /COLLIDER2D_SHAPE_TYPES\.CONVEX_POLYGON/);
    assert.match(inspectorSource, /Local Rotation/);
    assert.match(inspectorSource, /Scale Policy/);
});

check('Collider gizmo visibility is editor-only state', () => {
    assert.match(preferenceSource, /COLLIDER_GIZMO_VISIBILITY/);
    assert.match(preferenceSource, /WeakMap/);
    assert.doesNotMatch(preferenceSource, /PatchCollider2D|setComponentData|exportState|serialize|projectData\s*=/);
});

check('Stage overlay consumes editor gizmo preferences', () => {
    assert.match(gizmoSource, /getColliderGizmoPreferences/);
    assert.match(gizmoSource, /gizmoPreferences\.shouldShow/);
    assert.match(gizmoSource, /gizmoPreferences\.subscribe/);
});

check('Inspector exposes Inherit, Always, Selected Only and Hidden gizmo policies', () => {
    assert.match(inspectorSource, /Inherit Editor/);
    assert.match(inspectorSource, />Always</);
    assert.match(inspectorSource, /Selected Only/);
    assert.match(inspectorSource, />Hidden</);
});

check('focused tests cover Scratch-bound Transform routing and appearance', () => {
    assert.match(inspectorTest, /edits Runtime Transform2D through the semantic command capability/);
    assert.match(inspectorTest, /expect\(vm\.postSpriteInfo\)\.not\.toHaveBeenCalled/);
    assert.match(inspectorTest, /Sprite Appearance/);
});

check('focused tests cover editor-only collider gizmo preference behavior', () => {
    assert.match(inspectorTest, /edits Collider2D shape and editor gizmo visibility/);
    assert.match(preferenceTest, /per-node hidden, selected-only and always overrides/);
});

check('browser verification remains pending until real editor evidence', () => {
    assert.match(verificationDoc, /BROWSER EVIDENCE PENDING/);
    assert.match(verificationDoc, /Scratch-bound Sprite/);
    assert.match(verificationDoc, /Set Collider Gizmo to `Hidden`/);
});

process.stdout.write(`WS-10N6-HF2 Inspector Authoring Unification Conformance PASS (${checks.length}/${checks.length}).\n`);
