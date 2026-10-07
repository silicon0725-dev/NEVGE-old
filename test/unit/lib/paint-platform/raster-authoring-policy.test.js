import {
    RASTER_AUTHORING_POLICY_ID,
    RASTER_AUTHORING_PROFILE_IDS,
    RASTER_SHARED_ENGINE_SURFACES,
    getRasterAuthoringPolicy,
    getRasterAuthoringPolicyForMode
} from '../../../../src/lib/paint-platform/raster-authoring-policy';

describe('WS-10G0 shared Raster authoring policy', () => {
    test('shares a Raster engine surface while preserving Bitmap and Pixel authoring differences', () => {
        const bitmap = getRasterAuthoringPolicy(RASTER_AUTHORING_PROFILE_IDS.BITMAP);
        const pixel = getRasterAuthoringPolicy(RASTER_AUTHORING_PROFILE_IDS.PIXEL);

        expect(bitmap.policyId).toBe(RASTER_AUTHORING_POLICY_ID);
        expect(pixel.policyId).toBe(RASTER_AUTHORING_POLICY_ID);
        expect(bitmap.documentSchema).toBe('ngvge.animated-raster-document@1');
        expect(pixel.documentSchema).toBe('ngvge.animated-raster-document@1');
        expect(bitmap.coordinateModel).toBe('continuous');
        expect(bitmap.sampling).toBe('linear');
        expect(bitmap.sourceKind).toBe('rgba-raster');
        expect(pixel.coordinateModel).toBe('integer-grid');
        expect(pixel.transformQuantization).toBe('integer');
        expect(pixel.sampling).toBe('nearest');
        expect(pixel.sourceKind).toBe('indexed-raster');
        expect(pixel.pixelGrid).toBe('required');
    });

    test('keeps semantic authority with NGVGE for both Raster profiles', () => {
        ['bitmap', 'pixel'].forEach(mode => {
            const policy = getRasterAuthoringPolicyForMode(mode);
            expect(policy.paletteAuthority).toBe('ngvge');
            expect(policy.timelineAuthority).toBe('ngvge');
            expect(policy.persistenceAuthority).toBe('ngvge');
        });
        expect(RASTER_SHARED_ENGINE_SURFACES).toContain('selection-mask-lifecycle');
        expect(RASTER_SHARED_ENGINE_SURFACES).toContain('working-copy-event-bridge');
    });
});
