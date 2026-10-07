#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const checks = [];
const check = (condition, label) => {
    if (!condition) {
        process.stderr.write(`WS-5 FAIL: ${label}\n`);
        process.exit(1);
    }
    checks.push(label);
};

const command = read('src/lib/editor-shell/node-workspace-command.js');
const explorer = read('src/components/project-explorer/project-explorer.jsx');
const inspector = read('src/components/project-inspector/project-inspector.jsx');
const gui = read('src/components/gui/gui.jsx');
const registry = read('src/lib/editor-shell/tool-registry.js');
const primaryMode = read('src/lib/editor-shell/runtime-node-primary-mode.js');
const packageJson = read('package.json');
const directNodeDatabaseWriters = [
    'createNode',
    'deleteNode',
    'deleteNodes',
    'duplicateNode',
    'duplicateNodes',
    'renameNode',
    'setNodeEnabled',
    'setNodesEnabled',
    'setNodeProperty',
    'reparentNode',
    'reparentNodes'
];
const hasDirectNodeDatabaseWriter = source => directNodeDatabaseWriters.some(method => (
    source.includes(`nodeDatabase.${method}(`)
));
const nodeExplorerDefinition = registry.slice(
    registry.indexOf('id: TOOL_IDS.NODE_EXPLORER'),
    registry.indexOf('id: TOOL_IDS.INSPECTOR')
);
const legacySpritesDefinition = registry.slice(
    registry.indexOf('id: TOOL_IDS.LEGACY_SPRITES'),
    registry.indexOf('id: TOOL_IDS.EDITOR')
);

check(
    command.includes("WORKSPACE_NODE_COMMAND_HOST_ID = 'ngvge.workspace-node-command-host@1'") &&
    command.includes("WORKSPACE_NODE_COMMAND_CLIENT_ID = 'ngvge.workspace-node-command-client@1'") &&
    command.includes("PROJECT_NODE_COMPATIBILITY_ADAPTER_ID = 'ngvge.workspace-project-node-compatibility-adapter@1'"),
    'Workspace Node Host/Client/compatibility adapter stable identities'
);
check(
    command.includes('WORKSPACE_NODE_COMMAND_SCHEMA_VERSION = 1'),
    'Workspace Node command schema version is v1'
);
check(
    ['SelectNode', 'CreateNode', 'DestroyNode', 'DuplicateNode', 'PatchNode', 'ReparentNode']
        .every(type => command.includes(`'${type}'`)),
    'selection/create/delete/duplicate/rename-patch/reparent commands are explicit'
);
check(
    command.includes("RUNTIME: 'runtime'") && command.includes("PROJECT_COMPATIBILITY: 'project-compatibility'"),
    'Runtime and Project compatibility node domains are explicit'
);
check(
    command.includes('new Set([TOOL_IDS.NODE_EXPLORER, TOOL_IDS.INSPECTOR])'),
    'only Node Explorer and Inspector ToolIds may originate Workspace Node commands'
);
check(
    command.includes('createRuntimeNodeEditorClient(capability)') &&
    command.includes('RUNTIME_NODE_COMMAND_CAPABILITY_ID'),
    'Runtime Node mutations delegate to the existing Engine Protocol command capability'
);
check(
    command.includes('createProjectNodeCompatibilityAdapter') &&
    command.includes('getNodeDatabase') && command.includes('installNodeDatabase'),
    'historical Project NodeDatabase mutation is isolated behind an explicit compatibility adapter'
);
check(
    command.includes("error.code = 'NGVGE_WORKSPACE_NODE_BACKEND_IDENTITY_FORBIDDEN'") &&
    ['backendId', 'editingTargetId', 'runtimeId', 'scratchTargetId', 'targetId', 'vm']
        .every(field => command.includes(`'${field}'`)),
    'command DTOs fail closed on backend/Scratch identity smuggling'
);
check(
    command.includes("error.code = 'NGVGE_WORKSPACE_NODE_MIXED_DOMAINS'") &&
    command.includes("error.code = 'NGVGE_WORKSPACE_RUNTIME_NODE_BATCH_UNSUPPORTED'"),
    'mixed-domain and unsupported Runtime batch mutations fail closed'
);
check(
    !hasDirectNodeDatabaseWriter(explorer),
    'Node Explorer JSX has no direct Project NodeDatabase writer'
);
check(
    !hasDirectNodeDatabaseWriter(inspector),
    'Inspector JSX has no direct Project NodeDatabase writer'
);
check(
    !explorer.includes('createRuntimeNodeEditorClient') && !inspector.includes('createRuntimeNodeEditorClient'),
    'Node Explorer and Inspector do not directly construct Runtime Node Engine Protocol clients'
);
check(
    explorer.includes('workspaceNodeCommandClient.selectNode') && !explorer.includes('onSelectNode('),
    'Node Explorer selection writes through stable NodeId command client'
);
check(
    inspector.includes('workspaceNodeCommandClient.selectNode') && !inspector.includes('onSelectNode('),
    'Inspector selection fallback writes through stable NodeId command client'
);
check(
    explorer.includes('workspaceNodeCommandClient.createNode') &&
    explorer.includes('workspaceNodeCommandClient.duplicateNode') &&
    explorer.includes('workspaceNodeCommandClient.destroyNode') &&
    explorer.includes('workspaceNodeCommandClient.patchNode') &&
    explorer.includes('workspaceNodeCommandClient.reparentNode'),
    'Node Explorer semantic mutations route through Workspace Node command client'
);
check(
    inspector.includes('workspaceNodeCommandClient.patchNode') &&
    inspector.includes('workspaceNodeCommandClient.destroyNode'),
    'Inspector semantic mutations route through Workspace Node command client'
);
check(
    (gui.match(/createWorkspaceNodeCommandHostForVM\s*\(/g) || []).length === 1,
    'production GUI creates exactly one shared Workspace Node Command Host'
);
check(
    gui.includes('TOOL_IDS.NODE_EXPLORER') && gui.includes('TOOL_IDS.INSPECTOR') &&
    gui.includes('nodeExplorerCommandClient') && gui.includes('inspectorNodeCommandClient'),
    'production GUI derives Tool-provenance clients for Node Explorer and Inspector'
);
check(
    (gui.match(/nodeCommandClient=\{nodeExplorerCommandClient\}/g) || []).length >= 2 &&
    (gui.match(/nodeCommandClient=\{inspectorNodeCommandClient\}/g) || []).length >= 2,
    'Classic and Custom Workspace Node Explorer/Inspector instances receive shared-host clients'
);
check(
    nodeExplorerDefinition.includes("title: 'Node Explorer'") &&
    nodeExplorerDefinition.includes('source: {kind: TOOL_SOURCE_KINDS.FIRST_PARTY') &&
    nodeExplorerDefinition.includes('role: WINDOW_ROLES.PRIMARY') &&
    nodeExplorerDefinition.includes('defaultVisible: true'),
    'Node Explorer remains the visible first-party Primary Workspace object manager'
);
check(
    legacySpritesDefinition.includes('source: {kind: TOOL_SOURCE_KINDS.COMPATIBILITY') &&
    legacySpritesDefinition.includes('role: WINDOW_ROLES.COMPATIBILITY') &&
    legacySpritesDefinition.includes('defaultVisible: false'),
    'Legacy Sprites remains a default-hidden Compatibility Tool'
);
check(
    primaryMode.includes("RUNTIME_NODE_PRIMARY_MODE_ID = 'runtime-node-primary'") &&
    primaryMode.includes("LEGACY_SPRITES_COMPATIBILITY_UI_ID = 'scratch-target-pane'"),
    'Runtime Node primary-mode compatibility contract remains present'
);
check(
    explorer.includes('RUNTIME_NODE_MODEL_CAPABILITY_ID') && explorer.includes('runtimeNodeModel') &&
    explorer.includes('getSceneRoot') && explorer.includes('getGlobalRoot'),
    'scene hierarchy projection continues to originate from Runtime Node model roots'
);
check(
    !command.includes('localStorage') && !command.includes('WorkspacePersistenceHost') &&
    !command.includes('ngvge:workspace:'),
    'Node command authority does not create a second Workspace persistence domain'
);
check(
    !command.includes('window.vm') && !explorer.includes('window.vm') && !inspector.includes('window.vm'),
    'Workspace Node integration does not introduce production window.vm authority'
);
check(
    packageJson.includes('test:workspace-shell:ws5:focused') &&
    packageJson.includes('test:workspace-shell:ws5-webpack') &&
    packageJson.includes('test:workspace-shell:ws5-webpack-editor'),
    'WS-5 defines repeatable focused and real production Webpack gates'
);

process.stdout.write(`WS-5 Node Explorer Workspace Integration PASS (${checks.length}/${checks.length}).\n`);
process.stdout.write(`${JSON.stringify({
    host: 'ngvge.workspace-node-command-host@1',
    client: 'ngvge.workspace-node-command-client@1',
    compatibilityAdapter: 'ngvge.workspace-project-node-compatibility-adapter@1',
    schemaVersion: 1,
    checks: checks.length
}, null, 2)}\n`);
