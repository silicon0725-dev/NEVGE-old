const {
    EXTENSION_CAPABILITIES,
    EXTENSION_HOST_KINDS,
    EXTENSION_TRUST_LEVELS,
    installExtensionContainmentHost,
    installScratchExtensionHost
} = require('../../../../src/lib/extension-containment');

const createVM = () => {
    const urls = {};
    const loaded = new Map();
    const extensionManager = {
        _loadedExtensions: loaded,
        getExtensionURLs: () => Object.assign({}, urls),
        isExtensionLoaded: id => loaded.has(id),
        loadExtensionURL: jest.fn(async source => {
            const id = source === 'pen' ? 'pen' : 'demo';
            loaded.set(id, `extension.1.${id}`);
            if (source !== id) urls[id] = source;
            return id;
        }),
        loadExtensionIdSync: jest.fn(id => {
            loaded.set(id, `extension.1.${id}`);
            return id;
        }),
        reorderExtension: jest.fn(),
        refreshBlocks: jest.fn(),
        securityManager: {}
    };
    const vm = {
        emitWorkspaceUpdate: jest.fn(),
        extensionManager,
        runtime: {
            _blockInfo: [{id: 'demo'}, {id: 'motion'}],
            extensionManager
        }
    };
    return {extensionManager, loaded, urls, vm};
};

describe('LEX-1 Scratch Extension Host', () => {
    test('contains load/list/unload backend access and records descriptors', async () => {
        const {loaded, vm} = createVM();
        const host = installScratchExtensionHost(vm);
        await host.loadExtensionURL('https://example.invalid/demo.js', {
            extensionId: 'demo',
            sourceKind: 'test-url'
        });
        expect(host.listLoadedExtensionIds()).toEqual(['demo']);
        expect(host.isExtensionLoaded('demo')).toBe(true);
        const descriptor = installExtensionContainmentHost(vm)
            .getDescriptor('scratch-extension:demo');
        expect(descriptor).toMatchObject({
            extensionId: 'demo',
            hostKind: EXTENSION_HOST_KINDS.SCRATCH_EXTENSION,
            trust: {level: EXTENSION_TRUST_LEVELS.SANDBOXED}
        });
        const result = host.unloadExtension('demo');
        expect(result.removed).toBe(true);
        expect(loaded.has('demo')).toBe(false);
        expect(vm.runtime._blockInfo.map(item => item.id)).toEqual(['motion']);
        expect(vm.emitWorkspaceUpdate).toHaveBeenCalledTimes(1);
    });

    test('keeps unsandboxed execution as an explicit quarantine request', async () => {
        const {vm} = createVM();
        const host = installScratchExtensionHost(vm);
        await host.loadExtensionURL('data:application/javascript,void 0', {
            extensionId: 'demo',
            requestedUnsandboxed: true,
            sourceKind: 'custom-text'
        });
        const client = installExtensionContainmentHost(vm);
        const descriptor = client.getDescriptor('scratch-extension:demo');
        expect(descriptor.trust.level).toBe(EXTENSION_TRUST_LEVELS.LEGACY_QUARANTINED);
        expect(descriptor.capabilities).toContain(EXTENSION_CAPABILITIES.LEGACY_UNSANDBOXED_CODE_QUARANTINE);
        expect(client.listDiagnostics().some(item =>
            item.code === 'LEX_UNSANDBOXED_EXTENSION_REQUEST_QUARANTINED')).toBe(true);
    });

    test('provides observable builtin/reorder/unload mutations without exposing ExtensionManager', () => {
        const {extensionManager, loaded, vm} = createVM();
        const host = installScratchExtensionHost(vm);
        const events = [];
        const unsubscribe = host.subscribe(event => events.push(event));
        host.loadBuiltInExtension('pen');
        expect(loaded.has('pen')).toBe(true);
        host.reorderExtension('pen', 0);
        expect(extensionManager.reorderExtension).not.toHaveBeenCalled();
        host.unloadExtension('pen');
        unsubscribe();
        expect(events.map(event => event.kind)).toEqual(['loaded', 'unloaded']);
        expect(events.every(event => event.hostId === 'ngvge.extension-host.scratch-extension@1')).toBe(true);
    });

    test('configures Scratch security policy only through the host adapter', () => {
        const {extensionManager, vm} = createVM();
        const host = installScratchExtensionHost(vm);
        const canFetch = jest.fn();
        expect(host.configureSecurityManager({canFetch})).toBe(true);
        expect(extensionManager.securityManager.canFetch).toBe(canFetch);
    });
});
