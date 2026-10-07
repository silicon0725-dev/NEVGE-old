#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    FUNCTIONAL_COMPONENT_TYPE_IDS,
    FUNCTIONAL_NODE_ARCHETYPE_IDS,
    FUNCTIONAL_NODE_ARCHETYPES,
    FUNCTIONAL_NODE_FOUNDATION,
    FUNCTIONAL_NODE_FOUNDATION_CONTRACT_ID,
    FUNCTIONAL_NODE_FOUNDATION_VERSION,
    FUNCTIONAL_NODE_IMPLEMENTATION_STATES,
    NATIVE_PROJECT_FORMAT,
    SCRATCH_COMPATIBILITY_FORMAT,
    SCRATCH_PROJECTION_ROLES,
    getFunctionalNodeArchetype,
    validateFunctionalNodeArchetype
} = require('../../src/core/functional-node');
const {TRANSFORM2D_TYPE_ID} = require('../../src/core/transform2d');

const ROOT = path.resolve(__dirname, '../..');
const sourceRoot = path.join(ROOT, 'src/core/functional-node');
const checks = [];
const check = (name, assertion) => {
    assertion();
    checks.push(name);
};

check('contract identity/version', () => {
    assert.strictEqual(FUNCTIONAL_NODE_FOUNDATION_CONTRACT_ID, 'ngvge.functional-node-foundation');
    assert.strictEqual(FUNCTIONAL_NODE_FOUNDATION_VERSION, 1);
});

check('.ne canonical / .sb3 projection', () => {
    assert.strictEqual(NATIVE_PROJECT_FORMAT.extension, '.ne');
    assert.strictEqual(NATIVE_PROJECT_FORMAT.role, 'canonical-native-project');
    assert.strictEqual(SCRATCH_COMPATIBILITY_FORMAT.extension, '.sb3');
    assert.strictEqual(SCRATCH_COMPATIBILITY_FORMAT.role, 'compatibility-projection');
});

check('parent != serialization owner', () => {
    assert.strictEqual(FUNCTIONAL_NODE_FOUNDATION.hierarchyOwnership.parentIsSerializationOwner, false);
    assert.notStrictEqual(
        FUNCTIONAL_NODE_FOUNDATION.hierarchyOwnership.parentField,
        FUNCTIONAL_NODE_FOUNDATION.hierarchyOwnership.serializationOwnerField
    );
});

check('native Transform writer routing is an explicit prerequisite', () => {
    assert.strictEqual(FUNCTIONAL_NODE_FOUNDATION.nativeTransformWriterRequirement.currentGlobalAuthorityRegistryUnchanged, true);
    assert.strictEqual(FUNCTIONAL_NODE_FOUNDATION.nativeTransformWriterRequirement.requiredBeforeNativeTransformMutation, true);
    assert.strictEqual(FUNCTIONAL_NODE_FOUNDATION.nativeTransformWriterRequirement.routingScope, 'node');
});

check('archetype is preset, not identity', () => {
    assert.strictEqual(FUNCTIONAL_NODE_FOUNDATION.archetypeIdentityIsPersistent, false);
    assert.strictEqual(FUNCTIONAL_NODE_FOUNDATION.archetypeStrategy, 'base-node-plus-components');
});

check('catalog shape', () => {
    assert.strictEqual(FUNCTIONAL_NODE_ARCHETYPES.length, 9);
    FUNCTIONAL_NODE_ARCHETYPES.forEach(item => assert.strictEqual(validateFunctionalNodeArchetype(item).valid, true));
});

check('certified Transform2D reused', () => {
    assert.strictEqual(FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D, TRANSFORM2D_TYPE_ID);
    FUNCTIONAL_NODE_ARCHETYPES.forEach(item => {
        assert(item.components.some(component => component.typeId === TRANSFORM2D_TYPE_ID));
    });
});

check('Sprite2D remains Scratch compatibility-backed', () => {
    const sprite = getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.SPRITE_2D);
    assert.strictEqual(sprite.baseRuntimeTypeId, 'ngvge.sprite-node');
    assert.strictEqual(sprite.implementation, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.COMPATIBILITY_BACKED);
    assert.strictEqual(sprite.scratchProjectionRole, SCRATCH_PROJECTION_ROLES.TARGET);
});

check('Camera2D keeps its native-only contract while later stages may graduate implementation state', () => {
    const camera = getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.CAMERA_2D);
    assert([
        FUNCTIONAL_NODE_IMPLEMENTATION_STATES.PLANNED,
        FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED
    ].includes(camera.implementation));
    assert(camera.components.some(item => item.typeId === FUNCTIONAL_COMPONENT_TYPE_IDS.CAMERA_2D));
    assert.strictEqual(camera.scratchProjectionRole, SCRATCH_PROJECTION_ROLES.NATIVE_ONLY);
});

check('Collider/Area separated from Rigidbody', () => {
    const area = getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.AREA_2D);
    const staticBody = getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.STATIC_BODY_2D);
    const rigidBody = getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.RIGID_BODY_2D);
    assert(area.components.some(item => item.typeId === FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D));
    assert(staticBody.components.some(item => item.typeId === FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D));
    assert(!staticBody.components.some(item => item.typeId === FUNCTIONAL_COMPONENT_TYPE_IDS.RIGIDBODY_2D));
    assert(rigidBody.components.some(item => item.typeId === FUNCTIONAL_COMPONENT_TYPE_IDS.RIGIDBODY_2D));
});

check('CharacterBody2D has dedicated controller seam', () => {
    const character = getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.CHARACTER_BODY_2D);
    assert(character.components.some(item => item.typeId === FUNCTIONAL_COMPONENT_TYPE_IDS.CHARACTER_CONTROLLER_2D));
});

check('TileMapLayer2D is native + Scratch bake seam', () => {
    const tilemap = getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.TILEMAP_LAYER_2D);
    assert(tilemap.components.some(item => item.typeId === FUNCTIONAL_COMPONENT_TYPE_IDS.TILEMAP_LAYER_2D));
    assert.strictEqual(tilemap.scratchProjectionRole, SCRATCH_PROJECTION_ROLES.BAKE);
});

check('Core contract contains no backend identity leakage', () => {
    const files = fs.readdirSync(sourceRoot).filter(name => name.endsWith('.js'));
    const forbidden = /Scratch\.vm|scratch-vm|scratch-render|targetRuntimeId|drawableId|skinId|_allDrawables|_allSkins|WebGLRenderingContext|GPUDevice|Rapier|Box2D/;
    files.forEach(name => {
        assert.doesNotMatch(
            fs.readFileSync(path.join(sourceRoot, name), 'utf8'),
            forbidden,
            `functional-node Core contract leaks backend identity or implementation: ${name}`
        );
    });
});

process.stdout.write(`WS-10N0 Functional Node Foundation Conformance PASS ${checks.length}/${checks.length}.\n`);
