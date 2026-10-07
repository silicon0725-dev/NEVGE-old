import {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    COMPONENT_LIFECYCLE_STATES,
    LIFECYCLE_ENTITY_KINDS,
    LIFECYCLE_PHASES,
    NODE_LIFECYCLE_STATES,
    RUNTIME_NODE_LIFECYCLE_CONTRACT,
    RuntimeNodeGraph,
    assertLifecycleTransition,
    assertPortableData
} from '../../../../src/lib/runtime-nodes';

const createGraph = () => new RuntimeNodeGraph({
    activeSceneId: 'scene-a',
    scenes: [
        {id: 'scene-a', name: 'Scene A'},
        {id: 'scene-b', name: 'Scene B'}
    ]
});

const getPhases = (events, predicate) => events.filter(predicate).map(event => event.phase);

describe('0008.9.2 Runtime Node Lifecycle Conformance', () => {
    test('uses canonical node and component creation states', () => {
        const graph = createGraph();
        const node = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'node',
            sceneId: 'scene-a'
        });
        const component = node.addComponent({id: 'component', typeId: 'test.component'});

        expect(node.state).toBe(NODE_LIFECYCLE_STATES.ACTIVE);
        expect(component.state).toBe(COMPONENT_LIFECYCLE_STATES.ACTIVE);
        expect(getPhases(graph.getLifecycleTrace(), event => (
            event.nodeId === node.id && event.entityKind === LIFECYCLE_ENTITY_KINDS.NODE
        ))).toEqual([
            LIFECYCLE_PHASES.CREATE,
            LIFECYCLE_PHASES.ATTACH,
            LIFECYCLE_PHASES.READY,
            LIFECYCLE_PHASES.ENABLE
        ]);
        expect(getPhases(graph.getLifecycleTrace(), event => event.componentId === component.id)).toEqual([
            LIFECYCLE_PHASES.CREATE,
            LIFECYCLE_PHASES.ATTACH,
            LIFECYCLE_PHASES.READY,
            LIFECYCLE_PHASES.ENABLE
        ]);
    });

    test('reparents without repeating ready or changing component ownership', () => {
        const graph = createGraph();
        const hooks = [];
        const parentA = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {sceneId: 'scene-a'});
        const parentB = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {sceneId: 'scene-a'});
        const child = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            hooks: {onReady: () => hooks.push('node-ready')},
            parentId: parentA.id
        });
        const component = child.addComponent({
            hooks: {
                onAttach: () => hooks.push('component-attach'),
                onDetach: () => hooks.push('component-detach'),
                onReady: () => hooks.push('component-ready')
            },
            typeId: 'test.component'
        });
        const grandchild = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {parentId: child.id});
        const marker = graph.getStatus().lifecycleSequence;

        graph.setParent(child.id, parentB.id);
        const reparent = graph.getLifecycleTrace().filter(event => event.sequence > marker);

        expect(getPhases(reparent, event => (
            event.nodeId === child.id && event.entityKind === LIFECYCLE_ENTITY_KINDS.NODE
        ))).toEqual([
            LIFECYCLE_PHASES.DISABLE,
            LIFECYCLE_PHASES.DETACH,
            LIFECYCLE_PHASES.ATTACH,
            LIFECYCLE_PHASES.ENABLE
        ]);
        expect(getPhases(reparent, event => event.componentId === component.id)).toEqual([
            LIFECYCLE_PHASES.DISABLE,
            LIFECYCLE_PHASES.ENABLE
        ]);
        expect(hooks.filter(value => value === 'node-ready')).toHaveLength(1);
        expect(hooks.filter(value => value === 'component-ready')).toHaveLength(1);
        expect(hooks.filter(value => value === 'component-attach')).toHaveLength(1);
        expect(hooks).not.toContain('component-detach');
        expect(component.ownerId).toBe(child.id);
        expect(reparent.find(event => (
            event.nodeId === grandchild.id && event.phase === LIFECYCLE_PHASES.DISABLE
        )).sequence).toBeLessThan(reparent.find(event => (
            event.nodeId === child.id && event.phase === LIFECYCLE_PHASES.DETACH
        )).sequence);
    });

    test('derives lifecycle for detached and inactive-scene nodes during attach and restore', () => {
        const graph = createGraph();
        const detached = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            attach: false,
            components: [{id: 'detached-component', typeId: 'test.detached'}],
            id: 'detached',
            sceneId: 'scene-a'
        });
        expect(detached.state).toBe(NODE_LIFECYCLE_STATES.CREATED);
        expect(detached.isReady()).toBe(false);
        expect(detached.getComponentById('detached-component').state).toBe(COMPONENT_LIFECYCLE_STATES.ATTACHED);

        graph.setParent(detached.id, graph.getSceneRoot('scene-a').id);
        expect(detached.state).toBe(NODE_LIFECYCLE_STATES.ACTIVE);
        expect(detached.getComponentById('detached-component').state).toBe(COMPONENT_LIFECYCLE_STATES.ACTIVE);

        const offline = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            components: [{id: 'offline-component', typeId: 'test.offline'}],
            id: 'offline',
            sceneId: 'scene-b'
        });
        expect(offline.state).toBe(NODE_LIFECYCLE_STATES.DISABLED);

        const state = graph.exportState();
        const record = state.nodes.find(item => item.id === offline.id);
        record.state = NODE_LIFECYCLE_STATES.ACTIVE;
        record.activeInHierarchy = true;
        record.components[0].state = COMPONENT_LIFECYCLE_STATES.ACTIVE;
        const restored = RuntimeNodeGraph.createFromState(state).graph;
        expect(restored.getNode(offline.id).state).toBe(NODE_LIFECYCLE_STATES.DISABLED);
        expect(restored.exportState().nodes.find(item => item.id === offline.id)).not.toHaveProperty('state');
    });

    test('destroys child-first and destroys components before their owner node', () => {
        const graph = createGraph();
        const parent = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {sceneId: 'scene-a'});
        const child = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {parentId: parent.id});
        const component = child.addComponent({typeId: 'test.component'});
        const marker = graph.getStatus().lifecycleSequence;

        graph.destroyNode(parent.id);
        const events = graph.getLifecycleTrace().filter(event => event.sequence > marker);
        const sequence = predicate => events.find(predicate).sequence;

        expect(sequence(event => event.phase === LIFECYCLE_PHASES.DESTROY &&
            event.entityKind === LIFECYCLE_ENTITY_KINDS.NODE && event.nodeId === child.id)).toBeLessThan(
            sequence(event => event.phase === LIFECYCLE_PHASES.DESTROY &&
                event.entityKind === LIFECYCLE_ENTITY_KINDS.NODE && event.nodeId === parent.id)
        );
        expect(sequence(event => event.phase === LIFECYCLE_PHASES.DESTROY &&
            event.componentId === component.id)).toBeLessThan(
            sequence(event => event.phase === LIFECYCLE_PHASES.DESTROY &&
                event.entityKind === LIFECYCLE_ENTITY_KINDS.NODE && event.nodeId === child.id)
        );
    });

    test('isolates hook and listener errors without leaving partial state', () => {
        const graph = createGraph();
        const events = [];
        graph.subscribe(() => {
            throw new Error('listener failed');
        });
        graph.subscribe(event => events.push(event));
        const node = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            hooks: {
                onAttach: () => { throw new Error('attach failed'); },
                onEnable: () => { throw new Error('enable failed'); }
            },
            sceneId: 'scene-a'
        });

        expect(node.state).toBe(NODE_LIFECYCLE_STATES.ACTIVE);
        expect(events.some(event => event.type === RUNTIME_NODE_LIFECYCLE_CONTRACT.hookErrorEventType)).toBe(true);
        events.filter(event => event.type === 'lifecycle' || event.type === 'lifecycle:error')
            .forEach(event => expect(() => assertPortableData(event)).not.toThrow());
        expect(graph.getStatus().lifecycleHookErrorCount).toBe(2);
        expect(graph.getStatus().listenerErrorCount).toBeGreaterThan(0);
    });

    test('bounds the local lifecycle trace to the latest 512 records', () => {
        const graph = createGraph();
        for (let index = 0; index < 140; index += 1) {
            const node = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
                id: `trace-${index}`,
                sceneId: 'scene-a'
            });
            node.addComponent({id: `component-${index}`, typeId: `test.trace.${index}`});
            graph.destroyNode(node.id);
        }
        const trace = graph.getLifecycleTrace();
        expect(trace).toHaveLength(512);
        expect(trace[trace.length - 1].sequence).toBe(graph.getStatus().lifecycleSequence);
        expect(trace[0].sequence).toBeGreaterThan(1);
    });

    test('rejects invalid state transitions and does not persist derived lifecycle state', () => {
        expect(() => assertLifecycleTransition(
            LIFECYCLE_ENTITY_KINDS.NODE,
            NODE_LIFECYCLE_STATES.DESTROYED,
            NODE_LIFECYCLE_STATES.ACTIVE
        )).toThrow(/invalid .* lifecycle transition/i);

        const graph = createGraph();
        const node = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'persistent-node',
            sceneId: 'scene-a'
        });
        const record = graph.exportState().nodes.find(item => item.id === node.id);
        expect(record).not.toHaveProperty('state');
        expect(record).not.toHaveProperty('activeInHierarchy');
        expect(record).not.toHaveProperty('ready');
    });
});
