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

const containsReference = (root, expected, seen = new WeakSet()) => {
    if (root === expected) return true;
    if (!root || (typeof root !== 'object' && typeof root !== 'function')) return false;
    if (seen.has(root)) return false;
    seen.add(root);
    return Reflect.ownKeys(root).some(key => {
        const descriptor = Reflect.getOwnPropertyDescriptor(root, key);
        return Boolean(
            descriptor &&
            Object.prototype.hasOwnProperty.call(descriptor, 'value') &&
            containsReference(descriptor.value, expected, seen)
        );
    });
};

const expectBoundaryError = (error, code, secret, direction) => {
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBe(secret);
    expect(error).toEqual(expect.objectContaining({code, direction}));
    expect(error.cause).toBeUndefined();
    expect(containsReference(error, secret)).toBe(false);
    expect(Object.isFrozen(error)).toBe(true);
    expect(Object.isFrozen(error.portableDetails)).toBe(true);
};

describe('0008.9.4.1.6 Cross-Boundary Exception Authority Closure', () => {
    test('service throws and Promise rejection are converted without raw Host references', async () => {
        const syncSecret = {value: 1};
        const asyncSecret = {value: 2};
        const manager = createModuleManager({
            services: {
                secure: {
                    permission: MODULE_PERMISSIONS.RUNTIME,
                    value: {
                        asyncBoom: () => Promise.reject(asyncSecret),
                        boom: () => { throw syncSecret; }
                    }
                }
            }
        });
        let context = null;
        let syncError = null;
        manager.registerModule({
            manifest: createManifest('service-consumer', [MODULE_PERMISSIONS.RUNTIME]),
            hooks: {
                initialize: nextContext => {
                    context = nextContext;
                    try {
                        context.getService('secure').boom();
                    } catch (error) {
                        syncError = error;
                    }
                }
            }
        });
        manager.initializeModule('service-consumer');
        expectBoundaryError(
            syncError,
            'MODULE_SERVICE_HOST_OPERATION_FAILED',
            syncSecret,
            'host-to-module'
        );
        await expect(context.getService('secure').asyncBoom()).rejects.toEqual(
            expect.objectContaining({code: 'MODULE_SERVICE_HOST_OPERATION_FAILED'})
        );
        try {
            await context.getService('secure').asyncBoom();
        } catch (error) {
            expectBoundaryError(
                error,
                'MODULE_SERVICE_HOST_OPERATION_FAILED',
                asyncSecret,
                'host-to-module'
            );
        }
    });

    test('capability throws are isolated from consumers and provider revocation', () => {
        const secret = {value: 1};
        const manager = createModuleManager();
        let capability = null;
        manager.registerModule({
            manifest: createManifest('provider'),
            hooks: {
                enable: context => context.capabilities.provide('secure-capability', {
                    boom: () => { throw secret; }
                })
            }
        });
        manager.registerModule({
            manifest: createManifest('consumer'),
            hooks: {
                enable: context => {
                    capability = context.capabilities.require('secure-capability');
                }
            }
        });
        manager.enableModule('provider');
        manager.enableModule('consumer');
        let error = null;
        try {
            capability.boom();
        } catch (nextError) {
            error = nextError;
        }
        expectBoundaryError(
            error,
            'MODULE_CAPABILITY_PROVIDER_OPERATION_FAILED',
            secret,
            'host-to-module'
        );
        manager.disableModule('provider', {force: true});
        expect(containsReference(error, secret)).toBe(false);
    });

    test('module callback throws are sanitized before Host services can retain them', () => {
        let hostRetained = null;
        let moduleSecret = null;
        const manager = createModuleManager({
            services: {
                secure: {
                    permission: MODULE_PERMISSIONS.RUNTIME,
                    value: {
                        run (callback) {
                            try {
                                return callback();
                            } catch (error) {
                                hostRetained = error;
                                return error;
                            }
                        }
                    }
                }
            }
        });
        manager.registerModule({
            manifest: createManifest('callback-consumer', [MODULE_PERMISSIONS.RUNTIME]),
            hooks: {
                initialize: context => {
                    class OpaqueState {}
                    moduleSecret = new OpaqueState();
                    const result = context.getService('secure').run(() => {
                        throw moduleSecret;
                    });
                    expect(result.code).toBe('MODULE_SERVICE_CALLBACK_FAILED');
                }
            }
        });
        manager.initializeModule('callback-consumer');
        expectBoundaryError(
            hostRetained,
            'MODULE_SERVICE_CALLBACK_FAILED',
            moduleSecret,
            'module-to-host'
        );
        manager.unregisterModule('callback-consumer');
        expect(containsReference(hostRetained, moduleSecret)).toBe(false);
    });

    test('getters, setters, constructors and iterator rejection use the same exception membrane', async () => {
        const secrets = {
            constructor: {kind: 'constructor'},
            getter: {kind: 'getter'},
            iterator: {kind: 'iterator'},
            setter: {kind: 'setter'}
        };
        const manager = createModuleManager({
            services: {
                secure: {
                    permission: MODULE_PERMISSIONS.RUNTIME,
                    value: {
                        ThrowingConstructor: function ThrowingConstructor () {
                            throw secrets.constructor;
                        },
                        asyncIterator: () => ({
                            [Symbol.asyncIterator] () { return this; },
                            next: () => Promise.reject(secrets.iterator)
                        }),
                        get leak () { throw secrets.getter; },
                        set leak (value) { throw secrets.setter; }
                    }
                }
            }
        });
        let service = null;
        manager.registerModule({
            manifest: createManifest('surface-consumer', [MODULE_PERMISSIONS.RUNTIME]),
            hooks: {initialize: context => { service = context.getService('secure'); }}
        });
        manager.initializeModule('surface-consumer');

        const getter = (() => { try { return service.leak; } catch (error) { return error; } })();
        const setter = (() => { try { service.leak = 1; } catch (error) { return error; } })();
        const constructor = (() => { try { return new service.ThrowingConstructor(); } catch (error) { return error; } })();
        expectBoundaryError(getter, 'MODULE_SERVICE_HOST_OPERATION_FAILED', secrets.getter, 'host-to-module');
        expectBoundaryError(setter, 'MODULE_SERVICE_HOST_OPERATION_FAILED', secrets.setter, 'host-to-module');
        expectBoundaryError(
            constructor,
            'MODULE_SERVICE_HOST_OPERATION_FAILED',
            secrets.constructor,
            'host-to-module'
        );
        try {
            await service.asyncIterator().next();
        } catch (error) {
            expectBoundaryError(
                error,
                'MODULE_SERVICE_HOST_OPERATION_FAILED',
                secrets.iterator,
                'host-to-module'
            );
        }
    });
});
