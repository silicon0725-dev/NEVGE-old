'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const checks = [];
const check = (name, fn) => { fn(); checks.push(name); };

const collider = read('src/lib/collision-system/collider2d-runtime-service.js');
const controller = read('src/lib/character-controller-system/character-controller2d-runtime-service.js');
const testDrive = read('src/components/stage/character-controller2d-test-drive.jsx');
const profiler = read('src/lib/frame-profiler/frame-time-profiler.js');

check('Collider2D runtime exposes a world-AABB query path', () => {
    assert(collider.includes('const queryCollidersInAABB ='));
    assert(collider.includes('queryCollidersInAABB,'));
});
check('world-AABB query delegates external geometry to provider spatial query', () => {
    assert(collider.includes('listExternalCollidersInAABB(sceneId, worldAABB'));
    assert(collider.includes("typeof provider.queryCollidersInAABB === 'function'"));
});
check('CharacterController2D constructs conservative swept AABB queries', () => {
    assert(controller.includes('const sweptAABB ='));
    assert(controller.includes('const queryAABB = sweptAABB(collider.worldPoints, motion);'));
});
check('CharacterController2D uses Collider2D AABB capability when available', () => {
    assert(controller.includes("typeof colliderRuntimeService.queryCollidersInAABB === 'function'"));
    assert(controller.includes('colliderRuntimeService.queryCollidersInAABB(worldAABB'));
});
check('CharacterController2D retains listColliders fallback for compatibility', () => {
    assert(controller.includes('colliderRuntimeService.listColliders(collider.sceneId)'));
});
check('placement penetration queries are AABB-scoped', () => {
    assert(controller.includes('solidCandidates(collider, collider.worldAABB || polygonAABB(collider.worldPoints))'));
});
check('CharacterController2D batches runtime Transform refreshes per logical move', () => {
    assert(controller.includes('const withCollisionRefreshBatch ='));
    assert(controller.includes("'character-move-and-collide'"));
    assert(controller.includes("'character-move-and-slide'"));
});
check('solid-only Collider refresh skips global geometry reconstruction', () => {
    assert(collider.includes('nativeStatus.areaCount === 0'));
    assert(collider.includes('areaOverlapState.size === 0'));
});
check('solid-only fast path still advances geometry revision and emits refresh', () => {
    assert(collider.includes("emit({geometryRevision, reason: reason || 'refresh', type: 'collision:refresh'});"));
});
check('Character Test Drive is now directly profiler-attributed', () => {
    assert(testDrive.includes('FRAME_PROFILER_CATEGORY.CHARACTER_CONTROLLER'));
    assert(testDrive.includes("frameProfiler.count('characterControllerSteps', 1)"));
});
check('Profiler publishes stable Character Controller category', () => {
    assert(profiler.includes("CHARACTER_CONTROLLER: 'character-controller'"));
    assert(profiler.includes("'Character Controller'"));
});
check('continuous SAT remains active', () => {
    assert(controller.includes('const sweepConvexPolygons ='));
    assert(controller.includes('entryTime'));
    assert(controller.includes('exitTime'));
});
check('penetration narrow phase no longer performs a duplicate imported overlap pass', () => {
    assert(!controller.includes('convexPolygonsOverlap\n'));
    assert(controller.includes('aabbOverlaps(polygonAABB(movingPoints), polygonAABB(staticPoints))'));
});
check('circle tessellation remains 32 segments', () => assert(collider.includes('const CIRCLE_SEGMENTS = 32;')));
check('capsule arc tessellation remains 16 segments', () => assert(collider.includes('const CAPSULE_ARC_SEGMENTS = 16;')));

console.log(`WS-10N8-HF12 CharacterController Collision Broad Phase Conformance: ${checks.length}/${checks.length} PASS`);
checks.forEach(name => console.log(`PASS ${name}`));
