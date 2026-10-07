'use strict';

const {
    TRANSFORM2D_PATCH_COMMAND_TYPE,
    TRANSFORM2D_SCRATCH_AUTHORITY_ID,
    createTransform2DPatchComponentCommand
} = require('../../core/transform2d');

const TRANSFORM2D_COMMAND_CAPABILITY_ID = 'ngvge.transform2d-command';
const TRANSFORM2D_COMMAND_CAPABILITY_VERSION = 1;

const TRANSFORM2D_COMMAND_CONTRACT = Object.freeze({
    capabilityId: TRANSFORM2D_COMMAND_CAPABILITY_ID,
    contractId: 'ngvge.transform2d-command-capability',
    contractVersion: '1',
    editorIntent: Object.freeze({
        commandType: TRANSFORM2D_PATCH_COMMAND_TYPE,
        directBackendMutation: false,
        protocolRequired: true
    }),
    currentAuthority: Object.freeze({
        authorityId: TRANSFORM2D_SCRATCH_AUTHORITY_ID,
        authorityReversalImplemented: false,
        bridgeImplementationReplaceable: true
    })
});

const assertExecutor = executor => {
    if (!executor || typeof executor.executeCommand !== 'function') {
        const error = new TypeError('Transform2D Command capability requires a command executor.');
        error.code = 'NGVGE_TRANSFORM2D_COMMAND_EXECUTOR_REQUIRED';
        throw error;
    }
    return executor;
};

const createTransform2DCommandCapability = executor => {
    const commandExecutor = assertExecutor(executor);
    return Object.freeze({
        capabilityId: TRANSFORM2D_COMMAND_CAPABILITY_ID,
        version: TRANSFORM2D_COMMAND_CAPABILITY_VERSION,
        executeCommand: (command, options = {}) => commandExecutor.executeCommand(command, options),
        getStatus: () => (
            typeof commandExecutor.getStatus === 'function' ? commandExecutor.getStatus() : Object.freeze({})
        )
    });
};

const createTransform2DEditorClient = capability => {
    if (!capability || capability.capabilityId !== TRANSFORM2D_COMMAND_CAPABILITY_ID ||
        typeof capability.executeCommand !== 'function') {
        const error = new TypeError('Transform2D Editor client requires the Transform2D Command capability.');
        error.code = 'NGVGE_TRANSFORM2D_COMMAND_CAPABILITY_REQUIRED';
        throw error;
    }
    return Object.freeze({
        patchComponent: input => capability.executeCommand(createTransform2DPatchComponentCommand(input))
    });
};

module.exports = {
    TRANSFORM2D_COMMAND_CAPABILITY_ID,
    TRANSFORM2D_COMMAND_CAPABILITY_VERSION,
    TRANSFORM2D_COMMAND_CONTRACT,
    createTransform2DCommandCapability,
    createTransform2DEditorClient
};
