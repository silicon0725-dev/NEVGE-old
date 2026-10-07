const createReadonlyLookup = source => {
    const values = new Map(source);
    return Object.freeze({
        get: key => values.get(key) || null,
        has: key => values.has(key),
        keys: () => Object.freeze(Array.from(values.keys())),
        values: () => Object.freeze(Array.from(values.values()))
    });
};

/**
 * Build the editor-facing projection for Scratch-backed semantic Sprite nodes.
 *
 * The Project Explorer consumes this projection instead of inferring adapter
 * ownership from a backend-specific Runtime Node type. A binding is projected
 * only when its semantic owner node exists in the Runtime Node Model.
 *
 * @param {object} options projection input
 * @param {Array<object>} options.bindings adapter binding views
 * @param {Array<object>} options.runtimeNodes runtime node views
 * @returns {object} frozen read-only projection
 */
const createScratchSpriteTreeProjection = ({bindings = [], runtimeNodes = []} = {}) => {
    const runtimeNodeIds = new Set(runtimeNodes.map(node => node && node.id).filter(Boolean));
    const byNodeId = new Map();
    const byTargetRuntimeId = new Map();
    const projectedBindings = [];

    bindings.forEach(binding => {
        if (!binding || !runtimeNodeIds.has(binding.nodeId)) return;
        if (byNodeId.has(binding.nodeId)) return;
        byNodeId.set(binding.nodeId, binding);
        if (binding.targetRuntimeId && !byTargetRuntimeId.has(binding.targetRuntimeId)) {
            byTargetRuntimeId.set(binding.targetRuntimeId, binding);
        }
        projectedBindings.push(binding);
    });

    return Object.freeze({
        bindingByNodeId: createReadonlyLookup(byNodeId),
        bindingByTargetRuntimeId: createReadonlyLookup(byTargetRuntimeId),
        bindings: Object.freeze(projectedBindings.slice()),
        hiddenTargetRuntimeIds: Object.freeze(Array.from(byTargetRuntimeId.keys()))
    });
};

module.exports = {
    createScratchSpriteTreeProjection
};