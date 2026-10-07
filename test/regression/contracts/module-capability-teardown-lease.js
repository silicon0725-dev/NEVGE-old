'use strict';

const assert = require('assert');
const {createModuleManager} = require('../../../src/lib/first-party-modules/module-manager');
const {
    MODULE_AVAILABILITY,
    MODULE_KINDS
} = require('../../../src/lib/first-party-modules/constants');

const createManifest = id => ({
    apiVersion: '1',
    availability: MODULE_AVAILABILITY.AVAILABLE,
    capabilities: [],
    defaultEnabled: false,
    dependencies: [],
    description: `${id} teardown lease regression module.`,
    id,
    kind: MODULE_KINDS.FIRST_PARTY,
    name: id,
    permissions: [],
    version: '1'
});

const assertModuleCapabilityTeardownLeaseContract = () => {
    const listeners = new Set();
    const manager = createModuleManager();
    let capability = null;
    let teardown = null;

    manager.registerModule({
        manifest: createManifest('regression-provider'),
        hooks: {
            enable: context => context.capabilities.provide('regression.observable', {
                read: () => 'live',
                subscribe: listener => {
                    listeners.add(listener);
                    return () => listeners.delete(listener);
                }
            })
        }
    });
    manager.registerModule({
        manifest: createManifest('regression-consumer'),
        hooks: {
            enable: context => {
                capability = context.capabilities.require('regression.observable');
                teardown = capability.subscribe(() => {});
            }
        }
    });

    manager.enableModule('regression-provider');
    manager.enableModule('regression-consumer');
    assert.strictEqual(listeners.size, 1, 'subscription should be live before provider disable');

    manager.disableModule('regression-provider', {force: true});

    assert.throws(
        () => capability.read(),
        error => error && error.code === 'MODULE_CAPABILITY_AUTHORITY_REVOKED',
        'business capability calls must remain revoked'
    );
    assert.strictEqual(typeof teardown.apply, 'function', 'React-style destroy.apply lookup must remain local');
    assert.doesNotThrow(() => teardown.apply(undefined), 'teardown lease must survive provider revocation');
    assert.strictEqual(listeners.size, 0, 'teardown lease must still release the original observer');
    assert.strictEqual(teardown(), false, 'teardown lease must be idempotent');

    manager.dispose();
    return {
        businessAuthorityRevoked: true,
        idempotent: true,
        reactApplySafe: true,
        subscriptionReleased: true
    };
};

module.exports = {
    assertModuleCapabilityTeardownLeaseContract
};
