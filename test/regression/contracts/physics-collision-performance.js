'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const assertPhysicsCollisionPerformanceContract = () => {
    const collider = read('src/lib/collision-system/collider2d-runtime-service.js');
    const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
    const tileMap = read('src/lib/tilemap-system/tilemap-layer2d-runtime-service.js');
    const physics = read('src/lib/physics-system/physics2d-runtime-service.js');
    assert(collider.includes('getDebugSnapshot'));
    assert(collider.includes('beginRefreshBatch'));
    assert(collider.includes('convexPolygonsOverlapNarrow'));
    assert(gizmo.includes('COLLIDER_BATCH_RENDER_THRESHOLD') || gizmo.includes('colliderDebugCanvas'));
    assert(gizmo.includes('viewportWorldAABB'));
    assert(tileMap.includes('collisionProjectionCache'));
    assert(tileMap.includes('transformAffectsTileMap'));
    assert(tileMap.includes('stableSnapshots: true'));
    assert(physics.includes('descriptorSyncDirty'));
    assert(physics.includes("change.reason === 'physics-step'"));
    return {
        collisionDebugSnapshot: true,
        collisionRefreshBatching: true,
        physicsDescriptorDirtySync: true,
        tileMapProjectionCache: true,
        viewportCulledBatchedGizmos: true
    };
};
module.exports = {assertPhysicsCollisionPerformanceContract};
