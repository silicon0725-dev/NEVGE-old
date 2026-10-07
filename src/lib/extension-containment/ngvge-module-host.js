/* eslint-disable import/no-commonjs, strict */
'use strict';

const {
    EXTENSION_CAPABILITIES,
    EXTENSION_EXECUTION_MODES,
    EXTENSION_HOST_IDS,
    EXTENSION_HOST_KINDS,
    EXTENSION_TRUST_LEVELS
} = require('./constants');
const {getExtensionContainmentController} = require('./extension-containment-host');

const registerNgvgeModuleDefinitions = (vm, definitions) => {
    const controller = getExtensionContainmentController(vm);
    controller.registerHost({
        hostId: EXTENSION_HOST_IDS.NGVGE_MODULE,
        hostKind: EXTENSION_HOST_KINDS.NGVGE_MODULE
    });
    for (const definition of Array.isArray(definitions) ? definitions : []) {
        const manifest = definition && definition.manifest;
        if (!manifest || typeof manifest.id !== 'string') continue;
        controller.upsertDescriptor({
            capabilities: [EXTENSION_CAPABILITIES.NGVGE_MODULE_DECLARED].concat(manifest.capabilities || []),
            compatibility: {legacy: false, quarantine: false},
            displayName: manifest.name,
            extensionId: manifest.id,
            hostKind: EXTENSION_HOST_KINDS.NGVGE_MODULE,
            permissions: manifest.permissions || [],
            source: {kind: 'built-in-module', value: manifest.version || null},
            trust: {
                effectiveExecutionMode: EXTENSION_EXECUTION_MODES.NATIVE_HOST,
                level: EXTENSION_TRUST_LEVELS.FIRST_PARTY,
                requestedExecutionMode: 'native-host'
            }
        });
    }
    return controller.client;
};

module.exports = {
    registerNgvgeModuleDefinitions
};
