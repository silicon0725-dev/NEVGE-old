#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

// The source archive intentionally has no root node_modules. The Scene System's
// built-in definition imports the snapshot serializer, which references JSZip at
// module-load time. Bootstrap publication validation does not exercise archive IO,
// so provide the smallest load-only stub needed to resolve the real built-in table.
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === '@turbowarp/jszip') return class BootstrapValidationZip {};
    return originalLoad.call(this, request, parent, isMain);
};

let builtIns;
try {
    builtIns = require('../src/lib/first-party-modules/built-in-modules');
} finally {
    Module._load = originalLoad;
}

const {CORE_MODULE_ID} = require('../src/lib/first-party-modules/constants');
const {createModuleManager} = require('../src/lib/first-party-modules/module-manager');

// Exercise the exact first-party Core definition used by browser bootstrap.
{
    const manager = createModuleManager({services: {}});
    const definitions = builtIns.getBuiltInModuleDefinitions();
    builtIns.registerBuiltInModules(manager, definitions);
    manager.initializeAll();
    assert.strictEqual(manager.enableDefaults({silent: true}), true);

    const state = manager.getModuleState(CORE_MODULE_ID);
    assert.strictEqual(state.enabled, true);
    assert.strictEqual(state.enableCompletion, 'completed');
    assert(manager.getCapability('ngvge.module-manager'));
    assert(manager.getCapability('ngvge.module-data'));
    manager.dispose();
}

// Capability publication is bound to the exact synchronous hook frame and the
// current registration generation. A retained context cannot publish later.
{
    const manager = createModuleManager();
    let retainedContext = null;
    manager.registerModule({
        manifest: {
            apiVersion: '1',
            availability: 'available',
            capabilities: [],
            compatibility: {sb3: {level: 'full', strategy: 'preserve-metadata'}},
            defaultEnabled: false,
            dependencies: [],
            id: 'test.publication.frame',
            kind: 'first-party',
            name: 'Publication Frame',
            permissions: [],
            required: false,
            version: '1.0.0'
        },
        hooks: {
            enable: context => {
                retainedContext = context;
                context.capabilities.provide('test.publication.frame.registration', {ready: true});
            }
        }
    });
    assert.strictEqual(manager.enableModule('test.publication.frame'), true);
    assert.throws(
        () => retainedContext.capabilities.provide('test.publication.frame.late', {ready: true}),
        error => error && error.code === 'MODULE_CAPABILITY_PROVISION_PHASE_FORBIDDEN'
    );
    manager.dispose();
}

// Re-registering the same id creates a fresh generation authority. A context from
// the prior generation remains revoked even while the new generation is active.
{
    const manager = createModuleManager();
    let oldContext = null;
    const createDefinition = capture => ({
        manifest: {
            apiVersion: '1',
            availability: 'available',
            capabilities: [],
            compatibility: {sb3: {level: 'full', strategy: 'preserve-metadata'}},
            defaultEnabled: false,
            dependencies: [],
            id: 'test.publication.generation',
            kind: 'first-party',
            name: 'Publication Generation',
            permissions: [],
            required: false,
            version: '1.0.0'
        },
        hooks: capture ? {enable: context => { oldContext = context; }} : {}
    });
    manager.registerModule(createDefinition(true));
    manager.enableModule('test.publication.generation');
    manager.unregisterModule('test.publication.generation', {force: true});
    manager.registerModule(createDefinition(false));
    assert.throws(
        () => oldContext.data.get({}),
        error => error && error.code === 'MODULE_CLIENT_AUTHORITY_REVOKED'
    );
    manager.dispose();
}

console.log('Module Capability Publication Authority PASS');
