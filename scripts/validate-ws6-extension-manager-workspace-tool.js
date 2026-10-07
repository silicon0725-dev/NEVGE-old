#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const checks = [];
const check = (condition, label) => {
    if (!condition) {
        process.stderr.write(`WS-6 FAIL: ${label}\n`);
        process.exit(1);
    }
    checks.push(label);
};

const model = read('src/lib/editor-shell/extension-manager-model.js');
const runtime = read('src/lib/editor-shell/extension-manager-runtime.js');
const discovery = read('src/lib/editor-shell/extension-manager-discovery.js');
const legacy = read('src/lib/editor-shell/legacy-addon-manager-adapter.js');
const component = read('src/components/workspace-extension-manager/workspace-extension-manager.jsx');
const gui = read('src/components/gui/gui.jsx');
const registry = read('src/lib/editor-shell/tool-registry.js');
const dock = read('src/components/workspace-dock/workspace-dock.jsx');
const extensionRegistry = read('src/lib/extension-hub/extension-registry.js');
const packageJson = read('package.json');

const extensionManagerDefinition = registry.slice(
    registry.indexOf('id: TOOL_IDS.EXTENSION_MANAGER'),
    registry.indexOf('id: TOOL_IDS.EDITOR')
);
const listStart = component.indexOf('<div className={styles.listPane}>');
const detailStart = component.indexOf('<aside className={styles.detailPane}>');
const listSource = component.slice(listStart, detailStart);
const detailSource = component.slice(detailStart);

check(
    model.includes("WORKSPACE_EXTENSION_MANAGER_MODEL_ID = 'ngvge.workspace-extension-manager-model@1'") &&
    runtime.includes("WORKSPACE_EXTENSION_MANAGER_RUNTIME_ID = 'ngvge.workspace-extension-manager-runtime@1'") &&
    discovery.includes("EXTENSION_MANAGER_DISCOVERY_ADAPTER_ID = 'ngvge.workspace-extension-manager-discovery@1'") &&
    legacy.includes("LEGACY_ADDON_MANAGER_ADAPTER_ID = 'ngvge.workspace-extension-manager.legacy-addon-adapter@1'"),
    'Workspace Extension Manager model/runtime/discovery/legacy adapter identities are stable'
);
check(
    model.includes('WORKSPACE_EXTENSION_MANAGER_ITEM_SCHEMA_VERSION = 1'),
    'Extension Manager projection item schema is v1'
);
check(
    registry.includes("EXTENSION_MANAGER: 'ngvge.tool.extension-manager'") &&
    registry.includes("EXTENSION_MANAGER: 'extension-manager'"),
    'Extension Manager ToolId and WindowId are stable and distinct'
);
check(
    extensionManagerDefinition.includes("title: 'Extension Manager'") &&
    extensionManagerDefinition.includes("commandScope: 'extensions'") &&
    extensionManagerDefinition.includes('source: {kind: TOOL_SOURCE_KINDS.FIRST_PARTY') &&
    extensionManagerDefinition.includes('singleton: true') &&
    extensionManagerDefinition.includes('defaultVisible: false'),
    'Extension Manager is a default-hidden singleton first-party Workspace Tool'
);
check(
    dock.includes("'extension-manager': (") && dock.includes('<svg'),
    'Extension Manager exposes an SVG-only Workspace Dock icon'
);
check(
    ['All', 'Installed', 'Enabled', 'Disabled', 'Updates'].every(label => component.includes(`label: '${label}'`)),
    'Navigation exposes All/Installed/Enabled/Disabled/Updates'
);
check(
    ['NGVGE Modules', 'Scratch Extensions', 'Legacy Addons'].every(label => component.includes(`label: '${label}'`)),
    'Navigation exposes the three required runtime-host categories'
);
check(
    ['Overview', 'Settings', 'Permissions', 'Compatibility', 'About']
        .every(label => component.includes(`'${label}'`)),
    'Detail Inspector exposes Overview/Settings/Permissions/Compatibility/About'
);
check(
    listStart >= 0 && detailStart > listStart && !listSource.includes('renderSettingControl(') &&
    detailSource.includes('renderSettingControl('),
    'complete extension settings are detail-only and never inline-expanded in the compact list'
);
check(
    model.includes("import {EXTENSION_HOST_KINDS} from '../extension-containment'") &&
    model.includes('containmentClient.getDescriptor(') && model.includes('containmentClient.listDescriptors'),
    'ManagerModel depends on LEX ExtensionDescriptor host/trust boundary'
);
check(
    model.includes('makeTrustProjection') && model.includes('evaluated: false') && model.includes('level: null') &&
    component.includes('Trust not evaluated'),
    'discovery-only extensions do not fabricate effective trust'
);
check(
    model.includes('moduleClient.enableModule(') && model.includes('moduleClient.disableModule('),
    'NGVGE Module enable/disable delegates to the Module Manager client'
);
check(
    model.includes('this._scratchExtensionHost.loadBuiltInExtension(') &&
    model.includes('this._scratchExtensionHost.loadExtensionURL(') &&
    model.includes('this._scratchExtensionHost.unloadExtension('),
    'Scratch Extension lifecycle delegates to ScratchExtensionHost'
);
check(
    model.includes('this._legacyAddonAdapter.setEnabled(') && model.includes('this._legacyAddonAdapter.setSetting('),
    'Legacy Addon enable/settings delegate to the Legacy Addon adapter'
);
check(
    runtime.includes('installScratchExtensionHost(vm)') &&
    runtime.includes('installExtensionContainmentHost(vm)') &&
    runtime.includes('getFirstPartyModuleClient(vm.runtime)') &&
    runtime.includes('createLegacyAddonManagerAdapter(vm)'),
    'runtime factory composes separate host clients instead of replacing them with one execution authority'
);
check(
    legacy.includes('installLegacyAddonHost(vm)') && legacy.includes('host.registerAddon(addonId, manifest)'),
    'Legacy Addon catalog registers LEX descriptors through LegacyAddonHost without direct execution'
);
check(
    discovery.includes('extensionLibraryContent') && discovery.includes('extensionRegistry.list()') &&
    discovery.includes('EXTENSION_HOST_KINDS.SCRATCH_EXTENSION'),
    'Scratch discovery merges existing library/catalog sources without becoming a runtime host'
);
check(
    extensionRegistry.includes('subscribe (listener)') && (
        extensionRegistry.includes("type: 'extension:registered'") ||
        extensionRegistry.includes("this._emit('extension:registered'")
    ),
    'extension discovery registry publishes change events for live Workspace projection'
);
check(
    !model.includes('_loadedExtensions') && !model.includes('extensionManager.') && !model.includes('window.vm') &&
    !model.includes('ModuleManager') && !component.includes('window.vm'),
    'Manager presentation/model has no backend-private Scratch or Module Manager authority'
);
check(
    !model.includes('localStorage') && !runtime.includes('localStorage') && !component.includes('localStorage') &&
    !discovery.includes('localStorage'),
    'Extension Manager creates no parallel localStorage persistence authority'
);
check(
    (gui.match(/createWorkspaceExtensionManagerModelForVM\s*\(/g) || []).length === 1 &&
    gui.includes('extensionManagerModel.dispose()'),
    'production GUI owns exactly one Extension Manager model lifecycle'
);
check(
    gui.includes('windowManager.registerWindow(createWindowDescriptor(EXTENSION_MANAGER_TOOL)') || (
        gui.includes('EXTENSION_MANAGER_TOOL') && gui.includes('EXTENSION_MANAGER_WINDOW')
    ),
    'Extension Manager WindowModel is registered with WindowManager'
);
check(
    gui.includes('case TOOL_IDS.EXTENSION_MANAGER:') &&
    gui.includes('handleOpenExtensionManager();') &&
    gui.includes('return {windowId: EXTENSION_MANAGER_WINDOW.windowId};'),
    'Dock/Launchpad activation uses the existing Workspace launch authority'
);
check(
    gui.includes('<WorkspaceExtensionManager') && gui.includes('model={extensionManagerModel}') &&
    gui.includes('enableStatePersistence={false}'),
    'Custom Workspace renders Extension Manager inside managed WindowModel without legacy window persistence'
);
check(
    registry.includes('TOOL_SOURCE_KINDS.FIRST_PARTY') && !read('src/lib/editor-shell/launchpad-model.js')
        .includes('ngvge.tool.extension-manager'),
    'Launchpad discovery remains ToolRegistry-driven with no Extension Manager duplicate list'
);
check(
    !model.includes('ngvge.tool.agent') && !component.includes('ngvge.tool.agent') && !runtime.includes('ChangeSet'),
    'WS-6 does not leak WS-7 Agent authority or mutation workflow'
);
check(
    packageJson.includes('test:workspace-shell:ws6:focused') &&
    packageJson.includes('test:workspace-shell:ws6-webpack') &&
    packageJson.includes('test:workspace-shell:ws6-webpack-editor'),
    'WS-6 defines repeatable focused and real production Webpack gates'
);

process.stdout.write(`WS-6 Extension Manager Workspace Tool PASS (${checks.length}/${checks.length}).\n`);
process.stdout.write(`${JSON.stringify({
    modelId: 'ngvge.workspace-extension-manager-model@1',
    runtimeId: 'ngvge.workspace-extension-manager-runtime@1',
    toolId: 'ngvge.tool.extension-manager',
    itemSchemaVersion: 1,
    checks: checks.length
}, null, 2)}\n`);
