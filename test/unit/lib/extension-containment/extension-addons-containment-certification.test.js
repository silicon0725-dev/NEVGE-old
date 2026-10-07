'use strict';

const {
    EXTENSION_CAPABILITIES,
    EXTENSION_CONTAINMENT_AUTHORITY_ID,
    EXTENSION_CONTAINMENT_DOMAIN_ID,
    EXTENSION_EXECUTION_MODES,
    EXTENSION_HOST_IDS,
    EXTENSION_HOST_KINDS,
    EXTENSION_TRUST_LEVELS,
    getExtensionContainmentController,
    installExtensionContainmentHost,
    installLegacyAddonHost,
    installScratchExtensionHost,
    registerNgvgeModuleDefinitions
} = require('../../../../src/lib/extension-containment');

const createVM = () => {
    const loaded = new Map();
    const urls = {};
    const runtime = {
        _blockInfo: [],
        extensionManager: null,
        once: jest.fn(),
        off: jest.fn()
    };
    const extensionManager = {
        _loadedExtensions: loaded,
        getExtensionURLs: () => Object.assign({}, urls),
        isExtensionLoaded: id => loaded.has(id),
        loadExtensionURL: jest.fn(async source => {
            const id = 'demo';
            loaded.set(id, `extension.1.${id}`);
            urls[id] = source;
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
    runtime.extensionManager = extensionManager;
    const vm = {emitWorkspaceUpdate: jest.fn(), extensionManager, runtime};
    return {extensionManager, loaded, runtime, vm};
};

describe('LEX-G1 Extension / Addons Containment Certification', () => {
    test('certifies one containment writer and three distinct host identities', () => {
        const {vm} = createVM();
        const client = installExtensionContainmentHost(vm);
        installScratchExtensionHost(vm);
        installLegacyAddonHost(vm).registerAddon('legacy', {tags: []});
        registerNgvgeModuleDefinitions(vm, [{
            manifest: {id: 'ngvge.test', name: 'Test', version: '1.0.0'}
        }]);

        expect(client.getAuthority()).toEqual(expect.objectContaining({
            authorityId: EXTENSION_CONTAINMENT_AUTHORITY_ID,
            domain: EXTENSION_CONTAINMENT_DOMAIN_ID,
            mode: 'writer'
        }));
        expect(client.listHosts()).toEqual(expect.arrayContaining([
            {hostId: EXTENSION_HOST_IDS.NGVGE_MODULE, hostKind: EXTENSION_HOST_KINDS.NGVGE_MODULE},
            {hostId: EXTENSION_HOST_IDS.SCRATCH_EXTENSION, hostKind: EXTENSION_HOST_KINDS.SCRATCH_EXTENSION},
            {hostId: EXTENSION_HOST_IDS.LEGACY_ADDON, hostKind: EXTENSION_HOST_KINDS.LEGACY_ADDON}
        ]));
        expect(() => getExtensionContainmentController(vm).registerHost({
            hostId: 'conflicting-host@1',
            hostKind: EXTENSION_HOST_KINDS.SCRATCH_EXTENSION
        })).toThrow(expect.objectContaining({code: 'LEX_HOST_KIND_WRITER_CONFLICT'}));
    });

    test('runtime containment surfaces are query-only and do not expose backend handles', () => {
        const {runtime, vm} = createVM();
        const client = installExtensionContainmentHost(vm);
        const scratchHost = installScratchExtensionHost(vm);
        const legacyHost = installLegacyAddonHost(vm);

        expect(runtime.ngvgeExtensionContainment).toBe(client);
        expect(Object.isFrozen(runtime.ngvgeExtensionContainment)).toBe(true);
        expect(runtime.ngvgeExtensionContainment).not.toHaveProperty('upsertDescriptor');
        expect(runtime.ngvgeExtensionContainment).not.toHaveProperty('registerHost');
        expect(runtime.ngvgeScratchExtensionHost).not.toHaveProperty('extensionManager');
        expect(runtime.ngvgeLegacyAddonHost).not.toHaveProperty('vm');
        expect(scratchHost).not.toHaveProperty('extensionManager');
        expect(legacyHost).not.toHaveProperty('vm');
    });

    test('legacy raw VM remains explicit quarantine while untrusted addons are denied', () => {
        const {vm} = createVM();
        const host = installLegacyAddonHost(vm);
        expect(host.acquireLegacyVM('bundled', {tags: []})).toBe(vm);
        expect(host.getAddonDescriptor('bundled').capabilities).toContain(
            EXTENSION_CAPABILITIES.LEGACY_RAW_VM_QUARANTINE
        );
        expect(() => host.acquireLegacyVM('custom', {tags: ['custom']})).toThrow(
            expect.objectContaining({code: 'LEX_LEGACY_RAW_VM_DENIED'})
        );
    });

    test('declared legacy capability can load only built-in Scratch extensions without a raw VM lease', () => {
        const {extensionManager, vm} = createVM();
        vm.editingTarget = {};
        const legacyHost = installLegacyAddonHost(vm);
        const capability = legacyHost.acquireScratchExtensionCapability('load-extensions', {
            ngvgeCapabilities: [EXTENSION_CAPABILITIES.LEGACY_SCRATCH_EXTENSION_LOAD_BUILTIN],
            tags: []
        });
        capability.loadBuiltIn('music');

        expect(extensionManager.loadExtensionIdSync).toHaveBeenCalledWith('music');
        expect(capability).not.toHaveProperty('vm');
        expect(capability).not.toHaveProperty('extensionManager');
        expect(legacyHost.getAddonDescriptor('load-extensions').capabilities).not.toContain(
            EXTENSION_CAPABILITIES.LEGACY_RAW_VM_QUARANTINE
        );
        expect(() => capability.loadBuiltIn('https://example.invalid/x.js')).toThrow(
            expect.objectContaining({code: 'LEX_LEGACY_EXTENSION_BUILTIN_ONLY'})
        );
    });

    test('undeclared or custom addons cannot manufacture the declared Scratch extension capability', () => {
        const {vm} = createVM();
        const host = installLegacyAddonHost(vm);
        expect(() => host.acquireScratchExtensionCapability('bundled', {tags: []})).toThrow(
            expect.objectContaining({code: 'LEX_LEGACY_CAPABILITY_UNDECLARED'})
        );
        expect(() => host.acquireScratchExtensionCapability('custom', {
            ngvgeCapabilities: [EXTENSION_CAPABILITIES.LEGACY_SCRATCH_EXTENSION_LOAD_BUILTIN],
            tags: ['custom']
        })).toThrow(expect.objectContaining({code: 'LEX_LEGACY_CAPABILITY_UNDECLARED'}));
    });

    test('unsandboxed Scratch extension request remains backend-managed and quarantined', async () => {
        const {vm} = createVM();
        const scratchHost = installScratchExtensionHost(vm);
        await scratchHost.loadExtensionURL('data:application/javascript,void 0', {
            extensionId: 'demo',
            requestedUnsandboxed: true,
            sourceKind: 'custom-text'
        });
        const descriptor = installExtensionContainmentHost(vm).getDescriptor('scratch-extension:demo');
        expect(descriptor.trust).toEqual(expect.objectContaining({
            effectiveExecutionMode: EXTENSION_EXECUTION_MODES.BACKEND_MANAGED,
            level: EXTENSION_TRUST_LEVELS.LEGACY_QUARANTINED,
            requestedExecutionMode: 'unsandboxed'
        }));
        expect(descriptor.capabilities).toContain(EXTENSION_CAPABILITIES.LEGACY_UNSANDBOXED_CODE_QUARANTINE);
    });

    test('NGVGE Module permissions and capabilities remain descriptor declarations, not Scratch host authority', () => {
        const {vm} = createVM();
        const client = registerNgvgeModuleDefinitions(vm, [{
            manifest: {
                capabilities: ['scene.runtime'],
                id: 'ngvge.module.test',
                name: 'Module',
                permissions: ['runtime'],
                version: '1.0.0'
            }
        }]);
        const descriptor = client.getDescriptor('ngvge-module:ngvge.module.test');
        expect(descriptor.hostKind).toBe(EXTENSION_HOST_KINDS.NGVGE_MODULE);
        expect(descriptor.permissions).toEqual(['runtime']);
        expect(descriptor.capabilities).toContain('scene.runtime');
        expect(descriptor.capabilities).not.toContain(EXTENSION_CAPABILITIES.SCRATCH_EXTENSION_LOAD);
    });

    test('observer failure cannot break Scratch extension host mutation', () => {
        const {extensionManager, vm} = createVM();
        const host = installScratchExtensionHost(vm);
        host.subscribe(() => {
            throw new Error('observer failure');
        });
        expect(() => host.loadBuiltInExtension('pen')).not.toThrow();
        expect(extensionManager.loadExtensionIdSync).toHaveBeenCalledWith('pen');
    });

    test('containment descriptors and diagnostics are immutable snapshots', () => {
        const {vm} = createVM();
        const host = installLegacyAddonHost(vm);
        host.registerAddon('legacy', {tags: []});
        const client = installExtensionContainmentHost(vm);
        const descriptor = client.getDescriptor('legacy-addon:legacy');
        expect(Object.isFrozen(descriptor)).toBe(true);
        expect(Object.isFrozen(descriptor.capabilities)).toBe(true);
        expect(Object.isFrozen(client.listDescriptors())).toBe(true);
        expect(Object.isFrozen(client.listDiagnostics())).toBe(true);
    });
});
