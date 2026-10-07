'use strict';

const {
    TRANSFORM2D_NATIVE_AUTHORITY_ID,
    TRANSFORM2D_SCRATCH_AUTHORITY_ID
} = require('../../core/transform2d');

const TRANSFORM2D_SCENE_ROUTE_RESOLVER_ID = 'ngvge.scene.transform2d-writer-route-resolver';
const TRANSFORM2D_SCENE_ROUTE_RESOLVER_VERSION = 1;
const TRANSFORM2D_SCENE_ROUTE_KINDS = Object.freeze({
    NATIVE: 'native',
    SCRATCH_COMPATIBILITY: 'scratch-compatibility'
});

const TRANSFORM2D_SCENE_ROUTE_RESOLVER_CONTRACT = Object.freeze({
    contractId: 'ngvge.scene-transform2d-writer-route-resolver',
    contractVersion: '1',
    identity: Object.freeze({
        nodeIdIsRoutingKey: true,
        targetRuntimeIdIsRoutingKey: false
    }),
    ownership: Object.freeze({
        bindingRecordOwnsCompatibilityRoute: true,
        missingScratchRuntimeTargetFallsBackToNative: false,
        runtimeDisconnectChangesOwnership: false
    }),
    resolverId: TRANSFORM2D_SCENE_ROUTE_RESOLVER_ID
});

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return Object.freeze(value);
};

const normalizeString = value => (
    typeof value === 'string' && value.trim() ? value.trim() : null
);

const createTransform2DSceneWriterRouteResolver = scratchSpriteAdapter => {
    if (!scratchSpriteAdapter || typeof scratchSpriteAdapter.getBindingByNodeId !== 'function') {
        throw new TypeError('Transform2D Scene route resolver requires the Scratch Sprite Adapter capability.');
    }
    return nodeId => {
        const normalizedNodeId = normalizeString(nodeId);
        if (!normalizedNodeId) {
            const error = new TypeError('Transform2D Scene route resolver requires a stable NodeId.');
            error.code = 'NGVGE_TRANSFORM2D_SCENE_ROUTE_NODE_ID_INVALID';
            throw error;
        }
        const binding = scratchSpriteAdapter.getBindingByNodeId(normalizedNodeId);
        if (binding) {
            return deepFreeze({
                authorityId: TRANSFORM2D_SCRATCH_AUTHORITY_ID,
                bindingStatus: normalizeString(binding.status),
                kind: TRANSFORM2D_SCENE_ROUTE_KINDS.SCRATCH_COMPATIBILITY,
                reason: 'scratch-binding-owned'
            });
        }
        return deepFreeze({
            authorityId: TRANSFORM2D_NATIVE_AUTHORITY_ID,
            bindingStatus: null,
            kind: TRANSFORM2D_SCENE_ROUTE_KINDS.NATIVE,
            reason: 'native-unbound-node'
        });
    };
};

module.exports = {
    TRANSFORM2D_SCENE_ROUTE_KINDS,
    TRANSFORM2D_SCENE_ROUTE_RESOLVER_CONTRACT,
    TRANSFORM2D_SCENE_ROUTE_RESOLVER_ID,
    TRANSFORM2D_SCENE_ROUTE_RESOLVER_VERSION,
    createTransform2DSceneWriterRouteResolver
};
