#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
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

const nextMicrotask = () => Promise.resolve();
const nextTimer = () => new Promise(resolve => setTimeout(resolve, 0));

const main = async () => {
    // Deferred callbacks cannot reach raw infrastructure because Host internals are not part of the Host facade.
    {
        const manager = createModuleManager();
        let deferredSurface = null;
        manager.registerModule({
            manifest: manifest('test.deferred-observer'),
            hooks: {
                enable: context => context.capabilities.provide('test.deferred-observer.registration', {ready: true})
            }
        });
        manager.subscribe(change => {
            if (change.type !== 'module:enable-pending') return;
            Promise.resolve().then(() => {
                deferredSurface = manager.registry;
                if (manager.registry) manager.registry.unregister(change.moduleId);
            });
        });
        assert.strictEqual(manager.enableModule('test.deferred-observer'), true);
        await nextMicrotask();
        assert.strictEqual(deferredSurface, undefined);
        assert.strictEqual(manager.hasModule('test.deferred-observer'), true);
        assert.deepStrictEqual(manager.getCapability('test.deferred-observer.registration'), {ready: true});
        manager.dispose();
    }

    // A deferred Module Hook closure cannot impersonate another provider through removed raw surfaces.
    {
        const manager = createModuleManager();
        let deferredCapabilitySurface = null;
        manager.registerModule({
            manifest: manifest('test.owner'),
            hooks: {
                initialize: context => context.capabilities.provide('test.shared', {value: 'old'})
            }
        });
        manager.registerModule({
            manifest: manifest('test.deferred-attacker'),
            hooks: {
                initialize: () => {
                    setTimeout(() => {
                        deferredCapabilitySurface = manager.capabilities;
                        if (manager.capabilities) {
                            manager.capabilities.provide('test.owner', 'test.shared', {value: 'new'}, {replace: true});
                        }
                    }, 0);
                }
            }
        });
        manager.initializeModule('test.owner');
        manager.initializeModule('test.deferred-attacker');
        await nextTimer();
        assert.strictEqual(deferredCapabilitySurface, undefined);
        assert.deepStrictEqual(manager.getCapability('test.shared'), {value: 'old'});
        assert.strictEqual(manager.getCapabilityRecord('test.shared').providerModuleId, 'test.owner');
        manager.dispose();
    }

    // The Host enable surface is never callable from a Module Hook; completeEnable must use context.manager.
    {
        const manager = createModuleManager();
        let capturedError = null;
        manager.registerModule({manifest: manifest('test.phase-target'), hooks: {}});
        manager.registerModule({
            manifest: manifest('test.phase-source'),
            hooks: {
                initialize: () => {
                    try {
                        manager.enableModule('test.phase-target');
                    } catch (error) {
                        capturedError = error;
                    }
                }
            }
        });
        assert.strictEqual(manager.initializeModule('test.phase-source'), true);
        assert(capturedError);
        assert.strictEqual(capturedError.code, 'MODULE_HOST_AUTHORITY_REQUIRED');
        assert.strictEqual(manager.getModuleState('test.phase-target').enabled, false);
        manager.dispose();
    }

    // A retained Module Client cannot defer enableModule beyond its own completeEnable phase.
    {
        const manager = createModuleManager();
        let deferredError = null;
        manager.registerModule({manifest: manifest('test.deferred-client-target'), hooks: {}});
        manager.registerModule({
            manifest: manifest('test.deferred-client-source'),
            hooks: {
                initialize: context => {
                    Promise.resolve().then(() => {
                        try {
                            context.manager.enableModule('test.deferred-client-target');
                        } catch (error) {
                            deferredError = error;
                        }
                    });
                }
            }
        });
        manager.initializeModule('test.deferred-client-source');
        await nextMicrotask();
        assert(deferredError);
        assert.strictEqual(deferredError.code, 'MODULE_CLIENT_ENABLE_PHASE_FORBIDDEN');
        assert.strictEqual(manager.getModuleState('test.deferred-client-target').enabled, false);
        manager.dispose();
    }

    // Service access is permission-bound and every retained facade/reference is registration-generation scoped.
    {
        const callbacks = new Set();
        let retainedOptions = null;
        const rawService = {
            nested: {value: 1},
            configure (options) { retainedOptions = options; },
            emit (value) {
                callbacks.forEach(callback => callback({value}));
            },
            mutate (value) {
                this.nested.value = value;
                return this.nested;
            },
            subscribe (callback) {
                callbacks.add(callback);
                return () => callbacks.delete(callback);
            }
        };
        const manager = createModuleManager({
            services: {
                secure: {
                    permission: MODULE_PERMISSIONS.RUNTIME,
                    value: rawService
                }
            }
        });
        let context = null;
        let service = null;
        let nested = null;
        let reflectedNested = null;
        let retainedMethod = null;
        let callbackCount = 0;
        manager.registerModule({
            manifest: manifest('test.service-owner', [MODULE_PERMISSIONS.RUNTIME]),
            hooks: {
                initialize: nextContext => {
                    context = nextContext;
                    service = context.getService('secure');
                    nested = service.nested;
                    reflectedNested = Object.getOwnPropertyDescriptor(service, 'nested').value;
                    retainedMethod = service.mutate;
                    service.subscribe(payload => {
                        callbackCount += payload.value;
                    });
                    service.configure({
                        nested: {
                            onEvent: payload => { callbackCount += payload.value; }
                        }
                    });
                }
            }
        });
        manager.initializeModule('test.service-owner');
        assert.strictEqual(context.runtime, undefined);
        assert.strictEqual(context.vm, undefined);
        assert.strictEqual(nested.value, 1);
        retainedMethod(2);
        assert.strictEqual(rawService.nested.value, 2);
        rawService.emit(3);
        retainedOptions.nested.onEvent({value: 2});
        assert.strictEqual(callbackCount, 5);

        const oldClient = context.manager;
        assert.strictEqual(manager.unregisterModule('test.service-owner'), true);
        assert.throws(
            () => context.getService('secure'),
            error => error && error.code === 'MODULE_CLIENT_AUTHORITY_REVOKED'
        );
        assert.throws(
            () => service.nested,
            error => error && error.code === 'MODULE_CLIENT_AUTHORITY_REVOKED'
        );
        assert.throws(
            () => nested.value,
            error => error && error.code === 'MODULE_CLIENT_AUTHORITY_REVOKED'
        );
        assert.throws(
            () => reflectedNested.value,
            error => error && error.code === 'MODULE_CLIENT_AUTHORITY_REVOKED'
        );
        assert.throws(
            () => retainedMethod(4),
            error => error && error.code === 'MODULE_CLIENT_AUTHORITY_REVOKED'
        );
        assert.throws(
            () => rawService.emit(1),
            error => error && error.code === 'MODULE_CLIENT_AUTHORITY_REVOKED'
        );
        assert.throws(
            () => retainedOptions.nested.onEvent({value: 1}),
            error => error && error.code === 'MODULE_CLIENT_AUTHORITY_REVOKED'
        );

        manager.registerModule({
            manifest: manifest('test.service-owner', [MODULE_PERMISSIONS.RUNTIME]),
            hooks: {}
        });
        manager.initializeModule('test.service-owner');
        assert.throws(
            () => oldClient.listModules(),
            error => error && error.code === 'MODULE_CLIENT_AUTHORITY_REVOKED'
        );
        manager.dispose();
    }



    // Client facades embedded in a Service or Capability are rebound to the consuming module identity.
    {
        const runtimeLike = {};
        const manager = createModuleManager({
            services: {
                'runtime-like': {permission: MODULE_PERMISSIONS.RUNTIME, value: runtimeLike}
            }
        });
        runtimeLike.ngvgeFirstPartyModules = manager.client;
        runtimeLike.accidentalHostManager = manager;
        let context = null;
        let fromService = null;
        let fromCapability = null;
        let accidentalHost = null;
        manager.registerModule({
            manifest: manifest('test.client-provider'),
            hooks: {
                enable: providerContext => providerContext.capabilities.provide(
                    'test.manager-client',
                    providerContext.manager
                )
            }
        });
        manager.registerModule({
            manifest: manifest('test.client-consumer', [MODULE_PERMISSIONS.RUNTIME]),
            hooks: {
                enable: consumerContext => {
                    context = consumerContext;
                    const runtimeService = consumerContext.getService('runtime-like');
                    fromService = runtimeService.ngvgeFirstPartyModules;
                    accidentalHost = runtimeService.accidentalHostManager;
                    fromCapability = consumerContext.capabilities.require('test.manager-client');
                }
            }
        });
        manager.enableModule('test.client-provider');
        manager.enableModule('test.client-consumer');
        assert.strictEqual(fromService, context.manager);
        assert.strictEqual(accidentalHost, context.manager);
        assert.strictEqual(fromCapability, context.manager);
        manager.dispose();
    }



    // Runtime Operator Client retains UI enable/disable/subscribe without exposing those writes to Module Clients.
    {
        const manager = createModuleManager();
        let moduleClient = null;
        let eventCount = 0;
        manager.client.subscribe(() => { eventCount += 1; });
        manager.registerModule({
            manifest: manifest('test.runtime-operator'),
            hooks: {
                enable: context => { moduleClient = context.manager; }
            }
        });
        assert.strictEqual(manager.client.enableModule('test.runtime-operator'), true);
        assert.strictEqual(manager.getModuleState('test.runtime-operator').enabled, true);
        assert.strictEqual(typeof manager.client.disableModule, 'function');
        assert.strictEqual(typeof manager.client.subscribe, 'function');
        assert.strictEqual(moduleClient.disableModule, undefined);
        assert.strictEqual(moduleClient.subscribe, undefined);
        assert.strictEqual(manager.client.disableModule('test.runtime-operator'), true);
        assert.strictEqual(manager.getModuleState('test.runtime-operator').enabled, false);
        assert(eventCount > 0);
        manager.dispose();
    }

    // Host/Client authority from another Manager cannot be smuggled through a Service boundary.
    {
        const foreignManager = createModuleManager();
        const localManager = createModuleManager({
            services: {
                foreignHost: {value: foreignManager},
                foreignClient: {value: foreignManager.client}
            }
        });
        localManager.registerModule({
            manifest: manifest('test.foreign-authority'),
            hooks: {
                initialize: context => {
                    assert.throws(
                        () => context.getService('foreignHost'),
                        error => error && error.code === 'MODULE_HOST_AUTHORITY_EXPOSURE_FORBIDDEN'
                    );
                    assert.throws(
                        () => context.getService('foreignClient'),
                        error => error && error.code === 'MODULE_FOREIGN_CLIENT_AUTHORITY_FORBIDDEN'
                    );
                }
            }
        });
        assert.strictEqual(localManager.initializeModule('test.foreign-authority'), true);
        localManager.dispose();
        foreignManager.dispose();
    }

    // Capability values acquired by a Module are also generation- and provider-record scoped.
    {
        const manager = createModuleManager();
        let capability = null;
        let retainedMethod = null;
        manager.registerModule({
            manifest: manifest('test.capability-provider'),
            hooks: {
                enable: context => context.capabilities.provide('test.revocable-capability', {
                    nested: {value: 1},
                    write (value) { this.nested.value = value; }
                })
            }
        });
        manager.registerModule({
            manifest: manifest('test.capability-consumer'),
            hooks: {
                enable: context => {
                    capability = context.capabilities.require('test.revocable-capability');
                    retainedMethod = capability.write;
                }
            }
        });
        manager.enableModule('test.capability-provider');
        manager.enableModule('test.capability-consumer');
        retainedMethod(2);
        assert.strictEqual(manager.getCapability('test.revocable-capability').nested.value, 2);
        manager.disableModule('test.capability-provider', {force: true});
        assert.throws(
            () => capability.nested,
            error => error && error.code === 'MODULE_CAPABILITY_AUTHORITY_REVOKED'
        );
        assert.throws(
            () => retainedMethod(3),
            error => error && error.code === 'MODULE_CAPABILITY_AUTHORITY_REVOKED'
        );
        manager.dispose();
    }

    // Manager disposal revokes retained service facades and saved service methods.
    {
        const rawService = {state: {value: 1}, write (value) { this.state.value = value; }};
        const manager = createModuleManager({
            services: {secure: {permission: MODULE_PERMISSIONS.RUNTIME, value: rawService}}
        });
        let service = null;
        let write = null;
        manager.registerModule({
            manifest: manifest('test.dispose-service', [MODULE_PERMISSIONS.RUNTIME]),
            hooks: {
                initialize: context => {
                    service = context.getService('secure');
                    write = service.write;
                }
            }
        });
        manager.initializeModule('test.dispose-service');
        manager.dispose();
        assert.throws(() => service.state, error => error && error.code === 'MODULE_MANAGER_DISPOSED');
        assert.throws(() => write(2), error => error && error.code === 'MODULE_MANAGER_DISPOSED');
        assert.strictEqual(rawService.state.value, 1);
    }

    // Non-portable caller-owned objects cannot be smuggled into Host services as unrevoked bearer state.
    {
        const rawService = {accept: value => value};
        const manager = createModuleManager({
            services: {secure: {permission: MODULE_PERMISSIONS.RUNTIME, value: rawService}}
        });
        let rejection = null;
        manager.registerModule({
            manifest: manifest('test.nonportable-argument', [MODULE_PERMISSIONS.RUNTIME]),
            hooks: {
                initialize: context => {
                    class MutableHolder {}
                    try {
                        context.getService('secure').accept(new MutableHolder());
                    } catch (error) {
                        rejection = error;
                    }
                }
            }
        });
        manager.initializeModule('test.nonportable-argument');
        assert(rejection);
        assert.strictEqual(rejection.code, 'MODULE_SERVICE_ARGUMENT_UNSUPPORTED');
        manager.dispose();
    }

    // Missing permission is rejected before a service facade is returned.
    {
        const manager = createModuleManager({
            services: {secure: {permission: MODULE_PERMISSIONS.RUNTIME, value: {ok: true}}}
        });
        manager.registerModule({
            manifest: manifest('test.no-permission'),
            hooks: {
                initialize: context => context.getService('secure')
            }
        });
        assert.throws(
            () => manager.initializeModule('test.no-permission'),
            error => error && error.code === 'MODULE_SERVICE_PERMISSION_DENIED'
        );
        manager.dispose();
    }

    // Runtime installation stores Host authority privately, exposes/returns only Client, and resolves definitions first.
    {
        const source = fs.readFileSync(
            path.resolve(__dirname, '../src/lib/first-party-modules/runtime-integration.js'),
            'utf8'
        );
        const definitionIndex = source.indexOf('const builtInDefinitions = getBuiltInModuleDefinitions();');
        const managerIndex = source.indexOf('const manager = createModuleManager({');
        assert(definitionIndex !== -1 && managerIndex !== -1 && definitionIndex < managerIndex);
        assert(source.includes('value: manager.client'));
        assert(source.includes('return manager.client;'));
        assert(!source.includes('return manager;\n};'));
    }

    console.log('NGVGE TASK 0008.9.4.1.5 deferred authority and service lifetime validation passed.');
};

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
