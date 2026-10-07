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

const SCRATCH_EXTENSION_RUNTIME_PROPERTY = 'ngvgeScratchExtensionHost';
const hostsByVM = new WeakMap();

const getExtensionManager = vm => vm && (vm.extensionManager || (vm.runtime && vm.runtime.extensionManager));
const looksLikeBuiltInId = value => typeof value === 'string' && !/[:/\\]/.test(value) && !value.includes('.');

const classifyTrust = (source, metadata) => {
    if (metadata && Object.values(EXTENSION_TRUST_LEVELS).includes(metadata.trustLevel)) {
        return metadata.trustLevel;
    }
    if (looksLikeBuiltInId(source)) return EXTENSION_TRUST_LEVELS.FIRST_PARTY;
    if (metadata && metadata.requestedUnsandboxed) return EXTENSION_TRUST_LEVELS.LEGACY_QUARANTINED;
    return EXTENSION_TRUST_LEVELS.SANDBOXED;
};

const createScratchExtensionHost = vm => {
    const extensionManager = getExtensionManager(vm);
    if (!extensionManager) {
        throw new TypeError('Scratch Extension Host requires a VM extensionManager.');
    }
    const controller = getExtensionContainmentController(vm);
    const listeners = new Set();
    controller.registerHost({
        hostId: EXTENSION_HOST_IDS.SCRATCH_EXTENSION,
        hostKind: EXTENSION_HOST_KINDS.SCRATCH_EXTENSION
    });

    const notify = event => {
        const snapshot = Object.freeze(Object.assign({hostId: EXTENSION_HOST_IDS.SCRATCH_EXTENSION}, event));
        for (const listener of Array.from(listeners)) {
            try {
                listener(snapshot);
            } catch {
                // Extension observers are informational and cannot break the host mutation.
            }
        }
        return snapshot;
    };

    const getLoadedExtensionURLs = () => {
        if (typeof extensionManager.getExtensionURLs !== 'function') return Object.freeze({});
        const urls = extensionManager.getExtensionURLs() || {};
        return Object.freeze(Object.assign({}, urls));
    };

    const listLoadedExtensionIds = () => {
        const ids = new Set(Object.keys(getLoadedExtensionURLs()));
        // Backend-private compatibility access is contained here and must not leak to GUI callers.
        const loaded = extensionManager._loadedExtensions;
        if (loaded && typeof loaded.keys === 'function') {
            for (const id of loaded.keys()) ids.add(String(id));
        }
        return Object.freeze(Array.from(ids).sort());
    };

    const getLoadedExtensionOrder = () => {
        const loaded = extensionManager._loadedExtensions;
        if (loaded && typeof loaded.keys === 'function') return Array.from(loaded.keys(), id => String(id));
        return Array.from(listLoadedExtensionIds());
    };

    const registerDescriptor = (extensionId, source, metadata = {}) => {
        const trustLevel = classifyTrust(source, metadata);
        const capabilities = [EXTENSION_CAPABILITIES.SCRATCH_EXTENSION_EXECUTE];
        if (metadata.requestedUnsandboxed) {
            capabilities.push(EXTENSION_CAPABILITIES.LEGACY_UNSANDBOXED_CODE_QUARANTINE);
        }
        return controller.upsertDescriptor({
            capabilities,
            compatibility: {legacy: true, quarantine: trustLevel === EXTENSION_TRUST_LEVELS.LEGACY_QUARANTINED},
            displayName: metadata.displayName || extensionId,
            extensionId,
            hostKind: EXTENSION_HOST_KINDS.SCRATCH_EXTENSION,
            permissions: metadata.permissions || [],
            source: {
                kind: metadata.sourceKind || (looksLikeBuiltInId(source) ? 'builtin-id' : 'url'),
                value: typeof source === 'string' ? source : null
            },
            trust: {
                effectiveExecutionMode: EXTENSION_EXECUTION_MODES.BACKEND_MANAGED,
                level: trustLevel,
                requestedExecutionMode: metadata.requestedUnsandboxed ? 'unsandboxed' : 'backend-default'
            }
        });
    };

    const synchronizeLoadedExtensions = () => {
        const urls = getLoadedExtensionURLs();
        for (const extensionId of listLoadedExtensionIds()) {
            const descriptorId = `${EXTENSION_HOST_KINDS.SCRATCH_EXTENSION}:${extensionId}`;
            if (!controller.client.getDescriptor(descriptorId)) {
                registerDescriptor(extensionId, urls[extensionId] || extensionId, {
                    sourceKind: urls[extensionId] ? 'backend-loaded-url' : 'backend-loaded-id'
                });
            }
        }
        return listLoadedExtensionIds();
    };

    const host = Object.freeze({
        hostId: EXTENSION_HOST_IDS.SCRATCH_EXTENSION,
        configureSecurityManager (overrides) {
            const manager = extensionManager.securityManager;
            if (!manager || !overrides || typeof overrides !== 'object') return false;
            for (const [name, implementation] of Object.entries(overrides)) {
                if (typeof implementation === 'function') manager[name] = implementation;
            }
            controller.recordDiagnostic({
                code: 'LEX_SCRATCH_SECURITY_MANAGER_BOUNDARY_CONFIGURED',
                detail: 'Scratch extension security hooks were configured through the Scratch Extension Host.',
                hostKind: EXTENSION_HOST_KINDS.SCRATCH_EXTENSION,
                severity: 'info'
            });
            return true;
        },
        getLoadedExtensionURLs,
        isExtensionLoaded: extensionId => {
            if (typeof extensionManager.isExtensionLoaded === 'function') {
                return Boolean(extensionManager.isExtensionLoaded(extensionId));
            }
            return Boolean(
                extensionManager._loadedExtensions &&
                typeof extensionManager._loadedExtensions.has === 'function' &&
                extensionManager._loadedExtensions.has(extensionId)
            );
        },
        async loadExtensionURL (source, metadata = {}) {
            if (typeof extensionManager.loadExtensionURL !== 'function') {
                throw new Error('Scratch extension backend does not expose loadExtensionURL().');
            }
            const before = new Set(listLoadedExtensionIds());
            const result = await extensionManager.loadExtensionURL(source);
            const after = listLoadedExtensionIds();
            let loadedIds = after.filter(id => !before.has(id));
            if (!loadedIds.length && metadata.extensionId) loadedIds = [String(metadata.extensionId)];
            for (const extensionId of loadedIds) registerDescriptor(extensionId, source, metadata);
            if (metadata.requestedUnsandboxed) {
                controller.recordDiagnostic({
                    code: 'LEX_UNSANDBOXED_EXTENSION_REQUEST_QUARANTINED',
                    detail: `Legacy unsandboxed execution was requested for ${String(source)}; ` +
                        'effective mode remains backend-managed.',
                    hostKind: EXTENSION_HOST_KINDS.SCRATCH_EXTENSION,
                    severity: 'warning'
                });
            }
            loadedIds.forEach(extensionId => notify({
                extensionId,
                kind: 'loaded',
                source: typeof source === 'string' ? source : null,
                sourceKind: metadata.sourceKind || 'url'
            }));
            return result;
        },
        loadBuiltInExtension (extensionId, metadata = {}) {
            if (host.isExtensionLoaded(extensionId)) return extensionId;
            if (typeof extensionManager.loadExtensionIdSync !== 'function') {
                throw new Error('Scratch extension backend does not expose loadExtensionIdSync().');
            }
            const result = extensionManager.loadExtensionIdSync(extensionId);
            registerDescriptor(String(extensionId), String(extensionId), Object.assign({}, metadata, {
                sourceKind: metadata.sourceKind || 'builtin-id'
            }));
            notify({
                extensionId: String(extensionId),
                kind: 'loaded',
                source: String(extensionId),
                sourceKind: 'builtin-id'
            });
            return result;
        },
        listLoadedExtensionIds,
        refreshBlocks () {
            if (typeof extensionManager.refreshBlocks === 'function') return extensionManager.refreshBlocks();
            return;
        },
        reorderExtension (extensionId, newIndex) {
            if (!Number.isInteger(newIndex) || newIndex < 0) {
                throw new TypeError('Scratch Extension Host reorderExtension requires a non-negative integer index.');
            }
            const ids = getLoadedExtensionOrder();
            const currentIndex = ids.indexOf(String(extensionId));
            if (currentIndex < 0) return false;
            if (currentIndex === newIndex) return true;
            if (typeof extensionManager.reorderExtension !== 'function') return false;
            extensionManager.reorderExtension(currentIndex, newIndex);
            notify({extensionId: String(extensionId), index: newIndex, kind: 'reordered'});
            return true;
        },
        subscribe (listener) {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        synchronizeLoadedExtensions,
        unloadExtension (extensionId) {
            if (!host.isExtensionLoaded(extensionId)) return Object.freeze({removed: false, serviceName: null});
            const loaded = extensionManager._loadedExtensions;
            const serviceName = loaded && typeof loaded.get === 'function' ? loaded.get(extensionId) : null;
            if (loaded && typeof loaded.delete === 'function') loaded.delete(extensionId);
            if (vm.runtime && Array.isArray(vm.runtime._blockInfo)) {
                vm.runtime._blockInfo = vm.runtime._blockInfo.filter(categoryInfo => categoryInfo.id !== extensionId);
            }
            controller.removeDescriptor(`${EXTENSION_HOST_KINDS.SCRATCH_EXTENSION}:${extensionId}`);
            if (typeof vm.emitWorkspaceUpdate === 'function') vm.emitWorkspaceUpdate();
            notify({extensionId: String(extensionId), kind: 'unloaded'});
            return Object.freeze({removed: true, serviceName: serviceName || null});
        }
    });
    synchronizeLoadedExtensions();
    return host;
};

const installScratchExtensionHost = vm => {
    let host = hostsByVM.get(vm);
    if (!host) {
        host = createScratchExtensionHost(vm);
        hostsByVM.set(vm, host);
        if (vm.runtime && !Object.prototype.hasOwnProperty.call(vm.runtime, SCRATCH_EXTENSION_RUNTIME_PROPERTY)) {
            Object.defineProperty(vm.runtime, SCRATCH_EXTENSION_RUNTIME_PROPERTY, {
                configurable: false,
                enumerable: false,
                value: Object.freeze({
                    getLoadedExtensionURLs: host.getLoadedExtensionURLs,
                    hostId: host.hostId,
                    isExtensionLoaded: host.isExtensionLoaded,
                    listLoadedExtensionIds: host.listLoadedExtensionIds,
                    synchronizeLoadedExtensions: host.synchronizeLoadedExtensions
                }),
                writable: false
            });
        }
    }
    return host;
};

module.exports = {
    SCRATCH_EXTENSION_RUNTIME_PROPERTY,
    createScratchExtensionHost,
    installScratchExtensionHost
};
