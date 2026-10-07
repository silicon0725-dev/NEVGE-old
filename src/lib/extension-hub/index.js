const ExtensionRegistry = require('./extension-registry');
const ExtensionSourceRegistry = require('./source-registry');
const constants = require('./constants');
const manifest = require('./manifest');
const {registerBuiltInSources} = require('./built-in-sources');

const sourceRegistry = registerBuiltInSources(new ExtensionSourceRegistry());
const extensionRegistry = new ExtensionRegistry();

module.exports = {
    ExtensionRegistry,
    ExtensionSourceRegistry,
    extensionRegistry,
    sourceRegistry,
    ...constants,
    ...manifest
};
