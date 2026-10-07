'use strict';

const {getFrameTimeProfiler} = require('../frame-profiler');

const RUNTIME_PHASE_IDS = Object.freeze({
    SCRATCH_BINDING_LIFECYCLE: 'scratch-binding-lifecycle',
    SCRATCH_TRANSFORM_PROJECTION: 'scratch-transform-projection',
    PHYSICS2D: 'physics2d'
});

const RUNTIME_PHASE_PRIORITIES = Object.freeze({
    SCRATCH_BINDING_LIFECYCLE: 50,
    SCRATCH_TRANSFORM_PROJECTION: 100,
    PHYSICS2D: 200
});

const RUNTIME_PHASE_SCHEDULER_DIAGNOSTICS_VERSION = 'WS-10N8-HF14.2-scheduler-2';

const stores = new WeakMap();

const now = () => {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
    return Date.now();
};

const createRuntimePhaseScheduler = runtime => {
    const frameProfiler = getFrameTimeProfiler(runtime);
    const oneShotTasks = new Map();
    const frameTasks = new Map();
    let disposed = false;
    let scheduled = false;
    let animationFrameHandle = null;
    let timeoutHandle = null;
    let lastTimestamp = null;
    let frameId = 0;
    let executedTaskCount = 0;
    let coalescedTaskCount = 0;
    let taskErrorCount = 0;

    const cancelScheduledTick = () => {
        if (animationFrameHandle !== null && typeof window !== 'undefined' &&
            typeof window.cancelAnimationFrame === 'function') {
            window.cancelAnimationFrame(animationFrameHandle);
        }
        if (timeoutHandle !== null) clearTimeout(timeoutHandle);
        animationFrameHandle = null;
        timeoutHandle = null;
        scheduled = false;
    };

    const sortedTasks = map => Array.from(map.values()).sort((a, b) => (
        a.priority - b.priority || a.id.localeCompare(b.id)
    ));

    const runTick = timestamp => {
        if (disposed) return;
        const tickStartedAt = now();
        scheduled = false;
        animationFrameHandle = null;
        timeoutHandle = null;
        const resolvedTimestamp = Number.isFinite(Number(timestamp)) ? Number(timestamp) : now();
        const deltaSeconds = lastTimestamp === null ? 0 : Math.max(0, (resolvedTimestamp - lastTimestamp) / 1000);
        lastTimestamp = resolvedTimestamp;
        frameId += 1;

        const pending = sortedTasks(oneShotTasks);
        oneShotTasks.clear();
        const frame = Object.freeze({deltaSeconds, frameId, timestamp: resolvedTimestamp});
        const runTask = (task, kind) => {
            if (disposed) return;
            executedTaskCount += 1;
            const run = () => task.callback(frame);
            const category = `runtime-scheduler-${kind}:${task.id}`;
            if (frameProfiler && frameProfiler.isEnabled()) {
                frameProfiler.count('runtimeSchedulerTasks', 1);
                frameProfiler.count(`runtimeScheduler${kind === 'frame' ? 'Frame' : 'OneShot'}Tasks`, 1);
                try { frameProfiler.measure(category, run); } catch { taskErrorCount += 1; }
                return;
            }
            try { run(); } catch { taskErrorCount += 1; }
        };
        if (frameProfiler && frameProfiler.isEnabled()) {
            frameProfiler.count('runtimeSchedulerTicks', 1);
            frameProfiler.count('runtimeSchedulerInstrumentationV2', 1);
            frameProfiler.count('runtimeSchedulerPendingOneShotTasks', pending.length);
            frameProfiler.count('runtimeSchedulerRegisteredFrameTasks', frameTasks.size);
        }
        pending.forEach(task => runTask(task, 'one-shot'));
        sortedTasks(frameTasks).forEach(task => runTask(task, 'frame'));
        if (frameProfiler && frameProfiler.isEnabled()) {
            frameProfiler.count('runtimeSchedulerTickMs', Math.max(0, now() - tickStartedAt));
        }
        if (!disposed && (oneShotTasks.size || frameTasks.size)) requestTick();
    };

    const requestTick = () => {
        if (disposed || scheduled) return;
        scheduled = true;
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            animationFrameHandle = window.requestAnimationFrame(runTick);
            return;
        }
        timeoutHandle = setTimeout(() => runTick(now()), frameTasks.size ? 16 : 0);
        if (timeoutHandle && typeof timeoutHandle.unref === 'function') timeoutHandle.unref();
    };

    const schedule = (id, callback, options = {}) => {
        if (disposed || typeof callback !== 'function') return false;
        const normalizedId = String(id || '').trim();
        if (!normalizedId) throw new TypeError('Runtime phase task id is required.');
        if (oneShotTasks.has(normalizedId)) coalescedTaskCount += 1;
        oneShotTasks.set(normalizedId, {
            callback,
            id: normalizedId,
            priority: Number.isFinite(Number(options.priority)) ? Number(options.priority) : 1000
        });
        requestTick();
        return true;
    };

    const registerFramePhase = (id, callback, options = {}) => {
        if (disposed || typeof callback !== 'function') return () => {};
        const normalizedId = String(id || '').trim();
        if (!normalizedId) throw new TypeError('Runtime frame phase id is required.');
        frameTasks.set(normalizedId, {
            callback,
            id: normalizedId,
            priority: Number.isFinite(Number(options.priority)) ? Number(options.priority) : 1000
        });
        requestTick();
        return () => {
            frameTasks.delete(normalizedId);
            if (!frameTasks.size && !oneShotTasks.size) {
                cancelScheduledTick();
                lastTimestamp = null;
            }
        };
    };

    const flushNow = timestamp => {
        cancelScheduledTick();
        runTick(Number.isFinite(Number(timestamp)) ? Number(timestamp) : now());
    };

    return Object.freeze({
        dispose: () => {
            if (disposed) return;
            disposed = true;
            cancelScheduledTick();
            oneShotTasks.clear();
            frameTasks.clear();
            lastTimestamp = null;
        },
        flushNow,
        getStatus: () => Object.freeze({
            coalescedTaskCount,
            diagnosticsVersion: RUNTIME_PHASE_SCHEDULER_DIAGNOSTICS_VERSION,
            disposed,
            executedTaskCount,
            frameId,
            framePhaseCount: frameTasks.size,
            pendingTaskCount: oneShotTasks.size,
            scheduled,
            taskErrorCount
        }),
        registerFramePhase,
        schedule
    });
};

const getRuntimePhaseScheduler = runtime => {
    if (!runtime || (typeof runtime !== 'object' && typeof runtime !== 'function')) {
        throw new TypeError('Runtime phase scheduler requires a runtime object.');
    }
    if (!stores.has(runtime)) stores.set(runtime, createRuntimePhaseScheduler(runtime));
    return stores.get(runtime);
};

module.exports = {
    RUNTIME_PHASE_IDS,
    RUNTIME_PHASE_SCHEDULER_DIAGNOSTICS_VERSION,
    RUNTIME_PHASE_PRIORITIES,
    createRuntimePhaseScheduler,
    getRuntimePhaseScheduler
};
