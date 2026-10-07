const CHARACTER_TEST_DRIVE_MODES = Object.freeze({
    PLATFORMER: 'platformer',
    TOP_DOWN: 'top-down'
});

const DEFAULT_CHARACTER_TEST_DRIVE_SETTINGS = Object.freeze({
    gravity: 1200,
    jumpSpeed: 420,
    mode: CHARACTER_TEST_DRIVE_MODES.PLATFORMER,
    speed: 180
});

const VALID_MODES = new Set(Object.values(CHARACTER_TEST_DRIVE_MODES));
const stores = new WeakMap();

const assertRuntime = runtime => {
    if (!runtime || (typeof runtime !== 'object' && typeof runtime !== 'function')) {
        throw new TypeError('Character test drive requires a runtime object.');
    }
};

const finiteNonNegative = (value, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
};

const createStore = () => {
    const listeners = new Set();
    let state = Object.freeze({
        activeNodeId: null,
        gravity: DEFAULT_CHARACTER_TEST_DRIVE_SETTINGS.gravity,
        jumpSpeed: DEFAULT_CHARACTER_TEST_DRIVE_SETTINGS.jumpSpeed,
        lastError: null,
        mode: DEFAULT_CHARACTER_TEST_DRIVE_SETTINGS.mode,
        running: false,
        speed: DEFAULT_CHARACTER_TEST_DRIVE_SETTINGS.speed,
        status: 'idle'
    });

    const notify = change => listeners.forEach(listener => {
        try { listener(change); } catch { /* editor advisory listener */ }
    });
    const replace = (patch, change) => {
        state = Object.freeze(Object.assign({}, state, patch));
        notify(Object.freeze(Object.assign({type: 'character-test-drive'}, change || {})));
        return state;
    };

    return Object.freeze({
        clearError: () => replace({lastError: null}, {reason: 'clear-error'}),
        getState: () => state,
        patchSettings: patch => {
            const source = patch && typeof patch === 'object' ? patch : {};
            const next = {};
            if (Object.prototype.hasOwnProperty.call(source, 'mode')) {
                if (!VALID_MODES.has(source.mode)) throw new TypeError(`Unknown Character test-drive mode: ${source.mode}`);
                next.mode = source.mode;
            }
            if (Object.prototype.hasOwnProperty.call(source, 'speed')) {
                next.speed = finiteNonNegative(source.speed, state.speed);
            }
            if (Object.prototype.hasOwnProperty.call(source, 'gravity')) {
                next.gravity = finiteNonNegative(source.gravity, state.gravity);
            }
            if (Object.prototype.hasOwnProperty.call(source, 'jumpSpeed')) {
                next.jumpSpeed = finiteNonNegative(source.jumpSpeed, state.jumpSpeed);
            }
            return replace(next, {reason: 'settings'});
        },
        reportError: error => replace({
            lastError: error && error.message ? error.message : String(error || 'Unknown Character test-drive error'),
            running: false,
            status: 'error'
        }, {reason: 'error'}),
        start: nodeId => {
            if (typeof nodeId !== 'string' || !nodeId.length) {
                throw new TypeError('Character test-drive nodeId must be a non-empty string.');
            }
            return replace({
                activeNodeId: nodeId,
                lastError: null,
                running: true,
                status: 'running'
            }, {nodeId, reason: 'start'});
        },
        pause: () => replace({running: false, status: state.activeNodeId ? 'paused' : 'idle'}, {
            nodeId: state.activeNodeId,
            reason: 'pause'
        }),
        stop: () => replace({activeNodeId: null, lastError: null, running: false, status: 'idle'}, {
            nodeId: state.activeNodeId,
            reason: 'stop'
        }),
        subscribe: listener => {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    });
};

const getCharacterTestDrive = runtime => {
    assertRuntime(runtime);
    if (!stores.has(runtime)) stores.set(runtime, createStore());
    return stores.get(runtime);
};

export {
    CHARACTER_TEST_DRIVE_MODES,
    DEFAULT_CHARACTER_TEST_DRIVE_SETTINGS,
    getCharacterTestDrive
};
