'use strict';

const {
    AUTHORITY_MODES,
    PROJECTION_DIRECTIONS
} = require('../authority');
const {assertPersistentDTO} = require('../persistent');
const {createEngineCommand} = require('../protocol');
const {SCHEMA_PROPERTY_PERSISTENCE} = require('../schema');

const TRANSFORM2D_TYPE_ID = 'ngvge.transform2d';
const TRANSFORM2D_SCHEMA_VERSION = 1;
const TRANSFORM2D_STATE_DOMAIN = 'Transform2D';
const TRANSFORM2D_COMPONENT_OWNER = 'ngvge.transform-system';
const TRANSFORM2D_SCRATCH_AUTHORITY_ID = 'scratch.compat.transform';
const TRANSFORM2D_NATIVE_AUTHORITY_ID = 'ngvge.native.transform';
const TRANSFORM2D_SEMANTIC_PROJECTION_ID = 'ngvge.semantic.transform';
const TRANSFORM2D_PATCH_COMMAND_TYPE = 'PatchComponent';
const TRANSFORM2D_VALIDATION_ERROR = 'NGVGE_TRANSFORM2D_INVALID';

const TRANSFORM2D_FIELDS = Object.freeze(['position', 'rotation', 'scale']);
const TRANSFORM2D_FIELD_SET = new Set(TRANSFORM2D_FIELDS);

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return Object.freeze(value);
};

const TRANSFORM2D_SCHEMA_DESCRIPTOR = deepFreeze({
    properties: {
        position: {
            default: [0, 0],
            nullable: false,
            persistence: SCHEMA_PROPERTY_PERSISTENCE.PERSISTENT,
            type: 'vec2',
            unit: 'world-units',
            validation: {
                finiteElements: true,
                length: 2
            }
        },
        rotation: {
            default: 0,
            nullable: false,
            persistence: SCHEMA_PROPERTY_PERSISTENCE.PERSISTENT,
            type: 'angle',
            unit: 'degrees',
            validation: {
                finite: true
            }
        },
        scale: {
            default: [1, 1],
            nullable: false,
            persistence: SCHEMA_PROPERTY_PERSISTENCE.PERSISTENT,
            type: 'vec2',
            validation: {
                finiteElements: true,
                length: 2
            }
        }
    },
    typeId: TRANSFORM2D_TYPE_ID,
    version: TRANSFORM2D_SCHEMA_VERSION
});

const TRANSFORM2D_AUTHORITY_REGISTRATIONS = deepFreeze([
    {
        authorityId: TRANSFORM2D_SCRATCH_AUTHORITY_ID,
        domain: TRANSFORM2D_STATE_DOMAIN,
        mode: AUTHORITY_MODES.WRITER
    },
    {
        authorityId: TRANSFORM2D_SEMANTIC_PROJECTION_ID,
        domain: TRANSFORM2D_STATE_DOMAIN,
        mode: AUTHORITY_MODES.PROJECTION,
        projectionDirection: PROJECTION_DIRECTIONS.AUTHORITY_TO_PROJECTION
    }
]);

class Transform2DValidationError extends TypeError {
    constructor (issues, message = null) {
        const normalizedIssues = Array.isArray(issues) ? issues : [];
        const first = normalizedIssues[0];
        super(message || (first ?
            `Transform2D is invalid at ${first.path}: ${first.message}` :
            'Transform2D is invalid.'));
        this.code = TRANSFORM2D_VALIDATION_ERROR;
        this.issues = normalizedIssues;
        this.name = 'Transform2DValidationError';
    }
}

const createIssue = (code, path, message) => Object.freeze({code, message, path});

const isPlainObject = value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
};

const cloneVector = value => [value[0], value[1]];

const validateVector2 = (value, path, issues) => {
    if (!Array.isArray(value) || value.length !== 2) {
        issues.push(createIssue('transform2d.vec2.shape-invalid', path, 'Vector values must contain exactly two numbers.'));
        return;
    }
    value.forEach((item, index) => {
        if (typeof item !== 'number' || !Number.isFinite(item)) {
            issues.push(createIssue(
                'transform2d.vec2.non-finite',
                `${path}[${index}]`,
                'Vector elements must be finite numbers.'
            ));
        }
    });
};

const validateTransformFields = (value, options = {}) => {
    const issues = [];
    if (!isPlainObject(value)) {
        return Object.freeze([
            createIssue('transform2d.shape-invalid', '$', 'Transform2D data must be a plain object.')
        ]);
    }

    Object.keys(value).forEach(field => {
        if (!TRANSFORM2D_FIELD_SET.has(field)) {
            issues.push(createIssue(
                'transform2d.field-unknown',
                `$.${field}`,
                `Unknown Transform2D field: ${field}.`
            ));
        }
    });

    if (options.partial !== true || Object.prototype.hasOwnProperty.call(value, 'position')) {
        validateVector2(value.position, '$.position', issues);
    }
    if (options.partial !== true || Object.prototype.hasOwnProperty.call(value, 'rotation')) {
        if (typeof value.rotation !== 'number' || !Number.isFinite(value.rotation)) {
            issues.push(createIssue(
                'transform2d.rotation.non-finite',
                '$.rotation',
                'rotation must be a finite number of degrees.'
            ));
        }
    }
    if (options.partial !== true || Object.prototype.hasOwnProperty.call(value, 'scale')) {
        validateVector2(value.scale, '$.scale', issues);
    }
    if (options.partial === true && options.allowEmpty !== true && Object.keys(value).length === 0) {
        issues.push(createIssue('transform2d.patch.empty', '$', 'Transform2D patches must change at least one field.'));
    }

    return Object.freeze(issues);
};

const validateTransform2D = value => {
    const source = typeof value === 'undefined' ? {
        position: [0, 0],
        rotation: 0,
        scale: [1, 1]
    } : value;
    const issues = validateTransformFields(source);
    if (issues.length === 0) {
        const persistentResult = (() => {
            try {
                assertPersistentDTO(source, {path: '$'});
                return null;
            } catch (error) {
                return error;
            }
        })();
        if (persistentResult && Array.isArray(persistentResult.issues)) {
            return Object.freeze({
                issues: Object.freeze(persistentResult.issues.map(issue => createIssue(
                    'transform2d.persistent.invalid',
                    issue.path,
                    issue.message
                ))),
                valid: false
            });
        }
    }
    return Object.freeze({issues, valid: issues.length === 0});
};

const assertTransform2D = value => {
    const result = validateTransform2D(value);
    if (!result.valid) throw new Transform2DValidationError(result.issues);
    return value;
};

const normalizeTransform2D = value => {
    const source = typeof value === 'undefined' ? {} : value;
    const sourceIssues = validateTransformFields(source, {allowEmpty: true, partial: true});
    if (sourceIssues.length) throw new Transform2DValidationError(sourceIssues);
    assertPersistentDTO(source, {path: '$'});
    const normalized = {
        position: Object.prototype.hasOwnProperty.call(source, 'position') ? cloneVector(source.position) : [0, 0],
        rotation: Object.prototype.hasOwnProperty.call(source, 'rotation') ? source.rotation : 0,
        scale: Object.prototype.hasOwnProperty.call(source, 'scale') ? cloneVector(source.scale) : [1, 1]
    };
    assertTransform2D(normalized);
    return deepFreeze(normalized);
};

const normalizeTransform2DPatch = value => {
    const issues = validateTransformFields(value, {partial: true});
    if (issues.length) throw new Transform2DValidationError(issues);
    const patch = {};
    if (Object.prototype.hasOwnProperty.call(value, 'position')) patch.position = cloneVector(value.position);
    if (Object.prototype.hasOwnProperty.call(value, 'rotation')) patch.rotation = value.rotation;
    if (Object.prototype.hasOwnProperty.call(value, 'scale')) patch.scale = cloneVector(value.scale);
    assertPersistentDTO(patch, {path: '$'});
    return deepFreeze(patch);
};

const assertNonEmptyId = (value, field) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized) {
        const error = new TypeError(`${field} must be a non-empty stable identifier.`);
        error.code = 'NGVGE_TRANSFORM2D_ID_INVALID';
        error.field = field;
        throw error;
    }
    return normalized;
};

const createTransform2DPatchComponentCommand = ({componentId, nodeId, patch}) => createEngineCommand(
    TRANSFORM2D_PATCH_COMMAND_TYPE,
    {
        componentId: assertNonEmptyId(componentId, 'componentId'),
        nodeId: assertNonEmptyId(nodeId, 'nodeId'),
        patch: normalizeTransform2DPatch(patch)
    }
);

const registerTransform2DSchema = schemaRegistry => {
    if (!schemaRegistry || typeof schemaRegistry.register !== 'function') {
        throw new TypeError('Transform2D schema registration requires a Schema Registry.');
    }
    return schemaRegistry.register(TRANSFORM2D_SCHEMA_DESCRIPTOR);
};

const registerTransform2DAuthority = authorityRegistry => {
    if (!authorityRegistry || typeof authorityRegistry.registerMany !== 'function') {
        throw new TypeError('Transform2D authority registration requires an Authority Registry.');
    }
    return authorityRegistry.registerMany(TRANSFORM2D_AUTHORITY_REGISTRATIONS);
};

module.exports = {
    TRANSFORM2D_AUTHORITY_REGISTRATIONS,
    TRANSFORM2D_COMPONENT_OWNER,
    TRANSFORM2D_FIELDS,
    TRANSFORM2D_PATCH_COMMAND_TYPE,
    TRANSFORM2D_SCHEMA_DESCRIPTOR,
    TRANSFORM2D_SCHEMA_VERSION,
    TRANSFORM2D_NATIVE_AUTHORITY_ID,
    TRANSFORM2D_SCRATCH_AUTHORITY_ID,
    TRANSFORM2D_SEMANTIC_PROJECTION_ID,
    TRANSFORM2D_STATE_DOMAIN,
    TRANSFORM2D_TYPE_ID,
    TRANSFORM2D_VALIDATION_ERROR,
    Transform2DValidationError,
    assertTransform2D,
    createTransform2DPatchComponentCommand,
    normalizeTransform2D,
    normalizeTransform2DPatch,
    registerTransform2DAuthority,
    registerTransform2DSchema,
    validateTransform2D
};
