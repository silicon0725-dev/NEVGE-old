'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const fail = message => {
    const error = new Error(message);
    error.code = 'NGVGE_RE4_SCRATCH_SPRITE_LIFECYCLE_COMMAND_BRIDGE_FAILED';
    throw error;
};

const explorer = read('src/components/project-explorer/project-explorer.jsx');
const inspector = read('src/components/project-inspector/project-inspector.jsx');
const sceneModule = read('src/lib/scene-system/module-definition.js');
const capability = read('src/lib/runtime-nodes/runtime-node-command-capability.js');
const executor = read('src/lib/runtime-nodes/runtime-node-command-executor.js');
const bridge = read('src/lib/scratch-sprite-adapter/scratch-sprite-lifecycle-command-bridge.js');

if (!bridge.includes("const SPRITE_LIFECYCLE_STATE_DOMAIN = 'SpriteLifecycle'")) {
    fail('SpriteLifecycle semantic state domain is missing.');
}
if (!bridge.includes("const SCRATCH_SPRITE_LIFECYCLE_AUTHORITY_ID = 'scratch.compat.sprite-lifecycle'")) {
    fail('Scratch Sprite lifecycle compatibility authority identity is missing.');
}
['addSprite', 'renameSprite', 'duplicateSprite'].forEach(method => {
    if (!bridge.includes(`vm.${method}`)) fail(`Scratch Sprite lifecycle bridge does not own ${method}.`);
});
if (!bridge.includes('adapter.destroyBindingByNodeId')) {
    fail('Scratch Sprite lifecycle bridge does not own bound Sprite destruction.');
}
if (!sceneModule.includes('createScratchSpriteLifecycleCommandBridge')) {
    fail('Scene System does not construct the Scratch Sprite lifecycle command bridge.');
}
if (!sceneModule.includes('compatibilityLifecycleAuthority: scratchSpriteLifecycleCommandBridge')) {
    fail('Runtime Node Command executor is not wired to the compatibility lifecycle authority seam.');
}
if (!executor.includes('compatibilityLifecycleAuthority')) {
    fail('Runtime Node Command executor has no compatibility lifecycle authority seam.');
}
if (/scratchSpriteAdapter|targetRuntimeId/.test(executor.replace(/'targetRuntimeId'/g, ''))) {
    fail('Generic Runtime Node Command executor contains Scratch-specific lifecycle implementation details.');
}
if (!executor.includes('collectBackendPayloadFields')) {
    fail('Runtime Node Command executor does not recursively reject nested backend identity fields.');
}
if (!capability.includes('executeCommandMayReturnPromise: true')) {
    fail('Runtime Node Command contract does not declare asynchronous compatibility command completion.');
}
if (!capability.includes('unwrapRuntimeNodeCommandResultAsync')) {
    fail('Runtime Node Editor client lacks an async protocol result unwrap path.');
}

const directExplorerLifecycleMutations = [
    /scratchSpriteAdapter\.destroyBindingByNodeId\s*\(/g,
    /vm\.renameSprite\s*\(/g,
    /vm\.duplicateSprite\s*\(/g,
    /vm\.addSprite\s*\(/g,
    /vm\.deleteSprite\s*\(/g
].flatMap(pattern => explorer.match(pattern) || []);
if (directExplorerLifecycleMutations.length) {
    fail(`Project Explorer still performs direct Scratch Sprite lifecycle mutations: ${directExplorerLifecycleMutations.join(', ')}`);
}

const runtimeInspectorSection = inspector.slice(
    inspector.indexOf('const executeRuntimeNodeEditorCommand'),
    inspector.indexOf('const commitSelectedRuntimeTransformPatch')
);
if (/vm\.(?:renameSprite|duplicateSprite|addSprite|deleteSprite)\s*\(/.test(runtimeInspectorSection)) {
    fail('Runtime Inspector operations directly call Scratch Sprite lifecycle VM APIs.');
}

['CreateNode', 'DestroyNode', 'DuplicateNode', 'PatchNode'].forEach(type => {
    if (!capability.includes(`'${type}'`)) fail(`Runtime Node Command contract is missing lifecycle command ${type}.`);
});

process.stdout.write('RE-4 Scratch Sprite Lifecycle Command Bridge PASS.\n');
process.stdout.write(JSON.stringify({
    currentAuthority: 'scratch.compat.sprite-lifecycle',
    editorDirectScratchLifecycleMutations: 0,
    nestedBackendIdentityGate: 'recursive',
    stateDomain: 'SpriteLifecycle',
    supportedLifecycleCommands: ['CreateNode', 'PatchNode(name)', 'DuplicateNode', 'DestroyNode']
}, null, 2) + '\n');
