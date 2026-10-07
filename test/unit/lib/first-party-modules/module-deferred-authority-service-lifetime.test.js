const {createModuleManager} = require('../../../../src/lib/first-party-modules/module-manager');
const {
    MODULE_AVAILABILITY,
    MODULE_KINDS,
    MODULE_PERMISSIONS
} = require('../../../../src/lib/first-party-modules/constants');

const createManifest = (id, permissions = []) => ({
    apiVersion: '1',
    availability: MODULE_AVAILABILITY.AVAILABLE,
    capabilities: [],
    defaultEnabled: false,
    dependencies: [],
    description: `${id} test module.`,
    id,
    kind: MODULE_KINDS.FIRST_PARTY,
    name: id,
    permissions,
    version: '1'
});

describe('0008.9.4.1.5 Module Deferred Authority and Service Lifetime Closure', () => {
    test('raw Host infrastructure is not reachable by deferred observers or hooks', async () => {
        const manager = createModuleManager();
        let observerSurface = null;
        let hookSurface = null;
        manager.registerModule({
            manifest: createManifest('deferred'),
            hooks: {
                enable: context => {
                    context.capabilities.provide('deferred.registration', true);
                    setTimeout(() => {
                        hookSurface = manager.capabilities;
                    }, 0);
                }
            }
        });
        manager.subscribe(change => {
            if (change.type !== 'module:enable-pending') return;
            Promise.resolve().then(() => {
                observerSurface = manager.registry;
            });
        });

        expect(manager.enableModule('deferred')).toBe(true);
        await Promise.resolve();
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(observerSurface).toBeUndefined();
        expect(hookSurface).toBeUndefined();
        expect(manager.hasModule('deferred')).toBe(true);
        expect(manager.getCapability('deferred.registration')).toBe(true);
    });

    test('captured Host enable cannot bypass Client hook phase rules', () => {
        const manager = createModuleManager();
        manager.registerModule({manifest: createManifest('target'), hooks: {}});
        manager.registerModule({
            manifest: createManifest('source'),
            hooks: {
                initialize: () => manager.enableModule('target')
            }
        });

        expect(() => manager.initializeModule('source')).toThrow(
            expect.objectContaining({code: 'MODULE_HOST_AUTHORITY_REQUIRED'})
        );
        expect(manager.getModuleState('target').enabled).toBe(false);
    });

    test('retained Module Client cannot enable modules after its completeEnable phase', async () => {
        const manager = createModuleManager();
        let deferredError = null;
        manager.registerModule({manifest: createManifest('target'), hooks: {}});
        manager.registerModule({
            manifest: createManifest('source'),
            hooks: {
                initialize: context => {
                    Promise.resolve().then(() => {
                        try {
                            context.manager.enableModule('target');
                        } catch (error) {
                            deferredError = error;
                        }
                    });
                }
            }
        });

        manager.initializeModule('source');
        await Promise.resolve();
        expect(deferredError).toEqual(expect.objectContaining({
            code: 'MODULE_CLIENT_ENABLE_PHASE_FORBIDDEN'
        }));
        expect(manager.getModuleState('target').enabled).toBe(false);
    });

    test('retained service facades, nested values, callbacks and methods revoke by registration generation', () => {
        const callbacks = new Set();
        const rawService = {
            nested: {value: 1},
            emit: value => callbacks.forEach(callback => callback({value})),
            mutate (value) {
                this.nested.value = value;
                return this.nested;
            },
            subscribe: callback => {
                callbacks.add(callback);
                return () => callbacks.delete(callback);
            }
        };
        const manager = createModuleManager({
            services: {
                secure: {permission: MODULE_PERMISSIONS.RUNTIME, value: rawService}
            }
        });
        let context = null;
        let service = null;
        let nested = null;
        let method = null;
        manager.registerModule({
            manifest: createManifest('service-owner', [MODULE_PERMISSIONS.RUNTIME]),
            hooks: {
                initialize: nextContext => {
                    context = nextContext;
                    service = context.getService('secure');
                    nested = service.nested;
                    method = service.mutate;
                    service.subscribe(() => {});
                }
            }
        });
        manager.initializeModule('service-owner');
        method(2);
        expect(rawService.nested.value).toBe(2);
        expect(context.runtime).toBeUndefined();
        expect(context.vm).toBeUndefined();

        expect(manager.unregisterModule('service-owner')).toBe(true);
        expect(() => context.getService('secure')).toThrow(
            expect.objectContaining({code: 'MODULE_CLIENT_AUTHORITY_REVOKED'})
        );
        expect(() => service.nested).toThrow(
            expect.objectContaining({code: 'MODULE_CLIENT_AUTHORITY_REVOKED'})
        );
        expect(() => nested.value).toThrow(
            expect.objectContaining({code: 'MODULE_CLIENT_AUTHORITY_REVOKED'})
        );
        expect(() => method(3)).toThrow(
            expect.objectContaining({code: 'MODULE_CLIENT_AUTHORITY_REVOKED'})
        );
        expect(() => rawService.emit(1)).toThrow(
            expect.objectContaining({code: 'MODULE_CLIENT_AUTHORITY_REVOKED'})
        );
    });

    test('subscription teardown leases remain callable after capability revocation', () => {
        const listeners = new Set();
        const manager = createModuleManager();
        let capability = null;
        let teardown = null;

        manager.registerModule({
            manifest: createManifest('provider'),
            hooks: {
                enable: context => context.capabilities.provide('observable', {
                    getValue: () => 1,
                    subscribe: listener => {
                        listeners.add(listener);
                        return () => listeners.delete(listener);
                    }
                })
            }
        });
        manager.registerModule({
            manifest: createManifest('consumer'),
            hooks: {
                enable: context => {
                    capability = context.capabilities.require('observable');
                    teardown = capability.subscribe(() => {});
                }
            }
        });

        manager.enableModule('provider');
        manager.enableModule('consumer');
        expect(listeners.size).toBe(1);

        manager.disableModule('provider', {force: true});

        expect(() => capability.getValue()).toThrow(
            expect.objectContaining({code: 'MODULE_CAPABILITY_AUTHORITY_REVOKED'})
        );
        expect(typeof teardown.apply).toBe('function');
        expect(() => teardown.apply(undefined)).not.toThrow();
        expect(listeners.size).toBe(0);
        expect(teardown()).toBe(false);
    });

    test('capability values revoke when provider record is removed', () => {
        const manager = createModuleManager();
        let capability = null;
        let method = null;
        manager.registerModule({
            manifest: createManifest('provider'),
            hooks: {
                enable: context => context.capabilities.provide('revocable', {
                    nested: {value: 1},
                    mutate (value) { this.nested.value = value; }
                })
            }
        });
        manager.registerModule({
            manifest: createManifest('consumer'),
            hooks: {
                enable: context => {
                    capability = context.capabilities.require('revocable');
                    method = capability.mutate;
                }
            }
        });
        manager.enableModule('provider');
        manager.enableModule('consumer');
        manager.disableModule('provider', {force: true});

        expect(() => capability.nested).toThrow(
            expect.objectContaining({code: 'MODULE_CAPABILITY_AUTHORITY_REVOKED'})
        );
        expect(() => method(2)).toThrow(
            expect.objectContaining({code: 'MODULE_CAPABILITY_AUTHORITY_REVOKED'})
        );
    });

    test('non-portable caller-owned objects cannot escape service authority lifetime', () => {
        const manager = createModuleManager({
            services: {
                secure: {permission: MODULE_PERMISSIONS.RUNTIME, value: {accept: value => value}}
            }
        });
        manager.registerModule({
            manifest: createManifest('nonportable', [MODULE_PERMISSIONS.RUNTIME]),
            hooks: {
                initialize: context => {
                    class MutableHolder {}
                    context.getService('secure').accept(new MutableHolder());
                }
            }
        });

        expect(() => manager.initializeModule('nonportable')).toThrow(
            expect.objectContaining({code: 'MODULE_SERVICE_ARGUMENT_UNSUPPORTED'})
        );
    });

    test('same-id registration does not revive old Client or Service authority', () => {
        const manager = createModuleManager({
            services: {
                secure: {permission: MODULE_PERMISSIONS.RUNTIME, value: {value: 1}}
            }
        });
        let oldClient = null;
        let oldService = null;
        manager.registerModule({
            manifest: createManifest('generation', [MODULE_PERMISSIONS.RUNTIME]),
            hooks: {
                initialize: context => {
                    oldClient = context.manager;
                    oldService = context.getService('secure');
                }
            }
        });
        manager.initializeModule('generation');
        manager.unregisterModule('generation');
        manager.registerModule({
            manifest: createManifest('generation', [MODULE_PERMISSIONS.RUNTIME]),
            hooks: {}
        });
        manager.initializeModule('generation');

        expect(() => oldClient.listModules()).toThrow(
            expect.objectContaining({code: 'MODULE_CLIENT_AUTHORITY_REVOKED'})
        );
        expect(() => oldService.value).toThrow(
            expect.objectContaining({code: 'MODULE_CLIENT_AUTHORITY_REVOKED'})
        );
    });
});
