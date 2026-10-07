const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const fail = message => {
    const error = new Error(message);
    error.code = 'NGVGE_WS3A_DOCK_RUNTIME_MODEL_FAILED';
    throw error;
};
const pass = [];
const check = (condition, message) => {
    if (!condition) fail(message);
    pass.push(message);
};

const dock = read('src/lib/editor-shell/dock-runtime-model.js');
const gui = read('src/components/gui/gui.jsx');

check(
    dock.includes("WORKSPACE_DOCK_RUNTIME_MODEL_ID = 'ngvge.workspace-dock-runtime-model@1'"),
    'stable Dock Runtime Model identity'
);
check(dock.includes('class DockRuntimeModel'), 'DockRuntimeModel class exists');
check(
    dock.includes('WORKSPACE_TOOL_REGISTRY_ID') && dock.includes('WORKSPACE_WINDOW_MANAGER_ID'),
    'Dock consumes ToolRegistry and WindowManager as authority sources'
);
check(
    dock.includes('state.visible || state.minimized'),
    'running state is derived from WindowManager visibility/minimize state rather than registration'
);
check(
    dock.includes('runningWindowIds') && dock.includes('minimizedWindowIds') && dock.includes('activeWindowId'),
    'DockItem preserves ToolId/WindowId multi-instance distinction'
);
check(
    dock.includes('pin (toolId)') && dock.includes('unpin (toolId)') && dock.includes('setOrder (toolIds)'),
    'Dock owns pinning and ordering metadata'
);
check(
    dock.includes('setOrganizationMetadata (toolId, metadata)') && dock.includes('groupId') && dock.includes('folderId'),
    'Dock owns organization metadata seam'
);
check(
    !/from ['"]react['"]/.test(dock) && !dock.includes('localStorage') && !dock.includes('sessionStorage'),
    'Dock Runtime Model remains React-independent and non-persistent in WS-3A'
);
[
    'targetRuntimeId',
    'drawableId',
    'skinId',
    'Scratch.vm',
    'extensionManager',
    'renderer'
].forEach(fragment => {
    check(!dock.includes(fragment), `Dock model excludes backend identity: ${fragment}`);
});
[
    'zIndex',
    'lastFocusedAt',
    'normalPosition',
    'normalSize'
].forEach(fragment => {
    check(!dock.includes(fragment), `Dock model does not duplicate WindowManager runtime authority: ${fragment}`);
});
[
    '.open(',
    '.close(',
    '.minimize(',
    '.restore(',
    '.activate(',
    '.move(',
    '.resize(',
    '.maximize('
].forEach(fragment => {
    check(!dock.includes(`this._windowManager${fragment}`), `Dock model does not mutate WindowManager via ${fragment}`);
});
check(
    gui.includes("from '../../lib/editor-shell/dock-runtime-model'") &&
    gui.includes('new DockRuntimeModel({') &&
    gui.includes('toolRegistry: WORKSPACE_TOOL_REGISTRY') &&
    gui.includes('windowManager'),
    'production GUI instantiates WS-3A from existing ToolRegistry + WindowManager'
);
check(
    gui.includes('data-ngvge-dock-runtime-model') && gui.includes('data-ngvge-dock-runtime-revision'),
    'Workspace exposes Dock Runtime Model diagnostics for later presentation stages'
);
check(
    !dock.includes('activateTool') && !dock.includes('onClick') && !dock.includes('draggable'),
    'WS-3A Runtime Model itself remains presentation/interaction independent after later Dock stages'
);

process.stdout.write(`WS-3A Dock Runtime Model PASS (${pass.length}/${pass.length}).\n`);
process.stdout.write(`${JSON.stringify({
    model: 'ngvge.workspace-dock-runtime-model@1',
    authoritySources: [
        'ngvge.workspace-tool-registry@1',
        'ngvge.workspace-window-manager@1'
    ],
    dockOwnedState: ['pinning', 'ordering', 'organization-metadata'],
    derivedState: ['running', 'minimized', 'active', 'WindowId instances'],
    persistenceDeferredTo: 'WS-4',
    presentationAndInteractionOwnedByLaterStages: true,
    productionUiSwitchOwnedByWs3a: false,
    checks: pass.length
}, null, 2)}\n`);
