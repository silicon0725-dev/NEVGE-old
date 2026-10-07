'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const fail = message => {
    const error = new Error(message);
    error.code = 'NGVGE_WS3E_LAUNCHPAD_FAILED';
    throw error;
};
const passed = [];
const check = (condition, message) => {
    if (!condition) fail(message);
    passed.push(message);
};

const model = read('src/lib/editor-shell/launchpad-model.js');
const toolRegistry = read('src/lib/editor-shell/tool-registry.js');
const dock = read('src/components/workspace-dock/workspace-dock.jsx');
const launchpad = read('src/components/workspace-launchpad/workspace-launchpad.jsx');
const launchpadCss = read('src/components/workspace-launchpad/workspace-launchpad.css');
const gui = read('src/components/gui/gui.jsx');
const packageJson = read('package.json');

check(
    model.includes("WORKSPACE_LAUNCHPAD_MODEL_ID = 'ngvge.workspace-launchpad-model@1'"),
    'stable Launchpad Model identity'
);
check(model.includes('LAUNCHPAD_ENTRY_SCHEMA_VERSION = 1'), 'Launchpad entry schema v1');
check(model.includes('LAUNCHPAD_SNAPSHOT_SCHEMA_VERSION = 1'), 'Launchpad snapshot schema v1');
[
    "ALL: 'all'",
    "PINNED: 'pinned'",
    "RECENT: 'recent'",
    "FIRST_PARTY: 'first-party'",
    "EXTENSIONS: 'extensions'",
    "DEVELOPER: 'developer'",
    "COMPATIBILITY: 'compatibility'"
].forEach(section => check(model.includes(section), `Launchpad section exists: ${section}`));
check(
    model.includes('WORKSPACE_TOOL_REGISTRY_ID') && model.includes('WORKSPACE_WINDOW_MANAGER_ID') &&
    model.includes('WORKSPACE_DOCK_RUNTIME_MODEL_ID'),
    'Launchpad Model consumes ToolRegistry + WindowManager + DockRuntimeModel'
);
check(
    model.includes("toolRegistry.subscribe(event => this._emit('launchpad:tool-registry-changed'") &&
    model.includes("windowManager.subscribe(event => this._emit('launchpad:window-state-changed'") &&
    model.includes("dockRuntimeModel.subscribe(event => this._emit('launchpad:dock-state-changed'"),
    'Launchpad projection reacts to dynamic tool/window/dock sources'
);
check(
    model.includes('this._dockRuntimeModel.listItems({includeStopped: true})'),
    'All Tools derives inventory from live ToolRegistry-backed Dock projection including stopped tools'
);
check(
    !model.includes('TOOL_IDS.') && !model.includes('CORE_TOOL_DEFINITIONS'),
    'Launchpad Model contains no duplicated static core Tool list'
);
check(
    model.includes('pinned: item.pinned'),
    'Pinned derives from DockRuntimeModel rather than Launchpad-owned state'
);
check(
    model.includes('state.lastFocusedAt') && model.includes('lastFocusedAt > 0') &&
    model.includes('b.lastFocusedAt - a.lastFocusedAt'),
    'Recent derives from WindowManager focus history and sorts newest first'
);
check(
    model.includes('sourceKindToSection') && model.includes('TOOL_SOURCE_KINDS.EXTENSION') &&
    model.includes('TOOL_SOURCE_KINDS.DEVELOPER') && model.includes('TOOL_SOURCE_KINDS.COMPATIBILITY'),
    'source metadata drives First-party/Extensions/Developer/Compatibility categories'
);
check(
    model.includes('entry.title.toLocaleLowerCase().includes') &&
    model.includes('entry.toolId.toLocaleLowerCase().includes') &&
    model.includes("entry.providerId || ''"),
    'Launchpad search filters stable Tool metadata without a search-specific inventory'
);
check(
    !model.includes('activate(') && !model.includes('.open(') && !model.includes('.restore(') &&
    !model.includes('.close(') && !model.includes('.minimize('),
    'Launchpad Model is query-only and owns no WindowManager mutation'
);
check(
    !model.includes('localStorage') && !model.includes('sessionStorage') && !model.includes('windowStateStorage'),
    'WS-3E Launchpad state remains runtime-only and defers persistence to WS-4'
);
check(
    !model.includes('Scratch') && !model.includes('renderer') && !model.includes('extensionManager') && !model.includes('vm.'),
    'Launchpad semantic model contains no Scratch/backend identity'
);
check(
    toolRegistry.includes("FIRST_PARTY: 'first-party'") && toolRegistry.includes("EXTENSION: 'extension'") &&
    toolRegistry.includes("DEVELOPER: 'developer'") && toolRegistry.includes("COMPATIBILITY: 'compatibility'"),
    'ToolDefinition publishes stable source kinds used by Launchpad classification'
);
check(
    toolRegistry.includes('normalizeToolSource') && toolRegistry.includes('unsupported field:'),
    'ToolDefinition source metadata fails closed on unknown fields'
);
check(
    toolRegistry.includes('subscribe(listener)') && toolRegistry.includes("this._emit('tool:registered'") &&
    toolRegistry.includes("this._emit('tool:unregistered'"),
    'ToolRegistry publishes lifecycle events for future plugin Tool installation/removal'
);
check(
    toolRegistry.includes("source: {kind: TOOL_SOURCE_KINDS.COMPATIBILITY, providerId: 'scratch.compatibility'}"),
    'Legacy Sprites remains explicitly classified as Compatibility'
);
check(
    launchpad.includes("[LAUNCHPAD_SECTIONS.ALL]: 'All Tools'") &&
    launchpad.includes("[LAUNCHPAD_SECTIONS.PINNED]: 'Pinned'") &&
    launchpad.includes("[LAUNCHPAD_SECTIONS.RECENT]: 'Recent'") &&
    launchpad.includes("[LAUNCHPAD_SECTIONS.FIRST_PARTY]: 'First-party'") &&
    launchpad.includes("[LAUNCHPAD_SECTIONS.EXTENSIONS]: 'Extensions'") &&
    launchpad.includes("[LAUNCHPAD_SECTIONS.DEVELOPER]: 'Developer'") &&
    launchpad.includes("[LAUNCHPAD_SECTIONS.COMPATIBILITY]: 'Compatibility'"),
    'Launchpad UI presents every required category'
);
check(
    launchpad.includes('launchpadModel.getSnapshot({section, query})') &&
    launchpad.includes('launchpadModel.subscribe('),
    'Launchpad UI consumes live LaunchpadModel snapshots'
);
check(
    launchpad.includes('interactionController.activateTool(entry.toolId)'),
    'Launchpad launch delegates to existing WS-3B interaction authority'
);
check(
    launchpad.includes('interactionController.togglePin(entry.toolId)'),
    'Launchpad pin action delegates to DockRuntimeModel authority through interaction controller'
);
check(
    !launchpad.includes('WindowManager') && !launchpad.includes('windowManager') && !launchpad.includes('TOOL_IDS.'),
    'Launchpad UI owns neither WindowManager nor a duplicate ToolId list'
);
check(
    launchpad.includes('role="dialog"') && launchpad.includes('role="tablist"') && launchpad.includes('role="tab"'),
    'Launchpad exposes dialog/category accessibility structure'
);
check(
    launchpad.includes("event.key === 'Escape'") && launchpad.includes('type="search"'),
    'Launchpad supports keyboard close and searchable tool discovery'
);
check(
    dock.includes('data-ngvge-launchpad-model={WORKSPACE_LAUNCHPAD_MODEL_ID}') &&
    dock.includes('<WorkspaceLaunchpad'),
    'Dock exposes a dedicated Launchpad entry without treating Launchpad as a Tool'
);
check(
    !dock.includes('ngvge.tool.launchpad'),
    'Launchpad itself never receives a ToolId'
);
check(
    dock.includes('launchpadModel={launchpadModel}') && dock.includes('interactionController={interactionController}'),
    'Dock passes the stable query model and existing interaction controller into Launchpad'
);
check(
    launchpadCss.includes('.launchpad[data-placement="bottom"]') &&
    launchpadCss.includes('.launchpad[data-placement="top"]') &&
    launchpadCss.includes('.launchpad[data-placement="left"]') &&
    launchpadCss.includes('.launchpad[data-placement="right"]'),
    'Launchpad panel follows WS-3C Dock placement geometry'
);
check(
    !launchpadCss.includes('@keyframes'),
    'WS-3E does not implement WS-3F minimize/restore animation'
);
check(
    gui.includes('new LaunchpadModel({') && gui.includes('launchpadModel={launchpadModel}'),
    'production GUI owns one Launchpad Model and passes it into Workspace Dock'
);
check(
    gui.includes('data-ngvge-launchpad-model') && gui.includes('WORKSPACE_LAUNCHPAD_MODEL_ID'),
    'Workspace exposes stable Launchpad diagnostics'
);
check(
    !/launchpadModel[\s\S]{0,300}localStorage/.test(gui),
    'production GUI does not persist Launchpad state through ad-hoc localStorage'
);
check(
    packageJson.includes('test:workspace-shell:ws3e:focused') &&
    packageJson.includes('test:workspace-shell:ws3e-webpack') &&
    packageJson.includes('test:workspace-shell:ws3e-webpack-editor'),
    'WS-3E has repeatable focused, Dock-entry, and full Editor-entry Webpack gates'
);

process.stdout.write(`WS-3E Launchpad PASS (${passed.length}/${passed.length}).\n`);
process.stdout.write(`${JSON.stringify({
    launchpadModel: WORKSPACE_LAUNCHPAD_MODEL_ID_FALLBACK(),
    inventoryAuthority: 'ngvge.workspace-tool-registry@1',
    sections: ['all', 'pinned', 'recent', 'first-party', 'extensions', 'developer', 'compatibility'],
    recentSource: 'WindowManager.lastFocusedAt',
    pinnedSource: 'DockRuntimeModel',
    dynamicPluginDiscovery: 'ToolRegistry lifecycle events',
    persistence: 'runtime-only / WS-4 deferred',
    minimizeAnimationDeferredTo: 'WS-3F',
    checks: passed.length
}, null, 2)}\n`);

function WORKSPACE_LAUNCHPAD_MODEL_ID_FALLBACK () {
    return 'ngvge.workspace-launchpad-model@1';
}
