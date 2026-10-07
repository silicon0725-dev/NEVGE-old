const {
    EXTENSION_CONTAINMENT_AUTHORITY_ID,
    EXTENSION_CONTAINMENT_DOMAIN_ID,
    EXTENSION_HOST_IDS,
    EXTENSION_HOST_KINDS,
    EXTENSION_TRUST_LEVELS,
    installExtensionContainmentHost,
    registerNgvgeModuleDefinitions
} = require('../../../../src/lib/extension-containment');

const createVM = () => ({runtime: {}});

describe('LEX-1 extension containment host', () => {
    test('owns the containment domain with one writer authority', () => {
        const vm = createVM();
        const client = installExtensionContainmentHost(vm);
        expect(client.hostId).toBe('ngvge.extension-containment-host@1');
        expect(client.getAuthority()).toMatchObject({
            authorityId: EXTENSION_CONTAINMENT_AUTHORITY_ID,
            domain: EXTENSION_CONTAINMENT_DOMAIN_ID,
            mode: 'writer'
        });
        expect(vm.runtime.ngvgeExtensionContainment).toBe(client);
    });

    test('projects NGVGE module manifests into first-party descriptors without taking module host authority', () => {
        const vm = createVM();
        const client = registerNgvgeModuleDefinitions(vm, [{
            manifest: {
                capabilities: ['scene.runtime'],
                id: 'ngvge.test-module',
                name: 'Test Module',
                permissions: ['runtime'],
                version: '1.2.3'
            }
        }]);
        expect(client.listHosts()).toContainEqual({
            hostId: EXTENSION_HOST_IDS.NGVGE_MODULE,
            hostKind: EXTENSION_HOST_KINDS.NGVGE_MODULE
        });
        const descriptor = client.getDescriptor('ngvge-module:ngvge.test-module');
        expect(descriptor).toMatchObject({
            extensionId: 'ngvge.test-module',
            hostKind: EXTENSION_HOST_KINDS.NGVGE_MODULE,
            trust: {level: EXTENSION_TRUST_LEVELS.FIRST_PARTY}
        });
        expect(descriptor.capabilities).toContain('scene.runtime');
        expect(descriptor.permissions).toEqual(['runtime']);
    });
});
