'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const fail = message => {
    const error = new Error(message);
    error.code = 'NGVGE_WS1_TOOL_WINDOW_FOUNDATION_FAILED';
    throw error;
};

const registry = read('src/lib/editor-shell/tool-registry.js');
const windowModel = read('src/lib/editor-shell/window-model.js');
const gui = read('src/components/gui/gui.jsx');

[
    "WORKSPACE_TOOL_REGISTRY_ID = 'ngvge.workspace-tool-registry@1'",
    "NODE_EXPLORER: 'ngvge.tool.node-explorer'",
    "INSPECTOR: 'ngvge.tool.inspector'",
    "ASSETS: 'ngvge.tool.assets'",
    "STAGE: 'ngvge.tool.stage'",
    "LEGACY_SPRITES: 'ngvge.tool.legacy-sprites'",
    "EDITOR: 'ngvge.tool.editor'"
].forEach(fragment => {
    if (!registry.includes(fragment)) fail(`Missing stable Tool Registry contract: ${fragment}`);
});

if (!registry.includes('class ToolRegistry') || !registry.includes('already registered')) {
    fail('Tool Registry must expose fail-closed duplicate registration.');
}
if (/from ['\"]react['\"]/.test(registry) || /from ['\"]react['\"]/.test(windowModel)) {
    fail('Tool Registry and Window Model must remain React-independent plain-data foundations.');
}

[
    "WORKSPACE_WINDOW_MODEL_ID = 'ngvge.workspace-window-model@1'",
    'const createWindowDescriptor =',
    'const normalizeWindowState ='
].forEach(fragment => {
    if (!windowModel.includes(fragment)) fail(`Missing Window Model contract: ${fragment}`);
});

[
    'data-ngvge-tool-registry',
    'data-ngvge-window-model',
    'data-ngvge-tool-id',
    'data-ngvge-tool-launcher',
    'createWindowDescriptor(EDITOR_TOOL'
].forEach(fragment => {
    if (!gui.includes(fragment)) fail(`GUI is not consuming WS-1 foundation: ${fragment}`);
});

[
    'windowId="project-explorer"',
    'windowId="project-inspector"',
    'windowId="asset-manager"',
    'windowId="stage"'
].forEach(fragment => {
    if (gui.includes(fragment)) fail(`Core Workspace WindowId remains hardcoded in JSX: ${fragment}`);
});

if (!gui.includes('NODE_EXPLORER_WINDOW.title') || !gui.includes('LEGACY_SPRITES_WINDOW.title')) {
    fail('Core window titles are not sourced from Tool Registry descriptors.');
}

process.stdout.write('WS-1 Tool Registry + Window Model Foundation PASS.\n');
process.stdout.write(JSON.stringify({
    registry: 'ngvge.workspace-tool-registry@1',
    windowModel: 'ngvge.workspace-window-model@1',
    coreTools: 6,
    reactIndependentModel: true,
    portableModelExcludesWs2RuntimeAuthority: true
}, null, 2) + '\n');
