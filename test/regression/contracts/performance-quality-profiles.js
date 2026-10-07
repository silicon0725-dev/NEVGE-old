'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const assertPerformanceQualityProfilesContract = () => {
    const preferences = read('src/lib/performance-quality/performance-quality-preferences.js');
    const physics = read('src/lib/physics-system/physics2d-runtime-service.js');
    const collider = read('src/lib/collision-system/collider2d-runtime-service.js');
    const tileMap = read('src/lib/tilemap-system/tilemap-layer2d-runtime-service.js');
    const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
    const renderer = read('src/components/stage/tilemap2d-renderer.jsx');
    assert(preferences.includes('PERFORMANCE_RENDER_QUALITY'));
    assert(preferences.includes('PERFORMANCE_PHYSICS_QUALITY'));
    assert(preferences.includes('PERFORMANCE_DEBUG_DETAIL'));
    assert(physics.includes("type: 'physics:quality-change'"));
    assert(physics.includes('fixedDeltaSeconds: 1 / quality.fixedHz'));
    assert(collider.includes('snapshotOptions.maxColliders'));
    assert(tileMap.includes('queryOptions.maxResults'));
    assert(gizmo.includes('maxCollisionDebugShapes'));
    assert(renderer.includes('renderSettings.canvasScale'));
    return {
        debugBudgetBeforeProjection: true,
        independentQualityAxes: true,
        physicsExecutionPolicyOnly: true,
        renderCanvasQuality: true
    };
};
module.exports = {assertPerformanceQualityProfilesContract};
