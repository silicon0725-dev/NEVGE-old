import {createInspectorRegistry} from '../../../src/lib/project-inspector/inspector-registry';
import {
    NGVGE_DATA_KEY,
    createProjectPersistence,
    extractProjectData,
    injectProjectData
} from '../../../src/lib/project-inspector/project-persistence';

const createFixture = () => {
    const target = {
        id: 'sprite-id',
        isOriginal: true,
        isStage: false,
        value: 150
    };
    const runtime = {
        extensionManager: {
            getExtensionURLs: () => ({stretch: 'https://example.com/stretch.js'})
        },
        getTargetById: id => id === target.id ? target : null,
        targets: [target]
    };
    const vm = {
        deserializeProject: jest.fn(() => Promise.resolve('loaded')),
        emitTargetsUpdate: jest.fn(),
        runtime,
        toJSON: jest.fn(() => JSON.stringify({
            extensions: [],
            targets: [{isStage: false, name: 'Sprite1'}]
        }))
    };
    const registry = createInspectorRegistry();
    registry.register({
        id: 'stretch',
        extensionId: 'stretch',
        label: 'Stretch',
        getFields: () => [],
        setValue: () => {},
        serializeTarget: currentTarget => ({value: currentTarget.value}),
        deserializeTarget: (currentTarget, data) => {
            currentTarget.value = data.value;
        }
    });
    return {registry, runtime, target, vm};
};

describe('project inspector persistence', () => {
    test('injects target metadata and required extension URLs', () => {
        const {registry, target, vm} = createFixture();
        const projectJSON = JSON.parse(vm.toJSON());
        injectProjectData(projectJSON, vm, registry);

        expect(projectJSON.targets[0][NGVGE_DATA_KEY].sections.stretch).toEqual({value: 150});
        expect(projectJSON.extensions).toContain('stretch');
        expect(projectJSON.extensionURLs.stretch).toBe('https://example.com/stretch.js');
        expect(target.value).toBe(150);
    });

    test('migrates legacy target-derived Project Node ids across project sections before restore', () => {
        const serialized = {
            ngvge: {
                projectSections: {
                    'ngvge-node-tree': {
                        nodes: [{childIds: [], id: 'target-node:player-old', parentId: null}],
                        targetBindings: ['target-node:player-old'],
                        version: 3
                    },
                    'ngvge-reference-fixture': {ownerNodeId: 'target-node:player-old'}
                },
                version: 1
            },
            targets: []
        };

        const snapshot = extractProjectData(serialized);
        const sections = snapshot.projectData.projectSections;
        const migratedId = sections['ngvge-node-tree'].nodes[0].id;

        expect(migratedId).toMatch(/^ngvge:node:/);
        expect(sections['ngvge-node-tree'].targetBindings).toEqual([migratedId]);
        expect(sections['ngvge-reference-fixture'].ownerNodeId).toBe(migratedId);
        expect(JSON.stringify(snapshot.projectData)).not.toContain('target-node:player-old');
        expect(serialized.ngvge.projectSections['ngvge-node-tree'].nodes[0].id).toBe('target-node:player-old');
    });

    test('rejects invalid section DTO data instead of JSON-sanitizing it into project source', () => {
        const {registry, vm} = createFixture();
        registry.register({
            id: 'valid-persistent-dto',
            label: 'Valid Persistent DTO',
            getFields: () => [],
            setValue: () => {},
            serializeProject: () => ({kept: true})
        });
        registry.register({
            id: 'invalid-persistent-dto',
            label: 'Invalid Persistent DTO',
            getFields: () => [],
            setValue: () => {},
            serializeProject: () => ({kept: true, silentlyDroppedBefore: undefined})
        });

        const projectJSON = JSON.parse(vm.toJSON());
        injectProjectData(projectJSON, vm, registry);

        expect(projectJSON.ngvge.projectSections['valid-persistent-dto']).toEqual({kept: true});
        expect(projectJSON.ngvge.projectSections['invalid-persistent-dto']).toBeUndefined();
    });

    test('extracts and restores metadata after deserialization', async () => {
        const {registry, target, vm} = createFixture();
        createProjectPersistence(vm, registry);
        const serialized = JSON.parse(vm.toJSON());

        target.value = 100;
        const snapshot = extractProjectData(serialized);
        expect(snapshot.targetData[0].sections.stretch.value).toBe(150);

        await vm.deserializeProject(serialized, null);
        expect(target.value).toBe(150);
        expect(vm.emitTargetsUpdate).toHaveBeenCalledWith(false);
    });

    test('restores metadata after the complete project load lifecycle', async () => {
        const {registry, target, vm} = createFixture();
        vm.loadProject = jest.fn(async projectJSON => {
            await vm.deserializeProject(projectJSON, null);
            target.value = 25;
            return 'loaded';
        });
        createProjectPersistence(vm, registry);
        const serialized = JSON.parse(vm.toJSON());

        target.value = 100;
        await vm.loadProject(serialized);

        expect(target.value).toBe(150);
    });


    test('clears opt-in project sections when imported scene data omits them', async () => {
        const {registry, vm} = createFixture();
        const deserializeProject = jest.fn();
        registry.register({
            clearOnMissing: true,
            id: 'scene-local-node-tree',
            label: 'Scene local node tree',
            getFields: () => [],
            setValue: () => {},
            deserializeProject
        });
        createProjectPersistence(vm, registry);

        await vm.deserializeProject({targets: [{isStage: false, name: 'Sprite1'}]}, null);

        expect(deserializeProject).toHaveBeenCalledWith(
            null,
            expect.objectContaining({phase: 'deserialize'})
        );
    });

    test('passes the original SB3 archive to project deserializers', async () => {
        const {registry, vm} = createFixture();
        const archive = {file: jest.fn()};
        const deserializeProject = jest.fn();
        registry.register({
            id: 'archive-aware',
            label: 'Archive aware',
            getFields: () => [],
            setValue: () => {},
            serializeProject: () => ({enabled: true}),
            deserializeProject
        });
        createProjectPersistence(vm, registry);
        const serialized = JSON.parse(vm.toJSON());

        await vm.deserializeProject(serialized, archive);

        expect(deserializeProject).toHaveBeenCalledWith(
            {enabled: true},
            expect.objectContaining({archive})
        );
    });

});
