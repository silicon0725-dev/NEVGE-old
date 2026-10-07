import React from 'react';
import renderer, {act} from 'react-test-renderer';

import WorkspaceAgent from '../../../src/components/workspace-agent/workspace-agent.jsx';
import {WorkspaceAgentModel} from '../../../src/lib/editor-shell/agent-workspace-model';
import {AGENT_TRANSACTION_STATES} from '../../../src/lib/editor-shell/agent-transaction-host';

const createModel = () => {
    const transactionHost = {
        applyChangeSet: jest.fn(async changeSet => ({
            transactionId: 'ngvge.agent.transaction.ui',
            changeSetId: changeSet.changeSetId,
            state: AGENT_TRANSACTION_STATES.COMMITTED
        })),
        rollback: jest.fn(async transactionId => ({transactionId, state: AGENT_TRANSACTION_STATES.ROLLED_BACK}))
    };
    const model = new WorkspaceAgentModel({
        transactionHost,
        getCurrentContext: () => ({
            nodeId: 'node:a',
            node: {id: 'node:a', name: 'A', typeId: 'ngvge.node', domain: 'project-compatibility', enabled: true}
        })
    });
    const changeSet = model.proposeChangeSet({
        summary: 'Rename A',
        operations: [{command: {type: 'PatchNode', nodeId: 'node:a', patch: {name: 'B'}}}]
    });
    return {changeSet, model, transactionHost};
};

describe('WS-7 Workspace Agent UI', () => {
    test('renders context, portable diff, review actions, and no raw mutation surface', () => {
        const {model} = createModel();
        let tree;
        act(() => {
            tree = renderer.create(<WorkspaceAgent model={model} />);
        });
        const root = tree.root.findByProps({'data-ngvge-agent-model': 'ngvge.workspace-agent-model@1'});
        expect(root).toBeTruthy();
        expect(tree.root.findAllByProps({'data-agent-changeset-id': model.getView().changeSets[0].changeSetId})).toHaveLength(1);
        expect(JSON.stringify(tree.toJSON())).toContain('No raw VM / renderer mutation');
        expect(JSON.stringify(tree.toJSON())).toContain('PatchNode');
    });

    test('Apply delegates to reviewed transaction model and Undo delegates rollback', async () => {
        const {model, transactionHost} = createModel();
        let tree;
        await act(async () => {
            tree = renderer.create(<WorkspaceAgent model={model} />);
        });
        const applyButton = tree.root.findAllByType('button').find(button =>
            String(button.children.join('')).includes('Apply reviewed ChangeSet'));
        await act(async () => {
            await applyButton.props.onClick();
        });
        expect(transactionHost.applyChangeSet).toHaveBeenCalledTimes(1);
        const undoButton = tree.root.findAllByType('button').find(button => button.children.join('') === 'Undo');
        await act(async () => {
            await undoButton.props.onClick();
        });
        expect(transactionHost.rollback).toHaveBeenCalledWith('ngvge.agent.transaction.ui');
    });
});
