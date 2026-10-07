import React from 'react';
import renderer, {act} from 'react-test-renderer';

import WorkspaceTodo from '../../../src/components/workspace-todo/workspace-todo.jsx';
import {TodoToolModel} from '../../../src/lib/editor-shell/todo-tool-model';
import {WorkspaceToolPersistenceService} from '../../../src/lib/editor-shell/workspace-tool-persistence';

const createModel = () => new TodoToolModel({
    persistenceService: new WorkspaceToolPersistenceService()
});

describe('WS-8 Workspace Todo UI', () => {
    test('renders as a managed Tool view and updates through its model', () => {
        const model = createModel();
        let tree;
        act(() => {
            tree = renderer.create(<WorkspaceTodo model={model} />);
        });
        expect(tree.root.findByProps({'data-ngvge-tool-id': 'ngvge.tool.todo'})).toBeTruthy();
        const input = tree.root.findByType('input');
        act(() => input.props.onChange({target: {value: 'Ship WS-8'}}));
        const form = tree.root.findByType('form');
        act(() => form.props.onSubmit({preventDefault: () => {}}));
        expect(JSON.stringify(tree.toJSON())).toContain('Ship WS-8');
    });

    test('toggle and remove actions use stable task identity', () => {
        const model = createModel();
        const id = model.add('Task A');
        let tree;
        act(() => {
            tree = renderer.create(<WorkspaceTodo model={model} />);
        });
        const checkbox = tree.root.findByProps({'data-task-id': id, type: 'checkbox'});
        act(() => checkbox.props.onChange({currentTarget: {dataset: {taskId: id}}}));
        expect(model.getSnapshot().tasks[0].completed).toBe(true);
        const remove = tree.root.findAllByProps({'data-task-id': id}).find(node => node.type === 'button');
        act(() => remove.props.onClick({currentTarget: {dataset: {taskId: id}}}));
        expect(model.getSnapshot().tasks).toHaveLength(0);
    });
});
