#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const profiler = read('src/lib/frame-profiler/frame-time-profiler.js');
const toolbar = read('src/components/stage/frame-time-profiler-toolbar.jsx');
const stage = read('src/components/stage/stage.jsx');
const physics = read('src/lib/physics-system/physics2d-runtime-service.js');
const collider = read('src/components/stage/collider2d-gizmo.jsx');
const tileRenderer = read('src/components/stage/tilemap2d-renderer.jsx');
const tileEditor = read('src/components/stage/tilemap2d-editor.jsx');
const architecture = read('docs/architecture/WS-10N8-HF4-FRAME-TIME-PROFILER.md');
const verification = read('docs/validation/WS-10N8-HF4-FRAME-TIME-PROFILER-VERIFICATION.md');
const checks = [];
const check = (title, fn) => { fn(); checks.push(title); };
check('Profiler is disabled by default', () => assert.match(profiler, /let enabled = false/));
check('Profiler samples frame intervals through requestAnimationFrame only when active', () => {
    assert.match(profiler, /requestAnimationFrame/);
    assert.match(profiler, /if \(!enabled/);
});
check('Frame snapshot exposes percentile diagnostics', () => {
    assert.match(profiler, /frameP50Ms/);
    assert.match(profiler, /frameP95Ms/);
    assert.match(profiler, /frameP99Ms/);
});
check('Scratch renderer probe is temporary and restored', () => {
    assert.match(profiler, /rendererOriginalDraw/);
    assert.match(profiler, /restoreRenderer/);
});
check('Scratch VM execution probe is temporary', () => {
    assert.match(profiler, /BEFORE_EXECUTE/);
    assert.match(profiler, /removeListener\('BEFORE_EXECUTE'/);
});
check('Physics2D fixed steps are directly measured', () => assert.match(physics, /FRAME_PROFILER_CATEGORY\.PHYSICS/));
check('TileMap passive render is directly measured', () => assert.match(tileRenderer, /FRAME_PROFILER_CATEGORY\.TILEMAP_RENDER/));
check('TileMap editor render is directly measured', () => assert.match(tileEditor, /FRAME_PROFILER_CATEGORY\.TILEMAP_EDITOR/));
check('Collider preparation and Canvas draw are separately measured', () => {
    assert.match(collider, /FRAME_PROFILER_CATEGORY\.COLLIDER_PREPARE/);
    assert.match(collider, /FRAME_PROFILER_CATEGORY\.COLLIDER_CANVAS/);
});
check('React Stage overlays use React Profiler diagnostics', () => {
    assert.match(stage, /React\.Profiler/);
    assert.match(stage, /FRAME_PROFILER_CATEGORY\.REACT_OVERLAYS/);
});
check('Stage exposes bounded 5-second capture UI', () => {
    assert.match(toolbar, /Capture 5s/);
    assert.match(toolbar, /5000/);
});
check('Profiler report can be copied for browser handoff', () => assert.match(toolbar, /clipboard\.writeText/));
check('Diagnostic policy does not become persistent authority', () => {
    assert.match(architecture, /does not mutate `\.ne`/);
    assert.match(architecture, /disabled by default/);
});
check('HF3 low-quality evidence is recorded as insufficient', () => assert.match(verification, /visible frame drops/));
check('Browser capture remains mandatory before root-cause claim or Freeze', () => assert.match(verification, /BROWSER CAPTURE REQUIRED/));
console.log(`WS-10N8-HF4 Frame-Time Profiler Conformance PASS (${checks.length}/${checks.length}).`);
