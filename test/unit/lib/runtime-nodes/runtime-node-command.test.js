const {
    RUNTIME_NODE_COMMAND_CAPABILITY_ID,
    RUNTIME_NODE_COMMAND_TYPES,
    createRuntimeNodeCommandCapability,
    createRuntimeNodeCommandExecutor,
    createRuntimeNodeEditorClient,
    unwrapRuntimeNodeCommandResult,
    unwrapRuntimeNodeCommandResultAsync
} = require('../../../../src/lib/runtime-nodes');

const mutation = snapshot => ({
    applied: true,
    error: null,
    persisted: true,
    snapshot
});

const makeNode = (id, overrides = {}) => Object.assign({
    activeInHierarchy: true,
    childIds: [],
    components: [],
    enabledSelf: true,
    id,
    name: id,
    parentId: 'runtime-node:scene-root:scene-a',
    protected: false,
    sceneId: 'scene-a',
    scope: 'scene',
    typeId: 'ngvge.node2d'
}, overrides);

const createHarness = ({boundNodeId = null} = {}) => {
    const nodes = new Map();
    const source = makeNode('runtime-node:source', {name: 'Source'});
    const parent = makeNode('runtime-node:parent', {name: 'Parent'});
    nodes.set(source.id, source);
    nodes.set(parent.id, parent);
    const runtimeNodeModel = {
        createNode: jest.fn((typeId, options) => {
            const node = makeNode('runtime-node:created', Object.assign({}, options, {typeId}));
            nodes.set(node.id, node);
            return mutation(node);
        }),
        destroyNode: jest.fn(nodeId => {
            nodes.delete(nodeId);
            return mutation({destroyed: true, nodeId});
        }),
        duplicateNode: jest.fn(nodeId => {
            const node = makeNode('runtime-node:duplicate', {name: `${nodes.get(nodeId).name} copy`});
            nodes.set(node.id, node);
            return mutation(node);
        }),
        getNodeSnapshot: jest.fn(nodeId => nodes.get(nodeId) || null),
        patchNode: jest.fn((nodeId, patch) => {
            const node = Object.assign({}, nodes.get(nodeId), patch);
            nodes.set(nodeId, node);
            return mutation(node);
        }),
        setParent: jest.fn((nodeId, parentId) => {
            const node = Object.assign({}, nodes.get(nodeId), {parentId});
            nodes.set(nodeId, node);
            return mutation(node);
        })
    };
    const compatibilityLifecycleAuthority = {
        authorityId: 'scratch.compat.sprite-lifecycle',
        createNode: jest.fn(async ({options, typeId}) => {
            const node = makeNode('runtime-node:compat-created', Object.assign({}, options, {typeId}));
            nodes.set(node.id, node);
            return node;
        }),
        destroyNode: jest.fn(async ({nodeId}) => {
            nodes.delete(nodeId);
            return {destroyed: true, nodeId};
        }),
        duplicateNode: jest.fn(async ({nodeId}) => {
            const node = makeNode('runtime-node:compat-duplicate', {
                name: `${nodes.get(nodeId).name} copy`,
                typeId: 'ngvge.sprite-node'
            });
            nodes.set(node.id, node);
            return node;
        }),
        handlesCreateType: jest.fn(typeId => typeId === 'ngvge.sprite-node'),
        ownsNode: jest.fn(nodeId => nodeId === boundNodeId),
        patchNode: jest.fn(({nodeId, patch}) => {
            const node = Object.assign({}, nodes.get(nodeId), patch);
            nodes.set(nodeId, node);
            return node;
        }),
        reparentNode: jest.fn(async ({nodeId, parentId}) => {
            const node = Object.assign({}, nodes.get(nodeId), {parentId});
            nodes.set(nodeId, node);
            return node;
        })
    };
    const executor = createRuntimeNodeCommandExecutor(runtimeNodeModel, {compatibilityLifecycleAuthority});
    const capability = createRuntimeNodeCommandCapability(executor);
    const client = createRuntimeNodeEditorClient(capability);
    return {capability, client, compatibilityLifecycleAuthority, executor, parent, runtimeNodeModel, source};
};

describe('Runtime Node Command capability', () => {
    test('exposes the backend-neutral command capability', () => {
        const {capability} = createHarness();
        expect(capability.capabilityId).toBe(RUNTIME_NODE_COMMAND_CAPABILITY_ID);
        expect(capability.version).toBe(1);
    });

    test('encodes CreateNode and returns the created semantic snapshot', () => {
        const {client, runtimeNodeModel} = createHarness();
        const result = client.createNode({
            options: {
                name: 'Child',
                parentId: 'runtime-node:parent',
                sceneId: 'scene-a',
                scope: 'scene'
            },
            typeId: 'ngvge.node2d'
        });
        const payload = unwrapRuntimeNodeCommandResult(result);

        expect(result.kind).toBe('event');
        expect(result.type).toBe('NodeCreated');
        expect(payload.node.id).toBe('runtime-node:created');
        expect(runtimeNodeModel.createNode).toHaveBeenCalledWith('ngvge.node2d', expect.objectContaining({
            name: 'Child',
            parentId: 'runtime-node:parent'
        }));
    });

    test('encodes PatchNode and ReparentNode without exposing Runtime internals to the editor client', () => {
        const {client, parent, runtimeNodeModel, source} = createHarness();

        const patched = unwrapRuntimeNodeCommandResult(client.patchNode({
            nodeId: source.id,
            patch: {name: 'Renamed'}
        }));
        expect(patched.node.name).toBe('Renamed');

        const reparented = unwrapRuntimeNodeCommandResult(client.reparentNode({
            nodeId: source.id,
            parentId: parent.id
        }));
        expect(reparented.node.parentId).toBe(parent.id);
        expect(runtimeNodeModel.setParent).toHaveBeenCalledWith(source.id, parent.id, {});
    });

    test('supports DuplicateNode and DestroyNode for non-bound semantic nodes', () => {
        const {client, runtimeNodeModel, source} = createHarness();

        const duplicate = unwrapRuntimeNodeCommandResult(client.duplicateNode({nodeId: source.id}));
        expect(duplicate.node.id).toBe('runtime-node:duplicate');
        expect(runtimeNodeModel.duplicateNode).toHaveBeenCalledWith(source.id, {});

        const destroyed = unwrapRuntimeNodeCommandResult(client.destroyNode({nodeId: source.id}));
        expect(destroyed).toEqual({destroyed: true, nodeId: source.id});
        expect(runtimeNodeModel.destroyNode).toHaveBeenCalledWith(source.id);
    });

    test('routes Scratch-owned Sprite lifecycle mutations through the compatibility authority', async () => {
        const {client, compatibilityLifecycleAuthority, runtimeNodeModel, source} = createHarness({
            boundNodeId: 'runtime-node:source'
        });

        const patched = await unwrapRuntimeNodeCommandResultAsync(client.patchNode({
            nodeId: source.id,
            patch: {name: 'Renamed Sprite'}
        }));
        expect(patched.node.name).toBe('Renamed Sprite');

        const duplicated = await unwrapRuntimeNodeCommandResultAsync(client.duplicateNode({nodeId: source.id}));
        expect(duplicated.node.id).toBe('runtime-node:compat-duplicate');

        const reparented = await unwrapRuntimeNodeCommandResultAsync(client.reparentNode({
            nodeId: source.id,
            parentId: 'runtime-node:parent',
            options: {index: 0}
        }));
        expect(reparented.node.parentId).toBe('runtime-node:parent');

        const destroyed = await unwrapRuntimeNodeCommandResultAsync(client.destroyNode({nodeId: source.id}));
        expect(destroyed).toEqual({destroyed: true, nodeId: source.id});

        expect(compatibilityLifecycleAuthority.patchNode).toHaveBeenCalledWith({
            nodeId: source.id,
            patch: {name: 'Renamed Sprite'}
        });
        expect(compatibilityLifecycleAuthority.duplicateNode).toHaveBeenCalledWith({nodeId: source.id, options: {}});
        expect(compatibilityLifecycleAuthority.destroyNode).toHaveBeenCalledWith({nodeId: source.id});
        expect(compatibilityLifecycleAuthority.reparentNode).toHaveBeenCalledWith({
            nodeId: source.id,
            options: {index: 0},
            parentId: 'runtime-node:parent'
        });
        expect(runtimeNodeModel.patchNode).not.toHaveBeenCalled();
        expect(runtimeNodeModel.duplicateNode).not.toHaveBeenCalled();
        expect(runtimeNodeModel.destroyNode).not.toHaveBeenCalled();
    });

    test('routes semantic Sprite creation through the current compatibility lifecycle authority', async () => {
        const {client, compatibilityLifecycleAuthority, runtimeNodeModel} = createHarness();
        const payload = await unwrapRuntimeNodeCommandResultAsync(client.createNode({
            options: {
                name: 'Sprite',
                parentId: 'runtime-node:parent',
                sceneId: 'scene-a',
                scope: 'scene'
            },
            typeId: 'ngvge.sprite-node'
        }));

        expect(payload.node.id).toBe('runtime-node:compat-created');
        expect(compatibilityLifecycleAuthority.createNode).toHaveBeenCalledWith(expect.objectContaining({
            typeId: 'ngvge.sprite-node'
        }));
        expect(runtimeNodeModel.createNode).not.toHaveBeenCalled();
    });

    test('rejects compatibility/backend identity fields at the command boundary', () => {
        const {capability} = createHarness();
        const result = capability.executeCommand({
            kind: 'command',
            payload: {
                nodeId: 'runtime-node:source',
                patch: {name: 'X'},
                targetRuntimeId: 'scratch-target'
            },
            protocol: 'ngvge.engine-protocol',
            protocolVersion: 1,
            type: RUNTIME_NODE_COMMAND_TYPES.PATCH
        });
        expect(result.kind).toBe('error');
        expect(result.code).toBe('RUNTIME_NODE_COMMAND_BACKEND_IDENTITY_FORBIDDEN');

        const nested = capability.executeCommand({
            kind: 'command',
            payload: {
                options: {metadata: {targetRuntimeId: 'scratch-target'}},
                typeId: 'ngvge.node2d'
            },
            protocol: 'ngvge.engine-protocol',
            protocolVersion: 1,
            type: RUNTIME_NODE_COMMAND_TYPES.CREATE
        });
        expect(nested.kind).toBe('error');
        expect(nested.code).toBe('RUNTIME_NODE_COMMAND_BACKEND_IDENTITY_FORBIDDEN');
    });
});
