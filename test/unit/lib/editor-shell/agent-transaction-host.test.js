import {AGENT_CHANGESET_STATES, createAgentChangeSet, withAgentChangeSetState} from '../../../../src/lib/editor-shell/agent-change-set';
import {
    AGENT_TRANSACTION_STATES,
    WORKSPACE_AGENT_TRANSACTION_HOST_ID,
    createWorkspaceAgentTransactionHost
} from '../../../../src/lib/editor-shell/agent-transaction-host';
import {
    WORKSPACE_NODE_DOMAINS,
    createWorkspaceNodeCommandHost
} from '../../../../src/lib/editor-shell/node-workspace-command';

const createDatabase = () => {
    const nodes = new Map([
        ['node:a', {
            childIds: [], enabled: true, id: 'node:a', name: 'A', parentId: null,
            properties: {speed: 1}, targetId: null, typeId: 'ngvge.node'
        }]
    ]);
    let sequence = 0;
    return {
        nodes,
        createNode: jest.fn((typeId, parentId, options) => {
            if (options && options.fail) throw new Error('create failed');
            const node = {
                childIds: [], enabled: true, id: `node:new-${++sequence}`,
                name: options.name || 'New', parentId, properties: {}, targetId: null, typeId
            };
            nodes.set(node.id, node);
            return {...node};
        }),
        deleteNodes: jest.fn(nodeIds => nodeIds.forEach(nodeId => nodes.delete(nodeId))),
        duplicateNodes: jest.fn(nodeIds => nodeIds.map(nodeId => {
            const source = nodes.get(nodeId);
            const node = {...source, id: `node:copy-${++sequence}`, childIds: []};
            nodes.set(node.id, node);
            return {...node};
        })),
        getNode: jest.fn(nodeId => {
            const node = nodes.get(nodeId);
            return node ? JSON.parse(JSON.stringify(node)) : null;
        }),
        renameNode: jest.fn((nodeId, name) => Object.assign(nodes.get(nodeId), {name})),
        reparentNodes: jest.fn((nodeIds, parentId) => nodeIds.forEach(nodeId => {
            if (parentId === 'node:missing') throw new Error('parent missing');
            Object.assign(nodes.get(nodeId), {parentId});
        })),
        setNodeEnabled: jest.fn((nodeId, enabled) => Object.assign(nodes.get(nodeId), {enabled})),
        setNodeProperty: jest.fn((nodeId, fieldId, value) => {
            const node = nodes.get(nodeId);
            node.properties = {...node.properties, [fieldId]: value};
        })
    };
};

const approved = proposal => withAgentChangeSetState(createAgentChangeSet(proposal), AGENT_CHANGESET_STATES.APPROVED);

const createFixture = () => {
    const database = createDatabase();
    const workspaceNodeCommandHost = createWorkspaceNodeCommandHost({projectNodeDatabase: database});
    const transactionHost = createWorkspaceAgentTransactionHost({workspaceNodeCommandHost});
    return {database, transactionHost, workspaceNodeCommandHost};
};

describe('WS-7 reviewed Agent transaction host', () => {
    test('requires explicit ChangeSet review before mutation', async () => {
        const {transactionHost} = createFixture();
        const proposed = createAgentChangeSet({
            summary: 'Rename',
            operations: [{command: {type: 'PatchNode', nodeId: 'node:a', patch: {name: 'B'}}}]
        });
        await expect(transactionHost.applyChangeSet(proposed)).rejects.toMatchObject({
            code: 'NGVGE_AGENT_CHANGESET_REVIEW_REQUIRED'
        });
    });

    test('commits reviewed patch and supports generated rollback', async () => {
        const {database, transactionHost} = createFixture();
        expect(transactionHost.hostId).toBe(WORKSPACE_AGENT_TRANSACTION_HOST_ID);
        const transaction = await transactionHost.applyChangeSet(approved({
            summary: 'Rename and disable',
            operations: [{command: {
                type: 'PatchNode',
                nodeId: 'node:a',
                patch: {name: 'B', enabled: false, properties: {speed: 2}}
            }}]
        }));
        expect(transaction.state).toBe(AGENT_TRANSACTION_STATES.COMMITTED);
        expect(database.nodes.get('node:a')).toMatchObject({name: 'B', enabled: false, properties: {speed: 2}});
        const rolledBack = await transactionHost.rollback(transaction.transactionId);
        expect(rolledBack.state).toBe(AGENT_TRANSACTION_STATES.ROLLED_BACK);
        expect(database.nodes.get('node:a')).toMatchObject({name: 'A', enabled: true, properties: {speed: 1}});
    });

    test('rolls back created and duplicated nodes through trusted compensation commands', async () => {
        const {database, transactionHost} = createFixture();
        const transaction = await transactionHost.applyChangeSet(approved({
            summary: 'Create and duplicate',
            operations: [
                {command: {
                    type: 'CreateNode', domain: WORKSPACE_NODE_DOMAINS.PROJECT_COMPATIBILITY,
                    typeId: 'ngvge.node', parentId: null, options: {name: 'Created'}
                }},
                {command: {type: 'DuplicateNode', nodeId: 'node:a'}}
            ]
        }));
        expect(database.nodes.size).toBe(3);
        await transactionHost.rollback(transaction.transactionId);
        expect(Array.from(database.nodes.keys())).toEqual(['node:a']);
    });

    test('fails closed when a project property patch cannot be exactly compensated', async () => {
        const {database, transactionHost} = createFixture();
        const changeSet = approved({
            summary: 'Introduce property without delete compensation',
            operations: [{command: {
                type: 'PatchNode', nodeId: 'node:a', patch: {properties: {newField: 1}}
            }}]
        });
        await expect(transactionHost.applyChangeSet(changeSet)).rejects.toMatchObject({
            code: 'NGVGE_AGENT_PATCH_ROLLBACK_UNAVAILABLE'
        });
        expect(database.nodes.get('node:a').properties).toEqual({speed: 1});
    });

    test('marks an undo transaction rollback-failed when trusted compensation cannot commit', async () => {
        const {database, transactionHost} = createFixture();
        const transaction = await transactionHost.applyChangeSet(approved({
            summary: 'Rename for rollback failure test',
            operations: [{command: {type: 'PatchNode', nodeId: 'node:a', patch: {name: 'B'}}}]
        }));
        database.renameNode.mockImplementation((nodeId, name) => {
            if (name === 'A') throw new Error('rollback write failed');
            return Object.assign(database.nodes.get(nodeId), {name});
        });
        await expect(transactionHost.rollback(transaction.transactionId)).rejects.toMatchObject({
            code: 'NGVGE_AGENT_TRANSACTION_ROLLBACK_FAILED'
        });
        expect(transactionHost.getTransaction(transaction.transactionId).state).toBe(
            AGENT_TRANSACTION_STATES.ROLLBACK_FAILED
        );
    });

    test('automatically compensates earlier operations when a later operation fails', async () => {
        const {database, transactionHost} = createFixture();
        const changeSet = approved({
            summary: 'Atomic failure',
            operations: [
                {command: {type: 'PatchNode', nodeId: 'node:a', patch: {name: 'Temporary'}}},
                {command: {
                    type: 'CreateNode', domain: WORKSPACE_NODE_DOMAINS.PROJECT_COMPATIBILITY,
                    typeId: 'ngvge.node', parentId: null, options: {fail: true}
                }}
            ]
        });
        await expect(transactionHost.applyChangeSet(changeSet)).rejects.toMatchObject({
            code: 'NGVGE_AGENT_TRANSACTION_FAILED'
        });
        expect(database.nodes.get('node:a').name).toBe('A');
    });
});
