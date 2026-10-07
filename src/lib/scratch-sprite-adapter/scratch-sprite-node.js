const {RuntimeNode2D} = require('../runtime-nodes/runtime-node');
const {SCRATCH_TARGET_ROLES} = require('./constants');

// Legacy constructor retained only so old persisted node records can be loaded
// and migrated without losing their stable NodeId or child tree.
class ScratchSpriteRuntimeNode extends RuntimeNode2D {
    constructor (options = {}) {
        const source = options.source && typeof options.source === 'object' ? options.source : {};
        if (source.kind !== 'scratch-target' || source.role !== SCRATCH_TARGET_ROLES.SPRITE ||
            typeof source.bindingId !== 'string' || !source.bindingId.trim()) {
            const error = new Error(
                'Scratch Sprite Runtime Nodes must be created through the Scratch Sprite Adapter with a stable binding.'
            );
            error.code = 'SCRATCH_SPRITE_NODE_BINDING_REQUIRED';
            throw error;
        }
        super(options);
    }
}

module.exports = {
    ScratchSpriteRuntimeNode
};
