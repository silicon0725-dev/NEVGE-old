const EXTENSION_MANIFEST_VERSION = 2;

const EXTENSION_KINDS = Object.freeze({
    NATIVE: 'ngvge-native',
    LEGACY: 'legacy-extension',
    BUILT_IN: 'built-in',
    ACTION: 'editor-action'
});

const EXTENSION_SOURCE_GROUPS = Object.freeze({
    LOCAL: 'local',
    ONLINE: 'online',
    COMPATIBILITY: 'compatibility',
    SYSTEM: 'system'
});

const SOURCE_KEYS = Object.freeze({
    ALL: 'all',
    NGVGE: 'ngvge',
    SCRATCH: 'scratch',
    ENGINE: '02engine',
    TW: 'tw',
    ASTRA: 'astra',
    PM: 'pm',
    MIST: 'mist',
    SHARKPOOL: 'sharkpool',
    CCW: 'ccw',
    OTHER: 'other',
    CUSTOM: 'custom',
    SPECIAL: 'special'
});

// Keep the current visual order until Task-0007.3.2 replaces the UI.
const SOURCE_NAV_ORDER = Object.freeze([
    SOURCE_KEYS.ALL,
    SOURCE_KEYS.NGVGE,
    SOURCE_KEYS.SCRATCH,
    SOURCE_KEYS.ENGINE,
    SOURCE_KEYS.TW,
    SOURCE_KEYS.PM,
    SOURCE_KEYS.MIST,
    SOURCE_KEYS.SHARKPOOL,
    SOURCE_KEYS.ASTRA,
    SOURCE_KEYS.CCW,
    SOURCE_KEYS.OTHER
]);

module.exports = {
    EXTENSION_KINDS,
    EXTENSION_MANIFEST_VERSION,
    EXTENSION_SOURCE_GROUPS,
    SOURCE_KEYS,
    SOURCE_NAV_ORDER
};
