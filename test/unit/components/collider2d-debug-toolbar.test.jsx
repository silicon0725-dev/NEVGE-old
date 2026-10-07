import React from 'react';
import renderer, {act} from 'react-test-renderer';

import Collider2DDebugToolbar from '../../../src/components/stage/collider2d-debug-toolbar.jsx';
import {COLLIDER2D_RUNTIME_CAPABILITY_ID} from '../../../src/lib/collision-system';
import {
    COLLIDER_GIZMO_GLOBAL_MODE,
    getColliderGizmoPreferences
} from '../../../src/lib/editor-visualization';

const mounted = [];
afterEach(() => {
    while (mounted.length) act(() => mounted.pop().unmount());
});

const makeVM = () => {
    const listeners = new Set();
    const colliderRuntime = {
        getStatus: jest.fn(() => ({activeColliderCount: 2})),
        subscribe: listener => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    };
    const emitColliderChange = change => listeners.forEach(listener => listener(change));
    const runtime = {
        ngvgeFirstPartyModules: {
            getCapability: id => id === COLLIDER2D_RUNTIME_CAPABILITY_ID ? colliderRuntime : null
        }
    };
    return {colliderRuntime, emitColliderChange, runtime, vm: {runtime}};
};

describe('WS-10N6-HF4 visible collision shapes toolbar', () => {
    test('does not rerender status for transient authoring preview notifications', () => {
        const {colliderRuntime, emitColliderChange, vm} = makeVM();
        let component;
        act(() => {
            component = renderer.create(<Collider2DDebugToolbar vm={vm} />);
        });
        mounted.push(component);
        expect(colliderRuntime.getStatus).toHaveBeenCalledTimes(1);

        act(() => {
            emitColliderChange({type: 'authoring-preview-begin'});
            emitColliderChange({type: 'authoring-preview-patch'});
            emitColliderChange({type: 'authoring-preview-cancel'});
        });
        expect(colliderRuntime.getStatus).toHaveBeenCalledTimes(1);

        act(() => emitColliderChange({type: 'persistent-collider-patch'}));
        expect(colliderRuntime.getStatus).toHaveBeenCalledTimes(2);
    });

    test('exposes Godot-style scene-wide All / Selected / Off debug modes', () => {
        const {runtime, vm} = makeVM();
        let component;
        act(() => {
            component = renderer.create(<Collider2DDebugToolbar vm={vm} />);
        });
        mounted.push(component);
        const select = component.root.findByProps({'aria-label': 'Visible collision shapes'});
        expect(select.props.value).toBe(COLLIDER_GIZMO_GLOBAL_MODE.ALL);
        act(() => {
            select.props.onChange({target: {value: COLLIDER_GIZMO_GLOBAL_MODE.HIDDEN}});
        });
        expect(getColliderGizmoPreferences(runtime).getGlobalMode()).toBe(COLLIDER_GIZMO_GLOBAL_MODE.HIDDEN);

        const contacts = component.root.findByProps({'aria-label': 'Highlight collision overlaps'});
        expect(contacts.props.checked).toBe(false);
        act(() => { contacts.props.onChange({target: {checked: true}}); });
        expect(getColliderGizmoPreferences(runtime).getShowOverlapState()).toBe(true);
    });
});
