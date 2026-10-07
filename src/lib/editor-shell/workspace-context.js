import {STABLE_ID_KINDS, isStableIdentity} from '../../core/identity/stable-identity';
import {TOOL_CAPABILITY_ACCESS, WORKSPACE_TOOL_CAPABILITIES} from './tool-capability';

const WORKSPACE_CONTEXT_SERVICE_ID = 'ngvge.workspace-context@1';
const WORKSPACE_CONTEXT_SNAPSHOT_SCHEMA_VERSION = 1;
const WORKSPACE_CONTEXT_WRITER_LEASE_SCHEMA_VERSION = 1;
const WORKSPACE_CONTEXT_READ_CAPABILITY_ID = 'ngvge.workspace-context-read-capability@1';

const WORKSPACE_CONTEXT_DOMAINS = Object.freeze({
    PROJECT: 'project',
    SCENE: 'scene',
    NODE_SELECTION: 'node-selection',
    RESOURCE: 'resource',
    WINDOW: 'window'
});

const WORKSPACE_CONTEXT_SOURCE_IDS = Object.freeze({
    PROJECT_LIFECYCLE: 'ngvge.workspace-context-source.project-lifecycle',
    SCENE_SYSTEM: 'ngvge.workspace-context-source.scene-system',
    NODE_SELECTION: 'ngvge.workspace-context-source.node-selection',
    RESOURCE_SELECTION: 'ngvge.workspace-context-source.resource-selection',
    WINDOW_MANAGER: 'ngvge.workspace-context-source.window-manager'
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

const makeContextError = (code, message) => {
    const error = new Error(message);
    error.code = code;
    return error;
};

const assertDomain = domain => {
    if (!Object.values(WORKSPACE_CONTEXT_DOMAINS).includes(domain)) {
        throw new TypeError(`Unsupported Workspace Context domain: ${domain}`);
    }
    return domain;
};

const assertSourceId = sourceId => {
    if (typeof sourceId !== 'string' || !/^ngvge\.workspace-context-source\.[a-z0-9][a-z0-9.-]*$/.test(sourceId)) {
        throw new TypeError('Workspace Context writer requires a stable ngvge.workspace-context-source.* sourceId.');
    }
    return sourceId;
};

const normalizeNullableIdentity = (value, label) => {
    if (value === null || typeof value === 'undefined' || value === '') return null;
    if (typeof value !== 'string' || !value.trim()) {
        throw new TypeError(`Workspace Context ${label} must be a stable string identity or null.`);
    }
    return value.trim();
};

const assertOnlyFields = (value, allowed, label) => {
    if (!isPlainObject(value)) throw new TypeError(`${label} must be a plain object.`);
    const unknown = Object.keys(value).filter(key => !allowed.includes(key));
    if (unknown.length) throw new Error(`${label} contains unsupported field(s): ${unknown.join(', ')}`);
};

const normalizeNodeSelection = value => {
    assertOnlyFields(value, ['selectedNodeIds', 'primaryNodeId'], 'Workspace Context Node selection');
    if (!Array.isArray(value.selectedNodeIds)) {
        throw new TypeError('Workspace Context selectedNodeIds must be an array.');
    }
    const seen = new Set();
    const selectedNodeIds = value.selectedNodeIds.map(nodeId => {
        const normalized = normalizeNullableIdentity(nodeId, 'NodeId');
        if (!normalized) throw new TypeError('Workspace Context selectedNodeIds cannot contain null identities.');
        if (seen.has(normalized)) {
            throw new Error(`Workspace Context selectedNodeIds contains duplicate NodeId: ${normalized}`);
        }
        seen.add(normalized);
        return normalized;
    });
    const primaryNodeId = normalizeNullableIdentity(value.primaryNodeId, 'primary NodeId');
    if (primaryNodeId && !seen.has(primaryNodeId)) {
        throw new Error('Workspace Context primaryNodeId must be present in selectedNodeIds.');
    }
    return freezeDeep({selectedNodeIds, primaryNodeId});
};

const normalizeWindowContext = value => {
    assertOnlyFields(value, ['activeToolId', 'activeWindowId'], 'Workspace Context Window context');
    const activeToolId = normalizeNullableIdentity(value.activeToolId, 'active ToolId');
    const activeWindowId = normalizeNullableIdentity(value.activeWindowId, 'active WindowId');
    if (activeWindowId && !activeToolId) {
        throw new Error('Workspace Context activeWindowId requires activeToolId.');
    }
    return freezeDeep({activeToolId, activeWindowId});
};

const normalizeDomainValue = (domain, value) => {
    switch (assertDomain(domain)) {
    case WORKSPACE_CONTEXT_DOMAINS.PROJECT:
        assertOnlyFields(value, ['projectId'], 'Workspace Context Project context');
        return freezeDeep({projectId: normalizeNullableIdentity(value.projectId, 'ProjectId')});
    case WORKSPACE_CONTEXT_DOMAINS.SCENE:
        assertOnlyFields(value, ['sceneId'], 'Workspace Context Scene context');
        return freezeDeep({sceneId: normalizeNullableIdentity(value.sceneId, 'SceneId')});
    case WORKSPACE_CONTEXT_DOMAINS.NODE_SELECTION:
        return normalizeNodeSelection(value);
    case WORKSPACE_CONTEXT_DOMAINS.RESOURCE: {
        assertOnlyFields(value, ['resourceId'], 'Workspace Context Resource context');
        const resourceId = normalizeNullableIdentity(value.resourceId, 'ResourceId');
        if (resourceId && !isStableIdentity(resourceId, STABLE_ID_KINDS.RESOURCE)) {
            throw makeContextError(
                'NGVGE_WORKSPACE_CONTEXT_RESOURCE_ID_INVALID',
                'Workspace Context Resource domain requires a canonical ngvge:resource:* ResourceId.'
            );
        }
        return freezeDeep({resourceId});
    }
    case WORKSPACE_CONTEXT_DOMAINS.WINDOW:
        return normalizeWindowContext(value);
    default:
        throw new TypeError(`Unsupported Workspace Context domain: ${domain}`);
    }
};

const domainValueEquals = (domain, current, next) => {
    switch (domain) {
    case WORKSPACE_CONTEXT_DOMAINS.PROJECT:
        return current.projectId === next.projectId;
    case WORKSPACE_CONTEXT_DOMAINS.SCENE:
        return current.sceneId === next.sceneId;
    case WORKSPACE_CONTEXT_DOMAINS.NODE_SELECTION:
        return current.primaryNodeId === next.primaryNodeId &&
            current.selectedNodeIds.length === next.selectedNodeIds.length &&
            current.selectedNodeIds.every((nodeId, index) => nodeId === next.selectedNodeIds[index]);
    case WORKSPACE_CONTEXT_DOMAINS.RESOURCE:
        return current.resourceId === next.resourceId;
    case WORKSPACE_CONTEXT_DOMAINS.WINDOW:
        return current.activeToolId === next.activeToolId && current.activeWindowId === next.activeWindowId;
    default:
        return false;
    }
};

const emptyDomainValue = domain => {
    switch (domain) {
    case WORKSPACE_CONTEXT_DOMAINS.PROJECT: return {projectId: null};
    case WORKSPACE_CONTEXT_DOMAINS.SCENE: return {sceneId: null};
    case WORKSPACE_CONTEXT_DOMAINS.NODE_SELECTION: return {selectedNodeIds: [], primaryNodeId: null};
    case WORKSPACE_CONTEXT_DOMAINS.RESOURCE: return {resourceId: null};
    case WORKSPACE_CONTEXT_DOMAINS.WINDOW: return {activeToolId: null, activeWindowId: null};
    default: throw new TypeError(`Unsupported Workspace Context domain: ${domain}`);
    }
};

const createSnapshot = (revision, state) => freezeDeep({
    schemaVersion: WORKSPACE_CONTEXT_SNAPSHOT_SCHEMA_VERSION,
    serviceId: WORKSPACE_CONTEXT_SERVICE_ID,
    revision,
    projectId: state.projectId,
    sceneId: state.sceneId,
    selectedNodeIds: state.selectedNodeIds.slice(),
    primaryNodeId: state.primaryNodeId,
    resourceId: state.resourceId,
    activeToolId: state.activeToolId,
    activeWindowId: state.activeWindowId
});

class WorkspaceContextService {
    constructor () {
        this.id = WORKSPACE_CONTEXT_SERVICE_ID;
        this._revision = 0;
        this._state = {
            projectId: null,
            sceneId: null,
            selectedNodeIds: [],
            primaryNodeId: null,
            resourceId: null,
            activeToolId: null,
            activeWindowId: null
        };
        this._writers = new Map();
        this._listeners = new Set();
        this._writerSequence = 0;
    }

    get revision () {
        return this._revision;
    }

    getSnapshot () {
        return createSnapshot(this._revision, this._state);
    }

    subscribe (listener) {
        if (typeof listener !== 'function') {
            throw new TypeError('Workspace Context listener must be a function.');
        }
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    getWriterSource (domain) {
        const owner = this._writers.get(assertDomain(domain));
        return owner && owner.active ? owner.sourceId : null;
    }

    _emit (type, domain, sourceId) {
        this._revision += 1;
        const event = freezeDeep({
            serviceId: this.id,
            revision: this._revision,
            type,
            domain,
            sourceId,
            snapshot: this.getSnapshot()
        });
        this._listeners.forEach(listener => listener(event));
        return event;
    }

    _applyDomainValue (domain, value, sourceId, type = 'context:changed') {
        const normalized = normalizeDomainValue(domain, value);
        if (domainValueEquals(domain, this._state, normalized)) return null;
        this._state = Object.assign({}, this._state, normalized);
        return this._emit(type, domain, sourceId);
    }

    claimWriter (domain, sourceId) {
        const normalizedDomain = assertDomain(domain);
        const normalizedSourceId = assertSourceId(sourceId);
        const existing = this._writers.get(normalizedDomain);
        if (existing && existing.active) {
            throw makeContextError(
                'NGVGE_WORKSPACE_CONTEXT_WRITER_CONFLICT',
                `Workspace Context domain already has a writer: ${normalizedDomain}#${existing.sourceId}`
            );
        }
        const leaseId = `ngvge.workspace-context-writer-lease.${++this._writerSequence}`;
        const state = {
            active: true,
            domain: normalizedDomain,
            leaseId,
            sourceId: normalizedSourceId
        };
        this._writers.set(normalizedDomain, state);

        const assertActive = () => {
            if (!state.active || this._writers.get(normalizedDomain) !== state) {
                throw makeContextError(
                    'NGVGE_WORKSPACE_CONTEXT_WRITER_REVOKED',
                    `Workspace Context writer lease is no longer active: ${leaseId}`
                );
            }
        };

        const update = value => {
            assertActive();
            return this._applyDomainValue(normalizedDomain, value, normalizedSourceId);
        };

        const clear = () => {
            assertActive();
            return this._applyDomainValue(
                normalizedDomain,
                emptyDomainValue(normalizedDomain),
                normalizedSourceId,
                'context:cleared'
            );
        };

        const release = ({clear: clearContext = true} = {}) => {
            if (!state.active || this._writers.get(normalizedDomain) !== state) return false;
            if (clearContext) clear();
            state.active = false;
            this._writers.delete(normalizedDomain);
            return true;
        };

        return Object.freeze({
            schemaVersion: WORKSPACE_CONTEXT_WRITER_LEASE_SCHEMA_VERSION,
            id: leaseId,
            serviceId: this.id,
            domain: normalizedDomain,
            sourceId: normalizedSourceId,
            isActive: () => state.active && this._writers.get(normalizedDomain) === state,
            update,
            clear,
            release
        });
    }
}

const bindWindowManagerToWorkspaceContext = ({
    contextService,
    windowManager,
    sourceId = WORKSPACE_CONTEXT_SOURCE_IDS.WINDOW_MANAGER
}) => {
    if (!contextService || typeof contextService.claimWriter !== 'function') {
        throw new TypeError('Window Context binding requires WorkspaceContextService.');
    }
    if (!windowManager || typeof windowManager.subscribe !== 'function' ||
        typeof windowManager.getActiveWindowId !== 'function' || typeof windowManager.getState !== 'function') {
        throw new TypeError('Window Context binding requires WindowManager.');
    }
    const writer = contextService.claimWriter(WORKSPACE_CONTEXT_DOMAINS.WINDOW, sourceId);
    let disposed = false;

    const sync = () => {
        if (disposed || !writer.isActive()) return;
        const activeWindowId = windowManager.getActiveWindowId();
        const activeState = activeWindowId ? windowManager.getState(activeWindowId) : null;
        writer.update({
            activeWindowId: activeState ? activeState.windowId : null,
            activeToolId: activeState ? activeState.toolId : null
        });
    };

    sync();
    const unsubscribe = windowManager.subscribe(sync);

    return Object.freeze({
        id: 'ngvge.workspace-context-window-manager-binding@1',
        sourceId,
        dispose: () => {
            if (disposed) return false;
            disposed = true;
            unsubscribe();
            return writer.release({clear: true});
        }
    });
};

const createWorkspaceContextReadCapability = ({contextService, capabilityLease}) => {
    if (!contextService || typeof contextService.getSnapshot !== 'function' ||
        typeof contextService.subscribe !== 'function') {
        throw new TypeError('Workspace Context read capability requires WorkspaceContextService.');
    }
    if (!capabilityLease || typeof capabilityLease.assert !== 'function' ||
        typeof capabilityLease.isActive !== 'function') {
        throw new TypeError('Workspace Context read capability requires a Tool Capability lease.');
    }
    const assertLease = () => capabilityLease.assert(
        WORKSPACE_TOOL_CAPABILITIES.CONTEXT_READ,
        TOOL_CAPABILITY_ACCESS.QUERY
    );
    assertLease();

    const getSnapshot = () => {
        assertLease();
        return contextService.getSnapshot();
    };

    const subscribe = listener => {
        if (typeof listener !== 'function') {
            throw new TypeError('Workspace Context capability listener must be a function.');
        }
        assertLease();
        let unsubscribe = null;
        let unsubscribeRevocation = null;
        const cleanup = () => {
            let changed = false;
            if (unsubscribe) {
                const current = unsubscribe;
                unsubscribe = null;
                current();
                changed = true;
            }
            if (unsubscribeRevocation) {
                const current = unsubscribeRevocation;
                unsubscribeRevocation = null;
                current();
                changed = true;
            }
            return changed;
        };
        unsubscribe = contextService.subscribe(event => {
            if (!capabilityLease.isActive()) {
                cleanup();
                return;
            }
            assertLease();
            listener(event);
        });
        if (typeof capabilityLease.subscribeRevocation === 'function') {
            unsubscribeRevocation = capabilityLease.subscribeRevocation(() => cleanup());
        }
        return cleanup;
    };

    return Object.freeze({
        id: WORKSPACE_CONTEXT_READ_CAPABILITY_ID,
        serviceId: contextService.id,
        toolId: capabilityLease.toolId,
        getSnapshot,
        subscribe
    });
};

export {
    WORKSPACE_CONTEXT_SERVICE_ID,
    WORKSPACE_CONTEXT_SNAPSHOT_SCHEMA_VERSION,
    WORKSPACE_CONTEXT_WRITER_LEASE_SCHEMA_VERSION,
    WORKSPACE_CONTEXT_READ_CAPABILITY_ID,
    WORKSPACE_CONTEXT_DOMAINS,
    WORKSPACE_CONTEXT_SOURCE_IDS,
    normalizeDomainValue,
    WorkspaceContextService,
    bindWindowManagerToWorkspaceContext,
    createWorkspaceContextReadCapability
};
