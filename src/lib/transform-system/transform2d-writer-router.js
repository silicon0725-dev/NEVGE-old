'use strict';

const {
    TRANSFORM2D_PATCH_COMMAND_TYPE
} = require('../../core/transform2d');
const {
    PROTOCOL_DTO_KINDS,
    createProtocolError,
    normalizeProtocolDTO
} = require('../../core/protocol');

const TRANSFORM2D_WRITER_ROUTER_ID = 'ngvge.transform2d-writer-router';
const TRANSFORM2D_WRITER_ROUTER_VERSION = 1;

const TRANSFORM2D_WRITER_ROUTING_CONTRACT = Object.freeze({
    contractId: 'ngvge.transform2d-node-scoped-writer-routing',
    contractVersion: '1',
    identity: Object.freeze({
        backendHandleDeterminesRoute: false,
        nodeIdIsRoutingKey: true
    }),
    resolverBoundary: Object.freeze({
        callerMaySelectAuthority: false,
        resolverIsHostOwned: true,
        routeResultMustNameRegisteredWriter: true
    }),
    routerId: TRANSFORM2D_WRITER_ROUTER_ID,
    scope: 'node'
});

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return Object.freeze(value);
};

const normalizeString = value => (
    typeof value === 'string' && value.trim() ? value.trim() : null
);

const assertDependencies = (resolveRoute, writers) => {
    if (typeof resolveRoute !== 'function') {
        throw new TypeError('Transform2D Writer Router requires a host-owned route resolver.');
    }
    if (!writers || typeof writers !== 'object' || Array.isArray(writers)) {
        throw new TypeError('Transform2D Writer Router requires an authorityId keyed writer map.');
    }
    Object.keys(writers).forEach(authorityId => {
        if (!normalizeString(authorityId) || !writers[authorityId] || typeof writers[authorityId].executeCommand !== 'function') {
            throw new TypeError(`Transform2D Writer Router has an invalid writer registration: ${authorityId}`);
        }
    });
};

const createTransform2DWriterRouter = ({resolveRoute, writers}) => {
    assertDependencies(resolveRoute, writers);
    const writerMap = Object.freeze(Object.assign({}, writers));
    let disposed = false;
    let failureCount = 0;
    let lastRoute = null;
    const commandCountByAuthority = Object.create(null);

    const getRouteForNode = nodeId => {
        const normalizedNodeId = normalizeString(nodeId);
        if (!normalizedNodeId) {
            const error = new TypeError('Transform2D Writer Router requires a stable NodeId.');
            error.code = 'NGVGE_TRANSFORM2D_WRITER_ROUTE_NODE_ID_INVALID';
            throw error;
        }
        const route = resolveRoute(normalizedNodeId);
        const authorityId = normalizeString(route && route.authorityId);
        if (!authorityId || !writerMap[authorityId]) {
            const error = new Error(`Transform2D route resolver selected an unavailable writer for NodeId: ${normalizedNodeId}`);
            error.code = 'NGVGE_TRANSFORM2D_WRITER_ROUTE_UNAVAILABLE';
            error.nodeId = normalizedNodeId;
            throw error;
        }
        return deepFreeze(Object.assign({}, route, {authorityId, nodeId: normalizedNodeId}));
    };

    const executeCommand = command => {
        if (disposed) {
            return createProtocolError(
                'NGVGE_TRANSFORM2D_WRITER_ROUTER_DISPOSED',
                'Transform2D Writer Router is disposed.',
                {routerId: TRANSFORM2D_WRITER_ROUTER_ID}
            );
        }
        try {
            const normalizedCommand = normalizeProtocolDTO(command);
            if (normalizedCommand.kind !== PROTOCOL_DTO_KINDS.COMMAND ||
                normalizedCommand.type !== TRANSFORM2D_PATCH_COMMAND_TYPE) {
                return createProtocolError(
                    'NGVGE_TRANSFORM2D_WRITER_ROUTER_UNSUPPORTED',
                    `Transform2D Writer Router only accepts ${TRANSFORM2D_PATCH_COMMAND_TYPE} command DTOs.`,
                    {routerId: TRANSFORM2D_WRITER_ROUTER_ID}
                );
            }
            const nodeId = normalizedCommand.payload && normalizedCommand.payload.nodeId;
            const route = getRouteForNode(nodeId);
            lastRoute = route;
            commandCountByAuthority[route.authorityId] = (commandCountByAuthority[route.authorityId] || 0) + 1;
            return writerMap[route.authorityId].executeCommand(normalizedCommand);
        } catch (error) {
            failureCount += 1;
            return createProtocolError(
                error && error.code ? error.code : 'NGVGE_TRANSFORM2D_WRITER_ROUTING_FAILED',
                error && error.message ? error.message : String(error),
                {routerId: TRANSFORM2D_WRITER_ROUTER_ID}
            );
        }
    };

    return Object.freeze({
        routerId: TRANSFORM2D_WRITER_ROUTER_ID,
        version: TRANSFORM2D_WRITER_ROUTER_VERSION,
        dispose: () => {
            disposed = true;
        },
        executeCommand,
        getRouteForNode,
        getStatus: () => deepFreeze({
            commandCountByAuthority: Object.assign({}, commandCountByAuthority),
            failureCount,
            lastRoute
        })
    });
};

module.exports = {
    TRANSFORM2D_WRITER_ROUTER_ID,
    TRANSFORM2D_WRITER_ROUTER_VERSION,
    TRANSFORM2D_WRITER_ROUTING_CONTRACT,
    createTransform2DWriterRouter
};
