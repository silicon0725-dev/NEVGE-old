'use strict';

const {
    TRANSFORM2D_NATIVE_AUTHORITY_ID,
    TRANSFORM2D_PATCH_COMMAND_TYPE,
    TRANSFORM2D_TYPE_ID,
    normalizeTransform2DPatch
} = require('../../core/transform2d');
const {
    PROTOCOL_DTO_KINDS,
    createEngineEvent,
    createProtocolError,
    normalizeProtocolDTO
} = require('../../core/protocol');

const NATIVE_TRANSFORM_COMMAND_BRIDGE_ID = 'ngvge.native.transform-command-bridge';
const NATIVE_TRANSFORM_COMMAND_BRIDGE_VERSION = 1;
const NATIVE_TRANSFORM_PATCH_APPLIED_EVENT_TYPE = 'PatchComponentApplied';
const PATCH_PAYLOAD_FIELDS = new Set(['componentId', 'nodeId', 'patch']);

const NATIVE_TRANSFORM_COMMAND_BRIDGE_CONTRACT = Object.freeze({
    bridgeId: NATIVE_TRANSFORM_COMMAND_BRIDGE_ID,
    contractId: 'ngvge.native-transform-command-bridge',
    contractVersion: '1',
    editorBoundary: Object.freeze({
        backendHandleAccess: false,
        input: 'Engine Command DTO / PatchComponent',
        output: 'Engine Event DTO / Protocol Error DTO'
    }),
    currentAuthority: Object.freeze({
        authorityId: TRANSFORM2D_NATIVE_AUTHORITY_ID,
        scope: 'unbound semantic NodeId',
        writeTarget: 'Transform2DRuntimeStore + persistent Transform component'
    }),
    persistence: Object.freeze({
        editorIntentCommitsPersistentTransform: true,
        projectPersistenceUsesRuntimeNodeModelMutationBoundary: true
    }),
    representationBoundary: Object.freeze({
        backendHandleEscapesResult: false,
        scratchTargetRequired: false
    })
});

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return Object.freeze(value);
};

const normalizeString = value => (
    typeof value === 'string' && value.trim() ? value.trim() : null
);

const createBridgeError = (code, message, details = {}) => Object.assign(new Error(message), {code}, details);

const validatePatchPayloadShape = payload => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw createBridgeError(
            'NATIVE_TRANSFORM_COMMAND_PAYLOAD_INVALID',
            'PatchComponent payload must be a plain portable object.'
        );
    }
    const unsupported = Object.keys(payload).filter(key => !PATCH_PAYLOAD_FIELDS.has(key));
    if (unsupported.length) {
        throw createBridgeError(
            'NATIVE_TRANSFORM_COMMAND_PAYLOAD_UNSUPPORTED',
            `Transform2D PatchComponent payload contains unsupported field(s): ${unsupported.join(', ')}`
        );
    }
};

const getTransformComponent = (runtimeNodeModel, nodeId) => {
    const node = runtimeNodeModel.getNodeSnapshot(nodeId);
    if (!node) {
        throw createBridgeError(
            'NATIVE_TRANSFORM_COMMAND_NODE_NOT_FOUND',
            `Transform2D PatchComponent references an unknown semantic NodeId: ${nodeId}`,
            {nodeId}
        );
    }
    const components = Array.isArray(node.components) ? node.components : [];
    const component = components.find(item => item && item.typeId === TRANSFORM2D_TYPE_ID) || null;
    if (!component) {
        throw createBridgeError(
            'NATIVE_TRANSFORM_COMMAND_COMPONENT_NOT_FOUND',
            `Semantic node does not own a Transform2D component: ${nodeId}`,
            {nodeId}
        );
    }
    return component;
};

const assertDependencies = (runtimeNodeModel, transformRuntimeStore) => {
    if (!runtimeNodeModel || typeof runtimeNodeModel.getNodeSnapshot !== 'function') {
        throw new TypeError('Native Transform command bridge requires the Runtime Node Model capability.');
    }
    if (!transformRuntimeStore || typeof transformRuntimeStore.patchRuntimeTransform !== 'function' ||
        typeof transformRuntimeStore.commitRuntimeToPersistent !== 'function' ||
        typeof transformRuntimeStore.getRuntimeTransform !== 'function') {
        throw new TypeError('Native Transform command bridge requires the Transform2D Runtime Store.');
    }
};

const createNativeTransformCommandBridge = (runtimeNodeModel, transformRuntimeStore) => {
    assertDependencies(runtimeNodeModel, transformRuntimeStore);
    let disposed = false;
    let commandCount = 0;
    let failureCount = 0;
    let compensationCount = 0;
    let lastError = null;

    const executeCommand = command => {
        if (disposed) {
            return createProtocolError(
                'NATIVE_TRANSFORM_COMMAND_BRIDGE_DISPOSED',
                'Native Transform command bridge is disposed.',
                {bridgeId: NATIVE_TRANSFORM_COMMAND_BRIDGE_ID}
            );
        }

        let nodeId = null;
        let componentId = null;
        let beforeRuntime = null;
        let runtimeMutationStarted = false;
        let compensated = false;
        try {
            const normalizedCommand = normalizeProtocolDTO(command);
            if (normalizedCommand.kind !== PROTOCOL_DTO_KINDS.COMMAND ||
                normalizedCommand.type !== TRANSFORM2D_PATCH_COMMAND_TYPE) {
                throw createBridgeError(
                    'NATIVE_TRANSFORM_COMMAND_UNSUPPORTED',
                    `Native Transform command bridge only accepts ${TRANSFORM2D_PATCH_COMMAND_TYPE} command DTOs.`
                );
            }
            const payload = normalizedCommand.payload || {};
            validatePatchPayloadShape(payload);
            nodeId = normalizeString(payload.nodeId);
            componentId = normalizeString(payload.componentId);
            if (!nodeId || !componentId) {
                throw createBridgeError(
                    'NATIVE_TRANSFORM_COMMAND_TARGET_INVALID',
                    'PatchComponent requires stable nodeId and componentId values.'
                );
            }

            const patch = normalizeTransform2DPatch(payload.patch);
            const component = getTransformComponent(runtimeNodeModel, nodeId);
            if (component.id !== componentId) {
                throw createBridgeError(
                    'NATIVE_TRANSFORM_COMMAND_COMPONENT_MISMATCH',
                    `PatchComponent componentId does not identify the node Transform2D component: ${componentId}`,
                    {componentId, nodeId}
                );
            }

            beforeRuntime = transformRuntimeStore.getRuntimeTransform(nodeId) ||
                transformRuntimeStore.getPersistentTransform(nodeId);
            runtimeMutationStarted = true;
            transformRuntimeStore.patchRuntimeTransform(nodeId, patch);
            const record = transformRuntimeStore.commitRuntimeToPersistent(nodeId, {
                transactionId: `native-transform:editor-patch:${nodeId}`
            });
            const transform = record && record.data ? record.data : transformRuntimeStore.getPersistentTransform(nodeId);

            commandCount += 1;
            lastError = null;
            return createEngineEvent(NATIVE_TRANSFORM_PATCH_APPLIED_EVENT_TYPE, {
                authorityId: TRANSFORM2D_NATIVE_AUTHORITY_ID,
                componentId,
                nodeId,
                requestedPatch: patch,
                transform
            });
        } catch (error) {
            failureCount += 1;
            lastError = error && error.message ? error.message : String(error);
            if (runtimeMutationStarted && nodeId && beforeRuntime) {
                try {
                    transformRuntimeStore.replaceRuntimeTransform(nodeId, beforeRuntime);
                    compensationCount += 1;
                    compensated = true;
                } catch { /* local runtime compensation only */ }
            }
            return createProtocolError(
                error && error.code ? error.code : 'NATIVE_TRANSFORM_COMMAND_FAILED',
                error && error.message ? error.message : String(error),
                {
                    authorityId: TRANSFORM2D_NATIVE_AUTHORITY_ID,
                    bridgeId: NATIVE_TRANSFORM_COMMAND_BRIDGE_ID,
                    compensated,
                    componentId,
                    nodeId
                }
            );
        }
    };

    return Object.freeze({
        bridgeId: NATIVE_TRANSFORM_COMMAND_BRIDGE_ID,
        version: NATIVE_TRANSFORM_COMMAND_BRIDGE_VERSION,
        dispose: () => {
            disposed = true;
        },
        executeCommand,
        getStatus: () => deepFreeze({commandCount, compensationCount, failureCount, lastError})
    });
};

module.exports = {
    NATIVE_TRANSFORM_COMMAND_BRIDGE_CONTRACT,
    NATIVE_TRANSFORM_COMMAND_BRIDGE_ID,
    NATIVE_TRANSFORM_COMMAND_BRIDGE_VERSION,
    NATIVE_TRANSFORM_PATCH_APPLIED_EVENT_TYPE,
    createNativeTransformCommandBridge
};
