import {WORKSPACE_TOOL_REGISTRY_ID} from './tool-registry';
import {WORKSPACE_WINDOW_MANAGER_ID} from './window-manager';

const WORKSPACE_DOCK_RUNTIME_MODEL_ID = 'ngvge.workspace-dock-runtime-model@1';
const DOCK_RUNTIME_STATE_SCHEMA_VERSION = 1;
const DOCK_ITEM_SCHEMA_VERSION = 1;

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

const assertToolId = toolId => {
    if (typeof toolId !== 'string' || !/^ngvge\.tool\.[a-z0-9][a-z0-9.-]*$/.test(toolId)) {
        throw new TypeError('Dock Runtime Model toolId must be a stable ngvge.tool.* identifier.');
    }
    return toolId;
};

const normalizeOrganizationMetadata = value => {
    const source = isPlainObject(value) ? value : {};
    const normalizeOptionalId = (candidate, label) => {
        if (typeof candidate === 'undefined' || candidate === null || candidate === '') return null;
        if (typeof candidate !== 'string' || candidate.trim().length === 0) {
            throw new TypeError(`${label} must be a non-empty string or null.`);
        }
        return candidate;
    };
    return freezeDeep({
        groupId: normalizeOptionalId(source.groupId, 'Dock groupId'),
        folderId: normalizeOptionalId(source.folderId, 'Dock folderId')
    });
};

const assertRegistry = registry => {
    if (!registry || registry.id !== WORKSPACE_TOOL_REGISTRY_ID ||
        typeof registry.require !== 'function' || typeof registry.list !== 'function') {
        throw new TypeError('Dock Runtime Model requires the Workspace Tool Registry.');
    }
    return registry;
};

const assertWindowManager = manager => {
    if (!manager || manager.id !== WORKSPACE_WINDOW_MANAGER_ID ||
        typeof manager.listStates !== 'function' || typeof manager.subscribe !== 'function') {
        throw new TypeError('Dock Runtime Model requires the Workspace Window Manager.');
    }
    return manager;
};

const uniqueKnownToolIds = (toolRegistry, toolIds, label) => {
    if (!Array.isArray(toolIds)) {
        throw new TypeError(`${label} must be an array of ToolIds.`);
    }
    const seen = new Set();
    return toolIds.map(assertToolId).map(toolId => {
        toolRegistry.require(toolId);
        if (seen.has(toolId)) {
            throw new Error(`${label} contains duplicate ToolId: ${toolId}`);
        }
        seen.add(toolId);
        return toolId;
    });
};

class DockRuntimeModel {
    constructor ({
        toolRegistry,
        windowManager,
        pinnedToolIds = [],
        order = [],
        organization = {}
    } = {}) {
        this.id = WORKSPACE_DOCK_RUNTIME_MODEL_ID;
        this.schemaVersion = DOCK_RUNTIME_STATE_SCHEMA_VERSION;
        this._toolRegistry = assertRegistry(toolRegistry);
        this._windowManager = assertWindowManager(windowManager);
        this._pinnedToolIds = new Set(uniqueKnownToolIds(this._toolRegistry, pinnedToolIds, 'Dock pinnedToolIds'));
        this._order = uniqueKnownToolIds(this._toolRegistry, order, 'Dock order');
        this._organization = new Map();
        this._listeners = new Set();
        this._revision = 0;

        if (!isPlainObject(organization)) {
            throw new TypeError('Dock organization must be a ToolId-keyed plain object.');
        }
        Object.keys(organization).forEach(toolId => {
            this._toolRegistry.require(assertToolId(toolId));
            this._organization.set(toolId, normalizeOrganizationMetadata(organization[toolId]));
        });

        this._unsubscribeWindowManager = this._windowManager.subscribe(event => {
            this._emit('dock:window-projection-changed', {
                sourceWindowEvent: event.type,
                windowId: event.windowId || null
            });
        });
    }

    get revision () {
        return this._revision;
    }

    subscribe (listener) {
        if (typeof listener !== 'function') {
            throw new TypeError('Dock Runtime Model listener must be a function.');
        }
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    dispose () {
        if (this._unsubscribeWindowManager) {
            this._unsubscribeWindowManager();
            this._unsubscribeWindowManager = null;
        }
        this._listeners.clear();
    }

    _emit (type, details = {}) {
        this._revision += 1;
        const event = freezeDeep({
            modelId: this.id,
            revision: this._revision,
            type,
            toolId: details.toolId || null,
            windowId: details.windowId || null,
            sourceWindowEvent: details.sourceWindowEvent || null
        });
        this._listeners.forEach(listener => listener(event));
        return event;
    }

    _requireTool (toolId) {
        return this._toolRegistry.require(assertToolId(toolId));
    }

    isPinned (toolId) {
        this._requireTool(toolId);
        return this._pinnedToolIds.has(toolId);
    }

    pin (toolId) {
        const id = this._requireTool(toolId).id;
        if (this._pinnedToolIds.has(id)) return false;
        this._pinnedToolIds.add(id);
        this._emit('dock:pinning-changed', {toolId: id});
        return true;
    }

    unpin (toolId) {
        const id = this._requireTool(toolId).id;
        if (!this._pinnedToolIds.delete(id)) return false;
        this._emit('dock:pinning-changed', {toolId: id});
        return true;
    }

    setOrder (toolIds) {
        const nextOrder = uniqueKnownToolIds(this._toolRegistry, toolIds, 'Dock order');
        const unchanged = nextOrder.length === this._order.length &&
            nextOrder.every((toolId, index) => toolId === this._order[index]);
        if (unchanged) {
            return false;
        }
        this._order = nextOrder;
        this._emit('dock:order-changed');
        return true;
    }

    getOrder () {
        return Object.freeze(this._order.slice());
    }

    setOrganizationMetadata (toolId, metadata) {
        const id = this._requireTool(toolId).id;
        const normalized = normalizeOrganizationMetadata(metadata);
        const previous = this._organization.get(id) || normalizeOrganizationMetadata({});
        if (previous.groupId === normalized.groupId && previous.folderId === normalized.folderId) {
            return false;
        }
        if (normalized.groupId === null && normalized.folderId === null) {
            this._organization.delete(id);
        } else {
            this._organization.set(id, normalized);
        }
        this._emit('dock:organization-changed', {toolId: id});
        return true;
    }

    getOrganizationMetadata (toolId) {
        const id = this._requireTool(toolId).id;
        return this._organization.get(id) || normalizeOrganizationMetadata({});
    }

    _getWindowInstances (toolId) {
        return this._windowManager.listStates()
            .filter(state => state.toolId === toolId)
            .map(state => freezeDeep({
                windowId: state.windowId,
                running: Boolean(state.visible || state.minimized),
                minimized: Boolean(state.minimized),
                active: Boolean(state.active)
            }));
    }

    getItem (toolId) {
        const tool = this._requireTool(toolId);
        const instances = this._getWindowInstances(tool.id);
        const runningInstances = instances.filter(instance => instance.running);
        const organization = this.getOrganizationMetadata(tool.id);
        return freezeDeep({
            schemaVersion: DOCK_ITEM_SCHEMA_VERSION,
            modelId: this.id,
            toolId: tool.id,
            title: tool.title,
            iconKey: tool.iconKey || null,
            singleton: Boolean(tool.singleton),
            pinned: this._pinnedToolIds.has(tool.id),
            running: runningInstances.length > 0,
            minimized: runningInstances.some(instance => instance.minimized),
            active: runningInstances.some(instance => instance.active),
            activeWindowId: (runningInstances.find(instance => instance.active) || {}).windowId || null,
            runningWindowIds: runningInstances.map(instance => instance.windowId),
            minimizedWindowIds: runningInstances
                .filter(instance => instance.minimized)
                .map(instance => instance.windowId),
            instances,
            groupId: organization.groupId,
            folderId: organization.folderId
        });
    }

    _orderedToolDefinitions () {
        const all = this._toolRegistry.list();
        const priority = new Map(this._order.map((toolId, index) => [toolId, index]));
        const registryOrder = new Map(all.map((tool, index) => [tool.id, index]));
        return all.slice().sort((a, b) => {
            const aPriority = priority.has(a.id) ? priority.get(a.id) : Number.MAX_SAFE_INTEGER;
            const bPriority = priority.has(b.id) ? priority.get(b.id) : Number.MAX_SAFE_INTEGER;
            if (aPriority !== bPriority) return aPriority - bPriority;
            return registryOrder.get(a.id) - registryOrder.get(b.id);
        });
    }

    listItems ({includeStopped = false} = {}) {
        const items = this._orderedToolDefinitions().map(tool => this.getItem(tool.id));
        return Object.freeze(items.filter(item => includeStopped || item.pinned || item.running));
    }

    getSnapshot ({includeStopped = false} = {}) {
        return freezeDeep({
            schemaVersion: DOCK_RUNTIME_STATE_SCHEMA_VERSION,
            modelId: this.id,
            revision: this._revision,
            items: this.listItems({includeStopped})
        });
    }
}

export {
    WORKSPACE_DOCK_RUNTIME_MODEL_ID,
    DOCK_RUNTIME_STATE_SCHEMA_VERSION,
    DOCK_ITEM_SCHEMA_VERSION,
    DockRuntimeModel
};
