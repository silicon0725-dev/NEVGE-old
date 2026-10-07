'use strict';

const {TRANSFORM2D_SCHEMA_VERSION, TRANSFORM2D_TYPE_ID, normalizeTransform2D} = require('../transform2d');
const {CAMERA2D_SCHEMA_VERSION, CAMERA2D_TYPE_ID, normalizeCamera2D} = require('../camera2d');
const {COLLIDER2D_SCHEMA_VERSION, COLLIDER2D_TYPE_ID, normalizeCollider2D} = require('../collider2d');
const {RIGIDBODY2D_SCHEMA_VERSION, RIGIDBODY2D_TYPE_ID, normalizeRigidBody2D} = require('../rigidbody2d');
const {TILEMAP_LAYER2D_SCHEMA_VERSION, TILEMAP_LAYER2D_TYPE_ID, normalizeTileMapLayer2D} = require('../tilemap-layer2d');
const {
    CHARACTER_CONTROLLER2D_SCHEMA_VERSION,
    CHARACTER_CONTROLLER2D_TYPE_ID,
    normalizeCharacterController2D
} = require('../character-controller2d');
const {
    FUNCTIONAL_COMPONENT_TYPE_IDS,
    FUNCTIONAL_NODE_ARCHETYPE_IDS,
    FUNCTIONAL_NODE_IMPLEMENTATION_STATES,
    getFunctionalNodeArchetype
} = require('./functional-node-foundation');

const FUNCTIONAL_NODE_CREATION_CONTRACT_ID = 'ngvge.functional-node-creation';
const FUNCTIONAL_NODE_CREATION_CONTRACT_VERSION = 1;
const FUNCTIONAL_NODE_CREATION_PLAN_SCHEMA = 'ngvge.functional-node-creation-plan/v1';
const FUNCTIONAL_NODE_CREATION_ERROR = 'NGVGE_FUNCTIONAL_NODE_CREATION_UNAVAILABLE';

const CREATION_KINDS = Object.freeze({
    NATIVE: 'native',
    SCRATCH_COMPATIBILITY: 'scratch-compatibility'
});

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return Object.freeze(value);
};

const cloneSerializable = value => JSON.parse(JSON.stringify(value));

const createCamera2DComponent = () => ({
    data: cloneSerializable(normalizeCamera2D()),
    enabled: true,
    schemaVersion: CAMERA2D_SCHEMA_VERSION,
    typeId: CAMERA2D_TYPE_ID
});

const createCollider2DComponent = data => ({
    data: cloneSerializable(normalizeCollider2D(data)),
    enabled: true,
    schemaVersion: COLLIDER2D_SCHEMA_VERSION,
    typeId: COLLIDER2D_TYPE_ID
});

const createRigidBody2DComponent = data => ({
    data: cloneSerializable(normalizeRigidBody2D(data)),
    enabled: true,
    schemaVersion: RIGIDBODY2D_SCHEMA_VERSION,
    typeId: RIGIDBODY2D_TYPE_ID
});

const createCharacterController2DComponent = data => ({
    data: cloneSerializable(normalizeCharacterController2D(data)),
    enabled: true,
    schemaVersion: CHARACTER_CONTROLLER2D_SCHEMA_VERSION,
    typeId: CHARACTER_CONTROLLER2D_TYPE_ID
});

const createTileMapLayer2DComponent = data => ({
    data: cloneSerializable(normalizeTileMapLayer2D(data)),
    enabled: true,
    schemaVersion: TILEMAP_LAYER2D_SCHEMA_VERSION,
    typeId: TILEMAP_LAYER2D_TYPE_ID
});

const createTransform2DComponent = () => ({
    data: cloneSerializable(normalizeTransform2D()),
    enabled: true,
    schemaVersion: TRANSFORM2D_SCHEMA_VERSION,
    typeId: TRANSFORM2D_TYPE_ID
});

const CREATION_PROFILES = deepFreeze({
    [FUNCTIONAL_NODE_ARCHETYPE_IDS.NODE_2D]: {
        compatibilityProvidedComponentTypeIds: [],
        creationKind: CREATION_KINDS.NATIVE,
        description: 'Native 2D node with an authoritative Transform2D component.',
        provisionedComponentTypeIds: [FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D],
        requiresScratchCompatibility: false
    },
    [FUNCTIONAL_NODE_ARCHETYPE_IDS.SPRITE_2D]: {
        compatibilityProvidedComponentTypeIds: [
            FUNCTIONAL_COMPONENT_TYPE_IDS.VISUAL_2D,
            FUNCTIONAL_COMPONENT_TYPE_IDS.SCRIPT_HOST
        ],
        creationKind: CREATION_KINDS.SCRATCH_COMPATIBILITY,
        description: 'Scratch-compatible Sprite2D backed by a real Scratch Target and stable NGVGE NodeId.',
        provisionedComponentTypeIds: [FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D],
        requiresScratchCompatibility: true
    },
    [FUNCTIONAL_NODE_ARCHETYPE_IDS.CAMERA_2D]: {
        compatibilityProvidedComponentTypeIds: [],
        creationKind: CREATION_KINDS.NATIVE,
        description: 'Native Camera2D with Transform2D-driven position/rotation and viewport zoom/priority.',
        provisionedComponentTypeIds: [
            FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D,
            FUNCTIONAL_COMPONENT_TYPE_IDS.CAMERA_2D
        ],
        requiresScratchCompatibility: false
    },
    [FUNCTIONAL_NODE_ARCHETYPE_IDS.AREA_2D]: {
        compatibilityProvidedComponentTypeIds: [],
        creationKind: CREATION_KINDS.NATIVE,
        description: 'Native Area2D with Transform2D and a sensor Collider2D for overlap/query semantics.',
        provisionedComponentTypeIds: [
            FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D,
            FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D
        ],
        requiresScratchCompatibility: false
    },
    [FUNCTIONAL_NODE_ARCHETYPE_IDS.STATIC_BODY_2D]: {
        compatibilityProvidedComponentTypeIds: [],
        creationKind: CREATION_KINDS.NATIVE,
        description: 'Native StaticBody2D collision surface with Transform2D and a solid Collider2D; no Rigidbody backend.',
        provisionedComponentTypeIds: [
            FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D,
            FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D
        ],
        requiresScratchCompatibility: false
    },
    [FUNCTIONAL_NODE_ARCHETYPE_IDS.TILEMAP_LAYER_2D]: {
        compatibilityProvidedComponentTypeIds: [],
        creationKind: CREATION_KINDS.NATIVE,
        description: 'Native TileMapLayer2D with Transform2D, global TileSet Resource binding and sparse chunk authoring storage.',
        provisionedComponentTypeIds: [
            FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D,
            FUNCTIONAL_COMPONENT_TYPE_IDS.TILEMAP_LAYER_2D
        ],
        requiresScratchCompatibility: false
    },
    [FUNCTIONAL_NODE_ARCHETYPE_IDS.CHARACTER_BODY_2D]: {
        compatibilityProvidedComponentTypeIds: [],
        creationKind: CREATION_KINDS.NATIVE,
        description: 'Native kinematic CharacterBody2D with Transform2D, solid Collider2D and CharacterController2D.',
        provisionedComponentTypeIds: [
            FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D,
            FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D,
            FUNCTIONAL_COMPONENT_TYPE_IDS.CHARACTER_CONTROLLER_2D
        ],
        requiresScratchCompatibility: false
    },
    [FUNCTIONAL_NODE_ARCHETYPE_IDS.RIGID_BODY_2D]: {
        compatibilityProvidedComponentTypeIds: [],
        creationKind: CREATION_KINDS.NATIVE,
        description: 'Native dynamic RigidBody2D with Transform2D, solid Collider2D and replaceable Physics2D backend state.',
        provisionedComponentTypeIds: [
            FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D,
            FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D,
            FUNCTIONAL_COMPONENT_TYPE_IDS.RIGIDBODY_2D
        ],
        requiresScratchCompatibility: false
    }
});

const getCreationProfile = archetypeId => CREATION_PROFILES[archetypeId] || null;

const isFunctionalNodeArchetypeCreatable = (archetypeId, options = {}) => {
    const archetype = getFunctionalNodeArchetype(archetypeId);
    const profile = getCreationProfile(archetypeId);
    if (!archetype || !profile) return false;
    if (archetype.implementation === FUNCTIONAL_NODE_IMPLEMENTATION_STATES.PLANNED) return false;
    if (profile.requiresScratchCompatibility && options.scratchCompatibilityAvailable !== true) return false;
    return true;
};

const listCreatableFunctionalNodeArchetypes = (options = {}) => (
    Object.keys(CREATION_PROFILES)
        .filter(archetypeId => isFunctionalNodeArchetypeCreatable(archetypeId, options))
        .map(archetypeId => {
            const archetype = getFunctionalNodeArchetype(archetypeId);
            const profile = getCreationProfile(archetypeId);
            return deepFreeze({
                archetypeId: archetype.id,
                baseRuntimeTypeId: archetype.baseRuntimeTypeId,
                category: '2D',
                creationKind: profile.creationKind,
                description: profile.description,
                family: archetype.family,
                id: archetype.id,
                implementation: archetype.implementation,
                label: archetype.label,
                requiresScratchCompatibility: profile.requiresScratchCompatibility,
                scratchProjectionRole: archetype.scratchProjectionRole
            });
        })
);

const createProvisionedComponents = (profile, archetype) => profile.provisionedComponentTypeIds.map(typeId => {
    if (typeId === TRANSFORM2D_TYPE_ID) return createTransform2DComponent();
    if (typeId === CAMERA2D_TYPE_ID) return createCamera2DComponent();
    if (typeId === COLLIDER2D_TYPE_ID) {
        const defaults = archetype && archetype.defaults ? archetype.defaults[COLLIDER2D_TYPE_ID] : null;
        return createCollider2DComponent(defaults);
    }
    if (typeId === RIGIDBODY2D_TYPE_ID) {
        const defaults = archetype && archetype.defaults ? archetype.defaults[RIGIDBODY2D_TYPE_ID] : null;
        return createRigidBody2DComponent(defaults);
    }
    if (typeId === TILEMAP_LAYER2D_TYPE_ID) {
        const defaults = archetype && archetype.defaults ? archetype.defaults[TILEMAP_LAYER2D_TYPE_ID] : null;
        return createTileMapLayer2DComponent(defaults);
    }
    if (typeId === CHARACTER_CONTROLLER2D_TYPE_ID) {
        const defaults = archetype && archetype.defaults ? archetype.defaults[CHARACTER_CONTROLLER2D_TYPE_ID] : null;
        return createCharacterController2DComponent(defaults);
    }
    const error = new Error(`Functional Node creation has no provisioner for component type: ${typeId}`);
    error.code = FUNCTIONAL_NODE_CREATION_ERROR;
    error.componentTypeId = typeId;
    throw error;
});

const createFunctionalNodeCreationPlan = (archetypeId, options = {}) => {
    if (!isFunctionalNodeArchetypeCreatable(archetypeId, options)) {
        const error = new Error(`Functional Node archetype is not currently creatable: ${archetypeId || 'unknown'}`);
        error.code = FUNCTIONAL_NODE_CREATION_ERROR;
        error.archetypeId = archetypeId || null;
        throw error;
    }
    const archetype = getFunctionalNodeArchetype(archetypeId);
    const profile = getCreationProfile(archetypeId);
    return deepFreeze({
        archetypeId: archetype.id,
        compatibilityProvidedComponentTypeIds: profile.compatibilityProvidedComponentTypeIds.slice(),
        creationKind: profile.creationKind,
        options: {
            components: createProvisionedComponents(profile, archetype)
        },
        runtimeTypeId: archetype.baseRuntimeTypeId,
        schema: FUNCTIONAL_NODE_CREATION_PLAN_SCHEMA,
        scratchProjectionRole: archetype.scratchProjectionRole
    });
};

const FUNCTIONAL_NODE_CREATION_CONTRACT = deepFreeze({
    archetypeIdentityPersistsOnCreatedNode: false,
    contractId: FUNCTIONAL_NODE_CREATION_CONTRACT_ID,
    creationBoundary: 'archetype-to-runtime-type-plus-components',
    plannedArchetypesMaySurface: false,
    scratchTargetIdentityMayCrossCreationPlan: false,
    version: FUNCTIONAL_NODE_CREATION_CONTRACT_VERSION
});

module.exports = {
    CREATION_KINDS,
    FUNCTIONAL_NODE_CREATION_CONTRACT,
    FUNCTIONAL_NODE_CREATION_CONTRACT_ID,
    FUNCTIONAL_NODE_CREATION_CONTRACT_VERSION,
    FUNCTIONAL_NODE_CREATION_ERROR,
    FUNCTIONAL_NODE_CREATION_PLAN_SCHEMA,
    createFunctionalNodeCreationPlan,
    isFunctionalNodeArchetypeCreatable,
    listCreatableFunctionalNodeArchetypes
};
