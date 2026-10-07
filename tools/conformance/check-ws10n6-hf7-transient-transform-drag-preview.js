#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const stage = read('src/containers/stage.jsx');
const preview = read('src/lib/editor-visualization/editor-transform-preview.js');
const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
const inspector = read('src/components/project-inspector/project-inspector.jsx');
const previewTest = read('test/unit/lib/editor-visualization/editor-transform-preview.test.js');
const stageTest = read('test/unit/components/stage-transform-drag-preview.test.jsx');
const gizmoTest = read('test/unit/components/collider2d-gizmo.test.jsx');
const inspectorTest = read('test/unit/components/project-inspector.test.jsx');
const verification = read('docs/validation/WS-10N6-HF7-TRANSIENT-TRANSFORM-DRAG-PREVIEW-VERIFICATION.md');

const checks = [];
const check = (title, fn) => {
    fn();
    checks.push(title);
};

check('editor transform preview is a runtime-keyed transient store', () => {
    assert.match(preview, /const stores = new WeakMap\(\)/);
    assert.match(preview, /authoredPosition/);
    assert.match(preview, /previewPosition/);
    assert.match(preview, /delta/);
    assert.doesNotMatch(preview, /writeProject|serialize|localStorage/);
});

check('Stage updates preview continuously without authoring Transform2D on pointer move', () => {
    assert.match(stage, /positionDragCanvas\(mousePosition\[0\], mousePosition\[1\]\)[\s\S]*updateEditorDragPreview/);
    assert.match(stageTest, /executeTransformCommand\)\.not\.toHaveBeenCalled\(\)/);
});

check('Stage resolves stable NodeId and commits through Transform2D Editor client', () => {
    assert.match(stage, /getBindingByTargetRuntimeId/);
    assert.match(stage, /createTransform2DEditorClient/);
    assert.match(stage, /context\.editorClient\.patchComponent/);
    assert.match(stageTest, /type:\s*'PatchComponent'/);
});

check('Camera2D screen-to-world mapping is part of drag coordinate resolution', () => {
    assert.match(stage, /CAMERA2D_RUNTIME_CAPABILITY_ID/);
    assert.match(stage, /cameraRuntime\.screenToWorld\(screenPoint\)/);
});

check('one drag produces one Property History transaction', () => {
    assert.match(stage, /history\.recordValue/);
    assert.match(stage, /label:\s*'Move Sprite'/);
    assert.match(stageTest, /undoDepth:\s*1/);
});

check('Escape and window blur cancel transient drag state', () => {
    assert.match(stage, /handleDragCancelKeyDown/);
    assert.match(stage, /handleDragWindowBlur/);
    assert.match(stage, /previewStore\.cancel/);
    assert.match(stageTest, /Escape cancels the preview without committing position/);
});

check('Collider gizmo applies preview translation to the dragged semantic subtree', () => {
    assert.match(gizmo, /isNodeDescendantOrSelf/);
    assert.match(gizmo, /translateWorldPoints/);
    assert.match(gizmo, /data-ngvge-collider-transform-preview/);
    assert.match(gizmoTest, /projects a dragged Scratch parent subtree/);
});

check('preview collision highlighting is recomputed locally and does not mutate Runtime authority', () => {
    assert.match(gizmo, /convexPolygonsOverlap/);
    assert.match(gizmo, /collisionFiltersMatch/);
    assert.match(gizmoTest, /recomputes visible overlap without mutating Runtime Collider authority/);
});

check('Inspector exposes transient position as Editor Drag Preview', () => {
    assert.match(inspector, /selectedRuntimeTransformPreview/);
    assert.match(inspector, /Editor Drag Preview/);
    assert.match(inspector, /Transient · commit on release/);
    assert.match(inspectorTest, /Editor Drag Preview/);
});

check('HF7 preview store has direct lifecycle regression coverage', () => {
    assert.match(previewTest, /keeps authored transform separate from transient drag position/);
    assert.match(previewTest, /cancels without promoting preview coordinates to authored state/);
});

check('HF7 remains browser-evidence gated', () => {
    assert.match(verification, /BROWSER EVIDENCE PENDING/);
    assert.match(verification, /Camera2D/);
    assert.match(verification, /one-step Undo/);
});

process.stdout.write(
    `WS-10N6-HF7 Transient Transform Drag Preview Conformance PASS (${checks.length}/${checks.length}).\n`
);
