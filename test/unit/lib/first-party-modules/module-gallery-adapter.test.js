const {createModuleManager} = require('../../../../src/lib/first-party-modules/module-manager');
const {
    MODULE_AVAILABILITY,
    MODULE_KINDS,
    SB3_COMPATIBILITY_LEVELS
} = require('../../../../src/lib/first-party-modules/constants');
const {
    createFirstPartyModuleGalleryItems,
    getModuleExtensionId,
    isFirstPartyModuleGalleryItem,
    toggleFirstPartyModule
} = require('../../../../src/lib/first-party-modules/module-gallery-adapter');

const createDefinition = ({id, availability = MODULE_AVAILABILITY.AVAILABLE, required = false}) => ({
    manifest: {
        apiVersion: '1',
        author: 'NGVGE Team',
        availability,
        capabilities: [],
        compatibility: {
            sb3: {
                description: 'Test compatibility',
                level: SB3_COMPATIBILITY_LEVELS.PARTIAL,
                strategy: 'preserve-metadata'
            }
        },
        defaultEnabled: required,
        dependencies: [],
        description: `${id} description`,
        id,
        kind: MODULE_KINDS.FIRST_PARTY,
        name: id,
        permissions: [],
        required,
        version: '1.0.0'
    }
});

describe('first-party module gallery adapter', () => {
    test('creates selectable gallery items for available modules', () => {
        const manager = createModuleManager();
        manager.registerModule(createDefinition({id: 'ngvge.core', required: true}));
        manager.registerModule(createDefinition({id: 'ngvge.scene-system'}));
        manager.initializeAll();
        manager.enableDefaults({silent: true});

        const items = createFirstPartyModuleGalleryItems(manager, {
            icons: {'ngvge.scene-system': 'scene.svg'},
            translations: {
                'ngvge.scene-system': {
                    name: '场景系统',
                    description: '管理多个场景'
                }
            }
        });

        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({
            description: '管理多个场景',
            extensionId: getModuleExtensionId('ngvge.scene-system'),
            iconURL: 'scene.svg',
            isFirstPartyModule: true,
            moduleEnabled: false,
            moduleId: 'ngvge.scene-system',
            name: '场景系统',
            sb3CompatibilityLevel: SB3_COMPATIBILITY_LEVELS.PARTIAL
        });
        expect(isFirstPartyModuleGalleryItem(items[0])).toBe(true);
    });

    test('does not expose planned modules until they become available', () => {
        const manager = createModuleManager();
        manager.registerModule(createDefinition({id: 'ngvge.future', availability: MODULE_AVAILABILITY.PLANNED}));
        manager.initializeAll();

        expect(createFirstPartyModuleGalleryItems(manager)).toEqual([]);
        expect(createFirstPartyModuleGalleryItems(manager, {includePlanned: true})[0].disabled).toBe(true);
    });

    test('toggles the real module manager state', () => {
        const manager = createModuleManager();
        manager.registerModule(createDefinition({id: 'ngvge.scene-system'}));
        manager.initializeAll();

        expect(toggleFirstPartyModule(manager, 'ngvge.scene-system')).toBe(true);
        expect(manager.getModuleState('ngvge.scene-system').enabled).toBe(true);

        expect(toggleFirstPartyModule(manager, 'ngvge.scene-system')).toBe(false);
        expect(manager.getModuleState('ngvge.scene-system').enabled).toBe(false);
    });
});
