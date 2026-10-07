'use strict';

const {
    COLLIDER2D_PATCH_APPLIED_EVENT_TYPE,
    COLLIDER2D_PATCH_COMMAND_TYPE,
    COLLIDER2D_TYPE_ID,
    createCollider2DPatchComponentCommand,
    normalizeCollider2DPatch
} = require('../../core/collider2d');
const {
    PROTOCOL_DTO_KINDS,
    createEngineEvent,
    createProtocolError,
    normalizeProtocolDTO
} = require('../../core/protocol');

const COLLIDER2D_COMMAND_CAPABILITY_ID = 'ngvge.collider2d-command';
const COLLIDER2D_COMMAND_CAPABILITY_VERSION = 1;

const getColliderComponent = (runtimeNodeModel, nodeId) => {
    const node = runtimeNodeModel.getNodeSnapshot(nodeId);
    const components = node && Array.isArray(node.components) ? node.components : [];
    return components.find(component => component && component.typeId === COLLIDER2D_TYPE_ID) || null;
};

const createCollider2DCommandExecutor = (runtimeNodeModel, colliderRuntimeService) => {
    if (!runtimeNodeModel || typeof runtimeNodeModel.getNodeSnapshot !== 'function') {
        throw new TypeError('Collider2D Command executor requires Runtime Node Model capability.');
    }
    if (!colliderRuntimeService || typeof colliderRuntimeService.patchPersistentCollider !== 'function') {
        throw new TypeError('Collider2D Command executor requires Collider2D Runtime Service.');
    }
    let commandCount = 0;
    let failureCount = 0;
    return Object.freeze({
        executeCommand: command => {
            try {
                const normalized = normalizeProtocolDTO(command);
                if (normalized.kind !== PROTOCOL_DTO_KINDS.COMMAND || normalized.type !== COLLIDER2D_PATCH_COMMAND_TYPE) {
                    throw Object.assign(new Error(`Collider2D only accepts ${COLLIDER2D_PATCH_COMMAND_TYPE}.`), {
                        code: 'NGVGE_COLLIDER2D_COMMAND_UNSUPPORTED'
                    });
                }
                const payload = normalized.payload || {};
                const nodeId = typeof payload.nodeId === 'string' ? payload.nodeId.trim() : '';
                const componentId = typeof payload.componentId === 'string' ? payload.componentId.trim() : '';
                const component = getColliderComponent(runtimeNodeModel, nodeId);
                if (!nodeId || !component || component.id !== componentId) {
                    throw Object.assign(new Error('Collider2D command target does not match a semantic Collider2D component.'), {
                        code: 'NGVGE_COLLIDER2D_COMMAND_TARGET_INVALID'
                    });
                }
                const patch = normalizeCollider2DPatch(payload.patch);
                const collider = colliderRuntimeService.patchPersistentCollider(nodeId, patch, {
                    transactionId: `collider2d:editor-patch:${nodeId}`
                });
                commandCount += 1;
                return createEngineEvent(COLLIDER2D_PATCH_APPLIED_EVENT_TYPE, {
                    collider,
                    componentId,
                    nodeId,
                    requestedPatch: patch
                });
            } catch (error) {
                failureCount += 1;
                return createProtocolError(
                    error && error.code ? error.code : 'NGVGE_COLLIDER2D_COMMAND_FAILED',
                    error && error.message ? error.message : String(error),
                    {capabilityId: COLLIDER2D_COMMAND_CAPABILITY_ID}
                );
            }
        },
        getStatus: () => Object.freeze({commandCount, failureCount})
    });
};

const createCollider2DCommandCapability = executor => {
    if (!executor || typeof executor.executeCommand !== 'function') {
        throw new TypeError('Collider2D Command capability requires an executor.');
    }
    return Object.freeze({
        capabilityId: COLLIDER2D_COMMAND_CAPABILITY_ID,
        version: COLLIDER2D_COMMAND_CAPABILITY_VERSION,
        executeCommand: command => executor.executeCommand(command),
        getStatus: () => executor.getStatus()
    });
};

const createCollider2DEditorClient = capability => {
    if (!capability || capability.capabilityId !== COLLIDER2D_COMMAND_CAPABILITY_ID ||
        typeof capability.executeCommand !== 'function') {
        throw new TypeError('Collider2D Editor client requires Collider2D Command capability.');
    }
    return Object.freeze({
        patchComponent: input => capability.executeCommand(createCollider2DPatchComponentCommand(input))
    });
};

module.exports = {
    COLLIDER2D_COMMAND_CAPABILITY_ID,
    COLLIDER2D_COMMAND_CAPABILITY_VERSION,
    createCollider2DCommandCapability,
    createCollider2DCommandExecutor,
    createCollider2DEditorClient
};
