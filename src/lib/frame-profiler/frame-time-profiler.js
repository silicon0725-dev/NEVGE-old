'use strict';

const FRAME_PROFILER_DIAGNOSTICS_VERSION = 'WS-10N8-HF14.10';
const FRAME_PROFILER_CATEGORY = Object.freeze({
    COLLIDER_AUTHORING_COMMIT: 'collider-authoring-commit',
    COLLIDER_AUTHORING_PREVIEW: 'collider-authoring-preview',
    COLLIDER_AUTHORING_PRESENTATION: 'collider-authoring-presentation',
    COLLIDER_POINTER_LAYOUT: 'collider-pointer-layout',
    COLLIDER_CANVAS: 'collider-canvas',
    COLLIDER_PREPARE: 'collider-prepare',
    COLLIDER_RUNTIME_REFRESH: 'collider-runtime-refresh',
    COLLIDER_SELECTED_PRESENTATION: 'collider-selected-presentation',
    COLLIDER_DYNAMIC_PRESENTATION: 'collider-dynamic-presentation',
    CHARACTER_COLLISION_QUERY: 'character-collision-query',
    PHYSICS: 'physics',
    PHYSICS_DESCRIPTOR_SYNC: 'physics-descriptor-sync',
    PHYSICS_BACKEND_STEP: 'physics-backend-step',
    PHYSICS_WRITEBACK: 'physics-writeback',
    REACT_OVERLAYS: 'react-overlays',
    SCRATCH_BINDING_LIFECYCLE: 'scratch-binding-lifecycle',
    SCRATCH_PROJECTION: 'scratch-projection',
    SCRATCH_TARGET_UI_SYNC: 'scratch-target-ui-sync',
    SCRATCH_TOOLBOX_POSITION_SYNC: 'scratch-toolbox-position-sync',
    SCRATCH_MOUSE_INPUT_LAYOUT: 'scratch-mouse-input-layout',
    SCRATCH_RENDERER: 'scratch-renderer',
    SCRATCH_VM: 'scratch-vm',
    TILEMAP_EDITOR: 'tilemap-editor',
    TILEMAP_RENDER: 'tilemap-render'
});

const FRAME_PROFILER_CATEGORY_LABELS = Object.freeze({
    [FRAME_PROFILER_CATEGORY.COLLIDER_AUTHORING_COMMIT]: 'Collider Authoring Commit',
    [FRAME_PROFILER_CATEGORY.COLLIDER_AUTHORING_PREVIEW]: 'Collider Authoring Preview',
    [FRAME_PROFILER_CATEGORY.COLLIDER_AUTHORING_PRESENTATION]: 'Collider Authoring Presentation',
    [FRAME_PROFILER_CATEGORY.COLLIDER_POINTER_LAYOUT]: 'Collider Pointer / Layout',
    [FRAME_PROFILER_CATEGORY.COLLIDER_CANVAS]: 'Collision Canvas',
    [FRAME_PROFILER_CATEGORY.COLLIDER_PREPARE]: 'Collision Prepare',
    [FRAME_PROFILER_CATEGORY.COLLIDER_RUNTIME_REFRESH]: 'Collider Runtime Refresh',
    [FRAME_PROFILER_CATEGORY.COLLIDER_SELECTED_PRESENTATION]: 'Collider Selected Presentation',
    [FRAME_PROFILER_CATEGORY.COLLIDER_DYNAMIC_PRESENTATION]: 'Collider Dynamic Presentation',
    [FRAME_PROFILER_CATEGORY.CHARACTER_COLLISION_QUERY]: 'Character Collision Query',
    [FRAME_PROFILER_CATEGORY.PHYSICS]: 'Physics2D',
    [FRAME_PROFILER_CATEGORY.PHYSICS_DESCRIPTOR_SYNC]: 'Physics Descriptor Sync',
    [FRAME_PROFILER_CATEGORY.PHYSICS_BACKEND_STEP]: 'Physics Backend Step',
    [FRAME_PROFILER_CATEGORY.PHYSICS_WRITEBACK]: 'Physics Transform Writeback',
    [FRAME_PROFILER_CATEGORY.REACT_OVERLAYS]: 'React Overlays',
    [FRAME_PROFILER_CATEGORY.SCRATCH_BINDING_LIFECYCLE]: 'Scratch Binding Lifecycle',
    [FRAME_PROFILER_CATEGORY.SCRATCH_PROJECTION]: 'Scratch → NGVGE Projection',
    [FRAME_PROFILER_CATEGORY.SCRATCH_TARGET_UI_SYNC]: 'Scratch Target UI Sync',
    [FRAME_PROFILER_CATEGORY.SCRATCH_TOOLBOX_POSITION_SYNC]: 'Scratch Toolbox Position Sync',
    [FRAME_PROFILER_CATEGORY.SCRATCH_MOUSE_INPUT_LAYOUT]: 'Scratch Mouse Input / Layout',
    [FRAME_PROFILER_CATEGORY.SCRATCH_RENDERER]: 'Scratch Renderer',
    [FRAME_PROFILER_CATEGORY.SCRATCH_VM]: 'Scratch VM Event Cycle',
    [FRAME_PROFILER_CATEGORY.TILEMAP_EDITOR]: 'TileMap Editor',
    [FRAME_PROFILER_CATEGORY.TILEMAP_RENDER]: 'TileMap Render'
});

const getCategoryLabel = category => {
    if (FRAME_PROFILER_CATEGORY_LABELS[category]) return FRAME_PROFILER_CATEGORY_LABELS[category];
    if (category.startsWith('runtime-scheduler-one-shot:')) {
        return `Runtime Scheduler One-Shot · ${category.slice('runtime-scheduler-one-shot:'.length)}`;
    }
    if (category.startsWith('runtime-scheduler-frame:')) {
        return `Runtime Scheduler Frame · ${category.slice('runtime-scheduler-frame:'.length)}`;
    }
    return category;
};

const MAX_FRAMES = 240;
const MAX_LONG_ANIMATION_FRAMES = 120;
const MAX_LONG_ANIMATION_FRAME_SCRIPTS = 12;
const DEFAULT_WINDOW = 120;
const LONG_FRAME_MS = 1000 / 60;
const FRAME_PROFILER_STORE_SYMBOL = typeof Symbol === 'function' && typeof Symbol.for === 'function' ?
    Symbol.for('ngvge.frame-time-profiler.stores.v1') : '__ngvgeFrameTimeProfilerStoresV1__';
const globalScope = typeof globalThis !== 'undefined' ? globalThis :
    (typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : null));
const stores = (() => {
    if (!globalScope) return new WeakMap();
    if (!globalScope[FRAME_PROFILER_STORE_SYMBOL]) {
        Object.defineProperty(globalScope, FRAME_PROFILER_STORE_SYMBOL, {
            configurable: true,
            enumerable: false,
            value: new WeakMap(),
            writable: false
        });
    }
    return globalScope[FRAME_PROFILER_STORE_SYMBOL];
})();
const rendererProbeSymbol = Symbol('ngvgeFrameProfilerRendererProbe');

const now = () => {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
    return Date.now();
};

const percentile = (values, ratio) => {
    if (!values.length) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(ratio * sorted.length) - 1));
    return sorted[index];
};

const round = value => Math.round((Number(value) || 0) * 1000) / 1000;

const createStore = runtime => {
    const listeners = new Set();
    const frames = [];
    let enabled = false;
    let revision = 0;
    let rafHandle = null;
    let lastFrameTimestamp = null;
    let currentDurations = Object.create(null);
    let currentCalls = Object.create(null);
    let currentCounters = Object.create(null);
    let renderer = null;
    let rendererOriginalDraw = null;
    let beforeExecuteAt = null;
    let longTaskObserver = null;
    let longAnimationFrameObserver = null;
    const longAnimationFrames = [];
    let longAnimationFrameSupported = false;
    let currentLongTasks = 0;

    const emit = change => {
        revision += 1;
        const event = Object.freeze(Object.assign({revision}, change || {}));
        listeners.forEach(listener => {
            try { listener(event); } catch { /* advisory diagnostics */ }
        });
    };

    const recordDuration = (category, duration, calls = 1) => {
        if (!enabled) return;
        const value = Math.max(0, Number(duration) || 0);
        currentDurations[category] = (currentDurations[category] || 0) + value;
        currentCalls[category] = (currentCalls[category] || 0) + Math.max(0, Number(calls) || 0);
    };

    const count = (name, value = 1) => {
        if (!enabled) return;
        currentCounters[name] = (currentCounters[name] || 0) + (Number(value) || 0);
    };

    const measure = (category, callback) => {
        if (typeof callback !== 'function') return undefined;
        if (!enabled) return callback();
        const started = now();
        try {
            return callback();
        } finally {
            recordDuration(category, now() - started, 1);
        }
    };

    const flushFrame = timestamp => {
        const frameTimestamp = Number(timestamp) || now();
        if (lastFrameTimestamp !== null) {
            const interval = Math.max(0, frameTimestamp - lastFrameTimestamp);
            frames.push(Object.freeze({
                calls: Object.freeze(Object.assign({}, currentCalls)),
                counters: Object.freeze(Object.assign({}, currentCounters)),
                durations: Object.freeze(Object.assign({}, currentDurations)),
                interval,
                longTasks: currentLongTasks,
                timestamp: frameTimestamp
            }));
            if (frames.length > MAX_FRAMES) frames.splice(0, frames.length - MAX_FRAMES);
            if (frames.length === 1 || frames.length % 6 === 0) emit({type: 'frame-profiler-sample'});
        }
        lastFrameTimestamp = frameTimestamp;
        currentDurations = Object.create(null);
        currentCalls = Object.create(null);
        currentCounters = Object.create(null);
        currentLongTasks = 0;
    };

    const scheduleFrameLoop = () => {
        if (!enabled || typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') return;
        rafHandle = window.requestAnimationFrame(timestamp => {
            rafHandle = null;
            flushFrame(timestamp);
            scheduleFrameLoop();
        });
    };

    const installLongTaskObserver = () => {
        if (typeof PerformanceObserver === 'undefined') return;
        try {
            longTaskObserver = new PerformanceObserver(list => {
                if (!enabled) return;
                const entries = list.getEntries();
                currentLongTasks += entries.length;
                entries.forEach(entry => {
                    currentCounters.longTaskMs = (currentCounters.longTaskMs || 0) + (Number(entry.duration) || 0);
                });
            });
            longTaskObserver.observe({entryTypes: ['longtask']});
        } catch {
            longTaskObserver = null;
        }
    };

    const uninstallLongTaskObserver = () => {
        if (longTaskObserver && typeof longTaskObserver.disconnect === 'function') longTaskObserver.disconnect();
        longTaskObserver = null;
    };


    const normalizeLongAnimationFrameScript = script => Object.freeze({
        duration: round(script && script.duration),
        executionStart: round(script && script.executionStart),
        forcedStyleAndLayoutDuration: round(script && script.forcedStyleAndLayoutDuration),
        invoker: script && script.invoker ? String(script.invoker) : '',
        invokerType: script && script.invokerType ? String(script.invokerType) : '',
        pauseDuration: round(script && script.pauseDuration),
        sourceCharPosition: Number.isFinite(Number(script && script.sourceCharPosition)) ?
            Number(script.sourceCharPosition) : 0,
        sourceFunctionName: script && script.sourceFunctionName ? String(script.sourceFunctionName) : '',
        sourceURL: script && script.sourceURL ? String(script.sourceURL) : '',
        startTime: round(script && script.startTime),
        windowAttribution: script && script.windowAttribution ? String(script.windowAttribution) : ''
    });

    const normalizeLongAnimationFrame = entry => {
        const startTime = Math.max(0, Number(entry && entry.startTime) || 0);
        const duration = Math.max(0, Number(entry && entry.duration) || 0);
        const styleAndLayoutStart = Math.max(0, Number(entry && entry.styleAndLayoutStart) || 0);
        const scripts = Array.isArray(entry && entry.scripts) ? entry.scripts.map(normalizeLongAnimationFrameScript) : [];
        scripts.sort((a, b) => b.duration - a.duration || b.forcedStyleAndLayoutDuration - a.forcedStyleAndLayoutDuration);
        return Object.freeze({
            blockingDuration: round(entry && entry.blockingDuration),
            duration: round(duration),
            firstUIEventTimestamp: round(entry && entry.firstUIEventTimestamp),
            renderStart: round(entry && entry.renderStart),
            scripts: Object.freeze(scripts.slice(0, MAX_LONG_ANIMATION_FRAME_SCRIPTS)),
            startTime: round(startTime),
            styleAndLayoutDurationApprox: round(styleAndLayoutStart > 0 ? Math.max(0, (startTime + duration) - styleAndLayoutStart) : 0),
            styleAndLayoutStart: round(styleAndLayoutStart)
        });
    };

    const installLongAnimationFrameObserver = () => {
        longAnimationFrameSupported = false;
        if (typeof PerformanceObserver === 'undefined') return;
        try {
            if (Array.isArray(PerformanceObserver.supportedEntryTypes) &&
                !PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')) return;
            longAnimationFrameObserver = new PerformanceObserver(list => {
                if (!enabled) return;
                list.getEntries().forEach(entry => {
                    longAnimationFrames.push(normalizeLongAnimationFrame(entry));
                });
                if (longAnimationFrames.length > MAX_LONG_ANIMATION_FRAMES) {
                    longAnimationFrames.splice(0, longAnimationFrames.length - MAX_LONG_ANIMATION_FRAMES);
                }
            });
            longAnimationFrameObserver.observe({type: 'long-animation-frame', buffered: false});
            longAnimationFrameSupported = true;
        } catch {
            longAnimationFrameObserver = null;
            longAnimationFrameSupported = false;
        }
    };

    const uninstallLongAnimationFrameObserver = () => {
        if (longAnimationFrameObserver && typeof longAnimationFrameObserver.disconnect === 'function') {
            longAnimationFrameObserver.disconnect();
        }
        longAnimationFrameObserver = null;
    };

    const summarizeLongAnimationFrames = () => {
        const entries = longAnimationFrames.slice();
        const durations = entries.map(entry => entry.duration);
        const blocking = entries.map(entry => entry.blockingDuration);
        const styleLayout = entries.map(entry => entry.styleAndLayoutDurationApprox);
        const scripts = new Map();
        let totalForcedStyleAndLayoutMs = 0;
        let totalScriptMs = 0;
        entries.forEach(entry => entry.scripts.forEach(script => {
            totalScriptMs += script.duration;
            totalForcedStyleAndLayoutMs += script.forcedStyleAndLayoutDuration;
            const key = [script.sourceURL, script.sourceFunctionName, script.invoker, script.invokerType].join('|');
            const aggregate = scripts.get(key) || {
                count: 0,
                forcedStyleAndLayoutMs: 0,
                invoker: script.invoker,
                invokerType: script.invokerType,
                maxDurationMs: 0,
                sourceFunctionName: script.sourceFunctionName,
                sourceURL: script.sourceURL,
                totalDurationMs: 0
            };
            aggregate.count += 1;
            aggregate.totalDurationMs += script.duration;
            aggregate.maxDurationMs = Math.max(aggregate.maxDurationMs, script.duration);
            aggregate.forcedStyleAndLayoutMs += script.forcedStyleAndLayoutDuration;
            scripts.set(key, aggregate);
        }));
        const topScripts = Array.from(scripts.values()).map(script => Object.freeze({
            count: script.count,
            forcedStyleAndLayoutMs: round(script.forcedStyleAndLayoutMs),
            invoker: script.invoker,
            invokerType: script.invokerType,
            maxDurationMs: round(script.maxDurationMs),
            sourceFunctionName: script.sourceFunctionName,
            sourceURL: script.sourceURL,
            totalDurationMs: round(script.totalDurationMs)
        })).sort((a, b) => b.totalDurationMs - a.totalDurationMs ||
            b.forcedStyleAndLayoutMs - a.forcedStyleAndLayoutMs).slice(0, 12);
        const topFrames = entries.slice().sort((a, b) => b.duration - a.duration).slice(0, 8);
        const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
        return Object.freeze({
            averageBlockingMs: round(average(blocking)),
            averageLoafMs: round(average(durations)),
            averageStyleAndLayoutMsApprox: round(average(styleLayout)),
            longAnimationFrameCount: entries.length,
            loafSupported: longAnimationFrameSupported,
            maxLoafMs: round(durations.length ? Math.max(...durations) : 0),
            p95LoafMs: round(percentile(durations, 0.95)),
            topFrames: Object.freeze(topFrames),
            topScripts: Object.freeze(topScripts),
            totalForcedStyleAndLayoutMs: round(totalForcedStyleAndLayoutMs),
            totalScriptMs: round(totalScriptMs)
        });
    };

    const restoreRenderer = () => {
        if (!renderer || !rendererOriginalDraw) return;
        if (renderer.draw && renderer.draw[rendererProbeSymbol]) renderer.draw = rendererOriginalDraw;
        rendererOriginalDraw = null;
    };

    const installRenderer = () => {
        if (!renderer || typeof renderer.draw !== 'function' || rendererOriginalDraw) return;
        const original = renderer.draw;
        const wrapped = function (...args) {
            if (!enabled) return original.apply(this, args);
            return measure(FRAME_PROFILER_CATEGORY.SCRATCH_RENDERER, () => original.apply(this, args));
        };
        Object.defineProperty(wrapped, rendererProbeSymbol, {value: true});
        rendererOriginalDraw = original;
        renderer.draw = wrapped;
    };

    const installRuntimeProbe = () => {
        if (!runtime || typeof runtime.on !== 'function') return;
        runtime.on('BEFORE_EXECUTE', onBeforeExecute);
        runtime.on('AFTER_EXECUTE', onAfterExecute);
    };
    const uninstallRuntimeProbe = () => {
        if (!runtime || typeof runtime.removeListener !== 'function') return;
        runtime.removeListener('BEFORE_EXECUTE', onBeforeExecute);
        runtime.removeListener('AFTER_EXECUTE', onAfterExecute);
        beforeExecuteAt = null;
    };

    const start = () => {
        if (enabled) return false;
        enabled = true;
        frames.length = 0;
        lastFrameTimestamp = null;
        currentDurations = Object.create(null);
        currentCalls = Object.create(null);
        currentCounters = Object.create(null);
        currentLongTasks = 0;
        longAnimationFrames.length = 0;
        installRenderer();
        installRuntimeProbe();
        installLongTaskObserver();
        installLongAnimationFrameObserver();
        scheduleFrameLoop();
        emit({type: 'frame-profiler-start'});
        return true;
    };

    const stop = () => {
        if (!enabled) return false;
        enabled = false;
        if (rafHandle !== null && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
            window.cancelAnimationFrame(rafHandle);
        }
        rafHandle = null;
        uninstallLongTaskObserver();
        uninstallLongAnimationFrameObserver();
        uninstallRuntimeProbe();
        restoreRenderer();
        emit({type: 'frame-profiler-stop'});
        return true;
    };

    const reset = () => {
        frames.length = 0;
        lastFrameTimestamp = null;
        currentDurations = Object.create(null);
        currentCalls = Object.create(null);
        currentCounters = Object.create(null);
        currentLongTasks = 0;
        longAnimationFrames.length = 0;
        emit({type: 'frame-profiler-reset'});
    };

    const getSnapshot = (windowSize = DEFAULT_WINDOW) => {
        const source = frames.slice(-Math.max(1, Math.trunc(Number(windowSize) || DEFAULT_WINDOW)));
        const intervals = source.map(frame => frame.interval).filter(Number.isFinite);
        const averageInterval = intervals.length ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length : 0;
        const categoryKeys = new Set(Object.values(FRAME_PROFILER_CATEGORY));
        source.forEach(frame => Object.keys(frame.durations).forEach(key => categoryKeys.add(key)));
        const categories = Array.from(categoryKeys).map(category => {
            const durations = source.map(frame => frame.durations[category] || 0);
            const calls = source.map(frame => frame.calls[category] || 0);
            const total = durations.reduce((sum, value) => sum + value, 0);
            return Object.freeze({
                averageCallsPerFrame: round(calls.reduce((sum, value) => sum + value, 0) / Math.max(1, source.length)),
                averageMs: round(total / Math.max(1, source.length)),
                category,
                label: getCategoryLabel(category),
                maxMs: round(durations.length ? Math.max(...durations) : 0),
                p50Ms: round(percentile(durations, 0.5)),
                p95Ms: round(percentile(durations, 0.95)),
                p99Ms: round(percentile(durations, 0.99)),
                totalMs: round(total)
            });
        }).sort((a, b) => b.p95Ms - a.p95Ms || b.averageMs - a.averageMs);
        const longFrames = intervals.filter(value => value > LONG_FRAME_MS).length;
        const counters = Object.create(null);
        source.forEach(frame => Object.keys(frame.counters).forEach(key => {
            counters[key] = (counters[key] || 0) + frame.counters[key];
        }));
        Object.keys(counters).forEach(key => { counters[key] = round(counters[key] / Math.max(1, source.length)); });
        const knownAverage = categories.reduce((sum, item) => sum + item.averageMs, 0);
        return Object.freeze({
            averageFps: round(averageInterval > 0 ? 1000 / averageInterval : 0),
            browserMainThread: summarizeLongAnimationFrames(),
            averageFrameMs: round(averageInterval),
            categories: Object.freeze(categories),
            counters: Object.freeze(counters),
            diagnosticsVersion: FRAME_PROFILER_DIAGNOSTICS_VERSION,
            enabled,
            frameCount: source.length,
            frameP50Ms: round(percentile(intervals, 0.5)),
            frameP95Ms: round(percentile(intervals, 0.95)),
            frameP99Ms: round(percentile(intervals, 0.99)),
            longFramePercent: round(source.length ? (longFrames / source.length) * 100 : 0),
            longTaskCount: source.reduce((sum, frame) => sum + frame.longTasks, 0),
            revision,
            topOffender: categories.length ? categories[0] : null,
            trackedAverageMs: round(knownAverage),
            untrackedAverageMs: round(Math.max(0, averageInterval - knownAverage))
        });
    };

    const onBeforeExecute = () => {
        if (enabled) beforeExecuteAt = now();
    };
    const onAfterExecute = () => {
        if (!enabled || beforeExecuteAt === null) return;
        recordDuration(FRAME_PROFILER_CATEGORY.SCRATCH_VM, now() - beforeExecuteAt, 1);
        beforeExecuteAt = null;
    };
    return Object.freeze({
        attachRenderer: nextRenderer => {
            if (renderer === nextRenderer) return;
            restoreRenderer();
            renderer = nextRenderer || null;
            if (enabled) installRenderer();
        },
        count,
        getSnapshot,
        isEnabled: () => enabled,
        measure,
        recordDuration,
        reset,
        start,
        stop,
        subscribe: listener => {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    });
};

const getFrameTimeProfiler = runtime => {
    if (!runtime || (typeof runtime !== 'object' && typeof runtime !== 'function')) {
        throw new TypeError('Frame-time profiler requires a runtime object.');
    }
    if (!stores.has(runtime)) stores.set(runtime, createStore(runtime));
    return stores.get(runtime);
};

module.exports = {
    FRAME_PROFILER_CATEGORY,
    FRAME_PROFILER_CATEGORY_LABELS,
    getFrameTimeProfiler
};
