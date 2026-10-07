import {
    COLLIDER_GIZMO_GLOBAL_MODE,
    COLLIDER_GIZMO_VISIBILITY,
    getColliderGizmoPreferences
} from '../../../../src/lib/editor-visualization';

describe('WS-10N6-HF2 Collider gizmo editor preferences', () => {
    test('defaults to scene-wide visibility without entering collider semantics', () => {
        const runtime = {};
        const preferences = getColliderGizmoPreferences(runtime);
        expect(preferences.getGlobalMode()).toBe(COLLIDER_GIZMO_GLOBAL_MODE.ALL);
        expect(preferences.getNodeVisibility('body-a')).toBe(COLLIDER_GIZMO_VISIBILITY.INHERIT);
        expect(preferences.shouldShow('body-a', 'body-b')).toBe(true);
    });

    test('supports per-node hidden, selected-only and always overrides', () => {
        const runtime = {};
        const preferences = getColliderGizmoPreferences(runtime);

        preferences.setNodeVisibility('body-a', COLLIDER_GIZMO_VISIBILITY.HIDDEN);
        expect(preferences.shouldShow('body-a', 'body-a')).toBe(false);

        preferences.setNodeVisibility('body-a', COLLIDER_GIZMO_VISIBILITY.SELECTED);
        expect(preferences.shouldShow('body-a', 'body-b')).toBe(false);
        expect(preferences.shouldShow('body-a', 'body-a')).toBe(true);

        preferences.setGlobalMode(COLLIDER_GIZMO_GLOBAL_MODE.HIDDEN);
        preferences.setNodeVisibility('body-a', COLLIDER_GIZMO_VISIBILITY.ALWAYS);
        expect(preferences.shouldShow('body-a', 'body-b')).toBe(true);
    });

    test('notifies editor subscribers without mutating runtime project data', () => {
        const runtime = {projectData: {sentinel: true}};
        const preferences = getColliderGizmoPreferences(runtime);
        const listener = jest.fn();
        const unsubscribe = preferences.subscribe(listener);
        preferences.setNodeVisibility('body-a', COLLIDER_GIZMO_VISIBILITY.HIDDEN);
        expect(listener).toHaveBeenCalledWith(expect.objectContaining({
            nodeId: 'body-a',
            type: 'node-visibility',
            visibility: COLLIDER_GIZMO_VISIBILITY.HIDDEN
        }));
        expect(runtime.projectData).toEqual({sentinel: true});
        unsubscribe();
    });

    test('keeps expensive overlap highlighting opt-in and editor-only', () => {
        const runtime = {projectData: {sentinel: true}};
        const preferences = getColliderGizmoPreferences(runtime);
        const listener = jest.fn();
        preferences.subscribe(listener);
        expect(preferences.getShowOverlapState()).toBe(false);
        expect(preferences.setShowOverlapState(true)).toBe(true);
        expect(preferences.getShowOverlapState()).toBe(true);
        expect(listener).toHaveBeenCalledWith(expect.objectContaining({type: 'overlap-state', showOverlapState: true}));
        expect(runtime.projectData).toEqual({sentinel: true});
    });

    test('keeps the selected authoring shape visible when global debug shapes are off', () => {
        const preferences = getColliderGizmoPreferences({});
        preferences.setGlobalMode(COLLIDER_GIZMO_GLOBAL_MODE.HIDDEN);
        expect(preferences.shouldShow('body-a', 'body-a')).toBe(true);
        expect(preferences.shouldShow('body-b', 'body-a')).toBe(false);
        preferences.setNodeVisibility('body-a', COLLIDER_GIZMO_VISIBILITY.HIDDEN);
        expect(preferences.shouldShow('body-a', 'body-a')).toBe(false);
    });
});
