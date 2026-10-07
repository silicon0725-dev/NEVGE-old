/* eslint-disable max-len */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const fail = message => {
    const error = new Error(message);
    error.code = 'NGVGE_WS4_WORKSPACE_PERSISTENCE_SETTINGS_FAILED';
    throw error;
};
const passed = [];
const check = (condition, message) => {
    if (!condition) fail(message);
    passed.push(message);
};

const schema = read('src/lib/editor-shell/workspace-persistence/workspace-schema.js');
const storage = read('src/lib/editor-shell/workspace-persistence/workspace-storage-adapter.js');
const migration = read('src/lib/editor-shell/workspace-persistence/workspace-migration.js');
const host = read('src/lib/editor-shell/workspace-persistence/workspace-persistence-host.js');
const bridge = read('src/lib/editor-shell/workspace-persistence/workspace-preference-bridge.js');
const persistentSettings = read('src/lib/tw-persistent-settings.js');
const themePersistence = read('src/lib/themes/themePersistance.js');
const stateManager = read('src/lib/tw-state-manager-hoc.jsx');
const gui = read('src/components/gui/gui.jsx');
const dock = read('src/components/workspace-dock/workspace-dock.jsx');
const settingsContainer = read('src/containers/tw-settings-modal.jsx');
const settings = read('src/components/tw-settings-modal/settings-modal.jsx');
const organization = read('src/lib/editor-shell/dock-organization-model.js');
const packageJson = read('package.json');

check(schema.includes("WORKSPACE_LAYOUT_SCHEMA_ID = 'ngvge.workspace-layout@1'"), 'WorkspaceLayoutSchema v1 stable identity');
check(schema.includes("WORKSPACE_PREFERENCES_SCHEMA_ID = 'ngvge.workspace-preferences@1'"), 'WorkspacePreferencesSchema v1 stable identity');
check(
    ['PROJECT', 'WORKSPACE', 'USER', 'DEVICE', 'SESSION', 'SECRET'].every(scope => schema.includes(`${scope}:`)),
    'Project / Workspace / User / Device / Session / Secret scopes are explicit'
);
check(
    schema.includes('windowLayout: WORKSPACE_PERSISTENCE_SCOPES.WORKSPACE') &&
    schema.includes('dockPlacement: WORKSPACE_PERSISTENCE_SCOPES.WORKSPACE') &&
    schema.includes('dockPresentation: WORKSPACE_PERSISTENCE_SCOPES.WORKSPACE') &&
    schema.includes('dockOrganization: WORKSPACE_PERSISTENCE_SCOPES.WORKSPACE') &&
    schema.includes('pinnedTools: WORKSPACE_PERSISTENCE_SCOPES.WORKSPACE'),
    'Window/Dock/pinned domains are Workspace-scoped'
);
check(
    schema.includes('userAppearance: WORKSPACE_PERSISTENCE_SCOPES.USER') &&
    schema.includes('projectState: WORKSPACE_PERSISTENCE_SCOPES.PROJECT') &&
    schema.includes('sessionUI: WORKSPACE_PERSISTENCE_SCOPES.SESSION') &&
    schema.includes('secret: WORKSPACE_PERSISTENCE_SCOPES.SECRET'),
    'appearance/project/session/secret domains retain separate authority scopes'
);
check(
    schema.includes("const LAYOUT_FIELDS = Object.freeze(['schemaId', 'schemaVersion', 'windows', 'dock', 'toolPanels', 'windowOptions'])"),
    'Layout schema explicitly contains window/Dock/tool-panel domains'
);
check(
    schema.includes("DOCK_PRESENTATION_VALUES = Object.freeze(['floating', 'sidebar', 'drawer', 'compact-shelf'])") &&
    schema.includes("DOCK_ORGANIZATION_MODE_VALUES = Object.freeze(['flat', 'grouped', 'custom'])"),
    'Workspace Preferences v1 carries required presentation and organization modes'
);
check(
    storage.includes("LAYOUT: 'ngvge:workspace:layout:v1'") &&
    storage.includes("WORKSPACE_PREFERENCES: 'ngvge:workspace:preferences:workspace:v1'") &&
    storage.includes("USER_PREFERENCES: 'ngvge:workspace:preferences:user:v1'") &&
    storage.includes("DEVICE_PREFERENCES: 'ngvge:workspace:preferences:device:v1'"),
    'durable storage is physically separated by Layout/Workspace/User/Device scope'
);
check(
    !storage.includes('ngvge:workspace:secret') && !storage.includes('ngvge:workspace:session') &&
    !storage.includes('ngvge:workspace:project'),
    'Secret / Session / Project have no WS-4 local storage keys'
);
check(
    migration.includes("WORKSPACE_LEGACY_MIGRATION_ID = 'ngvge.workspace-legacy-migration@1'") &&
    migration.includes("WINDOW_STATES: 'scratch-gui-window-states'") &&
    migration.includes("CUSTOM_UI: 'tw:customUI'") && migration.includes("THEME: 'tw:theme'") &&
    migration.includes("BLOCK_FLYOUT_WIDTH: 'tw:blockFlyoutWidth'"),
    'legacy Workspace/window/UI sources are explicit migration inputs'
);
check(!migration.includes('.removeItem('), 'migration preserves Legacy fallback records during migration window');
check(host.includes("WORKSPACE_PERSISTENCE_HOST_ID = 'ngvge.workspace-persistence-host@1'"), 'single Workspace Persistence Host identity');
check(
    host.includes('descriptor && descriptor.capabilities.persist') && host.includes('this._windowManager.listStates()'),
    'Host persists only WindowManager windows explicitly marked persistable'
);
check(
    host.includes('this._dockRuntimeModel.getSnapshot({includeStopped: true})') &&
    host.includes('this._dockPlacementModel.getPreference()') && host.includes('this._dockOrganizationModel.getPreference()'),
    'Host serializes Dock pin/order/placement/organization from existing WS-3 owners'
);
check(
    host.includes('setActiveWorkspacePersistenceHost') && host.includes('subscribeActiveWorkspacePersistenceHost'),
    'Settings-facing active Host seam avoids window/global authority'
);
check(
    bridge.includes('getActiveWorkspacePersistenceHost()') && bridge.includes('WorkspaceStorageAdapter') &&
    !bridge.includes('window.vm'),
    'legacy synchronous preference clients bridge into WS-4 without VM/global authority'
);
check(
    persistentSettings.includes('setWorkspaceModeCustomUI(customUI === true)') &&
    persistentSettings.includes('setWorkspaceEditorBackground(serializePersistentEditorBackground(editorBackground))') &&
    persistentSettings.includes("setWorkspaceToolPanelSize('blockFlyoutWidth', width)"),
    'Custom UI/background/block width new writers route into scoped WS-4 persistence'
);
check(
    themePersistence.includes('setWorkspaceThemePreference(') && !themePersistence.includes('localStorage.setItem('),
    'theme writer uses User-scope WS-4 bridge and never rewrites legacy theme key'
);
check(
    stateManager.includes('getPersistentCustomUI') && !stateManager.includes("localStorage.setItem('tw:customUI'"),
    'startup Custom UI preference consumes WS-4 bridge instead of direct legacy writer'
);
check(
    gui.includes('new WorkspaceStorageAdapter()') && gui.includes('createWorkspacePersistenceBootstrap({') &&
    gui.includes('new WorkspacePersistenceHost({') && gui.includes('setActiveWorkspacePersistenceHost(workspacePersistenceHost)'),
    'production GUI installs one WS-4 bootstrap/storage/Host pipeline'
);
check(
    gui.includes('workspacePersistenceBootstrap.layout.windows.map') &&
    gui.includes('workspacePersistenceBootstrap.layout.dock.pinnedToolIds') &&
    gui.includes('preference: workspacePersistenceBootstrap.layout.dock.placement') &&
    gui.includes('preference: workspacePersistenceBootstrap.layout.dock.organization'),
    'production Workspace initializes Window/Dock models from versioned layout'
);
check(
    gui.includes("workspacePersistenceHost.setToolPanelSize('projectExplorerWidth'") &&
    gui.includes('workspacePersistenceHost.setWindowOption(STAGE_WINDOW.windowId, {autoFit: stageWindowAutoFit})'),
    'tool-panel dimensions and window options persist through WS-4 Host'
);
check(
    (gui.match(/enableStatePersistence=\{false\}/g) || []).length >= 5,
    'Custom Workspace managed windows disable duplicate Legacy DraggableWindow persistence'
);
check(
    gui.includes('if (customUI) return;') && gui.includes('windowStateStorage.saveWindowState'),
    'Legacy windowStateStorage remains Classic/compatibility-only writer'
);
check(
    settingsContainer.includes('getActiveWorkspacePersistenceHost') &&
    settingsContainer.includes('subscribeActiveWorkspacePersistenceHost') &&
    settingsContainer.includes('setDockPresentation') && settingsContainer.includes('setDockPlacement') &&
    settingsContainer.includes('setOrganizationMode'),
    'Settings is a client of active WS-4 Host, not an independent persistence owner'
);
check(
    settings.includes('Floating Dock') && settings.includes('Sidebar') && settings.includes('Drawer') &&
    settings.includes('Compact Shelf'),
    'Settings exposes all Handoff Dock presentation modes'
);
check(
    ['top', 'bottom', 'left', 'right'].every(value => settings.includes(`value="${value}"`)) &&
    ['start', 'center', 'end'].every(value => settings.includes(`value="${value}"`)) &&
    settings.includes('onOffsetXChange') && settings.includes('onOffsetYChange'),
    'Settings exposes four-edge placement, alignment and X/Y offsets'
);
check(
    ['flat', 'grouped', 'custom'].every(value => settings.includes(`value="${value}"`)),
    'Settings exposes flat/grouped/custom organization modes'
);
check(
    settings.includes('workspacePreset') && settingsContainer.includes("preset === 'left-sidebar'") &&
    settingsContainer.includes("preset === 'compact-bottom'") && settingsContainer.includes("preset === 'bottom-drawer'"),
    'Settings supports presets plus advanced controls over the same v1 preferences'
);
check(
    settingsContainer.includes('windowStateStorage.clearAllWindowStates()') &&
    settingsContainer.includes('this._workspacePersistenceHost.resetLayout()'),
    'Reset clears versioned Layout and Legacy fallback together'
);
check(
    dock.includes('data-ngvge-dock-presentation={presentation}') &&
    dock.includes('data-ngvge-dock-organization-mode={organizationMode}'),
    'Dock presentation is projected from WS-4 preference without creating new semantic identity'
);
check(
    organization.includes("CONTAINER_FIELDS = Object.freeze(['schemaVersion'") &&
    organization.includes("SEPARATOR_FIELDS = Object.freeze(['schemaVersion'"),
    'WS-3D organization preference is now serialization round-trip safe'
);
check(
    !schema.includes('apiKey') && !schema.includes('gitToken') && !schema.includes('credential'),
    'Workspace schemas contain no credential/Secret payload fields'
);
check(
    packageJson.includes('test:workspace-shell:ws4:focused') && packageJson.includes('test:workspace-shell:ws4-webpack') &&
    packageJson.includes('test:workspace-shell:ws4-webpack-editor'),
    'WS-4 defines repeatable focused and real production Webpack gates'
);

process.stdout.write(`WS-4 Workspace Persistence / Settings PASS (${passed.length}/${passed.length}).\n`);
process.stdout.write(`${JSON.stringify({
    layoutSchema: 'ngvge.workspace-layout@1',
    preferencesSchema: 'ngvge.workspace-preferences@1',
    persistenceHost: 'ngvge.workspace-persistence-host@1',
    migration: 'ngvge.workspace-legacy-migration@1',
    scopes: ['project', 'workspace', 'user', 'device', 'session', 'secret'],
    checks: passed.length
}, null, 2)}\n`);
