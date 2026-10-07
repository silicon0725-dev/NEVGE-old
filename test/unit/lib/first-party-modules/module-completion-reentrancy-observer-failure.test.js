const {
    MODULE_AVAILABILITY,
    MODULE_KINDS,
    createModuleManager
} = require('../../../../src/lib/first-party-modules');

const createManifest = (id, dependencies = []) => ({
    apiVersion: '1',
    availability: MODULE_AVAILABILITY.AVAILABLE,
    capabilities: [],
    defaultEnabled: false,
    dependencies: dependencies.map(dependencyId => ({id: dependencyId, optional: false})),
    description: `${id} test module.`,
    id,
    kind: MODULE_KINDS.FIRST_PARTY,
    name: id,
    permissions: [],
    version: '1'
});

describe('0008.9.4.1.2 Module Completion Reentrancy and Observer Failure Closure', () => {
    test('completeEnable appends nested enables without recursively flushing completion', () => {
        const order = [];
        const manager = createModuleManager();
        manager.registerModule({
            manifest: createManifest('extra'),
            hooks: {
                completeEnable: () => order.push('extra.complete'),
                enable: () => order.push('extra.enable')
            }
        });
        manager.registerModule({
            manifest: createManifest('core'),
            hooks: {
                completeEnable: context => {
                    order.push('core.complete:start');
                    context.manager.enableModule('extra');
                    order.push('core.complete:end');
                },
                enable: () => order.push('core.enable')
            }
        });
        manager.registerModule({
            manifest: createManifest('dependent', ['core']),
            hooks: {
                completeEnable: () => order.push('dependent.complete'),
                enable: () => order.push('dependent.enable')
            }
        });

        expect(manager.enableModule('dependent')).toBe(true);
        expect(order).toEqual([
            'core.enable',
            'dependent.enable',
            'core.complete:start',
            'extra.enable',
            'core.complete:end',
            'dependent.complete',
            'extra.complete'
        ]);
        ['core', 'dependent', 'extra'].forEach(moduleId => {
            expect(manager.getModuleState(moduleId)).toMatchObject({
                enableCompletion: 'completed',
                enabled: true,
                state: 'enabled'
            });
        });
    });

    test('observer failures are isolated from lifecycle operations', () => {
        const manager = createModuleManager();
        const hooks = [];
        manager.registerModule({
            manifest: createManifest('observed'),
            hooks: {
                completeEnable: context => {
                    hooks.push('complete');
                    context.capabilities.provide('observed.runtime', true);
                },
                enable: context => {
                    hooks.push('enable');
                    context.capabilities.provide('observed.registration', true);
                }
            }
        });
        manager.subscribe(change => {
            if (change.type === 'module:enable-pending') throw new Error('observer failure');
        });

        expect(manager.enableModule('observed')).toBe(true);
        expect(hooks).toEqual(['enable', 'complete']);
        expect(manager.getCapability('observed.registration')).toBe(true);
        expect(manager.getCapability('observed.runtime')).toBe(true);
        expect(manager.getObserverErrorSnapshot().count).toBe(1);
    });

    test('initialize failure revokes capabilities and retry starts cleanly', () => {
        const manager = createModuleManager();
        let fail = true;
        let attempts = 0;
        manager.registerModule({
            manifest: createManifest('initialize-rollback'),
            hooks: {
                initialize: context => {
                    attempts += 1;
                    context.capabilities.provide('initialize.temp', attempts);
                    if (fail) throw new Error('initialize failure');
                }
            }
        });

        expect(() => manager.initializeModule('initialize-rollback')).toThrow('initialize failure');
        expect(manager.getCapability('initialize.temp')).toBeNull();
        fail = false;
        expect(manager.initializeModule('initialize-rollback')).toBe(true);
        expect(manager.getCapability('initialize.temp')).toBe(2);
    });
});
