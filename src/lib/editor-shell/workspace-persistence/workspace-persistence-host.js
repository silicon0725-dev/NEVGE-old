import {WORKSPACE_DOCK_RUNTIME_MODEL_ID} from '../dock-runtime-model';
import {WORKSPACE_DOCK_ORGANIZATION_MODEL_ID, normalizeDockOrganizationPreference} from '../dock-organization-model';
import {WORKSPACE_DOCK_PLACEMENT_MODEL_ID} from '../dock-placement-model';
import {WORKSPACE_TOOL_REGISTRY_ID} from '../tool-registry';
import {WORKSPACE_WINDOW_MANAGER_ID} from '../window-manager';
import {
    DOCK_ORGANIZATION_MODE_VALUES,
    DOCK_PRESENTATION_VALUES,
    WORKSPACE_MODE_VALUES,
    createDefaultWorkspaceLayout,
    createDefaultWorkspacePreferences,
    normalizeWorkspaceLayout,
    normalizeWorkspacePreferences
} from './workspace-schema';
import {WorkspaceStorageAdapter} from './workspace-storage-adapter';
import {WORKSPACE_LEGACY_MIGRATION_VERSION, migrateLegacyWorkspaceState} from './workspace-migration';

const WORKSPACE_PERSISTENCE_HOST_ID = 'ngvge.workspace-persistence-host@1';
const WORKSPACE_PERSISTENCE_BOOTSTRAP_ID = 'ngvge.workspace-persistence-bootstrap@1';

let activeHost = null;
const activeHostListeners = new Set();

const freezeDeep = value => {
    if (Array.isArray(value)) {
        value.forEach(freezeDeep);
        return Object.freeze(value);
    }
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
        Object.keys(value).forEach(key => freezeDeep(value[key]));
        return Object.freeze(value);
    }
    return value;
};

const setActiveWorkspacePersistenceHost = host => {
    if (host !== null && (!host || host.id !== WORKSPACE_PERSISTENCE_HOST_ID)) {
        throw new TypeError('Active Workspace Persistence Host must be a valid host or null.');
    }
    activeHost = host;
    activeHostListeners.forEach(listener => listener(activeHost));
};

const getActiveWorkspacePersistenceHost = () => activeHost;

const subscribeActiveWorkspacePersistenceHost = listener => {
    if (typeof listener !== 'function') throw new TypeError('Workspace Persistence Host listener must be a function.');
    activeHostListeners.add(listener);
    return () => activeHostListeners.delete(listener);
};

const cloneLayout = layout => JSON.parse(JSON.stringify(layout));
const clonePreferences = preferences => JSON.parse(JSON.stringify(preferences));

const normalizeLayoutWithRegistry = (toolRegistry, value) => normalizeWorkspaceLayout(value, {
    normalizeOrganization: preference => normalizeDockOrganizationPreference(toolRegistry, preference)
});

const createWorkspacePersistenceBootstrap = ({
    toolRegistry,
    storageAdapter = new WorkspaceStorageAdapter(),
    defaultPinnedToolIds = []
} = {}) => {
    if (!toolRegistry || toolRegistry.id !== WORKSPACE_TOOL_REGISTRY_ID) {
        throw new TypeError('Workspace persistence bootstrap requires the Workspace Tool Registry.');
    }
    const diagnostics = [];
    let layout = null;
    let preferences = null;
    try {
        layout = storageAdapter.readLayout({
            normalizeOrganization: preference => normalizeDockOrganizationPreference(toolRegistry, preference)
        });
    } catch (error) {
        diagnostics.push({code: 'WS4_LAYOUT_READ_INVALID', message: error.message});
    }
    try {
        preferences = storageAdapter.readPreferences();
    } catch (error) {
        diagnostics.push({code: 'WS4_PREFERENCES_READ_INVALID', message: error.message});
    }

    const migration = migrateLegacyWorkspaceState({
        storage: storageAdapter.storage,
        toolRegistry,
        defaultPinnedToolIds
    });
    if (!layout) {
        layout = migration.layout;
        try {
            storageAdapter.writeLayout(layout, {
                normalizeOrganization: preference => normalizeDockOrganizationPreference(toolRegistry, preference)
            });
            diagnostics.push({code: 'WS4_LAYOUT_MIGRATED', migrationId: migration.migrationId});
        } catch (error) {
            diagnostics.push({code: 'WS4_LAYOUT_MIGRATION_WRITE_FAILED', message: error.message});
        }
    }
    if (!preferences) {
        preferences = migration.preferences;
        try {
            storageAdapter.writePreferences(preferences);
            diagnostics.push({code: 'WS4_PREFERENCES_MIGRATED', migrationId: migration.migrationId});
        } catch (error) {
            diagnostics.push({code: 'WS4_PREFERENCES_MIGRATION_WRITE_FAILED', message: error.message});
        }
    }
    layout = normalizeLayoutWithRegistry(toolRegistry, layout || createDefaultWorkspaceLayout({
        pinnedToolIds: defaultPinnedToolIds,
        order: defaultPinnedToolIds
    }));
    preferences = normalizeWorkspacePreferences(preferences || createDefaultWorkspacePreferences());
    return freezeDeep({
        id: WORKSPACE_PERSISTENCE_BOOTSTRAP_ID,
        layout,
        preferences,
        diagnostics: [...migration.diagnostics, ...diagnostics]
    });
};

class WorkspacePersistenceHost {
    constructor ({
        toolRegistry,
        windowManager,
        dockRuntimeModel,
        dockPlacementModel,
        dockOrganizationModel,
        bootstrap,
        storageAdapter = new WorkspaceStorageAdapter(),
        defaultPinnedToolIds = []
    } = {}) {
        if (!toolRegistry || toolRegistry.id !== WORKSPACE_TOOL_REGISTRY_ID) {
            throw new TypeError('Workspace Persistence Host requires the Workspace Tool Registry.');
        }
        if (!windowManager || windowManager.id !== WORKSPACE_WINDOW_MANAGER_ID) {
            throw new TypeError('Workspace Persistence Host requires the Workspace Window Manager.');
        }
        if (!dockRuntimeModel || dockRuntimeModel.id !== WORKSPACE_DOCK_RUNTIME_MODEL_ID) {
            throw new TypeError('Workspace Persistence Host requires the Dock Runtime Model.');
        }
        if (!dockPlacementModel || dockPlacementModel.id !== WORKSPACE_DOCK_PLACEMENT_MODEL_ID) {
            throw new TypeError('Workspace Persistence Host requires the Dock Placement Model.');
        }
        if (!dockOrganizationModel || dockOrganizationModel.id !== WORKSPACE_DOCK_ORGANIZATION_MODEL_ID) {
            throw new TypeError('Workspace Persistence Host requires the Dock Organization Model.');
        }
        this.id = WORKSPACE_PERSISTENCE_HOST_ID;
        this._toolRegistry = toolRegistry;
        this._windowManager = windowManager;
        this._dockRuntimeModel = dockRuntimeModel;
        this._dockPlacementModel = dockPlacementModel;
        this._dockOrganizationModel = dockOrganizationModel;
        this._storageAdapter = storageAdapter;
        this._defaultPinnedToolIds = defaultPinnedToolIds.slice();
        this._layoutExtras = cloneLayout((bootstrap && bootstrap.layout) || createDefaultWorkspaceLayout({
            pinnedToolIds: defaultPinnedToolIds,
            order: defaultPinnedToolIds
        }));
        this._preferences = normalizeWorkspacePreferences(
            (bootstrap && bootstrap.preferences) || createDefaultWorkspacePreferences()
        );
        this._diagnostics = (bootstrap && bootstrap.diagnostics) ? bootstrap.diagnostics.slice() : [];
        this._listeners = new Set();
        this._unsubscribers = [];
        this._started = false;
        this._revision = 0;
        this._writeScheduled = false;
    }

    get revision () {
        return this._revision;
    }

    subscribe (listener) {
        if (typeof listener !== 'function') {
            throw new TypeError('Workspace Persistence Host listener must be a function.');
        }
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    _emit (type) {
        this._revision += 1;
        const event = freezeDeep({
            hostId: this.id,
            revision: this._revision,
            type,
            preferences: this._preferences
        });
        this._listeners.forEach(listener => listener(event));
        return event;
    }

    start () {
        if (this._started) return false;
        this._started = true;
        const schedule = () => this.scheduleLayoutWrite();
        this._unsubscribers.push(this._windowManager.subscribe(schedule));
        this._unsubscribers.push(this._dockRuntimeModel.subscribe(schedule));
        this._unsubscribers.push(this._dockPlacementModel.subscribe(schedule));
        this._unsubscribers.push(this._dockOrganizationModel.subscribe(schedule));
        return true;
    }

    dispose () {
        this._unsubscribers.splice(0).forEach(unsubscribe => unsubscribe());
        this._listeners.clear();
        this._started = false;
        if (getActiveWorkspacePersistenceHost() === this) setActiveWorkspacePersistenceHost(null);
    }

    getPreferences () {
        return this._preferences;
    }

    getLayout () {
        return this.collectLayout();
    }

    getDiagnostics () {
        return freezeDeep(this._diagnostics.slice());
    }

    _collectWindows () {
        return this._windowManager.listStates()
            .filter(state => {
                const descriptor = this._windowManager.getDescriptor(state.windowId);
                return descriptor && descriptor.capabilities.persist;
            })
            .map(state => ({
                windowId: state.windowId,
                toolId: state.toolId,
                visible: state.visible,
                minimized: state.minimized,
                maximized: state.maximized,
                position: {x: state.position.x, y: state.position.y},
                size: {width: state.size.width, height: state.size.height}
            }));
    }

    collectLayout () {
        const items = this._dockRuntimeModel.getSnapshot({includeStopped: true}).items;
        const current = this._layoutExtras;
        const layout = {
            schemaVersion: 1,
            windows: this._collectWindows(),
            dock: {
                pinnedToolIds: items.filter(item => item.pinned).map(item => item.toolId),
                order: this._dockRuntimeModel.getOrder().slice(),
                placement: this._dockPlacementModel.getPreference(),
                organization: this._dockOrganizationModel.getPreference()
            },
            toolPanels: current.toolPanels || {},
            windowOptions: current.windowOptions || {}
        };
        return normalizeLayoutWithRegistry(this._toolRegistry, layout);
    }

    scheduleLayoutWrite () {
        if (this._writeScheduled) return;
        this._writeScheduled = true;
        const flush = () => {
            this._writeScheduled = false;
            this.writeLayoutNow();
        };
        if (typeof queueMicrotask === 'function') queueMicrotask(flush);
        else Promise.resolve().then(flush);
    }

    writeLayoutNow () {
        const layout = this.collectLayout();
        this._layoutExtras = cloneLayout(layout);
        try {
            this._storageAdapter.writeLayout(layout, {
                normalizeOrganization: preference => normalizeDockOrganizationPreference(this._toolRegistry, preference)
            });
        } catch (error) {
            this._diagnostics.push({code: 'WS4_LAYOUT_WRITE_FAILED', message: error.message});
            return false;
        }
        this._emit('workspace:layout-persisted');
        return true;
    }

    _writePreferences (next, type) {
        const normalized = normalizeWorkspacePreferences(next);
        try {
            this._storageAdapter.writePreferences(normalized);
        } catch (error) {
            this._diagnostics.push({code: 'WS4_PREFERENCES_WRITE_FAILED', message: error.message});
            return false;
        }
        this._preferences = normalized;
        this._emit(type);
        return true;
    }

    patchWorkspacePreferences (patch) {
        const workspace = {...this._preferences.workspace, ...patch};
        return this._writePreferences(
            {...clonePreferences(this._preferences), workspace},
            'workspace:preferences-changed'
        );
    }

    setWorkspaceMode (mode) {
        if (!WORKSPACE_MODE_VALUES.includes(mode)) throw new TypeError('Invalid Workspace mode.');
        return this.patchWorkspacePreferences({mode});
    }

    setDockPresentation (dockPresentation) {
        if (!DOCK_PRESENTATION_VALUES.includes(dockPresentation)) throw new TypeError('Invalid Dock presentation.');
        return this.patchWorkspacePreferences({dockPresentation});
    }

    setOrganizationMode (organizationMode) {
        if (!DOCK_ORGANIZATION_MODE_VALUES.includes(organizationMode)) {
            throw new TypeError('Invalid organization mode.');
        }
        return this.patchWorkspacePreferences({organizationMode});
    }

    setDockPlacement (patch) {
        this._dockPlacementModel.patchPreference(patch);
        return true;
    }

    setUserAppearance (appearancePatch) {
        const next = clonePreferences(this._preferences);
        next.user.appearance = {...next.user.appearance, ...appearancePatch};
        return this._writePreferences(next, 'workspace:user-appearance-changed');
    }

    setToolPanelSize (name, value) {
        const allowed = ['projectExplorerWidth', 'projectInspectorWidth', 'blockFlyoutWidth'];
        if (!allowed.includes(name)) throw new TypeError(`Unsupported Workspace tool panel size: ${name}`);
        if (value !== null && (!Number.isFinite(value) || value < 0)) {
            throw new TypeError(`${name} must be a non-negative finite number or null.`);
        }
        const next = cloneLayout(this._layoutExtras);
        next.toolPanels = {...next.toolPanels, [name]: value};
        this._layoutExtras = next;
        return this.writeLayoutNow();
    }

    setWindowOption (windowId, patch) {
        if (typeof windowId !== 'string' || !windowId) {
            throw new TypeError('Workspace window option requires windowId.');
        }
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
            throw new TypeError('Window option patch must be object.');
        }
        const unknown = Object.keys(patch).filter(key => key !== 'autoFit');
        if (unknown.length) throw new Error(`Unsupported Workspace window option(s): ${unknown.join(', ')}`);
        const next = cloneLayout(this._layoutExtras);
        next.windowOptions = {...next.windowOptions,
            [windowId]: {
                ...(next.windowOptions[windowId] || {}),
                ...patch
            }};
        this._layoutExtras = next;
        return this.writeLayoutNow();
    }

    resetLayout () {
        const defaults = createDefaultWorkspaceLayout({
            pinnedToolIds: this._defaultPinnedToolIds,
            order: this._defaultPinnedToolIds
        });
        this._layoutExtras = cloneLayout(defaults);
        this._storageAdapter.writeLayout(defaults, {
            normalizeOrganization: preference => normalizeDockOrganizationPreference(this._toolRegistry, preference)
        });
        this._emit('workspace:layout-reset');
        return true;
    }

    getState () {
        return freezeDeep({
            hostId: this.id,
            revision: this._revision,
            started: this._started,
            layoutSchemaVersion: 1,
            preferencesSchemaVersion: 1,
            migrationVersion: this._preferences.device.migrationVersion || WORKSPACE_LEGACY_MIGRATION_VERSION,
            diagnostics: this.getDiagnostics()
        });
    }
}

export {
    WORKSPACE_PERSISTENCE_HOST_ID,
    WORKSPACE_PERSISTENCE_BOOTSTRAP_ID,
    createWorkspacePersistenceBootstrap,
    WorkspacePersistenceHost,
    setActiveWorkspacePersistenceHost,
    getActiveWorkspacePersistenceHost,
    subscribeActiveWorkspacePersistenceHost
};
