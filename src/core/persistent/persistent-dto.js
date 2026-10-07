'use strict';

const PERSISTENT_DTO_SCHEMA = 'ngvge-persistent-dto/v1';
const PERSISTENT_DTO_VALIDATION_ERROR = 'PERSISTENT_DTO_VALIDATION_FAILED';

class PersistentDTOValidationError extends TypeError {
    constructor (issues, message = null) {
        const normalizedIssues = Array.isArray(issues) ? issues : [];
        const first = normalizedIssues[0];
        super(message || (first ?
            `Persistent DTO is invalid at ${first.path}: ${first.message}` :
            'Persistent DTO is invalid.'));
        this.code = PERSISTENT_DTO_VALIDATION_ERROR;
        this.issues = normalizedIssues;
        this.name = 'PersistentDTOValidationError';
    }
}

const getValueType = value => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
};

const appendObjectPath = (path, key) => (
    /^[A-Za-z_$][\w$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`
);

const createIssue = (code, path, message, value) => Object.freeze({
    code,
    message,
    path,
    valueType: getValueType(value)
});

const normalizeOptions = options => ({
    allowTopLevelUndefined: options && options.allowTopLevelUndefined === true,
    maxIssues: options && Number.isInteger(options.maxIssues) && options.maxIssues > 0 ? options.maxIssues : 100,
    path: options && typeof options.path === 'string' && options.path.length ? options.path : '$'
});

const validatePersistentDTO = (value, options = {}) => {
    const normalizedOptions = normalizeOptions(options);
    const issues = [];
    const activeObjects = new WeakSet();

    const addIssue = (code, path, message, issueValue) => {
        if (issues.length >= normalizedOptions.maxIssues) return;
        issues.push(createIssue(code, path, message, issueValue));
    };

    const visit = (current, path, topLevel = false) => {
        if (issues.length >= normalizedOptions.maxIssues) return;
        if (current === null || typeof current === 'string' || typeof current === 'boolean') return;
        if (typeof current === 'number') {
            if (!Number.isFinite(current)) {
                addIssue('persistent.number.non-finite', path, 'Numbers must be finite.', current);
            }
            return;
        }
        if (typeof current === 'undefined') {
            if (!(topLevel && normalizedOptions.allowTopLevelUndefined)) {
                addIssue('persistent.value.undefined', path, 'Undefined values are not persistent DTO data.', current);
            }
            return;
        }
        if (typeof current === 'bigint') {
            addIssue('persistent.value.bigint', path, 'BigInt values are not supported by the project format.', current);
            return;
        }
        if (typeof current === 'function') {
            addIssue('persistent.value.function', path, 'Functions are runtime objects and cannot be persisted.', current);
            return;
        }
        if (typeof current === 'symbol') {
            addIssue('persistent.value.symbol', path, 'Symbols cannot be persisted.', current);
            return;
        }
        if (!current || typeof current !== 'object') {
            addIssue('persistent.value.unsupported', path, 'Unsupported persistent DTO value.', current);
            return;
        }

        if (activeObjects.has(current)) {
            addIssue('persistent.object.cycle', path, 'Circular references are not allowed.', current);
            return;
        }

        const prototype = Object.getPrototypeOf(current);
        const plainObject = prototype === Object.prototype || prototype === null;
        if (!Array.isArray(current) && !plainObject) {
            const constructorName = prototype && prototype.constructor && prototype.constructor.name;
            addIssue(
                'persistent.object.non-plain',
                path,
                `Only arrays and plain objects can be persisted${constructorName ? `; received ${constructorName}` : ''}.`,
                current
            );
            return;
        }

        activeObjects.add(current);
        try {
            const ownKeys = Reflect.ownKeys(current);
            ownKeys.forEach(key => {
                if (typeof key === 'symbol') {
                    addIssue('persistent.object.symbol-key', path, 'Symbol object keys cannot be persisted.', current);
                    return;
                }
                const descriptor = Object.getOwnPropertyDescriptor(current, key);
                const isArray = Array.isArray(current);
                const isArrayIndex = isArray && /^(0|[1-9]\d*)$/.test(key) && Number(key) < current.length;
                const childPath = isArray ? `${path}[${key}]` : appendObjectPath(path, key);
                if (!descriptor) return;
                if (isArray && key !== 'length' && !isArrayIndex) {
                    addIssue('persistent.array.custom-property', childPath, 'Custom array properties cannot be persisted.', current);
                    return;
                }
                if (!isArray && descriptor.enumerable !== true) {
                    addIssue('persistent.object.non-enumerable', childPath, 'Non-enumerable properties cannot be persisted.', current);
                    return;
                }
                if (typeof descriptor.get === 'function' || typeof descriptor.set === 'function') {
                    addIssue('persistent.object.accessor', childPath, 'Accessor properties cannot be persisted.', current);
                    return;
                }
                if (key !== 'length') visit(descriptor.value, childPath, false);
            });
            if (Array.isArray(current)) {
                for (let index = 0; index < current.length; index++) {
                    if (!Object.prototype.hasOwnProperty.call(current, index)) {
                        addIssue('persistent.array.sparse', `${path}[${index}]`, 'Sparse array entries are not allowed.', current);
                    }
                }
            }
        } finally {
            activeObjects.delete(current);
        }
    };

    visit(value, normalizedOptions.path, true);
    return Object.freeze({
        issues: Object.freeze(issues.slice()),
        schema: PERSISTENT_DTO_SCHEMA,
        valid: issues.length === 0
    });
};

const assertPersistentDTO = (value, options = {}) => {
    const result = validatePersistentDTO(value, options);
    if (!result.valid) throw new PersistentDTOValidationError(result.issues);
    return value;
};

const cloneValue = value => {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(cloneValue);
    const clone = Object.getPrototypeOf(value) === null ? Object.create(null) : {};
    Object.keys(value).forEach(key => {
        clone[key] = cloneValue(value[key]);
    });
    return clone;
};

const clonePersistentDTO = (value, options = {}) => {
    if (typeof value === 'undefined' && options.allowTopLevelUndefined === true) return undefined;
    assertPersistentDTO(value, options);
    return cloneValue(value);
};

module.exports = {
    PERSISTENT_DTO_SCHEMA,
    PERSISTENT_DTO_VALIDATION_ERROR,
    PersistentDTOValidationError,
    assertPersistentDTO,
    clonePersistentDTO,
    validatePersistentDTO
};
