const {cloneSerializable} = require('./module-manifest');
const {createObserverErrorRecorder} = require('./observer-dispatch');

const dataStoreStates = new WeakMap();

const getState = instance => {
    const state = dataStoreStates.get(instance);
    if (!state) throw new TypeError('Invalid ModuleDataStore receiver.');
    return state;
};

const emitDataStoreChange = (instance, change, silent = false) => {
    const state = getState(instance);
    if (!silent && state.onChange) {
        try {
            state.onChange(change);
        } catch (error) {
            state.observerErrors.recordError(error, {source: 'module-data-store:onChange'});
        }
    }
    state.observerErrors.dispatch(state.listeners, change, {source: 'module-data-store'});
};

class ModuleDataStore {
    constructor (onChange = null, options = {}) {
        dataStoreStates.set(this, {
            assertMutationAllowed: typeof options.assertMutationAllowed === 'function' ?
                options.assertMutationAllowed : () => {},
            data: new Map(),
            listeners: new Set(),
            observerErrors: createObserverErrorRecorder(options.onObserverError, {
                enterDispatch: options.enterObserverDispatch,
                leaveDispatch: options.leaveObserverDispatch
            }),
            onChange: typeof onChange === 'function' ? onChange : null
        });
        Object.seal(this);
    }

    getObserverErrorSnapshot () {
        return getState(this).observerErrors.getSnapshot();
    }

    get (moduleId, fallback = {}) {
        const data = getState(this).data;
        if (!data.has(moduleId)) return cloneSerializable(fallback);
        return cloneSerializable(data.get(moduleId));
    }

    set (moduleId, value, options = {}, authority = null) {
        const state = getState(this);
        state.assertMutationAllowed('set', {authority, moduleId});
        if (typeof moduleId !== 'string' || !moduleId) {
            throw new TypeError('Module data requires a module id.');
        }
        const cloned = cloneSerializable(typeof value === 'undefined' ? null : value);
        state.data.set(moduleId, cloned);
        emitDataStoreChange(this, {moduleId, type: 'set'}, Boolean(options.silent));
        return cloneSerializable(cloned);
    }

    update (moduleId, updater, options = {}, authority = null) {
        const state = getState(this);
        state.assertMutationAllowed('update', {authority, moduleId});
        if (typeof updater !== 'function') throw new TypeError('Module data updater must be a function.');
        const current = this.get(moduleId, {});
        const next = updater(current);
        return this.set(moduleId, typeof next === 'undefined' ? current : next, options, authority);
    }

    delete (moduleId, options = {}, authority = null) {
        const state = getState(this);
        state.assertMutationAllowed('delete', {authority, moduleId});
        const removed = state.data.delete(moduleId);
        if (removed) emitDataStoreChange(this, {moduleId, type: 'delete'}, Boolean(options.silent));
        return removed;
    }

    clear (options = {}, authority = null) {
        const state = getState(this);
        state.assertMutationAllowed('clear', {authority});
        if (!state.data.size) return false;
        state.data.clear();
        emitDataStoreChange(this, {type: 'clear'}, Boolean(options.silent));
        return true;
    }

    serialize () {
        const result = {};
        getState(this).data.forEach((value, moduleId) => {
            result[moduleId] = cloneSerializable(value);
        });
        return result;
    }

    deserialize (snapshot, options = {}, authority = null) {
        const state = getState(this);
        state.assertMutationAllowed('deserialize', {authority});
        state.data.clear();
        if (snapshot && typeof snapshot === 'object') {
            Object.keys(snapshot).forEach(moduleId => {
                state.data.set(moduleId, cloneSerializable(snapshot[moduleId]));
            });
        }
        emitDataStoreChange(this, {type: 'deserialize'}, Boolean(options.silent));
    }

    subscribe (listener) {
        if (typeof listener !== 'function') return () => {};
        const listeners = getState(this).listeners;
        listeners.add(listener);
        return () => listeners.delete(listener);
    }
}

Object.freeze(ModuleDataStore.prototype);

module.exports = ModuleDataStore;
