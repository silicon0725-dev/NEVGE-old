#!/usr/bin/env node
'use strict';

const assert = require('assert');
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
    MODULE_AVAILABILITY,
    MODULE_KINDS,
    createModuleManager
} = require('../src/lib/first-party-modules');

const createManifest = (id, dependencies = []) => ({
    apiVersion: '1',
    availability: MODULE_AVAILABILITY.AVAILABLE,
    capabilities: [],
    defaultEnabled: false,
    dependencies: dependencies.map(dependencyId => ({id: dependencyId, optional: false})),
    description: `${id} validation module.`,
    id,
    kind: MODULE_KINDS.FIRST_PARTY,
    name: id,
    permissions: [],
    version: '1'
});

// completeEnable may append another enable request without recursively flushing the queue.
{
    const order = [];
    const manager = createModuleManager();
    manager.registerModule({
        manifest: createManifest('test.extra'),
        hooks: {
            completeEnable: () => order.push('extra.complete'),
            enable: () => order.push('extra.enable')
        }
    });
    manager.registerModule({
        manifest: createManifest('test.core'),
        hooks: {
            completeEnable: context => {
                order.push('core.complete:start');
                context.manager.enableModule('test.extra');
                order.push('core.complete:end');
            },
            enable: () => order.push('core.enable')
        }
    });
    manager.registerModule({
        manifest: createManifest('test.dependent', ['test.core']),
        hooks: {
            completeEnable: () => order.push('dependent.complete'),
            enable: () => order.push('dependent.enable')
        }
    });

    assert.strictEqual(manager.enableModule('test.dependent'), true);
    ['test.core', 'test.dependent', 'test.extra'].forEach(moduleId => {
        const state = manager.getModuleState(moduleId);
        assert.strictEqual(state.enabled, true);
        assert.strictEqual(state.enableCompletion, 'completed');
        assert.strictEqual(state.state, 'enabled');
    });
    assert.deepStrictEqual(order, [
        'core.enable',
        'dependent.enable',
        'core.complete:start',
        'extra.enable',
        'core.complete:end',
        'dependent.complete',
        'extra.complete'
    ]);
    manager.dispose();
}

// Module observers cannot interrupt Registration -> Restore lifecycle ordering.
{
    let enableCount = 0;
    let completeCount = 0;
    const manager = createModuleManager();
    manager.registerModule({
        manifest: createManifest('test.observer'),
        hooks: {
            completeEnable: context => {
                completeCount += 1;
                context.capabilities.provide('test.observer.runtime', {ready: true});
            },
            enable: context => {
                enableCount += 1;
                context.capabilities.provide('test.observer.registration', {ready: true});
            }
        }
    });
    manager.subscribe(change => {
        if (change.type === 'module:enable-pending') throw new Error('observer failure');
    });
    assert.strictEqual(manager.enableModule('test.observer'), true);
    assert.strictEqual(enableCount, 1);
    assert.strictEqual(completeCount, 1);
    assert(manager.getCapability('test.observer.registration'));
    assert(manager.getCapability('test.observer.runtime'));
    const state = manager.getModuleState('test.observer');
    assert.strictEqual(state.enabled, true);
    assert.strictEqual(state.enableCompletion, 'completed');
    assert.strictEqual(manager.getObserverErrorSnapshot().count, 1);
    manager.dispose();
}

// Capability, Registry, and Data Store observers are diagnostic and cannot abort semantic operations.
{
    const manager = createModuleManager();
    manager.subscribeCapabilities(() => { throw new Error('capability observer'); });
    manager.subscribeRegistry(() => { throw new Error('registry observer'); });
    manager.subscribeModuleData(() => { throw new Error('data observer'); });
    manager.registerModule({
        manifest: createManifest('test.infrastructure-observers'),
        hooks: {
            enable: context => context.capabilities.provide('test.infrastructure.capability', {ready: true})
        }
    });
    assert.strictEqual(manager.enableModule('test.infrastructure-observers'), true);
    assert(manager.getCapability('test.infrastructure.capability'));
    assert.deepStrictEqual(manager.setModuleData('test.infrastructure-observers', {value: 1}), {value: 1});
    assert.strictEqual(manager.getInfrastructureObserverErrorSnapshot('capability').count > 0, true);
    assert.strictEqual(manager.getInfrastructureObserverErrorSnapshot('registry').count > 0, true);
    assert.strictEqual(manager.getInfrastructureObserverErrorSnapshot('data-store').count > 0, true);
    manager.dispose();
}

// initialize failure revokes every capability and retry starts from a clean provider state.
{
    let failInitialize = true;
    let initializeCount = 0;
    const manager = createModuleManager();
    manager.registerModule({
        manifest: createManifest('test.initialize-rollback'),
        hooks: {
            initialize: context => {
                initializeCount += 1;
                context.capabilities.provide('test.initialize.temporary', {attempt: initializeCount});
                if (failInitialize) throw new Error('initialize failure');
            }
        }
    });
    assert.throws(() => manager.initializeModule('test.initialize-rollback'), /initialize failure/);
    assert.strictEqual(manager.getCapability('test.initialize.temporary'), null);
    assert.strictEqual(manager.getModuleState('test.initialize-rollback').initialized, false);
    failInitialize = false;
    assert.strictEqual(manager.initializeModule('test.initialize-rollback'), true);
    assert.deepStrictEqual(manager.getCapability('test.initialize.temporary'), {attempt: 2});
    assert.strictEqual(manager.getModuleState('test.initialize-rollback').initialized, true);
    assert.strictEqual(initializeCount, 2);
    manager.dispose();
}

Module._load = originalLoad;
console.log('NGVGE TASK 0008.9.4.1.2 completion reentrancy and observer failure validation passed.');
