'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const fail = message => {
    const error = new Error(message);
    error.code = 'NGVGE_WS2_WINDOW_MANAGER_FOUNDATION_FAILED';
    throw error;
};

const manager = read('src/lib/editor-shell/window-manager.js');
const gui = read('src/components/gui/gui.jsx');

[
    "WORKSPACE_WINDOW_MANAGER_ID = 'ngvge.workspace-window-manager@1'",
    'class WindowManager',
    'registerWindow(descriptor',
    'unregisterWindow(windowId)',
    'activate(windowId)',
    'open(windowId',
    'close(windowId)',
    'minimize(windowId)',
    'restore(windowId',
    'move(windowId, position)',
    'resize(windowId, size)',
    'maximize(windowId, geometry)',
    'restoreMaximized(windowId)'
].forEach(fragment => {
    if (!manager.includes(fragment)) fail(`Missing Window Manager contract: ${fragment}`);
});

if (/from ['"]react['"]/.test(manager)) {
    fail('Window Manager must remain React-independent.');
}
[
    'targetRuntimeId',
    'drawableId',
    'skinId',
    'Scratch.vm',
    'Scratch.Target'
].forEach(fragment => {
    if (manager.includes(fragment)) fail(`Window Manager contains backend identity: ${fragment}`);
});

[
    'data-ngvge-window-manager',
    'data-ngvge-active-window-id',
    'data-ngvge-window-active',
    'WORKSPACE_WINDOW_MANAGER_ID',
    'new WindowManager(',
    'windowManager.registerWindow(windowDescriptor',
    'windowManager.activate(windowId)',
    'windowManager.move(windowId, position)',
    'windowManager.resize(windowId, size)',
    'windowManager.unregisterWindow(windowId)'
].forEach(fragment => {
    if (!gui.includes(fragment)) fail(`GUI is not consuming WS-2 Window Manager: ${fragment}`);
});

[
    'editorWindowZIndexRef',
    'setStageWindowMinimized',
    'setProjectExplorerWindowMinimized',
    'setProjectInspectorWindowMinimized',
    'setAssetManagerWindowMinimized',
    'setTargetPaneWindowPosition',
    'setTargetPaneWindowSize'
].forEach(fragment => {
    if (gui.includes(fragment)) fail(`Legacy distributed window runtime authority remains in GUI: ${fragment}`);
});

[
    'zIndex={projectExplorerWindowState.zIndex}',
    'zIndex={projectInspectorWindowState.zIndex}',
    'zIndex={assetManagerWindowState.zIndex}',
    'zIndex={targetPaneWindowState.zIndex}',
    'zIndex={windowState.zIndex}',
    'zIndex={activeWindowState.zIndex}'
].forEach(fragment => {
    if (!gui.includes(fragment)) fail(`Managed z-order is missing: ${fragment}`);
});

process.stdout.write('WS-2 Window Manager Foundation PASS.\n');
process.stdout.write(JSON.stringify({
    manager: 'ngvge.workspace-window-manager@1',
    runtimeAuthority: [
        'visibility',
        'minimize/restore',
        'maximize',
        'position',
        'size',
        'focus',
        'z-order'
    ],
    editorSessionWindowRuntimeFields: 0,
    reactIndependentManager: true,
    dockAuthorityDeferredTo: 'WS-3',
    persistenceAuthorityDeferredTo: 'WS-4'
}, null, 2) + '\n');
