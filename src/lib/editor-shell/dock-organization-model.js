import {WORKSPACE_DOCK_RUNTIME_MODEL_ID} from './dock-runtime-model';
import {WORKSPACE_TOOL_REGISTRY_ID} from './tool-registry';

const WORKSPACE_DOCK_ORGANIZATION_MODEL_ID = 'ngvge.workspace-dock-organization-model@1';
const DOCK_ORGANIZATION_PREFERENCE_SCHEMA_ID = 'ngvge.workspace-dock-organization-preference@1';
const DOCK_ORGANIZATION_PREFERENCE_SCHEMA_VERSION = 1;
const DOCK_ORGANIZATION_NODE_SCHEMA_VERSION = 1;

const DOCK_ORGANIZATION_KINDS = Object.freeze({
    GROUP: 'group',
    FOLDER: 'folder',
    SEPARATOR: 'separator'
});

const DEFAULT_DOCK_ORGANIZATION_PREFERENCE = Object.freeze({
    schemaVersion: DOCK_ORGANIZATION_PREFERENCE_SCHEMA_VERSION,
    containers: Object.freeze([]),
    separators: Object.freeze([])
});

const ORGANIZATION_PREFERENCE_FIELDS = Object.freeze(['schemaVersion', 'containers', 'separators']);
const CONTAINER_FIELDS = Object.freeze(['schemaVersion', 'id', 'kind', 'label', 'toolIds']);
const SEPARATOR_FIELDS = Object.freeze(['schemaVersion', 'id', 'kind', 'beforeToolId']);

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

const assertKnownFields = (source, fields, label) => {
    const unknown = Object.keys(source).filter(key => !fields.includes(key));
    if (unknown.length > 0) {
        throw new Error(`${label} contains unsupported field(s): ${unknown.join(', ')}`);
    }
};

const assertToolId = toolId => {
    if (typeof toolId !== 'string' || !/^ngvge\.tool\.[a-z0-9][a-z0-9.-]*$/.test(toolId)) {
        throw new TypeError('Dock organization toolId must be a stable ngvge.tool.* identifier.');
    }
    return toolId;
};

const assertOrganizationId = (id, kind) => {
    const pattern = new RegExp(`^ngvge\\.dock\\.${kind}\\.[a-z0-9][a-z0-9.-]*$`);
    if (typeof id !== 'string' || !pattern.test(id)) {
        throw new TypeError(`Dock ${kind} id must be a stable ngvge.dock.${kind}.* identifier.`);
    }
    return id;
};

const assertLabel = (label, kind) => {
    if (typeof label !== 'string' || label.trim().length === 0) {
        throw new TypeError(`Dock ${kind} label must be a non-empty string.`);
    }
    return label.trim();
};

const assertRegistry = registry => {
    if (!registry || registry.id !== WORKSPACE_TOOL_REGISTRY_ID || typeof registry.require !== 'function') {
        throw new TypeError('Dock Organization Model requires the Workspace Tool Registry.');
    }
    return registry;
};

const assertDockRuntimeModel = model => {
    if (!model || model.id !== WORKSPACE_DOCK_RUNTIME_MODEL_ID ||
        typeof model.setOrganizationMetadata !== 'function' || typeof model.listItems !== 'function') {
        throw new TypeError('Dock Organization Model requires the Dock Runtime Model.');
    }
    return model;
};

const normalizeToolIds = (toolRegistry, toolIds, label) => {
    if (!Array.isArray(toolIds)) {
        throw new TypeError(`${label} must be an array of ToolIds.`);
    }
    const seen = new Set();
    return toolIds.map(assertToolId).map(toolId => {
        toolRegistry.require(toolId);
        if (seen.has(toolId)) throw new Error(`${label} contains duplicate ToolId: ${toolId}`);
        seen.add(toolId);
        return toolId;
    });
};

const normalizeContainer = (toolRegistry, value) => {
    if (!isPlainObject(value)) throw new TypeError('Dock organization container must be a plain object.');
    assertKnownFields(value, CONTAINER_FIELDS, 'Dock organization container');
    if (typeof value.schemaVersion !== 'undefined' && value.schemaVersion !== DOCK_ORGANIZATION_NODE_SCHEMA_VERSION) {
        throw new Error(`Unsupported Dock organization node schemaVersion: ${value.schemaVersion}`);
    }
    if (value.kind !== DOCK_ORGANIZATION_KINDS.GROUP && value.kind !== DOCK_ORGANIZATION_KINDS.FOLDER) {
        throw new TypeError('Dock organization container kind must be group or folder.');
    }
    return freezeDeep({
        schemaVersion: DOCK_ORGANIZATION_NODE_SCHEMA_VERSION,
        id: assertOrganizationId(value.id, value.kind),
        kind: value.kind,
        label: assertLabel(value.label, value.kind),
        toolIds: normalizeToolIds(toolRegistry, value.toolIds || [], `Dock ${value.kind} toolIds`)
    });
};

const normalizeSeparator = (toolRegistry, value) => {
    if (!isPlainObject(value)) throw new TypeError('Dock separator must be a plain object.');
    assertKnownFields(value, SEPARATOR_FIELDS, 'Dock separator');
    if (typeof value.schemaVersion !== 'undefined' && value.schemaVersion !== DOCK_ORGANIZATION_NODE_SCHEMA_VERSION) {
        throw new Error(`Unsupported Dock organization node schemaVersion: ${value.schemaVersion}`);
    }
    if (typeof value.kind !== 'undefined' && value.kind !== DOCK_ORGANIZATION_KINDS.SEPARATOR) {
        throw new TypeError('Dock separator kind must be separator.');
    }
    const beforeToolId = value.beforeToolId === null || typeof value.beforeToolId === 'undefined' ?
        null : assertToolId(value.beforeToolId);
    if (beforeToolId) toolRegistry.require(beforeToolId);
    return freezeDeep({
        schemaVersion: DOCK_ORGANIZATION_NODE_SCHEMA_VERSION,
        id: assertOrganizationId(value.id, DOCK_ORGANIZATION_KINDS.SEPARATOR),
        kind: DOCK_ORGANIZATION_KINDS.SEPARATOR,
        beforeToolId
    });
};

const normalizeDockOrganizationPreference = (toolRegistry, value = DEFAULT_DOCK_ORGANIZATION_PREFERENCE) => {
    if (!isPlainObject(value)) throw new TypeError('Dock organization preference must be a plain object.');
    assertKnownFields(value, ORGANIZATION_PREFERENCE_FIELDS, 'Dock organization preference');
    if (typeof value.schemaVersion !== 'undefined' &&
        value.schemaVersion !== DOCK_ORGANIZATION_PREFERENCE_SCHEMA_VERSION) {
        throw new Error(`Unsupported Dock organization preference schemaVersion: ${value.schemaVersion}`);
    }
    const containers = (value.containers || []).map(container => normalizeContainer(toolRegistry, container));
    const separators = (value.separators || []).map(separator => normalizeSeparator(toolRegistry, separator));
    const organizationIds = new Set();
    [...containers, ...separators].forEach(node => {
        if (organizationIds.has(node.id)) throw new Error(`Duplicate Dock organization id: ${node.id}`);
        organizationIds.add(node.id);
    });
    const membership = new Map();
    containers.forEach(container => {
        container.toolIds.forEach(toolId => {
            if (membership.has(toolId)) {
                throw new Error(`ToolId may belong to only one Dock group/folder: ${toolId}`);
            }
            membership.set(toolId, container.id);
        });
    });
    const separatorAnchors = new Set();
    separators.forEach(separator => {
        const key = separator.beforeToolId || '__end__';
        if (separatorAnchors.has(key)) {
            throw new Error(`Dock organization allows only one separator at anchor: ${key}`);
        }
        separatorAnchors.add(key);
    });
    return freezeDeep({
        schemaVersion: DOCK_ORGANIZATION_PREFERENCE_SCHEMA_VERSION,
        containers,
        separators
    });
};

const clonePreference = preference => ({
    schemaVersion: DOCK_ORGANIZATION_PREFERENCE_SCHEMA_VERSION,
    containers: preference.containers.map(container => ({
        id: container.id,
        kind: container.kind,
        label: container.label,
        toolIds: container.toolIds.slice()
    })),
    separators: preference.separators.map(separator => ({
        id: separator.id,
        beforeToolId: separator.beforeToolId
    }))
});

const aggregateItems = items => freezeDeep({
    running: items.some(item => item.running),
    minimized: items.some(item => item.minimized),
    active: items.some(item => item.active),
    pinned: items.some(item => item.pinned),
    runningWindowCount: items.reduce((count, item) => count + item.runningWindowIds.length, 0)
});

class DockOrganizationModel {
    constructor ({toolRegistry, dockRuntimeModel, preference = DEFAULT_DOCK_ORGANIZATION_PREFERENCE} = {}) {
        this.id = WORKSPACE_DOCK_ORGANIZATION_MODEL_ID;
        this.schemaId = DOCK_ORGANIZATION_PREFERENCE_SCHEMA_ID;
        this.schemaVersion = DOCK_ORGANIZATION_PREFERENCE_SCHEMA_VERSION;
        this._toolRegistry = assertRegistry(toolRegistry);
        this._dockRuntimeModel = assertDockRuntimeModel(dockRuntimeModel);
        this._preference = normalizeDockOrganizationPreference(this._toolRegistry, preference);
        this._expandedFolderIds = new Set();
        this._listeners = new Set();
        this._revision = 0;
        this._counters = {
            group: 0,
            folder: 0,
            separator: 0
        };
        this._syncAllMembership(this._preference);
    }

    get revision () {
        return this._revision;
    }

    subscribe (listener) {
        if (typeof listener !== 'function') throw new TypeError('Dock Organization Model listener must be a function.');
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    _emit (type, details = {}) {
        this._revision += 1;
        const event = freezeDeep({
            modelId: this.id,
            revision: this._revision,
            type,
            organizationId: details.organizationId || null,
            toolId: details.toolId || null
        });
        this._listeners.forEach(listener => listener(event));
        return event;
    }

    _nextId (kind) {
        const used = new Set([
            ...this._preference.containers.map(container => container.id),
            ...this._preference.separators.map(separator => separator.id)
        ]);
        let id;
        do {
            this._counters[kind] += 1;
            id = `ngvge.dock.${kind}.${this._counters[kind]}`;
        } while (used.has(id));
        return id;
    }

    _membershipMap (preference = this._preference) {
        const map = new Map();
        preference.containers.forEach(container => {
            container.toolIds.forEach(toolId => map.set(toolId, container));
        });
        return map;
    }

    _syncAllMembership (preference) {
        const membership = this._membershipMap(preference);
        this._toolRegistry.list().forEach(tool => {
            const container = membership.get(tool.id) || null;
            this._dockRuntimeModel.setOrganizationMetadata(tool.id, {
                groupId: container && container.kind === DOCK_ORGANIZATION_KINDS.GROUP ? container.id : null,
                folderId: container && container.kind === DOCK_ORGANIZATION_KINDS.FOLDER ? container.id : null
            });
        });
    }

    _setPreference (nextPreference, type, details = {}) {
        const normalized = normalizeDockOrganizationPreference(this._toolRegistry, nextPreference);
        if (JSON.stringify(normalized) === JSON.stringify(this._preference)) return false;
        const oldContainerIds = new Set(this._preference.containers.map(container => container.id));
        this._preference = normalized;
        this._expandedFolderIds.forEach(folderId => {
            const container = this._preference.containers.find(entry => entry.id === folderId);
            if (!container || container.kind !== DOCK_ORGANIZATION_KINDS.FOLDER) {
                this._expandedFolderIds.delete(folderId);
            }
        });
        this._syncAllMembership(this._preference);
        this._preference.containers.forEach(container => oldContainerIds.delete(container.id));
        oldContainerIds.forEach(id => this._expandedFolderIds.delete(id));
        this._emit(type, details);
        return true;
    }

    getPreference () {
        return this._preference;
    }

    listContainers () {
        return this._preference.containers;
    }

    listSeparators () {
        return this._preference.separators;
    }

    getContainer (organizationId) {
        return this._preference.containers.find(container => container.id === organizationId) || null;
    }

    requireContainer (organizationId) {
        const container = this.getContainer(organizationId);
        if (!container) throw new Error(`Dock organization container is not registered: ${organizationId}`);
        return container;
    }

    getMembership (toolId) {
        const id = assertToolId(toolId);
        this._toolRegistry.require(id);
        const container = this._membershipMap().get(id) || null;
        return container ? freezeDeep({
            organizationId: container.id,
            kind: container.kind,
            label: container.label
        }) : null;
    }

    createGroup ({label, toolIds = []} = {}) {
        return this._createContainer(DOCK_ORGANIZATION_KINDS.GROUP, {label, toolIds});
    }

    createFolder ({label, toolIds = []} = {}) {
        return this._createContainer(DOCK_ORGANIZATION_KINDS.FOLDER, {label, toolIds});
    }

    _createContainer (kind, {label, toolIds}) {
        const ids = normalizeToolIds(this._toolRegistry, toolIds, `Dock ${kind} toolIds`);
        const existingMembership = this._membershipMap();
        ids.forEach(toolId => {
            if (existingMembership.has(toolId)) {
                throw new Error(`ToolId already belongs to a Dock container: ${toolId}`);
            }
        });
        const id = this._nextId(kind);
        const defaultLabel = `${kind === DOCK_ORGANIZATION_KINDS.GROUP ? 'Group' : 'Folder'} ${this._counters[kind]}`;
        const next = clonePreference(this._preference);
        next.containers.push({
            id,
            kind,
            label: typeof label === 'undefined' ? defaultLabel : label,
            toolIds: ids
        });
        this._setPreference(next, 'dock:organization-container-created', {organizationId: id});
        return this.requireContainer(id);
    }

    renameContainer (organizationId, label) {
        const current = this.requireContainer(organizationId);
        const next = clonePreference(this._preference);
        const target = next.containers.find(container => container.id === current.id);
        target.label = assertLabel(label, current.kind);
        return this._setPreference(next, 'dock:organization-container-renamed', {organizationId: current.id});
    }

    removeContainer (organizationId) {
        const current = this.requireContainer(organizationId);
        const next = clonePreference(this._preference);
        next.containers = next.containers.filter(container => container.id !== current.id);
        return this._setPreference(next, 'dock:organization-container-removed', {organizationId: current.id});
    }

    moveToolToContainer (toolId, organizationId = null) {
        const id = assertToolId(toolId);
        this._toolRegistry.require(id);
        if (organizationId !== null) this.requireContainer(organizationId);
        const membership = this.getMembership(id);
        if ((membership && membership.organizationId) === organizationId || (!membership && organizationId === null)) {
            return false;
        }
        const next = clonePreference(this._preference);
        next.containers.forEach(container => {
            container.toolIds = container.toolIds.filter(candidate => candidate !== id);
        });
        if (organizationId !== null) {
            next.containers.find(container => container.id === organizationId).toolIds.push(id);
        }
        return this._setPreference(next, 'dock:organization-membership-changed', {
            organizationId,
            toolId: id
        });
    }

    createSeparator ({beforeToolId = null} = {}) {
        if (beforeToolId !== null) {
            assertToolId(beforeToolId);
            this._toolRegistry.require(beforeToolId);
        }
        const existing = this._preference.separators.find(separator => separator.beforeToolId === beforeToolId);
        if (existing) return existing;
        const id = this._nextId(DOCK_ORGANIZATION_KINDS.SEPARATOR);
        const next = clonePreference(this._preference);
        next.separators.push({id, beforeToolId});
        this._setPreference(next, 'dock:organization-separator-created', {organizationId: id, toolId: beforeToolId});
        return this._preference.separators.find(separator => separator.id === id);
    }

    removeSeparator (separatorId) {
        const current = this._preference.separators.find(separator => separator.id === separatorId);
        if (!current) throw new Error(`Dock separator is not registered: ${separatorId}`);
        const next = clonePreference(this._preference);
        next.separators = next.separators.filter(separator => separator.id !== separatorId);
        return this._setPreference(next, 'dock:organization-separator-removed', {
            organizationId: separatorId,
            toolId: current.beforeToolId
        });
    }

    getSeparatorBefore (toolId) {
        const id = assertToolId(toolId);
        this._toolRegistry.require(id);
        return this._preference.separators.find(separator => separator.beforeToolId === id) || null;
    }

    isFolderExpanded (folderId) {
        const folder = this.requireContainer(folderId);
        if (folder.kind !== DOCK_ORGANIZATION_KINDS.FOLDER) {
            throw new TypeError('Only Dock folders have expanded state.');
        }
        return this._expandedFolderIds.has(folder.id);
    }

    setFolderExpanded (folderId, expanded) {
        const folder = this.requireContainer(folderId);
        if (folder.kind !== DOCK_ORGANIZATION_KINDS.FOLDER) {
            throw new TypeError('Only Dock folders have expanded state.');
        }
        if (typeof expanded !== 'boolean') throw new TypeError('Dock folder expanded state must be boolean.');
        const previous = this._expandedFolderIds.has(folder.id);
        if (previous === expanded) return false;
        if (expanded) this._expandedFolderIds.add(folder.id);
        else this._expandedFolderIds.delete(folder.id);
        this._emit('dock:organization-folder-expanded-changed', {organizationId: folder.id});
        return true;
    }

    toggleFolder (folderId) {
        return this.setFolderExpanded(folderId, !this.isFolderExpanded(folderId));
    }

    project (items) {
        if (!Array.isArray(items)) throw new TypeError('Dock organization projection requires DockItem array.');
        const itemByToolId = new Map(items.map(item => [item.toolId, item]));
        const membership = this._membershipMap();
        const containerNodes = new Map();
        const mainNodes = [];
        const seenContainers = new Set();

        items.forEach(item => {
            const container = membership.get(item.toolId) || null;
            if (!container) {
                mainNodes.push(freezeDeep({
                    schemaVersion: DOCK_ORGANIZATION_NODE_SCHEMA_VERSION,
                    kind: 'tool',
                    id: item.toolId,
                    toolId: item.toolId,
                    orderToolIds: [item.toolId],
                    item
                }));
                return;
            }
            if (seenContainers.has(container.id)) return;
            seenContainers.add(container.id);
            const containerItems = items.filter(candidate => container.toolIds.includes(candidate.toolId));
            if (containerItems.length === 0) return;
            const node = freezeDeep({
                schemaVersion: DOCK_ORGANIZATION_NODE_SCHEMA_VERSION,
                kind: container.kind,
                id: container.id,
                label: container.label,
                expanded: container.kind === DOCK_ORGANIZATION_KINDS.FOLDER ?
                    this._expandedFolderIds.has(container.id) : true,
                orderToolIds: containerItems.map(candidate => candidate.toolId),
                items: containerItems,
                summary: aggregateItems(containerItems)
            });
            containerNodes.set(container.id, node);
            mainNodes.push(node);
        });

        const nodeIndexByToolId = new Map();
        mainNodes.forEach((node, index) => {
            node.orderToolIds.forEach(toolId => nodeIndexByToolId.set(toolId, index));
        });
        const separatorsByIndex = new Map();
        this._preference.separators.forEach(separator => {
            let index = mainNodes.length;
            if (separator.beforeToolId && itemByToolId.has(separator.beforeToolId)) {
                index = nodeIndexByToolId.get(separator.beforeToolId);
            } else if (separator.beforeToolId) {
                return;
            }
            if (!separatorsByIndex.has(index)) separatorsByIndex.set(index, []);
            separatorsByIndex.get(index).push(freezeDeep({
                schemaVersion: DOCK_ORGANIZATION_NODE_SCHEMA_VERSION,
                kind: DOCK_ORGANIZATION_KINDS.SEPARATOR,
                id: separator.id,
                beforeToolId: separator.beforeToolId,
                orderToolIds: []
            }));
        });
        const nodes = [];
        for (let index = 0; index <= mainNodes.length; index++) {
            (separatorsByIndex.get(index) || []).forEach(separator => nodes.push(separator));
            if (index < mainNodes.length) nodes.push(mainNodes[index]);
        }
        return freezeDeep({
            schemaVersion: DOCK_ORGANIZATION_PREFERENCE_SCHEMA_VERSION,
            modelId: this.id,
            revision: this._revision,
            nodes
        });
    }
}

export {
    WORKSPACE_DOCK_ORGANIZATION_MODEL_ID,
    DOCK_ORGANIZATION_PREFERENCE_SCHEMA_ID,
    DOCK_ORGANIZATION_PREFERENCE_SCHEMA_VERSION,
    DOCK_ORGANIZATION_NODE_SCHEMA_VERSION,
    DOCK_ORGANIZATION_KINDS,
    DEFAULT_DOCK_ORGANIZATION_PREFERENCE,
    normalizeDockOrganizationPreference,
    DockOrganizationModel
};
