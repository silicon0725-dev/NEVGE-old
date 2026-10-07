const {
    CAMERA2D_CONTRACT,
    CAMERA2D_DEFAULT_DATA,
    CAMERA2D_MAX_ZOOM,
    CAMERA2D_MIN_ZOOM,
    CAMERA2D_PATCH_COMMAND_TYPE,
    CAMERA2D_TYPE_ID,
    applyCamera2DPatch,
    createCamera2DPatchComponentCommand,
    normalizeCamera2D,
    normalizeCamera2DPatch
} = require('../../../../src/core/camera2d');

describe('WS-10N4 Camera2D core contract', () => {
    test('keeps Camera2D as native semantic data with Transform2D position/rotation authority', () => {
        expect(CAMERA2D_CONTRACT.typeId).toBe(CAMERA2D_TYPE_ID);
        expect(CAMERA2D_CONTRACT.coordinateSpace.cameraPositionSource).toBe('Transform2D.position');
        expect(CAMERA2D_CONTRACT.coordinateSpace.cameraRotationSource).toBe('Transform2D.rotation');
        expect(CAMERA2D_CONTRACT.persistence.nativeProject).toBe('.ne');
        expect(CAMERA2D_CONTRACT.persistence.scratchProjection).toBe('native-only');
        expect(CAMERA2D_CONTRACT.runtimeAuthority.backendHandlePersistent).toBe(false);
    });

    test('normalizes portable defaults without adding backend identity', () => {
        expect(normalizeCamera2D()).toEqual(CAMERA2D_DEFAULT_DATA);
        expect(Object.keys(normalizeCamera2D())).toEqual(['enabled', 'offset', 'priority', 'zoom']);
    });

    test('normalizes zoom magnitude and clamps pathological values', () => {
        expect(normalizeCamera2D({zoom: [-2, 0]}).zoom).toEqual([2, CAMERA2D_MIN_ZOOM]);
        expect(normalizeCamera2D({zoom: [999, -999]}).zoom).toEqual([CAMERA2D_MAX_ZOOM, CAMERA2D_MAX_ZOOM]);
    });

    test('rejects unknown or malformed patch fields', () => {
        expect(() => normalizeCamera2DPatch({rendererHandle: 4}))
            .toThrow(expect.objectContaining({code: 'NGVGE_CAMERA2D_PATCH_FIELD_UNSUPPORTED'}));
        expect(() => normalizeCamera2DPatch({enabled: 'false'}))
            .toThrow(expect.objectContaining({code: 'NGVGE_CAMERA2D_ENABLED_INVALID'}));
        expect(() => normalizeCamera2DPatch({zoom: [1]}))
            .toThrow(expect.objectContaining({code: 'NGVGE_CAMERA2D_ZOOM_INVALID'}));
        expect(() => normalizeCamera2DPatch({}))
            .toThrow(expect.objectContaining({code: 'NGVGE_CAMERA2D_PATCH_EMPTY'}));
    });

    test('applies a partial patch while retaining canonical fields', () => {
        expect(applyCamera2DPatch(undefined, {priority: 7, zoom: [2, 3]})).toEqual({
            enabled: true,
            offset: [0, 0],
            priority: 7,
            zoom: [2, 3]
        });
    });

    test('creates a portable protocol command keyed by semantic identities only', () => {
        const command = createCamera2DPatchComponentCommand({
            componentId: 'component-camera',
            nodeId: 'node-camera',
            patch: {enabled: false, offset: [4, -5]}
        });
        expect(command.kind).toBe('command');
        expect(command.type).toBe(CAMERA2D_PATCH_COMMAND_TYPE);
        expect(command.payload).toEqual({
            componentId: 'component-camera',
            nodeId: 'node-camera',
            patch: {enabled: false, offset: [4, -5]}
        });
        expect(JSON.stringify(command)).not.toMatch(/targetId|drawable|renderer|backendHandle/);
    });
});
