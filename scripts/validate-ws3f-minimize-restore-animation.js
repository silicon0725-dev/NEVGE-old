const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const fail = message => {
    const error = new Error(message);
    error.code = 'NGVGE_WS3F_MINIMIZE_RESTORE_ANIMATION_FAILED';
    throw error;
};
const passed = [];
const check = (condition, message) => {
    if (!condition) fail(message);
    passed.push(message);
};

const model = read('src/lib/editor-shell/dock-transition-model.js');
const layer = read('src/components/workspace-window-transition/workspace-window-transition.jsx');
const layerCss = read('src/components/workspace-window-transition/workspace-window-transition.css');
const dock = read('src/components/workspace-dock/workspace-dock.jsx');
const draggable = read('src/components/draggable-window/draggable-window.jsx');
const draggableCss = read('src/components/draggable-window/draggable-window.css');
const gui = read('src/components/gui/gui.jsx');
const packageJson = read('package.json');

check(
    model.includes("WORKSPACE_DOCK_TRANSITION_MODEL_ID = 'ngvge.workspace-dock-transition-model@1'"),
    'stable Dock transition presentation model identity'
);
check(model.includes('DOCK_TRANSITION_SCHEMA_VERSION = 1'), 'Dock transition record schema v1');
check(
    model.includes("MINIMIZE: 'minimize'") && model.includes("RESTORE: 'restore'"),
    'explicit minimize and restore presentation transition kinds'
);
check(
    model.includes('windowManager.id === WORKSPACE_WINDOW_MANAGER_ID') && model.includes('windowManager.subscribe('),
    'transition model consumes the existing WindowManager as semantic source'
);
check(
    model.includes("event.type !== 'window:minimized'") && model.includes("event.type !== 'window:restored'"),
    'presentation transition begins from committed WindowManager lifecycle events'
);
check(
    model.includes('workspace.left + state.position.x') && model.includes('workspace.top + state.position.y') &&
    model.includes('width: state.size.width') && model.includes('height: state.size.height'),
    'source geometry derives from WindowManager position/size plus Workspace viewport origin'
);
check(
    model.includes('this._getDockTargetGeometry(toolId)') &&
    model.includes('kind === DOCK_TRANSITION_KINDS.MINIMIZE ? windowGeometry : dockGeometry'),
    'target geometry comes from Dock presentation geometry and direction reverses for restore'
);
check(
    model.includes('semanticState: freezeSemanticSnapshot(state)') &&
    model.includes('minimized: Boolean(state.minimized)'),
    'transition record snapshots already-committed semantic state'
);
check(
    !model.includes('.minimize(') && !model.includes('.restore(') && !model.includes('.open(') &&
    !model.includes('.close(') && !model.includes('.activate(') && !model.includes('.move(') &&
    !model.includes('.resize('),
    'DockTransitionModel owns no WindowManager mutation authority'
);
check(
    model.includes('completeTransition (transitionId)') && model.includes("this._emit('transition:completed'"),
    'presentation completion only removes transition records'
);
check(
    model.includes('skippedMissingWorkspaceGeometry') && model.includes('skippedMissingDockTargetGeometry'),
    'missing presentation geometry fails soft with diagnostics instead of blocking semantic state'
);
check(
    model.includes('supersededTransitions') && model.includes('this._transitions.delete(state.windowId)'),
    'rapid opposite presentation transitions supersede stale records per WindowId'
);
check(
    model.includes('dispose ()') && model.includes('this._unsubscribeWindowManager()'),
    'transition model lifecycle unsubscribes from WindowManager'
);
check(
    !model.includes('localStorage') && !model.includes('sessionStorage') && !model.includes('windowStateStorage'),
    'WS-3F transition state is runtime-only and not persisted'
);
check(
    !model.includes('Scratch') && !model.includes('renderer') &&
    !model.includes('extensionManager') && !model.includes('vm.'),
    'transition semantic model carries no Scratch/backend identity'
);
check(
    layer.includes('aria-hidden="true"') && layer.includes('data-ngvge-dock-transition-id') &&
    layer.includes('transitionModel.completeTransition(transition.transitionId)'),
    'transition layer is presentation-only, hidden from accessibility semantics, and completes records'
);
check(
    layer.includes("window.matchMedia('(prefers-reduced-motion: reduce)')") &&
    layerCss.includes('@media (prefers-reduced-motion: reduce)'),
    'reduced-motion users can bypass animated presentation'
);
check(
    layer.includes("data-ngvge-presentation-hidden', 'true'") &&
    draggableCss.includes('.draggableWindow[data-ngvge-presentation-hidden="true"]'),
    'restore transition may hide the already-restored DOM representation without changing semantic state'
);
check(
    draggable.includes("typeof controlledMinimized === 'boolean' && onMinimizeToggle") &&
    draggable.includes('onMinimizeToggle(windowId, !controlledMinimized);'),
    'controlled Workspace minimize delegates semantic commit before local presentation projection'
);
check(
    draggable.includes('data-ngvge-window-id={windowId}'),
    'Workspace window DOM exposes stable WindowId only for presentation targeting'
);
check(
    dock.includes('data-ngvge-dock-transition-targets={item.toolId}') &&
    dock.includes("data-ngvge-dock-transition-targets={node.items.map(item => item.toolId).join(' ')}"),
    'Dock publishes ToolId target geometry for direct items and collapsed folders'
);
check(
    gui.includes('new DockTransitionModel({') && gui.includes('windowManager,') &&
    gui.includes('getWorkspaceViewportGeometry: () => snapshotViewportRect(workspaceSurfaceRef.current)') &&
    gui.includes('getDockTargetGeometry: resolveDockTargetGeometry'),
    'production GUI wires WindowManager source geometry to Dock target geometry provider'
);
check(
    gui.includes('<WorkspaceWindowTransitionLayer transitionModel={dockTransitionModel} />') &&
    gui.includes('data-ngvge-dock-transition-model'),
    'production Workspace mounts one transition presentation layer with diagnostics identity'
);
check(
    gui.includes('React.useEffect(() => () => dockTransitionModel.dispose(), [dockTransitionModel])'),
    'production GUI disposes transition subscription on Workspace teardown'
);
check(
    layerCss.includes('position: fixed') && layerCss.includes('pointer-events: none') &&
    layerCss.includes('transition-property: left, top, width, height'),
    'animation is a non-interactive viewport presentation projection'
);
check(
    packageJson.includes('test:workspace-shell:ws3f:focused') &&
    packageJson.includes('test:workspace-shell:ws3f-webpack') &&
    packageJson.includes('test:workspace-shell:ws3f-webpack-editor'),
    'WS-3F has repeatable focused and production Webpack gates'
);

process.stdout.write(`WS-3F Minimize / Restore Animation PASS (${passed.length}/${passed.length}).\n`);
process.stdout.write(`${JSON.stringify({
    transitionModel: 'ngvge.workspace-dock-transition-model@1',
    semanticAuthority: 'ngvge.workspace-window-manager@1',
    sourceGeometry: 'WindowManager state + Workspace viewport origin',
    targetGeometry: 'Dock ToolId target geometry',
    lifecycle: 'semantic commit -> presentation transition',
    reducedMotion: true,
    persistence: 'none / WS-4 deferred',
    checks: passed.length
}, null, 2)}\n`);
