#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {EventEmitter} = require('events');
const {
    RUNTIME_PHASE_IDS,
    RUNTIME_PHASE_PRIORITIES,
    createRuntimePhaseScheduler
} = require('../../src/lib/runtime-scheduler');

const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const schedulerSource = read('src/lib/runtime-scheduler/runtime-phase-scheduler.js');
const projectionSource = read('src/lib/scratch-sprite-adapter/scratch-transform-projection-service.js');
const adapterSource = read('src/lib/scratch-sprite-adapter/scratch-sprite-node-adapter-service.js');
const physicsSource = read('src/lib/physics-system/physics2d-runtime-service.js');
const profilerSource = read('src/lib/frame-profiler/frame-time-profiler.js');
const architecture = read('docs/architecture/WS-10N8-HF5-RUNTIME-PHASE-SCHEDULER.md');
const verification = read('docs/validation/WS-10N8-HF5-RUNTIME-PHASE-SCHEDULER-VERIFICATION.md');
const checks = [];
const check = (title, fn) => { fn(); checks.push(title); };

check('Runtime scheduler owns ordered lifecycle/projection/physics phases', () => {
    assert.strictEqual(RUNTIME_PHASE_PRIORITIES.SCRATCH_BINDING_LIFECYCLE < RUNTIME_PHASE_PRIORITIES.SCRATCH_TRANSFORM_PROJECTION, true);
    assert.strictEqual(RUNTIME_PHASE_PRIORITIES.SCRATCH_TRANSFORM_PROJECTION < RUNTIME_PHASE_PRIORITIES.PHYSICS2D, true);
});
check('Scheduler coalesces one-shot work by stable phase id', () => {
    assert.match(schedulerSource, /oneShotTasks\.set\(normalizedId/);
    assert.match(schedulerSource, /coalescedTaskCount/);
});
check('Scheduler frame phases use requestAnimationFrame when available', () => assert.match(schedulerSource, /requestAnimationFrame/));
check('Scratch transform projection no longer subscribes to AFTER_EXECUTE', () => {
    assert.doesNotMatch(projectionSource, /addEmitterListener\(runtime,\s*'AFTER_EXECUTE'/);
    assert.match(projectionSource, /TARGETS_UPDATE/);
    assert.match(projectionSource, /scratch-targets-update-coalesced/);
});
check('Scratch transform projection uses topology and transform shadow caches', () => {
    assert.match(projectionSource, /topologyCache/);
    assert.match(projectionSource, /lastTransform/);
    assert.match(projectionSource, /shadowSkipCount/);
});
check('Scratch binding lifecycle does not synchronously reconcile every transform target update', () => {
    assert.match(adapterSource, /getTargetTopologySignature/);
    assert.match(adapterSource, /topologyNoopSignalCount/);
    assert.match(adapterSource, /SCRATCH_BINDING_LIFECYCLE/);
});
check('Physics no longer subscribes to Scratch AFTER_EXECUTE', () => {
    assert.doesNotMatch(physicsSource, /scratchRuntime\.on\('AFTER_EXECUTE'/);
    assert.match(physicsSource, /registerFramePhase/);
    assert.match(physicsSource, /RUNTIME_PHASE_IDS\.PHYSICS2D/);
});
check('Physics backlog remains bounded and explicitly records dropped catch-up backlog', () => {
    assert.match(physicsSource, /maxCatchUpSteps/);
    assert.match(physicsSource, /droppedBacklogCount/);
});
check('Profiler separates Scratch projection and binding lifecycle from Scratch VM event cycle', () => {
    assert.match(profilerSource, /scratch-projection/);
    assert.match(profilerSource, /scratch-binding-lifecycle/);
    assert.match(profilerSource, /Scratch VM Event Cycle/);
});
check('Scheduler task exceptions are isolated from later phases', () => assert.match(schedulerSource, /taskErrorCount/));
check('HF4 browser burst-stall evidence is recorded', () => assert.match(architecture, /346\.2 ms/));
check('Browser re-test remains mandatory before N8 Freeze', () => assert.match(verification, /BROWSER RE-TEST REQUIRED/));

// Behavioral proof: duplicate lifecycle/projection/physics requests are ordered and coalesced without Scratch events.
check('Behavioral scheduler proof preserves ordering and coalescing', () => {
    const previousWindow = global.window;
    const callbacks = [];
    global.window = {
        cancelAnimationFrame: () => {},
        requestAnimationFrame: callback => {
            callbacks.push(callback);
            return callbacks.length;
        }
    };
    try {
        const scheduler = createRuntimePhaseScheduler(new EventEmitter());
        const order = [];
        scheduler.schedule(RUNTIME_PHASE_IDS.PHYSICS2D, () => order.push('physics-old'), {
            priority: RUNTIME_PHASE_PRIORITIES.PHYSICS2D
        });
        scheduler.schedule(RUNTIME_PHASE_IDS.SCRATCH_TRANSFORM_PROJECTION, () => order.push('projection'), {
            priority: RUNTIME_PHASE_PRIORITIES.SCRATCH_TRANSFORM_PROJECTION
        });
        scheduler.schedule(RUNTIME_PHASE_IDS.SCRATCH_BINDING_LIFECYCLE, () => order.push('lifecycle'), {
            priority: RUNTIME_PHASE_PRIORITIES.SCRATCH_BINDING_LIFECYCLE
        });
        scheduler.schedule(RUNTIME_PHASE_IDS.PHYSICS2D, () => order.push('physics-new'), {
            priority: RUNTIME_PHASE_PRIORITIES.PHYSICS2D
        });
        assert.strictEqual(callbacks.length, 1);
        callbacks.shift()(100);
        assert.deepStrictEqual(order, ['lifecycle', 'projection', 'physics-new']);
        assert.strictEqual(scheduler.getStatus().coalescedTaskCount, 1);
        scheduler.dispose();
    } finally {
        global.window = previousWindow;
    }
});

console.log(`WS-10N8-HF5 Runtime Phase Scheduler Conformance PASS (${checks.length}/${checks.length}).`);
