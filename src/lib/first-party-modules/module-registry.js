const {normalizeModuleManifest} = require('./module-manifest');
const {createObserverErrorRecorder} = require('./observer-dispatch');

const registryStates = new WeakMap();

const getState = instance => {
    const state = registryStates.get(instance);
    if (!state) throw new TypeError('Invalid FirstPartyModuleRegistry receiver.');
    return state;
};

const emitRegistryChange = (instance, change) => {
    const state = getState(instance);
    state.observerErrors.dispatch(state.listeners, change, {source: 'module-registry'});
};

class FirstPartyModuleRegistry {
    constructor (options = {}) {
        registryStates.set(this, {
            assertMutationAllowed: typeof options.assertMutationAllowed === 'function' ?
                options.assertMutationAllowed : () => {},
            listeners: new Set(),
            modules: new Map(),
            observerErrors: createObserverErrorRecorder(options.onObserverError, {
                enterDispatch: options.enterObserverDispatch,
                leaveDispatch: options.leaveObserverDispatch
            })
        });
        Object.seal(this);
    }

    getObserverErrorSnapshot () {
        return getState(this).observerErrors.getSnapshot();
    }

    register (definition, authority = null) {
        const state = getState(this);
        state.assertMutationAllowed('register', {authority});
        if (!definition || typeof definition !== 'object') {
            throw new TypeError('Module definition must be an object.');
        }
        const manifest = normalizeModuleManifest(definition.manifest || definition);
        if (state.modules.has(manifest.id)) {
            const error = new Error(`Module "${manifest.id}" is already registered.`);
            error.code = 'MODULE_ALREADY_REGISTERED';
            error.moduleId = manifest.id;
            throw error;
        }
        const record = Object.freeze({
            hooks: Object.freeze(Object.assign({},
                definition.hooks && typeof definition.hooks === 'object' ? definition.hooks : {}
            )),
            manifest
        });
        state.modules.set(manifest.id, record);
        emitRegistryChange(this, {moduleId: manifest.id, type: 'register'});
        return record;
    }

    unregister (moduleId, authority = null) {
        const state = getState(this);
        state.assertMutationAllowed('unregister', {authority, moduleId});
        const removed = state.modules.delete(moduleId);
        if (removed) emitRegistryChange(this, {moduleId, type: 'unregister'});
        return removed;
    }

    get (moduleId) {
        return getState(this).modules.get(moduleId) || null;
    }

    has (moduleId) {
        return getState(this).modules.has(moduleId);
    }

    list () {
        return Array.from(getState(this).modules.values()).sort((a, b) => (
            a.manifest.name.localeCompare(b.manifest.name)
        ));
    }

    subscribe (listener) {
        if (typeof listener !== 'function') return () => {};
        const listeners = getState(this).listeners;
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    clear (authority = null) {
        const state = getState(this);
        state.assertMutationAllowed('clear', {authority});
        state.modules.clear();
        emitRegistryChange(this, {type: 'clear'});
    }
}

Object.freeze(FirstPartyModuleRegistry.prototype);

module.exports = FirstPartyModuleRegistry;
