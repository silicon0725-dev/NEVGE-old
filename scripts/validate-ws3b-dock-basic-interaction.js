'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const fail = message => {
    const error = new Error(message);
    error.code = 'NGVGE_WS3B_DOCK_BASIC_INTERACTION_FAILED';
    throw error;
};
const passed = [];
const check = (condition, message) => {
    if (!condition) fail(message);
    passed.push(message);
};

const controller = read('src/lib/editor-shell/dock-interaction-controller.js');
const model = read('src/lib/editor-shell/dock-runtime-model.js');
const dockComponent = read('src/components/workspace-dock/workspace-dock.jsx');
const dockCss = read('src/components/workspace-dock/workspace-dock.css');
const gui = read('src/components/gui/gui.jsx');
const registry = read('src/lib/editor-shell/tool-registry.js');

check(
    controller.includes("WORKSPACE_DOCK_INTERACTION_CONTROLLER_ID = 'ngvge.workspace-dock-interaction-controller@1'"),
    'stable Dock Interaction Controller identity'
);
check(controller.includes('class DockInteractionController'), 'Dock Interaction Controller class exists');
check(
    controller.includes('WORKSPACE_TOOL_REGISTRY_ID') &&
    controller.includes('WORKSPACE_WINDOW_MANAGER_ID') &&
    controller.includes('WORKSPACE_DOCK_RUNTIME_MODEL_ID'),
    'interaction controller consumes ToolRegistry + WindowManager + DockRuntimeModel'
);
check(controller.includes("action: 'launch'"), 'stopped Tool click has explicit launch action');
check(controller.includes("action: 'restore'"), 'minimized Tool click has explicit restore action');
check(controller.includes("action: 'focus'"), 'running non-active Tool click has explicit focus action');
check(controller.includes("action: 'already-active'"), 'active Tool click is an explicit no-op action');
check(
    controller.includes('this._windowManager.restore(preferred.windowId)') &&
    controller.includes('this._windowManager.activate(preferred.windowId)'),
    'restore/focus mutation remains owned by WindowManager'
);
[
    '.close(',
    '.minimize(',
    '.move(',
    '.resize(',
    '.maximize(',
    '.registerWindow(',
    '.unregisterWindow('
].forEach(fragment => {
    check(
        !controller.includes(`this._windowManager${fragment}`),
        `Dock interaction does not take unrelated WindowManager authority via ${fragment}`
    );
});
check(
    controller.includes('lastFocusedAt') && controller.includes('requireState(a.windowId)'),
    'multi-instance focus preference is derived from WindowManager focus history'
);
check(
    controller.includes('togglePin (toolId)') && controller.includes('setVisibleOrder (toolIds)'),
    'pin/unpin and reorder route to DockRuntimeModel metadata authority'
);
check(
    !controller.includes('localStorage') && !controller.includes('sessionStorage'),
    'WS-3B interaction controller remains non-persistent'
);
check(
    !model.includes('this._windowManager.open(') &&
    !model.includes('this._windowManager.restore(') &&
    !model.includes('this._windowManager.activate('),
    'DockRuntimeModel remains projection-only after WS-3B'
);
check(dockComponent.includes('data-running='), 'Dock renders running indicator state');
check(dockComponent.includes('data-minimized='), 'Dock renders minimized indicator state');
check(dockComponent.includes('data-active='), 'Dock renders active indicator state');
check(dockComponent.includes('data-pinned='), 'Dock renders pinned state');
check(dockComponent.includes('draggable'), 'Dock supports drag reorder interaction');
check(
    dockComponent.includes("'ArrowLeft'") && dockComponent.includes("'ArrowRight'") &&
    dockComponent.includes('event.altKey'),
    'Dock provides keyboard reorder fallback'
);
check(
    dockComponent.includes('interactionController.activateTool(item.toolId)'),
    'Dock click delegates launch/focus/restore to interaction controller'
);
check(
    dockComponent.includes('interactionController.togglePin(item.toolId)'),
    'Dock pin UI delegates to interaction controller'
);
check(
    dockComponent.includes('interactionController.setVisibleOrder('),
    'Dock drag/keyboard reorder delegates ordering authority'
);
check(
    dockComponent.includes('runningWindowIds.length > 1'),
    'Dock visibly distinguishes multi-instance tools without replacing WindowIds'
);
check(
    !dockComponent.includes('<img') && dockComponent.includes('<svg'),
    'Dock functional iconography is SVG-only'
);
check(
    !dockComponent.includes('groupId') && !dockComponent.includes('folderId'),
    'WS-3B does not implement WS-3D group/folder presentation'
);
const placementModelPath = path.join(ROOT, 'src/lib/editor-shell/dock-placement-model.js');
if (fs.existsSync(placementModelPath)) {
    const placementModel = read('src/lib/editor-shell/dock-placement-model.js');
    check(
        placementModel.includes("WORKSPACE_DOCK_PLACEMENT_MODEL_ID = 'ngvge.workspace-dock-placement-model@1'") &&
        dockComponent.includes('placementModel.getProjection()'),
        'WS-3B provisional presentation is superseded by the explicit WS-3C placement model without changing interaction authority'
    );
} else {
    check(
        dockCss.includes('bottom: 14px') && !dockCss.includes('top: 14px') && !dockCss.includes('left: 14px'),
        'WS-3B uses one provisional bottom presentation and defers placement variants to WS-3C'
    );
}
check(
    gui.includes('DEFAULT_DOCK_PINNED_TOOL_IDS') &&
    gui.includes('TOOL_IDS.EDITOR') &&
    !/DEFAULT_DOCK_PINNED_TOOL_IDS[\s\S]{0,300}TOOL_IDS\.LEGACY_SPRITES/.test(gui),
    'core native tools are pinned by runtime default while Legacy Sprites remains compatibility-only by default'
);
check(
    gui.includes('new DockInteractionController({') &&
    gui.includes('launchTool: handleDockLaunchTool'),
    'production GUI wires Dock interaction through explicit launch callback'
);
check(
    gui.includes('<WorkspaceDock') &&
    gui.includes('dockRuntimeModel={dockRuntimeModel}') &&
    gui.includes('interactionController={dockInteractionController}'),
    'production Workspace renders WS-3B Dock'
);
check(
    gui.includes('!hideFloatingWindows && !customUI ? <MinimizedBar') &&
    gui.includes('!hideFloatingWindows && customUI && !isFullScreen'),
    'Workspace Dock replaces legacy MinimizedBar only in custom Workspace mode'
);
check(
    gui.includes('!customUI && !projectExplorerVisible') &&
    gui.includes('!customUI && !projectInspectorVisible') &&
    gui.includes('!customUI && !assetManagerVisible'),
    'legacy standalone launchers remain Classic-only after Dock activation'
);
check(
    gui.includes('data-ngvge-dock-interaction') &&
    gui.includes('WORKSPACE_DOCK_INTERACTION_CONTROLLER_ID'),
    'Workspace exposes stable WS-3B interaction diagnostics'
);
check(
    registry.includes("id: TOOL_IDS.EDITOR") && !/id: TOOL_IDS\.EDITOR[\s\S]{0,700}minimize: false/.test(registry),
    'multi-instance Editor window supports minimize/restore required by Dock interaction'
);

process.stdout.write(`WS-3B Dock Basic Interaction PASS (${passed.length}/${passed.length}).\n`);
process.stdout.write(`${JSON.stringify({
    interaction: 'ngvge.workspace-dock-interaction-controller@1',
    model: 'ngvge.workspace-dock-runtime-model@1',
    clickActions: ['launch', 'focus', 'restore', 'already-active'],
    dockOwnedMutations: ['pin', 'unpin', 'reorder'],
    windowAuthority: 'ngvge.workspace-window-manager@1',
    presentation: fs.existsSync(placementModelPath) ? 'delegated-to-ws3c-placement-model' : 'provisional-bottom',
    persistenceDeferredTo: 'WS-4',
    placementDeferredTo: 'WS-3C',
    organizationPresentationDeferredTo: 'WS-3D',
    checks: passed.length
}, null, 2)}\n`);
