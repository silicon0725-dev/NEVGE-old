const {
    CORE_MODULE_ID,
    MODULE_AVAILABILITY,
    SB3_COMPATIBILITY_LEVELS
} = require('./constants');
const {
    EXTENSION_KINDS,
    EXTENSION_MANIFEST_VERSION,
    SOURCE_KEYS
} = require('../extension-hub/constants');

const MODULE_EXTENSION_ID_PREFIX = 'ngvge-module:';

const getModuleExtensionId = moduleId => `${MODULE_EXTENSION_ID_PREFIX}${moduleId}`;

const isFirstPartyModuleGalleryItem = item => Boolean(
    item && item.isFirstPartyModule && typeof item.moduleId === 'string'
);

const toFirstPartyModuleGalleryItem = (entry, options = {}) => {
    if (!entry || !entry.manifest) return null;
    const {manifest} = entry;
    const state = entry.state || {};
    const translations = options.translations && options.translations[manifest.id] ?
        options.translations[manifest.id] : {};
    const compatibilityLevel = manifest.compatibility && manifest.compatibility.sb3 ?
        manifest.compatibility.sb3.level : SB3_COMPATIBILITY_LEVELS.FULL;

    return {
        description: translations.description || manifest.description,
        disabled: manifest.availability === MODULE_AVAILABILITY.PLANNED,
        extensionId: getModuleExtensionId(manifest.id),
        featured: true,
        iconURL: options.icons && options.icons[manifest.id] ? options.icons[manifest.id] : options.fallbackIcon,
        incompatibleWithScratch: compatibilityLevel === SB3_COMPATIBILITY_LEVELS.NONE,
        isFirstPartyModule: true,
        moduleAvailability: manifest.availability,
        moduleEnabled: Boolean(state.enabled),
        moduleError: state.error || null,
        moduleId: manifest.id,
        moduleManifest: manifest,
        moduleState: state.state || null,
        name: translations.name || manifest.name,
        ngvgeManifest: {
            compatibility: {
                adapter: null,
                ngvge: true,
                scratch: compatibilityLevel !== SB3_COMPATIBILITY_LEVELS.NONE
            },
            dependencies: manifest.dependencies,
            id: manifest.id,
            kind: EXTENSION_KINDS.NATIVE,
            legacy: false,
            manifestVersion: EXTENSION_MANIFEST_VERSION,
            metadata: {
                availability: manifest.availability,
                featured: true,
                module: true,
                sb3Compatibility: compatibilityLevel,
                tags: ['ngvge', 'module']
            },
            permissions: manifest.permissions,
            source: {
                id: SOURCE_KEYS.NGVGE,
                mode: 'local',
                url: null
            },
            version: manifest.version
        },
        sb3CompatibilityLevel: compatibilityLevel,
        tags: ['ngvge', 'module', manifest.availability]
    };
};

const createFirstPartyModuleGalleryItems = (manager, options = {}) => {
    if (!manager || typeof manager.listModules !== 'function') return [];
    const includePlanned = Boolean(options.includePlanned);
    return manager.listModules()
        .filter(entry => entry && entry.manifest && entry.manifest.id !== CORE_MODULE_ID)
        .filter(entry => includePlanned || entry.manifest.availability !== MODULE_AVAILABILITY.PLANNED)
        .map(entry => toFirstPartyModuleGalleryItem(entry, options))
        .filter(Boolean);
};

const toggleFirstPartyModule = (manager, moduleId) => {
    if (!manager || typeof manager.getModuleState !== 'function') {
        throw new Error('NGVGE first-party module manager is unavailable.');
    }
    const state = manager.getModuleState(moduleId);
    if (!state) throw new Error(`Unknown NGVGE first-party module: ${moduleId}`);
    if (state.enabled) {
        manager.disableModule(moduleId);
        return false;
    }
    manager.enableModule(moduleId);
    return true;
};

module.exports = {
    MODULE_EXTENSION_ID_PREFIX,
    createFirstPartyModuleGalleryItems,
    getModuleExtensionId,
    isFirstPartyModuleGalleryItem,
    toFirstPartyModuleGalleryItem,
    toggleFirstPartyModule
};
