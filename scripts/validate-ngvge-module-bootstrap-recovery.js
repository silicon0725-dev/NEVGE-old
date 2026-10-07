const assert = require('assert');
const {createModuleManager} = require('../src/lib/first-party-modules/module-manager');

const manifest = (id, dependencies = []) => ({
    apiVersion: '1',
    author: 'NGVGE Test',
    availability: 'available',
    capabilities: [],
    defaultEnabled: false,
    dependencies: dependencies.map(dependencyId => ({id: dependencyId, optional: false})),
    description: id,
    id,
    kind: 'first-party',
    name: id,
    permissions: [],
    required: false,
    version: '1.0.0'
});

// initialize cleanup: a capability published before the failure must not survive,
// and the original error must remain the externally observed failure.
{
    const manager = createModuleManager();
    manager.registerModule({
        manifest: manifest('test.recovery.initialize'),
        hooks: {
            initialize: context => {
                context.capabilities.provide('test.recovery.initialize.capability', {ready: false});
                throw new Error('initialize root cause');
            }
        }
    });
    assert.throws(
        () => manager.initializeModule('test.recovery.initialize'),
        error => error && error.message === 'initialize root cause'
    );
    assert.strictEqual(manager.getCapability('test.recovery.initialize.capability'), null);
    const state = manager.getModuleState('test.recovery.initialize');
    assert.strictEqual(state.enableCompletion, 'failed');
    assert.strictEqual(state.enabled, false);
    assert.strictEqual(state.error, 'initialize root cause');
}

// enable cleanup: provider-wide recovery must revoke capabilities without masking
// the hook failure.
{
    const manager = createModuleManager();
    manager.registerModule({
        manifest: manifest('test.recovery.enable'),
        hooks: {
            enable: context => {
                context.capabilities.provide('test.recovery.enable.capability', {ready: false});
                throw new Error('enable root cause');
            }
        }
    });
    assert.throws(
        () => manager.enableModule('test.recovery.enable'),
        error => error && error.message === 'enable root cause'
    );
    assert.strictEqual(manager.getCapability('test.recovery.enable.capability'), null);
    const state = manager.getModuleState('test.recovery.enable');
    assert.strictEqual(state.enableCompletion, 'failed');
    assert.strictEqual(state.enabled, false);
    assert.strictEqual(state.error, 'enable root cause');
}

// completeEnable cleanup runs while the completion guard is active. Recovery must
// still be able to revoke registration-stage capabilities and preserve the original
// completeEnable failure.
{
    const manager = createModuleManager();
    manager.registerModule({
        manifest: manifest('test.recovery.complete'),
        hooks: {
            enable: context => {
                context.capabilities.provide('test.recovery.registration', {ready: true});
            },
            completeEnable: () => {
                throw new Error('complete root cause');
            }
        }
    });
    assert.throws(
        () => manager.enableModule('test.recovery.complete'),
        error => error && error.message === 'complete root cause'
    );
    assert.strictEqual(manager.getCapability('test.recovery.registration'), null);
    const state = manager.getModuleState('test.recovery.complete');
    assert.strictEqual(state.enableCompletion, 'failed');
    assert.strictEqual(state.enabled, false);
    assert.strictEqual(state.error, 'complete root cause');
}

// Retry must begin from a clean provider state and reach a fully operational module.
{
    const manager = createModuleManager();
    let shouldFail = true;
    manager.registerModule({
        manifest: manifest('test.recovery.retry'),
        hooks: {
            enable: context => {
                context.capabilities.provide('test.recovery.retry.registration', {attempt: shouldFail ? 1 : 2});
                if (shouldFail) throw new Error('retry first failure');
            },
            completeEnable: context => {
                context.capabilities.provide('test.recovery.retry.runtime', {ready: true});
            }
        }
    });
    assert.throws(() => manager.enableModule('test.recovery.retry'), /retry first failure/);
    assert.strictEqual(manager.getCapability('test.recovery.retry.registration'), null);
    shouldFail = false;
    assert.strictEqual(manager.enableModule('test.recovery.retry'), true);
    const state = manager.getModuleState('test.recovery.retry');
    assert.strictEqual(state.enableCompletion, 'completed');
    assert.strictEqual(state.enabled, true);
    assert(manager.getCapability('test.recovery.retry.registration'));
    assert(manager.getCapability('test.recovery.retry.runtime'));
}

console.log('Module Bootstrap Recovery Authority PASS');
