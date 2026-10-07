const {
    EXTENSION_KINDS,
    EXTENSION_MANIFEST_VERSION,
    SOURCE_KEYS
} = require('./constants');

const TAG_SOURCE_MAP = Object.freeze({
    scratch: SOURCE_KEYS.SCRATCH,
    ztengine: SOURCE_KEYS.ENGINE,
    ngvge: SOURCE_KEYS.NGVGE,
    tw: SOURCE_KEYS.TW,
    astra: SOURCE_KEYS.ASTRA,
    pm: SOURCE_KEYS.PM,
    mist: SOURCE_KEYS.MIST,
    sp: SOURCE_KEYS.SHARKPOOL,
    ccw: SOURCE_KEYS.CCW
});

const inferLegacySourceId = item => {
    const extensionId = item && item.extensionId ? String(item.extensionId) : '';
    if (extensionId === 'custom_extension') return SOURCE_KEYS.CUSTOM;
    if (extensionId.startsWith('ccw_')) return SOURCE_KEYS.CCW;
    if (extensionId === 'procedures_enable_return') return SOURCE_KEYS.SPECIAL;
    const tags = Array.isArray(item && item.tags) ? item.tags : [];
    for (const tag of tags) {
        if (TAG_SOURCE_MAP[tag]) return TAG_SOURCE_MAP[tag];
    }
    return SOURCE_KEYS.OTHER;
};

const inferKind = (item, sourceId) => {
    if (sourceId === SOURCE_KEYS.SPECIAL) return EXTENSION_KINDS.ACTION;
    if (sourceId === SOURCE_KEYS.CUSTOM) return EXTENSION_KINDS.LEGACY;
    if (sourceId === SOURCE_KEYS.NGVGE) return EXTENSION_KINDS.NATIVE;
    if (item && item.extensionId && !item.extensionURL && !item.href && sourceId === SOURCE_KEYS.SCRATCH) {
        return EXTENSION_KINDS.BUILT_IN;
    }
    return EXTENSION_KINDS.LEGACY;
};

const createManifestFromLegacyItem = (item, overrides = {}) => {
    const sourceId = overrides.sourceId || inferLegacySourceId(item);
    const extensionId = item && item.extensionId ? String(item.extensionId) : '';
    return Object.freeze({
        manifestVersion: EXTENSION_MANIFEST_VERSION,
        id: overrides.id || extensionId || `legacy:${sourceId}:unknown`,
        version: overrides.version || '0.0.0-legacy',
        kind: overrides.kind || inferKind(item, sourceId),
        source: Object.freeze({
            id: sourceId,
            mode: item && item.extensionURL ? 'remote' : 'local',
            url: item && item.extensionURL ? item.extensionURL : null
        }),
        compatibility: Object.freeze({
            scratch: !(item && item.incompatibleWithScratch),
            ngvge: true,
            adapter: sourceId === SOURCE_KEYS.NGVGE ? null : 'scratch-extension-v1'
        }),
        permissions: Object.freeze([]),
        dependencies: Object.freeze([]),
        metadata: Object.freeze({
            featured: Boolean(item && item.featured),
            tags: Object.freeze(Array.isArray(item && item.tags) ? [...item.tags] : [])
        }),
        legacy: true
    });
};

const attachManifestToGalleryItem = (item, overrides = {}) => ({
    ...item,
    ngvgeManifest: item && item.ngvgeManifest ? item.ngvgeManifest : createManifestFromLegacyItem(item, overrides)
});

module.exports = {
    attachManifestToGalleryItem,
    createManifestFromLegacyItem,
    inferLegacySourceId
};
