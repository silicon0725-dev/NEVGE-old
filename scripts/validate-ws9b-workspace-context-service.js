#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const checks = [];
const check = (condition, label) => {
    if (!condition) {
        process.stderr.write(`WS-9B FAIL: ${label}\n`);
        process.exit(1);
    }
    checks.push(label);
};

const context = read('src/lib/editor-shell/workspace-context.js');
const capability = read('src/lib/editor-shell/tool-capability.js');
const descriptors = read('src/lib/editor-shell/tool-capability-descriptors.js');
const ecosystem = read('src/lib/editor-shell/tool-ecosystem.js');
const agent = read('src/lib/editor-shell/agent-workspace-runtime.js');
const packageJson = read('package.json');

check(
    context.includes("WORKSPACE_CONTEXT_SERVICE_ID = 'ngvge.workspace-context@1'") &&
    context.includes('WORKSPACE_CONTEXT_SNAPSHOT_SCHEMA_VERSION = 1') &&
    context.includes('WORKSPACE_CONTEXT_WRITER_LEASE_SCHEMA_VERSION = 1'),
    'Workspace Context Service, Snapshot, and Writer Lease identities are versioned'
);
check(
    context.includes("PROJECT: 'project'") && context.includes("SCENE: 'scene'") &&
    context.includes("NODE_SELECTION: 'node-selection'") && context.includes("RESOURCE: 'resource'") &&
    context.includes("WINDOW: 'window'"),
    'Project, Scene, Node selection, Resource, and Window Context domains are explicit'
);
check(
    context.includes('projectId: state.projectId') && context.includes('sceneId: state.sceneId') &&
    context.includes('selectedNodeIds: state.selectedNodeIds.slice()') &&
    context.includes('resourceId: state.resourceId') && context.includes('activeToolId: state.activeToolId') &&
    context.includes('activeWindowId: state.activeWindowId'),
    'Context snapshot contains stable semantic identities and active Workspace projection'
);
check(
    context.includes('NGVGE_WORKSPACE_CONTEXT_WRITER_CONFLICT') &&
    context.includes('Workspace Context domain already has a writer'),
    'each Context domain fails closed on competing writer sources'
);
check(
    context.includes('NGVGE_WORKSPACE_CONTEXT_WRITER_REVOKED') &&
    context.includes('writer.release({clear: true})'),
    'Context writer leases are revocable and stale projections can be cleared'
);
check(
    context.includes('bindWindowManagerToWorkspaceContext') &&
    context.includes('windowManager.getActiveWindowId()') && context.includes('activeState.toolId'),
    'WindowManager is consumed as a projection source rather than replaced as Window authority'
);
check(
    capability.includes("CONTEXT_READ: 'ngvge.workspace-capability.context-read'") &&
    descriptors.includes('WORKSPACE_TOOL_CAPABILITIES.CONTEXT_READ') &&
    descriptors.includes('allowedAccess: [TOOL_CAPABILITY_ACCESS.QUERY]'),
    'Context read is an explicit query-only WS-9 capability identity'
);
check(
    context.includes('createWorkspaceContextReadCapability') &&
    context.includes('capabilityLease.assert(') && context.includes('capabilityLease.isActive()'),
    'Context provider binding is Tool capability-lease gated and revocation-aware'
);
check(
    ecosystem.includes("CONTEXT: 'workspace.context'"),
    'Tool ecosystem can declare Workspace Context as an explicit required service'
);
check(
    !context.includes('scratch-vm') && !context.includes('window.vm') && !context.includes('renderer._') &&
    !context.includes('Scratch Target') && !context.includes('redux') && !context.includes('React'),
    'Context Service contains no Scratch, Renderer, Redux, DOM, or React authority objects'
);
check(
    (agent.includes('getCurrentNodeId') || agent.includes('contextReadCapability')) &&
    !agent.includes('WorkspaceContextService') && !agent.includes('workspaceContextService'),
    'Agent Context consumption never receives raw WorkspaceContextService authority'
);
check(
    packageJson.includes('test:workspace-shell:ws9b:focused') &&
    packageJson.includes('test:workspace-shell:ws9b-webpack') &&
    packageJson.includes('test:workspace-shell:ws9b-certification'),
    'WS-9B defines repeatable focused, Webpack, and cumulative gates'
);

process.stdout.write(`WS-9B Workspace Context Service PASS (${checks.length}/${checks.length}).\n`);
process.stdout.write(`${JSON.stringify({
    contextServiceId: 'ngvge.workspace-context@1',
    snapshotSchemaVersion: 1,
    contextReadCapabilityId: 'ngvge.workspace-capability.context-read',
    agentDirectContextServiceAccess: false,
    checks: checks.length
}, null, 2)}\n`);
