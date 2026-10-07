'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const fail = message => {
    const error = new Error(message);
    error.code = 'NGVGE_RE5_RUNTIME_NODE_EXPLORER_PRIMARY_MODE_FAILED';
    throw error;
};

const gui = read('src/components/gui/gui.jsx');
const explorer = read('src/components/project-explorer/project-explorer.jsx');
const targetPane = read('src/components/target-pane/target-pane.jsx');
const policy = read('src/lib/editor-shell/runtime-node-primary-mode.js');

if (!policy.includes("const RUNTIME_NODE_PRIMARY_MODE_ID = 'runtime-node-primary'")) {
    fail('Runtime Node primary editor mode identity is missing.');
}
if (!policy.includes("const LEGACY_SPRITES_COMPATIBILITY_UI_ID = 'scratch-target-pane'")) {
    fail('Legacy Scratch Sprites compatibility UI identity is missing.');
}
if (!/const visible = Boolean\(savedState && savedState\.visible === true\)/.test(policy)) {
    fail('Legacy Sprites must be hidden unless explicitly persisted visible.');
}
if (!explorer.includes('aria-label="Node Explorer"') ||
    !explorer.includes('data-ngvge-object-manager="runtime-node-primary"') ||
    !explorer.includes('data-ngvge-selection-authority="node-id"')) {
    fail('Node Explorer is not declared as the primary NodeId object manager.');
}
if (!explorer.includes('data-ngvge-compatibility-launcher="scratch-target-pane"') ||
    !explorer.includes('onOpenLegacySprites')) {
    fail('Node Explorer does not expose an explicit Legacy Sprites compatibility launcher.');
}
if (!gui.includes('legacySpritesWindowVisible && (') ||
    !(gui.includes('title="Legacy Sprites"') || gui.includes('title={LEGACY_SPRITES_WINDOW.title}')) ||
    !gui.includes('data-ngvge-compatibility-ui={LEGACY_SPRITES_COMPATIBILITY_UI_ID}') ||
    !gui.includes('onClose={handleCloseLegacySprites}') ||
    !gui.includes('compatibilityMode')) {
    fail('Legacy Sprites is not gated behind the explicit compatibility window state.');
}
if (gui.includes('title="Sprites"')) {
    fail('Custom Workspace still exposes the Scratch target window as a primary Sprites window.');
}
if (!targetPane.includes('Compatibility view. Use Node Explorer for primary object management.')) {
    fail('Legacy TargetPane does not identify itself as a compatibility view.');
}
if (!gui.includes('<NodeExplorerLauncherIcon />') ||
    !gui.includes('<InspectorLauncherIcon />') ||
    !gui.includes('<AssetLauncherIcon />')) {
    fail('Workspace launchers are not using vector icon components.');
}
if (/projectExplorerLauncherIcon}>[^<]+<\/span>/.test(gui) ||
    /projectInspectorLauncherIcon}>[^<]+<\/span>/.test(gui) ||
    /assetManagerLauncherIcon}>[^<]+<\/span>/.test(gui)) {
    fail('Functional Workspace launcher uses a text/Unicode glyph instead of a vector icon.');
}

process.stdout.write('RE-5 Runtime Node Explorer Primary Mode / Legacy Sprites UI Demotion PASS.\n');
process.stdout.write(JSON.stringify({
    compatibilityUi: 'scratch-target-pane',
    legacySpritesDefaultVisible: false,
    primaryObjectManager: 'runtime-node-primary',
    primarySelectionIdentity: 'NodeId',
    workspaceLauncherIcons: 'svg'
}, null, 2) + '\n');
