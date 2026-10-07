const {EXTENSION_SOURCE_GROUPS, SOURCE_KEYS} = require('./constants');

const createPassthroughSource = definition => ({
    ...definition,
    async fetchExtensions ({items = []} = {}) {
        return Array.isArray(items) ? items : [];
    }
});

const BUILT_IN_SOURCE_DEFINITIONS = Object.freeze([
    createPassthroughSource({id: SOURCE_KEYS.NGVGE, name: 'NGVGE', group: EXTENSION_SOURCE_GROUPS.LOCAL, priority: 100}),
    createPassthroughSource({id: SOURCE_KEYS.SCRATCH, name: 'Official Scratch', group: EXTENSION_SOURCE_GROUPS.COMPATIBILITY, priority: 90}),
    createPassthroughSource({id: SOURCE_KEYS.ENGINE, name: '02Engine Legacy', group: EXTENSION_SOURCE_GROUPS.COMPATIBILITY, priority: 80, metadataURL: 'https://extensions.02engine.02studio.xyz/extensions.json'}),
    createPassthroughSource({id: SOURCE_KEYS.TW, name: 'TurboWarp', group: EXTENSION_SOURCE_GROUPS.ONLINE, priority: 70, metadataURL: 'https://extensions.turbowarp.org/generated-metadata/extensions-v0.json'}),
    createPassthroughSource({id: SOURCE_KEYS.PM, name: 'PenguinMod', group: EXTENSION_SOURCE_GROUPS.ONLINE, priority: 60, metadataURL: '/penguinmod/extensions.js'}),
    createPassthroughSource({id: SOURCE_KEYS.MIST, name: 'Mist', group: EXTENSION_SOURCE_GROUPS.ONLINE, priority: 50, metadataURL: 'https://mistiumextensions.02studio.xyz/generated-metadata/extensions-v0.json'}),
    createPassthroughSource({id: SOURCE_KEYS.SHARKPOOL, name: 'SharkPool', group: EXTENSION_SOURCE_GROUPS.ONLINE, priority: 40, metadataURL: 'https://sharkpoolextensions.02studio.xyz/Gallery%20Files/Extension-Keys.json'}),
    createPassthroughSource({id: SOURCE_KEYS.ASTRA, name: 'AstraEditor', group: EXTENSION_SOURCE_GROUPS.ONLINE, priority: 30, metadataURL: 'https://editors.astras.top/extensions/generated-metadata/extensions-v0.json'}),
    createPassthroughSource({id: SOURCE_KEYS.CCW, name: 'CCW', group: EXTENSION_SOURCE_GROUPS.ONLINE, priority: 20, metadataURL: 'https://ccwbfs-proxy.netlify.app/extensions'}),
    createPassthroughSource({id: SOURCE_KEYS.OTHER, name: 'Other', group: EXTENSION_SOURCE_GROUPS.COMPATIBILITY, priority: 0})
]);

const registerBuiltInSources = registry => {
    for (const source of BUILT_IN_SOURCE_DEFINITIONS) registry.register(source);
    return registry;
};

module.exports = {
    BUILT_IN_SOURCE_DEFINITIONS,
    registerBuiltInSources
};
