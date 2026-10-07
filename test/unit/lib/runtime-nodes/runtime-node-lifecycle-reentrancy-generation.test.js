import {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    COMPONENT_LIFECYCLE_STATES,
    LIFECYCLE_ENTITY_KINDS,
    LIFECYCLE_PHASES,
    NODE_LIFECYCLE_STATES,
    NODE_SCOPES,
    RUNTIME_NODE_LIFECYCLE_CONTRACT,
    RuntimeNode,
    RuntimeNodeGraph,
    assertLifecycleTransition,
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

describe('0008.9.2.1 Runtime Lifecycle Reentrancy and Generation Closure', () => {
    test('rejects synchronous graph mutation from lifecycle hooks', () => {
        const graph = createGraph();
        const node = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            hooks: {
                onDisable: () => graph.setNodeEnabled('node', true)
            },
            id: 'node',
            sceneId: 'scene-a'
        });

        graph.setNodeEnabled(node.id, false);
        expect(node.enabledSelf).toBe(false);
        expect(node.state).toBe(NODE_LIFECYCLE_STATES.DISABLED);
        const trace = graph.getLifecycleTrace({nodeId: node.id});
        expect(trace.some(event => (
            event.type === 'lifecycle:error' &&
            event.code === 'RUNTIME_LIFECYCLE_REENTRANT_MUTATION'
        ))).toBe(true);
        expect(trace.filter(event => event.type === 'lifecycle').pop().phase).toBe(LIFECYCLE_PHASES.DISABLE);
    });

    test('does not permit self-destroy during attach', () => {
        const graph = createGraph();
        const node = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            hooks: {
                onAttach: () => graph.destroyNode('self-destroy')
            },
            id: 'self-destroy',
            sceneId: 'scene-a'
        });

        expect(graph.getNode(node.id)).toBe(node);
        expect(node.state).toBe(NODE_LIFECYCLE_STATES.ACTIVE);
        const phases = graph.getLifecycleTrace({nodeId: node.id})
            .filter(event => event.type === 'lifecycle')
            .map(event => event.phase);
        expect(phases).toEqual([
            LIFECYCLE_PHASES.CREATE,
            LIFECYCLE_PHASES.ATTACH,
            LIFECYCLE_PHASES.READY,
            LIFECYCLE_PHASES.ENABLE
        ]);
    });

    test('increments runtime generation after a successful import and preserves it after failure', () => {
        const graph = createGraph();
        const state = graph.exportState();
        const before = graph.getStatus();
        graph.importState(state);
        const after = graph.getStatus();

        expect(after.runtimeGeneration).toBe(before.runtimeGeneration + 1);
        expect(after.lifecycleSequence).toBe(1);
        expect(graph.getLifecycleTrace()).toEqual([
            expect.objectContaining({
                previousRuntimeGeneration: before.runtimeGeneration,
                runtimeGeneration: after.runtimeGeneration,
                sequence: 1,
                type: RUNTIME_NODE_LIFECYCLE_CONTRACT.replacementEventType
            })
        ]);

        expect(() => graph.importState({version: 999, scenes: [], nodes: []})).toThrow();
        expect(graph.getStatus().runtimeGeneration).toBe(after.runtimeGeneration);
        expect(graph.getStatus().lifecycleSequence).toBe(after.lifecycleSequence);
    });

    test('rejects a public Capability mutation captured by a local provider Hook', () => {
        const host = createRuntimeNodeModelHost(createSceneDataModel());
        const model = host.publicCapability;
        class ReentrantProviderNode extends RuntimeNode {
            constructor (options) {
                super(Object.assign({}, options, {
                    hooks: {
                        onAttach: () => model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
                            id: 'nested',
                            sceneId: 'scene-a'
                        })
                    }
                }));
            }
        }
        host.typeRegistrationCapability.registerNodeTypeDescriptor({
            allowedScopes: [NODE_SCOPES.SCENE],
            label: 'Provider',
            ownerModuleId: 'test',
            typeId: 'test.provider',
            version: '1'
        });
        host.typeRegistrationCapability.bindNodeTypeProvider('test.provider', {ctor: ReentrantProviderNode});
        const events = [];
        model.subscribe(event => events.push(event));

        expect(model.createNode('test.provider', {id: 'outer', sceneId: 'scene-a'}).applied).toBe(true);
        expect(model.getNodeSnapshot('nested')).toBeNull();
        expect(events.some(event => (
            event.type === 'lifecycle:error' && event.code === 'RUNTIME_LIFECYCLE_REENTRANT_MUTATION'
        ))).toBe(true);
        host.dispose();
    });


    test('shares the lifecycle mutation guard with shadow import graphs', () => {
        const host = createRuntimeNodeModelHost(createSceneDataModel());
        const model = host.publicCapability;
        let mutateDuringAttach = false;

        class ShadowImportProviderNode extends RuntimeNode {
            constructor (options) {
                super(Object.assign({}, options, {
                    hooks: {
                        onAttach: () => {
                            if (mutateDuringAttach) {
                                model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
                                    id: 'shadow-nested',
                                    sceneId: 'scene-a'
                                });
                            }
                        }
                    }
                }));
            }
        }

        host.typeRegistrationCapability.registerNodeTypeDescriptor({
            allowedScopes: [NODE_SCOPES.SCENE],
            label: 'Shadow provider',
            ownerModuleId: 'test',
            typeId: 'test.shadow-provider',
            version: '1'
        });
        host.typeRegistrationCapability.bindNodeTypeProvider('test.shadow-provider', {
            ctor: ShadowImportProviderNode
        });
        expect(model.createNode('test.shadow-provider', {
            id: 'shadow-source',
            sceneId: 'scene-a'
        }).applied).toBe(true);

        const state = model.exportState();
        const before = model.getStatus();
        mutateDuringAttach = true;
        expect(host.persistenceController.importState(state).applied).toBe(true);

        const after = model.getStatus();
        expect(model.getNodeSnapshot('shadow-nested')).toBeNull();
        expect(after.runtimeGeneration).toBe(before.runtimeGeneration + 1);
        expect(after.lifecycleHookErrorCount).toBeGreaterThan(before.lifecycleHookErrorCount);
        expect(after.lifecycleSequence).toBe(1);
        host.dispose();
    });

    test('counts public observer failures without interrupting other observers', () => {
        const host = createRuntimeNodeModelHost(createSceneDataModel());
        const model = host.publicCapability;
        const received = [];
        model.subscribe(() => {
            throw new Error('observer failed');
        });
        model.subscribe(event => received.push(event));

        model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {id: 'public-node', sceneId: 'scene-a'});
        const status = model.getStatus();
        expect(status.observerErrorCount).toBeGreaterThan(0);
        expect(status.listenerErrorCount).toBe(
            status.graphListenerErrorCount + status.observerErrorCount
        );
        expect(received.length).toBeGreaterThan(0);
        host.dispose();
    });

    test('treats same-state transition as a side-effect-free no-op', () => {
        const graph = createGraph();
        let hookCount = 0;
        const node = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            hooks: {onEnable: () => { hookCount += 1; }},
            id: 'same-state',
            sceneId: 'scene-a'
        });
        const component = node.addComponent({
            hooks: {onEnable: () => { hookCount += 1; }},
            id: 'component',
            typeId: 'test.component'
        });
        const before = graph.getStatus();
        const beforeHookCount = hookCount;

        expect(node._transition(NODE_LIFECYCLE_STATES.ACTIVE, LIFECYCLE_PHASES.ENABLE, 'onEnable')).toBe(false);
        expect(component._transition(
            COMPONENT_LIFECYCLE_STATES.ACTIVE,
            LIFECYCLE_PHASES.ENABLE,
            'onEnable',
            node,
            graph
        )).toBe(false);
        expect(hookCount).toBe(beforeHookCount);
        expect(graph.getStatus().lifecycleSequence).toBe(before.lifecycleSequence);

        const destroyedNode = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'destroyed-same-state',
            sceneId: 'scene-a'
        });
        const destroyedComponent = destroyedNode.addComponent({
            id: 'destroyed-component',
            typeId: 'test.destroyed-component'
        });
        graph.destroyNode(destroyedNode.id);
        const destroyedStatus = graph.getStatus();
        expect(destroyedNode._transition(
            NODE_LIFECYCLE_STATES.DESTROYED,
            LIFECYCLE_PHASES.DESTROY,
            'onDestroy'
        )).toBe(false);
        expect(destroyedComponent._transition(
            COMPONENT_LIFECYCLE_STATES.DESTROYED,
            LIFECYCLE_PHASES.DESTROY,
            'onDestroy',
            destroyedNode,
            graph
        )).toBe(false);
        expect(graph.getStatus().lifecycleSequence).toBe(destroyedStatus.lifecycleSequence);

        expect(() => assertLifecycleTransition(
            LIFECYCLE_ENTITY_KINDS.NODE,
            NODE_LIFECYCLE_STATES.ACTIVE,
            NODE_LIFECYCLE_STATES.ACTIVE
        )).toThrow(/invalid .* lifecycle transition/i);
    });

    test('distinguishes node detach from component ownership detach', () => {
        const graph = createGraph();
        const node = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {id: 'owner', sceneId: 'scene-a'});
        const component = node.addComponent({id: 'component', typeId: 'test.component'});
        const marker = graph.getStatus().lifecycleSequence;

        graph.detachNode(node.id);
        const events = graph.getLifecycleTrace().filter(event => event.sequence > marker);
        expect(node.state).toBe(NODE_LIFECYCLE_STATES.DETACHED);
        expect(component.state).toBe(COMPONENT_LIFECYCLE_STATES.DISABLED);
        expect(component.ownerId).toBe(node.id);
        expect(events.some(event => (
            event.componentId === component.id && event.phase === LIFECYCLE_PHASES.DETACH
        ))).toBe(false);
    });
});
