const RASTER_AUTHORING_POLICY_ID = 'ngvge.raster-authoring-policy@1';

const RASTER_AUTHORING_PROFILE_IDS = Object.freeze({
    BITMAP: 'bitmap-rgba',
    PIXEL: 'pixel-indexed'
});

const RASTER_SHARED_ENGINE_SURFACES = Object.freeze([
    'raster-surface',
    'viewport-projection',
    'selection-mask-lifecycle',
    'raster-transform',
    'primitive-rasterization',
    'flood-fill',
    'clipboard-transfer-adapter',
    'working-copy-event-bridge'
]);

const RASTER_AUTHORING_POLICIES = Object.freeze({
    [RASTER_AUTHORING_PROFILE_IDS.BITMAP]: Object.freeze({
        policyId: RASTER_AUTHORING_POLICY_ID,
        profileId: RASTER_AUTHORING_PROFILE_IDS.BITMAP,
        mode: 'bitmap',
        documentSchema: 'ngvge.animated-raster-document@1',
        sourceKind: 'rgba-raster',
        coordinateModel: 'continuous',
        transformQuantization: 'continuous',
        sampling: 'linear',
        pixelGrid: 'optional',
        softBrush: true,
        indexedColor: false,
        paletteAuthority: 'ngvge',
        timelineAuthority: 'ngvge',
        persistenceAuthority: 'ngvge'
    }),
    [RASTER_AUTHORING_PROFILE_IDS.PIXEL]: Object.freeze({
        policyId: RASTER_AUTHORING_POLICY_ID,
        profileId: RASTER_AUTHORING_PROFILE_IDS.PIXEL,
        mode: 'pixel',
        documentSchema: 'ngvge.animated-raster-document@1',
        sourceKind: 'indexed-raster',
        coordinateModel: 'integer-grid',
        transformQuantization: 'integer',
        sampling: 'nearest',
        pixelGrid: 'required',
        softBrush: false,
        indexedColor: true,
        paletteAuthority: 'ngvge',
        timelineAuthority: 'ngvge',
        persistenceAuthority: 'ngvge'
    })
});

const getRasterAuthoringPolicy = profileId => RASTER_AUTHORING_POLICIES[profileId] || null;
const getRasterAuthoringPolicyForMode = mode => {
    if (mode === 'bitmap') return RASTER_AUTHORING_POLICIES[RASTER_AUTHORING_PROFILE_IDS.BITMAP];
    if (mode === 'pixel') return RASTER_AUTHORING_POLICIES[RASTER_AUTHORING_PROFILE_IDS.PIXEL];
    return null;
};

export {
    RASTER_AUTHORING_POLICY_ID,
    RASTER_AUTHORING_PROFILE_IDS,
    RASTER_SHARED_ENGINE_SURFACES,
    RASTER_AUTHORING_POLICIES,
    getRasterAuthoringPolicy,
    getRasterAuthoringPolicyForMode
};
