'use strict';

const {
    PROTOCOL_DTO_KINDS,
    createEngineEvent,
    createProtocolError,
    normalizeProtocolDTO
} = require('../../core/protocol');
const {assertRuntimeNodeMutationResult} = require('./runtime-node-model-service');
const {
    RUNTIME_NODE_COMMAND_EVENT_TYPES,
    RUNTIME_NODE_COMMAND_TYPES
} = require('./runtime-node-command-capability');

const RUNTIME_NODE_COMMAND_EXECUTOR_ID = 'ngvge.runtime-node-command-executor';
const RUNTIME_NODE_COMMAND_EXECUTOR_VERSION = 2;
const COMMAND_TYPES = new Set(Object.values(RUNTIME_NODE_COMMAND_TYPES));
const PAYLOAD_FIELDS = Object.freeze({
    [RUNTIME_NODE_COMMAND_TYPES.CREATE]: new Set(['options', 'typeId']),
    [RUNTIME_NODE_COMMAND_TYPES.DESTROY]: new Set(['nodeId']),
    [RUNTIME_NODE_COMMAND_TYPES.DUPLICATE]: new Set(['nodeId', 'options']),
    [RUNTIME_NODE_COMMAND_TYPES.PATCH]: new Set(['nodeId', 'patch']),
    [RUNTIME_NODE_COMMAND_TYPES.REPARENT]: new Set(['nodeId', 'options', 'parentId'])
});
const BACKEND_PAYLOAD_FIELDS = new Set([
    'bindingId', 'drawableId', 'skinId', 'target', 'targetId', 'targetRuntimeId'
]);

const normalizeString = value => (
    typeof value === 'string' && value.trim() ? value.trim() : null
);

const collectBackendPayloadFields = (value, path = '$', matches = []) => {
    if (!value || typeof value !== 'object') return matches;
    if (Array.isArray(value)) {
        value.forEach((entry, index) => collectBackendPayloadFields(entry, `${path}[${index}]`, matches));
        return matches;
    }
    Object.keys(value).forEach(key => {
        const fieldPath = `${path}.${key}`;
        if (BACKEND_PAYLOAD_FIELDS.has(key)) matches.push(fieldPath);
        collectBackendPayloadFields(value[key], fieldPath, matches);
    });
    return matches;
};

const createCommandError = (code, message, details = {}) => Object.assign(new Error(message), {code, ...details});

const assertPlainObject = (value, fieldName) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw createCommandError(
            'RUNTIME_NODE_COMMAND_PAYLOAD_INVALID',
            `${fieldName} must be a plain portable object.`
        );
    }
    return value;
};

const validatePayload = (type, payload) => {
    const normalized = assertPlainObject(payload, 'Runtime node command payload');
    const allowed = PAYLOAD_FIELDS[type];
    const leaked = collectBackendPayloadFields(normalized);
    if (leaked.length) {
        throw createCommandError(
            'RUNTIME_NODE_COMMAND_BACKEND_IDENTITY_FORBIDDEN',
            `Backend/compatibility identity must not cross the Runtime Node command boundary: ${leaked.join(', ')}`
        );
    }
    const unsupported = Object.keys(normalized).filter(key => !allowed.has(key));
    if (unsupported.length) {
        throw createCommandError(
            'RUNTIME_NODE_COMMAND_PAYLOAD_UNSUPPORTED',
            `Runtime node command payload contains unsupported field(s): ${unsupported.join(', ')}`
        );
    }
    return normalized;
};

const assertRuntimeNodeModel = runtimeNodeModel => {
    const required = ['createNode', 'destroyNode', 'duplicateNode', 'getNodeSnapshot', 'patchNode', 'setParent'];
    if (!runtimeNodeModel || required.some(method => typeof runtimeNodeModel[method] !== 'function')) {
        const error = new TypeError('Runtime Node command executor requires the Runtime Node Model capability.');
        error.code = 'NGVGE_RUNTIME_NODE_MODEL_CAPABILITY_REQUIRED';
        throw error;
    }
    return runtimeNodeModel;
};

const normalizeCompatibilityLifecycleAuthority = authority => {
    if (!authority) return null;
    const required = ['handlesCreateType', 'ownsNode', 'createNode', 'destroyNode', 'duplicateNode', 'patchNode', 'reparentNode'];
    if (required.some(method => typeof authority[method] !== 'function')) {
        const error = new TypeError('Runtime Node compatibility lifecycle authority is incomplete.');
        error.code = 'NGVGE_RUNTIME_NODE_COMPATIBILITY_LIFECYCLE_AUTHORITY_INVALID';
        throw error;
    }
    return authority;
};

const isThenable = value => Boolean(value) && typeof value.then === 'function';

const toProtocolFailure = (error, commandType, nodeId = null) => createProtocolError(
    error && error.code ? error.code : 'RUNTIME_NODE_COMMAND_FAILED',
    error && error.message ? error.message : String(error),
    {
        commandType,
        executorId: RUNTIME_NODE_COMMAND_EXECUTOR_ID,
        nodeId: normalizeString(nodeId)
    }
);

const createRuntimeNodeCommandExecutor = (runtimeNodeModel, options = {}) => {
    const model = assertRuntimeNodeModel(runtimeNodeModel);
    const compatibilityLifecycleAuthority = normalizeCompatibilityLifecycleAuthority(
        options.compatibilityLifecycleAuthority || null
    );
    let commandCount = 0;
    let compatibilityCommandCount = 0;
    let failureCount = 0;
    let lastError = null;

    const succeed = (commandType, eventPayload, compatibility = false) => {
        commandCount += 1;
        if (compatibility) compatibilityCommandCount += 1;
        lastError = null;
        return createEngineEvent(RUNTIME_NODE_COMMAND_EVENT_TYPES[commandType], eventPayload);
    };

    const fail = (error, commandType, nodeId = null) => {
        failureCount += 1;
        lastError = error && error.message ? error.message : String(error);
        return toProtocolFailure(error, commandType, nodeId);
    };

    const settleCompatibility = (commandType, nodeId, operation, toEventPayload) => {
        try {
            const value = operation();
            if (isThenable(value)) {
                return value.then(
                    result => succeed(commandType, toEventPayload(result), true),
                    error => fail(error, commandType, nodeId)
                );
            }
            return succeed(commandType, toEventPayload(value), true);
        } catch (error) {
            return fail(error, commandType, nodeId);
        }
    };

    const executeCommand = command => {
        let commandType = null;
        let nodeId = null;
        try {
            const normalized = normalizeProtocolDTO(command);
            if (normalized.kind !== PROTOCOL_DTO_KINDS.COMMAND || !COMMAND_TYPES.has(normalized.type)) {
                throw createCommandError(
                    'RUNTIME_NODE_COMMAND_UNSUPPORTED',
                    `Runtime Node command executor does not support command type: ${normalized.type || 'unknown'}`
                );
            }
            commandType = normalized.type;
            const payload = validatePayload(commandType, normalized.payload || {});
            let snapshot = null;
            let eventPayload = null;

            if (commandType === RUNTIME_NODE_COMMAND_TYPES.CREATE) {
                const typeId = normalizeString(payload.typeId);
                const createOptions = payload.options || {};
                if (!typeId) {
                    throw createCommandError('RUNTIME_NODE_COMMAND_TYPE_REQUIRED', 'CreateNode requires a stable typeId.');
                }
                assertPlainObject(createOptions, 'CreateNode options');
                if (compatibilityLifecycleAuthority && compatibilityLifecycleAuthority.handlesCreateType(typeId)) {
                    return settleCompatibility(
                        commandType,
                        null,
                        () => compatibilityLifecycleAuthority.createNode({options: createOptions, typeId}),
                        node => ({node, nodeId: node.id, typeId})
                    );
                }
                snapshot = assertRuntimeNodeMutationResult(model.createNode(typeId, createOptions));
                eventPayload = {node: snapshot, nodeId: snapshot.id, typeId};
            } else {
                nodeId = normalizeString(payload.nodeId);
                if (!nodeId) {
                    throw createCommandError(
                        'RUNTIME_NODE_COMMAND_NODE_ID_REQUIRED',
                        `${commandType} requires a stable NodeId.`
                    );
                }
                if (!model.getNodeSnapshot(nodeId)) {
                    throw createCommandError(
                        'RUNTIME_NODE_NOT_FOUND',
                        `Runtime node does not exist: ${nodeId}`,
                        {nodeId}
                    );
                }
                const compatibilityOwned = Boolean(
                    compatibilityLifecycleAuthority && compatibilityLifecycleAuthority.ownsNode(nodeId)
                );
                if (commandType === RUNTIME_NODE_COMMAND_TYPES.DESTROY) {
                    if (compatibilityOwned) {
                        return settleCompatibility(
                            commandType,
                            nodeId,
                            () => compatibilityLifecycleAuthority.destroyNode({nodeId}),
                            result => ({destroyed: Boolean(result && result.destroyed), nodeId})
                        );
                    }
                    const destroyed = assertRuntimeNodeMutationResult(model.destroyNode(nodeId));
                    eventPayload = {destroyed: Boolean(destroyed && destroyed.destroyed), nodeId};
                } else if (commandType === RUNTIME_NODE_COMMAND_TYPES.DUPLICATE) {
                    const duplicateOptions = payload.options || {};
                    assertPlainObject(duplicateOptions, 'DuplicateNode options');
                    if (compatibilityOwned) {
                        return settleCompatibility(
                            commandType,
                            nodeId,
                            () => compatibilityLifecycleAuthority.duplicateNode({nodeId, options: duplicateOptions}),
                            node => ({node, nodeId: node.id, sourceNodeId: nodeId})
                        );
                    }
                    snapshot = assertRuntimeNodeMutationResult(model.duplicateNode(nodeId, duplicateOptions));
                    eventPayload = {node: snapshot, nodeId: snapshot.id, sourceNodeId: nodeId};
                } else if (commandType === RUNTIME_NODE_COMMAND_TYPES.PATCH) {
                    const patch = assertPlainObject(payload.patch, 'PatchNode patch');
                    if (compatibilityOwned) {
                        return settleCompatibility(
                            commandType,
                            nodeId,
                            () => compatibilityLifecycleAuthority.patchNode({nodeId, patch}),
                            node => ({node, nodeId})
                        );
                    }
                    snapshot = assertRuntimeNodeMutationResult(model.patchNode(nodeId, patch));
                    eventPayload = {node: snapshot, nodeId};
                } else if (commandType === RUNTIME_NODE_COMMAND_TYPES.REPARENT) {
                    const parentId = normalizeString(payload.parentId);
                    if (!parentId) {
                        throw createCommandError(
                            'RUNTIME_NODE_COMMAND_PARENT_ID_REQUIRED',
                            'ReparentNode requires a stable parentId.',
                            {nodeId}
                        );
                    }
                    const setParentOptions = payload.options || {};
                    assertPlainObject(setParentOptions, 'ReparentNode options');
                    if (compatibilityOwned) {
                        return settleCompatibility(
                            commandType,
                            nodeId,
                            () => compatibilityLifecycleAuthority.reparentNode({
                                nodeId,
                                options: setParentOptions,
                                parentId
                            }),
                            node => ({node, nodeId, parentId})
                        );
                    }
                    snapshot = assertRuntimeNodeMutationResult(model.setParent(nodeId, parentId, setParentOptions));
                    eventPayload = {node: snapshot, nodeId, parentId};
                }
            }

            return succeed(commandType, eventPayload, false);
        } catch (error) {
            return fail(error, commandType, nodeId);
        }
    };

    return Object.freeze({
        executeCommand,
        getStatus: () => Object.freeze({
            commandCount,
            compatibilityCommandCount,
            compatibilityLifecycleAuthority: compatibilityLifecycleAuthority && (
                compatibilityLifecycleAuthority.authorityId || compatibilityLifecycleAuthority.bridgeId || 'compatibility'
            ),
            executorId: RUNTIME_NODE_COMMAND_EXECUTOR_ID,
            failureCount,
            lastError,
            version: RUNTIME_NODE_COMMAND_EXECUTOR_VERSION
        })
    });
};

module.exports = {
    RUNTIME_NODE_COMMAND_EXECUTOR_ID,
    RUNTIME_NODE_COMMAND_EXECUTOR_VERSION,
    createRuntimeNodeCommandExecutor
};
