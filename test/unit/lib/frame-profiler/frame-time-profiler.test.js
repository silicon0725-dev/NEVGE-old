'use strict';

const EventEmitter = require('events');
const {
    FRAME_PROFILER_CATEGORY,
    getFrameTimeProfiler
} = require('../../../../src/lib/frame-profiler');

describe('WS-10N8-HF4 frame-time profiler', () => {
    let originalWindow;
    let originalPerformanceObserver;
    let callbacks;

    beforeEach(() => {
        originalWindow = global.window;
        originalPerformanceObserver = global.PerformanceObserver;
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
        global.PerformanceObserver = originalPerformanceObserver;
    });

    test('is disabled by default and records deterministic frame statistics only while enabled', () => {
        const runtime = new EventEmitter();
        const profiler = getFrameTimeProfiler(runtime);
        expect(profiler.isEnabled()).toBe(false);
        profiler.recordDuration(FRAME_PROFILER_CATEGORY.PHYSICS, 9, 1);
        expect(profiler.getSnapshot().frameCount).toBe(0);

        profiler.start();
        expect(profiler.isEnabled()).toBe(true);
        expect(callbacks).toHaveLength(1);
        callbacks.shift()(100);
        profiler.recordDuration(FRAME_PROFILER_CATEGORY.PHYSICS, 4, 2);
        profiler.count('debugColliders', 120);
        callbacks.shift()(120);

        const snapshot = profiler.getSnapshot();
        expect(snapshot.frameCount).toBe(1);
        expect(snapshot.averageFrameMs).toBe(20);
        expect(snapshot.averageFps).toBe(50);
        expect(snapshot.counters.debugColliders).toBe(120);
        const physics = snapshot.categories.find(item => item.category === FRAME_PROFILER_CATEGORY.PHYSICS);
        expect(physics.averageMs).toBe(4);
        expect(physics.averageCallsPerFrame).toBe(2);
        profiler.stop();
        expect(profiler.isEnabled()).toBe(false);
    });

    test('shares profiler stores across isolated module instances for one runtime', () => {
        const runtime = new EventEmitter();
        const first = getFrameTimeProfiler(runtime);
        let second = null;
        jest.isolateModules(() => {
            second = require('../../../../src/lib/frame-profiler').getFrameTimeProfiler(runtime);
        });
        expect(second).toBe(first);
    });

    test('wraps Scratch renderer and VM execute only during an active capture and restores draw on stop', () => {
        const runtime = new EventEmitter();
        const draw = jest.fn(() => 'drawn');
        const renderer = {draw};
        const profiler = getFrameTimeProfiler(runtime);
        profiler.attachRenderer(renderer);
        expect(renderer.draw).toBe(draw);

        profiler.start();
        expect(renderer.draw).not.toBe(draw);
        callbacks.shift()(100);
        expect(renderer.draw()).toBe('drawn');
        runtime.emit('BEFORE_EXECUTE');
        runtime.emit('AFTER_EXECUTE');
        callbacks.shift()(116.7);
        const snapshot = profiler.getSnapshot();
        expect(snapshot.categories.find(item => item.category === FRAME_PROFILER_CATEGORY.SCRATCH_RENDERER).averageCallsPerFrame).toBe(1);
        expect(snapshot.categories.find(item => item.category === FRAME_PROFILER_CATEGORY.SCRATCH_VM).averageCallsPerFrame).toBe(1);

        profiler.stop();
        expect(renderer.draw).toBe(draw);
        expect(runtime.listenerCount('BEFORE_EXECUTE')).toBe(0);
        expect(runtime.listenerCount('AFTER_EXECUTE')).toBe(0);
    });

    test('captures Long Animation Frame script and forced-layout attribution when supported', () => {
        const observers = [];
        class MockPerformanceObserver {
            constructor (callback) {
                this.callback = callback;
                this.observe = jest.fn(options => { this.options = options; });
                this.disconnect = jest.fn();
                observers.push(this);
            }
        }
        MockPerformanceObserver.supportedEntryTypes = ['longtask', 'long-animation-frame'];
        global.PerformanceObserver = MockPerformanceObserver;

        const runtime = new EventEmitter();
        const profiler = getFrameTimeProfiler(runtime);
        profiler.start();
        expect(observers).toHaveLength(2);
        const loafObserver = observers.find(observer => observer.options && observer.options.type === 'long-animation-frame');
        expect(loafObserver).toBeTruthy();
        loafObserver.callback({
            getEntries: () => [{
                blockingDuration: 42,
                duration: 120,
                firstUIEventTimestamp: 1005,
                renderStart: 1080,
                scripts: [{
                    duration: 70,
                    executionStart: 1010,
                    forcedStyleAndLayoutDuration: 31,
                    invoker: 'SVG.onpointermove',
                    invokerType: 'event-listener',
                    pauseDuration: 0,
                    sourceCharPosition: 456,
                    sourceFunctionName: 'updateHandleDrag',
                    sourceURL: 'http://127.0.0.1:8602/js/gui.js',
                    startTime: 1008,
                    windowAttribution: 'self'
                }],
                startTime: 1000,
                styleAndLayoutStart: 1090
            }]
        });
        const attribution = profiler.getSnapshot().browserMainThread;
        expect(attribution.loafSupported).toBe(true);
        expect(attribution.longAnimationFrameCount).toBe(1);
        expect(attribution.maxLoafMs).toBe(120);
        expect(attribution.totalForcedStyleAndLayoutMs).toBe(31);
        expect(attribution.topScripts[0]).toEqual(expect.objectContaining({
            forcedStyleAndLayoutMs: 31,
            invoker: 'SVG.onpointermove',
            sourceFunctionName: 'updateHandleDrag',
            totalDurationMs: 70
        }));
        expect(attribution.topFrames[0].styleAndLayoutDurationApprox).toBe(30);
        profiler.stop();
        expect(loafObserver.disconnect).toHaveBeenCalled();
    });

});
