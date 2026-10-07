'use strict';

const assert = require('assert');
const {
    FUNCTIONAL_COMPONENT_TYPE_IDS,
    FUNCTIONAL_NODE_ARCHETYPE_IDS,
    FUNCTIONAL_NODE_FOUNDATION,
    NATIVE_PROJECT_FORMAT,
    SCRATCH_COMPATIBILITY_FORMAT,
    SCRATCH_PROJECTION_ROLES,
    getFunctionalNodeArchetype
} = require('../../../src/core/functional-node');
const {TRANSFORM2D_TYPE_ID} = require('../../../src/core/transform2d');

const assertFunctionalNodeFoundationContract = () => {
    assert.strictEqual(NATIVE_PROJECT_FORMAT.extension, '.ne');
    assert.strictEqual(SCRATCH_COMPATIBILITY_FORMAT.extension, '.sb3');
    assert.strictEqual(FUNCTIONAL_NODE_FOUNDATION.hierarchyOwnership.parentIsSerializationOwner, false);
    assert.strictEqual(FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D, TRANSFORM2D_TYPE_ID);
    assert.strictEqual(
        getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.SPRITE_2D).scratchProjectionRole,
        SCRATCH_PROJECTION_ROLES.TARGET
    );
    assert.strictEqual(
        getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.TILEMAP_LAYER_2D).scratchProjectionRole,
        SCRATCH_PROJECTION_ROLES.BAKE
    );
    return {
        archetypeStrategy: FUNCTIONAL_NODE_FOUNDATION.archetypeStrategy,
        nativeFormat: NATIVE_PROJECT_FORMAT.extension,
        scratchCompatibility: SCRATCH_COMPATIBILITY_FORMAT.extension
    };
};

module.exports = {assertFunctionalNodeFoundationContract};
