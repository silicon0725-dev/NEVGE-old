'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const assertPhysicsSchedulerBacklogContainmentContract = () => {
    const physics = read('src/lib/physics-system/physics2d-runtime-service.js');
    const profiler = read('src/lib/frame-profiler/frame-time-profiler.js');
    assert.match(physics, /PHYSICS2D_SCHEDULER_TIME_BUDGET_MS = 12/);
    assert.match(physics, /advance\(delta, \{timeBudgetMs: PHYSICS2D_SCHEDULER_TIME_BUDGET_MS\}\)/);
    assert.match(physics, /accumulator %= settings\.fixedDeltaSeconds/);
    assert.match(physics, /physicsSchedulerBudgetExhaustions/);
    assert.match(profiler, /Symbol\.for\('ngvge\.frame-time-profiler\.stores\.v1'\)/);
    assert.match(profiler, /PHYSICS_BACKEND_STEP:\s*'physics-backend-step'/);
    return 'Physics scheduler catch-up is CPU-budgeted while fixed-step semantics and shared profiler attribution remain intact';
};

module.exports = {assertPhysicsSchedulerBacklogContainmentContract};
