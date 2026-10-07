const WORKSPACE_TOOL_CAPABILITY_HOST_ID = 'ngvge.workspace-tool-capability-host@1';
const TOOL_CAPABILITY_DESCRIPTOR_SCHEMA_VERSION = 1;
const TOOL_CAPABILITY_GRANT_SCHEMA_VERSION = 1;

const TOOL_CAPABILITY_ACCESS = Object.freeze({
    OBSERVE: 'observe',
    QUERY: 'query',
    PROPOSE: 'propose',
    MUTATE: 'mutate'
});

const TOOL_CAPABILITY_SCOPES = Object.freeze({
    WORKSPACE: 'workspace',
    PROJECT: 'project',
    RESOURCE: 'resource'
});

const TOOL_CAPABILITY_PRIVILEGES = Object.freeze({
    STANDARD: 'standard',
    SENSITIVE: 'sensitive'
});

const WORKSPACE_TOOL_CAPABILITIES = Object.freeze({
    WORKSPACE_STATE: 'ngvge.workspace-capability.workspace-state',
    CONTEXT_READ: 'ngvge.workspace-capability.context-read',
    PROJECT_READ: 'ngvge.workspace-capability.project-read',
    PROJECT_COMMAND: 'ngvge.workspace-capability.project-command',
    RESOURCE_READ: 'ngvge.workspace-capability.resource-read',
    RESOURCE_CONTENT_READ: 'ngvge.workspace-capability.resource-content-read',
    RESOURCE_COMMAND: 'ngvge.workspace-capability.resource-command'
});

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

const assertStableToolId = toolId => {
    if (typeof toolId !== 'string' || !/^ngvge\.tool\.[a-z0-9][a-z0-9.-]*$/.test(toolId)) {
        throw new TypeError('Tool Capability Descriptor requires a stable ngvge.tool.* ToolId.');
    }
    return toolId;
};

const assertStableCapabilityId = capabilityId => {
    if (typeof capabilityId !== 'string' ||
        !/^ngvge\.workspace-capability\.[a-z0-9][a-z0-9.-]*$/.test(capabilityId)) {
        throw new TypeError(
            'Workspace Tool Capability requires a stable ngvge.workspace-capability.* capabilityId.'
        );
    }
    return capabilityId;
};

const normalizeAllowedAccess = value => {
    if (!Array.isArray(value) || value.length === 0) {
        throw new TypeError('Tool Capability Definition allowedAccess must be a non-empty array.');
    }
    const allowed = Object.values(TOOL_CAPABILITY_ACCESS);
    const seen = new Set();
    return value.map(access => {
        if (!allowed.includes(access)) {
            throw new TypeError(`Unsupported Tool Capability access: ${access}`);
        }
        if (seen.has(access)) {
            throw new Error(`Tool Capability Definition contains duplicate access: ${access}`);
        }
        seen.add(access);
        return access;
    });
};

const normalizeAllowedAuthorities = value => {
    if (!Array.isArray(value) || value.length === 0) {
        throw new TypeError('Tool Capability Definition allowedAuthorities must be a non-empty array.');
    }
    const seen = new Set();
    return value.map(authority => {
        if (typeof authority !== 'string' || !authority.trim()) {
            throw new TypeError('Tool Capability Definition authority must be a non-empty string.');
        }
        const normalized = authority.trim();
        if (seen.has(normalized)) {
            throw new Error(`Tool Capability Definition contains duplicate authority: ${normalized}`);
        }
        seen.add(normalized);
        return normalized;
    });
};

const normalizeToolCapabilityDefinition = definition => {
    if (!isPlainObject(definition)) {
        throw new TypeError('Tool Capability Definition must be a plain object.');
    }
    const allowedFields = [
        'capabilityId', 'scope', 'allowedAccess', 'privilege', 'allowedAuthorities', 'description'
    ];
    const unknown = Object.keys(definition).filter(key => !allowedFields.includes(key));
    if (unknown.length) {
        throw new Error(`Tool Capability Definition contains unsupported field(s): ${unknown.join(', ')}`);
    }
    const capabilityId = assertStableCapabilityId(definition.capabilityId);
    if (!Object.values(TOOL_CAPABILITY_SCOPES).includes(definition.scope)) {
        throw new TypeError(`Unsupported Tool Capability scope: ${definition.scope}`);
    }
    if (!Object.values(TOOL_CAPABILITY_PRIVILEGES).includes(definition.privilege)) {
        throw new TypeError(`Unsupported Tool Capability privilege: ${definition.privilege}`);
    }
    if (typeof definition.description !== 'string' || !definition.description.trim()) {
        throw new TypeError('Tool Capability Definition description must be non-empty.');
    }
    return freezeDeep({
        capabilityId,
        scope: definition.scope,
        allowedAccess: normalizeAllowedAccess(definition.allowedAccess),
        privilege: definition.privilege,
        allowedAuthorities: normalizeAllowedAuthorities(definition.allowedAuthorities),
        description: definition.description.trim()
    });
};

const normalizeToolCapabilityRequest = request => {
    if (!isPlainObject(request)) {
        throw new TypeError('Tool Capability request must be a plain object.');
    }
    const allowedFields = ['capabilityId', 'access', 'required'];
    const unknown = Object.keys(request).filter(key => !allowedFields.includes(key));
    if (unknown.length) {
        throw new Error(`Tool Capability request contains unsupported field(s): ${unknown.join(', ')}`);
    }
    const capabilityId = assertStableCapabilityId(request.capabilityId);
    if (!Object.values(TOOL_CAPABILITY_ACCESS).includes(request.access)) {
        throw new TypeError(`Unsupported Tool Capability request access: ${request.access}`);
    }
    if (typeof request.required !== 'boolean') {
        throw new TypeError('Tool Capability request required must be boolean.');
    }
    return freezeDeep({capabilityId, access: request.access, required: request.required});
};

const normalizeToolCapabilityDescriptor = descriptor => {
    if (!isPlainObject(descriptor)) {
        throw new TypeError('Tool Capability Descriptor must be a plain object.');
    }
    const allowedFields = ['schemaVersion', 'toolId', 'requests'];
    const unknown = Object.keys(descriptor).filter(key => !allowedFields.includes(key));
    if (unknown.length) {
        throw new Error(`Tool Capability Descriptor contains unsupported field(s): ${unknown.join(', ')}`);
    }
    if (descriptor.schemaVersion !== TOOL_CAPABILITY_DESCRIPTOR_SCHEMA_VERSION) {
        throw new TypeError(
            `Tool Capability Descriptor schemaVersion must be ${TOOL_CAPABILITY_DESCRIPTOR_SCHEMA_VERSION}.`
        );
    }
    const toolId = assertStableToolId(descriptor.toolId);
    if (!Array.isArray(descriptor.requests)) {
        throw new TypeError('Tool Capability Descriptor requests must be an array.');
    }
    const seen = new Set();
    const requests = descriptor.requests.map(request => {
        const normalized = normalizeToolCapabilityRequest(request);
        const surface = `${normalized.capabilityId}#${normalized.access}`;
        if (seen.has(surface)) {
            throw new Error(`Tool Capability Descriptor contains duplicate capability surface: ${surface}`);
        }
        seen.add(surface);
        return normalized;
    });
    return freezeDeep({
        schemaVersion: TOOL_CAPABILITY_DESCRIPTOR_SCHEMA_VERSION,
        toolId,
        requests
    });
};

const makeAdmissionError = (code, message) => {
    const error = new Error(message);
    error.code = code;
    return error;
};

class WorkspaceToolCapabilityHost {
    constructor ({toolRegistry, ecosystemRegistry, definitions = [], descriptors = []}) {
        if (!toolRegistry || typeof toolRegistry.has !== 'function') {
            throw new TypeError('Workspace Tool Capability Host requires ToolRegistry.');
        }
        if (!ecosystemRegistry || typeof ecosystemRegistry.require !== 'function') {
            throw new TypeError('Workspace Tool Capability Host requires ToolEcosystemRegistry.');
        }
        this.id = WORKSPACE_TOOL_CAPABILITY_HOST_ID;
        this._toolRegistry = toolRegistry;
        this._ecosystemRegistry = ecosystemRegistry;
        this._definitions = new Map();
        this._descriptors = new Map();
        this._leases = new Map();
        this._leaseSequence = 0;
        this._disposed = false;
        this._unsubscribeToolRegistry = typeof toolRegistry.subscribe === 'function' ? toolRegistry.subscribe(event => {
            if (!event || event.type !== 'tool:unregistered') return;
            this.revokeTool(event.toolId, 'tool-unregistered');
        }) : null;
        definitions.forEach(definition => this.registerCapability(definition));
        descriptors.forEach(descriptor => this.registerToolDescriptor(descriptor));
    }

    _assertActive () {
        if (this._disposed) {
            throw makeAdmissionError(
                'NGVGE_TOOL_CAPABILITY_HOST_DISPOSED',
                'Workspace Tool Capability Host has been disposed.'
            );
        }
    }

    registerCapability (definition) {
        this._assertActive();
        const normalized = normalizeToolCapabilityDefinition(definition);
        if (this._definitions.has(normalized.capabilityId)) {
            throw new Error(`Workspace Tool Capability already registered: ${normalized.capabilityId}`);
        }
        this._definitions.set(normalized.capabilityId, normalized);
        return normalized;
    }

    registerToolDescriptor (descriptor) {
        this._assertActive();
        const normalized = normalizeToolCapabilityDescriptor(descriptor);
        if (this._descriptors.has(normalized.toolId)) {
            throw new Error(`Tool Capability Descriptor already registered: ${normalized.toolId}`);
        }
        const ecosystemManifest = this._ecosystemRegistry.require(normalized.toolId);
        normalized.requests.forEach(request => {
            const definition = this._definitions.get(request.capabilityId);
            if (!definition) {
                throw makeAdmissionError(
                    'NGVGE_TOOL_CAPABILITY_UNREGISTERED',
                    `Tool Capability is not registered: ${request.capabilityId}`
                );
            }
            if (!definition.allowedAccess.includes(request.access)) {
                throw makeAdmissionError(
                    'NGVGE_TOOL_CAPABILITY_ACCESS_DENIED',
                    `Tool Capability access is not permitted: ${request.capabilityId}#${request.access}`
                );
            }
            if (!definition.allowedAuthorities.includes(ecosystemManifest.authority)) {
                throw makeAdmissionError(
                    'NGVGE_TOOL_CAPABILITY_AUTHORITY_DENIED',
                    `Tool authority ${ecosystemManifest.authority} cannot request ${request.capabilityId}.`
                );
            }
        });
        this._descriptors.set(normalized.toolId, normalized);
        return normalized;
    }

    getCapability (capabilityId) {
        return this._definitions.get(capabilityId) || null;
    }

    listCapabilities () {
        return Object.freeze(Array.from(this._definitions.values()));
    }

    getToolDescriptor (toolId) {
        return this._descriptors.get(toolId) || null;
    }

    requireToolDescriptor (toolId) {
        const descriptor = this.getToolDescriptor(toolId);
        if (!descriptor) {
            throw makeAdmissionError(
                'NGVGE_TOOL_CAPABILITY_DESCRIPTOR_REQUIRED',
                `Tool Capability Descriptor is not registered: ${toolId}`
            );
        }
        return descriptor;
    }

    admit (toolId) {
        this._assertActive();
        const manifest = this._ecosystemRegistry.require(toolId);
        if (manifest.lifecycle !== 'active') {
            throw makeAdmissionError(
                'NGVGE_TOOL_CAPABILITY_TOOL_NOT_ACTIVE',
                `Only active ecosystem tools may receive capability admission: ${toolId}`
            );
        }
        if (!this._toolRegistry.has(toolId)) {
            throw makeAdmissionError(
                'NGVGE_TOOL_CAPABILITY_TOOL_NOT_REGISTERED',
                `Capability admission requires active ToolRegistry identity: ${toolId}`
            );
        }
        const descriptor = this.requireToolDescriptor(toolId);
        const grantedCapabilities = descriptor.requests.map(request => {
            const definition = this._definitions.get(request.capabilityId);
            if (!definition) {
                throw makeAdmissionError(
                    'NGVGE_TOOL_CAPABILITY_UNREGISTERED',
                    `Tool Capability is no longer registered: ${request.capabilityId}`
                );
            }
            return freezeDeep({
                capabilityId: definition.capabilityId,
                access: request.access,
                required: request.required,
                scope: definition.scope,
                privilege: definition.privilege
            });
        });
        const leaseId = `ngvge.workspace-tool-capability-lease.${++this._leaseSequence}`;
        const grant = freezeDeep({
            schemaVersion: TOOL_CAPABILITY_GRANT_SCHEMA_VERSION,
            hostId: this.id,
            leaseId,
            toolId,
            capabilities: grantedCapabilities
        });
        const state = {active: true, revokeReason: null, grant, revocationListeners: new Set()};
        this._leases.set(leaseId, state);

        const assertActive = () => {
            if (!state.active) {
                throw makeAdmissionError(
                    'NGVGE_TOOL_CAPABILITY_LEASE_REVOKED',
                    `Tool Capability lease has been revoked: ${leaseId}`
                );
            }
        };
        const has = (capabilityId, access = null) => {
            assertActive();
            return grant.capabilities.some(item => (
                item.capabilityId === capabilityId && (access === null || item.access === access)
            ));
        };
        const assertCapability = (capabilityId, access = null) => {
            assertActive();
            if (!has(capabilityId, access)) {
                throw makeAdmissionError(
                    'NGVGE_TOOL_CAPABILITY_UNDECLARED',
                    `Tool Capability was not declared for ${toolId}: ${capabilityId}${access ? `#${access}` : ''}`
                );
            }
            return grant.capabilities.find(item => (
                item.capabilityId === capabilityId && (access === null || item.access === access)
            ));
        };
        const subscribeRevocation = listener => {
            if (typeof listener !== 'function') {
                throw new TypeError('Tool Capability revocation listener must be a function.');
            }
            if (!state.active) {
                listener(Object.freeze({
                    leaseId,
                    toolId,
                    reason: state.revokeReason || 'host-revoked'
                }));
                return () => false;
            }
            state.revocationListeners.add(listener);
            return () => state.revocationListeners.delete(listener);
        };

        return Object.freeze({
            id: leaseId,
            hostId: this.id,
            toolId,
            grant,
            isActive: () => state.active,
            getRevokeReason: () => state.revokeReason,
            has,
            assert: assertCapability,
            subscribeRevocation,
            release: reason => this.revoke(leaseId, reason || 'consumer-released')
        });
    }

    revoke (leaseId, reason = 'host-revoked') {
        const state = this._leases.get(leaseId);
        if (!state) return false;
        if (!state.active) return false;
        state.active = false;
        state.revokeReason = typeof reason === 'string' && reason.trim() ? reason.trim() : 'host-revoked';
        const event = Object.freeze({
            leaseId,
            toolId: state.grant.toolId,
            reason: state.revokeReason
        });
        state.revocationListeners.forEach(listener => listener(event));
        state.revocationListeners.clear();
        return true;
    }

    revokeTool (toolId, reason = 'tool-revoked') {
        let count = 0;
        this._leases.forEach((state, leaseId) => {
            if (state.grant.toolId === toolId && this.revoke(leaseId, reason)) count++;
        });
        return count;
    }

    dispose () {
        if (this._disposed) return false;
        this._disposed = true;
        if (this._unsubscribeToolRegistry) {
            this._unsubscribeToolRegistry();
            this._unsubscribeToolRegistry = null;
        }
        this._leases.forEach((state, leaseId) => {
            if (state.active) this.revoke(leaseId, 'host-disposed');
        });
        return true;
    }
}

export {
    WORKSPACE_TOOL_CAPABILITY_HOST_ID,
    TOOL_CAPABILITY_DESCRIPTOR_SCHEMA_VERSION,
    TOOL_CAPABILITY_GRANT_SCHEMA_VERSION,
    TOOL_CAPABILITY_ACCESS,
    TOOL_CAPABILITY_SCOPES,
    TOOL_CAPABILITY_PRIVILEGES,
    WORKSPACE_TOOL_CAPABILITIES,
    normalizeToolCapabilityDefinition,
    normalizeToolCapabilityDescriptor,
    WorkspaceToolCapabilityHost
};
