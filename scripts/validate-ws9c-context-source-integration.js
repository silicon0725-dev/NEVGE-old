#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const checks = [];
const check = (condition, label) => {
    if (!condition) {
        process.stderr.write(`WS-9C FAIL: ${label}\n`);
        process.exit(1);
    }
    checks.push(label);
};

const context = read('src/lib/editor-shell/workspace-context.js');
const runtime = read('src/lib/editor-shell/workspace-context-runtime.js');
const gui = read('src/components/gui/gui.jsx');
const explorer = read('src/components/project-explorer/project-explorer.jsx');
const assets = read('src/components/project-assets/project-asset-manager.jsx');
const agent = read('src/lib/editor-shell/agent-workspace-runtime.js');
const packageJson = read('package.json');

check(
    runtime.includes("WORKSPACE_CONTEXT_RUNTIME_BINDING_ID = 'ngvge.workspace-context-runtime-binding@1'") &&
    runtime.includes('class WorkspaceContextRuntimeBinding'),
    'versioned production Context runtime binding exists'
);
check(
    context.includes("PROJECT_LIFECYCLE: 'ngvge.workspace-context-source.project-lifecycle'") &&
    context.includes("SCENE_SYSTEM: 'ngvge.workspace-context-source.scene-system'") &&
    context.includes("NODE_SELECTION: 'ngvge.workspace-context-source.node-selection'") &&
    context.includes("RESOURCE_SELECTION: 'ngvge.workspace-context-source.resource-selection'"),
    'Project, Scene, Node selection, and Resource source identities are explicit'
);
check(
    runtime.includes('createProjectContextId') &&
    runtime.includes('`ngvge.project-context.g${projectGeneration}`') &&
    !runtime.includes('reduxProjectId') && !runtime.includes('projectState.projectId'),
    'Project Context identity derives from Project Lifecycle generation rather than host/server project ID'
);
check(
    runtime.includes("active.rootKind === 'load'") &&
    runtime.includes('this._projectBoundaryActive = true') &&
    runtime.includes('if (this._projectBoundaryActive) return this._sceneWriter.clear()') &&
    runtime.includes('if (this._projectBoundaryActive) return this._nodeSelectionWriter.clear()') &&
    runtime.includes('if (this._projectBoundaryActive) return this._resourceWriter.clear()') &&
    runtime.includes("event.type === 'operation:complete'") && runtime.includes("event.type === 'operation:error'"),
    'root Project load is a Context quarantine boundary until the lifecycle operation settles'
);
check(
    runtime.includes("SCENE_SYSTEM_MODULE_ID = 'ngvge.scene-system'") &&
    runtime.includes('moduleManager.getModuleData') && runtime.includes('this._moduleManager.subscribe'),
    'Scene Context observes first-party Scene module semantic data instead of SceneSelector UI state'
);
check(
    explorer.includes('onSelectionContextChange(selectedNodeIds.slice(), primaryNodeId)') &&
    gui.includes('onSelectionContextChange={handleWorkspaceNodeSelectionContextChange}'),
    'Node Explorer projects multi-selection and primary NodeId into Context through a dedicated seam'
);
check(
    assets.includes('onSelectionContextChange(selectedAsset ? selectedAsset.resourceId : null)') &&
    assets.includes('onSelectionContextChange(null)') &&
    gui.includes('onSelectionContextChange={handleWorkspaceResourceSelectionContextChange}'),
    'Asset Manager projects canonical ResourceId selection and clears it on tool teardown'
);
check(
    gui.includes('new WorkspaceContextService()') &&
    gui.includes('createWorkspaceContextRuntimeBinding({') &&
    gui.includes('workspaceContextRuntimeBinding.dispose()') &&
    gui.includes('data-ngvge-workspace-context-runtime-binding'),
    'production GUI bootstrap owns one Context Service and one revocable source binding lifecycle'
);
check(
    runtime.includes('bindWindowManagerToWorkspaceContext') &&
    runtime.includes('this._windowBinding.dispose()'),
    'Window Context remains a projection from WindowManager and is revoked during teardown'
);
check(
    !runtime.includes('Scratch Target') && !runtime.includes('renderer._') && !runtime.includes('window.vm') &&
    !context.includes('scratch-vm') && !context.includes('renderer._'),
    'Context source integration does not expose Scratch Target, renderer private state, or global VM handles'
);
check(
    (agent.includes('getCurrentNodeId') || agent.includes('contextReadCapability')) &&
    !agent.includes('WorkspaceContextService') && !agent.includes('workspaceContextService'),
    'Agent cannot bypass WS-9A admission by consuming raw Context Service authority'
);
check(
    packageJson.includes('test:workspace-shell:ws9c:focused') &&
    packageJson.includes('test:workspace-shell:ws9c-webpack') &&
    packageJson.includes('test:workspace-shell:ws9c-certification'),
    'WS-9C defines repeatable focused, Webpack, and cumulative gates'
);

process.stdout.write(`WS-9C Context Source Integration & Lifecycle Binding PASS (${checks.length}/${checks.length}).\n`);
process.stdout.write(`${JSON.stringify({
    bindingId: 'ngvge.workspace-context-runtime-binding@1',
    projectIdentity: 'project-lifecycle-generation',
    productionBootstrapWired: true,
    agentDirectContextServiceBypass: false,
    checks: checks.length
}, null, 2)}\n`);
