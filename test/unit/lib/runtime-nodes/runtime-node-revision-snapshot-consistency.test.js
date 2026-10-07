import {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    RUNTIME_NODE_MODEL_CAPABILITY_ID,
    RUNTIME_NODE_SNAPSHOT_CAPABILITY_ID,
    RUNTIME_NODE_TYPE_REGISTRATION_CAPABILITY_ID,
    SCENE_DATA_MODEL_CAPABILITY_ID,
    SCENE_SYSTEM_MODULE_ID
} from '../../../../src/lib/scene-system';
import {
    RUNTIME_NODE_REVISION_CONTRACT_ID,
    RUNTIME_NODE_SNAPSHOT_CONTRACT_ID,
    RuntimeComponentTypeRegistry,
    RuntimeNode,
    RuntimeNodeGraph,
    RuntimeNodeTypeRegistry
} from '../../../../src/lib/runtime-nodes';
import {
    createModuleManager,
    registerBuiltInModules
} from '../../../../src/lib/first-party-modules';

const createEnabledManager = () => {
    const manager = createModuleManager();
    registerBuiltInModules(manager);
    manager.initializeAll();
    manager.enableDefaults({silent: true});
    manager.enableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});
    return manager;
};

describe('Runtime revision and snapshot consistency contract', () => {
    test('captures one deeply frozen canonical graph revision', () => {
        const manager = createEnabledManager();
        const sceneData = manager.getCapability(SCENE_DATA_MODEL_CAPABILITY_ID);
        const model = manager.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID);
        const snapshots = manager.getCapability(RUNTIME_NODE_SNAPSHOT_CAPABILITY_ID);
        const sceneId = sceneData.readProject().activeSceneId;

        model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'node-z',
            sceneId
        });
        model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'node-a',
            sceneId
        });

        const envelope = snapshots.capture({kind: 'graph'});

        expect(envelope.contractId).toBe(RUNTIME_NODE_SNAPSHOT_CONTRACT_ID);
        expect(envelope.revision.contractId).toBe(RUNTIME_NODE_REVISION_CONTRACT_ID);
        expect(envelope.snapshot.nodes.map(node => node.id)).toEqual(
            envelope.snapshot.nodes.map(node => node.id).slice().sort()
        );
        expect(Object.isFrozen(envelope)).toBe(true);
        expect(Object.isFrozen(envelope.revision)).toBe(true);
        expect(Object.isFrozen(envelope.snapshot)).toBe(true);
        expect(snapshots.isCurrent(envelope.revision)).toBe(true);
    });

    test('invalidates tokens after graph, registry and Runtime-generation changes', () => {
        const manager = createEnabledManager();
        const sceneData = manager.getCapability(SCENE_DATA_MODEL_CAPABILITY_ID);
        const model = manager.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID);
        const snapshots = manager.getCapability(RUNTIME_NODE_SNAPSHOT_CAPABILITY_ID);
        const registration = manager.getCapability(RUNTIME_NODE_TYPE_REGISTRATION_CAPABILITY_ID);
        const sceneId = sceneData.readProject().activeSceneId;

        const beforeGraph = snapshots.getRevision();
        model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {id: 'node-one', sceneId});
        expect(snapshots.isCurrent(beforeGraph)).toBe(false);

        const beforeRegistry = snapshots.getRevision();
        registration.registerNodeTypeDescriptor({
            allowedScopes: ['scene'],
            label: 'Snapshot Test',
            ownerModuleId: 'test.snapshot',
            typeId: 'test.snapshot-node',
            version: '1'
        });
        registration.bindNodeTypeProvider('test.snapshot-node', {ctor: RuntimeNode});
        const afterRegistry = snapshots.getRevision();
        expect(afterRegistry.graphRevision).toBe(beforeRegistry.graphRevision);
        expect(afterRegistry.registryRevision).toBeGreaterThan(beforeRegistry.registryRevision);

        const beforeImport = snapshots.getRevision();
        const nextProject = sceneData.readProject();
        const importedState = JSON.parse(JSON.stringify(model.exportState()));
        importedState.nodes = importedState.nodes.map(node => (
            node.id === 'node-one' ? Object.assign({}, node, {name: 'Imported Node'}) : node
        ));
        nextProject.extensionData = Object.assign({}, nextProject.extensionData, {
            runtimeNodeModel: importedState
        });
        sceneData.writeProject(nextProject);
        expect(model.getNodeSnapshot('node-one')).toMatchObject({name: 'Imported Node'});
        expect(snapshots.getRevision().runtimeGeneration).toBeGreaterThan(beforeImport.runtimeGeneration);
        expect(snapshots.isCurrent(beforeImport)).toBe(false);
    });

    test('keeps revision authority out of mutable instance fields', () => {
        const graph = new RuntimeNodeGraph({
            activeSceneId: 'scene-a',
            scenes: [{id: 'scene-a', name: 'Scene A'}]
        });
        const nodeTypes = new RuntimeNodeTypeRegistry();
        const componentTypes = new RuntimeComponentTypeRegistry();

        expect(nodeTypes._types).toBeUndefined();
        expect(componentTypes._descriptors).toBeUndefined();
        expect(componentTypes._usageResolvers).toBeUndefined();
        expect(Object.isSealed(nodeTypes)).toBe(true);
        expect(Object.isSealed(componentTypes)).toBe(true);

        const revision = graph.getStatus().revision;
        try {
            graph._revision = revision + 1000;
        } catch (error) {
            // Strict-mode assignment to the read-only compatibility projection may throw.
        }
        expect(graph.getStatus().revision).toBe(revision);
        graph.dispose();
    });
});
