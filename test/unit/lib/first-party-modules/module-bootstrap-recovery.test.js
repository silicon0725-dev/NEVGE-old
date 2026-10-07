const {createModuleManager} = require('../../../../src/lib/first-party-modules/module-manager');

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

describe('module bootstrap recovery authority', () => {
    test('initialize failure revokes capabilities without masking the root error', () => {
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

        expect(() => manager.initializeModule('test.recovery.initialize')).toThrow('initialize root cause');
        expect(manager.getCapability('test.recovery.initialize.capability')).toBeNull();
        expect(manager.getModuleState('test.recovery.initialize')).toMatchObject({
            enableCompletion: 'failed',
            enabled: false,
            error: 'initialize root cause',
            state: 'error'
        });
    });

    test('completeEnable failure can revoke registration capabilities while completion guard is active', () => {
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

        expect(() => manager.enableModule('test.recovery.complete')).toThrow('complete root cause');
        expect(manager.getCapability('test.recovery.registration')).toBeNull();
        expect(manager.getModuleState('test.recovery.complete')).toMatchObject({
            enableCompletion: 'failed',
            enabled: false,
            error: 'complete root cause',
            state: 'error'
        });
    });

    test('retry begins with a clean capability provider', () => {
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

        expect(() => manager.enableModule('test.recovery.retry')).toThrow('retry first failure');
        expect(manager.getCapability('test.recovery.retry.registration')).toBeNull();
        shouldFail = false;
        expect(manager.enableModule('test.recovery.retry')).toBe(true);
        expect(manager.getModuleState('test.recovery.retry')).toMatchObject({
            enableCompletion: 'completed',
            enabled: true,
            state: 'enabled'
        });
        expect(manager.getCapability('test.recovery.retry.registration')).not.toBeNull();
        expect(manager.getCapability('test.recovery.retry.runtime')).not.toBeNull();
    });
});
