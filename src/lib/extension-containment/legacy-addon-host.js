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
const {installScratchExtensionHost} = require('./scratch-extension-host');

const LEGACY_ADDON_RUNTIME_PROPERTY = 'ngvgeLegacyAddonHost';
const hostsByVM = new WeakMap();

const isCustomManifest = manifest => Array.isArray(manifest && manifest.tags) && manifest.tags.includes('custom');
const getDeclaredCapabilities = manifest => {
    if (!Array.isArray(manifest && manifest.ngvgeCapabilities)) return [];
    return manifest.ngvgeCapabilities.filter(capability => capability ===
        EXTENSION_CAPABILITIES.LEGACY_SCRATCH_EXTENSION_LOAD_BUILTIN);
};

const createLegacyAddonHost = vm => {
    if (!vm || typeof vm !== 'object') throw new TypeError('Legacy Addon Host requires a VM object.');
    const controller = getExtensionContainmentController(vm);
    controller.registerHost({
        hostId: EXTENSION_HOST_IDS.LEGACY_ADDON,
        hostKind: EXTENSION_HOST_KINDS.LEGACY_ADDON
    });
    const manifests = new Map();
    const scratchExtensionCapabilities = new Map();

    const registerAddon = (addonId, manifest = {}) => {
        const id = String(addonId || '').trim();
        if (!id) throw new TypeError('Legacy Addon Host requires a non-empty addon id.');
        manifests.set(id, manifest || {});
        const custom = isCustomManifest(manifest);
        return controller.upsertDescriptor({
            capabilities: [EXTENSION_CAPABILITIES.LEGACY_ADDON_DOM].concat(getDeclaredCapabilities(manifest)),
            compatibility: {legacy: true, quarantine: true},
            displayName: manifest.name || id,
            extensionId: id,
            hostKind: EXTENSION_HOST_KINDS.LEGACY_ADDON,
            permissions: [],
            source: {kind: custom ? 'custom-local-addon' : 'bundled-legacy-addon', value: null},
            trust: {
                effectiveExecutionMode: EXTENSION_EXECUTION_MODES.LEGACY_RAW_VM_QUARANTINE,
                level: custom ? EXTENSION_TRUST_LEVELS.UNTRUSTED : EXTENSION_TRUST_LEVELS.LEGACY_QUARANTINED,
                requestedExecutionMode: 'legacy-userscript'
            }
        });
    };

    const acquireScratchExtensionCapability = (addonId, manifest = manifests.get(addonId) || {}) => {
        const id = String(addonId || '').trim();
        const descriptor = registerAddon(id, manifest);
        const capabilityId = EXTENSION_CAPABILITIES.LEGACY_SCRATCH_EXTENSION_LOAD_BUILTIN;
        if (descriptor.trust.level === EXTENSION_TRUST_LEVELS.UNTRUSTED ||
            !descriptor.capabilities.includes(capabilityId)) {
            const error = new Error(`Legacy addon "${id}" did not declare the ${capabilityId} capability.`);
            error.code = 'LEX_LEGACY_CAPABILITY_UNDECLARED';
            controller.recordDiagnostic({
                code: error.code,
                descriptorId: descriptor.descriptorId,
                detail: error.message,
                hostKind: EXTENSION_HOST_KINDS.LEGACY_ADDON,
                severity: 'error'
            });
            throw error;
        }
        if (scratchExtensionCapabilities.has(id)) return scratchExtensionCapabilities.get(id);
        const scratchExtensionHost = installScratchExtensionHost(vm);
        const capability = Object.freeze({
            capabilityId,
            isLoaded: extensionId => scratchExtensionHost.isExtensionLoaded(String(extensionId)),
            loadBuiltIn (extensionId) {
                const normalized = String(extensionId || '').trim();
                if (!normalized || /[:/\\.]/.test(normalized)) {
                    const error = new Error(`Legacy Scratch extension capability only accepts built-in extension ids.`);
                    error.code = 'LEX_LEGACY_EXTENSION_BUILTIN_ONLY';
                    throw error;
                }
                return scratchExtensionHost.loadBuiltInExtension(normalized, {
                    sourceKind: 'legacy-addon-declared-capability'
                });
            },
            whenProjectReady (callback) {
                if (typeof callback !== 'function') {
                    throw new TypeError('whenProjectReady requires a callback.');
                }
                if (vm.editingTarget) {
                    callback();
                    return () => {};
                }
                const runtime = vm.runtime;
                if (!runtime || typeof runtime.once !== 'function') {
                    callback();
                    return () => {};
                }
                runtime.once('PROJECT_LOADED', callback);
                return () => {
                    if (typeof runtime.off === 'function') runtime.off('PROJECT_LOADED', callback);
                };
            }
        });
        scratchExtensionCapabilities.set(id, capability);
        controller.recordDiagnostic({
            code: 'LEX_LEGACY_SCRATCH_EXTENSION_CAPABILITY_ACQUIRED',
            descriptorId: descriptor.descriptorId,
            detail: `Legacy addon "${id}" acquired its declared built-in Scratch extension capability.`,
            hostKind: EXTENSION_HOST_KINDS.LEGACY_ADDON,
            severity: 'info'
        });
        return capability;
    };

    const acquireLegacyVM = (addonId, manifest = manifests.get(addonId) || {}) => {
        const descriptor = registerAddon(addonId, manifest);
        if (descriptor.trust.level === EXTENSION_TRUST_LEVELS.UNTRUSTED) {
            const error = new Error(`Untrusted custom addon "${addonId}" cannot acquire the legacy raw VM lease.`);
            error.code = 'LEX_LEGACY_RAW_VM_DENIED';
            controller.recordDiagnostic({
                code: error.code,
                descriptorId: descriptor.descriptorId,
                detail: error.message,
                hostKind: EXTENSION_HOST_KINDS.LEGACY_ADDON,
                severity: 'error'
            });
            throw error;
        }
        const upgraded = controller.upsertDescriptor({
            capabilities: descriptor.capabilities.concat(EXTENSION_CAPABILITIES.LEGACY_RAW_VM_QUARANTINE),
            compatibility: descriptor.compatibility,
            displayName: descriptor.displayName,
            extensionId: descriptor.extensionId,
            hostKind: descriptor.hostKind,
            permissions: descriptor.permissions,
            source: descriptor.source,
            trust: descriptor.trust
        });
        controller.recordDiagnostic({
            code: 'LEX_LEGACY_RAW_VM_LEASE_ACQUIRED',
            descriptorId: upgraded.descriptorId,
            detail: `Bundled legacy addon "${addonId}" acquired the explicit raw VM quarantine lease.`,
            hostKind: EXTENSION_HOST_KINDS.LEGACY_ADDON,
            severity: 'warning'
        });
        return vm;
    };

    return Object.freeze({
        acquireLegacyVM,
        acquireScratchExtensionCapability,
        getAddonDescriptor: addonId => controller.client.getDescriptor(
            `${EXTENSION_HOST_KINDS.LEGACY_ADDON}:${addonId}`
        ),
        hostId: EXTENSION_HOST_IDS.LEGACY_ADDON,
        registerAddon
    });
};

const installLegacyAddonHost = vm => {
    let host = hostsByVM.get(vm);
    if (!host) {
        host = createLegacyAddonHost(vm);
        hostsByVM.set(vm, host);
        if (vm.runtime && !Object.prototype.hasOwnProperty.call(vm.runtime, LEGACY_ADDON_RUNTIME_PROPERTY)) {
            Object.defineProperty(vm.runtime, LEGACY_ADDON_RUNTIME_PROPERTY, {
                configurable: false,
                enumerable: false,
                value: Object.freeze({
                    getAddonDescriptor: host.getAddonDescriptor,
                    hostId: host.hostId
                }),
                writable: false
            });
        }
    }
    return host;
};

module.exports = {
    LEGACY_ADDON_RUNTIME_PROPERTY,
    createLegacyAddonHost,
    installLegacyAddonHost
};
