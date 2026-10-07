import {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    NODE_LIFECYCLE_STATES,
    RuntimeNodeGraph,
    createRuntimeNodeModelHost
} from '../../../../src/lib/runtime-nodes';

const clone = value => JSON.parse(JSON.stringify(value));

const createGraph = () => new RuntimeNodeGraph({
    activeSceneId: 'scene-a',
    scenes: [{id: 'scene-a', name: 'Scene A'}]
});

const createSceneDataModel = () => {
    let project = {
        activeSceneId: 'scene-a',
        extensionData: {},
        scenes: [{id: 'scene-a', name: 'Scene A'}]
    };
    const listeners = new Set();
    return {
        getStatus: () => ({readOnly: false}),
        readProject: () => clone(project),
        subscribe: listener => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        writeProject: nextProject => {
            project = clone(nextProject);
            listeners.forEach(listener => listener({type: 'data'}));
        }
    };
};

describe('0008.9.2.2 Lifecycle Observation Boundary Closure', () => {
    test('passes detached, deep-frozen snapshots instead of live Runtime objects', () => {
        const graph = createGraph();
        let context = null;
        const node = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            hooks: {
                onDisable: hookContext => {
                    context = hookContext;
                    Reflect.set(hookContext.node, 'enabledSelf', true);
                    Reflect.set(hookContext.node, 'name', 'mutated');
                    Reflect.set(hookContext.node.metadata, 'hacked', true);
                }
            },
            id: 'readonly',
            metadata: {safe: true},
            name: 'Original',
            sceneId: 'scene-a'
        });

        graph.setNodeEnabled(node.id, false);
        expect(context).not.toBeNull();
        expect(context.graph).toBeUndefined();
        expect(Object.isFrozen(context.node)).toBe(true);
        expect(Object.isFrozen(context.node.metadata)).toBe(true);
        expect(context.node.setEnabled).toBeUndefined();
        expect(node.enabledSelf).toBe(false);
        expect(node.state).toBe(NODE_LIFECYCLE_STATES.DISABLED);
        expect(node.name).toBe('Original');
        expect(node.metadata).toEqual({safe: true});
        graph.dispose();
    });

    test('does not permit direct Component data writes through Hook context', () => {
        const graph = createGraph();
        const node = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'owner',
            sceneId: 'scene-a'
        });
        let context = null;
        const component = node.addComponent({
            data: {value: 1},
            hooks: {
                onDisable: hookContext => {
                    context = hookContext;
                    Reflect.set(hookContext.component.data, 'value', 999);
                }
            },
            id: 'component',
            typeId: 'test.component'
        });

        graph.setNodeEnabled(node.id, false);
        expect(Object.isFrozen(context.component)).toBe(true);
        expect(Object.isFrozen(context.component.data)).toBe(true);
        expect(context.component.patchData).toBeUndefined();
        expect(component.data).toEqual({value: 1});
        graph.dispose();
    });

    test('rejects synchronous public Observer mutation without interrupting lifecycle', () => {
        const host = createRuntimeNodeModelHost(createSceneDataModel());
        const model = host.publicCapability;
        let rejected = null;
        const events = [];
        model.subscribe(event => {
            if (event.type === 'lifecycle' && event.phase === 'attach' && event.nodeId === 'victim') {
                rejected = model.destroyNode(event.nodeId);
            }
        });
        model.subscribe(event => events.push(event));

        const created = model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'victim',
            sceneId: 'scene-a'
        });
        expect(created.applied).toBe(true);
        expect(rejected).toEqual(expect.objectContaining({applied: false, persisted: false}));
        expect(rejected.error.code).toBe('RUNTIME_LIFECYCLE_REENTRANT_MUTATION');
        expect(rejected.error.details).toEqual(expect.objectContaining({
            eventType: 'lifecycle',
            nodeId: 'victim',
            originKind: 'observer',
            phase: 'attach'
        }));
        expect(model.getNodeSnapshot('victim').state).toBe(NODE_LIFECYCLE_STATES.ACTIVE);
        expect(events.some(event => event.phase === 'ready' && event.nodeId === 'victim')).toBe(true);
        expect(events.some(event => event.phase === 'destroy' && event.nodeId === 'victim')).toBe(false);
        expect(model.getStatus().observerReentrantMutationCount).toBeGreaterThan(0);
        host.dispose();
    });

    test('releases Observer guard after callback completion', () => {
        const host = createRuntimeNodeModelHost(createSceneDataModel());
        const model = host.publicCapability;
        const unsubscribe = model.subscribe(() => {});
        expect(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'after-observer',
            sceneId: 'scene-a'
        }).applied).toBe(true);
        unsubscribe();
        expect(model.destroyNode('after-observer').applied).toBe(true);
        host.dispose();
    });
});
