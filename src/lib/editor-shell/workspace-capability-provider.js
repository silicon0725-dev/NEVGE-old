import {TOOL_CAPABILITY_ACCESS} from './tool-capability';

const WORKSPACE_CAPABILITY_PROVIDER_REGISTRY_ID = 'ngvge.workspace-capability-provider-registry@1';
const WORKSPACE_CAPABILITY_PROVIDER_DESCRIPTOR_SCHEMA_VERSION = 1;
const WORKSPACE_CAPABILITY_PROVIDER_BINDING_SCHEMA_VERSION = 1;

const WORKSPACE_CAPABILITY_PROVIDER_STATES = Object.freeze({
    READY: 'ready',
    PROVIDER_MISSING: 'provider-missing',
    PROVIDER_UNAVAILABLE: 'provider-unavailable'
});

const FORBIDDEN_FACADE_KEYS = new Set([
    'backend',
    'backendhandle',
    'handle',
    'raw',
    'rawvm',
    'renderer',
    'scratchtarget',
    'target',
    'vm'
]);

const isPlainObject = value => (
    value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
);

const freezeDeep = value => {
    if (Array.isArray(value)) {
        value.forEach(freezeDeep);
        return Object.freeze(value);
    }
    if (isPlainObject(value)) {
        Object.keys(value).forEach(key => freezeDeep(value[key]));
        return Object.freeze(value);
    }
    return value;
};

const makeProviderError = (code, message) => {
    const error = new Error(message);
    error.code = code;
    return error;
};

const assertStableProviderId = providerId => {
    if (typeof providerId !== 'string' ||
        !/^ngvge\.workspace-capability-provider\.[a-z0-9][a-z0-9.-]*$/.test(providerId)) {
        throw new TypeError(
            'Workspace Capability Provider requires a stable ngvge.workspace-capability-provider.* providerId.'
        );
    }
    return providerId;
};

const normalizeProviderDescriptor = descriptor => {
    if (!isPlainObject(descriptor)) {
        throw new TypeError('Workspace Capability Provider descriptor must be a plain object.');
    }
    const allowedFields = ['schemaVersion', 'providerId', 'capabilityId', 'access', 'description'];
    const unknown = Object.keys(descriptor).filter(key => !allowedFields.includes(key));
    if (unknown.length) {
        throw new Error(`Workspace Capability Provider descriptor contains unsupported field(s): ${unknown.join(', ')}`);
    }
    if (descriptor.schemaVersion !== WORKSPACE_CAPABILITY_PROVIDER_DESCRIPTOR_SCHEMA_VERSION) {
        throw new TypeError(
            `Workspace Capability Provider descriptor schemaVersion must be ` +
            `${WORKSPACE_CAPABILITY_PROVIDER_DESCRIPTOR_SCHEMA_VERSION}.`
        );
    }
    const providerId = assertStableProviderId(descriptor.providerId);
    if (typeof descriptor.capabilityId !== 'string' ||
        !/^ngvge\.workspace-capability\.[a-z0-9][a-z0-9.-]*$/.test(descriptor.capabilityId)) {
        throw new TypeError('Workspace Capability Provider requires a stable Workspace capabilityId.');
    }
    if (!Object.values(TOOL_CAPABILITY_ACCESS).includes(descriptor.access)) {
        throw new TypeError(`Unsupported Workspace Capability Provider access: ${descriptor.access}`);
    }
    if (typeof descriptor.description !== 'string' || !descriptor.description.trim()) {
        throw new TypeError('Workspace Capability Provider description must be non-empty.');
    }
    return freezeDeep({
        schemaVersion: WORKSPACE_CAPABILITY_PROVIDER_DESCRIPTOR_SCHEMA_VERSION,
        providerId,
        capabilityId: descriptor.capabilityId,
        access: descriptor.access,
        description: descriptor.description.trim()
    });
};

const normalizeAvailability = value => {
    if (typeof value === 'boolean') {
        return freezeDeep({available: value, code: value ? null : 'NGVGE_WORKSPACE_CAPABILITY_PROVIDER_UNAVAILABLE', message: null});
    }
    if (!isPlainObject(value) || typeof value.available !== 'boolean') {
        throw new TypeError('Workspace Capability Provider availability must be boolean or a plain availability record.');
    }
    const allowedFields = ['available', 'code', 'message'];
    const unknown = Object.keys(value).filter(key => !allowedFields.includes(key));
    if (unknown.length) {
        throw new Error(`Workspace Capability Provider availability contains unsupported field(s): ${unknown.join(', ')}`);
    }
    const code = value.code === null || typeof value.code === 'undefined' ? null : String(value.code);
    const message = value.message === null || typeof value.message === 'undefined' ? null : String(value.message);
    return freezeDeep({available: value.available, code, message});
};

const assertFacadeShape = (value, path = 'facade') => {
    if (!isPlainObject(value)) {
        throw new TypeError('Workspace Capability Provider facade must be a plain object.');
    }
    Object.entries(value).forEach(([key, item]) => {
        if (FORBIDDEN_FACADE_KEYS.has(key.toLowerCase())) {
            throw makeProviderError(
                'NGVGE_WORKSPACE_CAPABILITY_PROVIDER_RAW_AUTHORITY_FORBIDDEN',
                `${path} contains forbidden raw authority field: ${key}`
            );
        }
        if (typeof item === 'function' || item === null ||
            typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') return;
        if (Array.isArray(item)) {
            item.forEach((entry, index) => {
                if (isPlainObject(entry)) assertFacadeShape(entry, `${path}.${key}[${index}]`);
                else if (entry !== null && !['string', 'number', 'boolean'].includes(typeof entry)) {
                    throw new TypeError(`${path}.${key}[${index}] is not portable facade data.`);
                }
            });
            return;
        }
        if (isPlainObject(item)) {
            assertFacadeShape(item, `${path}.${key}`);
            return;
        }
        throw new TypeError(`${path}.${key} must be a function or portable plain data.`);
    });
};

const wrapFacade = (facade, assertActive) => {
    assertFacadeShape(facade);
    const wrapValue = value => {
        if (typeof value === 'function') {
            return (...args) => {
                assertActive();
                return value(...args);
            };
        }
        if (Array.isArray(value)) return Object.freeze(value.map(wrapValue));
        if (isPlainObject(value)) {
            return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, wrapValue(item)])));
        }
        return value;
    };
    return Object.freeze(Object.fromEntries(Object.entries(facade).map(([key, value]) => [key, wrapValue(value)])));
};

const makeSurfaceKey = (capabilityId, access) => `${capabilityId}#${access}`;

class WorkspaceCapabilityProviderRegistry {
    constructor ({capabilityHost}) {
        if (!capabilityHost || typeof capabilityHost.getCapability !== 'function' ||
            typeof capabilityHost.getToolDescriptor !== 'function') {
            throw new TypeError('Workspace Capability Provider Registry requires WorkspaceToolCapabilityHost.');
        }
        this.id = WORKSPACE_CAPABILITY_PROVIDER_REGISTRY_ID;
        this._capabilityHost = capabilityHost;
        this._providers = new Map();
        this._providerById = new Map();
        this._bindings = new Map();
        this._bindingSequence = 0;
        this._disposed = false;
    }

    _assertActive () {
        if (this._disposed) {
            throw makeProviderError(
                'NGVGE_WORKSPACE_CAPABILITY_PROVIDER_REGISTRY_DISPOSED',
                'Workspace Capability Provider Registry has been disposed.'
            );
        }
    }

    registerProvider ({descriptor, createFacade, getAvailability = () => true}) {
        this._assertActive();
        const normalized = normalizeProviderDescriptor(descriptor);
        if (typeof createFacade !== 'function') {
            throw new TypeError('Workspace Capability Provider requires createFacade().');
        }
        if (typeof getAvailability !== 'function') {
            throw new TypeError('Workspace Capability Provider getAvailability must be a function.');
        }
        const definition = this._capabilityHost.getCapability(normalized.capabilityId);
        if (!definition) {
            throw makeProviderError(
                'NGVGE_WORKSPACE_CAPABILITY_PROVIDER_UNKNOWN_CAPABILITY',
                `Workspace Capability Provider references unknown capability: ${normalized.capabilityId}`
            );
        }
        if (!definition.allowedAccess.includes(normalized.access)) {
            throw makeProviderError(
                'NGVGE_WORKSPACE_CAPABILITY_PROVIDER_ACCESS_MISMATCH',
                `Workspace Capability Provider access is not allowed by capability definition: ` +
                `${normalized.capabilityId}#${normalized.access}`
            );
        }
        const key = makeSurfaceKey(normalized.capabilityId, normalized.access);
        if (this._providers.has(key)) {
            throw makeProviderError(
                'NGVGE_WORKSPACE_CAPABILITY_PROVIDER_CONFLICT',
                `Workspace Capability surface already has a provider: ${key}`
            );
        }
        if (this._providerById.has(normalized.providerId)) {
            throw makeProviderError(
                'NGVGE_WORKSPACE_CAPABILITY_PROVIDER_ID_CONFLICT',
                `Workspace Capability providerId is already registered: ${normalized.providerId}`
            );
        }
        const state = {descriptor: normalized, createFacade, getAvailability};
        this._providers.set(key, state);
        this._providerById.set(normalized.providerId, state);
        return normalized;
    }

    getProvider (capabilityId, access) {
        const state = this._providers.get(makeSurfaceKey(capabilityId, access));
        return state ? state.descriptor : null;
    }

    getAvailability (capabilityId, access) {
        const state = this._providers.get(makeSurfaceKey(capabilityId, access));
        if (!state) {
            return freezeDeep({
                available: false,
                code: 'NGVGE_WORKSPACE_CAPABILITY_PROVIDER_MISSING',
                message: `No Workspace Capability Provider is registered for ${capabilityId}#${access}.`
            });
        }
        try {
            return normalizeAvailability(state.getAvailability());
        } catch (error) {
            return freezeDeep({
                available: false,
                code: 'NGVGE_WORKSPACE_CAPABILITY_PROVIDER_DIAGNOSTIC_FAILED',
                message: error && error.message ? error.message : 'Provider availability diagnostic failed.'
            });
        }
    }

    bind ({capabilityLease, capabilityId, access}) {
        this._assertActive();
        if (!capabilityLease || typeof capabilityLease.assert !== 'function' ||
            typeof capabilityLease.subscribeRevocation !== 'function') {
            throw new TypeError('Workspace Capability Provider binding requires a Tool Capability lease.');
        }
        const grant = capabilityLease.assert(capabilityId, access);
        const key = makeSurfaceKey(capabilityId, access);
        const providerState = this._providers.get(key);
        if (!providerState) {
            throw makeProviderError(
                'NGVGE_WORKSPACE_CAPABILITY_PROVIDER_MISSING',
                `No Workspace Capability Provider is registered for ${key}.`
            );
        }
        const availability = this.getAvailability(capabilityId, access);
        if (!availability.available) {
            throw makeProviderError(
                availability.code || 'NGVGE_WORKSPACE_CAPABILITY_PROVIDER_UNAVAILABLE',
                availability.message || `Workspace Capability Provider is unavailable: ${key}`
            );
        }

        const bindingId = `ngvge.workspace-capability-provider-binding.${++this._bindingSequence}`;
        const state = {
            active: true,
            bindingId,
            capabilityId,
            access,
            providerId: providerState.descriptor.providerId,
            toolId: capabilityLease.toolId,
            revokeReason: null,
            unsubscribeLeaseRevocation: null
        };
        const assertActive = () => {
            if (!state.active) {
                throw makeProviderError(
                    'NGVGE_WORKSPACE_CAPABILITY_PROVIDER_BINDING_REVOKED',
                    `Workspace Capability Provider binding has been revoked: ${bindingId}`
                );
            }
            capabilityLease.assert(capabilityId, access);
            const currentAvailability = this.getAvailability(capabilityId, access);
            if (!currentAvailability.available) {
                throw makeProviderError(
                    currentAvailability.code || 'NGVGE_WORKSPACE_CAPABILITY_PROVIDER_UNAVAILABLE',
                    currentAvailability.message || `Workspace Capability Provider is unavailable: ${key}`
                );
            }
        };
        let facade;
        try {
            const rawFacade = providerState.createFacade(Object.freeze({
                access,
                capability: grant,
                capabilityLease,
                providerId: providerState.descriptor.providerId,
                toolId: capabilityLease.toolId
            }));
            facade = wrapFacade(rawFacade, assertActive);
        } catch (error) {
            throw error;
        }

        const release = (reason = 'consumer-released') => this.revokeBinding(bindingId, reason);
        state.unsubscribeLeaseRevocation = capabilityLease.subscribeRevocation(event => {
            this.revokeBinding(bindingId, event && event.reason ? `capability-lease:${event.reason}` : 'capability-lease-revoked');
        });
        this._bindings.set(bindingId, state);

        return Object.freeze({
            schemaVersion: WORKSPACE_CAPABILITY_PROVIDER_BINDING_SCHEMA_VERSION,
            id: bindingId,
            registryId: this.id,
            providerId: state.providerId,
            toolId: state.toolId,
            capabilityId,
            access,
            facade,
            isActive: () => state.active && capabilityLease.isActive(),
            getAvailability: () => this.getAvailability(capabilityId, access),
            getRevokeReason: () => state.revokeReason,
            release
        });
    }

    revokeBinding (bindingId, reason = 'provider-binding-revoked') {
        const state = this._bindings.get(bindingId);
        if (!state || !state.active) return false;
        state.active = false;
        state.revokeReason = typeof reason === 'string' && reason.trim() ? reason.trim() : 'provider-binding-revoked';
        if (state.unsubscribeLeaseRevocation) {
            const unsubscribe = state.unsubscribeLeaseRevocation;
            state.unsubscribeLeaseRevocation = null;
            unsubscribe();
        }
        return true;
    }

    unregisterProvider (providerId, reason = 'provider-unregistered') {
        const state = this._providerById.get(providerId);
        if (!state) return false;
        const descriptor = state.descriptor;
        this._providerById.delete(providerId);
        this._providers.delete(makeSurfaceKey(descriptor.capabilityId, descriptor.access));
        this._bindings.forEach((binding, bindingId) => {
            if (binding.providerId === providerId && binding.active) this.revokeBinding(bindingId, reason);
        });
        return true;
    }

    diagnoseTool (toolId) {
        const descriptor = this._capabilityHost.getToolDescriptor(toolId);
        if (!descriptor) {
            return freezeDeep({
                registryId: this.id,
                toolId,
                descriptorRegistered: false,
                requests: []
            });
        }
        const requests = descriptor.requests.map(request => {
            const provider = this.getProvider(request.capabilityId, request.access);
            const availability = this.getAvailability(request.capabilityId, request.access);
            const state = !provider ? WORKSPACE_CAPABILITY_PROVIDER_STATES.PROVIDER_MISSING :
                availability.available ? WORKSPACE_CAPABILITY_PROVIDER_STATES.READY :
                    WORKSPACE_CAPABILITY_PROVIDER_STATES.PROVIDER_UNAVAILABLE;
            const bindingCount = Array.from(this._bindings.values()).filter(binding => (
                binding.active && binding.toolId === toolId && binding.capabilityId === request.capabilityId &&
                binding.access === request.access
            )).length;
            return {
                capabilityId: request.capabilityId,
                access: request.access,
                required: request.required,
                state,
                providerId: provider ? provider.providerId : null,
                diagnosticCode: availability.code,
                diagnosticMessage: availability.message,
                bindingCount
            };
        });
        return freezeDeep({registryId: this.id, toolId, descriptorRegistered: true, requests});
    }

    getCoverageDiagnostics () {
        const capabilities = typeof this._capabilityHost.listCapabilities === 'function' ?
            this._capabilityHost.listCapabilities() : [];
        const surfaces = [];
        capabilities.forEach(definition => {
            definition.allowedAccess.forEach(access => {
                const provider = this.getProvider(definition.capabilityId, access);
                const availability = this.getAvailability(definition.capabilityId, access);
                surfaces.push({
                    capabilityId: definition.capabilityId,
                    access,
                    scope: definition.scope,
                    privilege: definition.privilege,
                    state: !provider ? WORKSPACE_CAPABILITY_PROVIDER_STATES.PROVIDER_MISSING :
                        availability.available ? WORKSPACE_CAPABILITY_PROVIDER_STATES.READY :
                            WORKSPACE_CAPABILITY_PROVIDER_STATES.PROVIDER_UNAVAILABLE,
                    providerId: provider ? provider.providerId : null,
                    diagnosticCode: availability.code,
                    diagnosticMessage: availability.message
                });
            });
        });
        return freezeDeep({registryId: this.id, surfaces});
    }

    dispose () {
        if (this._disposed) return false;
        this._disposed = true;
        this._bindings.forEach((state, bindingId) => {
            if (state.active) this.revokeBinding(bindingId, 'provider-registry-disposed');
        });
        this._providers.clear();
        this._providerById.clear();
        return true;
    }
}

export {
    WORKSPACE_CAPABILITY_PROVIDER_REGISTRY_ID,
    WORKSPACE_CAPABILITY_PROVIDER_DESCRIPTOR_SCHEMA_VERSION,
    WORKSPACE_CAPABILITY_PROVIDER_BINDING_SCHEMA_VERSION,
    WORKSPACE_CAPABILITY_PROVIDER_STATES,
    normalizeProviderDescriptor,
    WorkspaceCapabilityProviderRegistry
};
