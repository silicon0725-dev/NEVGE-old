'use strict';

const {TRANSFORM2D_TYPE_ID} = require('../transform2d');

const FUNCTIONAL_NODE_FOUNDATION_CONTRACT_ID = 'ngvge.functional-node-foundation';
const FUNCTIONAL_NODE_FOUNDATION_VERSION = 1;
const FUNCTIONAL_NODE_ARCHETYPE_SCHEMA = 'ngvge.functional-node-archetype/v1';
const FUNCTIONAL_NODE_VALIDATION_ERROR = 'NGVGE_FUNCTIONAL_NODE_ARCHETYPE_INVALID';

const FUNCTIONAL_COMPONENT_TYPE_IDS = Object.freeze({
    AUDIO_EMITTER_2D: 'ngvge.audio-emitter2d',
    CAMERA_2D: 'ngvge.camera2d',
    CHARACTER_CONTROLLER_2D: 'ngvge.character-controller2d',
    COLLIDER_2D: 'ngvge.collider2d',
    RIGIDBODY_2D: 'ngvge.rigidbody2d',
    SCRIPT_HOST: 'ngvge.script-host',
    TILEMAP_LAYER_2D: 'ngvge.tilemap-layer2d',
    TRANSFORM_2D: TRANSFORM2D_TYPE_ID,
    VISUAL_2D: 'ngvge.visual2d'
});

const FUNCTIONAL_NODE_ARCHETYPE_IDS = Object.freeze({
    AREA_2D: 'ngvge.archetype.area2d',
    AUDIO_SOURCE_2D: 'ngvge.archetype.audio-source2d',
    CAMERA_2D: 'ngvge.archetype.camera2d',
    CHARACTER_BODY_2D: 'ngvge.archetype.character-body2d',
    NODE_2D: 'ngvge.archetype.node2d',
    RIGID_BODY_2D: 'ngvge.archetype.rigid-body2d',
    SPRITE_2D: 'ngvge.archetype.sprite2d',
    STATIC_BODY_2D: 'ngvge.archetype.static-body2d',
    TILEMAP_LAYER_2D: 'ngvge.archetype.tilemap-layer2d'
});

const FUNCTIONAL_NODE_IMPLEMENTATION_STATES = Object.freeze({
    COMPATIBILITY_BACKED: 'compatibility-backed',
    IMPLEMENTED: 'implemented',
    PLANNED: 'planned'
});

const SCRATCH_PROJECTION_ROLES = Object.freeze({
    BAKE: 'bake',
    CONTAINER: 'container',
    NATIVE_ONLY: 'native-only',
    TARGET: 'target'
});

const NATIVE_PROJECT_FORMAT = Object.freeze({
    extension: '.ne',
    formatId: 'ngvge.ne-project',
    role: 'canonical-native-project'
});

const SCRATCH_COMPATIBILITY_FORMAT = Object.freeze({
    extension: '.sb3',
    profileId: 'scratch3',
    role: 'compatibility-projection'
});

const FUNCTIONAL_NODE_FOUNDATION = Object.freeze({
    archetypeIdentityIsPersistent: false,
    archetypeStrategy: 'base-node-plus-components',
    backendObjectMayOwnNodeIdentity: false,
    contractId: FUNCTIONAL_NODE_FOUNDATION_CONTRACT_ID,
    hierarchyOwnership: Object.freeze({
        parentField: 'parentId',
        parentIsSerializationOwner: false,
        serializationOwnerField: 'serializationOwnerId'
    }),
    nativeTransformWriterRequirement: Object.freeze({
        currentGlobalAuthorityRegistryUnchanged: true,
        requiredBeforeNativeTransformMutation: true,
        routingScope: 'node'
    }),
    nativeProjectFormat: NATIVE_PROJECT_FORMAT,
    scratchCompatibilityFormat: SCRATCH_COMPATIBILITY_FORMAT,
    version: FUNCTIONAL_NODE_FOUNDATION_VERSION
});

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return Object.freeze(value);
};

const component = (typeId, implementation, options = {}) => ({
    implementation,
    required: options.required !== false,
    typeId
});

const archetype = definition => deepFreeze(Object.assign({
    family: '2d',
    schema: FUNCTIONAL_NODE_ARCHETYPE_SCHEMA
}, definition));

const FUNCTIONAL_NODE_ARCHETYPES = deepFreeze([
    archetype({
        baseRuntimeTypeId: 'ngvge.node2d',
        components: [
            component(FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED)
        ],
        id: FUNCTIONAL_NODE_ARCHETYPE_IDS.NODE_2D,
        implementation: FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED,
        label: 'Node2D',
        scratchProjectionRole: SCRATCH_PROJECTION_ROLES.CONTAINER
    }),
    archetype({
        baseRuntimeTypeId: 'ngvge.sprite-node',
        components: [
            component(FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED),
            component(FUNCTIONAL_COMPONENT_TYPE_IDS.VISUAL_2D, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.PLANNED),
            component(FUNCTIONAL_COMPONENT_TYPE_IDS.SCRIPT_HOST, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.PLANNED)
        ],
        id: FUNCTIONAL_NODE_ARCHETYPE_IDS.SPRITE_2D,
        implementation: FUNCTIONAL_NODE_IMPLEMENTATION_STATES.COMPATIBILITY_BACKED,
        label: 'Sprite2D',
        scratchProjectionRole: SCRATCH_PROJECTION_ROLES.TARGET
    }),
    archetype({
        baseRuntimeTypeId: 'ngvge.node2d',
        components: [
            component(FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED),
            component(FUNCTIONAL_COMPONENT_TYPE_IDS.CAMERA_2D, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED)
        ],
        id: FUNCTIONAL_NODE_ARCHETYPE_IDS.CAMERA_2D,
        implementation: FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED,
        label: 'Camera2D',
        scratchProjectionRole: SCRATCH_PROJECTION_ROLES.NATIVE_ONLY
    }),
    archetype({
        baseRuntimeTypeId: 'ngvge.node2d',
        components: [
            component(FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED),
            component(FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED)
        ],
        defaults: {
            [FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D]: {sensor: true}
        },
        id: FUNCTIONAL_NODE_ARCHETYPE_IDS.AREA_2D,
        implementation: FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED,
        label: 'Area2D',
        scratchProjectionRole: SCRATCH_PROJECTION_ROLES.NATIVE_ONLY
    }),
    archetype({
        baseRuntimeTypeId: 'ngvge.node2d',
        components: [
            component(FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED),
            component(FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED)
        ],
        defaults: {
            [FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D]: {sensor: false}
        },
        id: FUNCTIONAL_NODE_ARCHETYPE_IDS.STATIC_BODY_2D,
        implementation: FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED,
        label: 'StaticBody2D',
        scratchProjectionRole: SCRATCH_PROJECTION_ROLES.NATIVE_ONLY
    }),
    archetype({
        baseRuntimeTypeId: 'ngvge.node2d',
        components: [
            component(FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED),
            component(FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED),
            component(FUNCTIONAL_COMPONENT_TYPE_IDS.CHARACTER_CONTROLLER_2D, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED)
        ],
        defaults: {
            [FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D]: {sensor: false}
        },
        id: FUNCTIONAL_NODE_ARCHETYPE_IDS.CHARACTER_BODY_2D,
        implementation: FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED,
        label: 'CharacterBody2D',
        scratchProjectionRole: SCRATCH_PROJECTION_ROLES.NATIVE_ONLY
    }),
    archetype({
        baseRuntimeTypeId: 'ngvge.node2d',
        components: [
            component(FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED),
            component(FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED),
            component(FUNCTIONAL_COMPONENT_TYPE_IDS.RIGIDBODY_2D, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED)
        ],
        defaults: {
            [FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D]: {sensor: false}
        },
        id: FUNCTIONAL_NODE_ARCHETYPE_IDS.RIGID_BODY_2D,
        implementation: FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED,
        label: 'RigidBody2D',
        scratchProjectionRole: SCRATCH_PROJECTION_ROLES.NATIVE_ONLY
    }),
    archetype({
        baseRuntimeTypeId: 'ngvge.node2d',
        components: [
            component(FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED),
            component(FUNCTIONAL_COMPONENT_TYPE_IDS.TILEMAP_LAYER_2D, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED)
        ],
        id: FUNCTIONAL_NODE_ARCHETYPE_IDS.TILEMAP_LAYER_2D,
        implementation: FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED,
        label: 'TileMapLayer2D',
        scratchProjectionRole: SCRATCH_PROJECTION_ROLES.BAKE
    }),
    archetype({
        baseRuntimeTypeId: 'ngvge.node2d',
        components: [
            component(FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED),
            component(FUNCTIONAL_COMPONENT_TYPE_IDS.AUDIO_EMITTER_2D, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.PLANNED)
        ],
        id: FUNCTIONAL_NODE_ARCHETYPE_IDS.AUDIO_SOURCE_2D,
        implementation: FUNCTIONAL_NODE_IMPLEMENTATION_STATES.PLANNED,
        label: 'AudioSource2D',
        scratchProjectionRole: SCRATCH_PROJECTION_ROLES.NATIVE_ONLY
    })
]);

const ARCHETYPE_BY_ID = new Map(FUNCTIONAL_NODE_ARCHETYPES.map(item => [item.id, item]));

const isPlainObject = value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
};

const validateFunctionalNodeArchetype = value => {
    const issues = [];
    if (!isPlainObject(value)) {
        return Object.freeze({
            issues: Object.freeze([{code: 'functional-node.shape-invalid', path: '$'}]),
            valid: false
        });
    }
    const implementationValues = Object.values(FUNCTIONAL_NODE_IMPLEMENTATION_STATES);
    const scratchProjectionRoles = Object.values(SCRATCH_PROJECTION_ROLES);
    if (value.schema !== FUNCTIONAL_NODE_ARCHETYPE_SCHEMA) {
        issues.push({code: 'functional-node.schema-invalid', path: '$.schema'});
    }
    if (typeof value.id !== 'string' || !value.id.startsWith('ngvge.archetype.')) {
        issues.push({code: 'functional-node.id-invalid', path: '$.id'});
    }
    if (typeof value.label !== 'string' || !value.label.trim()) {
        issues.push({code: 'functional-node.label-invalid', path: '$.label'});
    }
    if (typeof value.baseRuntimeTypeId !== 'string' || !value.baseRuntimeTypeId.startsWith('ngvge.')) {
        issues.push({code: 'functional-node.base-type-invalid', path: '$.baseRuntimeTypeId'});
    }
    if (!implementationValues.includes(value.implementation)) {
        issues.push({code: 'functional-node.implementation-invalid', path: '$.implementation'});
    }
    if (!scratchProjectionRoles.includes(value.scratchProjectionRole)) {
        issues.push({code: 'functional-node.scratch-projection-invalid', path: '$.scratchProjectionRole'});
    }
    if (!Array.isArray(value.components) || value.components.length === 0) {
        issues.push({code: 'functional-node.components-invalid', path: '$.components'});
    } else {
        const seen = new Set();
        value.components.forEach((entry, index) => {
            const path = `$.components[${index}]`;
            if (!isPlainObject(entry) || typeof entry.typeId !== 'string' || !entry.typeId.startsWith('ngvge.')) {
                issues.push({code: 'functional-node.component-type-invalid', path: `${path}.typeId`});
                return;
            }
            if (seen.has(entry.typeId)) issues.push({code: 'functional-node.component-duplicate', path: `${path}.typeId`});
            seen.add(entry.typeId);
            if (!implementationValues.includes(entry.implementation)) {
                issues.push({code: 'functional-node.component-implementation-invalid', path: `${path}.implementation`});
            }
        });
        if (!seen.has(FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D)) {
            issues.push({code: 'functional-node.transform-required', path: '$.components'});
        }
    }
    return Object.freeze({
        issues: Object.freeze(issues.map(issue => Object.freeze(issue))),
        valid: issues.length === 0
    });
};

const assertFunctionalNodeArchetype = value => {
    const result = validateFunctionalNodeArchetype(value);
    if (!result.valid) {
        const error = new TypeError('Functional Node archetype descriptor is invalid.');
        error.code = FUNCTIONAL_NODE_VALIDATION_ERROR;
        error.issues = result.issues;
        throw error;
    }
    return value;
};

const getFunctionalNodeArchetype = archetypeId => ARCHETYPE_BY_ID.get(archetypeId) || null;
const listFunctionalNodeArchetypes = () => FUNCTIONAL_NODE_ARCHETYPES.slice();

module.exports = {
    FUNCTIONAL_COMPONENT_TYPE_IDS,
    FUNCTIONAL_NODE_ARCHETYPE_IDS,
    FUNCTIONAL_NODE_ARCHETYPE_SCHEMA,
    FUNCTIONAL_NODE_ARCHETYPES,
    FUNCTIONAL_NODE_FOUNDATION,
    FUNCTIONAL_NODE_FOUNDATION_CONTRACT_ID,
    FUNCTIONAL_NODE_FOUNDATION_VERSION,
    FUNCTIONAL_NODE_IMPLEMENTATION_STATES,
    FUNCTIONAL_NODE_VALIDATION_ERROR,
    NATIVE_PROJECT_FORMAT,
    SCRATCH_COMPATIBILITY_FORMAT,
    SCRATCH_PROJECTION_ROLES,
    assertFunctionalNodeArchetype,
    getFunctionalNodeArchetype,
    listFunctionalNodeArchetypes,
    validateFunctionalNodeArchetype
};
