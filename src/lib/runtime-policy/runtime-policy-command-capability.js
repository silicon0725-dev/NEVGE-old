/* eslint-disable import/no-commonjs, strict */
'use strict';

const {
    PROTOCOL_DTO_KINDS,
    createEngineCommand
} = require('../../core/protocol');
const {
    RUNTIME_POLICY_COMMAND_CAPABILITY_ID,
    RUNTIME_POLICY_COMMAND_CAPABILITY_VERSION
} = require('./constants');

const RUNTIME_POLICY_COMMAND_TYPES = Object.freeze({
    APPLY_PROFILE: 'ApplyRuntimePolicyProfile',
    PATCH_DOMAIN: 'PatchRuntimePolicyDomain'
});

const RUNTIME_POLICY_COMMAND_EVENT_TYPES = Object.freeze({
    [RUNTIME_POLICY_COMMAND_TYPES.APPLY_PROFILE]: 'RuntimePolicyProfileApplied',
    [RUNTIME_POLICY_COMMAND_TYPES.PATCH_DOMAIN]: 'RuntimePolicyDomainPatched'
});

const RUNTIME_POLICY_COMMAND_CONTRACT = Object.freeze({
    capabilityId: RUNTIME_POLICY_COMMAND_CAPABILITY_ID,
    contractId: 'ngvge.runtime-policy-command-capability',
    contractVersion: '1',
    directBackendMutationFromEditor: false,
    editorSuppliesAuthorityId: false,
    protocolRequired: true,
    supportedCommands: Object.freeze(Object.values(RUNTIME_POLICY_COMMAND_TYPES))
});

const assertExecutor = executor => {
    if (!executor || typeof executor.executeCommand !== 'function' || typeof executor.getSnapshot !== 'function') {
        const error = new TypeError('Runtime Policy Command capability requires a command executor.');
        error.code = 'NGVGE_RUNTIME_POLICY_COMMAND_EXECUTOR_REQUIRED';
        throw error;
    }
    return executor;
};

const createRuntimePolicyCommandCapability = executor => {
    const commandExecutor = assertExecutor(executor);
    return Object.freeze({
        capabilityId: RUNTIME_POLICY_COMMAND_CAPABILITY_ID,
        contractId: RUNTIME_POLICY_COMMAND_CONTRACT.contractId,
        executeCommand: command => commandExecutor.executeCommand(command),
        getSnapshot: () => commandExecutor.getSnapshot(),
        getStatus: () => (
            typeof commandExecutor.getStatus === 'function' ? commandExecutor.getStatus() : Object.freeze({})
        ),
        subscribe: listener => (
            typeof commandExecutor.subscribe === 'function' ? commandExecutor.subscribe(listener) : (() => {})
        ),
        version: RUNTIME_POLICY_COMMAND_CAPABILITY_VERSION
    });
};

const assertRuntimePolicyCommandCapability = capability => {
    if (!capability || capability.capabilityId !== RUNTIME_POLICY_COMMAND_CAPABILITY_ID ||
        typeof capability.executeCommand !== 'function' || typeof capability.getSnapshot !== 'function') {
        const error = new TypeError('Runtime Policy Editor client requires the Runtime Policy Command capability.');
        error.code = 'NGVGE_RUNTIME_POLICY_COMMAND_CAPABILITY_REQUIRED';
        throw error;
    }
    return capability;
};

const createRuntimePolicyEditorClient = capability => {
    const commandCapability = assertRuntimePolicyCommandCapability(capability);
    return Object.freeze({
        applyProfile: profileId => commandCapability.executeCommand(createEngineCommand(
            RUNTIME_POLICY_COMMAND_TYPES.APPLY_PROFILE,
            {profileId}
        )),
        getSnapshot: () => commandCapability.getSnapshot(),
        patchDomain: (domain, patch) => commandCapability.executeCommand(createEngineCommand(
            RUNTIME_POLICY_COMMAND_TYPES.PATCH_DOMAIN,
            {domain, patch}
        )),
        subscribe: listener => commandCapability.subscribe(listener)
    });
};

const unwrapRuntimePolicyCommandResult = result => {
    if (result && result.kind === PROTOCOL_DTO_KINDS.EVENT) return result.payload;
    if (result && result.kind === PROTOCOL_DTO_KINDS.ERROR) {
        const error = new Error(result.message || result.code || 'Runtime Policy command failed.');
        error.code = result.code || 'RUNTIME_POLICY_COMMAND_FAILED';
        error.details = result.details || null;
        error.protocolResult = result;
        throw error;
    }
    const error = new Error('Runtime Policy command returned an invalid protocol result.');
    error.code = 'NGVGE_RUNTIME_POLICY_COMMAND_RESULT_INVALID';
    error.protocolResult = result || null;
    throw error;
};

const unwrapRuntimePolicyCommandResultAsync = result => Promise.resolve(result).then(unwrapRuntimePolicyCommandResult);

module.exports = {
    RUNTIME_POLICY_COMMAND_CONTRACT,
    RUNTIME_POLICY_COMMAND_EVENT_TYPES,
    RUNTIME_POLICY_COMMAND_TYPES,
    assertRuntimePolicyCommandCapability,
    createRuntimePolicyCommandCapability,
    createRuntimePolicyEditorClient,
    unwrapRuntimePolicyCommandResult,
    unwrapRuntimePolicyCommandResultAsync
};
