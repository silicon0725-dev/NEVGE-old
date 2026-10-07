'use strict';

const {
    RIGIDBODY2D_PATCH_APPLIED_EVENT_TYPE,
    RIGIDBODY2D_PATCH_COMMAND_TYPE,
    RIGIDBODY2D_TYPE_ID,
    createRigidBody2DPatchComponentCommand,
    normalizeRigidBody2DPatch
} = require('../../core/rigidbody2d');
const {PROTOCOL_DTO_KINDS, createEngineEvent, createProtocolError, normalizeProtocolDTO} = require('../../core/protocol');

const RIGIDBODY2D_COMMAND_CAPABILITY_ID = 'ngvge.rigidbody2d-command';
const RIGIDBODY2D_COMMAND_CAPABILITY_VERSION = 1;
const getComponent = (runtimeNodeModel, nodeId) => {
    const node = runtimeNodeModel.getNodeSnapshot(nodeId);
    const components = node && Array.isArray(node.components) ? node.components : [];
    return components.find(component => component && component.typeId === RIGIDBODY2D_TYPE_ID) || null;
};
const createRigidBody2DCommandExecutor = (runtimeNodeModel, physicsRuntimeService) => {
    if (!runtimeNodeModel || typeof runtimeNodeModel.getNodeSnapshot !== 'function') throw new TypeError('RigidBody2D Command executor requires Runtime Node Model.');
    if (!physicsRuntimeService || typeof physicsRuntimeService.patchPersistentRigidBody !== 'function') throw new TypeError('RigidBody2D Command executor requires Physics2D Runtime Service.');
    let commandCount = 0;
    let failureCount = 0;
    return Object.freeze({
        executeCommand: command => {
            try {
                const normalized = normalizeProtocolDTO(command);
                if (normalized.kind !== PROTOCOL_DTO_KINDS.COMMAND || normalized.type !== RIGIDBODY2D_PATCH_COMMAND_TYPE) {
                    throw Object.assign(new Error(`RigidBody2D only accepts ${RIGIDBODY2D_PATCH_COMMAND_TYPE}.`), {
                        code: 'NGVGE_RIGIDBODY2D_COMMAND_UNSUPPORTED'
                    });
                }
                const payload = normalized.payload || {};
                const nodeId = typeof payload.nodeId === 'string' ? payload.nodeId.trim() : '';
                const component = getComponent(runtimeNodeModel, nodeId);
                if (!component || component.id !== payload.componentId) throw Object.assign(new Error('RigidBody2D command target mismatch.'), {
                    code: 'NGVGE_RIGIDBODY2D_COMMAND_TARGET_INVALID'
                });
                const patch = normalizeRigidBody2DPatch(payload.patch);
                const rigidBody = physicsRuntimeService.patchPersistentRigidBody(nodeId, patch, {
                    transactionId: `rigidbody2d:editor-patch:${nodeId}`
                });
                commandCount += 1;
                return createEngineEvent(RIGIDBODY2D_PATCH_APPLIED_EVENT_TYPE, {
                    componentId: component.id, nodeId, requestedPatch: patch, rigidBody
                });
            } catch (error) {
                failureCount += 1;
                return createProtocolError(error.code || 'NGVGE_RIGIDBODY2D_COMMAND_FAILED', error.message || String(error), {
                    capabilityId: RIGIDBODY2D_COMMAND_CAPABILITY_ID
                });
            }
        },
        getStatus: () => Object.freeze({commandCount, failureCount})
    });
};
const createRigidBody2DCommandCapability = executor => Object.freeze({
    capabilityId: RIGIDBODY2D_COMMAND_CAPABILITY_ID,
    version: RIGIDBODY2D_COMMAND_CAPABILITY_VERSION,
    executeCommand: command => executor.executeCommand(command),
    getStatus: () => executor.getStatus()
});
const createRigidBody2DEditorClient = capability => {
    if (!capability || capability.capabilityId !== RIGIDBODY2D_COMMAND_CAPABILITY_ID || typeof capability.executeCommand !== 'function') {
        throw new TypeError('RigidBody2D Editor client requires RigidBody2D Command capability.');
    }
    return Object.freeze({patchComponent: input => capability.executeCommand(createRigidBody2DPatchComponentCommand(input))});
};
module.exports = {
    RIGIDBODY2D_COMMAND_CAPABILITY_ID,
    RIGIDBODY2D_COMMAND_CAPABILITY_VERSION,
    createRigidBody2DCommandCapability,
    createRigidBody2DCommandExecutor,
    createRigidBody2DEditorClient
};
