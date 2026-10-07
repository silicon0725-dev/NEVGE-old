'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const fail = message => {
    const error = new Error(message);
    error.code = 'NGVGE_RE3_RUNTIME_NODE_COMMAND_BOUNDARY_FAILED';
    throw error;
};

const explorer = read('src/components/project-explorer/project-explorer.jsx');
const inspector = read('src/components/project-inspector/project-inspector.jsx');
const sceneModule = read('src/lib/scene-system/module-definition.js');
const capability = read('src/lib/runtime-nodes/runtime-node-command-capability.js');
const executor = read('src/lib/runtime-nodes/runtime-node-command-executor.js');
const workspaceCommandPath = path.join(ROOT, 'src/lib/editor-shell/node-workspace-command.js');
const workspaceCommand = fs.existsSync(workspaceCommandPath) ?
    fs.readFileSync(workspaceCommandPath, 'utf8') : '';

const directMutationPattern = /runtimeNodeModel\.(?:createNode|destroyNode|duplicateNode|patchNode|renameNode|setNodeEnabled|setParent|reorderChild|detachNode)\s*\(/g;
[
    ['Project Explorer', explorer],
    ['Project Inspector', inspector]
].forEach(([label, source]) => {
    const matches = source.match(directMutationPattern) || [];
    if (matches.length) fail(`${label} directly mutates Runtime Node Model: ${matches.join(', ')}`);
    const consumesRuntimeCapabilityDirectly =
        source.includes('RUNTIME_NODE_COMMAND_CAPABILITY_ID') && source.includes('createRuntimeNodeEditorClient');
    const delegatesThroughWorkspaceNodeHost =
        source.includes('workspaceNodeCommandClient') &&
        workspaceCommand.includes('RUNTIME_NODE_COMMAND_CAPABILITY_ID') &&
        workspaceCommand.includes('createRuntimeNodeEditorClient(capability)') &&
        workspaceCommand.includes('NGVGE_WORKSPACE_NODE_BACKEND_IDENTITY_FORBIDDEN');
    if (!consumesRuntimeCapabilityDirectly && !delegatesThroughWorkspaceNodeHost) {
        fail(`${label} does not reach the Runtime Node Command capability ` +
            'through a certified command boundary.');
    }
});

if (!sceneModule.includes('context.capabilities.provide(\n                        RUNTIME_NODE_COMMAND_CAPABILITY_ID')) {
    fail('Scene System does not publish the Runtime Node Command capability.');
}
if (!capability.includes("const RUNTIME_NODE_COMMAND_CAPABILITY_ID = 'ngvge.runtime-node-command'")) {
    fail('Runtime Node Command capability identity is missing or unstable.');
}
['CreateNode', 'DestroyNode', 'DuplicateNode', 'PatchNode', 'ReparentNode'].forEach(type => {
    if (!capability.includes(`'${type}'`)) fail(`Runtime Node Command contract is missing ${type}.`);
});
if (!executor.includes('RUNTIME_NODE_COMMAND_BACKEND_IDENTITY_FORBIDDEN')) {
    fail('Runtime Node Command executor does not fail closed on backend/compatibility identity leakage.');
}
if (!executor.includes('compatibilityLifecycleAuthority') &&
    !executor.includes('RUNTIME_NODE_COMMAND_SCRATCH_BOUND_LIFECYCLE_REQUIRES_COMPATIBILITY')) {
    fail('Runtime Node Command executor does not preserve a compatibility lifecycle authority seam.');
}

const compatibilityDeleteMatches = explorer.match(/scratchSpriteAdapter\.destroyBindingByNodeId\s*\(/g) || [];
if (compatibilityDeleteMatches.length > 1) {
    fail(`Expected at most one legacy Scratch-bound delete compatibility exception; found ${compatibilityDeleteMatches.length}.`);
}

process.stdout.write('RE-3 Runtime Node Editor Command Boundary PASS.\n');
process.stdout.write(JSON.stringify({
    editorDirectRuntimeNodeMutations: 0,
    explicitScratchBoundDeleteCompatibilityExceptions: compatibilityDeleteMatches.length,
    protocolCommands: ['CreateNode', 'DestroyNode', 'DuplicateNode', 'PatchNode', 'ReparentNode'],
    workspaceNodeCommandDelegation: Boolean(workspaceCommand)
}, null, 2) + '\n');
