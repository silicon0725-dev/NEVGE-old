'use strict';

const assert = require('assert');
const {
    FUNCTIONAL_NODE_ARCHETYPE_IDS,
    createFunctionalNodeCreationPlan,
    listCreatableFunctionalNodeArchetypes
} = require('../../../src/core/functional-node');
const {CAMERA2D_TYPE_ID} = require('../../../src/core/camera2d');
const {COLLIDER2D_TYPE_ID} = require('../../../src/core/collider2d');
const {TRANSFORM2D_TYPE_ID} = require('../../../src/core/transform2d');

const assertFunctionalNodeCreationContract = () => {
    const withoutScratch = listCreatableFunctionalNodeArchetypes({scratchCompatibilityAvailable: false});
    const withoutScratchIds = withoutScratch.map(item => item.id);
    assert(withoutScratchIds.includes(FUNCTIONAL_NODE_ARCHETYPE_IDS.NODE_2D));
    assert(!withoutScratchIds.includes(FUNCTIONAL_NODE_ARCHETYPE_IDS.SPRITE_2D));
    assert(withoutScratchIds.includes(FUNCTIONAL_NODE_ARCHETYPE_IDS.CAMERA_2D));
    assert(withoutScratchIds.includes(FUNCTIONAL_NODE_ARCHETYPE_IDS.AREA_2D));

    const withScratch = listCreatableFunctionalNodeArchetypes({scratchCompatibilityAvailable: true});
    const withScratchIds = withScratch.map(item => item.id);
    assert(withScratchIds.includes(FUNCTIONAL_NODE_ARCHETYPE_IDS.NODE_2D));
    assert(withScratchIds.includes(FUNCTIONAL_NODE_ARCHETYPE_IDS.SPRITE_2D));
    assert(withScratchIds.includes(FUNCTIONAL_NODE_ARCHETYPE_IDS.CAMERA_2D));
    assert(withScratchIds.includes(FUNCTIONAL_NODE_ARCHETYPE_IDS.AREA_2D));
    assert(withScratchIds.includes(FUNCTIONAL_NODE_ARCHETYPE_IDS.STATIC_BODY_2D));
    assert(withScratchIds.includes(FUNCTIONAL_NODE_ARCHETYPE_IDS.CHARACTER_BODY_2D));
    assert(withScratchIds.includes(FUNCTIONAL_NODE_ARCHETYPE_IDS.TILEMAP_LAYER_2D));
    assert(withScratchIds.includes(FUNCTIONAL_NODE_ARCHETYPE_IDS.RIGID_BODY_2D));
    assert(!withScratchIds.includes(FUNCTIONAL_NODE_ARCHETYPE_IDS.AUDIO_SOURCE_2D));

    const nativePlan = createFunctionalNodeCreationPlan(
        FUNCTIONAL_NODE_ARCHETYPE_IDS.NODE_2D,
        {scratchCompatibilityAvailable: false}
    );
    assert.strictEqual(nativePlan.runtimeTypeId, 'ngvge.node2d');
    assert.deepStrictEqual(nativePlan.options.components.map(component => component.typeId), [TRANSFORM2D_TYPE_ID]);
    assert.strictEqual(nativePlan.options.archetypeId, undefined);

    const spritePlan = createFunctionalNodeCreationPlan(
        FUNCTIONAL_NODE_ARCHETYPE_IDS.SPRITE_2D,
        {scratchCompatibilityAvailable: true}
    );
    assert.strictEqual(spritePlan.runtimeTypeId, 'ngvge.sprite-node');
    assert.deepStrictEqual(spritePlan.options.components.map(component => component.typeId), [TRANSFORM2D_TYPE_ID]);
    assert.strictEqual(spritePlan.options.targetRuntimeId, undefined);
    assert.strictEqual(spritePlan.options.bindingId, undefined);

    const cameraPlan = createFunctionalNodeCreationPlan(
        FUNCTIONAL_NODE_ARCHETYPE_IDS.CAMERA_2D,
        {scratchCompatibilityAvailable: false}
    );
    assert.strictEqual(cameraPlan.runtimeTypeId, 'ngvge.node2d');
    assert.deepStrictEqual(cameraPlan.options.components.map(component => component.typeId), [
        TRANSFORM2D_TYPE_ID,
        CAMERA2D_TYPE_ID
    ]);
    assert.strictEqual(cameraPlan.options.targetRuntimeId, undefined);
    assert.strictEqual(cameraPlan.options.bindingId, undefined);

    const areaPlan = createFunctionalNodeCreationPlan(
        FUNCTIONAL_NODE_ARCHETYPE_IDS.AREA_2D,
        {scratchCompatibilityAvailable: false}
    );
    assert.strictEqual(areaPlan.runtimeTypeId, 'ngvge.node2d');
    assert.deepStrictEqual(areaPlan.options.components.map(component => component.typeId), [
        TRANSFORM2D_TYPE_ID,
        COLLIDER2D_TYPE_ID
    ]);
    assert.strictEqual(areaPlan.options.components[1].data.sensor, true);

    return {
        camera2DNativeProvisioning: true,
        nativeNode2DProvisioning: true,
        area2DNativeProvisioning: true,
        plannedAudioArchetypeHidden: true,
        rigidBodyCoreContractGraduated: true,
        scratchSpriteProjectionUsesSemanticType: true,
        targetIdentityExcluded: true
    };
};

module.exports = {assertFunctionalNodeCreationContract};
