import {
    PROJECT_NODE_COMPATIBILITY_ADAPTER_ID,
    WORKSPACE_NODE_COMMAND_HOST_ID,
    WORKSPACE_NODE_DOMAINS,
    createWorkspaceNodeCommandClient,
    createWorkspaceNodeCommandHost
} from '../../../../src/lib/editor-shell/node-workspace-command';
import {TOOL_IDS} from '../../../../src/lib/editor-shell/tool-registry';
import {createEngineEvent} from '../../../../src/core/protocol';

const createProjectDatabase = () => {
    const nodes = new Map([
        ['project-node:a', {id: 'project-node:a', name: 'A', parentId: null, targetId: null, typeId: 'ngvge.node'}]
    ]);
    return {
        createNode: jest.fn((typeId, parentId, options) => {
            const node = {id: 'project-node:new', name: options.name, parentId, targetId: null, typeId};
            nodes.set(node.id, node);
            return node;
        }),
        deleteNodes: jest.fn(nodeIds => nodeIds.forEach(nodeId => nodes.delete(nodeId))),
        duplicateNodes: jest.fn(nodeIds => nodeIds.map(nodeId => {
            const source = nodes.get(nodeId);
            const node = Object.assign({}, source, {id: `${nodeId}:copy`});
            nodes.set(node.id, node);
            return node;
        })),
        getNode: jest.fn(nodeId => nodes.get(nodeId) || null),
        renameNode: jest.fn((nodeId, name) => Object.assign(nodes.get(nodeId), {name})),
        reparentNodes: jest.fn((nodeIds, parentId) => nodeIds.forEach(nodeId => Object.assign(nodes.get(nodeId), {parentId}))),
        setNodeEnabled: jest.fn((nodeId, enabled) => Object.assign(nodes.get(nodeId), {enabled})),
        setNodeProperty: jest.fn((nodeId, fieldId, value) => {
            const node = nodes.get(nodeId);
            node.properties = Object.assign({}, node.properties, {[fieldId]: value});
        })
    };
};

const createFixture = () => {
    const projectNodeDatabase = createProjectDatabase();
    const runtimeNode = {id: 'runtime-node:a', name: 'Runtime A'};
    const runtimeNodeModel = {getNodeSnapshot: nodeId => nodeId === runtimeNode.id ? runtimeNode : null};
    const executeCommand = jest.fn(command => createEngineEvent(
        command.type === 'PatchNode' ? 'NodePatched' : 'NodeCommandApplied',
        command.type === 'PatchNode' ? {node: Object.assign({}, runtimeNode, command.payload.patch)} : {nodeId: runtimeNode.id}
    ));
    const selectionWriter = jest.fn();
    const host = createWorkspaceNodeCommandHost({
        projectNodeDatabase,
        selectionWriter,
        getRuntimeNodeModel: () => runtimeNodeModel,
        getRuntimeNodeCommandCapability: () => ({
            capabilityId: 'ngvge.runtime-node-command',
            executeCommand,
            version: 1
        })
    });
    const explorerClient = createWorkspaceNodeCommandClient(host, TOOL_IDS.NODE_EXPLORER);
    const inspectorClient = createWorkspaceNodeCommandClient(host, TOOL_IDS.INSPECTOR);
    return {executeCommand, explorerClient, host, inspectorClient, projectNodeDatabase, selectionWriter};
};

describe('WS-5 Workspace Node Command Host', () => {
    test('owns stable host identity and explicit project compatibility adapter', () => {
        const {host} = createFixture();
        expect(host.hostId).toBe(WORKSPACE_NODE_COMMAND_HOST_ID);
        expect(host.getProjectCompatibilityAdapterId()).toBe(PROJECT_NODE_COMPATIBILITY_ADAPTER_ID);
    });

    test('routes semantic selection through a stable NodeId writer', () => {
        const {explorerClient, selectionWriter} = createFixture();
        expect(explorerClient.selectNode({nodeId: 'runtime-node:a'})).toEqual({nodeId: 'runtime-node:a', selected: true});
        expect(selectionWriter).toHaveBeenCalledWith('runtime-node:a');
    });

    test('routes runtime mutations through the Runtime Node Engine Protocol capability', () => {
        const {executeCommand, inspectorClient} = createFixture();
        const result = inspectorClient.patchNode({nodeId: 'runtime-node:a', patch: {name: 'Renamed'}});
        expect(result.node.name).toBe('Renamed');
        expect(executeCommand).toHaveBeenCalledTimes(1);
        expect(executeCommand.mock.calls[0][0]).toMatchObject({
            kind: 'command',
            payload: {nodeId: 'runtime-node:a', patch: {name: 'Renamed'}},
            type: 'PatchNode'
        });
    });

    test('routes runtime lifecycle and hierarchy commands through the same Engine Protocol client', () => {
        const {executeCommand, explorerClient} = createFixture();
        explorerClient.createNode({
            domain: WORKSPACE_NODE_DOMAINS.RUNTIME,
            options: {name: 'Child'},
            parentId: 'runtime-node:a',
            typeId: 'ngvge.node'
        });
        explorerClient.duplicateNode({nodeId: 'runtime-node:a'});
        explorerClient.reparentNode({nodeId: 'runtime-node:a', parentId: 'runtime-root'});
        explorerClient.destroyNode({nodeId: 'runtime-node:a'});
        expect(executeCommand.mock.calls.map(call => call[0].type)).toEqual([
            'CreateNode',
            'DuplicateNode',
            'ReparentNode',
            'DestroyNode'
        ]);
    });

    test('rejects clients without approved ToolId provenance', () => {
        const {host} = createFixture();
        expect(() => createWorkspaceNodeCommandClient(host, 'ngvge.tool.unknown')).toThrow(/unsupported/i);
        expect(() => createWorkspaceNodeCommandClient(host, TOOL_IDS.AGENT)).toThrow(/interactive/i);
    });

    test('rejects Agent provenance without the reviewed transaction authorization seam', () => {
        const {host} = createFixture();
        let caught = null;
        try {
            host.execute({
                schemaVersion: 1,
                toolId: TOOL_IDS.AGENT,
                type: 'PatchNode',
                nodeId: 'runtime-node:a',
                patch: {name: 'Bypass'}
            });
        } catch (error) {
            caught = error;
        }
        expect(caught).toMatchObject({code: 'NGVGE_AGENT_NODE_REVIEW_REQUIRED'});
    });

    test('quarantines project NodeDatabase writes behind the compatibility adapter', () => {
        const {explorerClient, projectNodeDatabase} = createFixture();
        const created = explorerClient.createNode({
            domain: WORKSPACE_NODE_DOMAINS.PROJECT_COMPATIBILITY,
            options: {name: 'Created'},
            parentId: null,
            typeId: 'ngvge.node'
        });
        explorerClient.patchNode({nodeId: created.node.id, patch: {enabled: false, name: 'Edited'}});
        expect(projectNodeDatabase.createNode).toHaveBeenCalledWith('ngvge.node', null, {name: 'Created'});
        expect(projectNodeDatabase.renameNode).toHaveBeenCalledWith(created.node.id, 'Edited');
        expect(projectNodeDatabase.setNodeEnabled).toHaveBeenCalledWith(created.node.id, false);
    });

    test('resolves existing NodeIds without exposing Scratch target identity', () => {
        const {host} = createFixture();
        expect(host.resolveDomain('runtime-node:a')).toBe(WORKSPACE_NODE_DOMAINS.RUNTIME);
        expect(host.resolveDomain('project-node:a')).toBe(WORKSPACE_NODE_DOMAINS.PROJECT_COMPATIBILITY);
    });

    test('exposes portable Node snapshots without granting Agent direct mutation client access', () => {
        const {explorerClient, host} = createFixture();
        expect(explorerClient.getNodeSnapshot({nodeId: 'project-node:a'})).toMatchObject({
            domain: WORKSPACE_NODE_DOMAINS.PROJECT_COMPATIBILITY,
            node: {id: 'project-node:a', name: 'A'}
        });
        expect(host.getNodeSnapshot('runtime-node:a')).toMatchObject({
            domain: WORKSPACE_NODE_DOMAINS.RUNTIME,
            node: {id: 'runtime-node:a'}
        });
    });

    test('fails closed when command DTO attempts to smuggle backend identity', () => {
        const {host} = createFixture();
        expect(() => host.execute({
            nodeId: 'runtime-node:a',
            schemaVersion: 1,
            options: {backendId: 'scratch-backend'},
            targetId: 'scratch-target',
            toolId: TOOL_IDS.NODE_EXPLORER,
            type: 'DestroyNode'
        })).toThrow(/forbids backend identity/);
    });

    test('rejects mixed runtime and project compatibility batches', () => {
        const {explorerClient} = createFixture();
        expect(() => explorerClient.destroyNodes({nodeIds: ['runtime-node:a', 'project-node:a']})).toThrow(/cannot mix/);
    });
});
