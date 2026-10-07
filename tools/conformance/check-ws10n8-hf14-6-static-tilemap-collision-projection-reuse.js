#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const checks = [];
const check = (name, fn) => { fn(); checks.push(name); console.log(`PASS ${name}`); };
const tilemap = read('src/lib/tilemap-system/tilemap-layer2d-runtime-service.js');
const collider = read('src/lib/collision-system/collider2d-runtime-service.js');
const profiler = read('src/lib/frame-profiler/frame-time-profiler.js');
check('HF14.6 keeps a bounded viewport collision projection cache', () => {
  assert.match(tilemap, /viewportCollisionProjectionCache = new Map\(\)/);
  assert.match(tilemap, /MAX_VIEWPORT_COLLISION_CACHE_ENTRIES = 32/);
  assert.match(tilemap, /rememberViewportCollisionProjection/);
});
check('HF14.6 reuses TileSet snapshots and prepared collision templates', () => {
  assert.match(tilemap, /tileSetSnapshotCache = new Map\(\)/);
  assert.match(tilemap, /preparedTileCollisionCache = new Map\(\)/);
  assert.match(tilemap, /getPreparedTileCollisionData/);
  assert.match(tilemap, /basePoints/);
});
check('HF14.6 projects a viewport collision batch through hierarchy once', () => {
  assert.match(tilemap, /allLocalPoints/);
  assert.match(tilemap, /allWorldPoints = projectPointsThroughHierarchy/);
});
check('HF14.6 invalidates caches on TileMap, Transform and TileSet authority changes', () => {
  assert.match(tilemap, /invalidateProjectionCaches/);
  assert.match(tilemap, /tilemap-transform-change/);
  assert.match(tilemap, /tileset-change/);
  assert.match(tilemap, /viewportCollisionProjectionCache\.clear\(\)/);
});
check('HF14.6 preserves stable external collider snapshots', () => {
  assert.match(tilemap, /stableSnapshots: true/);
  assert.match(collider, /acceptsStableSnapshots/);
});
check('HF14.6 reuses non-overlap debug wrappers for stable projections', () => {
  assert.match(collider, /nonOverlapDebugColliderCache = new WeakMap\(\)/);
  assert.match(collider, /withDebugOverlapState/);
});
check('HF14.6 preserves overlap-state computation when requested', () => {
  assert.match(collider, /includeOverlapState \? computeDebugOverlapIds/);
  assert.match(collider, /overlapping === true/);
});
check('HF14.6 diagnostics version is explicit', () => assert.match(profiler, /WS-10N8-HF14\.(?:[6789]|10)/));
console.log(`HF14.6 conformance ${checks.length}/${checks.length} PASS`);
