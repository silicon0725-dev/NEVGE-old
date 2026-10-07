const {
    CREATION_KINDS,
    FUNCTIONAL_COMPONENT_TYPE_IDS,
    FUNCTIONAL_NODE_ARCHETYPE_IDS,
    FUNCTIONAL_NODE_CREATION_CONTRACT,
    FUNCTIONAL_NODE_CREATION_PLAN_SCHEMA,
    createFunctionalNodeCreationPlan,
    isFunctionalNodeArchetypeCreatable,
    listCreatableFunctionalNodeArchetypes
} = require('../../../../src/core/functional-node');
const {CAMERA2D_TYPE_ID} = require('../../../../src/core/camera2d');
const {COLLIDER2D_TYPE_ID} = require('../../../../src/core/collider2d');
const {CHARACTER_CONTROLLER2D_TYPE_ID} = require('../../../../src/core/character-controller2d');
const {TRANSFORM2D_TYPE_ID} = require('../../../../src/core/transform2d');

describe('WS-10N2 functional node creation contract', () => {
    test('surfaces native Node2D and Camera2D when Scratch compatibility is unavailable', () => {
        const archetypes = listCreatableFunctionalNodeArchetypes({scratchCompatibilityAvailable: false});
        expect(archetypes.map(item => item.id)).toEqual([
            FUNCTIONAL_NODE_ARCHETYPE_IDS.NODE_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.CAMERA_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.AREA_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.STATIC_BODY_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.TILEMAP_LAYER_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.CHARACTER_BODY_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.RIGID_BODY_2D
        ]);
        expect(isFunctionalNodeArchetypeCreatable(
            FUNCTIONAL_NODE_ARCHETYPE_IDS.SPRITE_2D,
            {scratchCompatibilityAvailable: false}
        )).toBe(false);
    });

    test('surfaces Sprite2D only when the Scratch compatibility lifecycle is available', () => {
        const archetypes = listCreatableFunctionalNodeArchetypes({scratchCompatibilityAvailable: true});
        expect(archetypes.map(item => item.id)).toEqual([
            FUNCTIONAL_NODE_ARCHETYPE_IDS.NODE_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.SPRITE_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.CAMERA_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.AREA_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.STATIC_BODY_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.TILEMAP_LAYER_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.CHARACTER_BODY_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.RIGID_BODY_2D
        ]);
        expect(archetypes[1]).toEqual(expect.objectContaining({
            baseRuntimeTypeId: 'ngvge.sprite-node',
            creationKind: CREATION_KINDS.SCRATCH_COMPATIBILITY,
            requiresScratchCompatibility: true
        }));
    });

    test('keeps native body archetypes creatable at the core contract while audio remains planned', () => {
        const creatableIds = listCreatableFunctionalNodeArchetypes({scratchCompatibilityAvailable: true})
            .map(item => item.id);
        [
            FUNCTIONAL_NODE_ARCHETYPE_IDS.AREA_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.STATIC_BODY_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.TILEMAP_LAYER_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.CHARACTER_BODY_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.TILEMAP_LAYER_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.RIGID_BODY_2D
        ].forEach(archetypeId => expect(creatableIds).toContain(archetypeId));
        expect(creatableIds).not.toContain(FUNCTIONAL_NODE_ARCHETYPE_IDS.AUDIO_SOURCE_2D);
    });

    test('creates Node2D as a runtime type plus a real default Transform2D component', () => {
        const plan = createFunctionalNodeCreationPlan(
            FUNCTIONAL_NODE_ARCHETYPE_IDS.NODE_2D,
            {scratchCompatibilityAvailable: false}
        );
        expect(plan.schema).toBe(FUNCTIONAL_NODE_CREATION_PLAN_SCHEMA);
        expect(plan.runtimeTypeId).toBe('ngvge.node2d');
        expect(plan.creationKind).toBe(CREATION_KINDS.NATIVE);
        expect(plan.options.components).toEqual([{
            data: {position: [0, 0], rotation: 0, scale: [1, 1]},
            enabled: true,
            schemaVersion: 1,
            typeId: TRANSFORM2D_TYPE_ID
        }]);
        expect(plan.options.components[0].typeId).toBe(FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D);
    });

    test('creates Sprite2D through the semantic Sprite runtime type and provisions Transform2D', () => {
        const plan = createFunctionalNodeCreationPlan(
            FUNCTIONAL_NODE_ARCHETYPE_IDS.SPRITE_2D,
            {scratchCompatibilityAvailable: true}
        );
        expect(plan.runtimeTypeId).toBe('ngvge.sprite-node');
        expect(plan.creationKind).toBe(CREATION_KINDS.SCRATCH_COMPATIBILITY);
        expect(plan.options.components.map(component => component.typeId)).toEqual([TRANSFORM2D_TYPE_ID]);
        expect(plan.compatibilityProvidedComponentTypeIds).toEqual([
            FUNCTIONAL_COMPONENT_TYPE_IDS.VISUAL_2D,
            FUNCTIONAL_COMPONENT_TYPE_IDS.SCRIPT_HOST
        ]);
    });

    test('creates Camera2D as native Node2D plus Transform2D and Camera2D components', () => {
        const plan = createFunctionalNodeCreationPlan(
            FUNCTIONAL_NODE_ARCHETYPE_IDS.CAMERA_2D,
            {scratchCompatibilityAvailable: false}
        );
        expect(plan.runtimeTypeId).toBe('ngvge.node2d');
        expect(plan.creationKind).toBe(CREATION_KINDS.NATIVE);
        expect(plan.options.components.map(component => component.typeId)).toEqual([
            TRANSFORM2D_TYPE_ID,
            CAMERA2D_TYPE_ID
        ]);
        expect(plan.options.components[1]).toEqual({
            data: {enabled: true, offset: [0, 0], priority: 0, zoom: [1, 1]},
            enabled: true,
            schemaVersion: 1,
            typeId: CAMERA2D_TYPE_ID
        });
    });

    test('creates Area2D as native Node2D plus Transform2D and sensor Collider2D', () => {
        const plan = createFunctionalNodeCreationPlan(
            FUNCTIONAL_NODE_ARCHETYPE_IDS.AREA_2D,
            {scratchCompatibilityAvailable: false}
        );
        expect(plan.runtimeTypeId).toBe('ngvge.node2d');
        expect(plan.creationKind).toBe(CREATION_KINDS.NATIVE);
        expect(plan.options.components.map(component => component.typeId)).toEqual([
            TRANSFORM2D_TYPE_ID,
            COLLIDER2D_TYPE_ID
        ]);
        expect(plan.options.components[1].data).toEqual(expect.objectContaining({
            collisionLayer: 1,
            collisionMask: 1,
            sensor: true,
            shape: {type: 'rectangle', size: [100, 100]}
        }));
    });

    test('keeps archetype identity and Scratch backend identity outside created-node options', () => {
        const plan = createFunctionalNodeCreationPlan(
            FUNCTIONAL_NODE_ARCHETYPE_IDS.SPRITE_2D,
            {scratchCompatibilityAvailable: true}
        );
        expect(FUNCTIONAL_NODE_CREATION_CONTRACT.archetypeIdentityPersistsOnCreatedNode).toBe(false);
        expect(FUNCTIONAL_NODE_CREATION_CONTRACT.scratchTargetIdentityMayCrossCreationPlan).toBe(false);
        expect(plan.options.archetypeId).toBeUndefined();
        expect(plan.options.targetRuntimeId).toBeUndefined();
        expect(plan.options.targetId).toBeUndefined();
        expect(plan.options.bindingId).toBeUndefined();
    });

    test('creates StaticBody2D and CharacterBody2D without a Rigidbody backend', () => {
        const staticPlan = createFunctionalNodeCreationPlan(
            FUNCTIONAL_NODE_ARCHETYPE_IDS.STATIC_BODY_2D,
            {scratchCompatibilityAvailable: false}
        );
        expect(staticPlan.options.components.map(component => component.typeId)).toEqual([
            TRANSFORM2D_TYPE_ID,
            COLLIDER2D_TYPE_ID
        ]);
        expect(staticPlan.options.components[1].data.sensor).toBe(false);

        const characterPlan = createFunctionalNodeCreationPlan(
            FUNCTIONAL_NODE_ARCHETYPE_IDS.CHARACTER_BODY_2D,
            {scratchCompatibilityAvailable: false}
        );
        expect(characterPlan.options.components.map(component => component.typeId)).toEqual([
            TRANSFORM2D_TYPE_ID,
            COLLIDER2D_TYPE_ID,
            CHARACTER_CONTROLLER2D_TYPE_ID
        ]);
        expect(characterPlan.options.components[1].data.sensor).toBe(false);
        expect(characterPlan.options.components[2].data).toEqual(expect.objectContaining({
            floorSnapLength: 6,
            maxSlides: 4,
            maxSlopeDegrees: 45,
            stepHeight: 0,
            upDirection: [0, 1]
        }));
    });

    test('creates RigidBody2D as native Transform2D + Collider2D + RigidBody2D semantics', () => {
        const plan = createFunctionalNodeCreationPlan(
            FUNCTIONAL_NODE_ARCHETYPE_IDS.RIGID_BODY_2D,
            {scratchCompatibilityAvailable: false}
        );
        expect(plan.creationKind).toBe(CREATION_KINDS.NATIVE);
        expect(plan.options.components.map(component => component.typeId)).toEqual([
            TRANSFORM2D_TYPE_ID,
            COLLIDER2D_TYPE_ID,
            'ngvge.rigidbody2d'
        ]);
        expect(plan.options.components[1].data.sensor).toBe(false);
        expect(plan.options.components[2].data).toEqual(expect.objectContaining({
            gravityScale: 1, mass: 1, velocity: [0, 0]
        }));
    });
});
