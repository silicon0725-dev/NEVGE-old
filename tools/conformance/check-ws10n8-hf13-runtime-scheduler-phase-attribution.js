#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const scheduler = read('src/lib/runtime-scheduler/runtime-phase-scheduler.js');
const profiler = read('src/lib/frame-profiler/frame-time-profiler.js');
const character = read('src/lib/character-controller-system/character-controller2d-runtime-service.js');
const collider = read('src/lib/collision-system/collider2d-runtime-service.js');

const checks = [
    ['scheduler obtains the existing frame profiler', () => assert.match(scheduler, /getFrameTimeProfiler\(runtime\)/)],
    ['one-shot scheduler tasks receive phase attribution', () => assert.match(scheduler, /runtime-scheduler-\$\{kind\}:\$\{task\.id\}/)],
    ['scheduler ticks are counted', () => assert.match(scheduler, /runtimeSchedulerTicks/)],
    ['one-shot and frame tasks are counted separately', () => {
        assert.match(scheduler, /runtimeScheduler\$\{kind === 'frame' \? 'Frame' : 'OneShot'\}Tasks/);
    }],
    ['dynamic scheduler categories receive readable labels', () => {
        assert.match(profiler, /Runtime Scheduler One-Shot/);
        assert.match(profiler, /Runtime Scheduler Frame/);
    }],
    ['HF12 CharacterController broad-phase experiment is rolled back', () => {
        assert.doesNotMatch(character, /queryCollidersInAABB/);
        assert.doesNotMatch(character, /withCollisionRefreshBatch/);
    }],
    ['HF12 Collider global refresh shortcut is rolled back', () => {
        assert.doesNotMatch(collider, /Solid-only scenes do not need global overlap reconstruction/);
        assert.doesNotMatch(collider, /queryCollidersInAABB,/);
    }],
    ['HF11 continuous collision implementation remains present', () => {
        assert.match(character, /sweepConvexPolygons/);
        assert.match(character, /convexPolygonPenetration/);
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
console.log(JSON.stringify({suite: 'WS-10N8-HF13 Runtime Scheduler Phase Attribution', passed, total: checks.length}, null, 2));
