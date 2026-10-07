const {
    MODULE_AVAILABILITY,
    MODULE_KINDS,
    MODULE_PERMISSIONS,
    createModuleManager,
    registerBuiltInModules
} = require('../../../../src/lib/first-party-modules');
const {
    RUNTIME_NODE_MODEL_CAPABILITY_ID,
    RUNTIME_NODE_TYPE_REGISTRATION_CAPABILITY_ID,
    SCENE_SYSTEM_MODULE_ID
} = require('../../../../src/lib/scene-system');
const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    RuntimeNodeGraph,
    createRuntimeComponentTypeRegistry,
    createRuntimeNodeModelHost
} = require('../../../../src/lib/runtime-nodes');

const clone = value => JSON.parse(JSON.stringify(value));
const scene = {id: 'scene-a', name: 'Scene A'};

const createNodeRecord = components => ({
    components,
    enabled: true,
    id: 'node-a',
    metadata: {},
    name: 'Node A',
    parentId: null,
    sceneId: scene.id,
    scope: 'scene',
    typeId: BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE
});

const createComponentRecord = (typeId, schemaVersion, data = {}) => ({
    allowMultiple: false,
    data,
    enabled: true,
    extensionData: {},
    id: 'component-a',
    schemaVersion,
    typeId
});

const createSnapshot = component => ({
    activeSceneId: scene.id,
    nodes: [createNodeRecord([component])],
    scenes: [scene],
    version: 1
});

describe('0008.9.4.1 Component Migration Bootstrap and Execution Isolation Closure', () => {
    test('fresh import preserves implicit authority and allows the real owner to claim the type', () => {
        const source = new RuntimeNodeGraph({activeSceneId: scene.id, scenes: [scene]});
        source.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'node-a',
            sceneId: scene.id
        }).addComponent({
            data: {opaque: true},
            id: 'component-a',
            schemaVersion: 7,
            typeId: 'test.fresh-unknown'
        });
        const state = source.exportState();
        source.dispose();

        const rebuilt = RuntimeNodeGraph.createFromState(state, {
            componentTypeRegistry: createRuntimeComponentTypeRegistry()
        }).graph;
        expect(rebuilt.componentTypeRegistry.isImplicit('test.fresh-unknown')).toBe(true);
        expect(rebuilt.componentTypeRegistry.get('test.fresh-unknown')).toMatchObject({
            ownerModuleId: 'ngvge.runtime.compat.import',
            schemaVersion: 7
        });

        rebuilt.componentTypeRegistry.register({
            cardinality: 'one',
            ownerModuleId: 'test.real-owner',
            schemaVersion: 7,
            typeId: 'test.fresh-unknown'
        }, {replace: true});
        expect(rebuilt.componentTypeRegistry.isImplicit('test.fresh-unknown')).toBe(false);
        expect(rebuilt.componentTypeRegistry.get('test.fresh-unknown').ownerModuleId).toBe('test.real-owner');
        rebuilt.dispose();
    });

    test('blocks Graph, Public Model and Registry writes across migration Registry clones', () => {
        const registry = createRuntimeComponentTypeRegistry([{
            cardinality: 'one',
            ownerModuleId: 'test.guard-owner',
            schemaVersion: 2,
            typeId: 'test.guard'
        }]);
        const activeGraph = new RuntimeNodeGraph({
            activeSceneId: scene.id,
            componentTypeRegistry: registry,
            scenes: [scene]
        });
        activeGraph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'victim',
            sceneId: scene.id
        });

        let project = {activeSceneId: scene.id, extensionData: {}, scenes: [scene]};
        const listeners = new Set();
        const host = createRuntimeNodeModelHost({
            getStatus: () => ({}),
            readProject: () => clone(project),
            subscribe: listener => {
                listeners.add(listener);
                return () => listeners.delete(listener);
            },
            writeProject: nextProject => {
                project = clone(nextProject);
                listeners.forEach(listener => listener({type: 'data'}));
                return clone(project);
            }
        }, {componentTypeRegistry: registry});

        const attempts = {};
        let unbind = null;
        unbind = registry.bindMigration('test.guard', 1, ({data}) => {
            try {
                activeGraph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
                    id: 'side-effect',
                    sceneId: scene.id
                });
            } catch (error) {
                attempts.graph = error.code;
            }
            try {
                registry.register({
                    cardinality: 'one',
                    ownerModuleId: 'test.guard-owner',
                    schemaVersion: 2,
                    typeId: 'test.guard'
                }, {replace: true});
            } catch (error) {
                attempts.registry = error.code;
            }
            try {
                unbind();
            } catch (error) {
                attempts.unbind = error.code;
            }
            const mutation = host.publicCapability.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
                id: 'public-side-effect',
                sceneId: scene.id
            });
            attempts.publicMutation = mutation.error && mutation.error.code;
            return {data: Object.assign({}, data, {migrated: true})};
        }, {ownerModuleId: 'test.guard-owner'});

        const beforeGraph = activeGraph.exportState();
        const beforeModel = host.publicCapability.exportState();
        const beforeDescriptors = clone(registry.list());
        const beforeMigrations = clone(registry.listMigrations());
        expect(() => RuntimeNodeGraph.createFromState(
            createSnapshot(createComponentRecord('test.guard', 1, {old: true})),
            {componentTypeRegistry: registry}
        )).toThrow(expect.objectContaining({
            errors: expect.arrayContaining([
                expect.objectContaining({code: 'RUNTIME_COMPONENT_MIGRATION_REENTRANT_MUTATION'})
            ])
        }));
        expect(attempts).toEqual({
            graph: 'RUNTIME_COMPONENT_MIGRATION_REENTRANT_MUTATION',
            publicMutation: 'RUNTIME_COMPONENT_MIGRATION_REENTRANT_MUTATION',
            registry: 'RUNTIME_COMPONENT_MIGRATION_REENTRANT_MUTATION',
            unbind: 'RUNTIME_COMPONENT_MIGRATION_REENTRANT_MUTATION'
        });
        expect(activeGraph.exportState()).toEqual(beforeGraph);
        expect(host.publicCapability.exportState()).toEqual(beforeModel);
        expect(clone(registry.list())).toEqual(beforeDescriptors);
        expect(clone(registry.listMigrations())).toEqual(beforeMigrations);
        expect(activeGraph.getNode('side-effect')).toBeNull();
        expect(host.publicCapability.getNode('public-side-effect')).toBeNull();

        host.dispose();
        activeGraph.dispose();
    });

    test('registers Descriptor and migrations before real Scene System initial restore', () => {
        const providerModuleId = 'test.schema-bootstrap';
        const manager = createModuleManager();
        registerBuiltInModules(manager);
        let completeEnableObservedMigratedState = false;
        let deserializeObservedMigratedState = false;
        manager.registerModule({
            manifest: {
                apiVersion: '1',
                availability: MODULE_AVAILABILITY.AVAILABLE,
                capabilities: [],
                defaultEnabled: false,
                dependencies: [SCENE_SYSTEM_MODULE_ID],
                description: 'Schema bootstrap validation provider.',
                id: providerModuleId,
                kind: MODULE_KINDS.FIRST_PARTY,
                name: 'Schema Bootstrap Validation',
                permissions: [MODULE_PERMISSIONS.RUNTIME, MODULE_PERMISSIONS.SERIALIZATION],
                version: '1'
            },
            hooks: {
                completeEnable: context => {
                    const model = context.capabilities.require(RUNTIME_NODE_MODEL_CAPABILITY_ID);
                    const component = model.getComponent('node-a', 'component-a');
                    completeEnableObservedMigratedState = Boolean(
                        component && component.schemaVersion === 2 && component.data.migrated === true
                    );
                },
                deserializeProject: context => {
                    const model = context.capabilities.require(RUNTIME_NODE_MODEL_CAPABILITY_ID);
                    const component = model.getComponent('node-a', 'component-a');
                    deserializeObservedMigratedState = Boolean(
                        component && component.schemaVersion === 2 && component.data.migrated === true
                    );
                },
                enable: context => {
                    expect(context.capabilities.get(RUNTIME_NODE_MODEL_CAPABILITY_ID)).toBeNull();
                    const registration = context.capabilities.require(
                        RUNTIME_NODE_TYPE_REGISTRATION_CAPABILITY_ID
                    );
                    registration.registerComponentTypeDescriptor({
                        cardinality: 'one',
                        ownerModuleId: providerModuleId,
                        schemaVersion: 2,
                        typeId: 'module.comp'
                    });
                    registration.bindComponentMigration('module.comp', 1, ({data}) => ({
                        data: Object.assign({}, data, {migrated: true})
                    }), {ownerModuleId: providerModuleId});
                }
            }
        });
        manager.initializeAll();
        manager.enableDefaults({silent: true});

        manager.deserializeProject({
            frameworkVersion: 1,
            moduleData: {
                [SCENE_SYSTEM_MODULE_ID]: {
                    activeSceneId: scene.id,
                    extensionData: {
                        runtimeNodeModel: createSnapshot(createComponentRecord('module.comp', 1, {old: true}))
                    },
                    scenes: [{id: scene.id, name: scene.name, snapshot: null, variables: []}],
                    schemaVersion: 1,
                    variables: []
                }
            },
            modules: {
                [SCENE_SYSTEM_MODULE_ID]: {enabled: true, version: '0.8.9.4.1'},
                [providerModuleId]: {enabled: true, version: '1'}
            }
        });

        const model = manager.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID);
        expect(model).not.toBeNull();
        expect(completeEnableObservedMigratedState).toBe(true);
        expect(deserializeObservedMigratedState).toBe(true);
        expect(model.getComponent('node-a', 'component-a')).toMatchObject({
            data: {migrated: true, old: true},
            schemaVersion: 2
        });
        expect(model.getImportStatus().error).toBeNull();
        manager.dispose();
    });
});
