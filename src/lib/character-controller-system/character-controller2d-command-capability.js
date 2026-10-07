'use strict';

const {
    CHARACTER_CONTROLLER2D_PATCH_APPLIED_EVENT_TYPE,
    CHARACTER_CONTROLLER2D_PATCH_COMMAND_TYPE,
    CHARACTER_CONTROLLER2D_TYPE_ID,
    createCharacterController2DPatchComponentCommand,
    normalizeCharacterController2DPatch
} = require('../../core/character-controller2d');
const {
    PROTOCOL_DTO_KINDS,
    createEngineEvent,
    createProtocolError,
    normalizeProtocolDTO
} = require('../../core/protocol');

const CHARACTER_CONTROLLER2D_COMMAND_CAPABILITY_ID = 'ngvge.character-controller2d-command';
const CHARACTER_CONTROLLER2D_COMMAND_CAPABILITY_VERSION = 1;

const getControllerComponent = (runtimeNodeModel, nodeId) => {
    const node = runtimeNodeModel.getNodeSnapshot(nodeId);
    const components = node && Array.isArray(node.components) ? node.components : [];
    return components.find(component => component && component.typeId === CHARACTER_CONTROLLER2D_TYPE_ID) || null;
};

const createCharacterController2DCommandExecutor = (runtimeNodeModel, characterRuntimeService) => {
    if (!runtimeNodeModel || typeof runtimeNodeModel.getNodeSnapshot !== 'function') {
        throw new TypeError('CharacterController2D Command executor requires Runtime Node Model capability.');
    }
    if (!characterRuntimeService || typeof characterRuntimeService.patchPersistentController !== 'function') {
        throw new TypeError('CharacterController2D Command executor requires CharacterController2D Runtime Service.');
    }
    let commandCount = 0;
    let failureCount = 0;
    return Object.freeze({
        executeCommand: command => {
            try {
                const normalized = normalizeProtocolDTO(command);
                if (normalized.kind !== PROTOCOL_DTO_KINDS.COMMAND ||
                    normalized.type !== CHARACTER_CONTROLLER2D_PATCH_COMMAND_TYPE) {
                    throw Object.assign(new Error(
                        `CharacterController2D only accepts ${CHARACTER_CONTROLLER2D_PATCH_COMMAND_TYPE}.`
                    ), {code: 'NGVGE_CHARACTER_CONTROLLER2D_COMMAND_UNSUPPORTED'});
                }
                const payload = normalized.payload || {};
                const nodeId = typeof payload.nodeId === 'string' ? payload.nodeId.trim() : '';
                const componentId = typeof payload.componentId === 'string' ? payload.componentId.trim() : '';
                const component = getControllerComponent(runtimeNodeModel, nodeId);
                if (!nodeId || !component || component.id !== componentId) {
                    throw Object.assign(new Error(
                        'CharacterController2D command target does not match a semantic CharacterController2D component.'
                    ), {code: 'NGVGE_CHARACTER_CONTROLLER2D_COMMAND_TARGET_INVALID'});
                }
                const patch = normalizeCharacterController2DPatch(payload.patch);
                const controller = characterRuntimeService.patchPersistentController(nodeId, patch, {
                    transactionId: `character-controller2d:editor-patch:${nodeId}`
                });
                commandCount += 1;
                return createEngineEvent(CHARACTER_CONTROLLER2D_PATCH_APPLIED_EVENT_TYPE, {
                    componentId,
                    controller,
                    nodeId,
                    requestedPatch: patch
                });
            } catch (error) {
                failureCount += 1;
                return createProtocolError(
                    error && error.code ? error.code : 'NGVGE_CHARACTER_CONTROLLER2D_COMMAND_FAILED',
                    error && error.message ? error.message : String(error),
                    {capabilityId: CHARACTER_CONTROLLER2D_COMMAND_CAPABILITY_ID}
                );
            }
        },
        getStatus: () => Object.freeze({commandCount, failureCount})
    });
};

const createCharacterController2DCommandCapability = executor => {
    if (!executor || typeof executor.executeCommand !== 'function') {
        throw new TypeError('CharacterController2D Command capability requires an executor.');
    }
    return Object.freeze({
        capabilityId: CHARACTER_CONTROLLER2D_COMMAND_CAPABILITY_ID,
        version: CHARACTER_CONTROLLER2D_COMMAND_CAPABILITY_VERSION,
        executeCommand: command => executor.executeCommand(command),
        getStatus: () => executor.getStatus()
    });
};

const createCharacterController2DEditorClient = capability => {
    if (!capability || capability.capabilityId !== CHARACTER_CONTROLLER2D_COMMAND_CAPABILITY_ID ||
        typeof capability.executeCommand !== 'function') {
        throw new TypeError('CharacterController2D Editor client requires CharacterController2D Command capability.');
    }
    return Object.freeze({
        patchComponent: input => capability.executeCommand(createCharacterController2DPatchComponentCommand(input))
    });
};

module.exports = {
    CHARACTER_CONTROLLER2D_COMMAND_CAPABILITY_ID,
    CHARACTER_CONTROLLER2D_COMMAND_CAPABILITY_VERSION,
    createCharacterController2DCommandCapability,
    createCharacterController2DCommandExecutor,
    createCharacterController2DEditorClient
};
