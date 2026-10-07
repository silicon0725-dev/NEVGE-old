import extensionLibraryContent from '../libraries/extensions/index.jsx';
import {
    EXTENSION_HOST_KINDS
} from '../extension-containment';
import {
    attachManifestToGalleryItem,
    extensionRegistry,
    inferLegacySourceId
} from '../extension-hub';

const EXTENSION_MANAGER_DISCOVERY_ADAPTER_ID = 'ngvge.workspace-extension-manager-discovery@1';

const readMessageFallback = value => {
    if (typeof value === 'string') return value;
    if (value && value.props) {
        if (typeof value.props.defaultMessage === 'string') return value.props.defaultMessage;
        if (typeof value.props.children === 'string') return value.props.children;
    }
    return '';
};

const normalizeGalleryItem = item => {
    if (!item || item === '---' || typeof item !== 'object') return null;
    const extensionId = typeof item.extensionId === 'string' ? item.extensionId.trim() : '';
    if (!extensionId || extensionId === 'custom_extension' || extensionId === 'procedures_enable_return') return null;
    if (item.href && !item.extensionURL) return null;
    const sourceId = inferLegacySourceId(item);
    const itemWithManifest = attachManifestToGalleryItem(item, {sourceId});
    return Object.freeze({
        adapterId: EXTENSION_MANAGER_DISCOVERY_ADAPTER_ID,
        description: readMessageFallback(item.description),
        extensionId,
        hostKind: EXTENSION_HOST_KINDS.SCRATCH_EXTENSION,
        iconURL: typeof item.iconURL === 'string' ? item.iconURL : null,
        manifest: itemWithManifest.ngvgeManifest,
        name: readMessageFallback(item.name) || extensionId,
        source: Object.freeze({
            kind: item.extensionURL ? 'url' : 'builtin-id',
            value: item.extensionURL || extensionId
        }),
        tags: Object.freeze(Array.isArray(item.tags) ? item.tags.slice() : [])
    });
};

const createBuiltInExtensionDiscoveryEntries = () => Object.freeze(
    extensionLibraryContent.map(normalizeGalleryItem).filter(Boolean)
);

const createRegistryDiscoveryEntries = () => Object.freeze(extensionRegistry.list().map(entry => {
    const manifest = entry.manifest || {};
    const item = entry.galleryItem || {};
    if (!manifest.id) return null;
    return Object.freeze({
        adapterId: EXTENSION_MANAGER_DISCOVERY_ADAPTER_ID,
        description: readMessageFallback(item.description),
        extensionId: manifest.id,
        hostKind: EXTENSION_HOST_KINDS.SCRATCH_EXTENSION,
        iconURL: typeof item.iconURL === 'string' ? item.iconURL : null,
        manifest,
        name: readMessageFallback(item.name) || manifest.id,
        source: Object.freeze({
            kind: manifest.source && manifest.source.mode === 'remote' ? 'url' : 'builtin-id',
            value: (manifest.source && manifest.source.url) || item.extensionURL || manifest.id
        }),
        tags: Object.freeze(
            manifest.metadata && Array.isArray(manifest.metadata.tags) ? manifest.metadata.tags.slice() : []
        )
    });
})
    .filter(Boolean));

const createExtensionManagerDiscoveryProvider = () => {
    const builtInEntries = createBuiltInExtensionDiscoveryEntries();
    return Object.freeze({
        adapterId: EXTENSION_MANAGER_DISCOVERY_ADAPTER_ID,
        list () {
            const byId = new Map();
            builtInEntries.forEach(entry => byId.set(entry.extensionId, entry));
            createRegistryDiscoveryEntries().forEach(entry => byId.set(entry.extensionId, entry));
            return Object.freeze(Array.from(byId.values()));
        },
        subscribe (listener) {
            if (!extensionRegistry || typeof extensionRegistry.subscribe !== 'function') return () => {};
            return extensionRegistry.subscribe(listener);
        }
    });
};

export {
    EXTENSION_MANAGER_DISCOVERY_ADAPTER_ID,
    createBuiltInExtensionDiscoveryEntries,
    createExtensionManagerDiscoveryProvider
};
