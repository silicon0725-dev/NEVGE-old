import {
    NODE_SCOPES,
    RuntimeNode,
    RuntimeNodeGraph,
    createRuntimeComponentTypeRegistry,
    createRuntimeNodeModelHost,
    createRuntimeNodeRevisionToken,
    createRuntimeNodeTypeRegistry
} from '../../../../src/lib/runtime-nodes';

const clone = value => JSON.parse(JSON.stringify(value));
const createSceneDataModel = () => {
    let project = {
        activeSceneId: 'scene-a',
        extensionData: {},
        scenes: [{id: 'scene-a', name: 'Scene A'}]
    };
    const listeners = new Set();
    return {
        getProject: () => clone(project),
        getStatus: () => ({readOnly: false}),
        readProject: () => clone(project),
        subscribe: listener => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        writeProject: next => {
            project = clone(next);
            listeners.forEach(listener => listener({type: 'data'}));
        }
    };
};

describe('Runtime revision authority and canonical snapshot closure', () => {
    test('advances authoritative Registry revision before earlier observers capture', () => {
        const nodeTypes = createRuntimeNodeTypeRegistry();
        let snapshots = null;
        let captured = null;
        nodeTypes.subscribe(change => {
            if (change.typeId === 'test.early') {
                captured = snapshots.capture({includeHidden: true, kind: 'node-types'});
            }
        });
        const host = createRuntimeNodeModelHost(createSceneDataModel(), {typeRegistry: nodeTypes});
        snapshots = host.snapshotCapability;
        const before = snapshots.getRevision();
        host.typeRegistrationCapability.registerNodeTypeDescriptor({
            allowedScopes: [NODE_SCOPES.SCENE],
            defaultScope: NODE_SCOPES.SCENE,
            label: 'Early',
            ownerModuleId: 'test.owner',
            typeId: 'test.early',
            version: '1'
        }, {activate: false});
        host.typeRegistrationCapability.bindNodeTypeProvider('test.early', {ctor: RuntimeNode});

        expect(captured.snapshot.some(type => type.id === 'test.early')).toBe(true);
        expect(captured.revision).not.toEqual(before);
        expect(snapshots.isCurrent(captured.revision)).toBe(true);
        host.dispose();
    });

    test('uses Component Registry revision directly inside earlier observers', () => {
        const componentTypes = createRuntimeComponentTypeRegistry();
        let snapshots = null;
        let captured = null;
        componentTypes.subscribe(change => {
            if (change.typeId === 'test.component') captured = snapshots.capture({kind: 'graph'});
        });
        const host = createRuntimeNodeModelHost(createSceneDataModel(), {
            componentTypeRegistry: componentTypes
        });
        snapshots = host.snapshotCapability;
        const before = snapshots.getRevision();
        host.typeRegistrationCapability.registerComponentTypeDescriptor({
            cardinality: 'one',
            ownerModuleId: 'test.owner',
            schemaVersion: 1,
            typeId: 'test.component'
        });

        expect(captured.revision).not.toEqual(before);
        expect(snapshots.isCurrent(captured.revision)).toBe(true);
        host.dispose();
    });

    test('owns Node Registry binding and finalizes provider-internal lifecycle methods', () => {
        let capturedGraph = null;
        class CaptureNode extends RuntimeNode {
            _bindGraph (graph) {
                capturedGraph = graph;
                return super._bindGraph(graph);
            }
            _transition () {
                throw new Error('override must not execute');
            }
        }
        const registry = createRuntimeNodeTypeRegistry();
        registry.register({
            allowedScopes: [NODE_SCOPES.SCENE],
            ctor: CaptureNode,
            defaultScope: NODE_SCOPES.SCENE,
            id: 'test.capture',
            label: 'Capture',
            owner: 'test.owner'
        });
        const graph = new RuntimeNodeGraph({
            activeSceneId: 'scene-a',
            scenes: [{id: 'scene-a', name: 'Scene A'}],
            typeRegistry: registry
        });
        const node = graph.createNode('test.capture', {id: 'capture', sceneId: 'scene-a'});

        expect(capturedGraph).toBeNull();
        expect(node._graph).toBeUndefined();
        expect(node.components.graph).toBeUndefined();
        expect(node._bindGraph).toBe(RuntimeNode.prototype._bindGraph);
        expect(Object.getOwnPropertyDescriptor(node, '_bindGraph')).toMatchObject({
            configurable: false,
            writable: false
        });
        expect(() => { graph.typeRegistry = createRuntimeNodeTypeRegistry(); }).toThrow(
            expect.objectContaining({code: 'RUNTIME_NODE_TYPE_REGISTRY_REPLACEMENT_FORBIDDEN'})
        );

        const beforeScalar = graph.getStatus().revision;
        node.name = 'Retained Write';
        const afterScalar = graph.getStatus().revision;
        node.metadata.retained = true;
        const afterNested = graph.getStatus().revision;
        const component = node.addComponent({data: {value: 1}, id: 'retained', typeId: 'test.retained'});
        const beforeComponent = graph.getStatus().revision;
        component.data.value = 2;
        expect(afterScalar).toBeGreaterThan(beforeScalar);
        expect(afterNested).toBeGreaterThan(afterScalar);
        expect(graph.getStatus().revision).toBeGreaterThan(beforeComponent);
        graph.dispose();
    });

    test('uses locale-independent ordering and strict query validation', () => {
        const host = createRuntimeNodeModelHost(createSceneDataModel());
        const snapshots = host.snapshotCapability;
        const original = String.prototype.localeCompare;
        let calls = 0;
        String.prototype.localeCompare = function () {
            calls += 1;
            return -original.apply(this, arguments);
        };
        try {
            ['test.a', 'test.A', 'test.ä', 'test.z', 'test.中'].forEach(typeId => {
                host.typeRegistrationCapability.registerNodeTypeDescriptor({
                    allowedScopes: [NODE_SCOPES.SCENE],
                    defaultScope: NODE_SCOPES.SCENE,
                    label: typeId,
                    ownerModuleId: 'test.owner',
                    typeId,
                    version: '1'
                }, {activate: false});
                host.typeRegistrationCapability.bindNodeTypeProvider(typeId, {ctor: RuntimeNode});
            });
            const types = snapshots.capture({includeHidden: true, kind: 'node-types'}).snapshot
                .map(type => type.id)
                .filter(id => ['test.A', 'test.a', 'test.z', 'test.ä', 'test.中'].includes(id));
            expect(types).toEqual(['test.A', 'test.a', 'test.z', 'test.ä', 'test.中']);
            expect(calls).toBe(0);
        } finally {
            String.prototype.localeCompare = original;
            host.dispose();
        }

        const token = createRuntimeNodeRevisionToken({
            graphRevision: -0,
            registryRevision: -0,
            runtimeGeneration: 1
        });
        expect(Object.is(token.graphRevision, -0)).toBe(false);
        expect(Object.is(token.registryRevision, -0)).toBe(false);
    });
});
