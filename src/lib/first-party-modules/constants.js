const MODULE_FRAMEWORK_VERSION = 1;
const MODULE_MANIFEST_VERSION = 1;

const MODULE_KINDS = Object.freeze({
    FIRST_PARTY: 'first-party',
    COMMUNITY: 'community',
    COMPATIBILITY: 'compatibility'
});

const MODULE_AVAILABILITY = Object.freeze({
    AVAILABLE: 'available',
    EXPERIMENTAL: 'experimental',
    PLANNED: 'planned'
});

const {MODULE_ENABLE_COMPLETION, MODULE_STATES} = require('./module-lifecycle-constants');

const MODULE_PERMISSIONS = Object.freeze({
    ASSETS: 'assets',
    COMMANDS: 'commands',
    EDITOR: 'editor',
    EXTENSIONS: 'extensions',
    INSPECTOR: 'inspector',
    NODES: 'nodes',
    RENDERER: 'renderer',
    RUNTIME: 'runtime',
    SERIALIZATION: 'serialization'
});

const SB3_COMPATIBILITY_LEVELS = Object.freeze({
    FULL: 'full',
    PARTIAL: 'partial',
    NONE: 'none'
});

const SB3_COMPATIBILITY_PRIORITY = Object.freeze({
    [SB3_COMPATIBILITY_LEVELS.FULL]: 0,
    [SB3_COMPATIBILITY_LEVELS.PARTIAL]: 1,
    [SB3_COMPATIBILITY_LEVELS.NONE]: 2
});

const CORE_MODULE_ID = 'ngvge.core';

module.exports = {
    CORE_MODULE_ID,
    MODULE_AVAILABILITY,
    MODULE_ENABLE_COMPLETION,
    MODULE_FRAMEWORK_VERSION,
    MODULE_KINDS,
    MODULE_MANIFEST_VERSION,
    MODULE_PERMISSIONS,
    MODULE_STATES,
    SB3_COMPATIBILITY_LEVELS,
    SB3_COMPATIBILITY_PRIORITY
};
