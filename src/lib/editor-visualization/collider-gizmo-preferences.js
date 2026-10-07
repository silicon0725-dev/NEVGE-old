const COLLIDER_GIZMO_VISIBILITY = Object.freeze({
    ALWAYS: 'always',
    HIDDEN: 'hidden',
    INHERIT: 'inherit',
    SELECTED: 'selected'
});

const COLLIDER_GIZMO_GLOBAL_MODE = Object.freeze({
    ALL: 'all',
    HIDDEN: 'hidden',
    SELECTED: 'selected'
});

const VALID_VISIBILITY = new Set(Object.values(COLLIDER_GIZMO_VISIBILITY));
const VALID_GLOBAL_MODE = new Set(Object.values(COLLIDER_GIZMO_GLOBAL_MODE));
const stores = new WeakMap();

const assertRuntime = runtime => {
    if (!runtime || (typeof runtime !== 'object' && typeof runtime !== 'function')) {
        throw new TypeError('Collider gizmo preferences require a runtime object.');
    }
};

const assertNodeId = nodeId => {
    if (typeof nodeId !== 'string' || !nodeId.length) {
        throw new TypeError('Collider gizmo preference nodeId must be a non-empty string.');
    }
};

const createStore = () => {
    const listeners = new Set();
    const nodeVisibility = new Map();
    let globalMode = COLLIDER_GIZMO_GLOBAL_MODE.ALL;
    let showOverlapState = false;

    const notify = change => listeners.forEach(listener => listener(change));

    return Object.freeze({
        getGlobalMode: () => globalMode,
        getNodeVisibility: nodeId => nodeVisibility.get(nodeId) || COLLIDER_GIZMO_VISIBILITY.INHERIT,
        getShowOverlapState: () => showOverlapState,
        setGlobalMode: mode => {
            if (!VALID_GLOBAL_MODE.has(mode)) throw new TypeError(`Unknown collider gizmo global mode: ${mode}`);
            if (globalMode === mode) return false;
            globalMode = mode;
            notify(Object.freeze({mode, type: 'global-mode'}));
            return true;
        },
        setShowOverlapState: value => {
            const next = Boolean(value);
            if (showOverlapState === next) return false;
            showOverlapState = next;
            notify(Object.freeze({showOverlapState, type: 'overlap-state'}));
            return true;
        },
        setNodeVisibility: (nodeId, visibility) => {
            assertNodeId(nodeId);
            if (!VALID_VISIBILITY.has(visibility)) {
                throw new TypeError(`Unknown collider gizmo visibility: ${visibility}`);
            }
            const before = nodeVisibility.get(nodeId) || COLLIDER_GIZMO_VISIBILITY.INHERIT;
            if (before === visibility) return false;
            if (visibility === COLLIDER_GIZMO_VISIBILITY.INHERIT) nodeVisibility.delete(nodeId);
            else nodeVisibility.set(nodeId, visibility);
            notify(Object.freeze({nodeId, type: 'node-visibility', visibility}));
            return true;
        },
        shouldShow: (nodeId, selectedNodeId = null) => {
            assertNodeId(nodeId);
            const visibility = nodeVisibility.get(nodeId) || COLLIDER_GIZMO_VISIBILITY.INHERIT;
            if (visibility === COLLIDER_GIZMO_VISIBILITY.ALWAYS) return true;
            if (visibility === COLLIDER_GIZMO_VISIBILITY.HIDDEN) return false;
            if (visibility === COLLIDER_GIZMO_VISIBILITY.SELECTED) return nodeId === selectedNodeId;
            // Godot-style authoring rule: the selected collision shape stays visible in the
            // editor even when scene-wide debug shapes are disabled. Global mode controls
            // unselected debug geometry; an explicit per-node Hidden override can still hide it.
            if (nodeId === selectedNodeId) return true;
            if (globalMode === COLLIDER_GIZMO_GLOBAL_MODE.HIDDEN) return false;
            if (globalMode === COLLIDER_GIZMO_GLOBAL_MODE.SELECTED) return false;
            return true;
        },
        subscribe: listener => {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    });
};

const getColliderGizmoPreferences = runtime => {
    assertRuntime(runtime);
    if (!stores.has(runtime)) stores.set(runtime, createStore());
    return stores.get(runtime);
};

export {
    COLLIDER_GIZMO_GLOBAL_MODE,
    COLLIDER_GIZMO_VISIBILITY,
    getColliderGizmoPreferences
};
