const {SEMANTIC_RUNTIME_NODE_TYPE_IDS} = require('../runtime-nodes/constants');

const SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID = 'ngvge.scratch-sprite-node-adapter';
const SCRATCH_SPRITE_ADAPTER_VERSION = 2;
const SCRATCH_SPRITE_BINDING_SCHEMA_VERSION = 2;
const SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY = 'scratchSpriteBindings';
const SPRITE_NODE_TYPE_ID = SEMANTIC_RUNTIME_NODE_TYPE_IDS.SPRITE;
const LEGACY_SCRATCH_SPRITE_NODE_TYPE_ID = 'ngvge.scratch-sprite-node';
// Kept as a compatibility export for older callers. New code must use
// SPRITE_NODE_TYPE_ID for semantic nodes and the binding component for Scratch ownership.
const SCRATCH_SPRITE_NODE_TYPE_ID = LEGACY_SCRATCH_SPRITE_NODE_TYPE_ID;
const SCRATCH_TARGET_BINDING_COMPONENT_TYPE_ID = 'ngvge.scratch-target-binding';
const SCRATCH_SPRITE_NODE_TYPE_OWNER = 'ngvge.scene-system';

const SCRATCH_BINDING_DESTROY_POLICIES = Object.freeze({
    DELETE_TARGET: 'delete-target',
    DETACH: 'detach'
});

const SCRATCH_TARGET_ROLES = Object.freeze({
    SPRITE: 'sprite'
});

const SCRATCH_BINDING_STATUSES = Object.freeze({
    BOUND: 'bound',
    ERROR: 'error',
    MISSING: 'missing',
    OFFLINE: 'offline',
    RECONCILING: 'reconciling'
});

module.exports = {
    LEGACY_SCRATCH_SPRITE_NODE_TYPE_ID,
    SCRATCH_BINDING_DESTROY_POLICIES,
    SCRATCH_BINDING_STATUSES,
    SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID,
    SCRATCH_SPRITE_ADAPTER_VERSION,
    SCRATCH_SPRITE_BINDING_SCHEMA_VERSION,
    SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY,
    SCRATCH_SPRITE_NODE_TYPE_ID,
    SCRATCH_SPRITE_NODE_TYPE_OWNER,
    SCRATCH_TARGET_BINDING_COMPONENT_TYPE_ID,
    SCRATCH_TARGET_ROLES,
    SPRITE_NODE_TYPE_ID
};
