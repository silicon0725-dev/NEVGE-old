/* eslint-disable import/no-commonjs, strict */
'use strict';

const EXTENSION_CONTAINMENT_VERSION = 1;

const EXTENSION_HOST_KINDS = Object.freeze({
    LEGACY_ADDON: 'legacy-addon',
    NGVGE_MODULE: 'ngvge-module',
    SCRATCH_EXTENSION: 'scratch-extension'
});

const EXTENSION_HOST_IDS = Object.freeze({
    LEGACY_ADDON: 'ngvge.extension-host.legacy-addon@1',
    NGVGE_MODULE: 'ngvge.extension-host.ngvge-module@1',
    SCRATCH_EXTENSION: 'ngvge.extension-host.scratch-extension@1'
});

const EXTENSION_TRUST_LEVELS = Object.freeze({
    FIRST_PARTY: 'first-party',
    LEGACY_QUARANTINED: 'legacy-quarantined',
    SANDBOXED: 'sandboxed',
    TRUSTED_EXTERNAL: 'trusted-external',
    UNTRUSTED: 'untrusted'
});

const EXTENSION_EXECUTION_MODES = Object.freeze({
    BACKEND_MANAGED: 'backend-managed',
    LEGACY_RAW_VM_QUARANTINE: 'legacy-raw-vm-quarantine',
    NATIVE_HOST: 'native-host',
    SANDBOXED: 'sandboxed'
});

const EXTENSION_CAPABILITIES = Object.freeze({
    LEGACY_ADDON_DOM: 'legacy-addon.dom',
    LEGACY_RAW_VM_QUARANTINE: 'legacy-addon.raw-vm-quarantine',
    LEGACY_SCRATCH_EXTENSION_LOAD_BUILTIN: 'legacy-addon.scratch-extension.load-built-in',
    LEGACY_UNSANDBOXED_CODE_QUARANTINE: 'legacy.unsandboxed-code-quarantine',
    NGVGE_MODULE_DECLARED: 'ngvge-module.declared-capabilities',
    SCRATCH_EXTENSION_EXECUTE: 'scratch-extension.execute',
    SCRATCH_EXTENSION_LOAD: 'scratch-extension.load',
    SCRATCH_EXTENSION_UNLOAD: 'scratch-extension.unload'
});

module.exports = {
    EXTENSION_CAPABILITIES,
    EXTENSION_CONTAINMENT_VERSION,
    EXTENSION_EXECUTION_MODES,
    EXTENSION_HOST_IDS,
    EXTENSION_HOST_KINDS,
    EXTENSION_TRUST_LEVELS
};
