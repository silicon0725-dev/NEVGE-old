'use strict';

const nowMs = () => (
    typeof performance !== 'undefined' && performance && typeof performance.now === 'function' ?
        performance.now() : Date.now()
);

const createQualityFrameScheduler = options => {
    const onFlush = options && options.onFlush;
    const getHz = options && options.getHz;
    if (typeof onFlush !== 'function') throw new TypeError('Quality frame scheduler requires onFlush().');
    let disposed = false;
    let frameHandle = null;
    let timerHandle = null;
    let lastFlushAt = -Infinity;

    const flush = () => {
        if (disposed) return;
        frameHandle = null;
        timerHandle = null;
        lastFlushAt = nowMs();
        onFlush();
    };

    const scheduleFrame = () => {
        if (disposed || frameHandle !== null || timerHandle !== null) return false;
        const hz = Math.max(1, Math.min(240, Number(typeof getHz === 'function' ? getHz() : 60) || 60));
        const delay = Math.max(0, (1000 / hz) - (nowMs() - lastFlushAt));
        const request = () => {
            timerHandle = null;
            if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
                frameHandle = window.requestAnimationFrame(flush);
            } else {
                flush();
            }
        };
        if (delay > 1 && typeof setTimeout === 'function') timerHandle = setTimeout(request, delay);
        else request();
        return true;
    };

    return Object.freeze({
        dispose: () => {
            disposed = true;
            if (frameHandle !== null && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
                window.cancelAnimationFrame(frameHandle);
            }
            if (timerHandle !== null && typeof clearTimeout === 'function') clearTimeout(timerHandle);
            frameHandle = null;
            timerHandle = null;
        },
        schedule: scheduleFrame
    });
};

module.exports = {createQualityFrameScheduler};
