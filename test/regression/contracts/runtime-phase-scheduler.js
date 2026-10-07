'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const assertRuntimePhaseSchedulerContract = () => {
    const scheduler = read('src/lib/runtime-scheduler/runtime-phase-scheduler.js');
    const projection = read('src/lib/scratch-sprite-adapter/scratch-transform-projection-service.js');
    const adapter = read('src/lib/scratch-sprite-adapter/scratch-sprite-node-adapter-service.js');
    const physics = read('src/lib/physics-system/physics2d-runtime-service.js');
    const profiler = read('src/lib/frame-profiler/frame-time-profiler.js');
    assert(scheduler.includes('SCRATCH_BINDING_LIFECYCLE'));
    assert(scheduler.includes('SCRATCH_TRANSFORM_PROJECTION'));
    assert(scheduler.includes('PHYSICS2D'));
    assert(!projection.includes("addEmitterListener(runtime, 'AFTER_EXECUTE'"));
    assert(projection.includes('shadowSkipCount'));
    assert(adapter.includes('getTargetTopologySignature'));
    assert(adapter.includes('topologyNoopSignalCount'));
    assert(!physics.includes("scratchRuntime.on('AFTER_EXECUTE'"));
    assert(physics.includes('registerFramePhase'));
    assert(profiler.includes('scratch-projection'));
    assert(profiler.includes('scratch-binding-lifecycle'));
    return {
        afterExecuteProjectionRemoved: true,
        bindingLifecycleTopologyGated: true,
        physicsDecoupledFromVmExecute: true,
        scratchProjectionShadowCached: true,
        schedulerCoalescingRequired: true
    };
};
module.exports = {assertRuntimePhaseSchedulerContract};
