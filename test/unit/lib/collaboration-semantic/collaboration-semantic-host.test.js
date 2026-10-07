const {
    COLLABORATION_OPERATION_ORIGINS,
    COLLABORATION_OPERATION_TYPES,
    COLLABORATION_SEMANTIC_AUTHORITY_ID,
    COLLABORATION_SEMANTIC_DOMAIN_ID,
    COLLABORATION_SEMANTIC_HOST_ID,
    getCollaborationSemanticController,
    installCollaborationSemanticHost
} = require('../../../../src/lib/collaboration-semantic');
const {RUNTIME_NODE_COMMAND_CAPABILITY_ID} = require('../../../../src/lib/runtime-nodes');
const {TRANSFORM2D_COMMAND_CAPABILITY_ID} = require('../../../../src/lib/transform-system');
const {
    RUNTIME_NODE_MODEL_CAPABILITY_ID,
    SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID
} = require('../../../../src/lib/scene-system/constants');

const createVM = () => {
    const target = {id: 'scratch-local-123'};
    const commandCapability = {
        capabilityId: RUNTIME_NODE_COMMAND_CAPABILITY_ID,
        executeCommand: jest.fn(command => ({kind: 'event', payload: command.payload, type: command.type}))
    };
    const transformCapability = {
        capabilityId: TRANSFORM2D_COMMAND_CAPABILITY_ID,
        executeCommand: jest.fn(command => ({kind: 'event', payload: command.payload, type: command.type}))
    };
    const capabilities = new Map([
        [SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID, {
            getBindingByNodeId: nodeId => nodeId === 'node:sprite:1' ?
                {nodeId, status: 'bound', targetRuntimeId: target.id} : null,
            getBindingByTargetRuntimeId: targetId => targetId === target.id ?
                {nodeId: 'node:sprite:1', status: 'bound', targetRuntimeId: target.id} : null
        }],
        [RUNTIME_NODE_MODEL_CAPABILITY_ID, {
            getNodeSnapshot: nodeId => nodeId === 'node:sprite:1' ? {
                components: [{id: 'component:transform:1', typeId: 'ngvge.transform2d'}],
                id: nodeId
            } : null
        }],
        [RUNTIME_NODE_COMMAND_CAPABILITY_ID, commandCapability],
        [TRANSFORM2D_COMMAND_CAPABILITY_ID, transformCapability]
    ]);
    const extensionManager = {
        _loadedExtensions: new Map(),
        getExtensionURLs: () => ({}),
        isExtensionLoaded: id => extensionManager._loadedExtensions.has(id),
        loadExtensionIdSync: jest.fn(id => {
            extensionManager._loadedExtensions.set(id, `service.${id}`);
            return id;
        })
    };
    const vm = {
        extensionManager,
        runtime: {
            _blockInfo: [],
            extensionManager,
            getTargetById: id => id === target.id ? target : null,
            ngvgeFirstPartyModules: {getCapability: id => capabilities.get(id) || null}
        }
    };
    return {commandCapability, target, transformCapability, vm};
};

describe('COL-0 Collaboration Semantic Host', () => {
    test('owns one collaboration semantic writer and exposes query-only runtime state', () => {
        const {vm} = createVM();
        const client = installCollaborationSemanticHost(vm);
        const controller = getCollaborationSemanticController(vm);
        expect(client.getStatus()).toMatchObject({hostId: COLLABORATION_SEMANTIC_HOST_ID, version: 1});
        expect(controller.getAuthority()).toEqual(expect.objectContaining({
            authorityId: COLLABORATION_SEMANTIC_AUTHORITY_ID,
            domain: COLLABORATION_SEMANTIC_DOMAIN_ID,
            mode: 'writer'
        }));
        expect(vm.runtime.ngvgeCollaborationSemantic).toBe(client);
        expect(client.executeOperation).toBeUndefined();
        expect(client.resolveTargetByNodeId).toBeUndefined();
    });

    test('maps volatile local Scratch target identity to stable NodeId without publishing reverse identity', () => {
        const {target, vm} = createVM();
        installCollaborationSemanticHost(vm);
        const controller = getCollaborationSemanticController(vm);
        expect(controller.getNodeIdForTargetRuntimeId(target.id)).toBe('node:sprite:1');
        expect(controller.resolveTargetByNodeId('node:sprite:1')).toBe(target);
        expect(vm.runtime.ngvgeCollaborationSemantic.getNodeIdForTargetRuntimeId).toBeUndefined();
    });

    test('routes node rename and destroy through Runtime Node Command capability', async () => {
        const {commandCapability, vm} = createVM();
        installCollaborationSemanticHost(vm);
        const controller = getCollaborationSemanticController(vm);
        await controller.executeOperation(controller.createOperation(
            COLLABORATION_OPERATION_TYPES.NODE_RENAME,
            {name: 'Synced', nodeId: 'node:sprite:1'},
            {origin: COLLABORATION_OPERATION_ORIGINS.REMOTE}
        ));
        await controller.executeOperation(controller.createOperation(
            COLLABORATION_OPERATION_TYPES.NODE_DESTROY,
            {nodeId: 'node:sprite:1'},
            {origin: COLLABORATION_OPERATION_ORIGINS.REMOTE}
        ));
        expect(commandCapability.executeCommand).toHaveBeenCalledTimes(2);
        const serialized = commandCapability.executeCommand.mock.calls.map(call => JSON.stringify(call[0]));
        expect(serialized.join('\n')).toContain('node:sprite:1');
        expect(serialized.join('\n')).not.toContain('scratch-local-123');
    });

    test('routes transform through Transform2D command using semantic component identity', async () => {
        const {transformCapability, vm} = createVM();
        installCollaborationSemanticHost(vm);
        const controller = getCollaborationSemanticController(vm);
        await controller.executeOperation(controller.createOperation(
            COLLABORATION_OPERATION_TYPES.NODE_TRANSFORM_PATCH,
            {nodeId: 'node:sprite:1', patch: {position: [12, 34], rotation: 15, scale: [1.2, 1.2]}},
            {origin: COLLABORATION_OPERATION_ORIGINS.REMOTE}
        ));
        expect(transformCapability.executeCommand).toHaveBeenCalledTimes(1);
        const command = transformCapability.executeCommand.mock.calls[0][0];
        expect(command.payload).toMatchObject({
            componentId: 'component:transform:1',
            nodeId: 'node:sprite:1'
        });
        expect(JSON.stringify(command)).not.toContain('scratch-local-123');
    });
});
