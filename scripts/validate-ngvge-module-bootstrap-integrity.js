#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const lifecyclePath = path.join(root, 'src/lib/first-party-modules/module-lifecycle-constants.js');
const constantsPath = path.join(root, 'src/lib/first-party-modules/constants.js');
const managerPath = path.join(root, 'src/lib/first-party-modules/module-manager.js');

const lifecycleSource = fs.readFileSync(lifecyclePath, 'utf8');
const managerSource = fs.readFileSync(managerPath, 'utf8');

assert(!/\brequire\s*\(/.test(lifecycleSource), 'Lifecycle constants leaf must remain import-free.');
assert(!/^\s*import\s/m.test(lifecycleSource), 'Lifecycle constants leaf must remain import-free.');
assert(
    /require\('\.\/module-lifecycle-constants'\)/.test(managerSource),
    'Module Manager must import lifecycle state constants directly from the leaf contract.'
);

const lifecycle = require(lifecyclePath);
const aggregate = require(constantsPath);
assert.strictEqual(aggregate.MODULE_ENABLE_COMPLETION, lifecycle.MODULE_ENABLE_COMPLETION);
assert.strictEqual(aggregate.MODULE_STATES, lifecycle.MODULE_STATES);
assert.strictEqual(lifecycle.MODULE_ENABLE_COMPLETION.IDLE, 'idle');
assert.strictEqual(lifecycle.MODULE_STATES.REGISTERED, 'registered');

// Reproduce the browser failure class: the aggregate constants surface can be
// stale during an incremental overlay. Bootstrap state must not depend on the
// lifecycle enums being present on that aggregate object.
const previousCompletion = aggregate.MODULE_ENABLE_COMPLETION;
const previousStates = aggregate.MODULE_STATES;
delete aggregate.MODULE_ENABLE_COMPLETION;
delete aggregate.MODULE_STATES;
delete require.cache[require.resolve(managerPath)];

try {
    const {createModuleManager} = require(managerPath);
    assert.strictEqual(typeof createModuleManager, 'function');
    const manager = createModuleManager();
    manager.registerModule({
        hooks: {},
        manifest: {
            apiVersion: '1',
            compatibility: {
                sb3: {
                    level: 'full',
                    strategy: 'preserve-metadata'
                }
            },
            defaultEnabled: false,
            dependencies: [],
            id: 'ngvge.bootstrap.integrity',
            name: 'NGVGE Bootstrap Integrity',
            permissions: [],
            required: false,
            version: '1.0.0'
        }
    });
    const state = manager.getModuleState('ngvge.bootstrap.integrity');
    assert(state, 'Registered module must have lifecycle state.');
    assert.strictEqual(state.enableCompletion, 'idle');
    assert.strictEqual(state.state, 'registered');
    assert.strictEqual(state.enabled, false);
    manager.dispose();
} finally {
    aggregate.MODULE_ENABLE_COMPLETION = previousCompletion;
    aggregate.MODULE_STATES = previousStates;
    delete require.cache[require.resolve(managerPath)];
}

console.log('NGVGE module bootstrap integrity: PASS');
