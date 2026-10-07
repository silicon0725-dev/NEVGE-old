'use strict';

const {EventEmitter} = require('events');
const {getFrameTimeProfiler} = require('../../../../src/lib/frame-profiler');
const {
    RUNTIME_PHASE_IDS,
    RUNTIME_PHASE_PRIORITIES,
    RUNTIME_PHASE_SCHEDULER_DIAGNOSTICS_VERSION,
    createRuntimePhaseScheduler
} = require('../../../../src/lib/runtime-scheduler');

describe('WS-10N8-HF5 runtime phase scheduler', () => {
    let originalWindow;
    let callbacks;

    beforeEach(() => {
        originalWindow = global.window;
        callbacks = [];
        global.window = {
            cancelAnimationFrame: jest.fn(),
            requestAnimationFrame: jest.fn(callback => {
                callbacks.push(callback);
                return callbacks.length;
            })
        };
    });

    afterEach(() => {
        global.window = originalWindow;
    });

    test('coalesces same-id one-shot work and preserves semantic phase priority', () => {
        const scheduler = createRuntimePhaseScheduler(new EventEmitter());
        const order = [];
        scheduler.schedule(RUNTIME_PHASE_IDS.PHYSICS2D, () => order.push('physics-old'), {
            priority: RUNTIME_PHASE_PRIORITIES.PHYSICS2D
        });
        scheduler.schedule(RUNTIME_PHASE_IDS.SCRATCH_TRANSFORM_PROJECTION, () => order.push('projection'), {
            priority: RUNTIME_PHASE_PRIORITIES.SCRATCH_TRANSFORM_PROJECTION
        });
        scheduler.schedule(RUNTIME_PHASE_IDS.PHYSICS2D, () => order.push('physics-new'), {
            priority: RUNTIME_PHASE_PRIORITIES.PHYSICS2D
        });
        expect(callbacks).toHaveLength(1);
        callbacks.shift()(100);
        expect(order).toEqual(['projection', 'physics-new']);
        expect(scheduler.getStatus()).toMatchObject({coalescedTaskCount: 1, executedTaskCount: 2});
        scheduler.dispose();
    });

    test('attributes scheduler task cost by semantic phase while the frame profiler is active', () => {
        const runtime = new EventEmitter();
        const profiler = getFrameTimeProfiler(runtime);
        const scheduler = createRuntimePhaseScheduler(runtime);
        profiler.start();
        scheduler.schedule(RUNTIME_PHASE_IDS.SCRATCH_BINDING_LIFECYCLE, () => {}, {
            priority: RUNTIME_PHASE_PRIORITIES.SCRATCH_BINDING_LIFECYCLE
        });

        callbacks.shift()(100);
        callbacks.shift()(105);
        callbacks.shift()(120);

        const snapshot = profiler.getSnapshot();
        const phase = snapshot.categories.find(item => (
            item.category === 'runtime-scheduler-one-shot:scratch-binding-lifecycle'
        ));
        expect(phase).toBeTruthy();
        expect(phase.label).toBe('Runtime Scheduler One-Shot · scratch-binding-lifecycle');
        expect(phase.averageCallsPerFrame).toBe(1);
        expect(snapshot.counters.runtimeSchedulerTasks).toBe(1);
        expect(snapshot.counters.runtimeSchedulerOneShotTasks).toBe(1);
        expect(snapshot.counters.runtimeSchedulerInstrumentationV2).toBe(1);
        expect(snapshot.counters.runtimeSchedulerTickMs).toBeGreaterThanOrEqual(0);
        expect(scheduler.getStatus().diagnosticsVersion).toBe(RUNTIME_PHASE_SCHEDULER_DIAGNOSTICS_VERSION);
        profiler.stop();
        scheduler.dispose();
    });

    test('runs registered frame phases independently of Scratch VM execute events', () => {
        const runtime = new EventEmitter();
        const scheduler = createRuntimePhaseScheduler(runtime);
        const frames = [];
        const unregister = scheduler.registerFramePhase(RUNTIME_PHASE_IDS.PHYSICS2D, frame => frames.push(frame), {
            priority: RUNTIME_PHASE_PRIORITIES.PHYSICS2D
        });
        expect(runtime.listenerCount('AFTER_EXECUTE')).toBe(0);
        callbacks.shift()(100);
        callbacks.shift()(116.7);
        expect(frames).toHaveLength(2);
        expect(frames[1].deltaSeconds).toBeCloseTo(0.0167, 4);
        unregister();
        scheduler.dispose();
    });
});
