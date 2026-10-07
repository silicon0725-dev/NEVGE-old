import {
    NATIVE_PAINT_EDITOR_MODES,
    NATIVE_PAINT_HOST_ID,
    NATIVE_PAINT_MODES,
    NATIVE_PAINT_PRESENTATION_ID,
    createNativePaintHostBinding,
    resolveCostumeDataFormat
} from '../../../../src/lib/editor-shell/native-paint-host';

const VECTOR_RESOURCE_ID = 'ngvge:resource:11111111-1111-4111-8111-111111111111';
const SECOND_RESOURCE_ID = 'ngvge:resource:22222222-2222-4222-8222-222222222222';

const createTarget = costumes => ({
    id: 'target-1',
    isOriginal: true,
    sprite: {costumes},
    getCostumes () {
        return this.sprite.costumes;
    }
});

const createSession = ({selectedResourceId = null, dirty = false} = {}) => {
    let selected = selectedResourceId;
    let workingCopy = selected ? {
        loaded: true,
        dirty,
        resourceId: selected
    } : {
        loaded: false,
        dirty: false,
        resourceId: null
    };
    return {
        getState: jest.fn(() => ({selectedResourceId: selected, workingCopy})),
        selectResource: jest.fn(resourceId => {
            selected = resourceId || null;
            workingCopy = selected ? {loaded: true, dirty: false, resourceId: selected} : {
                loaded: false,
                dirty: false,
                resourceId: null
            };
        })
    };
};

const createAssetDatabase = ({existing = null, ensured = VECTOR_RESOURCE_ID} = {}) => ({
    getCostumeResourceId: jest.fn(() => existing),
    ensureCostumeResource: jest.fn(() => ensured)
});

describe('WS-10G1-HF1 Native Paint host binding and explicit editor modes', () => {
    test('adopts an SVG costume and routes the native selection into the shared Paint session', () => {
        const session = createSession();
        const assetDatabase = createAssetDatabase();
        const onResourceSelectionChange = jest.fn();
        const target = createTarget([{dataFormat: 'svg', name: 'Vector'}]);
        const host = createNativePaintHostBinding({
            paintSession: session,
            assetDatabase,
            onResourceSelectionChange
        });

        const selection = host.syncSelection(target, 0);

        expect(host.id).toBe(NATIVE_PAINT_HOST_ID);
        expect(host.presentationId).toBe(NATIVE_PAINT_PRESENTATION_ID);
        expect(selection).toEqual(expect.objectContaining({
            mode: NATIVE_PAINT_MODES.VECTOR,
            requestedMode: NATIVE_PAINT_EDITOR_MODES.AUTO,
            resourceId: VECTOR_RESOURCE_ID,
            targetId: 'target-1'
        }));
        expect(selection.modeAvailability.vector).toBe(true);
        expect(selection.modeAvailability.bitmap).toBe(false);
        expect(assetDatabase.ensureCostumeResource).toHaveBeenCalledWith(target, 0);
        expect(session.selectResource).toHaveBeenCalledWith(VECTOR_RESOURCE_ID);
        expect(onResourceSelectionChange).toHaveBeenCalledWith(VECTOR_RESOURCE_ID);
    });

    test('blocks a different native selection while the current working copy is dirty before adopting it', () => {
        const session = createSession({selectedResourceId: VECTOR_RESOURCE_ID, dirty: true});
        const assetDatabase = createAssetDatabase({existing: null, ensured: SECOND_RESOURCE_ID});
        const target = createTarget([{dataFormat: 'svg', name: 'Other'}]);
        const host = createNativePaintHostBinding({paintSession: session, assetDatabase});

        expect(() => host.syncSelection(target, 0)).toThrow(expect.objectContaining({
            code: 'NGVGE_NATIVE_PAINT_DIRTY_SWITCH_BLOCKED'
        }));
        expect(assetDatabase.ensureCostumeResource).not.toHaveBeenCalled();
        expect(session.selectResource).not.toHaveBeenCalled();
    });

    test('adopts PNG bitmap into a canonical Resource and shared Paint session', () => {
        const session = createSession({selectedResourceId: VECTOR_RESOURCE_ID, dirty: false});
        const assetDatabase = createAssetDatabase();
        const onResourceSelectionChange = jest.fn();
        const target = createTarget([{dataFormat: 'png', name: 'Bitmap'}]);
        const host = createNativePaintHostBinding({
            paintSession: session,
            assetDatabase,
            onResourceSelectionChange
        });

        const selection = host.syncSelection(target, 0);

        expect(selection.mode).toBe(NATIVE_PAINT_MODES.BITMAP);
        expect(selection.resourceId).toBe(VECTOR_RESOURCE_ID);
        expect(selection.modeAvailability.bitmap).toBe(true);
        expect(assetDatabase.ensureCostumeResource).toHaveBeenCalledWith(target, 0);
        expect(onResourceSelectionChange).toHaveBeenCalledWith(VECTOR_RESOURCE_ID);
    });

    test('resolves bitmap format from md5 extension when the runtime costume omits dataFormat', () => {
        const costume = {md5: '0123456789abcdef.png', name: 'Bitmap'};
        expect(resolveCostumeDataFormat(costume)).toBe('png');

        const session = createSession();
        const assetDatabase = createAssetDatabase();
        const host = createNativePaintHostBinding({paintSession: session, assetDatabase});
        const selection = host.syncSelection(createTarget([costume]), 0, NATIVE_PAINT_EDITOR_MODES.BITMAP);

        expect(selection.mode).toBe(NATIVE_PAINT_MODES.BITMAP);
        expect(selection.requestedMode).toBe(NATIVE_PAINT_EDITOR_MODES.BITMAP);
        expect(assetDatabase.ensureCostumeResource).toHaveBeenCalled();
    });

    test('explicit Scratch compatibility mode releases the native Resource selection', () => {
        const session = createSession({selectedResourceId: VECTOR_RESOURCE_ID, dirty: false});
        const assetDatabase = createAssetDatabase({existing: VECTOR_RESOURCE_ID});
        const target = createTarget([{dataFormat: 'png', name: 'Bitmap'}]);
        const host = createNativePaintHostBinding({paintSession: session, assetDatabase});

        const selection = host.syncSelection(target, 0, NATIVE_PAINT_EDITOR_MODES.COMPATIBILITY);

        expect(selection.mode).toBe(NATIVE_PAINT_MODES.LEGACY_RASTER);
        expect(selection.requestedMode).toBe(NATIVE_PAINT_EDITOR_MODES.COMPATIBILITY);
        expect(selection.sourceMode).toBe(NATIVE_PAINT_MODES.BITMAP);
        expect(selection.resourceId).toBeNull();
        expect(session.selectResource).toHaveBeenCalledWith(null);
        expect(assetDatabase.ensureCostumeResource).not.toHaveBeenCalled();
    });

    test('explicit Bitmap mode rejects SVG instead of silently showing the wrong backend', () => {
        const session = createSession();
        const assetDatabase = createAssetDatabase();
        const target = createTarget([{dataFormat: 'svg', name: 'Vector'}]);
        const host = createNativePaintHostBinding({paintSession: session, assetDatabase});

        expect(() => host.syncSelection(target, 0, NATIVE_PAINT_EDITOR_MODES.BITMAP)).toThrow(expect.objectContaining({
            code: 'NGVGE_NATIVE_PAINT_MODE_INCOMPATIBLE'
        }));
        expect(assetDatabase.ensureCostumeResource).not.toHaveBeenCalled();
    });

    test('keeps unsupported raster formats on the legacy compatibility surface', () => {
        const session = createSession();
        const assetDatabase = createAssetDatabase();
        const target = createTarget([{dataFormat: 'webp', name: 'Legacy'}]);
        const host = createNativePaintHostBinding({paintSession: session, assetDatabase});
        const selection = host.syncSelection(target, 0);
        expect(selection.mode).toBe(NATIVE_PAINT_MODES.LEGACY_RASTER);
        expect(selection.resourceId).toBeNull();
        expect(selection.modeAvailability.bitmap).toBe(false);
        expect(assetDatabase.ensureCostumeResource).not.toHaveBeenCalled();
    });

    test('keeps Pixel visible as a reserved editor mode but refuses activation before the Pixel consumer exists', () => {
        const session = createSession();
        const assetDatabase = createAssetDatabase();
        const target = createTarget([{dataFormat: 'png', name: 'Bitmap'}]);
        const host = createNativePaintHostBinding({paintSession: session, assetDatabase});

        expect(() => host.syncSelection(target, 0, NATIVE_PAINT_EDITOR_MODES.PIXEL)).toThrow(expect.objectContaining({
            code: 'NGVGE_NATIVE_PAINT_PIXEL_BACKEND_PENDING'
        }));
    });

    test('allows resyncing the same dirty canonical SVG Resource without re-adopting it', () => {
        const session = createSession({selectedResourceId: VECTOR_RESOURCE_ID, dirty: true});
        const assetDatabase = createAssetDatabase({existing: VECTOR_RESOURCE_ID});
        const target = createTarget([{dataFormat: 'svg', name: 'Vector'}]);
        const host = createNativePaintHostBinding({paintSession: session, assetDatabase});

        expect(host.canSwitchSelection(target, 0)).toBe(true);
        const selection = host.syncSelection(target, 0);
        expect(selection.resourceId).toBe(VECTOR_RESOURCE_ID);
        expect(assetDatabase.ensureCostumeResource).not.toHaveBeenCalled();
        expect(session.selectResource).not.toHaveBeenCalled();
    });
});
