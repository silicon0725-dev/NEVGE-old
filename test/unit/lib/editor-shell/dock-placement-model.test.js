import {
    WORKSPACE_DOCK_PLACEMENT_MODEL_ID,
    DOCK_PLACEMENT_PREFERENCE_SCHEMA_ID,
    DOCK_PLACEMENT_PREFERENCE_SCHEMA_VERSION,
    DEFAULT_DOCK_PLACEMENT_PREFERENCE,
    normalizeDockPlacementPreference,
    projectDockGeometry,
    DockPlacementModel
} from '../../../../src/lib/editor-shell/dock-placement-model';

describe('WS-3C Dock Placement Model', () => {
    test('uses a versioned bottom-center runtime default without persistence', () => {
        const model = new DockPlacementModel();
        expect(model.id).toBe(WORKSPACE_DOCK_PLACEMENT_MODEL_ID);
        expect(model.schemaId).toBe(DOCK_PLACEMENT_PREFERENCE_SCHEMA_ID);
        expect(model.schemaVersion).toBe(DOCK_PLACEMENT_PREFERENCE_SCHEMA_VERSION);
        expect(model.getPreference()).toEqual(DEFAULT_DOCK_PLACEMENT_PREFERENCE);
        expect(model.getProjection()).toMatchObject({
            placement: 'bottom',
            alignment: 'center',
            orientation: 'horizontal',
            offsetX: 0,
            offsetY: 0
        });
    });

    test.each([
        ['top', 'horizontal'],
        ['bottom', 'horizontal'],
        ['left', 'vertical'],
        ['right', 'vertical']
    ])('projects %s placement to %s orientation', (placement, orientation) => {
        const projection = projectDockGeometry({
            placement,
            alignment: 'center',
            offsetX: 12,
            offsetY: -8
        });
        expect(projection).toMatchObject({
            placement,
            orientation,
            offsetX: 12,
            offsetY: -8
        });
        expect(projection.cssVariables).toEqual({
            '--ngvge-dock-offset-x': '12px',
            '--ngvge-dock-offset-y': '-8px'
        });
    });

    test('supports start/center/end alignment and screen-axis offsets independently', () => {
        const model = new DockPlacementModel();
        const events = [];
        model.subscribe(event => events.push(event));
        expect(model.setPlacement('left')).toBe(true);
        expect(model.setAlignment('end')).toBe(true);
        expect(model.setOffsets({offsetX: 18, offsetY: -24})).toBe(true);
        expect(model.getProjection()).toMatchObject({
            placement: 'left',
            alignment: 'end',
            orientation: 'vertical',
            offsetX: 18,
            offsetY: -24
        });
        expect(events).toHaveLength(3);
        expect(events[2]).toMatchObject({
            modelId: WORKSPACE_DOCK_PLACEMENT_MODEL_ID,
            type: 'dock:placement-changed',
            revision: 3
        });
    });

    test('is fail-closed for invalid enum, offset, schema, and patch inputs', () => {
        expect(() => normalizeDockPlacementPreference({placement: 'floating'})).toThrow(/placement/);
        expect(() => normalizeDockPlacementPreference({alignment: 'middle'})).toThrow(/alignment/);
        expect(() => normalizeDockPlacementPreference({offsetX: Infinity})).toThrow(/offsetX/);
        expect(() => normalizeDockPlacementPreference({schemaVersion: 2})).toThrow(/Unsupported/);
        expect(() => normalizeDockPlacementPreference({placement: 'bottom', backendId: 'scratch'})).toThrow(/unsupported field/);
        const model = new DockPlacementModel();
        expect(() => model.patchPreference(null)).toThrow(/plain object/);
        expect(() => model.patchPreference({windowId: 'stage'})).toThrow(/unsupported field/);
    });

    test('does not emit a revision for semantic no-op updates', () => {
        const model = new DockPlacementModel();
        expect(model.setPreference(DEFAULT_DOCK_PLACEMENT_PREFERENCE)).toBe(false);
        expect(model.revision).toBe(0);
    });
});
