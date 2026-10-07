'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const fail = message => {
    const error = new Error(message);
    error.code = 'NGVGE_WS0_VISUAL_FOUNDATION_FAILED';
    throw error;
};

const policy = read('src/lib/editor-shell/workspace-visual-foundation.js');
const gui = read('src/components/gui/gui.jsx');
const shellCss = read('src/components/workspace-shell/workspace-shell.css');
const windowCss = read('src/components/draggable-window/draggable-window.css');
const menuCss = read('src/components/menu-bar/menu-bar.css');

const requiredPolicy = [
    "WORKSPACE_SHELL_VISUAL_FOUNDATION_ID = 'ngvge.workspace-shell.visual@1'",
    "WORKSPACE_SHELL_VISUAL_MODE = 'neutral-dark'",
    "WORKSPACE_SHELL_ACCENT_POLICY = 'neutral'",
    "WORKSPACE_SHELL_ICON_POLICY = 'svg-only'",
    "WORKSPACE_SHELL_WINDOW_CHROME = 'quiet-titlebar'"
];
requiredPolicy.forEach(fragment => {
    if (!policy.includes(fragment)) fail(`Missing visual policy contract: ${fragment}`);
});

[
    'data-ngvge-workspace-shell',
    'data-ngvge-workspace-visual-mode',
    'data-ngvge-workspace-accent-policy',
    'data-ngvge-workspace-icon-policy',
    'data-ngvge-workspace-window-chrome'
].forEach(attribute => {
    if (!gui.includes(attribute)) fail(`Workspace root is missing ${attribute}.`);
});

if (!gui.includes('[workspaceStyles.workspaceShell]: customUI') ||
    !gui.includes('[workspaceStyles.workspaceMenuBar]: customUI') ||
    !gui.includes('[workspaceStyles.workspaceLauncher]: customUI')) {
    fail('Workspace visual classes are not scoped to customUI.');
}

if (!shellCss.includes('--ngvge-shell-canvas: #17191d') ||
    !shellCss.includes('--ngvge-window-chrome: #24282e') ||
    !shellCss.includes('--ngvge-menu-bar-background: #1e2227')) {
    fail('Neutral dark Workspace visual tokens are incomplete.');
}

if (/#[0-9a-f]{6}/i.test(shellCss.match(/00baad|00998d/ig) || '')) {
    fail('Workspace visual foundation reintroduced the legacy cyan chrome.');
}
if (/00BAAD|00998d/i.test(shellCss)) {
    fail('Workspace visual foundation must not use the legacy cyan chrome colors.');
}

if (!windowCss.includes('var(--ngvge-window-chrome, #00BAAD)') ||
    !windowCss.includes('var(--ngvge-window-shadow,') ||
    !windowCss.includes('var(--ngvge-minimized-background, #00BAAD)')) {
    fail('DraggableWindow does not expose Workspace visual token seams with legacy fallbacks.');
}

if (!menuCss.includes('var(--ngvge-menu-bar-background, $menu-bar-background)') ||
    !menuCss.includes('var(--ngvge-menu-bar-foreground, $menu-bar-foreground)')) {
    fail('MenuBar does not expose Workspace visual token seams with legacy fallbacks.');
}

process.stdout.write('WS-0 Workspace Shell Visual Foundation PASS.\n');
process.stdout.write(JSON.stringify({
    accentPolicy: 'neutral',
    classicUiFallback: 'preserved',
    iconPolicy: 'svg-only',
    visualFoundation: 'ngvge.workspace-shell.visual@1',
    visualMode: 'neutral-dark',
    windowChrome: 'quiet-titlebar'
}, null, 2) + '\n');
