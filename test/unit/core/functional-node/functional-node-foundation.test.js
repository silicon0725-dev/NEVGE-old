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
    listFunctionalNodeArchetypes,
    validateFunctionalNodeArchetype
} = require('../../../../src/core/functional-node');
const {TRANSFORM2D_TYPE_ID} = require('../../../../src/core/transform2d');

describe('WS-10N0 functional node foundation', () => {
    test('freezes the native/compatibility format roles without making SB3 the core model', () => {
        expect(FUNCTIONAL_NODE_FOUNDATION_CONTRACT_ID).toBe('ngvge.functional-node-foundation');
        expect(FUNCTIONAL_NODE_FOUNDATION_VERSION).toBe(1);
        expect(NATIVE_PROJECT_FORMAT).toEqual({
            extension: '.ne',
            formatId: 'ngvge.ne-project',
            role: 'canonical-native-project'
        });
        expect(SCRATCH_COMPATIBILITY_FORMAT).toEqual({
            extension: '.sb3',
            profileId: 'scratch3',
            role: 'compatibility-projection'
        });
        expect(FUNCTIONAL_NODE_FOUNDATION.backendObjectMayOwnNodeIdentity).toBe(false);
    });

    test('keeps hierarchy parentage separate from serialization ownership', () => {
        expect(FUNCTIONAL_NODE_FOUNDATION.hierarchyOwnership).toEqual({
            parentField: 'parentId',
            parentIsSerializationOwner: false,
            serializationOwnerField: 'serializationOwnerId'
        });
    });

    test('records the native Transform writer-routing prerequisite without weakening the current authority registry', () => {
        expect(FUNCTIONAL_NODE_FOUNDATION.nativeTransformWriterRequirement).toEqual({
            currentGlobalAuthorityRegistryUnchanged: true,
            requiredBeforeNativeTransformMutation: true,
            routingScope: 'node'
        });
    });

    test('defines archetypes as base-node plus component presets, not persistent identities', () => {
        expect(FUNCTIONAL_NODE_FOUNDATION.archetypeIdentityIsPersistent).toBe(false);
        expect(FUNCTIONAL_NODE_FOUNDATION.archetypeStrategy).toBe('base-node-plus-components');
        expect(FUNCTIONAL_NODE_ARCHETYPES).toHaveLength(9);
        expect(listFunctionalNodeArchetypes()).not.toBe(FUNCTIONAL_NODE_ARCHETYPES);
        FUNCTIONAL_NODE_ARCHETYPES.forEach(item => {
            expect(validateFunctionalNodeArchetype(item)).toEqual({issues: [], valid: true});
            expect(Object.isFrozen(item)).toBe(true);
            expect(item.components.some(component => component.typeId === TRANSFORM2D_TYPE_ID)).toBe(true);
        });
    });

    test('reuses the certified Transform2D component instead of creating an XY-stretch side channel', () => {
        expect(FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D).toBe(TRANSFORM2D_TYPE_ID);
        const node2d = getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.NODE_2D);
        expect(node2d.components).toEqual([
            {
                implementation: FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED,
                required: true,
                typeId: TRANSFORM2D_TYPE_ID
            }
        ]);
    });

    test('marks Scratch-backed Sprite2D separately from native Camera2D', () => {
        const sprite = getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.SPRITE_2D);
        expect(sprite.baseRuntimeTypeId).toBe('ngvge.sprite-node');
        expect(sprite.implementation).toBe(FUNCTIONAL_NODE_IMPLEMENTATION_STATES.COMPATIBILITY_BACKED);
        expect(sprite.scratchProjectionRole).toBe(SCRATCH_PROJECTION_ROLES.TARGET);

        const camera = getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.CAMERA_2D);
        expect(camera.implementation).toBe(FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED);
        expect(camera.scratchProjectionRole).toBe(SCRATCH_PROJECTION_ROLES.NATIVE_ONLY);
    });

    test('keeps collision-first RPG archetypes distinct while allowing later Physics2D graduation', () => {
        const area = getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.AREA_2D);
        const staticBody = getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.STATIC_BODY_2D);
        const character = getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.CHARACTER_BODY_2D);
        const rigid = getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.RIGID_BODY_2D);
        expect(area.defaults[FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D]).toEqual({sensor: true});
        expect(area.implementation).toBe(FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED);
        expect(area.components.find(item => item.typeId === FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D).implementation)
            .toBe(FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED);
        expect(staticBody.implementation).toBe(FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED);
        expect(staticBody.defaults[FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D]).toEqual({sensor: false});
        expect(character.implementation).toBe(FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED);
        expect(character.defaults[FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D]).toEqual({sensor: false});
        expect(character.components.map(item => item.typeId)).toEqual(expect.arrayContaining([
            FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D,
            FUNCTIONAL_COMPONENT_TYPE_IDS.CHARACTER_CONTROLLER_2D
        ]));
        expect(rigid.components.map(item => item.typeId)).toEqual(expect.arrayContaining([
            FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D,
            FUNCTIONAL_COMPONENT_TYPE_IDS.RIGIDBODY_2D
        ]));
        expect(rigid.implementation).toBe(FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED);
    });

    test('treats TileMapLayer2D as a native authoring feature with an explicit Scratch bake seam', () => {
        const tilemap = getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.TILEMAP_LAYER_2D);
        expect(tilemap.baseRuntimeTypeId).toBe('ngvge.node2d');
        expect(tilemap.components.map(item => item.typeId)).toContain(FUNCTIONAL_COMPONENT_TYPE_IDS.TILEMAP_LAYER_2D);
        expect(tilemap.scratchProjectionRole).toBe(SCRATCH_PROJECTION_ROLES.BAKE);
    });

    test('fails closed for malformed archetype descriptors', () => {
        const invalid = validateFunctionalNodeArchetype({
            baseRuntimeTypeId: 'scratch.target',
            components: [],
            id: 'bad',
            implementation: 'magic',
            label: '',
            schema: 'bad',
            scratchProjectionRole: 'copy-vm'
        });
        expect(invalid.valid).toBe(false);
        expect(invalid.issues.length).toBeGreaterThan(4);
    });
});
