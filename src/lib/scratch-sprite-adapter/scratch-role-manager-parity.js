'use strict';

const {
    SCRATCH_BINDING_STATUSES,
    SCRATCH_TARGET_ROLES
} = require('./constants');

const SCRATCH_ROLE_MANAGER_PARITY_CAPABILITY_ID = 'ngvge.scratch-role-manager-parity';
const SCRATCH_ROLE_MANAGER_PARITY_VERSION = 1;
const SCRATCH_ROLE_MANAGER_PARITY_CONTRACT_ID = 'ngvge.scratch-role-manager-parity@1';

const normalizeString = value => (
    typeof value === 'string' && value.trim() ? value.trim() : null
);

const readScratchRuntimeTargets = vm => {
    if (!vm || !vm.runtime) return [];
    const targets = vm.runtime.targets;
    if (!targets || typeof targets !== 'object') return [];
    if (Array.isArray(targets)) return targets.slice();
    let length;
    try {
        length = targets.length;
    } catch {
        return [];
    }
    if (!Number.isSafeInteger(length) || length < 0) return [];
    const copied = [];
    for (let index = 0; index < length; index++) {
        try {
            copied.push(targets[index]);
        } catch {
            return [];
        }
    }
    return copied;
};

const getTargetRuntimeId = target => normalizeString(target && target.id);

const getOriginalSpriteSlots = vm => readScratchRuntimeTargets(vm)
    .map((target, index) => ({index, target}))
    .filter(entry => entry.target && !entry.target.isStage && entry.target.isOriginal !== false);

const assertRuntimeNodeModel = runtimeNodeModel => {
    const required = ['getChildren', 'getNodeSnapshot', 'getSceneRoot'];
    if (!runtimeNodeModel || required.some(method => typeof runtimeNodeModel[method] !== 'function')) {
        throw new TypeError('Scratch Role Manager parity requires the Runtime Node Model capability.');
    }
    return runtimeNodeModel;
};

const assertAdapter = scratchSpriteAdapter => {
    const required = ['getBindingByNodeId', 'getBindingByTargetRuntimeId', 'listBindings'];
    if (!scratchSpriteAdapter || required.some(method => typeof scratchSpriteAdapter[method] !== 'function')) {
        throw new TypeError('Scratch Role Manager parity requires the Scratch Sprite Adapter capability.');
    }
    return scratchSpriteAdapter;
};

const createScratchRoleManagerParityService = ({vm, runtimeNodeModel, scratchSpriteAdapter}) => {
    const model = assertRuntimeNodeModel(runtimeNodeModel);
    const adapter = assertAdapter(scratchSpriteAdapter);
    let targetOrderSyncCount = 0;
    let targetOrderSyncFailureCount = 0;
    let lastTargetOrderSyncError = null;

    const resolveNodeIdForTarget = (targetRuntimeId, sceneId = null) => {
        const binding = adapter.getBindingByTargetRuntimeId(targetRuntimeId, sceneId);
        return binding && binding.nodeId ? binding.nodeId : null;
    };

    const resolveTargetRuntimeIdForNode = nodeId => {
        const binding = adapter.getBindingByNodeId(nodeId);
        return binding && binding.status === SCRATCH_BINDING_STATUSES.BOUND ? binding.targetRuntimeId : null;
    };

    const getBoundSpriteNodeIdsInTreeOrder = sceneId => {
        const root = model.getSceneRoot(sceneId);
        if (!root) return [];
        const bindingByNodeId = new Map(adapter.listBindings(sceneId)
            .filter(binding => binding && binding.role === SCRATCH_TARGET_ROLES.SPRITE)
            .map(binding => [binding.nodeId, binding]));
        const ordered = [];
        const visit = node => {
            if (!node) return;
            const binding = bindingByNodeId.get(node.id);
            if (binding && binding.status === SCRATCH_BINDING_STATUSES.BOUND && binding.targetRuntimeId) {
                ordered.push(node.id);
            }
            model.getChildren(node.id).forEach(visit);
        };
        model.getChildren(root.id).forEach(visit);
        return ordered;
    };

    const getBoundTargetIdsInTreeOrder = sceneId => getBoundSpriteNodeIdsInTreeOrder(sceneId)
        .map(resolveTargetRuntimeIdForNode)
        .filter(Boolean);

    const syncTargetOrderFromSceneTree = async sceneId => {
        const desiredTargetIds = getBoundTargetIdsInTreeOrder(sceneId);
        if (desiredTargetIds.length < 2) {
            lastTargetOrderSyncError = null;
            return Object.freeze({changed: false, sceneId, targetRuntimeIds: desiredTargetIds});
        }
        if (!vm || typeof vm.reorderTarget !== 'function') {
            const error = new Error('Scratch VM does not expose reorderTarget for Role Manager order projection.');
            error.code = 'NGVGE_SCRATCH_ROLE_MANAGER_REORDER_UNAVAILABLE';
            targetOrderSyncFailureCount += 1;
            lastTargetOrderSyncError = error.message;
            throw error;
        }

        let changed = false;
        try {
            for (let desiredIndex = 0; desiredIndex < desiredTargetIds.length; desiredIndex++) {
                const slots = getOriginalSpriteSlots(vm);
                const currentOrder = slots.map(entry => getTargetRuntimeId(entry.target)).filter(Boolean);
                const desiredTargetId = desiredTargetIds[desiredIndex];
                const currentSpriteIndex = currentOrder.indexOf(desiredTargetId);
                if (currentSpriteIndex === -1 || currentSpriteIndex === desiredIndex) continue;
                const sourceSlot = slots[currentSpriteIndex];
                const destinationSlot = slots[desiredIndex];
                if (!sourceSlot || !destinationSlot) continue;
                await Promise.resolve(vm.reorderTarget(sourceSlot.index, destinationSlot.index));
                changed = true;
            }
            targetOrderSyncCount += 1;
            lastTargetOrderSyncError = null;
            return Object.freeze({changed, sceneId, targetRuntimeIds: desiredTargetIds});
        } catch (error) {
            targetOrderSyncFailureCount += 1;
            lastTargetOrderSyncError = error && error.message ? error.message : String(error);
            throw error;
        }
    };

    return Object.freeze({
        capabilityId: SCRATCH_ROLE_MANAGER_PARITY_CAPABILITY_ID,
        contractId: SCRATCH_ROLE_MANAGER_PARITY_CONTRACT_ID,
        version: SCRATCH_ROLE_MANAGER_PARITY_VERSION,
        getBoundSpriteNodeIdsInTreeOrder,
        getBoundTargetIdsInTreeOrder,
        getStatus: () => Object.freeze({
            contractId: SCRATCH_ROLE_MANAGER_PARITY_CONTRACT_ID,
            lastTargetOrderSyncError,
            targetOrderSyncCount,
            targetOrderSyncFailureCount,
            version: SCRATCH_ROLE_MANAGER_PARITY_VERSION
        }),
        resolveNodeIdForTarget,
        resolveTargetRuntimeIdForNode,
        syncTargetOrderFromSceneTree
    });
};

module.exports = {
    SCRATCH_ROLE_MANAGER_PARITY_CAPABILITY_ID,
    SCRATCH_ROLE_MANAGER_PARITY_CONTRACT_ID,
    SCRATCH_ROLE_MANAGER_PARITY_VERSION,
    createScratchRoleManagerParityService
};
