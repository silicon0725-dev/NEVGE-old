import React from 'react';
import renderer, {act} from 'react-test-renderer';

import WorkspaceWindowTransitionLayer from '../../../src/components/workspace-window-transition/workspace-window-transition.jsx';
import {
    WORKSPACE_DOCK_TRANSITION_MODEL_ID,
    DOCK_TRANSITION_KINDS
} from '../../../src/lib/editor-shell/dock-transition-model';

const createModel = transition => ({
    id: WORKSPACE_DOCK_TRANSITION_MODEL_ID,
    revision: 1,
    listTransitions: jest.fn(() => transition ? [transition] : []),
    subscribe: jest.fn(() => jest.fn()),
    completeTransition: jest.fn()
});

const transition = {
    transitionId: 'ngvge.dock-transition.1',
    kind: DOCK_TRANSITION_KINDS.MINIMIZE,
    windowId: 'project-explorer',
    from: {left: 100, top: 80, width: 420, height: 360},
    to: {left: 900, top: 700, width: 44, height: 44},
    durationMs: 500
};

describe('WS-3F WorkspaceWindowTransitionLayer', () => {
    test('renders an aria-hidden presentation ghost from transition records', () => {
        const model = createModel(transition);
        let tree;
        act(() => {
            tree = renderer.create(<WorkspaceWindowTransitionLayer transitionModel={model} />);
        });
        const layer = tree.root.findByProps({
            'data-ngvge-dock-transition-model': WORKSPACE_DOCK_TRANSITION_MODEL_ID
        });
        expect(layer.props['aria-hidden']).toBe('true');
        const ghost = tree.root.findByProps({
            'data-ngvge-dock-transition-id': transition.transitionId
        });
        expect(ghost.props['data-kind']).toBe(DOCK_TRANSITION_KINDS.MINIMIZE);
        expect(ghost.props.style).toMatchObject({
            left: '100px',
            top: '80px',
            width: '420px',
            height: '360px'
        });
        act(() => tree.unmount());
    });

    test('renders nothing when there are no active presentation transitions', () => {
        const model = createModel(null);
        let tree;
        act(() => {
            tree = renderer.create(<WorkspaceWindowTransitionLayer transitionModel={model} />);
        });
        expect(tree.toJSON()).toBeNull();
        act(() => tree.unmount());
    });
});
