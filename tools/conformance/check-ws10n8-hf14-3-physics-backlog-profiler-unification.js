#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const profiler = read('src/lib/frame-profiler/frame-time-profiler.js');
const physics = read('src/lib/physics-system/physics2d-runtime-service.js');
const physicsUnit = read('test/unit/lib/physics-system/physics2d-runtime-service.test.js');
const profilerUnit = read('test/unit/lib/frame-profiler/frame-time-profiler.test.js');

const checks = [
    ['HF14.3 profiler generation is explicit', () => {
        assert.match(profiler, /FRAME_PROFILER_DIAGNOSTICS_VERSION = 'WS-10N8-HF14\.(?:3|4|5|6|7|8|9|10)'/);
    }],
    ['profiler runtime stores are shared through a global Symbol registry', () => {
        assert.match(profiler, /Symbol\.for\('ngvge\.frame-time-profiler\.stores\.v1'\)/);
        assert.match(profiler, /globalScope\[FRAME_PROFILER_STORE_SYMBOL\]/);
    }],
    ['Physics2D has explicit descriptor sync, backend step, and writeback attribution', () => {
        assert.match(profiler, /PHYSICS_DESCRIPTOR_SYNC:\s*'physics-descriptor-sync'/);
        assert.match(profiler, /PHYSICS_BACKEND_STEP:\s*'physics-backend-step'/);
        assert.match(profiler, /PHYSICS_WRITEBACK:\s*'physics-writeback'/);
        assert.match(physics, /FRAME_PROFILER_CATEGORY\.PHYSICS_DESCRIPTOR_SYNC/);
        assert.match(physics, /FRAME_PROFILER_CATEGORY\.PHYSICS_BACKEND_STEP/);
        assert.match(physics, /FRAME_PROFILER_CATEGORY\.PHYSICS_WRITEBACK/);
    }],
    ['scheduler execution uses a bounded Physics CPU time budget', () => {
        assert.match(physics, /PHYSICS2D_SCHEDULER_TIME_BUDGET_MS = 12/);
        assert.match(physics, /advance\(delta, \{timeBudgetMs: PHYSICS2D_SCHEDULER_TIME_BUDGET_MS\}\)/);
    }],
    ['manual advance remains unbudgeted unless an execution option explicitly supplies one', () => {
        assert.match(physics, /const advance = \(deltaSecondsValue, executionOptions = \{\}\)/);
        assert.match(physics, /timeBudgetMs = Number\.isFinite\(requestedBudgetMs\).*\? requestedBudgetMs : null/);
    }],
    ['budget exhaustion drops only accumulated catch-up backlog', () => {
        assert.match(physics, /accumulator %= settings\.fixedDeltaSeconds/);
        assert.match(physics, /droppedBacklogStepCount \+= droppedSteps/);
        assert.match(physics, /schedulerBudgetExhaustionCount \+= 1/);
    }],
    ['profiler exposes fixed-step and backlog containment counters', () => {
        assert.match(physics, /physicsFixedSteps/);
        assert.match(physics, /physicsBacklogDrops/);
        assert.match(physics, /physicsDroppedBacklogSteps/);
        assert.match(physics, /physicsSchedulerBudgetExhaustions/);
    }],
    ['unit contract proves budget containment after the first fixed step', () => {
        assert.match(physicsUnit, /bounds scheduler catch-up work by a CPU time budget/);
        assert.match(physicsUnit, /expect\(steps\)\.toBe\(1\)/);
    }],
    ['unit contract proves isolated profiler modules share one runtime store', () => {
        assert.match(profilerUnit, /shares profiler stores across isolated module instances/);
        assert.match(profilerUnit, /expect\(second\)\.toBe\(first\)/);
    }]
];

let passed = 0;
for (const [name, check] of checks) {
    check();
    passed += 1;
    console.log(`PASS ${name}`);
}
console.log(JSON.stringify({suite: 'WS-10N8-HF14.3 Physics Backlog + Profiler Store Unification', passed, total: checks.length}, null, 2));
