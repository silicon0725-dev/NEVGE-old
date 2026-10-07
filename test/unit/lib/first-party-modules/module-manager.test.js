import {
    MODULE_AVAILABILITY,
    SB3_COMPATIBILITY_LEVELS,
    createModuleManager
} from '../../../../src/lib/first-party-modules';

const createDefinition = (id, options = {}) => ({
    hooks: options.hooks || {},
    manifest: {
        apiVersion: '1',
        availability: options.availability,
        compatibility: {
            sb3: {
                level: options.compatibility || SB3_COMPATIBILITY_LEVELS.FULL,
                strategy: options.strategy || 'preserve-metadata'
            }
        },
        defaultEnabled: Boolean(options.defaultEnabled),
        dependencies: options.dependencies || [],
        id,
        name: options.name || id,
        permissions: options.permissions || [],
        required: Boolean(options.required),
        version: '1.0.0'
    }
});

describe('NGVGE first-party module manager', () => {
    test('enables dependencies and revokes capabilities when disabled', () => {
        const manager = createModuleManager();
        manager.registerModule(createDefinition('test.core', {
            defaultEnabled: true,
            hooks: {
                enable: context => context.capabilities.provide('test.core', {ready: true})
            },
            required: true
        }));
        manager.registerModule(createDefinition('test.feature', {
            compatibility: SB3_COMPATIBILITY_LEVELS.PARTIAL,
            dependencies: ['test.core'],
            hooks: {
                enable: context => context.capabilities.provide('test.feature', {ready: true})
            }
        }));

        manager.initializeAll();
        manager.enableDefaults({silent: true});
        manager.enableModule('test.feature');

        expect(manager.getModuleState('test.core').enabled).toBe(true);
        expect(manager.getModuleState('test.feature').enabled).toBe(true);
        expect(manager.getCapability('test.feature')).toEqual({ready: true});
        expect(manager.getSB3CompatibilityReport().overall).toBe(SB3_COMPATIBILITY_LEVELS.PARTIAL);

        manager.disableModule('test.feature');
        expect(manager.getCapability('test.feature')).toBeNull();
    });

    test('persists isolated data and unknown module declarations', () => {
        const manager = createModuleManager();
        manager.registerModule(createDefinition('test.core', {defaultEnabled: true, required: true}));
        manager.registerModule(createDefinition('test.feature', {dependencies: ['test.core']}));
        manager.initializeAll();
        manager.enableDefaults({silent: true});

        manager.deserializeProject({
            frameworkVersion: 1,
            moduleData: {
                'missing.module': {preserved: true},
                'test.feature': {value: 42}
            },
            modules: {
                'missing.module': {enabled: true, version: '9.0.0'},
                'test.feature': {enabled: true, version: '1.0.0'}
            }
        });

        expect(manager.getModuleState('test.feature').enabled).toBe(true);
        expect(manager.getModuleData('test.feature')).toEqual({value: 42});

        const serialized = manager.serializeProject();
        expect(serialized.modules['missing.module']).toEqual({enabled: true, version: '9.0.0'});
        expect(serialized.moduleData['missing.module']).toEqual({preserved: true});
    });

    test('does not enable planned modules', () => {
        const manager = createModuleManager();
        manager.registerModule(createDefinition('test.planned', {
            availability: MODULE_AVAILABILITY.PLANNED
        }));
        manager.initializeAll();

        expect(() => manager.enableModule('test.planned')).toThrow(/planned/i);
    });
});
