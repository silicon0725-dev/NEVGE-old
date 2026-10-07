const {
    ExtensionRegistry,
    ExtensionSourceRegistry,
    SOURCE_KEYS,
    attachManifestToGalleryItem,
    createManifestFromLegacyItem,
    inferLegacySourceId,
    sourceRegistry
} = require('../../../src/lib/extension-hub');

describe('Extension Hub foundation', () => {
    test('keeps built-in online source entries', () => {
        expect(sourceRegistry.has(SOURCE_KEYS.TW)).toBe(true);
        expect(sourceRegistry.has(SOURCE_KEYS.PM)).toBe(true);
        expect(sourceRegistry.has(SOURCE_KEYS.ASTRA)).toBe(true);
        expect(sourceRegistry.has(SOURCE_KEYS.CCW)).toBe(true);
    });

    test('infers legacy source tags', () => {
        expect(inferLegacySourceId({extensionId: 'example', tags: ['tw']})).toBe(SOURCE_KEYS.TW);
        expect(inferLegacySourceId({extensionId: 'example', tags: ['ngvge']})).toBe(SOURCE_KEYS.NGVGE);
    });

    test('creates manifest v2 without changing gallery data', () => {
        const item = {extensionId: 'camera', extensionURL: 'https://example.com/camera.js', tags: ['tw']};
        const normalized = attachManifestToGalleryItem(item);
        expect(normalized.extensionURL).toBe(item.extensionURL);
        expect(normalized.ngvgeManifest.manifestVersion).toBe(2);
        expect(normalized.ngvgeManifest.source.id).toBe(SOURCE_KEYS.TW);
    });

    test('source registry accepts future network providers', async () => {
        const registry = new ExtensionSourceRegistry();
        registry.register({id: 'test', fetchExtensions: async () => [{id: 'one'}]});
        await expect(registry.fetch('test')).resolves.toEqual([{id: 'one'}]);
    });

    test('extension registry indexes manifests', () => {
        const registry = new ExtensionRegistry();
        const manifest = createManifestFromLegacyItem({extensionId: 'pen', tags: ['scratch']});
        registry.register(manifest);
        expect(registry.get('pen').manifest).toBe(manifest);
    });

    test('extension registry publishes discovery lifecycle events', () => {
        const registry = new ExtensionRegistry();
        const manifest = createManifestFromLegacyItem({extensionId: 'pen', tags: ['scratch']});
        const events = [];
        const unsubscribe = registry.subscribe(event => events.push(event));
        registry.register(manifest);
        expect(events[0]).toMatchObject({extensionId: 'pen', revision: 1, type: 'extension:registered'});
        registry.unregister('pen');
        expect(events[1]).toMatchObject({extensionId: 'pen', revision: 2, type: 'extension:unregistered'});
        unsubscribe();
    });
});
