/* eslint-disable no-console, strict */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const exists = relative => fs.existsSync(path.join(ROOT, relative));
const walk = relative => {
    const base = path.join(ROOT, relative);
    const out = [];
    const visit = current => {
        for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
            const target = path.join(current, entry.name);
            if (entry.isDirectory()) visit(target);
            else if (/\.(?:js|jsx|ts|tsx)$/.test(entry.name)) out.push(target);
        }
    };
    visit(base);
    return out;
};

const checks = [];
const check = (name, predicate, detail) => {
    let ok = false;
    let error = null;
    try {
        ok = Boolean(predicate());
    } catch (err) {
        error = err;
    }
    checks.push({detail: error ? error.message : detail, name, ok});
};

const constants = read('src/lib/collaboration-semantic/constants.js');
const authority = read('src/lib/collaboration-semantic/collaboration-semantic-authority.js');
const operation = read('src/lib/collaboration-semantic/collaboration-operation.js');
const host = read('src/lib/collaboration-semantic/collaboration-semantic-host.js');
const service = read('src/lib/collaboration-service.js');
const sync = read('src/lib/collaboration/sync-manager.js');
const assets = read('src/lib/collaboration/asset-events.js');
const scratchExtensionHost = read('src/lib/extension-containment/scratch-extension-host.js');
const debtPath = 'docs/architecture/collaboration/COL-0-legacy-collaboration-debt-matrix.csv';
const debt = exists(debtPath) ? read(debtPath) : '';
const lexDebt = read('docs/architecture/extensions/LEX-1-legacy-extension-debt-matrix.csv');
const collaborationSources = [
    path.join(ROOT, 'src/lib/collaboration-service.js'),
    ...walk('src/lib/collaboration')
];

check('Stable Collaboration Semantic identities exist', () =>
    constants.includes('ngvge.collaboration-semantic-host@1') &&
    constants.includes('ngvge.collaboration-semantic-client@1') &&
    constants.includes('ngvge.collaboration-operation/v1'),
'Stable host/client/schema identities are present.');

check('Collaboration Semantic has one Writer Authority', () =>
    authority.includes('ngvge.collaboration.semantic') &&
    authority.includes('authority:ngvge.collaboration-semantic-host') &&
    authority.includes('AUTHORITY_MODES.WRITER'),
'Collaboration semantic state has one explicit writer registration.');

check('Semantic operation DTO forbids backend identity', () =>
    operation.includes("'targetId'") &&
    operation.includes("'targetRuntimeId'") &&
    operation.includes("'extensionManager'") &&
    operation.includes("'renderer'") &&
    operation.includes('assertNoBackendIdentity'),
'Portable collaboration DTO cannot carry Scratch/backend handles.');

check('Runtime collaboration surface is query-only', () => {
    const clientStart = host.indexOf('const client = Object.freeze');
    const returnStart = host.indexOf('return Object.freeze({', clientStart);
    const clientSource = host.slice(clientStart, returnStart);
    return clientStart >= 0 && returnStart > clientStart &&
        clientSource.includes('getStatus') && clientSource.includes('listDiagnostics') &&
        !clientSource.includes('executeOperation') && !clientSource.includes('resolveTargetByNodeId');
}, 'Runtime property cannot mutate collaboration state or reveal local Scratch target identity.');

check('Stable NodeId bridge uses Scratch Sprite Adapter capability', () =>
    host.includes('SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID') &&
    host.includes('getBindingByTargetRuntimeId') &&
    host.includes('getBindingByNodeId'),
'Volatile Scratch target ids are translated only at the semantic/compatibility boundary.');

check('Remote node mutations route through Runtime Node and Transform commands', () =>
    host.includes('RUNTIME_NODE_COMMAND_CAPABILITY_ID') &&
    host.includes('TRANSFORM2D_COMMAND_CAPABILITY_ID') &&
    host.includes('createRuntimeNodeEditorClient') &&
    host.includes('createTransform2DEditorClient') &&
    assets.includes('COLLABORATION_OPERATION_TYPES.NODE_DESTROY') &&
    assets.includes('COLLABORATION_OPERATION_TYPES.NODE_RENAME') &&
    service.includes('COLLABORATION_OPERATION_TYPES.NODE_TRANSFORM_PATCH'),
'Rename/delete/transform remote changes use stable NodeId command paths.');

check('Project sync uses Project Lifecycle Host and never transplants remote target ids', () =>
    sync.includes('installProjectLifecycleHost(service.vm).loadProject') &&
    sync.includes('projectLifecycle.saveProjectSb3') &&
    !/targetData\.id\s*=\s*targetInfo/.test(sync) &&
    sync.includes('currentEditingNodeId') && sync.includes('nodeId:'),
'Project serialization/load is hosted and stable NodeId accompanies legacy compatibility metadata.');

check('Collaboration has zero direct Scratch ExtensionManager access', () => {
    const forbidden = /(?:\.extensionManager\b|_loadedExtensions|loadExtensionIdSync\s*\()/;
    return collaborationSources.every(file => !forbidden.test(fs.readFileSync(file, 'utf8')));
}, 'Collaboration uses Scratch Extension Host instead of raw/private ExtensionManager.');

check('Scratch Extension Host exposes observable load/unload/reorder seam', () =>
    scratchExtensionHost.includes('loadBuiltInExtension') &&
    scratchExtensionHost.includes('reorderExtension') &&
    scratchExtensionHost.includes('subscribe (listener)') &&
    scratchExtensionHost.includes("kind: 'unloaded'") &&
    scratchExtensionHost.includes("kind: 'reordered'"),
'Collaboration can observe extension lifecycle without monkey-patching the backend.');

check('Legacy collaboration wire prefers NodeId while retaining explicit targetId shadow', () =>
    service.includes('updates.push({nodeId, targetId: id') &&
    service.includes('nodeId: editingNodeId') &&
    assets.includes('if (payload.nodeId && service.collaborationSemanticController)') &&
    debt.includes('COMPATIBILITY_SHADOW'),
'NodeId is primary; old targetId mapping is explicit compatibility debt.');

check('Collaboration compatibility facade survives semantic migration', () => [
    'attachToWorkspace (',
    'detachFromWorkspace (',
    'wrapVMAssetMethods ()',
    'handleAssetEvent (',
    'serializeEvent (',
    'connectToRoom (',
    'handleConnection (',
    'handleMessage (',
    'sendMessage (',
    'handleUserJoin ('
].every(method => service.includes(method)),
'COL-0 migration must not delete the legacy CollaborationService public/compatibility facade.');

check('Semantic host is transport independent', () => {
    const files = walk('src/lib/collaboration-semantic');
    const forbidden = /(?:PeerJS|peerjs|DataConnection|RTCPeerConnection|\.connections\b|roomId)/;
    return files.every(file => !forbidden.test(fs.readFileSync(file, 'utf8')));
}, 'Peer/CRDT transport objects do not enter semantic host modules.');

check('Remaining Scratch collaboration debt is fail-visible and assigned', () => [
    'src/lib/collaboration/block-events.js',
    'src/lib/collaboration/asset-events.js',
    'src/lib/collaboration/target-id-utils.js',
    'src/lib/collaboration/cursor-sync.js',
    'COL_LEGACY_TARGET_ID_FALLBACK'
].every(item => debt.includes(item) || service.includes(item) || assets.includes(item)),
'Blocks/assets/presence/legacy target mapping are recorded rather than promoted to native semantics.');

check('LEX collaboration ExtensionManager debts are closed by COL-0', () =>
    ['LEX-D003', 'LEX-D004', 'LEX-D005'].every(id => {
        const line = lexDebt.split(/\r?\n/).find(item => item.startsWith(`${id},`));
        return line && line.includes(',CONTAINED,');
    }),
'LEX-1 deferred collaboration extension debts now point at contained Host paths.');

const packageJSON = JSON.parse(read('package.json'));
check('COL-0 focused/certification/Webpack gates are registered', () =>
    typeof packageJSON.scripts['test:collaboration:col0'] === 'string' &&
    typeof packageJSON.scripts['test:collaboration:col0-certification'] === 'string' &&
    typeof packageJSON.scripts['test:collaboration:col0-webpack'] === 'string' &&
    packageJSON.scripts['test:collaboration:col0-webpack'].includes('validate-col0-webpack-collaboration-entry.js'),
'COL-0 has repeatable focused, cumulative and real Webpack gate commands.');

const passed = checks.filter(item => item.ok).length;
for (const item of checks) {
    console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
}
console.log(`\nCOL-0 Machine DoD: ${passed}/${checks.length} PASS`);
if (passed !== checks.length) process.exitCode = 1;
