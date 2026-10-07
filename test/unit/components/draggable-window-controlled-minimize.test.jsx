import React from 'react';
import renderer, {act} from 'react-test-renderer';

import DraggableWindow from '../../../src/components/draggable-window/draggable-window.jsx';

describe('WS-3F controlled DraggableWindow minimize semantics', () => {
    test('controlled minimize requests semantic owner first and waits for committed prop projection', () => {
        const onMinimizeToggle = jest.fn();
        let tree;
        act(() => {
            tree = renderer.create(
                <DraggableWindow
                    enableStatePersistence={false}
                    isMinimized={false}
                    title="Test Window"
                    windowId="test-window"
                    onMinimizeToggle={onMinimizeToggle}
                >
                    <span>body</span>
                </DraggableWindow>
            );
        });
        const minimize = tree.root.findAllByType('button').find(button => button.props.title === 'Minimize');
        act(() => minimize.props.onClick());
        expect(onMinimizeToggle).toHaveBeenCalledWith('test-window', true);
        expect(tree.root.findByProps({'data-ngvge-window-id': 'test-window'})).toBeTruthy();

        act(() => {
            tree.update(
                <DraggableWindow
                    enableStatePersistence={false}
                    isMinimized
                    title="Test Window"
                    windowId="test-window"
                    onMinimizeToggle={onMinimizeToggle}
                >
                    <span>body</span>
                </DraggableWindow>
            );
        });
        expect(tree.toJSON()).toBeNull();
        tree.unmount();
    });
});
