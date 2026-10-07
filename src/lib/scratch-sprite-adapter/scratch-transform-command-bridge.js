'use strict';

const {
    TRANSFORM2D_PATCH_COMMAND_TYPE,
    TRANSFORM2D_SCRATCH_AUTHORITY_ID,
    TRANSFORM2D_TYPE_ID,
    normalizeTransform2DPatch
} = require('../../core/transform2d');
const {
    PROTOCOL_DTO_KINDS,
    createEngineEvent,
    createProtocolError,
    normalizeProtocolDTO
} = require('../../core/protocol');
const {SCRATCH_BINDING_STATUSES} = require('./constants');

const SCRATCH_TRANSFORM_COMMAND_BRIDGE_ID = 'scratch.compat.transform-command-bridge';
const SCRATCH_TRANSFORM_COMMAND_BRIDGE_VERSION = 1;
const SCRATCH_TRANSFORM_PATCH_APPLIED_EVENT_TYPE = 'PatchComponentApplied';
const SCALE_EPSILON = 1e-9;
const PATCH_PAYLOAD_FIELDS = new Set(['componentId', 'nodeId', 'patch']);

const SCRATCH_TRANSFORM_COMMAND_BRIDGE_CONTRACT = Object.freeze({
    bridgeId: SCRATCH_TRANSFORM_COMMAND_BRIDGE_ID,
    contractId: 'ngvge.scratch-transform-command-bridge',
    contractVersion: '1',
    editorBoundary: Object.freeze({
        directScratchTargetAccess: false,
        input: 'Engine Command DTO / PatchComponent',
        output: 'Engine Event DTO / Protocol Error DTO'
    }),
    currentAuthority: Object.freeze({
        authorityId: TRANSFORM2D_SCRATCH_AUTHORITY_ID,
        writeTarget: 'Scratch Target public transform setters'
    }),
    direction: 'Editor PatchComponent -> Scratch Writer Authority -> NGVGE projection',
    mutationScope: Object.freeze({
        genericMutationContextImplemented: false,
        genericProjectionLoopPreventionImplemented: false,
        genericTransactionImplemented: false,
        localCompensationOnly: true
    }),
    persistence: Object.freeze({
        editorIntentCommitsPersistentTransform: true,
        runtimeProjectionRemainsRuntimeOnly: true
    }),
    representationBoundary: Object.freeze({
        rendererPrivateStateRequired: false,
        scratchTargetEscapesBridge: false,
        targetRuntimeIdEscapesResult: false
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

const getContextVM = context => {
    if (!context) return null;
    if (typeof context.getService === 'function') return context.getService('vm');
    return context.vm || null;
};

// Scratch's RenderedTarget.setDirection() canonical range is -179..180.
// Keeping the inverse conversion here avoids importing scratch-vm into the
// backend-independent Transform layer while preserving Scratch Authority semantics.
const wrapScratchDirection = value => {
    const number = Number(value);
    if (!Number.isFinite(number)) return NaN;
    const min = -179;
    const range = 360;
    return number - (Math.floor((number - min) / range) * range);
};

const transformRotationToScratchDirection = rotation => wrapScratchDirection(90 - Number(rotation));

const transformScaleToScratchSize = scale => {
    if (!Array.isArray(scale) || scale.length !== 2) {
        const error = new TypeError('Scratch Compatibility Authority requires a two-element Transform2D scale.');
        error.code = 'SCRATCH_TRANSFORM_SCALE_INVALID';
        throw error;
    }
    const scaleX = Number(scale[0]);
    const scaleY = Number(scale[1]);
    if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY)) {
        const error = new TypeError('Scratch Compatibility Authority requires finite Transform2D scale values.');
        error.code = 'SCRATCH_TRANSFORM_SCALE_INVALID';
        throw error;
    }
    if (Math.abs(scaleX - scaleY) > SCALE_EPSILON || scaleX < 0 || scaleY < 0) {
        const error = new Error(
            'Scratch Compatibility Authority cannot represent non-uniform or negative Transform2D scale.'
        );
        error.code = 'SCRATCH_TRANSFORM_SCALE_UNREPRESENTABLE';
        error.scale = [scaleX, scaleY];
        throw error;
    }
    return scaleX * 100;
};

const createBridgeError = (code, message, details = {}) => Object.assign(new Error(message), {code}, details);

const getTransformComponent = (runtimeNodeModel, nodeId) => {
    const node = runtimeNodeModel.getNodeSnapshot(nodeId);
    if (!node) {
        throw createBridgeError(
            'SCRATCH_TRANSFORM_COMMAND_NODE_NOT_FOUND',
            `Transform2D PatchComponent references an unknown semantic NodeId: ${nodeId}`,
            {nodeId}
        );
    }
    const components = Array.isArray(node.components) ? node.components : [];
    const component = components.find(item => item && item.typeId === TRANSFORM2D_TYPE_ID) || null;
    if (!component) {
        throw createBridgeError(
            'SCRATCH_TRANSFORM_COMMAND_COMPONENT_NOT_FOUND',
            `Semantic node does not own a Transform2D component: ${nodeId}`,
            {nodeId}
        );
    }
    return component;
};

const resolveBoundTarget = (context, sceneDataModel, scratchSpriteAdapter, nodeId) => {
    const project = sceneDataModel.readProject();
    const sceneId = normalizeString(project && project.activeSceneId);
    if (!sceneId) {
        throw createBridgeError('SCRATCH_TRANSFORM_COMMAND_SCENE_REQUIRED', 'No active scene is available for Transform editing.');
    }
    const binding = scratchSpriteAdapter.getBindingByNodeId(nodeId, sceneId);
    if (!binding || binding.status !== SCRATCH_BINDING_STATUSES.BOUND || !normalizeString(binding.targetRuntimeId)) {
        throw createBridgeError(
            'SCRATCH_TRANSFORM_COMMAND_BINDING_UNAVAILABLE',
            `Transform2D node is not bound to a live Scratch Target in the active scene: ${nodeId}`,
            {nodeId, sceneId}
        );
    }
    const vm = getContextVM(context);
    const runtime = vm && vm.runtime;
    const targetRuntimeId = binding.targetRuntimeId;
    let target = runtime && typeof runtime.getTargetById === 'function' ? runtime.getTargetById(targetRuntimeId) : null;
    if (!target && runtime && Array.isArray(runtime.targets)) {
        target = runtime.targets.find(candidate => candidate && candidate.id === targetRuntimeId) || null;
    }
    if (!target || target.isStage || target.isOriginal === false) {
        throw createBridgeError(
            'SCRATCH_TRANSFORM_COMMAND_TARGET_UNAVAILABLE',
            `Scratch Compatibility Authority target is unavailable for semantic node: ${nodeId}`,
            {nodeId, sceneId}
        );
    }
    return {binding, sceneId, target};
};

const validatePatchPayloadShape = payload => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw createBridgeError(
            'SCRATCH_TRANSFORM_COMMAND_PAYLOAD_INVALID',
            'PatchComponent payload must be a plain portable object.'
        );
    }
    const unsupported = Object.keys(payload).filter(key => !PATCH_PAYLOAD_FIELDS.has(key));
    if (unsupported.length) {
        throw createBridgeError(
            'SCRATCH_TRANSFORM_COMMAND_PAYLOAD_UNSUPPORTED',
            `Transform2D PatchComponent payload contains unsupported field(s): ${unsupported.join(', ')}`
        );
    }
};

const preflightTargetMutation = (target, patch) => {
    const operations = [];
    if (Object.prototype.hasOwnProperty.call(patch, 'position')) {
        if (typeof target.setXY !== 'function') {
            throw createBridgeError('SCRATCH_TRANSFORM_SET_XY_UNAVAILABLE', 'Scratch Target does not expose setXY().');
        }
        operations.push({kind: 'position', x: patch.position[0], y: patch.position[1]});
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'rotation')) {
        if (typeof target.setDirection !== 'function') {
            throw createBridgeError(
                'SCRATCH_TRANSFORM_SET_DIRECTION_UNAVAILABLE',
                'Scratch Target does not expose setDirection().'
            );
        }
        operations.push({kind: 'rotation', direction: transformRotationToScratchDirection(patch.rotation)});
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'scale')) {
        const size = transformScaleToScratchSize(patch.scale);
        if (typeof target.setSize !== 'function') {
            throw createBridgeError('SCRATCH_TRANSFORM_SET_SIZE_UNAVAILABLE', 'Scratch Target does not expose setSize().');
        }
        operations.push({kind: 'scale', size});
    }
    return operations;
};

const captureScratchTransform = target => {
    const snapshot = {
        direction: Number(target.direction),
        size: Number(target.size),
        x: Number(target.x),
        y: Number(target.y)
    };
    if (!Number.isFinite(snapshot.direction) || !Number.isFinite(snapshot.size) ||
        !Number.isFinite(snapshot.x) || !Number.isFinite(snapshot.y)) {
        throw createBridgeError(
            'SCRATCH_TRANSFORM_COMMAND_TARGET_STATE_INVALID',
            'Scratch Compatibility Authority target has non-finite transform state.'
        );
    }
    return snapshot;
};

const applyOperations = (target, operations) => {
    operations.forEach(operation => {
        // Force position changes through Scratch dragging guards because this is an
        // explicit editor command, not a runtime drag continuation.
        if (operation.kind === 'position') target.setXY(operation.x, operation.y, true);
        else if (operation.kind === 'rotation') target.setDirection(operation.direction);
        else if (operation.kind === 'scale') target.setSize(operation.size);
    });
};

const restoreScratchTransform = (target, snapshot) => {
    if (!snapshot) return;
    if (typeof target.setXY === 'function' && Number.isFinite(snapshot.x) && Number.isFinite(snapshot.y)) {
        target.setXY(snapshot.x, snapshot.y, true);
    }
    if (typeof target.setDirection === 'function' && Number.isFinite(snapshot.direction)) {
        target.setDirection(snapshot.direction);
    }
    if (typeof target.setSize === 'function' && Number.isFinite(snapshot.size)) {
        target.setSize(snapshot.size);
    }
};

const assertDependencies = (sceneDataModel, runtimeNodeModel, scratchSpriteAdapter, scratchTransformProjection) => {
    if (!sceneDataModel || typeof sceneDataModel.readProject !== 'function') {
        throw new TypeError('Scratch Transform command bridge requires the Scene Data Model capability.');
    }
    if (!runtimeNodeModel || typeof runtimeNodeModel.getNodeSnapshot !== 'function') {
        throw new TypeError('Scratch Transform command bridge requires the Runtime Node Model capability.');
    }
    if (!scratchSpriteAdapter || typeof scratchSpriteAdapter.getBindingByNodeId !== 'function') {
        throw new TypeError('Scratch Transform command bridge requires the Scratch Sprite Adapter capability.');
    }
    if (!scratchTransformProjection || typeof scratchTransformProjection.projectNode !== 'function' ||
        typeof scratchTransformProjection.commitNodeToPersistent !== 'function') {
        throw new TypeError('Scratch Transform command bridge requires the Scratch Transform Projection capability.');
    }
};

const createScratchTransformCommandBridge = (
    context,
    sceneDataModel,
    runtimeNodeModel,
    scratchSpriteAdapter,
    scratchTransformProjection
) => {
    assertDependencies(sceneDataModel, runtimeNodeModel, scratchSpriteAdapter, scratchTransformProjection);
    let disposed = false;
    let commandCount = 0;
    let failureCount = 0;
    let compensationCount = 0;
    let lastError = null;

    const toProtocolFailure = (error, contextDetails = {}) => createProtocolError(
        error && error.code ? error.code : 'SCRATCH_TRANSFORM_COMMAND_FAILED',
        error && error.message ? error.message : String(error),
        Object.assign({
            authorityId: TRANSFORM2D_SCRATCH_AUTHORITY_ID,
            bridgeId: SCRATCH_TRANSFORM_COMMAND_BRIDGE_ID,
            compensated: Boolean(contextDetails.compensated),
            componentId: contextDetails.componentId || null,
            nodeId: contextDetails.nodeId || null
        }, error && Array.isArray(error.scale) ? {scale: error.scale.slice()} : {})
    );

    const executeCommand = command => {
        if (disposed) {
            return createProtocolError(
                'SCRATCH_TRANSFORM_COMMAND_BRIDGE_DISPOSED',
                'Scratch Transform command bridge is disposed.',
                {bridgeId: SCRATCH_TRANSFORM_COMMAND_BRIDGE_ID}
            );
        }
        let target = null;
        let beforeTarget = null;
        let authorityMutationStarted = false;
        let nodeId = null;
        let componentId = null;
        let compensated = false;
        try {
            const normalizedCommand = normalizeProtocolDTO(command);
            if (normalizedCommand.kind !== PROTOCOL_DTO_KINDS.COMMAND ||
                normalizedCommand.type !== TRANSFORM2D_PATCH_COMMAND_TYPE) {
                throw createBridgeError(
                    'SCRATCH_TRANSFORM_COMMAND_UNSUPPORTED',
                    `Scratch Transform command bridge only accepts ${TRANSFORM2D_PATCH_COMMAND_TYPE} command DTOs.`
                );
            }
            const payload = normalizedCommand.payload || {};
            validatePatchPayloadShape(payload);
            nodeId = normalizeString(payload.nodeId);
            componentId = normalizeString(payload.componentId);
            if (!nodeId || !componentId) {
                throw createBridgeError(
                    'SCRATCH_TRANSFORM_COMMAND_TARGET_INVALID',
                    'PatchComponent requires stable nodeId and componentId values.'
                );
            }
            const patch = normalizeTransform2DPatch(payload.patch);
            const component = getTransformComponent(runtimeNodeModel, nodeId);
            if (component.id !== componentId) {
                throw createBridgeError(
                    'SCRATCH_TRANSFORM_COMMAND_COMPONENT_MISMATCH',
                    `PatchComponent componentId does not identify the node Transform2D component: ${componentId}`,
                    {componentId, nodeId}
                );
            }

            const resolved = resolveBoundTarget(context, sceneDataModel, scratchSpriteAdapter, nodeId);
            target = resolved.target;
            const operations = preflightTargetMutation(target, patch);
            beforeTarget = captureScratchTransform(target);
            authorityMutationStarted = true;
            applyOperations(target, operations);

            const projected = scratchTransformProjection.projectNode(nodeId, {
                reason: 'editor-patch-component',
                sceneId: resolved.sceneId
            });
            if (!projected) {
                throw createBridgeError(
                    'SCRATCH_TRANSFORM_COMMAND_PROJECTION_FAILED',
                    `Scratch Authority state could not be projected after PatchComponent: ${nodeId}`,
                    {nodeId}
                );
            }
            const committed = scratchTransformProjection.commitNodeToPersistent(nodeId, {
                projectBeforeCommit: false,
                reason: 'editor-patch-component',
                sceneId: resolved.sceneId
            });
            if (!committed) {
                throw createBridgeError(
                    'SCRATCH_TRANSFORM_COMMAND_COMMIT_FAILED',
                    `Projected Scratch Authority state could not be committed for node: ${nodeId}`,
                    {nodeId}
                );
            }

            commandCount += 1;
            lastError = null;
            return createEngineEvent(SCRATCH_TRANSFORM_PATCH_APPLIED_EVENT_TYPE, {
                authorityId: TRANSFORM2D_SCRATCH_AUTHORITY_ID,
                componentId,
                nodeId,
                requestedPatch: patch,
                transform: committed.transform
            });
        } catch (error) {
            failureCount += 1;
            lastError = error && error.message ? error.message : String(error);
            if (authorityMutationStarted && target && beforeTarget) {
                try {
                    restoreScratchTransform(target, beforeTarget);
                    if (nodeId) scratchTransformProjection.projectNode(nodeId, {reason: 'editor-patch-compensation'});
                    compensationCount += 1;
                    compensated = true;
                } catch { /* local best-effort compensation only; not a generic transaction */ }
            }
            return toProtocolFailure(error, {compensated, componentId, nodeId});
        }
    };

    return Object.freeze({
        bridgeId: SCRATCH_TRANSFORM_COMMAND_BRIDGE_ID,
        version: SCRATCH_TRANSFORM_COMMAND_BRIDGE_VERSION,
        dispose: () => {
            disposed = true;
        },
        executeCommand,
        getStatus: () => deepFreeze({commandCount, compensationCount, failureCount, lastError})
    });
};

module.exports = {
    SCRATCH_TRANSFORM_COMMAND_BRIDGE_CONTRACT,
    SCRATCH_TRANSFORM_COMMAND_BRIDGE_ID,
    SCRATCH_TRANSFORM_COMMAND_BRIDGE_VERSION,
    SCRATCH_TRANSFORM_PATCH_APPLIED_EVENT_TYPE,
    createScratchTransformCommandBridge,
    transformRotationToScratchDirection,
    transformScaleToScratchSize,
    wrapScratchDirection
};
