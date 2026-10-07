const {createModuleManager} = require('../../../../src/lib/first-party-modules/module-manager');

const manifest = id => ({
    apiVersion: '1',
    availability: 'available',
    capabilities: [],
    compatibility: {sb3: {level: 'full', strategy: 'preserve-metadata'}},
    defaultEnabled: false,
    dependencies: [],
    id,
    kind: 'first-party',
    name: id,
    permissions: [],
    required: false,
    version: '1.0.0'
});

describe('module capability publication authority', () => {
    test('enable publishes only through the active synchronous hook frame', () => {
        const manager = createModuleManager();
        let retainedContext = null;
        manager.registerModule({
            manifest: manifest('test.publication'),
            hooks: {
                enable: context => {
                    retainedContext = context;
                    context.capabilities.provide('test.publication.registration', {ready: true});
                }
            }
        });

        expect(manager.enableModule('test.publication')).toBe(true);
        expect(manager.getCapability('test.publication.registration')).toEqual({ready: true});
        expect(() => retainedContext.capabilities.provide('test.publication.late', true)).toThrow(
            expect.objectContaining({code: 'MODULE_CAPABILITY_PROVISION_PHASE_FORBIDDEN'})
        );
    });

    test('same module id re-registration does not revive an old generation context', () => {
        const manager = createModuleManager();
        let oldContext = null;
        manager.registerModule({
            manifest: manifest('test.generation'),
            hooks: {enable: context => { oldContext = context; }}
        });
        manager.enableModule('test.generation');
        manager.unregisterModule('test.generation', {force: true});
        manager.registerModule({manifest: manifest('test.generation'), hooks: {}});

        expect(() => oldContext.data.get({})).toThrow(
            expect.objectContaining({code: 'MODULE_CLIENT_AUTHORITY_REVOKED'})
        );
    });
});
