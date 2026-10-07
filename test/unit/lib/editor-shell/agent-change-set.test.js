import {
    AGENT_CHANGESET_STATES,
    WORKSPACE_AGENT_CHANGESET_MODEL_ID,
    createAgentChangeSet,
    withAgentChangeSetState
} from '../../../../src/lib/editor-shell/agent-change-set';

describe('WS-7 Agent ChangeSet contract', () => {
    test('normalizes portable reversible Node operations', () => {
        const changeSet = createAgentChangeSet({
            changeSetId: 'ngvge.changeset.test-1',
            summary: 'Rename selected node',
            operations: [{
                command: {type: 'PatchNode', nodeId: 'node:a', patch: {name: 'Renamed'}}
            }]
        });
        expect(changeSet).toMatchObject({
            modelId: WORKSPACE_AGENT_CHANGESET_MODEL_ID,
            state: AGENT_CHANGESET_STATES.PROPOSED,
            changeSetId: 'ngvge.changeset.test-1'
        });
        expect(changeSet.operations[0]).toMatchObject({
            operationId: 'op-1',
            kind: 'workspace-node-command',
            command: {type: 'PatchNode', nodeId: 'node:a'}
        });
        expect(Object.isFrozen(changeSet)).toBe(true);
    });

    test('rejects destructive commands until a reversible transaction adapter exists', () => {
        expect(() => createAgentChangeSet({
            summary: 'Delete node',
            operations: [{command: {type: 'DestroyNode', nodeId: 'node:a'}}]
        })).toThrow(/reversible/i);
    });

    test('rejects backend identity smuggling recursively', () => {
        expect(() => createAgentChangeSet({
            summary: 'Unsafe proposal',
            operations: [{
                command: {
                    type: 'PatchNode',
                    nodeId: 'node:a',
                    patch: {source: {renderer: {id: 1}}}
                }
            }]
        })).toThrow(/backend identity/i);
    });

    test('supports explicit review state transitions without mutating the original proposal', () => {
        const proposed = createAgentChangeSet({
            summary: 'Rename',
            operations: [{command: {type: 'PatchNode', nodeId: 'node:a', patch: {name: 'B'}}}]
        });
        const approved = withAgentChangeSetState(proposed, AGENT_CHANGESET_STATES.APPROVED);
        expect(proposed.state).toBe(AGENT_CHANGESET_STATES.PROPOSED);
        expect(approved.state).toBe(AGENT_CHANGESET_STATES.APPROVED);
    });
});
