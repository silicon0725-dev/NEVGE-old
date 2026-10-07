const {
    MODULE_AVAILABILITY,
    MODULE_KINDS,
    createModuleManager
} = require('../../../../src/lib/first-party-modules');
const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    RuntimeNodeGraph,
    createRuntimeComponentTypeRegistry
} = require('../../../../src/lib/runtime-nodes');

const scene = {id: 'scene-a', name: 'Scene A'};
const clone = value => JSON.parse(JSON.stringify(value));

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

const createMigrationSnapshot = () => ({
    activeSceneId: scene.id,
    nodes: [{
        components: [{
            allowMultiple: false,
            data: {legacy: true},
            enabled: true,
            extensionData: {},
            id: 'candidate-component',
            schemaVersion: 1,
            typeId: 'test.live-state'
        }],
        enabled: true,
        id: 'candidate-node',
        metadata: {},
        name: 'Candidate',
        parentId: null,
        sceneId: scene.id,
        scope: 'scene',
        source: {},
        typeId: BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE
    }],
    scenes: [scene],
    version: 1
});

describe('0008.9.4.1.1 Migration Live-State Isolation and Enable-Batch Recovery Closure', () => {
    test('captured live Node and Component fields cannot bypass migration isolation', () => {
        const registry = createRuntimeComponentTypeRegistry([{
            cardinality: 'one',
            ownerModuleId: 'test.live-state-owner',
            schemaVersion: 2,
            typeId: 'test.live-state'
        }]);
        const graph = new RuntimeNodeGraph({
            activeSceneId: scene.id,
            componentTypeRegistry: registry,
            scenes: [scene]
        });
        const node = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'victim',
            metadata: {nested: {safe: true}},
            name: 'Victim',
            sceneId: scene.id
        });
        const component = node.addComponent({
            data: {nested: {safe: true}, value: 1},
            id: 'victim-component',
            typeId: 'test.live-state'
        });
        const before = clone(graph.exportState());
        const errors = [];

        registry.bindMigration('test.live-state', 1, ({data}) => {
            [
                () => { node.name = 'MUTATED'; },
                () => { node.metadata.hacked = true; },
                () => { node.metadata.nested.safe = false; },
                () => { Object.getOwnPropertyDescriptor(node.metadata, 'nested').value.safe = false; },
                () => { node.childIds.push('forged'); },
                () => { component.data.value = 999; },
                () => { component.data.nested.safe = false; },
                () => { component.enabled = false; },
                () => { node._bindGraph(null); },
                () => { node._replaceGraphBinding(null); },
                () => { node.components._replaceGraphBinding(null); },
                () => { component._replaceGraphBinding(null); }
            ].forEach(attempt => {
                try {
                    attempt();
                } catch (error) {
                    errors.push(error.code);
                }
            });
            return {data: Object.assign({}, data, {migrated: true})};
        }, {ownerModuleId: 'test.live-state-owner'});

        expect(() => RuntimeNodeGraph.createFromState(createMigrationSnapshot(), {
            componentTypeRegistry: registry
        })).toThrow(expect.objectContaining({
            errors: expect.arrayContaining([
                expect.objectContaining({code: 'RUNTIME_COMPONENT_MIGRATION_REENTRANT_MUTATION'})
            ])
        }));
        expect(errors).toHaveLength(12);
        errors.forEach(code => expect(code).toBe('RUNTIME_COMPONENT_MIGRATION_REENTRANT_MUTATION'));
        expect(clone(graph.exportState())).toEqual(before);
        expect(node._graph).toBeUndefined();
        expect(node.components.graph).toBeUndefined();
        expect(component._graph).toBeUndefined();
        expect(() => node._replaceGraphBinding(null)).toThrow(expect.objectContaining({
            code: 'RUNTIME_NODE_INTERNAL_AUTHORITY_REQUIRED'
        }));
        expect(() => node.components._replaceGraphBinding(null)).toThrow(expect.objectContaining({
            code: 'RUNTIME_COMPONENT_INTERNAL_AUTHORITY_REQUIRED'
        }));
        expect(() => component._replaceGraphBinding(null)).toThrow(expect.objectContaining({
            code: 'RUNTIME_COMPONENT_INTERNAL_AUTHORITY_REQUIRED'
        }));
        expect(() => {
            node._graph = null;
        }).toThrow(TypeError);
        expect(() => {
            Object.defineProperty(node, 'toPersistentRecord', {value: () => ({id: 'forged'})});
        }).toThrow(TypeError);
        expect(() => {
            Object.defineProperty(node.components, 'toPersistentRecords', {value: () => []});
        }).toThrow(TypeError);
        graph.dispose();
    });

    test('dependent enable failure completes successful dependencies instead of stranding them', () => {
        const manager = createModuleManager();
        let completeCount = 0;
        manager.registerModule({
            manifest: createManifest('test.core'),
            hooks: {
                completeEnable: context => {
                    completeCount += 1;
                    context.capabilities.provide('test.runtime', {ready: true});
                },
                enable: context => context.capabilities.provide('test.registration', {ready: true})
            }
        });
        manager.registerModule({
            manifest: createManifest('test.bad', ['test.core']),
            hooks: {enable: () => { throw new Error('bad enable'); }}
        });

        expect(() => manager.enableModule('test.bad')).toThrow('bad enable');
        expect(manager.getModuleState('test.core')).toMatchObject({
            enableCompletion: 'completed',
            enabled: true,
            state: 'enabled'
        });
        expect(manager.getModuleState('test.bad')).toMatchObject({
            enableCompletion: 'failed',
            enabled: false,
            state: 'error'
        });
        expect(manager.getCapability('test.runtime')).toEqual({ready: true});
        expect(manager.enableModule('test.core')).toBe(true);
        expect(completeCount).toBe(1);
        manager.dispose();
    });

    test('completeEnable failure rolls back dependency chains and allows deterministic retry', () => {
        const manager = createModuleManager();
        let fail = true;
        let coreEnableCount = 0;
        let dependentEnableCount = 0;
        manager.registerModule({
            manifest: createManifest('test.core'),
            hooks: {
                completeEnable: context => {
                    if (fail) throw new Error('complete failure');
                    context.capabilities.provide('test.runtime', {ready: true});
                },
                enable: context => {
                    coreEnableCount += 1;
                    context.capabilities.provide('test.registration', {ready: true});
                }
            }
        });
        manager.registerModule({
            manifest: createManifest('test.dependent', ['test.core']),
            hooks: {enable: () => { dependentEnableCount += 1; }}
        });

        expect(() => manager.enableModule('test.dependent')).toThrow('complete failure');
        expect(manager.getModuleState('test.core')).toMatchObject({
            enableCompletion: 'failed',
            enabled: false,
            state: 'error'
        });
        expect(manager.getModuleState('test.dependent')).toMatchObject({
            enableCompletion: 'failed',
            enabled: false,
            state: 'error'
        });
        expect(manager.getCapability('test.registration')).toBeNull();

        fail = false;
        expect(manager.enableModule('test.dependent')).toBe(true);
        expect(manager.getModuleState('test.core')).toMatchObject({
            enableCompletion: 'completed',
            enabled: true,
            state: 'enabled'
        });
        expect(manager.getModuleState('test.dependent')).toMatchObject({
            enableCompletion: 'completed',
            enabled: true,
            state: 'enabled'
        });
        expect(manager.getCapability('test.runtime')).toEqual({ready: true});
        expect(coreEnableCount).toBe(2);
        expect(dependentEnableCount).toBe(2);
        manager.dispose();
    });
});
