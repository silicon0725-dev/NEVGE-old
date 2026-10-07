#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const {SCRATCH_ROLE_MANAGER_PARITY_CONTRACT} = require('../../src/core/functional-node/scratch-role-manager-parity');
const {
    SCRATCH_ROLE_MANAGER_PARITY_CAPABILITY_ID,
    SCRATCH_ROLE_MANAGER_PARITY_CONTRACT_ID,
    createScratchRoleManagerParityService
} = require('../../src/lib/scratch-sprite-adapter');

const checks = [];
const check = (title, fn) => {
    fn();
    checks.push(title);
};
const checkAsync = async (title, fn) => {
    await fn();
    checks.push(title);
};

const moduleSource = read('src/lib/scene-system/module-definition.js');
const paritySource = read('src/lib/scratch-sprite-adapter/scratch-role-manager-parity.js');
const lifecycleSource = read('src/lib/scratch-sprite-adapter/scratch-sprite-lifecycle-command-bridge.js');
const adapterSource = read('src/lib/scratch-sprite-adapter/scratch-sprite-node-adapter-service.js');
const commandSource = read('src/lib/runtime-nodes/runtime-node-command-executor.js');
const explorerSource = read('src/components/project-explorer/project-explorer.jsx');

check('WS-10N3 freezes a stable Scratch Role Manager parity contract', () => {
    assert.strictEqual(SCRATCH_ROLE_MANAGER_PARITY_CONTRACT.contractId, 'ngvge.scratch-role-manager-parity@1');
    assert.strictEqual(SCRATCH_ROLE_MANAGER_PARITY_CONTRACT.stageId, 'WS-10N3');
    assert.strictEqual(SCRATCH_ROLE_MANAGER_PARITY_CONTRACT_ID, SCRATCH_ROLE_MANAGER_PARITY_CONTRACT.contractId);
});

check('Stable NodeId remains selection authority and Scratch target identity is not authority', () => {
    assert.strictEqual(SCRATCH_ROLE_MANAGER_PARITY_CONTRACT.selectionAuthority, 'NodeId');
    assert.strictEqual(SCRATCH_ROLE_MANAGER_PARITY_CONTRACT.scratchTargetIdentityAuthority, false);
    assert.strictEqual(SCRATCH_ROLE_MANAGER_PARITY_CONTRACT.rules.nodeIdMustNotEqualScratchTargetId, true);
});

check('Stage and runtime-clone compatibility roles remain protected from persistent-node reinterpretation', () => {
    assert.strictEqual(SCRATCH_ROLE_MANAGER_PARITY_CONTRACT.rules.stageRemainsProtectedCompatibilityRole, true);
    assert.strictEqual(SCRATCH_ROLE_MANAGER_PARITY_CONTRACT.rules.runtimeCloneIsNotPersistentNode, true);
});

check('The parity service is published through Scene System as a first-party capability', () => {
    assert.strictEqual(SCRATCH_ROLE_MANAGER_PARITY_CAPABILITY_ID, 'ngvge.scratch-role-manager-parity');
    assert.match(moduleSource, /SCRATCH_ROLE_MANAGER_PARITY_CAPABILITY_ID/);
    assert.match(moduleSource, /createScratchRoleManagerParityService\(/);
    assert.match(moduleSource, /context\.capabilities\.provide\(\s*SCRATCH_ROLE_MANAGER_PARITY_CAPABILITY_ID/);
});

check('Parity is built from Runtime Node + Scratch Adapter capabilities instead of target IDs as node identity', () => {
    assert.match(paritySource, /getBindingByNodeId/);
    assert.match(paritySource, /getBindingByTargetRuntimeId/);
    assert.match(paritySource, /resolveNodeIdForTarget/);
    assert.match(paritySource, /resolveTargetRuntimeIdForNode/);
});

check('Semantic bound-Sprite order is projected with Scratch VM reorderTarget only inside compatibility service code', () => {
    assert.match(paritySource, /vm\.reorderTarget\(/);
    assert.doesNotMatch(explorerSource, /vm\.(?:renameSprite|duplicateSprite|deleteSprite|reorderTarget)\(/);
});

check('Runtime reparent for Scratch-owned nodes crosses the compatibility lifecycle authority', () => {
    assert.match(commandSource, /compatibilityLifecycleAuthority\.reparentNode\(\{/);
    assert.match(commandSource, /options:\s*setParentOptions/);
    assert.match(commandSource, /parentId/);
});

check('Scratch lifecycle reparent projects semantic order and has an authority-preserving rollback path', () => {
    assert.match(lifecycleSource, /const reparentNode = \(\{nodeId, parentId, options: reparentOptions = \{\}\}\) =>/);
    assert.match(lifecycleSource, /syncRoleManagerOrder\(sceneId\)/);
    assert.match(lifecycleSource, /reparent-rollback/);
});

check('Create and duplicate also synchronize compatibility target order after semantic parenting', () => {
    const matches = lifecycleSource.match(/syncRoleManagerOrder\(sceneId\)/g) || [];
    assert(matches.length >= 3, 'Expected create, duplicate and reparent to synchronize Role Manager order.');
});

check('Functional Sprite creation carries a portable blank costume asset so Scratch duplicateSprite remains valid', () => {
    assert.match(lifecycleSource, /BLANK_SPRITE_COSTUME_ASSET_ID/);
    assert.match(lifecycleSource, /asset:\s*\{\s*assetType:\s*BLANK_SPRITE_ASSET_TYPE,\s*data:\s*BLANK_SPRITE_COSTUME_BYTES,\s*dataFormat:\s*'svg'/s);
    assert.doesNotMatch(lifecycleSource, /costumes:\s*\[\s*\]/);
});

check('Legacy target order may reconcile only relative top-level bound Sprite slots', () => {
    assert.match(adapterSource, /synchronizeSceneRootSpriteOrder/);
    assert.match(adapterSource, /node && node\.parentId === root\.id/);
    assert.match(adapterSource, /runtimeNodeModel\.reorderChild/);
    assert.strictEqual(SCRATCH_ROLE_MANAGER_PARITY_CONTRACT.rules.nestedHierarchyRemainsNgvgeAuthority, true);
});

check('Node Explorer resolves external Scratch editing-target selection back to stable NodeId', () => {
    assert.match(explorerSource, /scratchRoleManagerParity\.resolveNodeIdForTarget\(editingTargetId, activeSceneId\)/);
});

check('Node Explorer projects bound semantic Node selection to Scratch editing target', () => {
    assert.match(explorerSource, /scratchRoleManagerParity\.resolveTargetRuntimeIdForNode\(node\.id\)/);
    assert.match(explorerSource, /onSelectTarget\(targetRuntimeId\)/);
});

check('Node Explorer advertises active Role Manager parity for browser evidence', () => {
    assert.match(explorerSource, /data-ngvge-role-manager-parity=\{scratchRoleManagerParity \? 'active' : 'compatibility-only'\}/);
});

check('Move Up/Down UI routes through Runtime Node ReparentNode instead of target-array mutation', () => {
    assert.match(explorerSource, /handleMoveRuntimeNode/);
    assert.match(explorerSource, /workspaceNodeCommandClient\.reparentNode\(\{/);
    assert.match(explorerSource, /options:\s*\{index:\s*targetIndex\}/);
    assert.match(explorerSource, />\s*Move Up\s*</);
    assert.match(explorerSource, />\s*Move Down\s*</);
});

check('Alt+Arrow sibling ordering uses the same Runtime Node command path', () => {
    assert.match(explorerSource, /event\.altKey && \(event\.key === 'ArrowUp' \|\| event\.key === 'ArrowDown'\)/);
    assert.match(explorerSource, /handleMoveRuntimeNode\(selectedRuntimeNodes\[0\], event\.key === 'ArrowUp' \? -1 : 1\)/);
});

check('Rename, duplicate and delete remain Runtime Node command-boundary operations', () => {
    assert.match(explorerSource, /workspaceNodeCommandClient\.patchNode\(\{/);
    assert.match(explorerSource, /workspaceNodeCommandClient\.duplicateNode\(\{/);
    assert.match(explorerSource, /workspaceNodeCommandClient\.destroyNode\(\{/);
});

const nodes = {
    root: {id: 'root', parentId: null},
    a: {id: 'node-a', parentId: 'root'},
    b: {id: 'node-b', parentId: 'root'}
};
const children = {
    root: [nodes.b, nodes.a],
    'node-a': [],
    'node-b': []
};
const bindings = [
    {nodeId: 'node-a', role: 'sprite', sceneId: 'scene-1', status: 'bound', targetRuntimeId: 'target-a'},
    {nodeId: 'node-b', role: 'sprite', sceneId: 'scene-1', status: 'bound', targetRuntimeId: 'target-b'}
];
const adapter = {
    getBindingByNodeId: nodeId => bindings.find(binding => binding.nodeId === nodeId) || null,
    getBindingByTargetRuntimeId: (targetRuntimeId, sceneId = null) => bindings.find(binding => (
        binding.targetRuntimeId === targetRuntimeId && (!sceneId || binding.sceneId === sceneId)
    )) || null,
    listBindings: sceneId => bindings.filter(binding => !sceneId || binding.sceneId === sceneId)
};
const model = {
    getChildren: nodeId => (children[nodeId] || []).slice(),
    getNodeSnapshot: nodeId => Object.values(nodes).find(node => node.id === nodeId) || null,
    getSceneRoot: sceneId => sceneId === 'scene-1' ? nodes.root : null
};
const stage = {id: 'stage', isOriginal: true, isStage: true};
const targetA = {id: 'target-a', isOriginal: true, isStage: false};
const targetB = {id: 'target-b', isOriginal: true, isStage: false};
const vm = {
    runtime: {targets: [stage, targetA, targetB]},
    reorderTarget: (sourceIndex, destinationIndex) => {
        const target = vm.runtime.targets.splice(sourceIndex, 1)[0];
        vm.runtime.targets.splice(destinationIndex, 0, target);
        return true;
    }
};
const parity = createScratchRoleManagerParityService({
    runtimeNodeModel: model,
    scratchSpriteAdapter: adapter,
    vm
});

check('Parity resolves NodeId and Scratch target runtime identity bidirectionally without equating them', () => {
    assert.strictEqual(parity.resolveNodeIdForTarget('target-a', 'scene-1'), 'node-a');
    assert.strictEqual(parity.resolveTargetRuntimeIdForNode('node-a'), 'target-a');
    assert.notStrictEqual('node-a', 'target-a');
});

check('Tree-order projection sees bound sprites in semantic DFS order', () => {
    assert.deepStrictEqual(parity.getBoundSpriteNodeIdsInTreeOrder('scene-1'), ['node-b', 'node-a']);
    assert.deepStrictEqual(parity.getBoundTargetIdsInTreeOrder('scene-1'), ['target-b', 'target-a']);
});

const finish = async () => {
    await checkAsync('Semantic order projection keeps Stage fixed and reorders only original Scratch sprites', async () => {
        const result = await parity.syncTargetOrderFromSceneTree('scene-1');
        assert.strictEqual(result.changed, true);
        assert.deepStrictEqual(vm.runtime.targets.map(target => target.id), ['stage', 'target-b', 'target-a']);
    });

    check('Parity status exposes stable contract identity and successful target-order synchronization', () => {
        assert.deepStrictEqual(parity.getStatus(), {
            contractId: SCRATCH_ROLE_MANAGER_PARITY_CONTRACT_ID,
            lastTargetOrderSyncError: null,
            targetOrderSyncCount: 1,
            targetOrderSyncFailureCount: 0,
            version: 1
        });
    });

    process.stdout.write(`WS-10N3 Scratch Role Manager Functional Parity Conformance PASS (${checks.length}/${checks.length}).\n`);
};

finish().catch(error => {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
});
