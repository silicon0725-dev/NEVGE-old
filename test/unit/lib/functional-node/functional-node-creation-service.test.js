const {FUNCTIONAL_NODE_ARCHETYPE_IDS} = require('../../../../src/core/functional-node');
const {TRANSFORM2D_TYPE_ID} = require('../../../../src/core/transform2d');
const {
    FUNCTIONAL_NODE_CREATION_CAPABILITY_ID,
    createFunctionalNodeCreationService
} = require('../../../../src/lib/functional-node');

const makeRuntimeNodeModel = ({includeSprite = true} = {}) => {
    const types = new Map([
        ['ngvge.node2d', {
            abstract: false,
            allowedScopes: ['scene'],
            id: 'ngvge.node2d'
        }]
    ]);
    if (includeSprite) {
        types.set('ngvge.sprite-node', {
            abstract: false,
            allowedScopes: ['scene'],
            id: 'ngvge.sprite-node'
        });
    }
    return {
        getNodeType: jest.fn(typeId => types.get(typeId) || null)
    };
};

const makeScratchAdapter = () => ({
    getBindingByNodeId: jest.fn(),
    reconcileActiveScene: jest.fn()
});

describe('WS-10N2 Functional Node Creation service', () => {
    test('publishes a stable scene-scoped capability and keeps raw runtime identity separate', () => {
        const service = createFunctionalNodeCreationService({
            camera2DAvailable: true,
            characterController2DAvailable: true,
            collider2DAvailable: true,
            runtimeNodeModel: makeRuntimeNodeModel(),
            scratchSpriteAdapter: makeScratchAdapter()
        });
        expect(service.capabilityId).toBe(FUNCTIONAL_NODE_CREATION_CAPABILITY_ID);
        expect(service.listArchetypes({scope: 'global'})).toEqual([]);
        expect(service.listArchetypes({scope: 'scene'}).map(item => item.id)).toEqual([
            FUNCTIONAL_NODE_ARCHETYPE_IDS.NODE_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.SPRITE_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.CAMERA_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.AREA_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.STATIC_BODY_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.CHARACTER_BODY_2D
        ]);
    });


    test('hides Camera2D when the viewport provider is unavailable', () => {
        const service = createFunctionalNodeCreationService({
            collider2DAvailable: true,
            runtimeNodeModel: makeRuntimeNodeModel(),
            scratchSpriteAdapter: makeScratchAdapter()
        });
        expect(service.listArchetypes({scope: 'scene'}).map(item => item.id)).toEqual([
            FUNCTIONAL_NODE_ARCHETYPE_IDS.NODE_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.SPRITE_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.AREA_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.STATIC_BODY_2D
        ]);
        expect(service.getStatus().camera2DAvailable).toBe(false);
        expect(() => service.createPlan(FUNCTIONAL_NODE_ARCHETYPE_IDS.CAMERA_2D, {scope: 'scene'}))
            .toThrow(expect.objectContaining({code: 'NGVGE_FUNCTIONAL_NODE_PROVIDER_UNAVAILABLE'}));
    });


    test('hides Area2D when the Collider2D runtime provider is unavailable', () => {
        const service = createFunctionalNodeCreationService({
            camera2DAvailable: true,
            runtimeNodeModel: makeRuntimeNodeModel(),
            scratchSpriteAdapter: makeScratchAdapter()
        });
        expect(service.getStatus().collider2DAvailable).toBe(false);
        expect(service.getArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.AREA_2D)).toBeNull();
        expect(() => service.createPlan(FUNCTIONAL_NODE_ARCHETYPE_IDS.AREA_2D, {scope: 'scene'}))
            .toThrow(expect.objectContaining({code: 'NGVGE_FUNCTIONAL_NODE_PROVIDER_UNAVAILABLE'}));
    });
    test('admits StaticBody2D with Collider2D and CharacterBody2D only with the controller provider', () => {
        const collisionOnly = createFunctionalNodeCreationService({
            camera2DAvailable: true,
            collider2DAvailable: true,
            runtimeNodeModel: makeRuntimeNodeModel(),
            scratchSpriteAdapter: makeScratchAdapter()
        });
        expect(collisionOnly.getArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.STATIC_BODY_2D)).not.toBeNull();
        expect(collisionOnly.getArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.CHARACTER_BODY_2D)).toBeNull();

        const withCharacter = createFunctionalNodeCreationService({
            camera2DAvailable: true,
            characterController2DAvailable: true,
            collider2DAvailable: true,
            runtimeNodeModel: makeRuntimeNodeModel(),
            scratchSpriteAdapter: makeScratchAdapter()
        });
        expect(withCharacter.getArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.CHARACTER_BODY_2D)).not.toBeNull();
        expect(withCharacter.getStatus().characterController2DAvailable).toBe(true);
        const plan = withCharacter.createPlan(FUNCTIONAL_NODE_ARCHETYPE_IDS.CHARACTER_BODY_2D, {scope: 'scene'});
        expect(plan.options.name).toBe('CharacterBody2D');
        expect(plan.options.components.map(component => component.typeId)).toContain('ngvge.character-controller2d');
    });


    test('admits RigidBody2D only after the real Physics2D backend reports ready', () => {
        const backendState = {ready: false};
        const physics2DRuntime = {getStatus: jest.fn(() => ({backendReady: backendState.ready}))};
        const service = createFunctionalNodeCreationService({
            camera2DAvailable: true,
            characterController2DAvailable: true,
            collider2DAvailable: true,
            physics2DRuntime,
            runtimeNodeModel: makeRuntimeNodeModel(),
            scratchSpriteAdapter: makeScratchAdapter()
        });
        expect(service.getArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.RIGID_BODY_2D)).toBeNull();
        expect(service.getStatus().physics2DBackendReady).toBe(false);
        backendState.ready = true;
        expect(service.getStatus().physics2DBackendReady).toBe(true);
        expect(service.getArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.RIGID_BODY_2D)).not.toBeNull();
        const plan = service.createPlan(FUNCTIONAL_NODE_ARCHETYPE_IDS.RIGID_BODY_2D, {scope: 'scene'});
        expect(plan.options.name).toBe('RigidBody2D');
        expect(plan.options.components.map(component => component.typeId)).toEqual([
            'ngvge.transform2d', 'ngvge.collider2d', 'ngvge.rigidbody2d'
        ]);
    });

    test('hides Sprite2D without a valid Scratch compatibility lifecycle adapter', () => {
        const service = createFunctionalNodeCreationService({
            camera2DAvailable: true,
            collider2DAvailable: true,
            runtimeNodeModel: makeRuntimeNodeModel(),
            scratchSpriteAdapter: null
        });
        expect(service.getStatus()).toEqual({
            camera2DAvailable: true,
            collider2DAvailable: true,
            characterController2DAvailable: false,
            creatableArchetypeIds: [
                FUNCTIONAL_NODE_ARCHETYPE_IDS.NODE_2D,
                FUNCTIONAL_NODE_ARCHETYPE_IDS.CAMERA_2D,
                FUNCTIONAL_NODE_ARCHETYPE_IDS.AREA_2D,
                FUNCTIONAL_NODE_ARCHETYPE_IDS.STATIC_BODY_2D
            ],
            physics2DBackendReady: false,
            scratchCompatibilityAvailable: false,
            tileMapLayer2DAvailable: false
        });
        expect(service.getArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.SPRITE_2D)).toBeNull();
    });

    test('filters an archetype when its mapped runtime type is not registered', () => {
        const service = createFunctionalNodeCreationService({
            camera2DAvailable: true,
            collider2DAvailable: true,
            runtimeNodeModel: makeRuntimeNodeModel({includeSprite: false}),
            scratchSpriteAdapter: makeScratchAdapter()
        });
        expect(service.listArchetypes({scope: 'scene'}).map(item => item.id)).toEqual([
            FUNCTIONAL_NODE_ARCHETYPE_IDS.NODE_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.CAMERA_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.AREA_2D,
            FUNCTIONAL_NODE_ARCHETYPE_IDS.STATIC_BODY_2D
        ]);
    });

    test('plans native Node2D creation with caller metadata and real components only', () => {
        const service = createFunctionalNodeCreationService({
            camera2DAvailable: true,
            collider2DAvailable: true,
            runtimeNodeModel: makeRuntimeNodeModel(),
            scratchSpriteAdapter: makeScratchAdapter()
        });
        const plan = service.createPlan(FUNCTIONAL_NODE_ARCHETYPE_IDS.NODE_2D, {
            name: 'World Root',
            sceneId: 'scene-a',
            scope: 'scene'
        });
        expect(plan.runtimeTypeId).toBe('ngvge.node2d');
        expect(plan.options).toEqual({
            components: [{
                data: {position: [0, 0], rotation: 0, scale: [1, 1]},
                enabled: true,
                schemaVersion: 1,
                typeId: TRANSFORM2D_TYPE_ID
            }],
            name: 'World Root',
            sceneId: 'scene-a',
            scope: 'scene'
        });
        expect(plan.options.archetypeId).toBeUndefined();
    });

    test('plans Sprite2D against semantic sprite type without leaking Scratch target identity', () => {
        const service = createFunctionalNodeCreationService({
            camera2DAvailable: true,
            collider2DAvailable: true,
            runtimeNodeModel: makeRuntimeNodeModel(),
            scratchSpriteAdapter: makeScratchAdapter()
        });
        const plan = service.createPlan(FUNCTIONAL_NODE_ARCHETYPE_IDS.SPRITE_2D, {
            name: 'Player',
            sceneId: 'scene-a',
            scope: 'scene'
        });
        expect(plan.runtimeTypeId).toBe('ngvge.sprite-node');
        expect(plan.options.targetRuntimeId).toBeUndefined();
        expect(plan.options.bindingId).toBeUndefined();
        expect(plan.options.components).toHaveLength(1);
    });


    test('uses the archetype label as the default authored node name when the caller leaves it blank', () => {
        const service = createFunctionalNodeCreationService({
            camera2DAvailable: true,
            collider2DAvailable: true,
            runtimeNodeModel: makeRuntimeNodeModel(),
            scratchSpriteAdapter: makeScratchAdapter()
        });
        const areaPlan = service.createPlan(FUNCTIONAL_NODE_ARCHETYPE_IDS.AREA_2D, {
            sceneId: 'scene-a',
            scope: 'scene'
        });
        const cameraPlan = service.createPlan(FUNCTIONAL_NODE_ARCHETYPE_IDS.CAMERA_2D, {
            sceneId: 'scene-a',
            scope: 'scene'
        });
        expect(areaPlan.options.name).toBe('Area2D');
        expect(cameraPlan.options.name).toBe('Camera2D');
    });

    test('rejects non-scene authoring scope instead of silently degrading', () => {
        const service = createFunctionalNodeCreationService({
            camera2DAvailable: true,
            collider2DAvailable: true,
            runtimeNodeModel: makeRuntimeNodeModel(),
            scratchSpriteAdapter: makeScratchAdapter()
        });
        expect(() => service.createPlan(FUNCTIONAL_NODE_ARCHETYPE_IDS.NODE_2D, {
            scope: 'global'
        })).toThrow(expect.objectContaining({code: 'NGVGE_FUNCTIONAL_NODE_SCOPE_UNSUPPORTED'}));
    });
});
