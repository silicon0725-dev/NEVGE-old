#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const queryBackend = read('src/lib/physics-system/rapier2d-shape-query-backend.js');
const adapter = read('src/lib/physics-system/rapier2d-backend-adapter.js');
const physics = read('src/lib/physics-system/physics2d-runtime-service.js');
const character = read('src/lib/character-controller-system/character-controller2d-runtime-service.js');
const profiler = read('src/lib/frame-profiler/frame-time-profiler.js');
const moduleDefinition = read('src/lib/scene-system/module-definition.js');
const collider = read('src/lib/collision-system/collider2d-runtime-service.js');

const checks = [
    ['Rapier query backend owns analytic Cuboid/Ball/Capsule shapes', () => {
        assert.match(queryBackend, /new RAPIER\.Cuboid/);
        assert.match(queryBackend, /new RAPIER\.Ball/);
        assert.match(queryBackend, /new RAPIER\.Capsule/);
    }],
    ['true convex polygons retain Rapier ConvexPolygon fallback', () => assert.match(queryBackend, /new RAPIER\.ConvexPolygon/)],
    ['shape query backend delegates sweep and overlap to Rapier/Parry shape queries', () => {
        assert.match(queryBackend, /\.castShape\(/);
        assert.match(queryBackend, /\.contactShape\(/);
    }],
    ['Physics2D backend maps semantic primitives to native Rapier ColliderDesc primitives', () => {
        assert.match(adapter, /ColliderDesc\.cuboid/);
        assert.match(adapter, /ColliderDesc\.ball/);
        assert.match(adapter, /ColliderDesc\.capsule/);
        assert.match(adapter, /ColliderDesc\.convexHull/);
    }],
    ['Physics2D descriptor carries NGVGE semantic shape type across backend boundary', () => assert.match(physics, /shapeType:/)],
    ['CharacterController initializes the replaceable Rapier shape query backend', () => {
        assert.match(character, /createRapier2DShapeQueryBackend/);
        assert.match(character, /initializeShapeQueryBackend/);
        assert.match(moduleDefinition, /shapeQueryBackendLoader:\s*loadRapier2DCompat/);
    }],
    ['one Character move creates one reusable collision query session', () => {
        assert.match(character, /createCollisionQuerySession/);
        assert.match(character, /querySession/);
        assert.match(character, /characterCollisionQuerySessions/);
    }],
    ['Rapier path requires every candidate to prepare successfully before replacing SAT', () => {
        assert.match(character, /preparedCandidates\.length === session\.candidates\.length/);
        assert.match(character, /sweepConvexPolygons/);
        assert.match(character, /convexPolygonPenetration/);
    }],
    ['Rapier shape casts and contacts are independently profiled', () => {
        assert.match(profiler, /CHARACTER_COLLISION_QUERY/);
        assert.match(character, /characterRapierShapeCasts/);
        assert.match(character, /characterRapierContactQueries/);
    }],
    ['HF14 diagnostic reports identify the active browser instrumentation generation', () => {
        assert.match(profiler, /FRAME_PROFILER_DIAGNOSTICS_VERSION = 'WS-10N8-HF14(?:\.[0-9]+)?'/);
        assert.match(profiler, /diagnosticsVersion: FRAME_PROFILER_DIAGNOSTICS_VERSION/);
    }],
    ['Circle/Capsule authoring tessellation remains unchanged for visualization and safe fallback', () => {
        assert.match(collider, /const CIRCLE_SEGMENTS = 32/);
        assert.match(collider, /const CAPSULE_ARC_SEGMENTS = 16/);
    }],
    ['HF12 rejected broad-phase experiment remains absent', () => {
        assert.doesNotMatch(character, /queryCollidersInAABB/);
        assert.doesNotMatch(character, /withCollisionRefreshBatch/);
    }]
];

let passed = 0;
for (const [name, check] of checks) {
    try {
        check();
        passed += 1;
        console.log(`PASS ${name}`);
    } catch (error) {
        console.error(`FAIL ${name}`);
        throw error;
    }
}
console.log(JSON.stringify({suite: 'WS-10N8-HF14 Rapier Shape-Aware Collision', passed, total: checks.length}, null, 2));
