const {
    CORE_MODULE_ID,
    MODULE_AVAILABILITY,
    MODULE_KINDS,
    createModuleManager,
    getBuiltInModuleDefinitions
} = require('../../../../src/lib/first-party-modules');

const createManifest = id => ({
    apiVersion: '1',
    availability: MODULE_AVAILABILITY.AVAILABLE,
    capabilities: [],
    defaultEnabled: false,
    dependencies: [],
    description: `${id} test module.`,
    id,
    kind: MODULE_KINDS.FIRST_PARTY,
    name: id,
    permissions: [],
    version: '1'
});

describe('0008.9.4.1.4 Module Host and Client Authority Surface Closure', () => {
    test('module contexts expose only the Client facade', () => {
        const manager = createModuleManager();
        let client = null;
        manager.registerModule({
            manifest: createManifest('client-surface'),
            hooks: {
                enable: context => {
                    client = context.manager;
                    context.capabilities.provide('client-surface.registration', true);
                }
            }
        });

        expect(manager.enableModule('client-surface')).toBe(true);
        expect(Object.isFrozen(client)).toBe(true);
        expect(client.registry).toBeUndefined();
        expect(client.capabilities).toBeUndefined();
        expect(client.dataStore).toBeUndefined();
        expect(client.disableModule).toBeUndefined();
        expect(typeof client.enableModule).toBe('function');
    });

    test('raw infrastructure mutations are rejected in observer and completion domains', () => {
        const manager = createModuleManager();
        manager.registerModule({
            manifest: createManifest('guarded'),
            hooks: {
                completeEnable: context => {
                    expect(() => manager.unregisterModule(context.moduleId, {force: true})).toThrow(
                        expect.objectContaining({code: 'MODULE_COMPLETION_REENTRANT_MUTATION'})
                    );
                },
                enable: context => context.capabilities.provide('guarded.registration', true)
            }
        });
        manager.subscribe(change => {
            if (change.type === 'module:enable-pending') manager.unregisterModule(change.moduleId, {force: true});
        });

        expect(manager.enableModule('guarded')).toBe(true);
        expect(manager.hasModule('guarded')).toBe(true);
        expect(manager.getCapability('guarded.registration')).toBe(true);
        expect(manager.getObserverErrorSnapshot().lastError.code).toBe('MODULE_OBSERVER_REENTRANT_MUTATION');
    });

    test('provider identity and module data ownership cannot be forged', () => {
        const manager = createModuleManager();
        manager.registerModule({
            manifest: createManifest('owner'),
            hooks: {
                initialize: context => {
                    context.capabilities.provide('shared', {value: 'old'});
                    context.data.set({value: 'owner'});
                }
            }
        });
        manager.registerModule({
            manifest: createManifest('attacker'),
            hooks: {
                initialize: () => manager.provideCapability(
                    'owner',
                    'shared',
                    {value: 'new'},
                    {replace: true}
                )
            }
        });
        manager.registerModule({
            manifest: createManifest('data-attacker'),
            hooks: {
                initialize: () => manager.setModuleData('owner', {value: 'attacker'})
            }
        });

        expect(manager.initializeModule('owner')).toBe(true);
        expect(() => manager.initializeModule('attacker')).toThrow(
            expect.objectContaining({code: 'MODULE_HOST_AUTHORITY_REQUIRED'})
        );
        expect(() => manager.initializeModule('data-attacker')).toThrow(
            expect.objectContaining({code: 'MODULE_HOST_AUTHORITY_REQUIRED'})
        );
        expect(manager.getCapability('shared')).toEqual({value: 'old'});
        expect(manager.getModuleData('owner')).toEqual({value: 'owner'});
    });

    test('retained module authority is generation-scoped and capability publication is phase-scoped', () => {
        const manager = createModuleManager();
        let context = null;
        manager.registerModule({
            manifest: createManifest('retained'),
            hooks: {
                enable: nextContext => {
                    context = nextContext;
                    context.capabilities.provide('retained.registration', true);
                }
            }
        });
        manager.enableModule('retained');

        expect(() => context.capabilities.provide('retained.late', true)).toThrow(
            expect.objectContaining({code: 'MODULE_CAPABILITY_PROVISION_PHASE_FORBIDDEN'})
        );
        expect(manager.unregisterModule('retained', {force: true})).toBe(true);
        expect(() => context.data.set({value: 1})).toThrow(
            expect.objectContaining({code: 'MODULE_CLIENT_AUTHORITY_REVOKED'})
        );

        manager.registerModule({manifest: createManifest('retained'), hooks: {}});
        expect(() => context.manager.listModules()).toThrow(
            expect.objectContaining({code: 'MODULE_CLIENT_AUTHORITY_REVOKED'})
        );
    });

    test('core capabilities publish only Client and read-only data facades', () => {
        const manager = createModuleManager();
        const core = getBuiltInModuleDefinitions().find(definition => definition.manifest.id === CORE_MODULE_ID);
        manager.registerModule(core);
        manager.enableModule(CORE_MODULE_ID);

        const client = manager.getCapability('ngvge.module-manager');
        const moduleData = manager.getCapability('ngvge.module-data');
        expect(client.registry).toBeUndefined();
        expect(client.capabilities).toBeUndefined();
        expect(client.dataStore).toBeUndefined();
        expect(typeof client.enableModule).toBe('function');
        expect(typeof moduleData.get).toBe('function');
        expect(moduleData.set).toBeUndefined();
        expect(moduleData.clear).toBeUndefined();
    });

    test('duplicate Host registration is rejected without losing live state or capabilities', () => {
        const manager = createModuleManager();
        manager.registerModule({
            manifest: createManifest('duplicate'),
            hooks: {
                enable: context => context.capabilities.provide('duplicate.capability', {generation: 1})
            }
        });
        expect(manager.enableModule('duplicate')).toBe(true);
        const beforeState = manager.getModuleState('duplicate');

        expect(() => manager.registerModule({
            manifest: createManifest('duplicate'),
            hooks: {}
        })).toThrow(expect.objectContaining({code: 'MODULE_ALREADY_REGISTERED'}));

        expect(manager.getModuleState('duplicate')).toEqual(beforeState);
        expect(manager.getCapability('duplicate.capability')).toEqual({generation: 1});
        manager.dispose();
    });

    test('raw infrastructure storage and hook tables are private and sealed', () => {
        const manager = createModuleManager();
        let original = 0;
        let replacement = 0;
        const hooks = {enable: () => { original += 1; }};
        const record = manager.registerModule({manifest: createManifest('hooks'), hooks});
        hooks.enable = () => { replacement += 1; };

        expect(manager.registry).toBeUndefined();
        expect(manager.capabilities).toBeUndefined();
        expect(manager.dataStore).toBeUndefined();
        expect(Object.isFrozen(manager)).toBe(true);
        expect(typeof manager.getModuleRecord).toBe('function');
        expect(Object.isFrozen(record.hooks)).toBe(true);
        manager.enableModule('hooks');
        expect(original).toBe(1);
        expect(replacement).toBe(0);
    });
});
