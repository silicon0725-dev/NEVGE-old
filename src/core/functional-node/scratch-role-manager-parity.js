'use strict';

const SCRATCH_ROLE_MANAGER_PARITY_CONTRACT = Object.freeze({
    contractId: 'ngvge.scratch-role-manager-parity@1',
    stageId: 'WS-10N3',
    selectionAuthority: 'NodeId',
    scratchTargetIdentityAuthority: false,
    rules: Object.freeze({
        boundSpriteSelectionProjectsToScratchEditingTarget: true,
        externalScratchSelectionNormalizesToStableNodeId: true,
        renameUsesRuntimeNodeCommandBoundary: true,
        duplicateUsesRuntimeNodeCommandBoundary: true,
        deleteUsesRuntimeNodeCommandBoundary: true,
        semanticOrderProjectsToScratchTargetOrder: true,
        legacyTargetOrderMayReconcileTopLevelBoundSpriteOrder: true,
        nestedHierarchyRemainsNgvgeAuthority: true,
        stageRemainsProtectedCompatibilityRole: true,
        runtimeCloneIsNotPersistentNode: true,
        nodeIdMustNotEqualScratchTargetId: true
    }),
    browserAcceptance: Object.freeze([
        'select-node-switches-blocks-editing-target',
        'legacy-target-selection-selects-stable-node',
        'rename-node-renames-legacy-sprite',
        'duplicate-node-creates-one-bound-sprite',
        'delete-node-removes-bound-sprite',
        'move-up-down-preserves-node-target-order-parity'
    ])
});

module.exports = {
    SCRATCH_ROLE_MANAGER_PARITY_CONTRACT
};
