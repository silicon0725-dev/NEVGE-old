'use strict';

const assert = require('assert');
const {SCRATCH_ROLE_MANAGER_PARITY_CONTRACT} = require('../../../src/core/functional-node/scratch-role-manager-parity');
const {
    SCRATCH_ROLE_MANAGER_PARITY_CONTRACT_ID,
    createScratchRoleManagerParityService
} = require('../../../src/lib/scratch-sprite-adapter');

const assertScratchRoleManagerParityContract = async () => {
    assert.strictEqual(SCRATCH_ROLE_MANAGER_PARITY_CONTRACT.contractId, SCRATCH_ROLE_MANAGER_PARITY_CONTRACT_ID);
    assert.strictEqual(SCRATCH_ROLE_MANAGER_PARITY_CONTRACT.selectionAuthority, 'NodeId');
    assert.strictEqual(SCRATCH_ROLE_MANAGER_PARITY_CONTRACT.scratchTargetIdentityAuthority, false);
    assert.strictEqual(SCRATCH_ROLE_MANAGER_PARITY_CONTRACT.rules.nestedHierarchyRemainsNgvgeAuthority, true);

    const root = {id: 'root', parentId: null};
    const first = {id: 'node-first', parentId: root.id};
    const second = {id: 'node-second', parentId: root.id};
    const children = new Map([
        [root.id, [second, first]],
        [first.id, []],
        [second.id, []]
    ]);
    const bindings = [
        {nodeId: first.id, role: 'sprite', sceneId: 'scene', status: 'bound', targetRuntimeId: 'target-first'},
        {nodeId: second.id, role: 'sprite', sceneId: 'scene', status: 'bound', targetRuntimeId: 'target-second'}
    ];
    const vm = {
        runtime: {
            targets: [
                {id: 'stage', isOriginal: true, isStage: true},
                {id: 'target-first', isOriginal: true, isStage: false},
                {id: 'target-second', isOriginal: true, isStage: false}
            ]
        },
        reorderTarget: (sourceIndex, destinationIndex) => {
            const target = vm.runtime.targets.splice(sourceIndex, 1)[0];
            vm.runtime.targets.splice(destinationIndex, 0, target);
            return true;
        }
    };
    const service = createScratchRoleManagerParityService({
        runtimeNodeModel: {
            getChildren: nodeId => (children.get(nodeId) || []).slice(),
            getNodeSnapshot: nodeId => [root, first, second].find(node => node.id === nodeId) || null,
            getSceneRoot: sceneId => sceneId === 'scene' ? root : null
        },
        scratchSpriteAdapter: {
            getBindingByNodeId: nodeId => bindings.find(binding => binding.nodeId === nodeId) || null,
            getBindingByTargetRuntimeId: targetId => bindings.find(binding => binding.targetRuntimeId === targetId) || null,
            listBindings: () => bindings.slice()
        },
        vm
    });

    assert.strictEqual(service.resolveNodeIdForTarget('target-first', 'scene'), first.id);
    assert.strictEqual(service.resolveTargetRuntimeIdForNode(first.id), 'target-first');
    assert.deepStrictEqual(service.getBoundTargetIdsInTreeOrder('scene'), ['target-second', 'target-first']);
    await service.syncTargetOrderFromSceneTree('scene');
    assert.deepStrictEqual(vm.runtime.targets.map(target => target.id), ['stage', 'target-second', 'target-first']);

    return {
        nodeIdSelectionAuthority: true,
        targetOrderProjection: true,
        targetToNodeNormalization: true
    };
};

module.exports = {assertScratchRoleManagerParityContract};
