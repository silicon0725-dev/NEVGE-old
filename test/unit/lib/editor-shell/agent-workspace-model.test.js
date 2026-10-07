import {AGENT_CHANGESET_STATES} from '../../../../src/lib/editor-shell/agent-change-set';
import {WorkspaceAgentModel, WORKSPACE_AGENT_MODEL_ID} from '../../../../src/lib/editor-shell/agent-workspace-model';
import {AGENT_TRANSACTION_STATES} from '../../../../src/lib/editor-shell/agent-transaction-host';

const proposal = () => ({
    summary: 'Rename selected node',
    rationale: 'Use a clearer name.',
    operations: [{command: {type: 'PatchNode', nodeId: 'node:a', patch: {name: 'Clear Name'}}}]
});

describe('WS-7 Workspace Agent model', () => {
    test('exposes bounded context and proposal review state', () => {
        const model = new WorkspaceAgentModel({
            transactionHost: {applyChangeSet: jest.fn(), rollback: jest.fn()},
            getCurrentContext: () => ({nodeId: 'node:a', node: {id: 'node:a', name: 'A'}})
        });
        expect(model.id).toBe(WORKSPACE_AGENT_MODEL_ID);
        const changeSet = model.proposeChangeSet(proposal());
        const view = model.getView();
        expect(view.context.nodeId).toBe('node:a');
        expect(view.changeSets[0].changeSetId).toBe(changeSet.changeSetId);
        expect(view.whatAIcannotSee).toContain('Raw VM object');
    });

    test('rejects proposals without entering transaction authority', () => {
        const transactionHost = {applyChangeSet: jest.fn(), rollback: jest.fn()};
        const model = new WorkspaceAgentModel({transactionHost});
        const changeSet = model.proposeChangeSet(proposal());
        const rejected = model.rejectChangeSet(changeSet.changeSetId);
        expect(rejected.state).toBe(AGENT_CHANGESET_STATES.REJECTED);
        expect(transactionHost.applyChangeSet).not.toHaveBeenCalled();
    });

    test('applies only through transaction host and records undo history', async () => {
        const transactionHost = {
            applyChangeSet: jest.fn(async changeSet => ({
                transactionId: 'ngvge.agent.transaction.1',
                changeSetId: changeSet.changeSetId,
                state: AGENT_TRANSACTION_STATES.COMMITTED
            })),
            rollback: jest.fn(async transactionId => ({
                transactionId,
                state: AGENT_TRANSACTION_STATES.ROLLED_BACK
            }))
        };
        const model = new WorkspaceAgentModel({transactionHost});
        const changeSet = model.proposeChangeSet(proposal());
        const applied = await model.applyChangeSet(changeSet.changeSetId);
        expect(applied.state).toBe(AGENT_CHANGESET_STATES.APPLIED);
        expect(transactionHost.applyChangeSet.mock.calls[0][0].state).toBe(AGENT_CHANGESET_STATES.APPROVED);
        expect(model.getView().history[0].state).toBe(AGENT_TRANSACTION_STATES.COMMITTED);
        await model.undo('ngvge.agent.transaction.1');
        expect(model.getView().history[0].state).toBe(AGENT_TRANSACTION_STATES.ROLLED_BACK);
        expect(model.getView().changeSets[0].state).toBe(AGENT_CHANGESET_STATES.ROLLED_BACK);
    });
});
