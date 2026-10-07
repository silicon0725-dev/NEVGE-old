'use strict';

const {validatePersistentDTO} = require('../persistent');

const SCHEMA_DESCRIPTOR_SCHEMA = 'ngvge-schema-descriptor/v1';
const SCHEMA_VALIDATION_ERROR = 'NGVGE_SCHEMA_DESCRIPTOR_INVALID';

const SCHEMA_PROPERTY_PERSISTENCE = Object.freeze({
    PERSISTENT: 'persistent',
    RUNTIME_ONLY: 'runtime-only'
});

const SCHEMA_PROPERTY_PERSISTENCE_VALUES = Object.freeze(Object.values(SCHEMA_PROPERTY_PERSISTENCE));
const TYPE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{1,127}$/;
const PROPERTY_NAME_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$.-]{0,127}$/;
const FORBIDDEN_PROPERTY_NAMES = new Set(['__proto__', 'constructor', 'prototype']);
const PROPERTY_DESCRIPTOR_KEYS = new Set([
    'default',
    'maximum',
    'minimum',
    'nullable',
    'persistence',
    'resourceType',
    'type',
    'unit',
    'validation'
]);
const SCHEMA_DESCRIPTOR_KEYS = new Set(['properties', 'typeId', 'version']);

class SchemaDescriptorValidationError extends TypeError {
    constructor (issues, message = null) {
        const normalizedIssues = Array.isArray(issues) ? issues : [];
        const first = normalizedIssues[0];
        super(message || (first ?
            `Schema descriptor is invalid at ${first.path}: ${first.message}` :
            'Schema descriptor is invalid.'));
        this.code = SCHEMA_VALIDATION_ERROR;
        this.issues = normalizedIssues;
        this.name = 'SchemaDescriptorValidationError';
    }
}

const createIssue = (code, path, message) => Object.freeze({code, message, path});

const isPlainObject = value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
};

const validateStringToken = (value, path, issues, code, label) => {
    if (typeof value !== 'string' || !value.trim()) {
        issues.push(createIssue(code, path, `${label} must be a non-empty string.`));
        return null;
    }
    return value.trim();
};

const validateSchemaPropertyDescriptor = (value, propertyName, path, issues) => {
    if (!isPlainObject(value)) {
        issues.push(createIssue('schema.property.non-plain', path, 'Property descriptor must be a plain object.'));
        return;
    }

    Object.keys(value).forEach(key => {
        if (!PROPERTY_DESCRIPTOR_KEYS.has(key)) {
            issues.push(createIssue(
                'schema.property.unknown-field',
                `${path}.${key}`,
                `Unknown schema property metadata field: ${key}.`
            ));
        }
    });

    validateStringToken(value.type, `${path}.type`, issues, 'schema.property.type.invalid', 'Property type');

    if (Object.prototype.hasOwnProperty.call(value, 'nullable') && typeof value.nullable !== 'boolean') {
        issues.push(createIssue('schema.property.nullable.invalid', `${path}.nullable`, 'nullable must be boolean.'));
    }

    if (Object.prototype.hasOwnProperty.call(value, 'persistence') &&
        !SCHEMA_PROPERTY_PERSISTENCE_VALUES.includes(value.persistence)) {
        issues.push(createIssue(
            'schema.property.persistence.invalid',
            `${path}.persistence`,
            'persistence must be "persistent" or "runtime-only".'
        ));
    }

    for (const [field, label] of [['unit', 'unit'], ['resourceType', 'resourceType']]) {
        if (Object.prototype.hasOwnProperty.call(value, field)) {
            validateStringToken(
                value[field],
                `${path}.${field}`,
                issues,
                `schema.property.${field}.invalid`,
                label
            );
        }
    }

    for (const field of ['minimum', 'maximum']) {
        if (Object.prototype.hasOwnProperty.call(value, field) &&
            (typeof value[field] !== 'number' || !Number.isFinite(value[field]))) {
            issues.push(createIssue(
                `schema.property.${field}.invalid`,
                `${path}.${field}`,
                `${field} must be a finite number.`
            ));
        }
    }

    if (typeof value.minimum === 'number' && Number.isFinite(value.minimum) &&
        typeof value.maximum === 'number' && Number.isFinite(value.maximum) &&
        value.minimum > value.maximum) {
        issues.push(createIssue(
            'schema.property.range.invalid',
            path,
            'minimum cannot be greater than maximum.'
        ));
    }

    if (Object.prototype.hasOwnProperty.call(value, 'default')) {
        const defaultResult = validatePersistentDTO(value.default, {path: `${path}.default`});
        defaultResult.issues.forEach(issue => {
            issues.push(createIssue('schema.property.default.invalid', issue.path, issue.message));
        });
        if (value.default === null && value.nullable !== true) {
            issues.push(createIssue(
                'schema.property.default.nullability-conflict',
                `${path}.default`,
                `Property "${propertyName}" has a null default but is not nullable.`
            ));
        }
    }

    if (Object.prototype.hasOwnProperty.call(value, 'validation')) {
        if (!isPlainObject(value.validation)) {
            issues.push(createIssue(
                'schema.property.validation.non-plain',
                `${path}.validation`,
                'validation metadata must be a plain object.'
            ));
        } else {
            const validationResult = validatePersistentDTO(value.validation, {path: `${path}.validation`});
            validationResult.issues.forEach(issue => {
                issues.push(createIssue('schema.property.validation.invalid', issue.path, issue.message));
            });
        }
    }
};

const validateSchemaDescriptor = value => {
    const issues = [];
    if (!isPlainObject(value)) {
        return Object.freeze({
            issues: Object.freeze([
                createIssue('schema.descriptor.non-plain', '$', 'Schema descriptor must be a plain object.')
            ]),
            schema: SCHEMA_DESCRIPTOR_SCHEMA,
            valid: false
        });
    }

    const persistentResult = validatePersistentDTO(value, {path: '$'});
    if (!persistentResult.valid) {
        persistentResult.issues.forEach(issue => {
            let code = 'schema.descriptor.persistent-invalid';
            if (/\.default(?:\.|\[|$)/.test(issue.path)) code = 'schema.property.default.invalid';
            if (/\.validation(?:\.|\[|$)/.test(issue.path)) code = 'schema.property.validation.invalid';
            issues.push(createIssue(code, issue.path, issue.message));
        });
        return Object.freeze({
            issues: Object.freeze(issues.slice()),
            schema: SCHEMA_DESCRIPTOR_SCHEMA,
            valid: false
        });
    }

    Object.keys(value).forEach(key => {
        if (!SCHEMA_DESCRIPTOR_KEYS.has(key)) {
            issues.push(createIssue(
                'schema.descriptor.unknown-field',
                `$.${key}`,
                `Unknown schema descriptor field: ${key}.`
            ));
        }
    });

    const typeId = validateStringToken(
        value.typeId,
        '$.typeId',
        issues,
        'schema.type-id.invalid',
        'typeId'
    );
    if (typeId && !TYPE_ID_PATTERN.test(typeId)) {
        issues.push(createIssue(
            'schema.type-id.format-invalid',
            '$.typeId',
            'typeId must be a stable namespaced token without whitespace.'
        ));
    }

    if (!Number.isInteger(value.version) || value.version < 1) {
        issues.push(createIssue(
            'schema.version.invalid',
            '$.version',
            'version must be a positive integer.'
        ));
    }

    if (!isPlainObject(value.properties)) {
        issues.push(createIssue(
            'schema.properties.non-plain',
            '$.properties',
            'properties must be a plain object.'
        ));
    } else {
        Object.keys(value.properties).forEach(propertyName => {
            const propertyPath = `$.properties[${JSON.stringify(propertyName)}]`;
            if (!PROPERTY_NAME_PATTERN.test(propertyName) || FORBIDDEN_PROPERTY_NAMES.has(propertyName)) {
                issues.push(createIssue(
                    'schema.property.name.invalid',
                    propertyPath,
                    'Schema property names must be safe stable field tokens.'
                ));
                return;
            }
            validateSchemaPropertyDescriptor(value.properties[propertyName], propertyName, propertyPath, issues);
        });
    }

    return Object.freeze({
        issues: Object.freeze(issues.slice()),
        schema: SCHEMA_DESCRIPTOR_SCHEMA,
        valid: issues.length === 0
    });
};

const assertSchemaDescriptor = value => {
    const result = validateSchemaDescriptor(value);
    if (!result.valid) throw new SchemaDescriptorValidationError(result.issues);
    return value;
};

const deepClone = value => {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(deepClone);
    const clone = Object.getPrototypeOf(value) === null ? Object.create(null) : {};
    Object.keys(value).forEach(key => {
        clone[key] = deepClone(value[key]);
    });
    return clone;
};

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return value;
};

const normalizeSchemaPropertyDescriptor = value => {
    const normalized = {
        nullable: value.nullable === true,
        persistence: value.persistence || SCHEMA_PROPERTY_PERSISTENCE.PERSISTENT,
        type: value.type.trim()
    };
    for (const field of ['default', 'minimum', 'maximum', 'unit', 'resourceType', 'validation']) {
        if (Object.prototype.hasOwnProperty.call(value, field)) {
            normalized[field] = deepClone(value[field]);
        }
    }
    return deepFreeze(normalized);
};

const normalizeSchemaDescriptor = value => {
    assertSchemaDescriptor(value);
    const properties = Object.create(null);
    Object.keys(value.properties).sort().forEach(propertyName => {
        properties[propertyName] = normalizeSchemaPropertyDescriptor(value.properties[propertyName]);
    });
    return deepFreeze({
        properties,
        typeId: value.typeId.trim(),
        version: value.version
    });
};

module.exports = {
    SCHEMA_DESCRIPTOR_SCHEMA,
    SCHEMA_PROPERTY_PERSISTENCE,
    SCHEMA_VALIDATION_ERROR,
    SchemaDescriptorValidationError,
    assertSchemaDescriptor,
    normalizeSchemaDescriptor,
    validateSchemaDescriptor
};
