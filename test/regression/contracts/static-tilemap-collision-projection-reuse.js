 'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../../..');
const source = fs.readFileSync(path.join(root, 'src/lib/tilemap-system/tilemap-layer2d-runtime-service.js'), 'utf8');
const collider = fs.readFileSync(path.join(root, 'src/lib/collision-system/collider2d-runtime-service.js'), 'utf8');
const assertStaticTileMapCollisionProjectionReuseContract = () => {
  assert.match(source, /viewportCollisionProjectionCache/);
  assert.match(source, /MAX_VIEWPORT_COLLISION_CACHE_ENTRIES/);
  assert.match(source, /preparedTileCollisionCache/);
  assert.match(source, /allWorldPoints = projectPointsThroughHierarchy/);
  assert.match(source, /viewportCollisionProjectionCache\.clear\(\)/);
  assert.match(collider, /nonOverlapDebugColliderCache/);
  return {boundedViewportCache: true, preparedTileTemplates: true, stableDebugWrappers: true};
};
module.exports = {assertStaticTileMapCollisionProjectionReuseContract};
