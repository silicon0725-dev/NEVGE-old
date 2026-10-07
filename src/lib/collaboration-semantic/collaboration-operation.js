/* eslint-disable import/no-commonjs, strict */
'use strict';

const {cloneProtocolValue} = require('../../core/protocol/portable-value');
const {
    COLLABORATION_OPERATION_ORIGINS,
    COLLABORATION_OPERATION_SCHEMA,
    COLLABORATION_OPERATION_TYPES
} = require('./constants');

const FORBIDDEN_BACKEND_KEYS = new Set([
    'bindingId',
    'extensionManager',
    'renderer',
    'rendererId',
    'sprite',
    'target',
    'targetId',
    'targetRuntimeId',
    'vm'
]);
const OPERATION_TYPES = new Set(Object.values(COLLABORATION_OPERATION_TYPES));
const OPERATION_ORIGINS = new Set(Object.values(COLLABORATION_OPERATION_ORIGINS));

const assertNoBackendIdentity = (value, path = '$') => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
        value.forEach((item, index) => assertNoBackendIdentity(item, `${path}[${index}]`));
        return;
    }
    Object.keys(value).forEach(key => {
        if (FORBIDDEN_BACKEND_KEYS.has(key)) {
            const error = new TypeError(
                `Collaboration semantic DTO cannot contain backend identity field "${key}" at ${path}.`
            );
            error.code = 'NGVGE_COLLABORATION_BACKEND_IDENTITY_FORBIDDEN';
            error.field = key;
            error.path = path;
            throw error;
        }
        assertNoBackendIdentity(value[key], `${path}.${key}`);
    });
};

const assertString = (value, field) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized) {
        const error = new TypeError(`Collaboration operation ${field} must be a non-empty string.`);
        error.code = 'NGVGE_COLLABORATION_OPERATION_FIELD_INVALID';
        error.field = field;
        throw error;
    }
    return normalized;
};

const assertPayload = (type, payload) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new TypeError('Collaboration operation payload must be a plain object.');
    }
    if (type === COLLABORATION_OPERATION_TYPES.NODE_DESTROY ||
        type === COLLABORATION_OPERATION_TYPES.NODE_RENAME ||
        type === COLLABORATION_OPERATION_TYPES.NODE_TRANSFORM_PATCH) {
        assertString(payload.nodeId, 'payload.nodeId');
    }
    if (type === COLLABORATION_OPERATION_TYPES.NODE_RENAME) assertString(payload.name, 'payload.name');
    if (type === COLLABORATION_OPERATION_TYPES.NODE_TRANSFORM_PATCH &&
        (!payload.patch || typeof payload.patch !== 'object' || Array.isArray(payload.patch))) {
        throw new TypeError('NodeTransformPatch requires a patch object.');
    }
    if (type === COLLABORATION_OPERATION_TYPES.EXTENSION_LOAD ||
        type === COLLABORATION_OPERATION_TYPES.EXTENSION_UNLOAD ||
        type === COLLABORATION_OPERATION_TYPES.EXTENSION_REORDER) {
        assertString(payload.extensionId, 'payload.extensionId');
    }
    if (type === COLLABORATION_OPERATION_TYPES.EXTENSION_REORDER && !Number.isInteger(payload.index)) {
        throw new TypeError('ExtensionReorder requires an integer index.');
    }
};

const createCollaborationOperation = (type, payload, metadata = {}) => {
    if (!OPERATION_TYPES.has(type)) {
        const error = new TypeError(`Unsupported collaboration semantic operation: ${String(type)}`);
        error.code = 'NGVGE_COLLABORATION_OPERATION_TYPE_UNSUPPORTED';
        throw error;
    }
    const origin = metadata.origin || COLLABORATION_OPERATION_ORIGINS.LOCAL;
    if (!OPERATION_ORIGINS.has(origin)) {
        throw new TypeError(`Invalid collaboration operation origin: ${String(origin)}`);
    }
    assertPayload(type, payload);
    const portable = {
        operationId: typeof metadata.operationId === 'string' && metadata.operationId.trim() ?
            metadata.operationId.trim() : `collab:${Date.now()}:${Math.random().toString(36)
                .slice(2)}`,
        origin,
        payload,
        schema: COLLABORATION_OPERATION_SCHEMA,
        type
    };
    if (typeof metadata.senderId === 'string' && metadata.senderId.trim()) portable.senderId = metadata.senderId.trim();
    assertNoBackendIdentity(portable);
    return cloneProtocolValue(portable, {path: '$'});
};

const assertCollaborationOperation = operation => {
    if (!operation || operation.schema !== COLLABORATION_OPERATION_SCHEMA || !OPERATION_TYPES.has(operation.type)) {
        const error = new TypeError('Invalid collaboration semantic operation DTO.');
        error.code = 'NGVGE_COLLABORATION_OPERATION_INVALID';
        throw error;
    }
    assertPayload(operation.type, operation.payload);
    assertNoBackendIdentity(operation);
    return cloneProtocolValue(operation, {path: '$'});
};

module.exports = {
    FORBIDDEN_BACKEND_KEYS,
    assertCollaborationOperation,
    assertNoBackendIdentity,
    createCollaborationOperation
};
