import {normalizeEditorBackground, defaultEditorBackground} from '../../editor-background';
import {DEFAULT_DOCK_ORGANIZATION_PREFERENCE} from '../dock-organization-model';
import {
    DEFAULT_DOCK_PLACEMENT_PREFERENCE,
    normalizeDockPlacementPreference
} from '../dock-placement-model';

const WORKSPACE_LAYOUT_SCHEMA_ID = 'ngvge.workspace-layout@1';
const WORKSPACE_LAYOUT_SCHEMA_VERSION = 1;
const WORKSPACE_PREFERENCES_SCHEMA_ID = 'ngvge.workspace-preferences@1';
const WORKSPACE_PREFERENCES_SCHEMA_VERSION = 1;

const WORKSPACE_PERSISTENCE_SCOPES = Object.freeze({
    PROJECT: 'project',
    WORKSPACE: 'workspace',
    USER: 'user',
    DEVICE: 'device',
    SESSION: 'session',
    SECRET: 'secret'
});

const WORKSPACE_MODE_VALUES = Object.freeze(['custom', 'classic']);
const DOCK_PRESENTATION_VALUES = Object.freeze(['floating', 'sidebar', 'drawer', 'compact-shelf']);
const DOCK_ORGANIZATION_MODE_VALUES = Object.freeze(['flat', 'grouped', 'custom']);

const WORKSPACE_PERSISTED_DOMAIN_SCOPES = Object.freeze({
    windowLayout: WORKSPACE_PERSISTENCE_SCOPES.WORKSPACE,
    dockPlacement: WORKSPACE_PERSISTENCE_SCOPES.WORKSPACE,
    dockPresentation: WORKSPACE_PERSISTENCE_SCOPES.WORKSPACE,
    dockOrganization: WORKSPACE_PERSISTENCE_SCOPES.WORKSPACE,
    pinnedTools: WORKSPACE_PERSISTENCE_SCOPES.WORKSPACE,
    toolPanelSizes: WORKSPACE_PERSISTENCE_SCOPES.WORKSPACE,
    windowGeometry: WORKSPACE_PERSISTENCE_SCOPES.WORKSPACE,
    windowState: WORKSPACE_PERSISTENCE_SCOPES.WORKSPACE,
    workspaceMode: WORKSPACE_PERSISTENCE_SCOPES.WORKSPACE,
    userAppearance: WORKSPACE_PERSISTENCE_SCOPES.USER,
    projectState: WORKSPACE_PERSISTENCE_SCOPES.PROJECT,
    sessionUI: WORKSPACE_PERSISTENCE_SCOPES.SESSION,
    secret: WORKSPACE_PERSISTENCE_SCOPES.SECRET
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

const assertKnownFields = (source, fields, label) => {
    const unknown = Object.keys(source).filter(key => !fields.includes(key));
    if (unknown.length) throw new Error(`${label} contains unsupported field(s): ${unknown.join(', ')}`);
};

const assertStableToolId = value => {
    if (typeof value !== 'string' || !/^ngvge\.tool\.[a-z0-9][a-z0-9.-]*$/.test(value)) {
        throw new TypeError('Workspace persisted ToolId must be a stable ngvge.tool.* identifier.');
    }
    return value;
};

const assertWindowId = value => {
    if (typeof value !== 'string' || !value.trim()) throw new TypeError('Workspace windowId must be non-empty.');
    return value;
};

const normalizeFinitePoint = (value, label) => {
    if (!isPlainObject(value) || !Number.isFinite(value.x) || !Number.isFinite(value.y)) {
        throw new TypeError(`${label} must be a finite {x, y} point.`);
    }
    return {x: value.x, y: value.y};
};

const normalizeFiniteSize = (value, label) => {
    if (!isPlainObject(value) || !Number.isFinite(value.width) || !Number.isFinite(value.height) ||
        value.width < 0 || value.height < 0) {
        throw new TypeError(`${label} must be a non-negative finite {width, height} size.`);
    }
    return {width: value.width, height: value.height};
};

const uniqueStableToolIds = (values, label) => {
    if (!Array.isArray(values)) throw new TypeError(`${label} must be an array.`);
    const seen = new Set();
    return values.map(assertStableToolId).map(toolId => {
        if (seen.has(toolId)) throw new Error(`${label} contains duplicate ToolId: ${toolId}`);
        seen.add(toolId);
        return toolId;
    });
};

const WINDOW_FIELDS = Object.freeze([
    'windowId', 'toolId', 'visible', 'minimized', 'maximized', 'position', 'size'
]);
const normalizePersistedWindow = value => {
    if (!isPlainObject(value)) throw new TypeError('Workspace persisted window must be a plain object.');
    assertKnownFields(value, WINDOW_FIELDS, 'Workspace persisted window');
    const visible = value.visible !== false;
    return freezeDeep({
        windowId: assertWindowId(value.windowId),
        toolId: assertStableToolId(value.toolId),
        visible,
        minimized: visible && Boolean(value.minimized),
        maximized: visible && Boolean(value.maximized),
        position: normalizeFinitePoint(value.position, 'Workspace persisted window position'),
        size: normalizeFiniteSize(value.size, 'Workspace persisted window size')
    });
};

const TOOL_PANEL_FIELDS = Object.freeze(['projectExplorerWidth', 'projectInspectorWidth', 'blockFlyoutWidth']);
const normalizeOptionalPositiveNumber = (value, label) => {
    if (value === null || typeof value === 'undefined') return null;
    if (!Number.isFinite(value) || value < 0) {
        throw new TypeError(`${label} must be a non-negative finite number or null.`);
    }
    return value;
};
const normalizeToolPanels = value => {
    const source = isPlainObject(value) ? value : {};
    assertKnownFields(source, TOOL_PANEL_FIELDS, 'Workspace toolPanels');
    return freezeDeep({
        projectExplorerWidth: normalizeOptionalPositiveNumber(source.projectExplorerWidth, 'projectExplorerWidth'),
        projectInspectorWidth: normalizeOptionalPositiveNumber(source.projectInspectorWidth, 'projectInspectorWidth'),
        blockFlyoutWidth: normalizeOptionalPositiveNumber(source.blockFlyoutWidth, 'blockFlyoutWidth')
    });
};

const WINDOW_OPTION_FIELDS = Object.freeze(['autoFit']);
const normalizeWindowOptions = value => {
    const source = isPlainObject(value) ? value : {};
    const result = {};
    Object.keys(source).forEach(windowId => {
        assertWindowId(windowId);
        const options = source[windowId];
        if (!isPlainObject(options)) throw new TypeError(`Workspace windowOptions.${windowId} must be a plain object.`);
        assertKnownFields(options, WINDOW_OPTION_FIELDS, `Workspace windowOptions.${windowId}`);
        result[windowId] = {autoFit: Boolean(options.autoFit)};
    });
    return freezeDeep(result);
};

const LAYOUT_FIELDS = Object.freeze(['schemaId', 'schemaVersion', 'windows', 'dock', 'toolPanels', 'windowOptions']);
const DOCK_LAYOUT_FIELDS = Object.freeze(['pinnedToolIds', 'order', 'placement', 'organization']);

const normalizeWorkspaceLayout = (value, {normalizeOrganization = null} = {}) => {
    const source = isPlainObject(value) ? value : {};
    assertKnownFields(source, LAYOUT_FIELDS, 'Workspace layout');
    if (typeof source.schemaId !== 'undefined' && source.schemaId !== WORKSPACE_LAYOUT_SCHEMA_ID) {
        throw new Error(`Unsupported WorkspaceLayoutSchema id: ${source.schemaId}`);
    }
    if (typeof source.schemaVersion !== 'undefined' && source.schemaVersion !== WORKSPACE_LAYOUT_SCHEMA_VERSION) {
        throw new Error(`Unsupported WorkspaceLayoutSchema version: ${source.schemaVersion}`);
    }
    const dock = isPlainObject(source.dock) ? source.dock : {};
    assertKnownFields(dock, DOCK_LAYOUT_FIELDS, 'Workspace layout dock');
    const windows = Array.isArray(source.windows) ? source.windows.map(normalizePersistedWindow) : [];
    const windowIds = new Set();
    windows.forEach(entry => {
        if (windowIds.has(entry.windowId)) throw new Error(`Duplicate persisted WindowId: ${entry.windowId}`);
        windowIds.add(entry.windowId);
    });
    const normalizeOrg = typeof normalizeOrganization === 'function' ? normalizeOrganization : value_ => value_;
    const organizationCandidate = typeof dock.organization === 'undefined' ?
        DEFAULT_DOCK_ORGANIZATION_PREFERENCE : dock.organization;
    const organization = normalizeOrg(organizationCandidate);
    return freezeDeep({
        schemaVersion: WORKSPACE_LAYOUT_SCHEMA_VERSION,
        windows,
        dock: {
            pinnedToolIds: uniqueStableToolIds(dock.pinnedToolIds || [], 'Workspace pinnedToolIds'),
            order: uniqueStableToolIds(dock.order || [], 'Workspace Dock order'),
            placement: normalizeDockPlacementPreference(
                typeof dock.placement === 'undefined' ? DEFAULT_DOCK_PLACEMENT_PREFERENCE : dock.placement
            ),
            organization
        },
        toolPanels: normalizeToolPanels(source.toolPanels),
        windowOptions: normalizeWindowOptions(source.windowOptions)
    });
};

const PREFERENCES_FIELDS = Object.freeze(['schemaId', 'schemaVersion', 'workspace', 'user', 'device']);
const WORKSPACE_PREF_FIELDS = Object.freeze(['mode', 'dockPresentation', 'organizationMode']);
const USER_PREF_FIELDS = Object.freeze(['appearance']);
const APPEARANCE_FIELDS = Object.freeze(['editorBackground', 'theme']);
const DEVICE_PREF_FIELDS = Object.freeze(['migrationVersion']);

const assertEnum = (value, values, label) => {
    if (!values.includes(value)) throw new TypeError(`${label} must be one of: ${values.join(', ')}.`);
    return value;
};

const normalizeThemePreference = value => {
    if (value === null || typeof value === 'undefined') return null;
    if (!isPlainObject(value)) throw new TypeError('Workspace user theme preference must be an object or null.');
    const allowed = ['accent', 'gui', 'blocks'];
    assertKnownFields(value, allowed, 'Workspace user theme preference');
    const result = {};
    allowed.forEach(key => {
        if (typeof value[key] === 'undefined') return;
        if (typeof value[key] !== 'string' || !value[key]) throw new TypeError(`Theme ${key} must be a string.`);
        result[key] = value[key];
    });
    return freezeDeep(result);
};

const normalizeWorkspacePreferences = value => {
    const source = isPlainObject(value) ? value : {};
    assertKnownFields(source, PREFERENCES_FIELDS, 'Workspace preferences');
    if (typeof source.schemaId !== 'undefined' && source.schemaId !== WORKSPACE_PREFERENCES_SCHEMA_ID) {
        throw new Error(`Unsupported WorkspacePreferencesSchema id: ${source.schemaId}`);
    }
    if (typeof source.schemaVersion !== 'undefined' && source.schemaVersion !== WORKSPACE_PREFERENCES_SCHEMA_VERSION) {
        throw new Error(`Unsupported WorkspacePreferencesSchema version: ${source.schemaVersion}`);
    }
    const workspace = isPlainObject(source.workspace) ? source.workspace : {};
    const user = isPlainObject(source.user) ? source.user : {};
    const appearance = isPlainObject(user.appearance) ? user.appearance : {};
    const device = isPlainObject(source.device) ? source.device : {};
    assertKnownFields(workspace, WORKSPACE_PREF_FIELDS, 'Workspace preference scope');
    assertKnownFields(user, USER_PREF_FIELDS, 'User preference scope');
    assertKnownFields(appearance, APPEARANCE_FIELDS, 'User appearance preference');
    assertKnownFields(device, DEVICE_PREF_FIELDS, 'Device preference scope');
    return freezeDeep({
        schemaVersion: WORKSPACE_PREFERENCES_SCHEMA_VERSION,
        workspace: {
            mode: assertEnum(workspace.mode || 'custom', WORKSPACE_MODE_VALUES, 'Workspace mode'),
            dockPresentation: assertEnum(
                workspace.dockPresentation || 'floating',
                DOCK_PRESENTATION_VALUES,
                'Dock presentation'
            ),
            organizationMode: assertEnum(
                workspace.organizationMode || 'custom',
                DOCK_ORGANIZATION_MODE_VALUES,
                'Dock organization mode'
            )
        },
        user: {
            appearance: {
                editorBackground: normalizeEditorBackground(appearance.editorBackground || defaultEditorBackground),
                theme: normalizeThemePreference(appearance.theme)
            }
        },
        device: {
            migrationVersion: Number.isInteger(device.migrationVersion) && device.migrationVersion >= 0 ?
                device.migrationVersion : 0
        }
    });
};

const createDefaultWorkspaceLayout = ({pinnedToolIds = [], order = []} = {}) => normalizeWorkspaceLayout({
    schemaVersion: WORKSPACE_LAYOUT_SCHEMA_VERSION,
    windows: [],
    dock: {
        pinnedToolIds,
        order,
        placement: DEFAULT_DOCK_PLACEMENT_PREFERENCE,
        organization: DEFAULT_DOCK_ORGANIZATION_PREFERENCE
    },
    toolPanels: {},
    windowOptions: {}
});

const createDefaultWorkspacePreferences = () => normalizeWorkspacePreferences({
    schemaVersion: WORKSPACE_PREFERENCES_SCHEMA_VERSION,
    workspace: {},
    user: {appearance: {}},
    device: {}
});

export {
    WORKSPACE_LAYOUT_SCHEMA_ID,
    WORKSPACE_LAYOUT_SCHEMA_VERSION,
    WORKSPACE_PREFERENCES_SCHEMA_ID,
    WORKSPACE_PREFERENCES_SCHEMA_VERSION,
    WORKSPACE_PERSISTENCE_SCOPES,
    WORKSPACE_PERSISTED_DOMAIN_SCOPES,
    WORKSPACE_MODE_VALUES,
    DOCK_PRESENTATION_VALUES,
    DOCK_ORGANIZATION_MODE_VALUES,
    normalizePersistedWindow,
    normalizeWorkspaceLayout,
    normalizeWorkspacePreferences,
    createDefaultWorkspaceLayout,
    createDefaultWorkspacePreferences
};
