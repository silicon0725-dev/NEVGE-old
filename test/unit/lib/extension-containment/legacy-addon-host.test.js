const {
    EXTENSION_CAPABILITIES,
    EXTENSION_TRUST_LEVELS,
    installExtensionContainmentHost,
    installLegacyAddonHost
} = require('../../../../src/lib/extension-containment');

const createVM = () => ({runtime: {}});

const createExtensionVM = () => {
    const loaded = new Map();
    const runtime = {
        _blockInfo: [],
        extensionManager: null,
        once: jest.fn(),
        off: jest.fn()
    };
    const extensionManager = {
        _loadedExtensions: loaded,
        getExtensionURLs: () => ({}),
        isExtensionLoaded: id => loaded.has(id),
        loadExtensionIdSync: jest.fn(id => {
            loaded.set(id, `extension.1.${id}`);
            return id;
        }),
        securityManager: {}
    };
    runtime.extensionManager = extensionManager;
    return {extensionManager, loaded, vm: {emitWorkspaceUpdate: jest.fn(), runtime}};
};

describe('LEX-1 Legacy Addon Host', () => {
    test('bundled legacy addon raw VM access is an explicit quarantine lease', () => {
        const vm = createVM();
        const host = installLegacyAddonHost(vm);
        const lease = host.acquireLegacyVM('find-bar', {name: 'Find Bar', tags: ['recommended']});
        expect(lease).toBe(vm);
        const descriptor = host.getAddonDescriptor('find-bar');
        expect(descriptor.trust.level).toBe(EXTENSION_TRUST_LEVELS.LEGACY_QUARANTINED);
        expect(descriptor.capabilities).toContain(EXTENSION_CAPABILITIES.LEGACY_RAW_VM_QUARANTINE);
        expect(installExtensionContainmentHost(vm).listDiagnostics().some(item =>
            item.code === 'LEX_LEGACY_RAW_VM_LEASE_ACQUIRED')).toBe(true);
    });

    test('declared Scratch extension capability loads built-ins without exposing raw VM authority', () => {
        const {extensionManager, loaded, vm} = createExtensionVM();
        vm.editingTarget = {};
        const host = installLegacyAddonHost(vm);
        const capability = host.acquireScratchExtensionCapability('load-extensions', {
            name: 'Automatically add extensions',
            ngvgeCapabilities: [EXTENSION_CAPABILITIES.LEGACY_SCRATCH_EXTENSION_LOAD_BUILTIN],
            tags: []
        });
        expect(Object.isFrozen(capability)).toBe(true);
        expect(capability).not.toHaveProperty('vm');
        expect(capability).not.toHaveProperty('extensionManager');
        expect(capability.isLoaded('pen')).toBe(false);
        capability.loadBuiltIn('pen');
        expect(extensionManager.loadExtensionIdSync).toHaveBeenCalledWith('pen');
        expect(loaded.has('pen')).toBe(true);
        expect(() => capability.loadBuiltIn('https://example.invalid/demo.js')).toThrow(
            expect.objectContaining({code: 'LEX_LEGACY_EXTENSION_BUILTIN_ONLY'})
        );
        expect(installExtensionContainmentHost(vm).listDiagnostics().some(item =>
            item.code === 'LEX_LEGACY_SCRATCH_EXTENSION_CAPABILITY_ACQUIRED')).toBe(true);
    });

    test('undeclared or untrusted addons cannot acquire Scratch extension capability', () => {
        const {vm} = createExtensionVM();
        const host = installLegacyAddonHost(vm);
        expect(() => host.acquireScratchExtensionCapability('legacy-addon', {tags: []})).toThrow(
            expect.objectContaining({code: 'LEX_LEGACY_CAPABILITY_UNDECLARED'})
        );
        expect(() => host.acquireScratchExtensionCapability('custom-addon', {
            ngvgeCapabilities: [EXTENSION_CAPABILITIES.LEGACY_SCRATCH_EXTENSION_LOAD_BUILTIN],
            tags: ['custom']
        })).toThrow(expect.objectContaining({code: 'LEX_LEGACY_CAPABILITY_UNDECLARED'}));
    });

    test('untrusted custom addon cannot acquire raw VM authority by default', () => {
        const vm = createVM();
        const host = installLegacyAddonHost(vm);
        expect(() => host.acquireLegacyVM('custom-addon', {
            name: 'Custom',
            tags: ['custom']
        })).toThrow(expect.objectContaining({code: 'LEX_LEGACY_RAW_VM_DENIED'}));
        expect(host.getAddonDescriptor('custom-addon').trust.level).toBe(EXTENSION_TRUST_LEVELS.UNTRUSTED);
    });
});
