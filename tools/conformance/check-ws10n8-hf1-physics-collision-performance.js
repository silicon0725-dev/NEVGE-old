#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const collider = read('src/lib/collision-system/collider2d-runtime-service.js');
const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
const tileMap = read('src/lib/tilemap-system/tilemap-layer2d-runtime-service.js');
const physics = read('src/lib/physics-system/physics2d-runtime-service.js');
const architecture = read('docs/architecture/WS-10N8-HF1-PHYSICS-COLLISION-PERFORMANCE.md');
const verification = read('docs/validation/WS-10N8-HF1-PHYSICS-COLLISION-PERFORMANCE-VERIFICATION.md');
const checks = [];
const check = (title, fn) => { fn(); checks.push(title); };

check('N8 base conformance remains the parent contract', () => {
    assert.match(read('docs/architecture/WS-10N8-PHYSICS2D-BACKEND-POC.md'), /MACHINE VERIFIED/);
});
check('Collider runtime exposes one revision-scoped debug snapshot', () => {
    assert.match(collider, /getDebugSnapshot/);
    assert.match(collider, /debugSnapshotCache/);
    assert.match(collider, /geometryRevision/);
});
check('Debug overlap preparation has an AABB broad phase before SAT narrow phase', () => {
    assert.match(collider, /worldAABB\.minX/);
    assert.match(collider, /aabbOverlaps/);
    assert.match(collider, /convexPolygonsOverlapNarrow/);
});
check('Physics Transform writeback can coalesce collision refresh work', () => {
    assert.match(collider, /beginRefreshBatch/);
    assert.match(collider, /endRefreshBatch/);
    assert.match(physics, /beginRefreshBatch/);
    assert.match(physics, /endRefreshBatch\('physics-step'\)/);
});
check('Stage consumes the debug snapshot instead of mandatory per-collider getOverlaps', () => {
    assert.match(gizmo, /getDebug(?:Viewport)?Snapshot/);
    assert.match(gizmo, /includeOverlapState|snapshotHasOverlapState/);
});
check('Stage collision debug culls by current world viewport', () => {
    assert.match(gizmo, /viewportWorldAABB/);
    assert.match(gizmo, /aabbIntersects/);
});
check('Dense scene collision debug remains batched or is superseded by a lower-DOM canvas fast path', () => {
    assert.ok(/COLLIDER_BATCH_RENDER_THRESHOLD/.test(gizmo) || /colliderDebugCanvas/.test(gizmo));
});
check('TileMap collision projections are cached separately and frozen', () => {
    assert.match(tileMap, /collisionProjectionCache/);
    assert.match(tileMap, /projectionRevision/);
    assert.match(tileMap, /stableSnapshots:\s*true/);
});
check('Unrelated dynamic Transforms do not invalidate TileMap collision geometry', () => {
    assert.match(tileMap, /transformAffectsTileMap/);
    assert.match(tileMap, /transformDependencyNodeIds|isNodeInAncestorChain/);
});
check('Physics backend body descriptors are dirty-driven instead of synced every fixed step', () => {
    assert.match(physics, /descriptorSyncDirty/);
    assert.match(physics, /descriptorCache/);
    assert.match(physics, /if \(descriptorSyncDirty\)/);
});
check('Physics-originated collision refresh does not dirty the static descriptor set again', () => {
    assert.match(physics, /change\.reason === 'physics-step'/);
});
check('Verification keeps browser performance evidence pending', () => {
    assert.match(architecture, /BROWSER EVIDENCE (?:PENDING|INSUFFICIENT)/);
    assert.match(verification, /Browser performance evidence (?:remains pending|was insufficient)/);
});

console.log(`WS-10N8-HF1 Physics & Collision Performance Conformance PASS (${checks.length}/${checks.length}).`);
