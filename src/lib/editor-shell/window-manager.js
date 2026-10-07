import {WORKSPACE_WINDOW_MODEL_ID, normalizeWindowState} from './window-model';

const WORKSPACE_WINDOW_MANAGER_ID = 'ngvge.workspace-window-manager@1';
const WINDOW_MANAGER_STATE_SCHEMA_VERSION = 1;
const DEFAULT_Z_INDEX_BASE = 500;

const isPlainObject = value => (
    value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
);

const clonePoint = value => ({x: value.x, y: value.y});
const cloneSize = value => ({width: value.width, height: value.height});

const freezeRuntimeState = state => Object.freeze({
    ...state,
    position: Object.freeze(clonePoint(state.position)),
    size: Object.freeze(cloneSize(state.size)),
    normalPosition: Object.freeze(clonePoint(state.normalPosition)),
    normalSize: Object.freeze(cloneSize(state.normalSize))
});

const assertWindowId = windowId => {
    if (typeof windowId !== 'string' || windowId.trim().length === 0) {
        throw new TypeError('WindowManager windowId must be a non-empty string.');
    }
    return windowId;
};

class WindowManager {
    constructor({zIndexBase = DEFAULT_Z_INDEX_BASE} = {}) {
        if (!Number.isFinite(zIndexBase)) {
            throw new TypeError('WindowManager zIndexBase must be finite.');
        }
        this.id = WORKSPACE_WINDOW_MANAGER_ID;
        this._descriptors = new Map();
        this._states = new Map();
        this._listeners = new Set();
        this._revision = 0;
        this._focusSerial = 0;
        this._zIndexCounter = zIndexBase;
    }

    get revision() {
        return this._revision;
    }

    subscribe(listener) {
        if (typeof listener !== 'function') {
            throw new TypeError('WindowManager listener must be a function.');
        }
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    _emit(type, windowId) {
        this._revision += 1;
        const event = Object.freeze({
            managerId: this.id,
            revision: this._revision,
            type,
            windowId,
            state: windowId ? this.getState(windowId) : null
        });
        this._listeners.forEach(listener => listener(event));
        return event;
    }

    registerWindow(descriptor, candidateState = {}, options = {}) {
        if (!isPlainObject(descriptor) || descriptor.modelId !== WORKSPACE_WINDOW_MODEL_ID) {
            throw new TypeError('WindowManager requires a Workspace Window descriptor.');
        }
        const windowId = assertWindowId(descriptor.windowId);
        if (this._descriptors.has(windowId)) {
            throw new Error(`Window already registered: ${windowId}`);
        }
        const portable = normalizeWindowState(descriptor, candidateState);
        const initialZIndex = Number.isFinite(options.initialZIndex) ?
            options.initialZIndex : this._zIndexCounter;
        this._zIndexCounter = Math.max(this._zIndexCounter, initialZIndex);
        const state = freezeRuntimeState({
            schemaVersion: WINDOW_MANAGER_STATE_SCHEMA_VERSION,
            managerId: this.id,
            windowId,
            toolId: portable.toolId,
            visible: portable.visible,
            minimized: portable.minimized,
            maximized: portable.maximized,
            active: false,
            zIndex: initialZIndex,
            lastFocusedAt: 0,
            position: portable.position,
            size: portable.size,
            normalPosition: portable.position,
            normalSize: portable.size
        });
        this._descriptors.set(windowId, descriptor);
        this._states.set(windowId, state);
        this._emit('window:registered', windowId);
        return state;
    }

    unregisterWindow(windowId) {
        const id = assertWindowId(windowId);
        if (!this._descriptors.has(id)) {
            return false;
        }
        const wasActive = Boolean(this._states.get(id).active);
        this._descriptors.delete(id);
        this._states.delete(id);
        if (wasActive) {
            this._activateFallback();
        }
        this._emit('window:unregistered', id);
        return true;
    }

    hasWindow(windowId) {
        return this._descriptors.has(windowId);
    }

    getDescriptor(windowId) {
        return this._descriptors.get(windowId) || null;
    }

    requireDescriptor(windowId) {
        const descriptor = this.getDescriptor(windowId);
        if (!descriptor) {
            throw new Error(`Window is not registered: ${windowId}`);
        }
        return descriptor;
    }

    getState(windowId) {
        return this._states.get(windowId) || null;
    }

    requireState(windowId) {
        const state = this.getState(windowId);
        if (!state) {
            throw new Error(`Window is not registered: ${windowId}`);
        }
        return state;
    }

    listStates() {
        return Object.freeze(Array.from(this._states.values()));
    }

    getActiveWindowId() {
        const active = this.listStates().find(state => state.active);
        return active ? active.windowId : null;
    }

    _replaceState(windowId, nextState, type) {
        const frozen = freezeRuntimeState(nextState);
        this._states.set(windowId, frozen);
        this._emit(type, windowId);
        return frozen;
    }

    _patchState(windowId, patch, type) {
        const current = this.requireState(windowId);
        return this._replaceState(windowId, {...current, ...patch}, type);
    }

    _selectFallback(excludedId = null) {
        const candidates = this.listStates()
            .filter(state => state.windowId !== excludedId && state.visible && !state.minimized)
            .sort((a, b) => {
                if (b.lastFocusedAt !== a.lastFocusedAt) {
                    return b.lastFocusedAt - a.lastFocusedAt;
                }
                return b.zIndex - a.zIndex;
            });
        return candidates[0] || null;
    }

    _activateFallback(excludedId = null) {
        const fallback = this._selectFallback(excludedId);
        if (!fallback) {
            let changed = false;
            this._states.forEach((state, id) => {
                if (!state.active) return;
                changed = true;
                this._states.set(id, freezeRuntimeState({...state, active: false}));
            });
            if (changed) this._emit('window:focus-cleared', null);
            return null;
        }
        return this.activate(fallback.windowId);
    }

    activate(windowId) {
        const id = assertWindowId(windowId);
        const target = this.requireState(id);
        if (!target.visible) {
            this._patchState(id, {visible: true}, 'window:opened');
        }
        if (this.requireState(id).minimized) {
            this._patchState(id, {minimized: false}, 'window:restored');
        }
        this._focusSerial += 1;
        this._zIndexCounter += 1;
        this._states.forEach((state, stateId) => {
            const shouldBeActive = stateId === id;
            if (state.active === shouldBeActive && !shouldBeActive) return;
            if (shouldBeActive) {
                this._states.set(stateId, freezeRuntimeState({
                    ...this.requireState(stateId),
                    active: true,
                    zIndex: this._zIndexCounter,
                    lastFocusedAt: this._focusSerial
                }));
            } else if (state.active) {
                this._states.set(stateId, freezeRuntimeState({...state, active: false}));
            }
        });
        this._emit('window:activated', id);
        return this.requireState(id);
    }

    open(windowId, {activate = true} = {}) {
        const id = assertWindowId(windowId);
        const descriptor = this.requireDescriptor(id);
        const current = this.requireState(id);
        const next = this._patchState(id, {
            visible: true,
            minimized: descriptor.capabilities.minimize ? false : current.minimized
        }, 'window:opened');
        return activate ? this.activate(id) : next;
    }

    close(windowId) {
        const id = assertWindowId(windowId);
        const descriptor = this.requireDescriptor(id);
        const current = this.requireState(id);
        if (!descriptor.capabilities.close) {
            throw new Error(`Window does not allow close: ${id}`);
        }
        const wasActive = current.active;
        const next = this._patchState(id, {
            visible: false,
            minimized: false,
            maximized: false,
            active: false,
            position: current.normalPosition,
            size: current.normalSize
        }, 'window:closed');
        if (wasActive) this._activateFallback(id);
        return next;
    }

    minimize(windowId) {
        const id = assertWindowId(windowId);
        const descriptor = this.requireDescriptor(id);
        const current = this.requireState(id);
        if (!descriptor.capabilities.minimize) {
            throw new Error(`Window does not allow minimize: ${id}`);
        }
        const wasActive = current.active;
        const next = this._patchState(id, {minimized: true, active: false}, 'window:minimized');
        if (wasActive) this._activateFallback(id);
        return next;
    }

    restore(windowId, {activate = true} = {}) {
        const id = assertWindowId(windowId);
        const current = this.requireState(id);
        let next = current;

        // Restore is a semantic minimized -> restored transition, not a generic
        // "make sure this window is visible" notification. Emitting
        // window:restored for an already-visible, non-minimized window causes
        // presentation consumers (notably DockTransitionModel) to replay the
        // Dock restore animation during unrelated geometry updates.
        if (current.minimized) {
            next = this._patchState(id, {visible: true, minimized: false}, 'window:restored');
        } else if (!current.visible) {
            next = this._patchState(id, {visible: true}, 'window:opened');
        }

        return activate ? this.activate(id) : next;
    }

    move(windowId, position) {
        const id = assertWindowId(windowId);
        const descriptor = this.requireDescriptor(id);
        const current = this.requireState(id);
        const portable = normalizeWindowState(descriptor, {
            ...current,
            maximized: false,
            position,
            size: current.size
        });
        return this._patchState(id, {
            maximized: false,
            position: portable.position,
            normalPosition: portable.position
        }, 'window:moved');
    }

    resize(windowId, size) {
        const id = assertWindowId(windowId);
        const descriptor = this.requireDescriptor(id);
        if (!descriptor.capabilities.resize) {
            throw new Error(`Window does not allow resize: ${id}`);
        }
        const current = this.requireState(id);
        const portable = normalizeWindowState(descriptor, {
            ...current,
            maximized: false,
            position: current.position,
            size
        });
        return this._patchState(id, {
            maximized: false,
            size: portable.size,
            normalSize: portable.size
        }, 'window:resized');
    }

    maximize(windowId, geometry) {
        const id = assertWindowId(windowId);
        const descriptor = this.requireDescriptor(id);
        const current = this.requireState(id);
        if (!descriptor.capabilities.maximize) {
            throw new Error(`Window does not allow maximize: ${id}`);
        }
        if (!isPlainObject(geometry) || !isPlainObject(geometry.position) || !isPlainObject(geometry.size)) {
            throw new TypeError('Window maximize requires {position, size} geometry.');
        }
        const portable = normalizeWindowState(descriptor, {
            visible: true,
            position: geometry.position,
            size: geometry.size
        });
        return this._patchState(id, {
            visible: true,
            minimized: false,
            maximized: true,
            normalPosition: current.maximized ? current.normalPosition : current.position,
            normalSize: current.maximized ? current.normalSize : current.size,
            position: portable.position,
            size: portable.size
        }, 'window:maximized');
    }

    syncMaximizedGeometry(windowId, geometry) {
        const id = assertWindowId(windowId);
        const current = this.requireState(id);
        if (!current.maximized) return current;
        const descriptor = this.requireDescriptor(id);
        const portable = normalizeWindowState(descriptor, {
            visible: true,
            position: geometry.position,
            size: geometry.size
        });
        return this._patchState(id, {
            position: portable.position,
            size: portable.size
        }, 'window:maximized-geometry-synced');
    }

    restoreMaximized(windowId) {
        const id = assertWindowId(windowId);
        const current = this.requireState(id);
        if (!current.maximized) return current;
        return this._patchState(id, {
            maximized: false,
            position: current.normalPosition,
            size: current.normalSize
        }, 'window:maximize-restored');
    }

    toPortableState(windowId) {
        const state = this.requireState(windowId);
        return Object.freeze({
            visible: state.visible,
            minimized: state.minimized,
            maximized: state.maximized,
            position: Object.freeze(clonePoint(state.position)),
            size: Object.freeze(cloneSize(state.size))
        });
    }
}

export {
    WORKSPACE_WINDOW_MANAGER_ID,
    WINDOW_MANAGER_STATE_SCHEMA_VERSION,
    DEFAULT_Z_INDEX_BASE,
    WindowManager
};
