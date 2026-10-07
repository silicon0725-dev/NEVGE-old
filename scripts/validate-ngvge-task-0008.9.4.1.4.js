#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');

const originalLoad = Module._load;
class FakeZip {
    file () { return this; }
    folder () { return this; }
    async generateAsync () { return Buffer.from(''); }
    static async loadAsync () { return new FakeZip(); }
}
Module._load = function (request, parent, isMain) {
    if (request === '@turbowarp/jszip') return FakeZip;
    return originalLoad(request, parent, isMain);
};

const {
    CORE_MODULE_ID,
    MODULE_AVAILABILITY,
    MODULE_KINDS,
    createModuleManager,
    getBuiltInModuleDefinitions
} = require('../src/lib/first-party-modules');

const manifest = (id, dependencies = []) => ({
    apiVersion: '1',
    availability: MODULE_AVAILABILITY.AVAILABLE,
    capabilities: [],
    defaultEnabled: false,
    dependencies: dependencies.map(dependencyId => ({id: dependencyId, optional: false})),
    description: id,
    id,
    kind: MODULE_KINDS.FIRST_PARTY,
    name: id,
    permissions: [],
    version: '1'
});

// Observer dispatch cannot bypass Manager guards through the raw Module Registry.
{
    const manager = createModuleManager();
    let enableCount = 0;
    manager.registerModule({
        manifest: manifest('test.observer-registry'),
        hooks: {
            enable: context => {
                enableCount += 1;
                context.capabilities.provide('test.observer-registry.registration', {ready: true});
            }
        }
    });
    manager.subscribe(change => {
        if (change.type === 'module:enable-pending') {
            manager.unregisterModule(change.moduleId, {force: true});
        }
    });
    assert.strictEqual(manager.enableModule('test.observer-registry'), true);
    assert.strictEqual(enableCount, 1);
    assert(manager.hasModule('test.observer-registry'));
    assert(manager.getCapability('test.observer-registry.registration'));
    assert.strictEqual(manager.getModuleState('test.observer-registry').enabled, true);
    assert.strictEqual(
        manager.getObserverErrorSnapshot().lastError.code,
        'MODULE_OBSERVER_REENTRANT_MUTATION'
    );
    manager.dispose();
}

// Module Client Context has no raw Host infrastructure, and captured Host infrastructure is still phase-guarded.
{
    const manager = createModuleManager();
    let clientSurface = null;
    manager.registerModule({
        manifest: manifest('test.completion-raw'),
        hooks: {
            enable: context => context.capabilities.provide('test.completion-raw.registration', {ready: true}),
            completeEnable: context => {
                clientSurface = context.manager;
                assert.strictEqual(context.manager.registry, undefined);
                assert.strictEqual(context.manager.capabilities, undefined);
                assert.strictEqual(context.manager.dataStore, undefined);
                assert.strictEqual(context.manager.unregisterModule, undefined);
                assert.strictEqual(context.manager.disableModule, undefined);
                assert.throws(
                    () => manager.unregisterModule(context.moduleId, {force: true}),
                    error => error && error.code === 'MODULE_COMPLETION_REENTRANT_MUTATION'
                );
                assert.throws(
                    () => manager.revokeCapabilitiesByProvider(context.moduleId),
                    error => error && error.code === 'MODULE_COMPLETION_REENTRANT_MUTATION'
                );
                assert.throws(
                    () => manager.setModuleData(context.moduleId, {}),
                    error => error && error.code === 'MODULE_COMPLETION_REENTRANT_MUTATION'
                );
            }
        }
    });
    assert.strictEqual(manager.enableModule('test.completion-raw'), true);
    assert(Object.isFrozen(clientSurface));
    assert(manager.hasModule('test.completion-raw'));
    assert(manager.getCapability('test.completion-raw.registration'));
    assert.strictEqual(manager.getModuleState('test.completion-raw').enabled, true);
    manager.dispose();
}

// Provider identity cannot be forged through a captured Host Capability Registry.
{
    const manager = createModuleManager();
    manager.registerModule({
        manifest: manifest('test.owner'),
        hooks: {
            initialize: context => context.capabilities.provide('test.shared', {value: 'old'})
        }
    });
    manager.registerModule({
        manifest: manifest('test.attacker'),
        hooks: {
            initialize: () => manager.provideCapability(
                'test.owner',
                'test.shared',
                {value: 'new'},
                {replace: true}
            )
        }
    });
    assert.strictEqual(manager.initializeModule('test.owner'), true);
    assert.throws(
        () => manager.initializeModule('test.attacker'),
        error => error && error.code === 'MODULE_HOST_AUTHORITY_REQUIRED'
    );
    assert.deepStrictEqual(manager.getCapability('test.shared'), {value: 'old'});
    assert.strictEqual(manager.getCapabilityRecord('test.shared').providerModuleId, 'test.owner');
    assert.strictEqual(manager.getModuleState('test.attacker').initialized, false);

    manager.registerModule({
        manifest: manifest('test.revoker'),
        hooks: {
            initialize: () => manager.revokeCapabilitiesByProvider('test.owner')
        }
    });
    assert.throws(
        () => manager.initializeModule('test.revoker'),
        error => error && error.code === 'MODULE_HOST_AUTHORITY_REQUIRED'
    );
    assert.deepStrictEqual(manager.getCapability('test.shared'), {value: 'old'});
    manager.dispose();
}

// Module Data identity is bound to context.data and cannot be forged through the raw Data Store.
{
    const manager = createModuleManager();
    manager.registerModule({
        manifest: manifest('test.data-owner'),
        hooks: {
            initialize: context => context.data.set({value: 'owner'})
        }
    });
    manager.registerModule({
        manifest: manifest('test.data-attacker'),
        hooks: {
            initialize: () => manager.setModuleData('test.data-owner', {value: 'attacker'})
        }
    });
    assert.strictEqual(manager.initializeModule('test.data-owner'), true);
    assert.throws(
        () => manager.initializeModule('test.data-attacker'),
        error => error && error.code === 'MODULE_HOST_AUTHORITY_REQUIRED'
    );
    assert.deepStrictEqual(manager.getModuleData('test.data-owner'), {value: 'owner'});
    manager.dispose();
}

// Raw infrastructure state is private, sealed, and cannot be reached through legacy underscore fields.
{
    const manager = createModuleManager();
    assert.strictEqual(manager.registry, undefined);
    assert.strictEqual(manager.capabilities, undefined);
    assert.strictEqual(manager.dataStore, undefined);
    assert.strictEqual(typeof manager.hasModule, 'function');
    assert.strictEqual(typeof manager.getCapabilityRecord, 'function');
    assert.strictEqual(typeof manager.getModuleData, 'function');
    assert.strictEqual(typeof manager.subscribeRegistry, 'function');
    assert.strictEqual(typeof manager.subscribeCapabilities, 'function');
    assert.strictEqual(typeof manager.subscribeModuleData, 'function');
    assert(Object.isFrozen(manager));
    assert(Object.isFrozen(manager.client));
    assert.strictEqual(manager.client.registry, undefined);
    assert.strictEqual(manager.client.capabilities, undefined);
    assert.strictEqual(manager.client.dataStore, undefined);
    assert.strictEqual(manager.client.unregisterModule, undefined);
    manager.dispose();
}

// The built-in Core module publishes only Client/read-only facades, never Host Manager infrastructure.
{
    const manager = createModuleManager();
    const coreDefinition = getBuiltInModuleDefinitions().find(definition => definition.manifest.id === CORE_MODULE_ID);
    manager.registerModule(coreDefinition);
    assert.strictEqual(manager.enableModule(CORE_MODULE_ID), true);
    const client = manager.getCapability('ngvge.module-manager');
    const moduleData = manager.getCapability('ngvge.module-data');
    assert(client);
    assert(moduleData);
    assert.strictEqual(client.registry, undefined);
    assert.strictEqual(client.capabilities, undefined);
    assert.strictEqual(client.dataStore, undefined);
    assert.strictEqual(client.disableModule, undefined);
    assert.strictEqual(typeof client.enableModule, 'function');
    assert.strictEqual(typeof moduleData.get, 'function');
    assert.strictEqual(typeof moduleData.subscribe, 'function');
    assert.strictEqual(moduleData.set, undefined);
    assert.strictEqual(moduleData.clear, undefined);
    manager.dispose();
}

// Engine Host authority remains functional outside Module/Observer execution domains.
{
    const manager = createModuleManager();
    manager.registerModule({manifest: manifest('test.host'), hooks: {}});
    assert(manager.hasModule('test.host'));
    const disposeCapability = manager.provideCapability('test.host', 'test.host.capability', {ok: true});
    assert.deepStrictEqual(manager.getCapability('test.host.capability'), {ok: true});
    assert.strictEqual(disposeCapability(), true);
    assert.strictEqual(manager.getCapability('test.host.capability'), null);
    assert.strictEqual(manager.unregisterModule('test.host'), true);
    manager.dispose();
}

// Retained Module Context cannot mint new capabilities outside lifecycle publication phases,
// and its generation-scoped authority is revoked on unregister/re-register.
{
    const manager = createModuleManager();
    let capturedContext = null;
    manager.registerModule({
        manifest: manifest('test.retained-context'),
        hooks: {
            enable: context => {
                capturedContext = context;
                context.capabilities.provide('test.retained-context.registration', {ready: true});
            }
        }
    });
    assert.strictEqual(manager.enableModule('test.retained-context'), true);
    assert.throws(
        () => capturedContext.capabilities.provide('test.retained-context.late', {ready: true}),
        error => error && error.code === 'MODULE_CAPABILITY_PROVISION_PHASE_FORBIDDEN'
    );
    assert.strictEqual(manager.getCapability('test.retained-context.late'), null);
    assert.deepStrictEqual(capturedContext.data.set({value: 1}), {value: 1});
    assert.strictEqual(manager.unregisterModule('test.retained-context', {force: true}), true);
    assert.throws(
        () => capturedContext.data.set({value: 2}),
        error => error && error.code === 'MODULE_CLIENT_AUTHORITY_REVOKED'
    );
    assert.throws(
        () => capturedContext.manager.listModules(),
        error => error && error.code === 'MODULE_CLIENT_AUTHORITY_REVOKED'
    );

    manager.registerModule({manifest: manifest('test.retained-context'), hooks: {}});
    assert.throws(
        () => capturedContext.data.get({}),
        error => error && error.code === 'MODULE_CLIENT_AUTHORITY_REVOKED'
    );
    manager.dispose();
}

// Client enable authority is phase constrained: completeEnable may append, earlier hooks may not recurse.
{
    const manager = createModuleManager();
    manager.registerModule({manifest: manifest('test.phase-target'), hooks: {}});
    manager.registerModule({
        manifest: manifest('test.phase-source'),
        hooks: {
            initialize: context => context.manager.enableModule('test.phase-target')
        }
    });
    assert.throws(
        () => manager.initializeModule('test.phase-source'),
        error => error && error.code === 'MODULE_CLIENT_ENABLE_PHASE_FORBIDDEN'
    );
    assert.strictEqual(manager.getModuleState('test.phase-target').enabled, false);
    manager.dispose();
}

// Registered hook tables are copied and frozen; caller-held definitions cannot rewrite lifecycle code.
{
    const manager = createModuleManager();
    let originalEnableCount = 0;
    let replacementEnableCount = 0;
    const hooks = {enable: () => { originalEnableCount += 1; }};
    const record = manager.registerModule({manifest: manifest('test.hook-table'), hooks});
    hooks.enable = () => { replacementEnableCount += 1; };
    assert(Object.isFrozen(record.hooks));
    assert.strictEqual(manager.enableModule('test.hook-table'), true);
    assert.strictEqual(originalEnableCount, 1);
    assert.strictEqual(replacementEnableCount, 0);
    manager.dispose();
}

// Duplicate Host registration is rejected before lifecycle state or Provider residue can diverge.
{
    const manager = createModuleManager();
    manager.registerModule({
        manifest: manifest('test.duplicate'),
        hooks: {
            enable: context => context.capabilities.provide('test.duplicate.capability', {generation: 1})
        }
    });
    assert.strictEqual(manager.enableModule('test.duplicate'), true);
    const beforeState = manager.getModuleState('test.duplicate');
    assert.throws(
        () => manager.registerModule({manifest: manifest('test.duplicate'), hooks: {}}),
        error => error && error.code === 'MODULE_ALREADY_REGISTERED'
    );
    assert.deepStrictEqual(manager.getModuleState('test.duplicate'), beforeState);
    assert.deepStrictEqual(manager.getCapability('test.duplicate.capability'), {generation: 1});
    assert.strictEqual(manager.getModuleRecord('test.duplicate').hooks.enable instanceof Function, true);
    manager.dispose();
}

// Host disposal revokes all Client and infrastructure mutation authority.
{
    const manager = createModuleManager();
    const client = manager.client;
    manager.registerModule({manifest: manifest('test.disposed'), hooks: {}});
    manager.dispose();
    assert.throws(
        () => client.enableModule('test.disposed'),
        error => error && error.code === 'MODULE_MANAGER_DISPOSED'
    );
    assert.throws(
        () => manager.unregisterModule('test.disposed'),
        error => error && error.code === 'MODULE_MANAGER_DISPOSED'
    );
    assert.throws(
        () => manager.provideCapability('host', 'late', true),
        error => error && error.code === 'MODULE_MANAGER_DISPOSED'
    );
}

// Runtime integration stores Host Manager privately and exposes only manager.client on Runtime.
{
    const integrationSource = fs.readFileSync(
        path.resolve(__dirname, '../src/lib/first-party-modules/runtime-integration.js'),
        'utf8'
    );
    assert(integrationSource.includes('const managersByRuntime = new WeakMap();'));
    assert(integrationSource.includes('value: manager.client'));
    assert(integrationSource.includes('configurable: false'));
    assert(integrationSource.includes('return manager ? manager.client : null;'));
    assert(!integrationSource.includes('runtime[FRAMEWORK_PROPERTY] = manager;'));
}

Module._load = originalLoad;
console.log('NGVGE TASK 0008.9.4.1.4 module host/client authority surface validation passed.');
