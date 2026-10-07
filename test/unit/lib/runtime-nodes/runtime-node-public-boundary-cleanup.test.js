import {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    NODE_SCOPES,
    RuntimeNode,
    assertPortableData,
    createRuntimeNodeModelHost,
    validatePortableData
} from '../../../../src/lib/runtime-nodes';

const clone = value => JSON.parse(JSON.stringify(value));

const createHarness = ({failWrites = false} = {}) => {
    let project = {
        activeSceneId: 'scene-a',
        extensionData: {},
        scenes: [{id: 'scene-a', name: 'Scene A'}]
    };
    const listeners = new Set();
    const sceneDataModel = {
        getStatus: () => ({}),
        readProject: () => clone(project),
        subscribe: listener => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        writeProject: nextProject => {
            if (failWrites) {
                const error = new Error('Synthetic persistence failure.');
                error.code = 'SYNTHETIC_PERSISTENCE_FAILURE';
                throw error;
            }
            project = clone(nextProject);
            listeners.forEach(listener => listener({type: 'data'}));
        }
    };
    return createRuntimeNodeModelHost(sceneDataModel);
};

const ownKeys = value => Reflect.ownKeys(value).map(key => String(key)).sort();

describe('0008.9.1.1 Runtime Node Public Boundary Cleanup', () => {
    test('matches the exact declared public surface and excludes host controllers', () => {
        const host = createHarness();
        const model = host.publicCapability;
        const contract = model.getApiContract();

        expect(ownKeys(model)).toEqual(contract.publicSurfaceKeys.slice().sort());
        expect(model).not.toHaveProperty('importState');
        expect(model).not.toHaveProperty('persistState');
        expect(model).not.toHaveProperty('synchronizeScenes');
        expect(model).not.toHaveProperty('registerNodeType');
        expect(model).not.toHaveProperty('traverse');
        expect(model).not.toHaveProperty('dispose');
        expect(contract.mutationResultContract.transactionSemantics).toBe('single-command-atomic');
        host.dispose();
    });

    test('marks every portable method as native-bridge suitable', () => {
        const host = createHarness();
        const descriptors = host.publicCapability.getApiContract().methodDescriptors
            .filter(descriptor => descriptor.portability === 'portable');

        descriptors.forEach(descriptor => {
            expect(descriptor).toMatchObject({
                acceptsCallback: false,
                argumentsSerializable: true,
                resultSerializable: true,
                returnsFunction: false
            });
        });
        host.dispose();
    });

    test('returns portable subtree query data instead of requiring callbacks', () => {
        const host = createHarness();
        const model = host.publicCapability;
        const parent = model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'parent',
            sceneId: 'scene-a'
        }).snapshot;
        const child = model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'child',
            parentId: parent.id
        }).snapshot;

        const result = model.querySubtree({
            includeRoot: true,
            maxDepth: null,
            order: 'pre',
            rootNodeId: parent.id
        });
        expect(result.nodes.map(entry => entry.node.id)).toEqual([parent.id, child.id]);
        expect(() => assertPortableData(result)).not.toThrow();
        expect(Object.isFrozen(result)).toBe(true);

        const rejected = model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            hooks: {onCreate: () => {}},
            id: 'non-portable',
            sceneId: 'scene-a'
        });
        expect(rejected).toMatchObject({applied: false, persisted: false, snapshot: null});
        expect(rejected.error.code).toBe('PORTABLE_DATA_VALIDATION_FAILED');
        expect(model.getNodeSnapshot('non-portable')).toBeNull();
        host.dispose();
    });

    test('separates portable descriptors from local provider bindings', () => {
        const host = createHarness();
        const registration = host.typeRegistrationCapability;
        const model = host.publicCapability;
        class TestNode extends RuntimeNode {}

        const descriptor = registration.registerNodeTypeDescriptor({
            allowedScopes: [NODE_SCOPES.SCENE],
            label: 'Test Node',
            ownerModuleId: 'test.module',
            schema: {properties: {}},
            typeId: 'test.node',
            version: '1'
        });
        expect(() => assertPortableData(descriptor)).not.toThrow();
        expect(model.getNodeType('test.node')).toBeNull();

        const unregister = registration.bindNodeTypeProvider('test.node', {ctor: TestNode});
        expect(typeof unregister).toBe('function');
        expect(model.getNodeType('test.node')).toMatchObject({id: 'test.node'});
        unregister();
        host.dispose();
    });

    test('rolls back mutations that cannot be persisted and distinguishes rejected mutations', () => {
        const host = createHarness({failWrites: true});
        const model = host.publicCapability;
        const applied = model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'unpersisted',
            sceneId: 'scene-a'
        });
        const rejected = model.patchNode('missing-node', {name: 'Nope'});

        expect(applied).toMatchObject({
            applied: false,
            persisted: false,
            snapshot: null
        });
        expect(model.getNodeSnapshot('unpersisted')).toBeNull();
        expect(rejected).toMatchObject({applied: false, persisted: false, snapshot: null});
        expect(() => assertPortableData(applied)).not.toThrow();
        expect(() => assertPortableData(rejected)).not.toThrow();
        host.dispose();
    });

    test('rejects non-portable objects', () => {
        const cyclic = {};
        cyclic.self = cyclic;
        [
            {fn: () => {}},
            {promise: Promise.resolve()},
            {map: new Map()},
            {set: new Set()},
            {number: Number.NaN},
            cyclic
        ].forEach(value => {
            const result = validatePortableData(value);
            expect(result.valid).toBe(false);
            expect(result.issues.every(issue => issue.code.startsWith('portable.'))).toBe(true);
        });
    });
});
