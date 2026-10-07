#!/usr/bin/env node
'use strict';

const assert = require('assert');
const vm = require('vm');
const {
    MODULE_AVAILABILITY,
    MODULE_KINDS,
    MODULE_PERMISSIONS
} = require('../src/lib/first-party-modules/constants');
const {createModuleManager} = require('../src/lib/first-party-modules/module-manager');

const manifest = (id, permissions = []) => ({
    apiVersion: '1',
    availability: MODULE_AVAILABILITY.AVAILABLE,
    capabilities: [],
    defaultEnabled: false,
    dependencies: [],
    description: id,
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
    let keys = [];
    try {
        keys = Reflect.ownKeys(root);
    } catch {
        return false;
    }
    return keys.some(key => {
        let descriptor;
        try {
            descriptor = Reflect.getOwnPropertyDescriptor(root, key);
        } catch {
            return false;
        }
        return Boolean(
            descriptor &&
            Object.prototype.hasOwnProperty.call(descriptor, 'value') &&
            containsReference(descriptor.value, expected, seen)
        );
    });
};

const assertBoundaryError = (error, code, secret, direction) => {
    assert(error instanceof Error);
    assert.notStrictEqual(error, secret);
    assert.strictEqual(error.name, 'ModuleBoundaryError');
    assert.strictEqual(error.code, code);
    assert.strictEqual(error.direction, direction);
    assert.strictEqual(error.cause, undefined);
    assert.strictEqual(containsReference(error, secret), false);
    assert.strictEqual(Object.isFrozen(error), true);
    assert.strictEqual(Object.isFrozen(error.portableDetails), true);
};

const capture = callback => {
    try {
        callback();
        return null;
    } catch (error) {
        return error;
    }
};

const captureAsync = async callback => {
    try {
        await callback();
        return null;
    } catch (error) {
        return error;
    }
};

const main = async () => {
    // Host Service methods, accessors, constructors, reflection, iterators and Promise rejection never expose raw throws.
    {
        const secrets = {
            asyncIterator: {kind: 'async-iterator'},
            asyncMethod: {kind: 'async-method'},
            constructor: {kind: 'constructor'},
            getter: {kind: 'getter'},
            iterator: {kind: 'iterator'},
            method: {kind: 'method'},
            reflection: {kind: 'reflection'},
            setter: {kind: 'setter'}
        };
        const reflectionTarget = new Proxy({}, {
            ownKeys: () => { throw secrets.reflection; }
        });
        const rawService = {
            ThrowingConstructor: function ThrowingConstructor () {
                throw secrets.constructor;
            },
            asyncBoom: () => Promise.reject(secrets.asyncMethod),
            asyncIterator: () => ({
                [Symbol.asyncIterator] () { return this; },
                next: () => Promise.reject(secrets.asyncIterator)
            }),
            boom: () => { throw secrets.method; },
            get leak () { throw secrets.getter; },
            iterator: () => ({
                [Symbol.iterator] () { return this; },
                next: () => { throw secrets.iterator; }
            }),
            reflectionTarget,
            set leak (value) { throw secrets.setter; }
        };
        const manager = createModuleManager({
            services: {
                secure: {permission: MODULE_PERMISSIONS.RUNTIME, value: rawService}
            }
        });
        let context = null;
        const syncErrors = {};
        manager.registerModule({
            manifest: manifest('test.exception-service', [MODULE_PERMISSIONS.RUNTIME]),
            hooks: {
                initialize: nextContext => {
                    context = nextContext;
                    const service = context.getService('secure');
                    syncErrors.method = capture(() => service.boom());
                    syncErrors.getter = capture(() => service.leak);
                    syncErrors.setter = capture(() => { service.leak = 1; });
                    syncErrors.constructor = capture(() => new service.ThrowingConstructor());
                    syncErrors.reflection = capture(() => Object.keys(service.reflectionTarget));
                    syncErrors.iterator = capture(() => service.iterator().next());
                }
            }
        });
        assert.strictEqual(manager.initializeModule('test.exception-service'), true);
        Object.keys(syncErrors).forEach(key => {
            assertBoundaryError(
                syncErrors[key],
                'MODULE_SERVICE_HOST_OPERATION_FAILED',
                secrets[key],
                'host-to-module'
            );
        });
        const asyncMethodError = await captureAsync(() => context.getService('secure').asyncBoom());
        assertBoundaryError(
            asyncMethodError,
            'MODULE_SERVICE_HOST_OPERATION_FAILED',
            secrets.asyncMethod,
            'host-to-module'
        );
        const asyncIteratorError = await captureAsync(() => context.getService('secure').asyncIterator().next());
        assertBoundaryError(
            asyncIteratorError,
            'MODULE_SERVICE_HOST_OPERATION_FAILED',
            secrets.asyncIterator,
            'host-to-module'
        );
        assert.strictEqual(manager.unregisterModule('test.exception-service'), true);
        assert.strictEqual(containsReference(syncErrors.method, secrets.method), false);
        assert.strictEqual(secrets.method.kind, 'method');
        manager.dispose();
    }

    // Consumed Capability methods and Promise rejection use the Capability boundary error code and retain no Provider object.
    {
        const methodSecret = {kind: 'capability-method'};
        const asyncSecret = {kind: 'capability-async'};
        const manager = createModuleManager();
        let capability = null;
        let methodError = null;
        manager.registerModule({
            manifest: manifest('test.exception-provider'),
            hooks: {
                enable: context => context.capabilities.provide('test.exception-capability', {
                    asyncBoom: () => Promise.reject(asyncSecret),
                    boom: () => { throw methodSecret; }
                })
            }
        });
        manager.registerModule({
            manifest: manifest('test.exception-consumer'),
            hooks: {
                enable: context => {
                    capability = context.capabilities.require('test.exception-capability');
                    methodError = capture(() => capability.boom());
                }
            }
        });
        manager.enableModule('test.exception-provider');
        manager.enableModule('test.exception-consumer');
        assertBoundaryError(
            methodError,
            'MODULE_CAPABILITY_PROVIDER_OPERATION_FAILED',
            methodSecret,
            'host-to-module'
        );
        const asyncError = await captureAsync(() => capability.asyncBoom());
        assertBoundaryError(
            asyncError,
            'MODULE_CAPABILITY_PROVIDER_OPERATION_FAILED',
            asyncSecret,
            'host-to-module'
        );
        manager.disableModule('test.exception-provider', {force: true});
        assert.strictEqual(containsReference(methodError, methodSecret), false);
        manager.dispose();
    }

    // Module Callback throws and Promise rejection are sanitized before Host code can retain them.
    {
        let hostRetainedSync = null;
        let hostRetainedAsync = null;
        let callbackObject = null;
        let asyncCallbackObject = null;
        const rawService = {
            run (callback) {
                try {
                    return callback();
                } catch (error) {
                    hostRetainedSync = error;
                    return error;
                }
            },
            async runAsync (callback) {
                try {
                    return await callback();
                } catch (error) {
                    hostRetainedAsync = error;
                    throw error;
                }
            }
        };
        const manager = createModuleManager({
            services: {
                secure: {permission: MODULE_PERMISSIONS.RUNTIME, value: rawService}
            }
        });
        let context = null;
        let moduleObservedSync = null;
        manager.registerModule({
            manifest: manifest('test.exception-callback', [MODULE_PERMISSIONS.RUNTIME]),
            hooks: {
                initialize: nextContext => {
                    context = nextContext;
                    class OpaqueState {
                        constructor (kind) { this.kind = kind; }
                        mutate () { this.kind = 'mutated'; }
                    }
                    callbackObject = new OpaqueState('sync');
                    asyncCallbackObject = new OpaqueState('async');
                    moduleObservedSync = context.getService('secure').run(() => {
                        throw callbackObject;
                    });
                }
            }
        });
        manager.initializeModule('test.exception-callback');
        assertBoundaryError(
            hostRetainedSync,
            'MODULE_SERVICE_CALLBACK_FAILED',
            callbackObject,
            'module-to-host'
        );
        assert.strictEqual(moduleObservedSync, hostRetainedSync);
        const moduleObservedAsync = await captureAsync(() => context.getService('secure').runAsync(
            () => Promise.reject(asyncCallbackObject)
        ));
        assertBoundaryError(
            hostRetainedAsync,
            'MODULE_SERVICE_CALLBACK_FAILED',
            asyncCallbackObject,
            'module-to-host'
        );
        assert.strictEqual(moduleObservedAsync, hostRetainedAsync);
        manager.unregisterModule('test.exception-callback');
        assert.strictEqual(containsReference(hostRetainedSync, callbackObject), false);
        assert.strictEqual(containsReference(hostRetainedAsync, asyncCallbackObject), false);
        manager.dispose();
    }

    // Capability callbacks receive the same callback-side isolation with a Capability-specific code.
    {
        let providerRetained = null;
        let moduleObject = null;
        const manager = createModuleManager();
        manager.registerModule({
            manifest: manifest('test.callback-provider'),
            hooks: {
                enable: context => context.capabilities.provide('test.callback-capability', {
                    run (callback) {
                        try {
                            return callback();
                        } catch (error) {
                            providerRetained = error;
                            return error;
                        }
                    }
                })
            }
        });
        manager.registerModule({
            manifest: manifest('test.callback-consumer'),
            hooks: {
                enable: context => {
                    class ConsumerState {}
                    moduleObject = new ConsumerState();
                    const result = context.capabilities.require('test.callback-capability').run(() => {
                        throw moduleObject;
                    });
                    assert.strictEqual(result.code, 'MODULE_CAPABILITY_CALLBACK_FAILED');
                }
            }
        });
        manager.enableModule('test.callback-provider');
        manager.enableModule('test.callback-consumer');
        assertBoundaryError(
            providerRetained,
            'MODULE_CAPABILITY_CALLBACK_FAILED',
            moduleObject,
            'module-to-host'
        );
        manager.dispose();
    }

    // Accessor callbacks carried inside portable arguments cannot leak Module objects through throw/catch.
    {
        let hostRetained = null;
        let moduleSecret = null;
        const manager = createModuleManager({
            services: {
                secure: {
                    permission: MODULE_PERMISSIONS.RUNTIME,
                    value: {
                        read (record) {
                            try {
                                return record.leak;
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
            manifest: manifest('test.accessor-callback', [MODULE_PERMISSIONS.RUNTIME]),
            hooks: {
                initialize: context => {
                    class AccessorState {}
                    moduleSecret = new AccessorState();
                    const record = {};
                    Object.defineProperty(record, 'leak', {
                        enumerable: true,
                        get: () => { throw moduleSecret; }
                    });
                    const result = context.getService('secure').read(record);
                    assert.strictEqual(result.code, 'MODULE_SERVICE_CALLBACK_FAILED');
                }
            }
        });
        manager.initializeModule('test.accessor-callback');
        assertBoundaryError(
            hostRetained,
            'MODULE_SERVICE_CALLBACK_FAILED',
            moduleSecret,
            'module-to-host'
        );
        manager.dispose();
    }


    // Cross-Realm Promise rejection and throwing then getters are sanitized before await observes them.
    {
        const crossRealm = vm.createContext({});
        const crossPromise = vm.runInContext('Promise.reject({kind: "cross-realm"})', crossRealm);
        const thenSecret = {kind: 'then-getter'};
        let getterCount = 0;
        const diagnosticSecret = {};
        Object.defineProperty(diagnosticSecret, 'message', {
            get: () => {
                getterCount += 1;
                return 'must not execute';
            }
        });
        const manager = createModuleManager({
            services: {
                secure: {
                    permission: MODULE_PERMISSIONS.RUNTIME,
                    value: {
                        crossPromise: () => crossPromise,
                        diagnosticThrow: () => { throw diagnosticSecret; },
                        thenThrower: () => ({
                            get then () { throw thenSecret; }
                        })
                    }
                }
            }
        });
        let context = null;
        manager.registerModule({
            manifest: manifest('test.cross-realm-exception', [MODULE_PERMISSIONS.RUNTIME]),
            hooks: {initialize: nextContext => { context = nextContext; }}
        });
        manager.initializeModule('test.cross-realm-exception');
        const crossError = await captureAsync(() => context.getService('secure').crossPromise());
        assert.strictEqual(crossError.code, 'MODULE_SERVICE_HOST_OPERATION_FAILED');
        assert.strictEqual(crossError.portableDetails.thrownType, 'object');
        const thenError = await captureAsync(() => context.getService('secure').thenThrower());
        assertBoundaryError(
            thenError,
            'MODULE_SERVICE_HOST_OPERATION_FAILED',
            thenSecret,
            'host-to-module'
        );
        const diagnosticError = capture(() => context.getService('secure').diagnosticThrow());
        assert.strictEqual(diagnosticError.code, 'MODULE_SERVICE_HOST_OPERATION_FAILED');
        assert.strictEqual(getterCount, 0);
        manager.dispose();
    }


    // Facade-local errors that are allowed to cross again are frozen before being trusted by the membrane.
    {
        let hostRetained = null;
        const moduleSecret = {kind: 'structure-error-attachment'};
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
            manifest: manifest('test.structure-error-freeze', [MODULE_PERMISSIONS.RUNTIME]),
            hooks: {
                initialize: context => {
                    const service = context.getService('secure');
                    const structureError = capture(() => Object.preventExtensions(service));
                    assert.strictEqual(structureError.code, 'MODULE_SERVICE_FACADE_STRUCTURE_FORBIDDEN');
                    assert.strictEqual(Object.isFrozen(structureError), true);
                    assert.throws(() => { structureError.secret = moduleSecret; }, TypeError);
                    const returned = service.run(() => { throw structureError; });
                    assert.strictEqual(returned, structureError);
                }
            }
        });
        manager.initializeModule('test.structure-error-freeze');
        assert.strictEqual(hostRetained.code, 'MODULE_SERVICE_FACADE_STRUCTURE_FORBIDDEN');
        assert.strictEqual(containsReference(hostRetained, moduleSecret), false);
        manager.dispose();
    }

    console.log('NGVGE TASK 0008.9.4.1.6 cross-boundary exception authority validation passed.');
};

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
