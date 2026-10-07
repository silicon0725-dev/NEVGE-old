import {EXTENSION_HOST_KINDS} from '../extension-containment';
import {CORE_MODULE_ID, MODULE_AVAILABILITY} from '../first-party-modules/constants';

const WORKSPACE_EXTENSION_MANAGER_MODEL_ID = 'ngvge.workspace-extension-manager-model@1';
const WORKSPACE_EXTENSION_MANAGER_ITEM_SCHEMA_VERSION = 1;

const EXTENSION_MANAGER_ITEM_STATUS = Object.freeze({
    DISABLED: 'disabled',
    ENABLED: 'enabled',
    UNAVAILABLE: 'unavailable'
});

const EXTENSION_MANAGER_CATEGORIES = Object.freeze({
    LEGACY_ADDONS: EXTENSION_HOST_KINDS.LEGACY_ADDON,
    NGVGE_MODULES: EXTENSION_HOST_KINDS.NGVGE_MODULE,
    SCRATCH_EXTENSIONS: EXTENSION_HOST_KINDS.SCRATCH_EXTENSION
});

const cloneArray = value => Object.freeze(Array.isArray(value) ? value.slice() : []);

const makeManagerItemId = (hostKind, extensionId) => `${hostKind}:${extensionId}`;

const normalizeDiscoverySource = entry => Object.freeze({
    kind: entry && entry.source && typeof entry.source.kind === 'string' ? entry.source.kind : 'unknown',
    value: entry && entry.source && typeof entry.source.value === 'string' ? entry.source.value : null
});

const makeTrustProjection = descriptor => (descriptor ? Object.freeze({
    effectiveExecutionMode: descriptor.trust.effectiveExecutionMode,
    evaluated: true,
    level: descriptor.trust.level,
    requestedExecutionMode: descriptor.trust.requestedExecutionMode
}) : Object.freeze({
    effectiveExecutionMode: null,
    evaluated: false,
    level: null,
    requestedExecutionMode: null
}));

const createModuleItems = (moduleClient, containmentClient) => {
    if (!moduleClient || typeof moduleClient.listModules !== 'function') return [];
    return moduleClient.listModules()
        .filter(entry => entry && entry.manifest && entry.manifest.id !== CORE_MODULE_ID)
        .map(entry => {
            const manifest = entry.manifest;
            const state = entry.state || {};
            const descriptor = containmentClient.getDescriptor(
                makeManagerItemId(EXTENSION_HOST_KINDS.NGVGE_MODULE, manifest.id)
            );
            const unavailable = manifest.availability === MODULE_AVAILABILITY.PLANNED;
            return Object.freeze({
                capabilities: cloneArray(descriptor ? descriptor.capabilities : manifest.capabilities),
                category: EXTENSION_HOST_KINDS.NGVGE_MODULE,
                compatibility: Object.freeze({
                    legacy: false,
                    quarantine: false,
                    scratch: manifest.compatibility && manifest.compatibility.sb3 ?
                        manifest.compatibility.sb3.level : null
                }),
                description: typeof manifest.description === 'string' ? manifest.description : '',
                descriptorId: descriptor ? descriptor.descriptorId : null,
                enabled: Boolean(state.enabled),
                extensionId: manifest.id,
                hostKind: EXTENSION_HOST_KINDS.NGVGE_MODULE,
                iconURL: null,
                installed: true,
                itemId: makeManagerItemId(EXTENSION_HOST_KINDS.NGVGE_MODULE, manifest.id),
                name: manifest.name || manifest.id,
                permissions: cloneArray(descriptor ? descriptor.permissions : manifest.permissions),
                schemaVersion: WORKSPACE_EXTENSION_MANAGER_ITEM_SCHEMA_VERSION,
                settings: Object.freeze([]),
                source: descriptor ? descriptor.source : Object.freeze({
                    kind: 'built-in-module',
                    value: manifest.version
                }),
                status: unavailable ? EXTENSION_MANAGER_ITEM_STATUS.UNAVAILABLE :
                    (state.enabled ? EXTENSION_MANAGER_ITEM_STATUS.ENABLED : EXTENSION_MANAGER_ITEM_STATUS.DISABLED),
                tags: Object.freeze(['ngvge', 'module', manifest.availability].filter(Boolean)),
                trust: makeTrustProjection(descriptor),
                updateAvailable: false,
                version: manifest.version || null
            });
        });
};

const createScratchItems = (scratchHost, containmentClient, discoveryProvider) => {
    const discoveryEntries = discoveryProvider ? discoveryProvider.list() : [];
    const loadedIds = new Set(scratchHost.listLoadedExtensionIds());
    const byId = new Map();

    discoveryEntries.forEach(entry => byId.set(entry.extensionId, entry));
    loadedIds.forEach(extensionId => {
        if (!byId.has(extensionId)) {
            byId.set(extensionId, Object.freeze({
                description: '',
                extensionId,
                hostKind: EXTENSION_HOST_KINDS.SCRATCH_EXTENSION,
                iconURL: null,
                manifest: null,
                name: extensionId,
                source: Object.freeze({kind: 'backend-loaded-id', value: extensionId}),
                tags: Object.freeze([])
            }));
        }
    });

    return Array.from(byId.values()).map(entry => {
        const descriptor = containmentClient.getDescriptor(
            makeManagerItemId(EXTENSION_HOST_KINDS.SCRATCH_EXTENSION, entry.extensionId)
        );
        const manifest = entry.manifest || {};
        const loaded = scratchHost.isExtensionLoaded(entry.extensionId) || loadedIds.has(entry.extensionId);
        return Object.freeze({
            capabilities: cloneArray(descriptor ? descriptor.capabilities : []),
            category: EXTENSION_HOST_KINDS.SCRATCH_EXTENSION,
            compatibility: Object.freeze({
                legacy: descriptor ? descriptor.compatibility.legacy : Boolean(manifest.legacy),
                ngvge: manifest.compatibility ? manifest.compatibility.ngvge !== false : true,
                quarantine: descriptor ? descriptor.compatibility.quarantine : false,
                scratch: manifest.compatibility ? manifest.compatibility.scratch !== false : true
            }),
            description: entry.description || '',
            descriptorId: descriptor ? descriptor.descriptorId : null,
            enabled: loaded,
            extensionId: entry.extensionId,
            hostKind: EXTENSION_HOST_KINDS.SCRATCH_EXTENSION,
            iconURL: entry.iconURL || null,
            installed: loaded,
            itemId: makeManagerItemId(EXTENSION_HOST_KINDS.SCRATCH_EXTENSION, entry.extensionId),
            name: entry.name || entry.extensionId,
            permissions: cloneArray(descriptor ? descriptor.permissions : manifest.permissions),
            schemaVersion: WORKSPACE_EXTENSION_MANAGER_ITEM_SCHEMA_VERSION,
            settings: Object.freeze([]),
            source: descriptor ? descriptor.source : normalizeDiscoverySource(entry),
            status: loaded ? EXTENSION_MANAGER_ITEM_STATUS.ENABLED : EXTENSION_MANAGER_ITEM_STATUS.DISABLED,
            tags: cloneArray(entry.tags),
            trust: makeTrustProjection(descriptor),
            updateAvailable: false,
            version: manifest.version || null
        });
    });
};

const createLegacyAddonItems = (legacyAddonAdapter, containmentClient) => legacyAddonAdapter.list().map(entry => {
    const descriptor = containmentClient.getDescriptor(
        makeManagerItemId(EXTENSION_HOST_KINDS.LEGACY_ADDON, entry.extensionId)
    );
    return Object.freeze({
        capabilities: cloneArray(descriptor ? descriptor.capabilities : []),
        category: EXTENSION_HOST_KINDS.LEGACY_ADDON,
        compatibility: descriptor ? descriptor.compatibility : Object.freeze({legacy: true, quarantine: true}),
        description: entry.description,
        descriptorId: descriptor ? descriptor.descriptorId : null,
        dynamicDisable: entry.dynamicDisable,
        enabled: entry.enabled,
        extensionId: entry.extensionId,
        hostKind: EXTENSION_HOST_KINDS.LEGACY_ADDON,
        iconURL: null,
        installed: entry.installed,
        itemId: makeManagerItemId(EXTENSION_HOST_KINDS.LEGACY_ADDON, entry.extensionId),
        name: entry.name,
        permissions: cloneArray(descriptor ? descriptor.permissions : []),
        schemaVersion: WORKSPACE_EXTENSION_MANAGER_ITEM_SCHEMA_VERSION,
        settings: entry.settings,
        source: descriptor ? descriptor.source : Object.freeze({kind: 'bundled-legacy-addon', value: null}),
        status: entry.enabled ? EXTENSION_MANAGER_ITEM_STATUS.ENABLED : EXTENSION_MANAGER_ITEM_STATUS.DISABLED,
        tags: entry.tags,
        trust: makeTrustProjection(descriptor),
        updateAvailable: false,
        version: null
    });
});

class WorkspaceExtensionManagerModel {
    constructor ({
        containmentClient,
        discoveryProvider,
        legacyAddonAdapter,
        moduleClient,
        scratchExtensionHost
    }) {
        if (!containmentClient || typeof containmentClient.listDescriptors !== 'function') {
            throw new TypeError('Workspace Extension Manager requires the LEX containment query client.');
        }
        if (!scratchExtensionHost || typeof scratchExtensionHost.listLoadedExtensionIds !== 'function') {
            throw new TypeError('Workspace Extension Manager requires ScratchExtensionHost.');
        }
        if (!legacyAddonAdapter || typeof legacyAddonAdapter.list !== 'function') {
            throw new TypeError('Workspace Extension Manager requires LegacyAddonManagerAdapter.');
        }
        this.id = WORKSPACE_EXTENSION_MANAGER_MODEL_ID;
        this._containmentClient = containmentClient;
        this._discoveryProvider = discoveryProvider;
        this._legacyAddonAdapter = legacyAddonAdapter;
        this._moduleClient = moduleClient;
        this._scratchExtensionHost = scratchExtensionHost;
        this._listeners = new Set();
        this._disposers = [];
        this._revision = 0;
        this._items = Object.freeze([]);
        this._bindSources();
        this.refresh('init');
    }

    get revision () {
        return this._revision;
    }

    _bindSources () {
        const bind = source => {
            if (!source || typeof source.subscribe !== 'function') return;
            this._disposers.push(source.subscribe(() => this.refresh('source')));
        };
        bind(this._moduleClient);
        bind(this._scratchExtensionHost);
        bind(this._legacyAddonAdapter);
        bind(this._discoveryProvider);
    }

    _emit (type, itemId = null) {
        this._revision += 1;
        const event = Object.freeze({itemId, modelId: this.id, revision: this._revision, type});
        this._listeners.forEach(listener => listener(event));
        return event;
    }

    subscribe (listener) {
        if (typeof listener !== 'function') {
            throw new TypeError('Workspace Extension Manager listener must be a function.');
        }
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    refresh (reason = 'refresh') {
        if (typeof this._scratchExtensionHost.synchronizeLoadedExtensions === 'function') {
            this._scratchExtensionHost.synchronizeLoadedExtensions();
        }
        const items = [
            ...createModuleItems(this._moduleClient, this._containmentClient),
            ...createScratchItems(
                this._scratchExtensionHost,
                this._containmentClient,
                this._discoveryProvider
            ),
            ...createLegacyAddonItems(this._legacyAddonAdapter, this._containmentClient)
        ].sort((a, b) => a.name.localeCompare(b.name) || a.itemId.localeCompare(b.itemId));
        this._items = Object.freeze(items);
        return this._emit(`model:${reason}`);
    }

    listItems () {
        return this._items;
    }

    getItem (itemId) {
        return this._items.find(item => item.itemId === itemId) || null;
    }

    getDiagnostics () {
        return this._containmentClient.listDiagnostics();
    }

    async setEnabled (itemId, enabled) {
        const item = this.getItem(itemId);
        if (!item) throw new Error(`Unknown Extension Manager item: ${itemId}`);
        const nextEnabled = Boolean(enabled);
        if (item.status === EXTENSION_MANAGER_ITEM_STATUS.UNAVAILABLE) {
            throw new Error(`Extension Manager item is unavailable: ${itemId}`);
        }
        if (item.hostKind === EXTENSION_HOST_KINDS.NGVGE_MODULE) {
            if (!this._moduleClient) throw new Error('NGVGE Module Manager client is unavailable.');
            if (nextEnabled) this._moduleClient.enableModule(item.extensionId);
            else this._moduleClient.disableModule(item.extensionId);
        } else if (item.hostKind === EXTENSION_HOST_KINDS.SCRATCH_EXTENSION) {
            if (nextEnabled) {
                if (item.source.kind === 'builtin-id' || item.source.kind === 'backend-loaded-id') {
                    this._scratchExtensionHost.loadBuiltInExtension(item.extensionId, {
                        displayName: item.name,
                        sourceKind: 'workspace-extension-manager'
                    });
                } else if (item.source.value) {
                    await this._scratchExtensionHost.loadExtensionURL(item.source.value, {
                        displayName: item.name,
                        extensionId: item.extensionId,
                        sourceKind: 'workspace-extension-manager'
                    });
                } else {
                    throw new Error(`Scratch extension has no loadable source: ${item.itemId}`);
                }
            } else {
                this._scratchExtensionHost.unloadExtension(item.extensionId);
            }
        } else if (item.hostKind === EXTENSION_HOST_KINDS.LEGACY_ADDON) {
            this._legacyAddonAdapter.setEnabled(item.extensionId, nextEnabled);
        } else {
            throw new Error(`Unsupported Extension Manager host kind: ${item.hostKind}`);
        }
        this.refresh('enabled-changed');
        return this.getItem(itemId);
    }

    setSetting (itemId, settingId, value) {
        const item = this.getItem(itemId);
        if (!item) throw new Error(`Unknown Extension Manager item: ${itemId}`);
        if (item.hostKind !== EXTENSION_HOST_KINDS.LEGACY_ADDON) {
            throw new Error('Generic Extension Manager settings are currently available only for Legacy Addons.');
        }
        this._legacyAddonAdapter.setSetting(item.extensionId, settingId, value);
        this.refresh('setting-changed');
        return this.getItem(itemId);
    }

    dispose () {
        this._disposers.splice(0).forEach(disposer => disposer());
        this._listeners.clear();
    }
}

export {
    EXTENSION_MANAGER_CATEGORIES,
    EXTENSION_MANAGER_ITEM_STATUS,
    WORKSPACE_EXTENSION_MANAGER_ITEM_SCHEMA_VERSION,
    WORKSPACE_EXTENSION_MANAGER_MODEL_ID,
    WorkspaceExtensionManagerModel,
    makeManagerItemId
};
