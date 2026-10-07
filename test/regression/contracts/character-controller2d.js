'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    CHARACTER_CONTROLLER2D_CONTRACT,
    normalizeCharacterController2D
} = require('../../../src/core/character-controller2d');
const {
    FUNCTIONAL_COMPONENT_TYPE_IDS,
    FUNCTIONAL_NODE_ARCHETYPE_IDS,
    FUNCTIONAL_NODE_IMPLEMENTATION_STATES,
    getFunctionalNodeArchetype
} = require('../../../src/core/functional-node');

const read = relative => fs.readFileSync(path.resolve(__dirname, '../../..', relative), 'utf8');

const assertCharacterController2DContract = () => {
    assert.strictEqual(CHARACTER_CONTROLLER2D_CONTRACT.typeId, 'ngvge.character-controller2d');
    assert.strictEqual(CHARACTER_CONTROLLER2D_CONTRACT.persistence.nativeProject, '.ne');
    assert.strictEqual(CHARACTER_CONTROLLER2D_CONTRACT.persistence.scratchProjection, 'native-only');
    assert.strictEqual(CHARACTER_CONTROLLER2D_CONTRACT.identity.backendHandlePersistent, false);
    assert.strictEqual(CHARACTER_CONTROLLER2D_CONTRACT.movement.fullRigidBodyRequired, false);
    assert.strictEqual(CHARACTER_CONTROLLER2D_CONTRACT.movement.colliderSource, 'ngvge.collider2d');
    assert.strictEqual(CHARACTER_CONTROLLER2D_CONTRACT.movement.runtimeTransformWriter, 'Transform2DRuntimeStore');
    assert.strictEqual(
        CHARACTER_CONTROLLER2D_CONTRACT.movement.stableSurfaceSelection,
        'alignment + previous-contact stability'
    );
    assert.strictEqual(CHARACTER_CONTROLLER2D_CONTRACT.runtimeState.lastSafeTransformPersistent, false);
    assert.strictEqual(CHARACTER_CONTROLLER2D_CONTRACT.runtimeState.recoveryPersistent, false);
    assert.strictEqual(CHARACTER_CONTROLLER2D_CONTRACT.runtimeState.velocityPersistent, false);
    assert.deepStrictEqual(normalizeCharacterController2D().upDirection, [0, 1]);

    const staticBody = getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.STATIC_BODY_2D);
    const character = getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.CHARACTER_BODY_2D);
    const rigidBody = getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.RIGID_BODY_2D);
    assert.strictEqual(staticBody.implementation, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED);
    assert.strictEqual(character.implementation, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED);
    assert.deepStrictEqual(character.components.map(component => component.typeId), [
        FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D,
        FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D,
        FUNCTIONAL_COMPONENT_TYPE_IDS.CHARACTER_CONTROLLER_2D
    ]);
    assert.strictEqual(character.defaults[FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D].sensor, false);
    assert.strictEqual(rigidBody.implementation, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED);

    const runtimeSource = read('src/lib/character-controller-system/character-controller2d-runtime-service.js');
    const blocksSource = read('src/lib/character-controller-system/character-controller2d-scratch-blocks.js');
    assert.match(runtimeSource, /moveAndCollide/);
    assert.match(runtimeSource, /moveAndSlide/);
    assert.match(runtimeSource, /floorNormal/);
    assert.match(runtimeSource, /wallNormal/);
    assert.match(runtimeSource, /floorSnapLength/);
    assert.match(runtimeSource, /stepHeight/);
    assert.match(runtimeSource, /Transform2D Runtime Store/);
    assert.match(runtimeSource, /worldDeltaToNodeLocalDelta/);
    assert.match(runtimeSource, /floorCollider\.worldOrigin/);
    assert.match(runtimeSource, /CONTACT_SLOP/);
    assert.match(runtimeSource, /lastSafeTransform/);
    assert.match(runtimeSource, /restoreLastSafePlacement/);
    assert.match(runtimeSource, /contactStabilityBonus/);
    // Geometry/query backends may be replaceable, but backend handles must never become CharacterController authority.
    assert.doesNotMatch(runtimeSource, /rigidBodyHandle|physicsHandle/);
    assert.match(runtimeSource, /shapeQueryBackend/);
    assert.match(runtimeSource, /sweepConvexPolygons/);
    assert.doesNotMatch(blocksSource, /setComponentData|patchPersistentController|PatchCharacterController2D/);

    return {
        characterBodyNativeKinematicPreset: true,
        rigidBodyCoreSemanticsGraduated: true,
        runtimeVelocityNonPersistent: true,
        lastSafeRecoveryRuntimeOnly: true,
        stableContactSelection: true,
        staticCollisionSurfacePresent: true,
        transformAuthorityPreserved: true
    };
};

module.exports = {assertCharacterController2DContract};
