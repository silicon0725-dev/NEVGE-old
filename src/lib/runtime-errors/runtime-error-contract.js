const RUNTIME_ERROR_CONTRACT_ID = 'ngvge.runtime-error@1';
const MODULE_BOUNDARY_ERROR_NAME = 'ModuleBoundaryError';

const RUNTIME_ERROR_PUBLIC_FIELDS = Object.freeze([
    'name',
    'message',
    'code',
    'direction',
    'operation',
    'serviceId',
    'portableDetails'
]);

const RUNTIME_ERROR_LOCAL_DIAGNOSTIC_FIELDS = Object.freeze(['stack']);

const runtimeBoundaryErrors = new WeakSet();
const MAX_DETAIL_DEPTH = 4;
const MAX_DETAIL_KEYS = 32;
const MAX_DETAIL_STRING_LENGTH = 1024;

const isObjectLike = value => Boolean(value && (typeof value === 'object' || typeof value === 'function'));

const truncateString = value => {
    const text = String(value);
    if (text.length <= MAX_DETAIL_STRING_LENGTH) return text;
    return `${text.slice(0, MAX_DETAIL_STRING_LENGTH)}…`;
};

const safeDataProperty = (value, key) => {
    if (!isObjectLike(value)) return undefined;
    try {
        const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return undefined;
        return descriptor.value;
    } catch {
        return undefined;
    }
};

const sanitizePortableDiagnostic = (value, depth = 0, seen = new WeakSet()) => {
    if (value === null || value === undefined) return value === undefined ? '[undefined]' : null;
    if (typeof value === 'string') return truncateString(value);
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return `[number:${String(value)}]`;
        return Object.is(value, -0) ? 0 : value;
    }
    if (typeof value === 'boolean') return value;
    if (typeof value === 'bigint') return `${String(value)}n`;
    if (typeof value === 'symbol') return `[symbol:${truncateString(value.description || '')}]`;
    if (typeof value === 'function') return '[function]';
    if (depth >= MAX_DETAIL_DEPTH) return '[truncated]';
    if (seen.has(value)) return '[circular]';
    seen.add(value);

    let arrayValue = false;
    try {
        arrayValue = Array.isArray(value);
    } catch {
        arrayValue = false;
    }

    if (arrayValue) {
        let length = 0;
        try {
            const lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
            if (lengthDescriptor && Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value')) {
                length = Number.isSafeInteger(lengthDescriptor.value) && lengthDescriptor.value >= 0 ?
                    lengthDescriptor.value : 0;
            }
        } catch {
            return '[uninspectable-array]';
        }
        const result = [];
        const limit = Math.min(length, MAX_DETAIL_KEYS);
        for (let index = 0; index < limit; index++) {
            let descriptor;
            try {
                descriptor = Reflect.getOwnPropertyDescriptor(value, String(index));
            } catch {
                result.push('[uninspectable]');
                continue;
            }
            if (!descriptor) {
                result.push('[hole]');
            } else if (Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
                result.push(sanitizePortableDiagnostic(descriptor.value, depth + 1, seen));
            } else {
                result.push('[accessor]');
            }
        }
        if (length > MAX_DETAIL_KEYS) result.push('[truncated]');
        return result;
    }

    let keys;
    try {
        keys = Reflect.ownKeys(value).filter(key => typeof key === 'string').slice(0, MAX_DETAIL_KEYS);
    } catch {
        return '[uninspectable-object]';
    }

    const result = Object.create(null);
    keys.forEach(key => {
        let descriptor;
        try {
            descriptor = Reflect.getOwnPropertyDescriptor(value, key);
        } catch {
            return;
        }
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return;
        Reflect.defineProperty(result, key, {
            configurable: true,
            enumerable: true,
            value: sanitizePortableDiagnostic(descriptor.value, depth + 1, seen),
            writable: true
        });
    });
    return result;
};

const deepFreezePortable = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Reflect.ownKeys(value).forEach(key => {
        const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
        if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
            deepFreezePortable(descriptor.value);
        }
    });
    return Object.freeze(value);
};

const describeThrownValue = thrown => {
    const details = Object.create(null);
    details.thrownType = thrown === null ? 'null' : typeof thrown;
    if (thrown === null || thrown === undefined) {
        details.value = thrown === undefined ? '[undefined]' : null;
        return deepFreezePortable(details);
    }
    if (!isObjectLike(thrown)) {
        details.value = sanitizePortableDiagnostic(thrown);
        return deepFreezePortable(details);
    }

    const remoteName = safeDataProperty(thrown, 'name');
    const remoteMessage = safeDataProperty(thrown, 'message');
    const remoteCode = safeDataProperty(thrown, 'code');
    const portableDetails = safeDataProperty(thrown, 'portableDetails');
    if (typeof remoteName === 'string') details.remoteName = truncateString(remoteName);
    if (typeof remoteMessage === 'string') details.remoteMessage = truncateString(remoteMessage);
    if (typeof remoteCode === 'string' || typeof remoteCode === 'number') {
        details.remoteCode = sanitizePortableDiagnostic(remoteCode);
    }
    if (portableDetails !== undefined) {
        details.details = sanitizePortableDiagnostic(portableDetails);
    }
    return deepFreezePortable(details);
};

const normalizeOptionalString = value => value === undefined || value === null ? null : String(value);

const createRuntimeBoundaryError = ({
    code,
    direction = null,
    message,
    name = MODULE_BOUNDARY_ERROR_NAME,
    operation = null,
    portableDetails,
    serviceId = null,
    thrown
}) => {
    const normalizedCode = String(code || 'RUNTIME_BOUNDARY_OPERATION_FAILED');
    const normalizedOperation = normalizeOptionalString(operation);
    const normalizedServiceId = normalizeOptionalString(serviceId);
    const normalizedDirection = normalizeOptionalString(direction);
    const normalizedMessage = message === undefined ?
        `Runtime boundary operation "${normalizedOperation || 'unknown'}" failed.` : String(message);
    const details = portableDetails === undefined ? describeThrownValue(thrown) :
        deepFreezePortable(sanitizePortableDiagnostic(portableDetails));

    const error = new Error(normalizedMessage);
    Object.defineProperties(error, {
        code: {configurable: false, enumerable: true, value: normalizedCode, writable: false},
        direction: {configurable: false, enumerable: true, value: normalizedDirection, writable: false},
        name: {configurable: false, enumerable: true, value: String(name), writable: false},
        operation: {configurable: false, enumerable: true, value: normalizedOperation, writable: false},
        portableDetails: {
            configurable: false,
            enumerable: true,
            value: details,
            writable: false
        },
        serviceId: {configurable: false, enumerable: true, value: normalizedServiceId, writable: false}
    });
    runtimeBoundaryErrors.add(error);
    return Object.freeze(error);
};

const isRuntimeBoundaryError = value => isObjectLike(value) && runtimeBoundaryErrors.has(value);

const assertRuntimeBoundaryError = error => {
    if (!isRuntimeBoundaryError(error)) {
        const contractError = new TypeError('Expected a runtime-created boundary error.');
        contractError.code = 'RUNTIME_ERROR_CONTRACT_INVALID_ERROR';
        throw contractError;
    }
};

const toRuntimeErrorPublicRecord = error => {
    assertRuntimeBoundaryError(error);
    const record = Object.create(null);
    const values = {
        name: String(error.name),
        message: String(error.message),
        code: String(error.code),
        direction: normalizeOptionalString(error.direction),
        operation: normalizeOptionalString(error.operation),
        serviceId: normalizeOptionalString(error.serviceId),
        portableDetails: error.portableDetails
    };
    RUNTIME_ERROR_PUBLIC_FIELDS.forEach(key => {
        Reflect.defineProperty(record, key, {
            configurable: false,
            enumerable: true,
            value: values[key],
            writable: false
        });
    });
    return Object.freeze(record);
};

const getRuntimeErrorLocalDiagnostics = error => {
    assertRuntimeBoundaryError(error);
    let stack = null;
    try {
        if (typeof error.stack === 'string') stack = error.stack;
    } catch {
        stack = null;
    }
    return Object.freeze({stack});
};

module.exports = {
    MODULE_BOUNDARY_ERROR_NAME,
    RUNTIME_ERROR_CONTRACT_ID,
    RUNTIME_ERROR_LOCAL_DIAGNOSTIC_FIELDS,
    RUNTIME_ERROR_PUBLIC_FIELDS,
    createRuntimeBoundaryError,
    describeThrownValue,
    getRuntimeErrorLocalDiagnostics,
    isRuntimeBoundaryError,
    sanitizePortableDiagnostic,
    toRuntimeErrorPublicRecord
};
