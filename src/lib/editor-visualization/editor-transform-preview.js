const stores = new WeakMap();

const assertRuntime = runtime => {
    if (!runtime || (typeof runtime !== 'object' && typeof runtime !== 'function')) {
        throw new TypeError('Editor transform preview requires a runtime object.');
    }
};

const finitePair = (value, label) => {
    if (!value || typeof value !== 'object' || value.length < 2) {
        throw new TypeError(`${label} must contain two finite numbers.`);
    }
    const x = Number(value[0]);
    const y = Number(value[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new TypeError(`${label} must contain two finite numbers.`);
    }
    return [x, y];
};

const snapshotFrom = state => Object.freeze({
    active: Boolean(state.active),
    authoredPosition: state.authoredPosition ? Object.freeze(state.authoredPosition.slice()) : null,
    delta: state.delta ? Object.freeze(state.delta.slice()) : Object.freeze([0, 0]),
    nodeId: state.nodeId || null,
    previewPosition: state.previewPosition ? Object.freeze(state.previewPosition.slice()) : null,
    reason: state.reason || null,
    revision: state.revision,
    targetRuntimeId: state.targetRuntimeId || null
});

const createStore = () => {
    const listeners = new Set();
    let revision = 0;
    let state = {
        active: false,
        authoredPosition: null,
        delta: [0, 0],
        nodeId: null,
        previewPosition: null,
        reason: null,
        revision,
        targetRuntimeId: null
    };

    const notify = change => {
        const snapshot = snapshotFrom(state);
        listeners.forEach(listener => listener(snapshot, change));
        return snapshot;
    };

    const replace = (next, change) => {
        revision += 1;
        state = Object.assign({}, next, {revision});
        return notify(Object.freeze(Object.assign({revision}, change)));
    };

    const clear = (reason, type) => replace({
        active: false,
        authoredPosition: null,
        delta: [0, 0],
        nodeId: null,
        previewPosition: null,
        reason: reason || null,
        targetRuntimeId: null
    }, {reason: reason || null, type});

    return Object.freeze({
        begin: input => {
            if (!input || typeof input !== 'object') {
                throw new TypeError('Editor transform preview begin() requires input.');
            }
            if (typeof input.nodeId !== 'string' || !input.nodeId.trim()) {
                throw new TypeError('Editor transform preview requires a stable semantic nodeId.');
            }
            const authoredPosition = finitePair(input.authoredPosition, 'authoredPosition');
            const previewPosition = input.previewPosition ?
                finitePair(input.previewPosition, 'previewPosition') : authoredPosition.slice();
            return replace({
                active: true,
                authoredPosition,
                delta: [previewPosition[0] - authoredPosition[0], previewPosition[1] - authoredPosition[1]],
                nodeId: input.nodeId,
                previewPosition,
                reason: input.reason || 'drag',
                targetRuntimeId: typeof input.targetRuntimeId === 'string' ? input.targetRuntimeId : null
            }, {nodeId: input.nodeId, type: 'begin'});
        },
        cancel: reason => clear(reason || 'cancelled', 'cancel'),
        commit: reason => clear(reason || 'committed', 'commit'),
        getSnapshot: () => snapshotFrom(state),
        subscribe: listener => {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        updatePosition: positionValue => {
            if (!state.active) return snapshotFrom(state);
            const previewPosition = finitePair(positionValue, 'previewPosition');
            if (state.previewPosition && previewPosition[0] === state.previewPosition[0] &&
                previewPosition[1] === state.previewPosition[1]) return snapshotFrom(state);
            return replace(Object.assign({}, state, {
                delta: [
                    previewPosition[0] - state.authoredPosition[0],
                    previewPosition[1] - state.authoredPosition[1]
                ],
                previewPosition
            }), {nodeId: state.nodeId, type: 'update'});
        }
    });
};

const getEditorTransformPreview = runtime => {
    assertRuntime(runtime);
    if (!stores.has(runtime)) stores.set(runtime, createStore());
    return stores.get(runtime);
};

export {
    getEditorTransformPreview
};
