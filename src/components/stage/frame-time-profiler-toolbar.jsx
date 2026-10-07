import PropTypes from 'prop-types';
import React from 'react';

import {getFrameTimeProfiler} from '../../lib/frame-profiler';
import styles from './stage.css';

const formatMs = value => `${(Number(value) || 0).toFixed((Number(value) || 0) >= 10 ? 1 : 2)} ms`;

const FrameTimeProfilerToolbar = ({vm}) => {
    const runtime = vm && vm.runtime;
    const profiler = React.useMemo(() => runtime ? getFrameTimeProfiler(runtime) : null, [runtime]);
    const [, setRevision] = React.useState(0);
    const captureTimerRef = React.useRef(null);

    React.useEffect(() => {
        if (!profiler) return undefined;
        profiler.attachRenderer(vm && vm.renderer);
        return profiler.subscribe(() => setRevision(value => value + 1));
    }, [profiler, vm]);

    React.useEffect(() => () => {
        if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
    }, []);

    if (!profiler) return null;
    const snapshot = profiler.getSnapshot();
    const running = profiler.isEnabled();
    const categories = snapshot.categories.filter(item => item.p95Ms > 0 || item.averageMs > 0).slice(0, 8);
    const browserMainThread = snapshot.browserMainThread || {};
    const topBrowserScript = Array.isArray(browserMainThread.topScripts) ? browserMainThread.topScripts[0] : null;

    const captureFiveSeconds = () => {
        if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
        profiler.reset();
        profiler.start();
        captureTimerRef.current = setTimeout(() => {
            captureTimerRef.current = null;
            profiler.stop();
        }, 5000);
    };

    const copyReport = () => {
        const report = JSON.stringify(profiler.getSnapshot(240), null, 2);
        if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard.writeText(report).catch(() => {});
        }
    };

    return (
        <details className={styles.frameProfilerToolbar} data-ngvge-frame-profiler="true">
            <summary>Profiler{running ? ` · ${snapshot.averageFps || 0} FPS` : ''}</summary>
            <div className={styles.frameProfilerPanel}>
                <div className={styles.frameProfilerActions}>
                    <button type="button" onClick={() => running ? profiler.stop() : profiler.start()}>
                        {running ? 'Stop' : 'Start'}
                    </button>
                    <button type="button" onClick={captureFiveSeconds}>Capture 5s</button>
                    <button type="button" onClick={() => profiler.reset()}>Reset</button>
                    <button type="button" onClick={copyReport} disabled={!snapshot.frameCount}>Copy</button>
                </div>
                <div className={styles.frameProfilerSummary}>
                    <strong>{snapshot.averageFps || 0} FPS</strong>
                    <span>P95 {formatMs(snapshot.frameP95Ms)}</span>
                    <span>Long {snapshot.longFramePercent || 0}%</span>
                    <span>{snapshot.frameCount} frames</span>
                </div>
                {snapshot.topOffender ? (
                    <div className={styles.frameProfilerHotspot}>
                        Hotspot: <strong>{snapshot.topOffender.label}</strong> · P95 {formatMs(snapshot.topOffender.p95Ms)}
                    </div>
                ) : null}
                {browserMainThread.loafSupported ? (
                    <div className={styles.frameProfilerHotspot} data-ngvge-frame-profiler-loaf="true">
                        Browser LoAF: <strong>{browserMainThread.longAnimationFrameCount || 0}</strong> · P95 {formatMs(browserMainThread.p95LoafMs)}
                        {' · '}forced layout {formatMs(browserMainThread.totalForcedStyleAndLayoutMs)}
                        {topBrowserScript ? (
                            <React.Fragment>
                                {' · '}top {topBrowserScript.sourceFunctionName || topBrowserScript.invoker || 'script'}
                            </React.Fragment>
                        ) : null}
                    </div>
                ) : (
                    <div className={styles.frameProfilerHotspot} data-ngvge-frame-profiler-loaf="unsupported">
                        Browser LoAF attribution unavailable in this browser.
                    </div>
                )}
                <div className={styles.frameProfilerRows}>
                    {categories.map(item => (
                        <div className={styles.frameProfilerRow} key={item.category}>
                            <span>{item.label}</span>
                            <span>{formatMs(item.averageMs)}</span>
                            <span>P95 {formatMs(item.p95Ms)}</span>
                            <span>{item.averageCallsPerFrame}×</span>
                        </div>
                    ))}
                    {snapshot.frameCount ? (
                        <div className={styles.frameProfilerRow}>
                            <span>Untracked budget*</span>
                            <span>{formatMs(snapshot.untrackedAverageMs)}</span>
                            <span>frame {formatMs(snapshot.averageFrameMs)}</span>
                            <span />
                        </div>
                    ) : null}
                </div>
                {Object.keys(snapshot.counters).length ? (
                    <div className={styles.frameProfilerCounters}>
                        {Object.entries(snapshot.counters).map(([key, value]) => <span key={key}>{key}: {value}</span>)}
                    </div>
                ) : null}
                <p>* Approximate. Category spans may overlap. Profiler is diagnostic execution state only and is off by default.</p>
            </div>
        </details>
    );
};

FrameTimeProfilerToolbar.propTypes = {vm: PropTypes.object};
export default FrameTimeProfilerToolbar;
