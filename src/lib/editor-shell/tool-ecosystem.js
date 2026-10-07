const WORKSPACE_TOOL_ECOSYSTEM_REGISTRY_ID = 'ngvge.workspace-tool-ecosystem-registry@1';
const TOOL_ECOSYSTEM_MANIFEST_SCHEMA_VERSION = 1;

const TOOL_ECOSYSTEM_LIFECYCLE = Object.freeze({
    ACTIVE: 'active',
    PLANNED: 'planned',
    RETIRED: 'retired'
});

const TOOL_ECOSYSTEM_ORIGINS = Object.freeze({
    FIRST_PARTY: 'first-party',
    EXTENSION: 'extension',
    OSS_WRAPPED: 'oss-wrapped'
});

const TOOL_ECOSYSTEM_PERSISTENCE_SCOPES = Object.freeze({
    WORKSPACE: 'workspace',
    USER: 'user',
    DEVICE: 'device',
    SESSION: 'session'
});

const TOOL_ECOSYSTEM_SERVICES = Object.freeze({
    WINDOW_MANAGER: 'workspace.window-manager',
    CONTEXT: 'workspace.context',
    TOOL_PERSISTENCE: 'workspace.tool-persistence',
    PROJECT_LIFECYCLE: 'project.lifecycle',
    NODE_COMMAND: 'workspace.node-command',
    RESOURCE_MANAGER: 'runtime.resource-manager',
    EXTENSION_HOST: 'extension.host',
    AGENT_TRANSACTION: 'agent.transaction'
});

const TOOL_ECOSYSTEM_AUTHORITIES = Object.freeze({
    NONE: 'none',
    WORKSPACE_ONLY: 'workspace-only',
    PROJECT_READ: 'project-read',
    PROJECT_COMMAND: 'project-command',
    RESOURCE_COMMAND: 'resource-command'
});

const OSS_INTAKE_STATUS = Object.freeze({
    NOT_APPLICABLE: 'not-applicable',
    REQUIRED: 'required',
    APPROVED: 'approved'
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
        throw new TypeError('Tool ecosystem manifest requires a stable ngvge.tool.* ToolId.');
    }
    return toolId;
};

const normalizeStringArray = (value, allowedValues, label) => {
    if (!Array.isArray(value)) throw new TypeError(`${label} must be an array.`);
    const seen = new Set();
    return value.map(item => {
        if (!allowedValues.includes(item)) throw new TypeError(`${label} contains unsupported value: ${item}`);
        if (seen.has(item)) throw new Error(`${label} contains duplicate value: ${item}`);
        seen.add(item);
        return item;
    });
};

const normalizeOssIntake = (value, origin, lifecycle) => {
    const source = isPlainObject(value) ? value : {};
    const allowed = ['status', 'adrId', 'backendSelection'];
    const unknown = Object.keys(source).filter(key => !allowed.includes(key));
    if (unknown.length) {
        throw new Error(`Tool ecosystem ossIntake contains unsupported field(s): ${unknown.join(', ')}`);
    }
    const defaultStatus = origin === TOOL_ECOSYSTEM_ORIGINS.OSS_WRAPPED ?
        OSS_INTAKE_STATUS.REQUIRED : OSS_INTAKE_STATUS.NOT_APPLICABLE;
    const status = source.status || defaultStatus;
    if (!Object.values(OSS_INTAKE_STATUS).includes(status)) {
        throw new TypeError(`Unsupported OSS intake status: ${status}`);
    }
    const adrId = typeof source.adrId === 'string' && source.adrId.trim() ? source.adrId.trim() : null;
    const backendSelection = typeof source.backendSelection === 'string' && source.backendSelection.trim() ?
        source.backendSelection.trim() : null;
    if (origin !== TOOL_ECOSYSTEM_ORIGINS.OSS_WRAPPED && status !== OSS_INTAKE_STATUS.NOT_APPLICABLE) {
        throw new Error('Non-OSS Tool ecosystem manifests cannot claim an OSS intake lifecycle.');
    }
    if (origin === TOOL_ECOSYSTEM_ORIGINS.OSS_WRAPPED && lifecycle === TOOL_ECOSYSTEM_LIFECYCLE.ACTIVE) {
        if (status !== OSS_INTAKE_STATUS.APPROVED || !adrId) {
            throw new Error('Active OSS-wrapped tools require approved OSS Intake ADR identity.');
        }
    }
    if (status === OSS_INTAKE_STATUS.APPROVED && !adrId) {
        throw new Error('Approved OSS intake requires adrId.');
    }
    return freezeDeep({status, adrId, backendSelection});
};

const normalizeToolEcosystemManifest = manifest => {
    if (!isPlainObject(manifest)) throw new TypeError('Tool ecosystem manifest must be a plain object.');
    const allowed = [
        'schemaVersion', 'toolId', 'title', 'lifecycle', 'origin', 'requiredServices',
        'persistenceScopes', 'authority', 'ossIntake', 'notes'
    ];
    const unknown = Object.keys(manifest).filter(key => !allowed.includes(key));
    if (unknown.length) throw new Error(`Tool ecosystem manifest contains unsupported field(s): ${unknown.join(', ')}`);
    if (manifest.schemaVersion !== TOOL_ECOSYSTEM_MANIFEST_SCHEMA_VERSION) {
        throw new TypeError(
            `Tool ecosystem manifest schemaVersion must be ${TOOL_ECOSYSTEM_MANIFEST_SCHEMA_VERSION}.`
        );
    }
    const toolId = assertStableToolId(manifest.toolId);
    if (typeof manifest.title !== 'string' || !manifest.title.trim()) {
        throw new TypeError('Tool ecosystem manifest title must be non-empty.');
    }
    if (!Object.values(TOOL_ECOSYSTEM_LIFECYCLE).includes(manifest.lifecycle)) {
        throw new TypeError(`Unsupported Tool ecosystem lifecycle: ${manifest.lifecycle}`);
    }
    if (!Object.values(TOOL_ECOSYSTEM_ORIGINS).includes(manifest.origin)) {
        throw new TypeError(`Unsupported Tool ecosystem origin: ${manifest.origin}`);
    }
    if (!Object.values(TOOL_ECOSYSTEM_AUTHORITIES).includes(manifest.authority)) {
        throw new TypeError(`Unsupported Tool ecosystem authority declaration: ${manifest.authority}`);
    }
    const requiredServices = normalizeStringArray(
        manifest.requiredServices || [],
        Object.values(TOOL_ECOSYSTEM_SERVICES),
        'Tool ecosystem requiredServices'
    );
    const persistenceScopes = normalizeStringArray(
        manifest.persistenceScopes || [],
        Object.values(TOOL_ECOSYSTEM_PERSISTENCE_SCOPES),
        'Tool ecosystem persistenceScopes'
    );
    const ossIntake = normalizeOssIntake(manifest.ossIntake, manifest.origin, manifest.lifecycle);
    if (Object.prototype.hasOwnProperty.call(manifest, 'notes') &&
        (typeof manifest.notes !== 'string' || !manifest.notes.trim())) {
        throw new TypeError('Tool ecosystem manifest notes must be a non-empty string when provided.');
    }
    return freezeDeep({
        schemaVersion: TOOL_ECOSYSTEM_MANIFEST_SCHEMA_VERSION,
        toolId,
        title: manifest.title.trim(),
        lifecycle: manifest.lifecycle,
        origin: manifest.origin,
        requiredServices,
        persistenceScopes,
        authority: manifest.authority,
        ossIntake,
        notes: manifest.notes ? manifest.notes.trim() : null
    });
};

class ToolEcosystemRegistry {
    constructor ({toolRegistry, manifests = []}) {
        if (!toolRegistry || typeof toolRegistry.has !== 'function') {
            throw new TypeError('Tool Ecosystem Registry requires ToolRegistry.');
        }
        this.id = WORKSPACE_TOOL_ECOSYSTEM_REGISTRY_ID;
        this._toolRegistry = toolRegistry;
        this._manifests = new Map();
        manifests.forEach(manifest => this.register(manifest));
    }

    register (manifest) {
        const normalized = normalizeToolEcosystemManifest(manifest);
        if (this._manifests.has(normalized.toolId)) {
            throw new Error(`Tool ecosystem manifest already registered: ${normalized.toolId}`);
        }
        if (normalized.lifecycle === TOOL_ECOSYSTEM_LIFECYCLE.ACTIVE && !this._toolRegistry.has(normalized.toolId)) {
            throw new Error(`Active Tool ecosystem manifest requires ToolRegistry definition: ${normalized.toolId}`);
        }
        if (normalized.lifecycle !== TOOL_ECOSYSTEM_LIFECYCLE.ACTIVE && this._toolRegistry.has(normalized.toolId)) {
            throw new Error(`Non-active Tool ecosystem manifest cannot leak into ToolRegistry: ${normalized.toolId}`);
        }
        this._manifests.set(normalized.toolId, normalized);
        return normalized;
    }

    get (toolId) {
        return this._manifests.get(toolId) || null;
    }

    require (toolId) {
        const manifest = this.get(toolId);
        if (!manifest) throw new Error(`Tool ecosystem manifest is not registered: ${toolId}`);
        return manifest;
    }

    list () {
        return Object.freeze(Array.from(this._manifests.values()));
    }

    listActive () {
        return Object.freeze(this.list().filter(manifest => manifest.lifecycle === TOOL_ECOSYSTEM_LIFECYCLE.ACTIVE));
    }

    listPlanned () {
        return Object.freeze(this.list().filter(manifest => manifest.lifecycle === TOOL_ECOSYSTEM_LIFECYCLE.PLANNED));
    }
}

export {
    WORKSPACE_TOOL_ECOSYSTEM_REGISTRY_ID,
    TOOL_ECOSYSTEM_MANIFEST_SCHEMA_VERSION,
    TOOL_ECOSYSTEM_LIFECYCLE,
    TOOL_ECOSYSTEM_ORIGINS,
    TOOL_ECOSYSTEM_PERSISTENCE_SCOPES,
    TOOL_ECOSYSTEM_SERVICES,
    TOOL_ECOSYSTEM_AUTHORITIES,
    OSS_INTAKE_STATUS,
    normalizeToolEcosystemManifest,
    ToolEcosystemRegistry
};
