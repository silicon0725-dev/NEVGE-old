'use strict';

const {
    TILEMAP_LAYER2D_PATCH_APPLIED_EVENT_TYPE,
    TILEMAP_LAYER2D_PATCH_COMMAND_TYPE,
    TILEMAP_LAYER2D_TYPE_ID,
    createTileMapLayer2DPatchComponentCommand
} = require('../../core/tilemap-layer2d');
const {
    PROTOCOL_DTO_KINDS,
    createEngineEvent,
    createProtocolError,
    normalizeProtocolDTO
} = require('../../core/protocol');

const TILEMAP_LAYER2D_COMMAND_CAPABILITY_ID = 'ngvge.tilemap-layer2d-command';
const TILEMAP_LAYER2D_COMMAND_CAPABILITY_VERSION = 1;

const getTileMapComponent = (runtimeNodeModel, nodeId) => {
    const node = runtimeNodeModel.getNodeSnapshot(nodeId);
    const components = node && Array.isArray(node.components) ? node.components : [];
    return components.find(component => component && component.typeId === TILEMAP_LAYER2D_TYPE_ID) || null;
};

const createTileMapLayer2DCommandExecutor = (runtimeNodeModel, tileMapRuntimeService) => {
    if (!runtimeNodeModel || typeof runtimeNodeModel.getNodeSnapshot !== 'function') {
        throw new TypeError('TileMapLayer2D Command executor requires Runtime Node Model capability.');
    }
    if (!tileMapRuntimeService || typeof tileMapRuntimeService.patchPersistentLayer !== 'function') {
        throw new TypeError('TileMapLayer2D Command executor requires TileMapLayer2D Runtime Service.');
    }
    let commandCount = 0;
    let failureCount = 0;
    return Object.freeze({
        executeCommand: command => {
            try {
                const normalized = normalizeProtocolDTO(command);
                if (normalized.kind !== PROTOCOL_DTO_KINDS.COMMAND || normalized.type !== TILEMAP_LAYER2D_PATCH_COMMAND_TYPE) {
                    throw Object.assign(new Error(`TileMapLayer2D only accepts ${TILEMAP_LAYER2D_PATCH_COMMAND_TYPE}.`), {
                        code: 'NGVGE_TILEMAP_LAYER2D_COMMAND_UNSUPPORTED'
                    });
                }
                const payload = normalized.payload || {};
                const nodeId = typeof payload.nodeId === 'string' ? payload.nodeId.trim() : '';
                const componentId = typeof payload.componentId === 'string' ? payload.componentId.trim() : '';
                const component = getTileMapComponent(runtimeNodeModel, nodeId);
                if (!nodeId || !component || component.id !== componentId) {
                    throw Object.assign(new Error('TileMapLayer2D command target does not match a semantic TileMapLayer2D component.'), {
                        code: 'NGVGE_TILEMAP_LAYER2D_COMMAND_TARGET_INVALID'
                    });
                }
                const layer = tileMapRuntimeService.patchPersistentLayer(nodeId, payload.patch, {
                    transactionId: `tilemap-layer2d:editor-patch:${nodeId}`
                });
                commandCount += 1;
                return createEngineEvent(TILEMAP_LAYER2D_PATCH_APPLIED_EVENT_TYPE, {
                    componentId,
                    layer,
                    nodeId,
                    requestedPatch: payload.patch
                });
            } catch (error) {
                failureCount += 1;
                return createProtocolError(
                    error && error.code ? error.code : 'NGVGE_TILEMAP_LAYER2D_COMMAND_FAILED',
                    error && error.message ? error.message : String(error),
                    {capabilityId: TILEMAP_LAYER2D_COMMAND_CAPABILITY_ID}
                );
            }
        },
        getStatus: () => Object.freeze({commandCount, failureCount})
    });
};

const createTileMapLayer2DCommandCapability = executor => {
    if (!executor || typeof executor.executeCommand !== 'function') {
        throw new TypeError('TileMapLayer2D Command capability requires an executor.');
    }
    return Object.freeze({
        capabilityId: TILEMAP_LAYER2D_COMMAND_CAPABILITY_ID,
        version: TILEMAP_LAYER2D_COMMAND_CAPABILITY_VERSION,
        executeCommand: command => executor.executeCommand(command),
        getStatus: () => executor.getStatus()
    });
};

const createTileMapLayer2DEditorClient = capability => {
    if (!capability || capability.capabilityId !== TILEMAP_LAYER2D_COMMAND_CAPABILITY_ID ||
        typeof capability.executeCommand !== 'function') {
        throw new TypeError('TileMapLayer2D Editor client requires TileMapLayer2D Command capability.');
    }
    return Object.freeze({
        patchComponent: input => capability.executeCommand(createTileMapLayer2DPatchComponentCommand(input))
    });
};

module.exports = {
    TILEMAP_LAYER2D_COMMAND_CAPABILITY_ID,
    TILEMAP_LAYER2D_COMMAND_CAPABILITY_VERSION,
    createTileMapLayer2DCommandCapability,
    createTileMapLayer2DCommandExecutor,
    createTileMapLayer2DEditorClient
};
