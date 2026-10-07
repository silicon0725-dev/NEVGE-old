const ModuleCapabilityRegistry = require('./capability-registry');
const ModuleDataStore = require('./module-data-store');
const FirstPartyModuleRegistry = require('./module-registry');
const constants = require('./constants');
const manifest = require('./module-manifest');
const moduleGalleryAdapter = require('./module-gallery-adapter');
const runtimeErrorContract = require('../runtime-errors');
const {createModuleManager} = require('./module-manager');
const {getBuiltInModuleDefinitions, registerBuiltInModules} = require('./built-in-modules');

module.exports = {
    FirstPartyModuleRegistry,
    ModuleCapabilityRegistry,
    ModuleDataStore,
    createModuleManager,
    getBuiltInModuleDefinitions,
    registerBuiltInModules,
    ...constants,
    ...manifest,
    ...moduleGalleryAdapter,
    ...runtimeErrorContract
};
