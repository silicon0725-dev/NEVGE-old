'use strict';

const PROTOCOL_VALUE_SCHEMA = 'ngvge-protocol-value/v1';
const PROTOCOL_VALUE_VALIDATION_ERROR = 'NGVGE_PROTOCOL_VALUE_INVALID';
const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

class ProtocolValueValidationError extends TypeError {
    constructor (issues, message = null) {
        const normalizedIssues = Array.isArray(issues) ? issues : [];
        const first = normalizedIssues[0];
        super(message || (first ?
            `Protocol value is invalid at ${first.path}: ${first.message}` :
            'Protocol value is invalid.'));
        this.code = PROTOCOL_VALUE_VALIDATION_ERROR;
        this.issues = normalizedIssues;
        this.name = 'ProtocolValueValidationError';
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
    maxIssues: options && Number.isInteger(options.maxIssues) && options.maxIssues > 0 ? options.maxIssues : 100,
    path: options && typeof options.path === 'string' && options.path.length ? options.path : '$'
});

const validateProtocolValue = (value, options = {}) => {
    const normalizedOptions = normalizeOptions(options);
    const issues = [];
    const activeObjects = new WeakSet();

    const addIssue = (code, path, message, issueValue) => {
        if (issues.length >= normalizedOptions.maxIssues) return;
        issues.push(createIssue(code, path, message, issueValue));
    };

    const visit = (current, path) => {
        if (issues.length >= normalizedOptions.maxIssues) return;
        if (current === null || typeof current === 'string' || typeof current === 'boolean') return;
        if (typeof current === 'number') {
            if (!Number.isFinite(current)) {
                addIssue('protocol.number.non-finite', path, 'Protocol numbers must be finite.', current);
            }
            return;
        }
        if (typeof current === 'undefined') {
            addIssue('protocol.value.undefined', path, 'Undefined is not portable protocol data.', current);
            return;
        }
        if (typeof current === 'bigint') {
            addIssue('protocol.value.bigint', path, 'BigInt/native integer handles are not portable protocol data.', current);
            return;
        }
        if (typeof current === 'function') {
            addIssue('protocol.value.function', path, 'Functions and service methods cannot cross the protocol boundary.', current);
            return;
        }
        if (typeof current === 'symbol') {
            addIssue('protocol.value.symbol', path, 'Symbols and branded runtime tokens cannot cross the protocol boundary.', current);
            return;
        }
        if (!current || typeof current !== 'object') {
            addIssue('protocol.value.unsupported', path, 'Unsupported protocol value.', current);
            return;
        }

        if (activeObjects.has(current)) {
            addIssue('protocol.object.cycle', path, 'Circular references are not portable protocol data.', current);
            return;
        }

        const prototype = Object.getPrototypeOf(current);
        const plainObject = prototype === Object.prototype || prototype === null;
        if (!Array.isArray(current) && !plainObject) {
            const constructorName = prototype && prototype.constructor && prototype.constructor.name;
            addIssue(
                'protocol.object.non-plain',
                path,
                `Runtime/native objects are forbidden; expected plain data${constructorName ? `, received ${constructorName}` : ''}.`,
                current
            );
            return;
        }

        activeObjects.add(current);
        try {
            const ownKeys = Reflect.ownKeys(current);
            ownKeys.forEach(key => {
                if (typeof key === 'symbol') {
                    addIssue('protocol.object.symbol-key', path, 'Symbol object keys cannot cross the protocol boundary.', current);
                    return;
                }
                if (!Array.isArray(current) && UNSAFE_OBJECT_KEYS.has(key)) {
                    addIssue('protocol.object.unsafe-key', appendObjectPath(path, key), 'Unsafe object keys are forbidden.', current);
                    return;
                }
                const descriptor = Object.getOwnPropertyDescriptor(current, key);
                const isArray = Array.isArray(current);
                const isArrayIndex = isArray && /^(0|[1-9]\d*)$/.test(key) && Number(key) < current.length;
                const childPath = isArray ? `${path}[${key}]` : appendObjectPath(path, key);
                if (!descriptor) return;
                if (isArray && key !== 'length' && !isArrayIndex) {
                    addIssue('protocol.array.custom-property', childPath, 'Custom array properties are not portable.', current);
                    return;
                }
                if (!isArray && descriptor.enumerable !== true) {
                    addIssue('protocol.object.non-enumerable', childPath, 'Non-enumerable properties are not portable.', current);
                    return;
                }
                if (typeof descriptor.get === 'function' || typeof descriptor.set === 'function') {
                    addIssue('protocol.object.accessor', childPath, 'Accessor properties cannot cross the protocol boundary.', current);
                    return;
                }
                if (key !== 'length') visit(descriptor.value, childPath);
            });
            if (Array.isArray(current)) {
                for (let index = 0; index < current.length; index++) {
                    if (!Object.prototype.hasOwnProperty.call(current, index)) {
                        addIssue('protocol.array.sparse', `${path}[${index}]`, 'Sparse arrays are not portable.', current);
                    }
                }
            }
        } finally {
            activeObjects.delete(current);
        }
    };

    visit(value, normalizedOptions.path);
    return Object.freeze({
        issues: Object.freeze(issues.slice()),
        schema: PROTOCOL_VALUE_SCHEMA,
        valid: issues.length === 0
    });
};

const assertProtocolValue = (value, options = {}) => {
    const result = validateProtocolValue(value, options);
    if (!result.valid) throw new ProtocolValueValidationError(result.issues);
    return value;
};

const cloneFrozenProtocolValue = value => {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
        return Object.freeze(value.map(cloneFrozenProtocolValue));
    }
    const cloned = Object.create(null);
    Object.keys(value).sort().forEach(key => {
        cloned[key] = cloneFrozenProtocolValue(value[key]);
    });
    return Object.freeze(cloned);
};

const cloneProtocolValue = (value, options = {}) => {
    assertProtocolValue(value, options);
    return cloneFrozenProtocolValue(value);
};

module.exports = {
    PROTOCOL_VALUE_SCHEMA,
    PROTOCOL_VALUE_VALIDATION_ERROR,
    ProtocolValueValidationError,
    assertProtocolValue,
    cloneProtocolValue,
    validateProtocolValue
};
