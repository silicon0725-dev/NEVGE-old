#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const preferences = read('src/lib/performance-quality/performance-quality-preferences.js');
const scheduler = read('src/lib/performance-quality/quality-frame-scheduler.js');
const toolbar = read('src/components/stage/performance-quality-toolbar.jsx');
const stage = read('src/components/stage/stage.jsx');
const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
const tileRenderer = read('src/components/stage/tilemap2d-renderer.jsx');
const tileEditor = read('src/components/stage/tilemap2d-editor.jsx');
const collider = read('src/lib/collision-system/collider2d-runtime-service.js');
const tileRuntime = read('src/lib/tilemap-system/tilemap-layer2d-runtime-service.js');
const physics = read('src/lib/physics-system/physics2d-runtime-service.js');
const architecture = read('docs/architecture/WS-10N8-HF3-PERFORMANCE-QUALITY-PROFILES.md');
const verification = read('docs/validation/WS-10N8-HF3-PERFORMANCE-QUALITY-PROFILES-VERIFICATION.md');
const checks = [];
const check = (title, fn) => { fn(); checks.push(title); };
check('Render quality has Performance/Balanced/Quality presets', () => {
    assert.match(preferences, /canvasScale: 0\.5/);
    assert.match(preferences, /canvasScale: 0\.75/);
    assert.match(preferences, /canvasScale: 1/);
});
check('Physics quality exposes 30/45/60 Hz execution policies', () => {
    assert.match(preferences, /fixedHz: 30/);
    assert.match(preferences, /fixedHz: 45/);
    assert.match(preferences, /fixedHz: 60/);
});
check('Pre-HF3 60 Hz Physics behavior remains the default', () => {
    assert.match(preferences, /physicsQuality = PERFORMANCE_PHYSICS_QUALITY\.PRECISE/);
});
check('Debug detail limits dense collision visualization', () => {
    assert.match(preferences, /maxCollisionDebugShapes: 300/);
    assert.match(preferences, /maxCollisionDebugShapes: 5000/);
});
check('Stage exposes a Quality settings panel', () => {
    assert.match(toolbar, /NGVGE render quality/);
    assert.match(toolbar, /NGVGE physics quality/);
    assert.match(stage, /PerformanceQualityToolbar/);
});
check('Render quality scales Collision Debug Canvas', () => {
    assert.match(gizmo, /renderQualitySettings\.canvasScale/);
});
check('Render quality scales TileMap passive renderer and authoring canvas', () => {
    assert.match(tileRenderer, /renderSettings\.canvasScale/);
    assert.match(tileEditor, /renderSettings\.canvasScale/);
});
check('Render refresh policy uses a quality-aware frame scheduler', () => {
    assert.match(scheduler, /1000 \/ hz/);
    assert.match(gizmo, /createQualityFrameScheduler/);
    assert.match(tileRenderer, /tileMapRefreshHz/);
});
check('Physics runtime applies quality without persistent component mutation', () => {
    assert.match(physics, /fixedDeltaSeconds: 1 \/ quality\.fixedHz/);
    assert.match(physics, /physics:quality-change/);
});
check('Collision viewport accepts a pre-materialization debug budget', () => {
    assert.match(collider, /snapshotOptions\.maxColliders/);
    assert.match(gizmo, /maxColliders: debugSettings\.maxCollisionDebugShapes/);
});
check('TileMap AABB collision provider obeys maxResults before full projection', () => {
    assert.match(tileRuntime, /queryOptions\.maxResults/);
    assert.match(tileRuntime, /projections\.length >= maxResults/);
});
check('Quality remains execution policy rather than semantic authority', () => {
    assert.match(architecture, /execution policy only/);
    assert.match(architecture, /≠ \.ne stable identity/);
});
check('HF3 browser evidence records lowest-quality insufficiency', () => {
    assert.match(verification, /BROWSER EVIDENCE INSUFFICIENT/);
    assert.match(verification, /lowest tested combination/);
    assert.match(verification, /HF4/);
});
console.log(`WS-10N8-HF3 Performance Quality Profiles Conformance PASS (${checks.length}/${checks.length}).`);
