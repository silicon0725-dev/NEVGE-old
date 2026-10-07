'use strict';

const {
    PROTOCOL_DTO_KINDS,
    createEngineCommand
} = require('../../core/protocol');

const RUNTIME_NODE_COMMAND_CAPABILITY_ID = 'ngvge.runtime-node-command';
const RUNTIME_NODE_COMMAND_CAPABILITY_VERSION = 1;

const RUNTIME_NODE_COMMAND_TYPES = Object.freeze({
    CREATE: 'CreateNode',
    DESTROY: 'DestroyNode',
    DUPLICATE: 'DuplicateNode',
    PATCH: 'PatchNode',
    REPARENT: 'ReparentNode'
});

const RUNTIME_NODE_COMMAND_EVENT_TYPES = Object.freeze({
    [RUNTIME_NODE_COMMAND_TYPES.CREATE]: 'NodeCreated',
    [RUNTIME_NODE_COMMAND_TYPES.DESTROY]: 'NodeDestroyed',
    [RUNTIME_NODE_COMMAND_TYPES.DUPLICATE]: 'NodeDuplicated',
    [RUNTIME_NODE_COMMAND_TYPES.PATCH]: 'NodePatched',
    [RUNTIME_NODE_COMMAND_TYPES.REPARENT]: 'NodeReparented'
});

const RUNTIME_NODE_COMMAND_CONTRACT = Object.freeze({
    capabilityId: RUNTIME_NODE_COMMAND_CAPABILITY_ID,
    contractId: 'ngvge.runtime-node-command-capability',
    contractVersion: '1',
    directRuntimeMutationFromEditor: false,
    protocolRequired: true,
    supportedCommands: Object.freeze(Object.values(RUNTIME_NODE_COMMAND_TYPES)),
    compatibilityLifecycleAuthoritySeam: true,
    executeCommandMayReturnPromise: true,
    genericCommandRouterImplemented: false,
    genericTransactionImplemented: false
});

const assertExecutor = executor => {
    if (!executor || typeof executor.executeCommand !== 'function') {
        const error = new TypeError('Runtime Node Command capability requires a command executor.');
        error.code = 'NGVGE_RUNTIME_NODE_COMMAND_EXECUTOR_REQUIRED';
        throw error;
    }
    return executor;
};

const createRuntimeNodeCommandCapability = executor => {
    const commandExecutor = assertExecutor(executor);
    return Object.freeze({
        capabilityId: RUNTIME_NODE_COMMAND_CAPABILITY_ID,
        contractId: RUNTIME_NODE_COMMAND_CONTRACT.contractId,
        version: RUNTIME_NODE_COMMAND_CAPABILITY_VERSION,
        executeCommand: command => commandExecutor.executeCommand(command),
        getStatus: () => (
            typeof commandExecutor.getStatus === 'function' ? commandExecutor.getStatus() : Object.freeze({})
        )
    });
};

const assertRuntimeNodeCommandCapability = capability => {
    if (!capability || capability.capabilityId !== RUNTIME_NODE_COMMAND_CAPABILITY_ID ||
        typeof capability.executeCommand !== 'function') {
        const error = new TypeError('Runtime Node Editor client requires the Runtime Node Command capability.');
        error.code = 'NGVGE_RUNTIME_NODE_COMMAND_CAPABILITY_REQUIRED';
        throw error;
    }
    return capability;
};

const createRuntimeNodeEditorClient = capability => {
    const commandCapability = assertRuntimeNodeCommandCapability(capability);
    return Object.freeze({
        createNode: ({typeId, options = {}}) => commandCapability.executeCommand(createEngineCommand(
            RUNTIME_NODE_COMMAND_TYPES.CREATE,
            {options, typeId}
        )),
        destroyNode: ({nodeId}) => commandCapability.executeCommand(createEngineCommand(
            RUNTIME_NODE_COMMAND_TYPES.DESTROY,
            {nodeId}
        )),
        duplicateNode: ({nodeId, options = {}}) => commandCapability.executeCommand(createEngineCommand(
            RUNTIME_NODE_COMMAND_TYPES.DUPLICATE,
            {nodeId, options}
        )),
        patchNode: ({nodeId, patch}) => commandCapability.executeCommand(createEngineCommand(
            RUNTIME_NODE_COMMAND_TYPES.PATCH,
            {nodeId, patch}
        )),
        reparentNode: ({nodeId, parentId, options = {}}) => commandCapability.executeCommand(createEngineCommand(
            RUNTIME_NODE_COMMAND_TYPES.REPARENT,
            {nodeId, options, parentId}
        ))
    });
};

const unwrapRuntimeNodeCommandResult = result => {
    if (result && result.kind === PROTOCOL_DTO_KINDS.EVENT) return result.payload;
    if (result && result.kind === PROTOCOL_DTO_KINDS.ERROR) {
        const error = new Error(result.message || result.code || 'Runtime node command failed.');
        error.code = result.code || 'RUNTIME_NODE_COMMAND_FAILED';
        error.details = result.details || null;
        error.protocolResult = result;
        throw error;
    }
    const error = new Error('Runtime node command returned an invalid protocol result.');
    error.code = 'NGVGE_RUNTIME_NODE_COMMAND_RESULT_INVALID';
    error.protocolResult = result || null;
    throw error;
};

const unwrapRuntimeNodeCommandResultAsync = result => Promise.resolve(result).then(unwrapRuntimeNodeCommandResult);

module.exports = {
    RUNTIME_NODE_COMMAND_CAPABILITY_ID,
    RUNTIME_NODE_COMMAND_CAPABILITY_VERSION,
    RUNTIME_NODE_COMMAND_CONTRACT,
    RUNTIME_NODE_COMMAND_EVENT_TYPES,
    RUNTIME_NODE_COMMAND_TYPES,
    createRuntimeNodeCommandCapability,
    createRuntimeNodeEditorClient,
    unwrapRuntimeNodeCommandResult,
    unwrapRuntimeNodeCommandResultAsync
};
