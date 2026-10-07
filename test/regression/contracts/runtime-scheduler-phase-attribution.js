'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const assertRuntimeSchedulerPhaseAttributionContract = () => {
    const scheduler = read('src/lib/runtime-scheduler/runtime-phase-scheduler.js');
    const profiler = read('src/lib/frame-profiler/frame-time-profiler.js');
    const character = read('src/lib/character-controller-system/character-controller2d-runtime-service.js');
    assert.match(scheduler, /runtime-scheduler-\$\{kind\}:\$\{task\.id\}/);
    assert.match(scheduler, /runtimeSchedulerTicks/);
    assert.match(profiler, /Runtime Scheduler One-Shot/);
    assert.match(profiler, /Runtime Scheduler Frame/);
    assert.doesNotMatch(character, /queryCollidersInAABB/);
    return {contract: 'runtime-scheduler-phase-attribution', status: 'PASS'};
};

module.exports = {assertRuntimeSchedulerPhaseAttributionContract};
