import PropTypes from 'prop-types';
import React from 'react';

import {COLLIDER2D_RUNTIME_CAPABILITY_ID} from '../../lib/collision-system';
import {
    COLLIDER_GIZMO_GLOBAL_MODE,
    getColliderGizmoPreferences
} from '../../lib/editor-visualization';
import styles from './stage.css';

const getCapability = (vm, capabilityId) => {
    const manager = vm && vm.runtime && vm.runtime.ngvgeFirstPartyModules;
    if (!manager || typeof manager.getCapability !== 'function') return null;
    try { return manager.getCapability(capabilityId); } catch { return null; }
};

const Collider2DDebugToolbar = ({vm}) => {
    const [, setRevision] = React.useState(0);
    const runtime = vm && vm.runtime;
    const colliderRuntime = getCapability(vm, COLLIDER2D_RUNTIME_CAPABILITY_ID);
    const preferences = React.useMemo(() => (
        runtime ? getColliderGizmoPreferences(runtime) : null
    ), [runtime]);

    React.useEffect(() => {
        const refresh = () => setRevision(value => value + 1);
        const unsubscribers = [];
        if (preferences && typeof preferences.subscribe === 'function') {
            unsubscribers.push(preferences.subscribe(refresh));
        }
        if (colliderRuntime && typeof colliderRuntime.subscribe === 'function') {
            unsubscribers.push(colliderRuntime.subscribe(change => {
                if (change && change.type === 'collision:refresh' &&
                    (change.reason === 'physics-step' || change.reason === 'transform-hierarchy-change')) return;
                if (change && (change.type === 'authoring-preview-begin' ||
                    change.type === 'authoring-preview-patch' || change.type === 'authoring-preview-cancel')) return;
                refresh();
            }));
        }
        return () => unsubscribers.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') unsubscribe();
        });
    }, [colliderRuntime, preferences]);

    let count = 0;
    try {
        count = colliderRuntime && typeof colliderRuntime.getStatus === 'function' ?
            Number(colliderRuntime.getStatus().activeColliderCount) || 0 : 0;
    } catch { count = 0; }
    if (!preferences || !count) return null;

    return (
        <label className={styles.colliderDebugToolbar} data-ngvge-collider-debug-toolbar="true">
            <span>Collision Shapes</span>
            <select
                aria-label="Visible collision shapes"
                className={styles.colliderDebugSelect}
                value={preferences.getGlobalMode()}
                onChange={event => preferences.setGlobalMode(event.target.value)}
            >
                <option value={COLLIDER_GIZMO_GLOBAL_MODE.ALL}>All</option>
                <option value={COLLIDER_GIZMO_GLOBAL_MODE.SELECTED}>Selected</option>
                <option value={COLLIDER_GIZMO_GLOBAL_MODE.HIDDEN}>Off</option>
            </select>
            <span className={styles.colliderDebugContactToggle}>
                <input
                    aria-label="Highlight collision overlaps"
                    checked={preferences.getShowOverlapState()}
                    type="checkbox"
                    onChange={event => preferences.setShowOverlapState(event.target.checked)}
                />
                Contacts
            </span>
        </label>
    );
};

Collider2DDebugToolbar.propTypes = {
    vm: PropTypes.object
};

export default Collider2DDebugToolbar;
