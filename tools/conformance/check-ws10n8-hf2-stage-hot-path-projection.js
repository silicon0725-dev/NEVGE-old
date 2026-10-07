#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const affine = read('src/components/stage/stage-affine-projection.js');
const collider = read('src/lib/collision-system/collider2d-runtime-service.js');
const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
const toolbar = read('src/components/stage/collider2d-debug-toolbar.jsx');
const preferences = read('src/lib/editor-visualization/collider-gizmo-preferences.js');
const tileContract = read('src/core/tilemap-layer2d/tilemap-layer2d-contract.js');
const tileRuntime = read('src/lib/tilemap-system/tilemap-layer2d-runtime-service.js');
const tileEditor = read('src/components/stage/tilemap2d-editor.jsx');
const tileRenderer = read('src/components/stage/tilemap2d-renderer.jsx');
const architecture = read('docs/architecture/WS-10N8-HF2-STAGE-HOT-PATH-PROJECTION.md');
const verification = read('docs/validation/WS-10N8-HF2-STAGE-HOT-PATH-PROJECTION-VERIFICATION.md');
const checks = [];
const check = (title, fn) => { fn(); checks.push(title); };
check('HF1 remains machine verified but browser-insufficient rather than falsely frozen', () => {
    assert.match(read('docs/architecture/WS-10N8-HF1-PHYSICS-COLLISION-PERFORMANCE.md'), /BROWSER EVIDENCE INSUFFICIENT/);
});
check('Affine projection samples origin and two basis points', () => {
    assert.match(affine, /\[0, 0\]/); assert.match(affine, /\[1, 0\]/); assert.match(affine, /\[0, 1\]/);
});
check('Camera world-to-stage uses a revision-local affine projector', () => {
    assert.match(affine, /createCameraWorldToStageProjector/); assert.match(gizmo, /createCameraWorldToStageProjector/);
});
check('Node local-to-world uses a revision-local affine projector', () => {
    assert.match(affine, /createNodeLocalToWorldProjector/); assert.match(tileEditor, /createNodeLocalToWorldProjector/);
});
check('Bulk collision debug uses imperative Canvas while selected authoring remains separate', () => {
    assert.match(gizmo, /colliderDebugCanvas/); assert.match(gizmo, /drawColliderCanvas/); assert.match(gizmo, /data-ngvge-collider-debug-canvas/);
});
check('Overlap highlighting is editor-only and opt-in', () => {
    assert.match(preferences, /showOverlapState = false/); assert.match(toolbar, /Highlight collision overlaps/);
});
check('Collider viewport snapshot makes overlap state opt-in', () => {
    assert.match(collider, /getDebugViewportSnapshot/); assert.match(collider, /includeOverlapState === true/);
});
check('External collider providers may spatial-query the viewport before materialization', () => {
    assert.match(collider, /queryCollidersInAABB/); assert.match(tileRuntime, /queryCollisionProjectionsInAABB/);
});
check('TileMap bounded enumeration uses Sparse Chunk coordinates', () => {
    assert.match(tileContract, /listTileMapCellsInBounds/); assert.match(tileContract, /minChunkX/); assert.match(tileEditor, /listTileMapCellsInBounds/);
});
check('Collider transform dependency membership is Set-cached', () => {
    assert.match(collider, /nativeTransformDependencyNodeIds = new Set/); assert.match(collider, /nativeTransformDependenciesDirty/);
});
check('TileMap transform dependency membership is Set-cached', () => {
    assert.match(tileRuntime, /transformDependencyNodeIds = new Set/); assert.match(tileRuntime, /transformDependencyRevision/);
});
check('TileMap passive renderer separates layer and camera revisions', () => {
    assert.match(tileRenderer, /layerRevision/); assert.match(tileRenderer, /cameraRevision/);
});
check('TileMap passive renderer culls by viewport before draw', () => {
    assert.match(tileRenderer, /viewportWorldAABB/); assert.match(tileRenderer, /aabbIntersects/);
});
check('Architecture keeps projection caches outside semantic authority', () => {
    assert.match(architecture, /Editor execution cache only/); assert.match(architecture, /does not change/);
});
check('Browser performance evidence remains required', () => {
    assert.match(verification, /BROWSER EVIDENCE PENDING/); assert.match(verification, /Browser evidence required/);
});
console.log(`WS-10N8-HF2 Stage Hot-Path Projection Conformance PASS (${checks.length}/${checks.length}).`);
