import {WORKSPACE_WINDOW_MANAGER_ID} from './window-manager';

const WORKSPACE_DOCK_TRANSITION_MODEL_ID = 'ngvge.workspace-dock-transition-model@1';
const DOCK_TRANSITION_SCHEMA_VERSION = 1;
const DEFAULT_DOCK_TRANSITION_DURATION_MS = 220;

const DOCK_TRANSITION_KINDS = Object.freeze({
    MINIMIZE: 'minimize',
    RESTORE: 'restore'
});

const isPlainObject = value => (
    value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
);

const freezeRect = rect => Object.freeze({
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
});

const normalizeRect = value => {
    if (!isPlainObject(value)) return null;
    const left = Number(value.left);
    const top = Number(value.top);
    const width = Number(value.width);
    const height = Number(value.height);
    if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
        return null;
    }
    return freezeRect({left, top, width, height});
};

const assertDependency = (condition, message) => {
    if (!condition) throw new TypeError(message);
};

const freezeSemanticSnapshot = state => Object.freeze({
    visible: Boolean(state.visible),
    minimized: Boolean(state.minimized),
    active: Boolean(state.active),
    maximized: Boolean(state.maximized)
});

class DockTransitionModel {
    constructor ({
        windowManager,
        getWorkspaceViewportGeometry,
        getDockTargetGeometry,
        durationMs = DEFAULT_DOCK_TRANSITION_DURATION_MS
    } = {}) {
        assertDependency(
            windowManager && windowManager.id === WORKSPACE_WINDOW_MANAGER_ID &&
            typeof windowManager.subscribe === 'function' && typeof windowManager.getState === 'function',
            'DockTransitionModel requires the Workspace WindowManager.'
        );
        assertDependency(
            typeof getWorkspaceViewportGeometry === 'function',
            'DockTransitionModel requires a Workspace viewport geometry provider.'
        );
        assertDependency(
            typeof getDockTargetGeometry === 'function',
            'DockTransitionModel requires a Dock target geometry provider.'
        );
        if (!Number.isFinite(durationMs) || durationMs < 0) {
            throw new TypeError('DockTransitionModel durationMs must be a non-negative finite number.');
        }

        this.id = WORKSPACE_DOCK_TRANSITION_MODEL_ID;
        this._windowManager = windowManager;
        this._getWorkspaceViewportGeometry = getWorkspaceViewportGeometry;
        this._getDockTargetGeometry = getDockTargetGeometry;
        this._durationMs = durationMs;
        this._listeners = new Set();
        this._transitions = new Map();
        this._revision = 0;
        this._serial = 0;
        this._disposed = false;
        this._diagnostics = {
            skippedMissingWorkspaceGeometry: 0,
            skippedMissingDockTargetGeometry: 0,
            supersededTransitions: 0
        };
        this._unsubscribeWindowManager = windowManager.subscribe(event => this._handleWindowEvent(event));
    }

    get revision () {
        return this._revision;
    }

    subscribe (listener) {
        if (typeof listener !== 'function') {
            throw new TypeError('DockTransitionModel listener must be a function.');
        }
        if (this._disposed) return () => false;
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    _emit (type, transition = null) {
        this._revision += 1;
        const event = Object.freeze({
            modelId: this.id,
            revision: this._revision,
            type,
            transition
        });
        this._listeners.forEach(listener => listener(event));
        return event;
    }

    _getWindowViewportGeometry (state) {
        const workspace = normalizeRect(this._getWorkspaceViewportGeometry());
        if (!workspace) {
            this._diagnostics.skippedMissingWorkspaceGeometry += 1;
            return null;
        }
        return freezeRect({
            left: workspace.left + state.position.x,
            top: workspace.top + state.position.y,
            width: state.size.width,
            height: state.size.height
        });
    }

    _getDockViewportGeometry (toolId) {
        const target = normalizeRect(this._getDockTargetGeometry(toolId));
        if (!target) {
            this._diagnostics.skippedMissingDockTargetGeometry += 1;
            return null;
        }
        return target;
    }

    _handleWindowEvent (event) {
        if (this._disposed || !event || (
            event.type !== 'window:minimized' && event.type !== 'window:restored'
        )) return;

        const state = this._windowManager.getState(event.windowId);
        if (!state || !state.toolId) return;
        const windowGeometry = this._getWindowViewportGeometry(state);
        const dockGeometry = this._getDockViewportGeometry(state.toolId);
        if (!windowGeometry || !dockGeometry) return;

        if (this._transitions.has(state.windowId)) {
            this._transitions.delete(state.windowId);
            this._diagnostics.supersededTransitions += 1;
        }

        const kind = event.type === 'window:minimized' ?
            DOCK_TRANSITION_KINDS.MINIMIZE : DOCK_TRANSITION_KINDS.RESTORE;
        this._serial += 1;
        const transition = Object.freeze({
            schemaVersion: DOCK_TRANSITION_SCHEMA_VERSION,
            modelId: this.id,
            transitionId: `ngvge.dock-transition.${this._serial}`,
            kind,
            windowId: state.windowId,
            toolId: state.toolId,
            from: kind === DOCK_TRANSITION_KINDS.MINIMIZE ? windowGeometry : dockGeometry,
            to: kind === DOCK_TRANSITION_KINDS.MINIMIZE ? dockGeometry : windowGeometry,
            durationMs: this._durationMs,
            semanticState: freezeSemanticSnapshot(state)
        });
        this._transitions.set(state.windowId, transition);
        this._emit('transition:started', transition);
    }

    listTransitions () {
        return Object.freeze(Array.from(this._transitions.values()));
    }

    getTransitionForWindow (windowId) {
        return this._transitions.get(windowId) || null;
    }

    completeTransition (transitionId) {
        let match = null;
        for (const transition of this._transitions.values()) {
            if (transition.transitionId === transitionId) {
                match = transition;
                break;
            }
        }
        if (!match) return false;
        this._transitions.delete(match.windowId);
        this._emit('transition:completed', match);
        return true;
    }

    getDiagnostics () {
        return Object.freeze({...this._diagnostics});
    }

    dispose () {
        if (this._disposed) return false;
        this._disposed = true;
        if (this._unsubscribeWindowManager) this._unsubscribeWindowManager();
        this._unsubscribeWindowManager = null;
        this._listeners.clear();
        this._transitions.clear();
        return true;
    }
}

export {
    WORKSPACE_DOCK_TRANSITION_MODEL_ID,
    DOCK_TRANSITION_SCHEMA_VERSION,
    DEFAULT_DOCK_TRANSITION_DURATION_MS,
    DOCK_TRANSITION_KINDS,
    DockTransitionModel
};
