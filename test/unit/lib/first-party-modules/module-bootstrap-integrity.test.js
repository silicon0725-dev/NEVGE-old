const lifecycleConstants = require('../../../../src/lib/first-party-modules/module-lifecycle-constants');
const aggregateConstants = require('../../../../src/lib/first-party-modules/constants');

const createDefinition = id => ({
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
        id,
        name: id,
        permissions: [],
        required: false,
        version: '1.0.0'
    }
});

describe('NGVGE module bootstrap lifecycle constants', () => {
    test('aggregate constants re-export the import-free lifecycle leaf', () => {
        expect(aggregateConstants.MODULE_ENABLE_COMPLETION).toBe(lifecycleConstants.MODULE_ENABLE_COMPLETION);
        expect(aggregateConstants.MODULE_STATES).toBe(lifecycleConstants.MODULE_STATES);
    });

    test('module manager bootstrap does not depend on lifecycle enums from the aggregate constants surface', () => {
        const managerPath = require.resolve('../../../../src/lib/first-party-modules/module-manager');
        const completion = aggregateConstants.MODULE_ENABLE_COMPLETION;
        const states = aggregateConstants.MODULE_STATES;
        delete aggregateConstants.MODULE_ENABLE_COMPLETION;
        delete aggregateConstants.MODULE_STATES;
        delete require.cache[managerPath];

        try {
            const {createModuleManager} = require(managerPath);
            const manager = createModuleManager();
            manager.registerModule(createDefinition('test.bootstrap.integrity'));
            expect(manager.getModuleState('test.bootstrap.integrity')).toMatchObject({
                enableCompletion: 'idle',
                enabled: false,
                initialized: false,
                state: 'registered'
            });
            manager.dispose();
        } finally {
            aggregateConstants.MODULE_ENABLE_COMPLETION = completion;
            aggregateConstants.MODULE_STATES = states;
            delete require.cache[managerPath];
        }
    });
});
