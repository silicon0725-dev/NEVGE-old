'use strict';

const {
    CAMERA2D_PATCH_APPLIED_EVENT_TYPE,
    CAMERA2D_PATCH_COMMAND_TYPE,
    CAMERA2D_TYPE_ID,
    createCamera2DPatchComponentCommand,
    normalizeCamera2DPatch
} = require('../../core/camera2d');
const {
    PROTOCOL_DTO_KINDS,
    createEngineEvent,
    createProtocolError,
    normalizeProtocolDTO
} = require('../../core/protocol');

const CAMERA2D_COMMAND_CAPABILITY_ID = 'ngvge.camera2d-command';
const CAMERA2D_COMMAND_CAPABILITY_VERSION = 1;

const getCameraComponent = (runtimeNodeModel, nodeId) => {
    const node = runtimeNodeModel.getNodeSnapshot(nodeId);
    const components = node && Array.isArray(node.components) ? node.components : [];
    return components.find(component => component && component.typeId === CAMERA2D_TYPE_ID) || null;
};

const createCamera2DCommandExecutor = (runtimeNodeModel, cameraRuntimeService) => {
    if (!runtimeNodeModel || typeof runtimeNodeModel.getNodeSnapshot !== 'function') {
        throw new TypeError('Camera2D Command executor requires Runtime Node Model capability.');
    }
    if (!cameraRuntimeService || typeof cameraRuntimeService.patchPersistentCamera !== 'function') {
        throw new TypeError('Camera2D Command executor requires Camera2D Runtime Service.');
    }
    let commandCount = 0;
    let failureCount = 0;
    return Object.freeze({
        executeCommand: command => {
            try {
                const normalized = normalizeProtocolDTO(command);
                if (normalized.kind !== PROTOCOL_DTO_KINDS.COMMAND || normalized.type !== CAMERA2D_PATCH_COMMAND_TYPE) {
                    throw Object.assign(new Error(`Camera2D only accepts ${CAMERA2D_PATCH_COMMAND_TYPE}.`), {
                        code: 'NGVGE_CAMERA2D_COMMAND_UNSUPPORTED'
                    });
                }
                const payload = normalized.payload || {};
                const nodeId = typeof payload.nodeId === 'string' ? payload.nodeId.trim() : '';
                const componentId = typeof payload.componentId === 'string' ? payload.componentId.trim() : '';
                const component = getCameraComponent(runtimeNodeModel, nodeId);
                if (!nodeId || !component || component.id !== componentId) {
                    throw Object.assign(new Error('Camera2D command target does not match a semantic Camera2D component.'), {
                        code: 'NGVGE_CAMERA2D_COMMAND_TARGET_INVALID'
                    });
                }
                const patch = normalizeCamera2DPatch(payload.patch);
                const camera = cameraRuntimeService.patchPersistentCamera(nodeId, patch, {
                    transactionId: `camera2d:editor-patch:${nodeId}`
                });
                commandCount += 1;
                return createEngineEvent(CAMERA2D_PATCH_APPLIED_EVENT_TYPE, {
                    camera,
                    componentId,
                    nodeId,
                    requestedPatch: patch
                });
            } catch (error) {
                failureCount += 1;
                return createProtocolError(
                    error && error.code ? error.code : 'NGVGE_CAMERA2D_COMMAND_FAILED',
                    error && error.message ? error.message : String(error),
                    {capabilityId: CAMERA2D_COMMAND_CAPABILITY_ID}
                );
            }
        },
        getStatus: () => Object.freeze({commandCount, failureCount})
    });
};

const createCamera2DCommandCapability = executor => {
    if (!executor || typeof executor.executeCommand !== 'function') {
        throw new TypeError('Camera2D Command capability requires an executor.');
    }
    return Object.freeze({
        capabilityId: CAMERA2D_COMMAND_CAPABILITY_ID,
        version: CAMERA2D_COMMAND_CAPABILITY_VERSION,
        executeCommand: command => executor.executeCommand(command),
        getStatus: () => executor.getStatus()
    });
};

const createCamera2DEditorClient = capability => {
    if (!capability || capability.capabilityId !== CAMERA2D_COMMAND_CAPABILITY_ID ||
        typeof capability.executeCommand !== 'function') {
        throw new TypeError('Camera2D Editor client requires Camera2D Command capability.');
    }
    return Object.freeze({
        patchComponent: input => capability.executeCommand(createCamera2DPatchComponentCommand(input))
    });
};

module.exports = {
    CAMERA2D_COMMAND_CAPABILITY_ID,
    CAMERA2D_COMMAND_CAPABILITY_VERSION,
    createCamera2DCommandCapability,
    createCamera2DCommandExecutor,
    createCamera2DEditorClient
};
