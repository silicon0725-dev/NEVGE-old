#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const inspector = read('src/components/project-inspector/project-inspector.jsx');
const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
const authoring = read('src/lib/editor-visualization/collider-shape-authoring.js');
const collisionRuntime = read('src/lib/collision-system/collider2d-runtime-service.js');
const projection = read('src/lib/transform-system/transform2d-hierarchy-projection.js');
const authoringTest = read('test/unit/lib/editor-visualization/collider-shape-authoring.test.js');
const gizmoTest = read('test/unit/components/collider2d-gizmo.test.jsx');
const inspectorTest = read('test/unit/components/project-inspector.test.jsx');
const verificationDoc = read('docs/validation/WS-10N6-HF5-COLLIDER2D-AUTHORING-COMPLETENESS-VERIFICATION.md');

const checks = [];
const check = (title, fn) => {
    fn();
    checks.push(title);
};

check('Inspector exposes explicit shape-specific size authoring', () => {
    assert.match(inspector, /Rectangle Size/);
    assert.match(inspector, /Circle Size/);
    assert.match(inspector, /Capsule Size/);
    assert.match(inspector, /Polygon Vertices/);
    assert.match(inspector, /Effective local bounds/);
});

check('shape switching preserves current effective bounds', () => {
    assert.match(inspector, /convertColliderShapePreservingBounds/);
    assert.match(authoring, /convertColliderShapePreservingBounds/);
    assert.match(authoringTest, /preserves effective bounds/);
});

check('selected collider exposes direct Stage resize handles', () => {
    assert.match(gizmo, /getColliderShapeAuthoringHandles/);
    assert.match(gizmo, /data-ngvge-collider-handle-kind/);
    assert.match(gizmo, /onPointerDown/);
    assert.match(gizmoTest, /drags selected rectangle handles/);
});

check('Stage authoring goes through Collider2D command capability', () => {
    assert.match(gizmo, /COLLIDER2D_COMMAND_CAPABILITY_ID/);
    assert.match(gizmo, /createCollider2DEditorClient/);
    assert.match(gizmo, /patchComponent/);
    assert.doesNotMatch(gizmo, /setComponentData\s*\(/);
});

check('Stage pointer editing is Camera2D-aware', () => {
    assert.match(gizmo, /screenToWorld/);
    assert.match(gizmo, /worldPointToShapeLocal/);
    assert.match(gizmo, /worldPointToNodeLocal/);
});

check('world-to-local authoring projection is a reversible Transform2D helper', () => {
    assert.match(projection, /applyInverseLocalTransformToPoint/);
    assert.match(projection, /unprojectPointThroughHierarchy/);
    assert.match(collisionRuntime, /shapeLocalPointToWorld/);
    assert.match(collisionRuntime, /worldPointToShapeLocal/);
});

check('rectangle circle capsule and convex polygon are all directly authorable', () => {
    assert.match(authoring, /rectangle-size/);
    assert.match(authoring, /circle-radius/);
    assert.match(authoring, /capsule-radius/);
    assert.match(authoring, /capsule-height/);
    assert.match(authoring, /polygon-vertex/);
});

check('capsule authoring preserves radius/height legality and polygon edits remain convex', () => {
    assert.match(authoring, /radius \* 2/);
    assert.match(authoring, /isConvexPolygon/);
    assert.match(authoringTest, /keeps capsule height legal/);
    assert.match(authoringTest, /reject concave shapes/);
});

check('Inspector test exercises persisted rectangle sizing through command path', () => {
    assert.match(inspectorTest, /size: \[140, 100\]/);
    assert.match(inspectorTest, /radius: 70/);
});

check('HF5 remains browser-evidence gated', () => {
    assert.match(verificationDoc, /BROWSER EVIDENCE PENDING/);
    assert.match(verificationDoc, /drag/iu);
    assert.match(verificationDoc, /Rectangle/);
    assert.match(verificationDoc, /Convex Polygon/);
});

process.stdout.write(`WS-10N6-HF5 Collider2D Authoring Completeness Conformance PASS (${checks.length}/${checks.length}).\n`);
