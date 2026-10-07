const {createObserverErrorRecorder} = require('./observer-dispatch');

const capabilityStates = new WeakMap();

const getState = instance => {
    const state = capabilityStates.get(instance);
    if (!state) throw new TypeError('Invalid ModuleCapabilityRegistry receiver.');
    return state;
};

const emitCapabilityChange = (instance, change) => {
    const state = getState(instance);
    state.observerErrors.dispatch(state.listeners, change, {source: 'capability-registry'});
};

class ModuleCapabilityRegistry {
    constructor (options = {}) {
        capabilityStates.set(this, {
            assertMutationAllowed: typeof options.assertMutationAllowed === 'function' ?
                options.assertMutationAllowed : () => {},
            capabilities: new Map(),
            listeners: new Set(),
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

    provide (providerModuleId, capabilityId, value, options = {}, authority = null, phasePermit = null) {
        const state = getState(this);
        state.assertMutationAllowed('provide', {authority, capabilityId, phasePermit, providerModuleId});
        if (typeof providerModuleId !== 'string' || !providerModuleId) {
            throw new TypeError('Capability provider must be a module id.');
        }
        if (typeof capabilityId !== 'string' || !capabilityId) {
            throw new TypeError('Capability id must be a non-empty string.');
        }
        const current = state.capabilities.get(capabilityId);
        if (current && current.providerModuleId !== providerModuleId) {
            const error = new Error(
                `Module "${providerModuleId}" cannot replace capability "${capabilityId}" owned by ` +
                `"${current.providerModuleId}".`
            );
            error.code = 'MODULE_CAPABILITY_PROVIDER_REPLACEMENT_FORBIDDEN';
            error.capabilityId = capabilityId;
            error.providerModuleId = providerModuleId;
            error.currentProviderModuleId = current.providerModuleId;
            throw error;
        }
        const record = Object.freeze({
            capabilityId,
            providerModuleId,
            value,
            version: typeof options.version === 'string' ? options.version : null
        });
        state.capabilities.set(capabilityId, record);
        emitCapabilityChange(this, {capabilityId, providerModuleId, type: 'provide'});
        return () => {
            const liveState = getState(this);
            liveState.assertMutationAllowed('revoke', {authority, capabilityId, providerModuleId});
            if (liveState.capabilities.get(capabilityId) !== record) return false;
            liveState.capabilities.delete(capabilityId);
            emitCapabilityChange(this, {capabilityId, providerModuleId, type: 'revoke'});
            return true;
        };
    }

    get (capabilityId) {
        const record = getState(this).capabilities.get(capabilityId);
        return record ? record.value : null;
    }

    getRecord (capabilityId) {
        return getState(this).capabilities.get(capabilityId) || null;
    }

    require (capabilityId) {
        const record = this.getRecord(capabilityId);
        if (!record) throw new Error(`Required capability "${capabilityId}" is unavailable.`);
        return record.value;
    }

    revokeByProvider (providerModuleId, authority = null) {
        const state = getState(this);
        state.assertMutationAllowed('revokeByProvider', {authority, providerModuleId});
        const revoked = [];
        state.capabilities.forEach((record, capabilityId) => {
            if (record.providerModuleId !== providerModuleId) return;
            state.capabilities.delete(capabilityId);
            revoked.push(capabilityId);
            emitCapabilityChange(this, {capabilityId, providerModuleId, type: 'revoke'});
        });
        return revoked;
    }

    list () {
        return Array.from(getState(this).capabilities.values());
    }

    subscribe (listener) {
        if (typeof listener !== 'function') return () => {};
        const listeners = getState(this).listeners;
        listeners.add(listener);
        return () => listeners.delete(listener);
    }
}

Object.freeze(ModuleCapabilityRegistry.prototype);

module.exports = ModuleCapabilityRegistry;
