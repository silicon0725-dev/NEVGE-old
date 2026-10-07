#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const collider = read('src/lib/collision-system/collider2d-runtime-service.js');
const profiler = read('src/lib/frame-profiler/frame-time-profiler.js');
const scheduler = read('src/lib/runtime-scheduler/runtime-phase-scheduler.js');
const moduleDefinition = read('src/lib/scene-system/module-definition.js');
const colliderUnit = read('test/unit/lib/collision-system/collider2d-runtime-service.test.js');
const schedulerUnit = read('test/unit/lib/runtime-scheduler/runtime-phase-scheduler.test.js');

const checks = [
    ['HF14.2 profiler generation is explicit', () => {
        assert.match(profiler, /FRAME_PROFILER_DIAGNOSTICS_VERSION = 'WS-10N8-HF14\.(?:2|3|4|5|6|7|8|9|10)'/);
    }],
    ['Collider Runtime receives the same Scratch runtime profiler authority as Physics2D', () => {
        assert.match(moduleDefinition, /createCollider2DRuntimeService\(\{[\s\S]*scratchRuntime:\s*vm && vm\.runtime/);
        assert.match(collider, /getFrameTimeProfiler\(scratchRuntime\)/);
    }],
    ['Collider Runtime Refresh has an explicit profiler category', () => {
        assert.match(profiler, /COLLIDER_RUNTIME_REFRESH:\s*'collider-runtime-refresh'/);
        assert.match(collider, /FRAME_PROFILER_CATEGORY\.COLLIDER_RUNTIME_REFRESH/);
    }],
    ['solid-only refresh checks lightweight sensor status before building native geometry', () => {
        const statusIndex = collider.indexOf('const nativeStatus = getNativeColliderStatus()');
        const listIndex = collider.indexOf('const nativeColliders = listNativeColliders()', statusIndex);
        assert.ok(statusIndex >= 0 && listIndex > statusIndex);
    }],
    ['solid-only refresh skips geometry only when native/external/remembered Areas are absent', () => {
        assert.match(collider, /nativeStatus\.areaCount === 0 && !mustInspectExternalSensors && areaOverlapState\.size === 0/);
        assert.match(collider, /colliderSolidOnlyRefreshSkips/);
    }],
    ['Area semantic path remains present after the fast-path guard', () => {
        assert.match(collider, /computeAreaOverlaps\(area, colliders\)/);
        assert.match(collider, /type:\s*'area:enter'/);
        assert.match(collider, /type:\s*'area:exit'/);
    }],
    ['runtime scheduler source carries an independent instrumentation version', () => {
        assert.match(scheduler, /RUNTIME_PHASE_SCHEDULER_DIAGNOSTICS_VERSION = 'WS-10N8-HF14\.2-scheduler-2'/);
        assert.match(scheduler, /diagnosticsVersion:\s*RUNTIME_PHASE_SCHEDULER_DIAGNOSTICS_VERSION/);
    }],
    ['scheduler emits positive proof counters from the actual rAF callback', () => {
        assert.match(scheduler, /runtimeSchedulerInstrumentationV2/);
        assert.match(scheduler, /runtimeSchedulerTickMs/);
        assert.match(scheduler, /runtimeSchedulerPendingOneShotTasks/);
        assert.match(scheduler, /runtimeSchedulerRegisteredFrameTasks/);
    }],
    ['scheduler semantic per-task attribution remains enabled', () => {
        assert.match(scheduler, /runtime-scheduler-\$\{kind\}:\$\{task\.id\}/);
        assert.match(scheduler, /frameProfiler\.measure\(category, run\)/);
    }],
    ['unit contract proves solid-only refresh avoids Transform geometry projection', () => {
        assert.match(colliderUnit, /solid-only refresh fast path without rebuilding Circle\/Capsule world geometry/);
        assert.match(colliderUnit, /getRuntimeTransform\)\.not\.toHaveBeenCalled/);
    }],
    ['unit contract proves scheduler V2 counters and source version', () => {
        assert.match(schedulerUnit, /runtimeSchedulerInstrumentationV2/);
        assert.match(schedulerUnit, /RUNTIME_PHASE_SCHEDULER_DIAGNOSTICS_VERSION/);
    }],
    ['Circle/Capsule tessellation is not reduced by this hotfix', () => {
        assert.match(collider, /const CIRCLE_SEGMENTS = 32/);
        assert.match(collider, /const CAPSULE_ARC_SEGMENTS = 16/);
    }]
];

let passed = 0;
for (const [name, check] of checks) {
    check();
    passed += 1;
    console.log(`PASS ${name}`);
}
console.log(JSON.stringify({suite: 'WS-10N8-HF14.2 Solid-Only Refresh + Scheduler Attribution Integrity', passed, total: checks.length}, null, 2));
