import PropTypes from 'prop-types';
import React from 'react';

import {
    PERFORMANCE_DEBUG_DETAIL,
    PERFORMANCE_PHYSICS_QUALITY,
    PERFORMANCE_RENDER_QUALITY,
    getPerformanceQualityPreferences
} from '../../lib/performance-quality';
import styles from './stage.css';

const PerformanceQualityToolbar = ({vm}) => {
    const [, setRevision] = React.useState(0);
    const runtime = vm && vm.runtime;
    const preferences = React.useMemo(() => (
        runtime ? getPerformanceQualityPreferences(runtime) : null
    ), [runtime]);

    React.useEffect(() => {
        if (!preferences || typeof preferences.subscribe !== 'function') return undefined;
        return preferences.subscribe(() => setRevision(value => value + 1));
    }, [preferences]);

    if (!preferences) return null;
    const physics = preferences.getPhysicsSettings();
    const render = preferences.getRenderSettings();
    const debug = preferences.getDebugSettings();

    return (
        <details className={styles.performanceQualityToolbar} data-ngvge-performance-quality="true">
            <summary>Quality</summary>
            <div className={styles.performanceQualityPanel}>
                <label>
                    <span>Render</span>
                    <select
                        aria-label="NGVGE render quality"
                        value={preferences.getRenderQuality()}
                        onChange={event => preferences.setRenderQuality(event.target.value)}
                    >
                        <option value={PERFORMANCE_RENDER_QUALITY.PERFORMANCE}>Performance</option>
                        <option value={PERFORMANCE_RENDER_QUALITY.BALANCED}>Balanced</option>
                        <option value={PERFORMANCE_RENDER_QUALITY.QUALITY}>Quality</option>
                    </select>
                    <small>{Math.round(render.canvasScale * 100)}% · {render.maxRefreshHz} Hz</small>
                </label>
                <label>
                    <span>Physics</span>
                    <select
                        aria-label="NGVGE physics quality"
                        value={preferences.getPhysicsQuality()}
                        onChange={event => preferences.setPhysicsQuality(event.target.value)}
                    >
                        <option value={PERFORMANCE_PHYSICS_QUALITY.PERFORMANCE}>Performance</option>
                        <option value={PERFORMANCE_PHYSICS_QUALITY.BALANCED}>Balanced</option>
                        <option value={PERFORMANCE_PHYSICS_QUALITY.PRECISE}>Precise</option>
                    </select>
                    <small>{physics.fixedHz} Hz · catch-up {physics.maxCatchUpSteps}</small>
                </label>
                <label>
                    <span>Debug</span>
                    <select
                        aria-label="NGVGE debug detail"
                        value={preferences.getDebugDetail()}
                        onChange={event => preferences.setDebugDetail(event.target.value)}
                    >
                        <option value={PERFORMANCE_DEBUG_DETAIL.LIGHT}>Light</option>
                        <option value={PERFORMANCE_DEBUG_DETAIL.BALANCED}>Balanced</option>
                        <option value={PERFORMANCE_DEBUG_DETAIL.FULL}>Full</option>
                    </select>
                    <small>up to {debug.maxCollisionDebugShapes} shapes</small>
                </label>
                <p>Execution quality only. Project geometry and stable IDs are unchanged.</p>
            </div>
        </details>
    );
};

PerformanceQualityToolbar.propTypes = {vm: PropTypes.object};
export default PerformanceQualityToolbar;
