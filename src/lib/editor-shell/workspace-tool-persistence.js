const WORKSPACE_TOOL_PERSISTENCE_SERVICE_ID = 'ngvge.workspace-tool-persistence@1';
const WORKSPACE_TOOL_STATE_SCHEMA_VERSION = 1;
const WORKSPACE_TOOL_STATE_STORAGE_KEY = 'ngvge:workspace:tool-state:v1';
const MAX_TOOL_STATE_BYTES = 64 * 1024;

const FORBIDDEN_KEYS = new Set([
    'apikey', 'api-key', 'api_key', 'password', 'secret', 'token', 'credential',
    'vm', 'rawvm', 'renderer', 'target', 'targetid', 'scratchtargetid', 'editingtargetid',
    'runtimeid', 'backendid'
]);

const isPlainObject = value => (
    value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
);

const assertStableToolId = toolId => {
    if (typeof toolId !== 'string' || !/^ngvge\.tool\.[a-z0-9][a-z0-9.-]*$/.test(toolId)) {
        throw new TypeError('Workspace Tool Persistence requires stable ngvge.tool.* ToolId.');
    }
    return toolId;
};

const assertPortableState = (value, path = 'state') => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new TypeError(`${path} contains non-finite number.`);
        return;
    }
    if (Array.isArray(value)) {
        value.forEach((item, index) => assertPortableState(item, `${path}[${index}]`));
        return;
    }
    if (!isPlainObject(value)) throw new TypeError(`${path} must contain JSON-portable plain data only.`);
    Object.entries(value).forEach(([key, item]) => {
        const normalizedKey = key.toLowerCase();
        if (FORBIDDEN_KEYS.has(normalizedKey)) {
            throw new Error(`${path} contains forbidden persistence field: ${key}`);
        }
        assertPortableState(item, `${path}.${key}`);
    });
};

const clonePortable = value => JSON.parse(JSON.stringify(value));
const getUtf8ByteLength = value => {
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(value).length;
    return unescape(encodeURIComponent(value)).length;
};

class WorkspaceToolPersistenceService {
    constructor ({storage = null} = {}) {
        this.id = WORKSPACE_TOOL_PERSISTENCE_SERVICE_ID;
        this.scope = 'workspace';
        this._storage = storage;
        this._memory = {schemaVersion: WORKSPACE_TOOL_STATE_SCHEMA_VERSION, tools: {}};
        this._load();
    }

    _load () {
        if (!this._storage || typeof this._storage.getItem !== 'function') return;
        try {
            const raw = this._storage.getItem(WORKSPACE_TOOL_STATE_STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (!isPlainObject(parsed) || parsed.schemaVersion !== WORKSPACE_TOOL_STATE_SCHEMA_VERSION ||
                !isPlainObject(parsed.tools)) return;
            const next = {};
            Object.entries(parsed.tools).forEach(([toolId, state]) => {
                assertStableToolId(toolId);
                assertPortableState(state, `tools.${toolId}`);
                next[toolId] = clonePortable(state);
            });
            this._memory = {schemaVersion: WORKSPACE_TOOL_STATE_SCHEMA_VERSION, tools: next};
        } catch (error) {
            this._memory = {schemaVersion: WORKSPACE_TOOL_STATE_SCHEMA_VERSION, tools: {}};
        }
    }

    _flush () {
        if (!this._storage || typeof this._storage.setItem !== 'function') return true;
        try {
            const serialized = JSON.stringify(this._memory);
            this._storage.setItem(WORKSPACE_TOOL_STATE_STORAGE_KEY, serialized);
            return true;
        } catch (error) {
            return false;
        }
    }

    getState (toolId, fallback = null) {
        assertStableToolId(toolId);
        if (!Object.prototype.hasOwnProperty.call(this._memory.tools, toolId)) return fallback;
        return clonePortable(this._memory.tools[toolId]);
    }

    setState (toolId, state) {
        assertStableToolId(toolId);
        assertPortableState(state, `tools.${toolId}`);
        const serialized = JSON.stringify(state);
        if (getUtf8ByteLength(serialized) > MAX_TOOL_STATE_BYTES) {
            throw new Error(`Workspace Tool state exceeds ${MAX_TOOL_STATE_BYTES} bytes for ${toolId}.`);
        }
        this._memory.tools[toolId] = clonePortable(state);
        this._flush();
        return this.getState(toolId);
    }

    removeState (toolId) {
        assertStableToolId(toolId);
        if (!Object.prototype.hasOwnProperty.call(this._memory.tools, toolId)) return false;
        delete this._memory.tools[toolId];
        this._flush();
        return true;
    }

    getSnapshot () {
        return clonePortable(this._memory);
    }
}

const createWorkspaceToolPersistenceService = () => new WorkspaceToolPersistenceService({
    storage: typeof window !== 'undefined' && window.localStorage ? window.localStorage : null
});

export {
    WORKSPACE_TOOL_PERSISTENCE_SERVICE_ID,
    WORKSPACE_TOOL_STATE_SCHEMA_VERSION,
    WORKSPACE_TOOL_STATE_STORAGE_KEY,
    MAX_TOOL_STATE_BYTES,
    WorkspaceToolPersistenceService,
    createWorkspaceToolPersistenceService
};
