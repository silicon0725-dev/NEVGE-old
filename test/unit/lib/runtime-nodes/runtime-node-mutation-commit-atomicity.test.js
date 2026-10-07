const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    NODE_SCOPES,
    RuntimeNode,
    createRuntimeNodeModelHost
} = require('../../../../src/lib/runtime-nodes');

const clone = value => JSON.parse(JSON.stringify(value));

const createSceneDataModel = () => {
    let project = {
        activeSceneId: 'scene-a',
        extensionData: {},
        scenes: [{id: 'scene-a', name: 'Scene A'}]
    };
    let failWrites = false;
    const listeners = new Set();
    return {
        getProject: () => clone(project),
        service: {
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
        },
        setFailWrites: value => { failWrites = Boolean(value); }
    };
};

describe('Runtime Node single-command mutation commit', () => {
    test('rolls back Runtime state and withholds events when persistence fails', () => {
        const data = createSceneDataModel();
        const host = createRuntimeNodeModelHost(data.service);
        const model = host.publicCapability;
        expect(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'node-a',
            name: 'Before',
            sceneId: 'scene-a'
        }).applied).toBe(true);
        const before = model.getNodeSnapshot('node-a');
        const events = [];
        model.subscribe(event => events.push(event));
        data.setFailWrites(true);

        const result = model.patchNode('node-a', {name: 'After'}, {transactionId: 'tx-fail'});

        expect(result.applied).toBe(false);
        expect(result.persisted).toBe(false);
        expect(result.snapshot).toBeNull();
        expect(result.error.code).toBe('SYNTHETIC_PERSISTENCE_FAILURE');
        expect(model.getNodeSnapshot('node-a')).toEqual(before);
        expect(events).toHaveLength(0);
        host.dispose();
    });

    test('defers provider destroy hooks until Project Source commit', () => {
        const data = createSceneDataModel();
        const host = createRuntimeNodeModelHost(data.service);
        let destroyCount = 0;
        let retained = null;
        class TestNode extends RuntimeNode {
            constructor (options) {
                super(Object.assign({}, options, {
                    hooks: {
                        onDestroy: () => { destroyCount += 1; }
                    }
                }));
                retained = this;
            }
        }
        host.typeRegistrationCapability.registerNodeTypeDescriptor({
            allowedScopes: [NODE_SCOPES.SCENE],
            defaultScope: NODE_SCOPES.SCENE,
            label: 'Test Node',
            ownerModuleId: 'test.module',
            typeId: 'test.atomic-node',
            version: '1'
        });
        host.typeRegistrationCapability.bindNodeTypeProvider('test.atomic-node', {ctor: TestNode});
        expect(host.publicCapability.createNode('test.atomic-node', {
            id: 'node-a',
            sceneId: 'scene-a'
        }).applied).toBe(true);
        const original = retained;
        data.setFailWrites(true);

        const failed = host.publicCapability.destroyNode('node-a');

        expect(failed.applied).toBe(false);
        expect(destroyCount).toBe(0);
        expect(retained).toBe(original);
        expect(original.state).toBe('active');
        expect(host.publicCapability.getNodeSnapshot('node-a')).not.toBeNull();
        host.dispose();
    });


    test('persists sibling order and explicit detached parent state across restore', () => {
        const data = createSceneDataModel();
        let host = createRuntimeNodeModelHost(data.service);
        let model = host.publicCapability;
        expect(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'parent-a', sceneId: 'scene-a'
        }).applied).toBe(true);
        expect(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'child-a', parentId: 'parent-a', sceneId: 'scene-a'
        }).applied).toBe(true);
        expect(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'child-b', parentId: 'parent-a', sceneId: 'scene-a'
        }).applied).toBe(true);
        expect(model.reorderChild('child-b', 0)).toMatchObject({applied: true, persisted: true});
        expect(model.detachNode('child-a')).toMatchObject({applied: true, persisted: true});

        const stored = data.getProject().extensionData.runtimeNodeModel;
        expect(stored.nodes.find(node => node.id === 'child-a').parentId).toBeNull();
        expect(stored.nodes.filter(node => node.parentId === 'parent-a').map(node => node.id))
            .toEqual(['child-b']);
        host.dispose();

        host = createRuntimeNodeModelHost(data.service);
        model = host.publicCapability;
        expect(model.getNodeSnapshot('child-a').parentId).toBeNull();
        expect(model.getChildren('parent-a').map(node => node.id)).toEqual(['child-b']);
        host.dispose();
    });

    test('publishes committed observer events only after persistence', () => {
        const data = createSceneDataModel();
        const host = createRuntimeNodeModelHost(data.service);
        const model = host.publicCapability;
        expect(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'node-a',
            name: 'Before',
            sceneId: 'scene-a'
        }).applied).toBe(true);
        let persistedBeforeEvent = false;
        model.subscribe(event => {
            if (event.transactionId !== 'tx-success') return;
            const state = data.getProject().extensionData.runtimeNodeModel;
            persistedBeforeEvent = state.nodes.some(node => node.id === 'node-a' && node.name === 'After');
        });

        const result = model.patchNode('node-a', {name: 'After'}, {transactionId: 'tx-success'});

        expect(result.applied).toBe(true);
        expect(result.persisted).toBe(true);
        expect(persistedBeforeEvent).toBe(true);
        host.dispose();
    });
});
