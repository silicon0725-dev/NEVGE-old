const {createModuleManager} = require('../../../../src/lib/first-party-modules/module-manager');
const {
    MODULE_AVAILABILITY,
    MODULE_KINDS
} = require('../../../../src/lib/first-party-modules/constants');

const createManifest = id => ({
    apiVersion: '1',
    availability: MODULE_AVAILABILITY.AVAILABLE,
    capabilities: [],
    defaultEnabled: false,
    dependencies: [],
    description: `${id} test module.`,
    id,
    kind: MODULE_KINDS.FIRST_PARTY,
    name: id,
    permissions: [],
    version: '1'
});

describe('Module Service Facade array callback locality', () => {
    test('Array callback methods execute on the consumer side without exporting callback results', () => {
        const manager = createModuleManager();
        let list = null;
        let mapped = null;
        let filtered = null;

        manager.registerModule({
            manifest: createManifest('provider'),
            hooks: {
                enable: context => context.capabilities.provide('scene-list', {
                    list: () => [{id: 'scene-a'}, {id: 'scene-b'}]
                })
            }
        });
        manager.registerModule({
            manifest: createManifest('consumer'),
            hooks: {
                enable: context => {
                    class LocalOnlyValue {
                        constructor (id) {
                            this.id = id;
                        }
                    }
                    list = context.capabilities.require('scene-list').list();
                    mapped = list.map(scene => new LocalOnlyValue(scene.id));
                    filtered = list.filter(() => ({truthy: true}));
                }
            }
        });

        manager.enableModule('provider');
        manager.enableModule('consumer');

        expect(mapped).toHaveLength(2);
        expect(mapped[0].constructor.name).toBe('LocalOnlyValue');
        expect(mapped.map(value => value.id)).toEqual(['scene-a', 'scene-b']);
        expect(filtered).toHaveLength(2);
        expect(filtered[0].id).toBe('scene-a');
        expect(filtered[1].id).toBe('scene-b');
        expect(Array.isArray(list)).toBe(false);
    });

    test('saved local Array callback methods remain generation-revocable', () => {
        const manager = createModuleManager();
        let savedMap = null;

        manager.registerModule({
            manifest: createManifest('provider'),
            hooks: {
                enable: context => context.capabilities.provide('scene-list', {
                    list: () => [{id: 'scene-a'}]
                })
            }
        });
        manager.registerModule({
            manifest: createManifest('consumer'),
            hooks: {
                enable: context => {
                    const list = context.capabilities.require('scene-list').list();
                    savedMap = list.map;
                }
            }
        });

        manager.enableModule('provider');
        manager.enableModule('consumer');
        manager.disableModule('provider', {force: true});

        expect(() => savedMap(scene => scene.id)).toThrow(
            expect.objectContaining({code: 'MODULE_CAPABILITY_AUTHORITY_REVOKED'})
        );
    });
});
