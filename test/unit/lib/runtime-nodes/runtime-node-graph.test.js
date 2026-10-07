import {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    GLOBAL_ROOT_NODE_ID,
    NODE_SCOPES,
    RuntimeNode,
    RuntimeNodeGraph,
    createRuntimeNodeTypeRegistry,
    getSceneRootNodeId
} from '../../../../src/lib/runtime-nodes';

const createGraph = () => new RuntimeNodeGraph({
    activeSceneId: 'scene-a',
    idFactory: (() => {
        let index = 0;
        return () => `node-${++index}`;
    })(),
    scenes: [
        {id: 'scene-a', name: 'Scene A'},
        {id: 'scene-b', name: 'Scene B'}
    ]
});

describe('RuntimeNodeGraph', () => {
    test('creates protected global and scene roots with separate ownership', () => {
        const graph = createGraph();
        const globalRoot = graph.getGlobalRoot();
        const sceneARoot = graph.getSceneRoot('scene-a');
        const sceneBRoot = graph.getSceneRoot('scene-b');

        expect(globalRoot.id).toBe(GLOBAL_ROOT_NODE_ID);
        expect(globalRoot.scope).toBe(NODE_SCOPES.GLOBAL);
        expect(sceneARoot.id).toBe(getSceneRootNodeId('scene-a'));
        expect(sceneARoot.scope).toBe(NODE_SCOPES.SCENE);
        expect(sceneARoot.sceneId).toBe('scene-a');
        expect(sceneARoot.activeInHierarchy).toBe(true);
        expect(sceneBRoot.activeInHierarchy).toBe(false);
        expect(() => graph.destroyNode(sceneARoot.id)).toThrow(/protected/i);
    });

    test('creates Node2D and ServiceNode instances with component lifecycle', () => {
        const graph = createGraph();
        const lifecycle = [];
        const player = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE_2D, {
            name: 'Player',
            sceneId: 'scene-a'
        });
        const manager = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.SERVICE_NODE, {
            name: 'GameManager',
            scope: NODE_SCOPES.GLOBAL
        });
        const component = player.addComponent({
            data: {speed: 5},
            hooks: {
                onAttach: () => lifecycle.push('attach'),
                onEnable: () => lifecycle.push('enable'),
                onReady: () => lifecycle.push('ready')
            },
            typeId: 'example.movement'
        });

        expect(player.parentId).toBe(getSceneRootNodeId('scene-a'));
        expect(player.activeInHierarchy).toBe(true);
        expect(manager.parentId).toBe(GLOBAL_ROOT_NODE_ID);
        expect(manager.activeInHierarchy).toBe(true);
        expect(component.data.speed).toBe(5);
        expect(lifecycle).toEqual(['attach', 'ready', 'enable']);

        graph.setNodeEnabled(player.id, false);
        expect(player.activeInHierarchy).toBe(false);
        graph.setNodeEnabled(player.id, true);
        expect(player.activeInHierarchy).toBe(true);
    });

    test('rejects cross-scope, cross-scene and cyclic parenting', () => {
        const graph = createGraph();
        const sceneAParent = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            sceneId: 'scene-a'
        });
        const sceneAChild = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            parentId: sceneAParent.id
        });
        const sceneBNode = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            sceneId: 'scene-b'
        });
        const globalNode = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            scope: NODE_SCOPES.GLOBAL
        });

        expect(() => graph.setParent(sceneAChild.id, sceneBNode.id)).toThrow(/different scenes/i);
        expect(() => graph.setParent(sceneAChild.id, globalNode.id)).toThrow(/across scopes/i);
        expect(() => graph.setParent(sceneAParent.id, sceneAChild.id)).toThrow(/cycle/i);
    });

    test('destroys a subtree without affecting another scene or global nodes', () => {
        const graph = createGraph();
        const parent = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            sceneId: 'scene-a'
        });
        const child = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            parentId: parent.id
        });
        const otherSceneNode = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            sceneId: 'scene-b'
        });
        const globalNode = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.SERVICE_NODE, {
            scope: NODE_SCOPES.GLOBAL
        });

        expect(graph.destroyNode(parent.id)).toBe(true);
        expect(graph.getNode(parent.id)).toBeNull();
        expect(graph.getNode(child.id)).toBeNull();
        expect(graph.getNode(otherSceneNode.id)).not.toBeNull();
        expect(graph.getNode(globalNode.id)).not.toBeNull();
    });

    test('exports, imports and resolves scoped node references', () => {
        const graph = createGraph();
        const parent = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'parent',
            sceneId: 'scene-a'
        });
        const child = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE_2D, {
            id: 'child',
            parentId: parent.id,
            source: {kind: 'test'}
        });
        child.addComponent({data: {value: 3}, typeId: 'example.data'});
        const reference = graph.createReference(child.id);
        const snapshot = graph.exportState();

        const restored = new RuntimeNodeGraph({scenes: []});
        restored.importState(snapshot);

        expect(restored.getNode('child').parentId).toBe('parent');
        expect(restored.getNode('child').getComponent('example.data').data.value).toBe(3);
        expect(restored.resolveReference(reference).id).toBe('child');
        expect(restored.resolveReference({...reference, sceneId: 'scene-b'})).toBeNull();
    });
    test('renames, duplicates and validates native node reparenting', () => {
        const graph = createGraph();
        const parent = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE_2D, {
            name: 'Player',
            sceneId: 'scene-a'
        });
        const child = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            name: 'Logic',
            parentId: parent.id
        });
        child.addComponent({data: {speed: 4}, typeId: 'example.logic'});

        const secondPlayer = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE_2D, {
            name: 'Player',
            sceneId: 'scene-a'
        });
        expect(secondPlayer.name).toBe('Player 2');
        expect(graph.renameNode(secondPlayer.id, 'Player').name).toBe('Player 2');

        const duplicate = graph.duplicateNode(parent.id);
        expect(duplicate.name).toBe('Player Copy');
        expect(graph.getChildren(duplicate.id)).toHaveLength(1);
        expect(graph.getChildren(duplicate.id)[0].getComponent('example.logic').data.speed).toBe(4);

        const sceneBRoot = graph.getSceneRoot('scene-b');
        expect(graph.canSetParent(duplicate.id, sceneBRoot.id)).toMatchObject({ok: false});
        expect(graph.canSetParent(duplicate.id, graph.getSceneRoot('scene-a').id)).toMatchObject({ok: true});
    });

    test('fires ready once, detaches before reparenting and uses reorder without attachment hooks', () => {
        const graph = createGraph();
        const lifecycle = [];
        const parentA = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            name: 'Parent A',
            sceneId: 'scene-a'
        });
        const parentB = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            name: 'Parent B',
            sceneId: 'scene-a'
        });
        const child = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            hooks: {
                onAttach: () => lifecycle.push('node:attach'),
                onDetach: () => lifecycle.push('node:detach'),
                onReady: () => lifecycle.push('node:ready'),
                onReorder: () => lifecycle.push('node:reorder')
            },
            parentId: parentA.id
        });
        const component = child.addComponent({
            hooks: {
                onAttach: () => lifecycle.push('component:attach'),
                onDetach: () => lifecycle.push('component:detach'),
                onReady: () => lifecycle.push('component:ready')
            },
            typeId: 'example.lifecycle'
        });

        graph.setParent(child.id, parentB.id);

        expect(lifecycle.filter(event => event === 'node:ready')).toHaveLength(1);
        expect(lifecycle.filter(event => event === 'component:ready')).toHaveLength(1);
        expect(lifecycle.filter(event => event === 'node:detach')).toHaveLength(1);
        expect(lifecycle.filter(event => event === 'node:attach')).toHaveLength(2);
        expect(lifecycle).not.toContain('component:detach');
        expect(component.ownerId).toBe(child.id);

        graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {parentId: parentB.id});
        graph.setParent(child.id, parentB.id, {index: 1});

        expect(lifecycle.filter(event => event === 'node:reorder')).toHaveLength(1);
        expect(lifecycle.filter(event => event === 'node:ready')).toHaveLength(1);
        expect(lifecycle.filter(event => event === 'node:detach')).toHaveLength(1);
        expect(lifecycle.filter(event => event === 'node:attach')).toHaveLength(2);
    });

    test('mutates node and component data through graph mutation methods', () => {
        const graph = createGraph();
        const node = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            metadata: {category: 'old'},
            sceneId: 'scene-a'
        });
        const component = graph.addComponent(node.id, {
            data: {speed: 1},
            typeId: 'example.logic'
        });

        graph.patchNode(node.id, {enabled: false, name: 'Player'});
        graph.patchNodeMetadata(node.id, {category: 'actor'});
        graph.patchComponentData(node.id, component.id, {speed: 10});
        graph.setComponentEnabled(node.id, component.id, false);

        expect(graph.getNode(node.id)).toMatchObject({
            enabledSelf: false,
            metadata: {category: 'actor'},
            name: 'Player'
        });
        expect(graph.getNode(node.id).getComponentById(component.id)).toMatchObject({
            data: {speed: 10},
            enabled: false
        });
    });

    test('keeps the current graph untouched when transactional import validation fails', () => {
        const graph = createGraph();
        const existing = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'existing',
            name: 'Existing',
            sceneId: 'scene-a'
        });
        const invalid = {
            activeSceneId: 'scene-a',
            nodes: [
                {
                    components: [],
                    id: 'cycle-a',
                    parentId: 'cycle-b',
                    sceneId: 'scene-a',
                    scope: NODE_SCOPES.SCENE,
                    typeId: BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE
                },
                {
                    components: [],
                    id: 'cycle-b',
                    parentId: 'cycle-a',
                    sceneId: 'scene-a',
                    scope: NODE_SCOPES.SCENE,
                    typeId: BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE
                }
            ],
            scenes: [{id: 'scene-a', name: 'Scene A'}],
            version: 1
        };

        expect(() => graph.importState(invalid)).toThrow(/validation failed/i);
        expect(graph.getNode(existing.id)).toBe(existing);
        expect(graph.getNode('cycle-a')).toBeNull();
    });

    test('keeps the current graph untouched when a registered node constructor throws', () => {
        class ThrowingNode extends RuntimeNode {
            constructor (options) {
                super(options);
                throw new Error('constructor failed');
            }
        }
        const registry = createRuntimeNodeTypeRegistry();
        registry.register({
            allowedScopes: [NODE_SCOPES.SCENE],
            ctor: ThrowingNode,
            defaultScope: NODE_SCOPES.SCENE,
            id: 'test.throwing-node',
            label: 'Throwing Node'
        });
        const graph = new RuntimeNodeGraph({
            activeSceneId: 'scene-a',
            scenes: [{id: 'scene-a', name: 'Scene A'}],
            typeRegistry: registry
        });
        const existing = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'existing',
            sceneId: 'scene-a'
        });

        expect(() => graph.importState({
            activeSceneId: 'scene-a',
            nodes: [{
                components: [],
                id: 'broken',
                parentId: getSceneRootNodeId('scene-a'),
                sceneId: 'scene-a',
                scope: NODE_SCOPES.SCENE,
                typeId: 'test.throwing-node'
            }],
            scenes: [{id: 'scene-a', name: 'Scene A'}],
            version: 1
        })).toThrow(/constructor failed/i);
        expect(graph.getNode(existing.id)).toBe(existing);
    });

    test('imports missing node types as opaque placeholders and preserves their payload', () => {
        const graph = createGraph();
        const result = graph.importState({
            activeSceneId: 'scene-a',
            nodes: [{
                components: [{
                    data: {speed: 8},
                    id: 'movement',
                    typeId: 'missing.movement'
                }],
                customPayload: {difficulty: 'hard'},
                enabled: true,
                id: 'missing-enemy',
                metadata: {tag: 'enemy'},
                name: 'Enemy',
                parentId: getSceneRootNodeId('scene-a'),
                sceneId: 'scene-a',
                scope: NODE_SCOPES.SCENE,
                source: {},
                typeId: 'third-party.enemy-node'
            }],
            scenes: [{id: 'scene-a', name: 'Scene A'}],
            version: 1
        });
        const placeholder = graph.getNode('missing-enemy');

        expect(result).toMatchObject({missingNodeCount: 1, success: true});
        expect(placeholder).toMatchObject({
            originalTypeId: 'third-party.enemy-node',
            typeId: BUILTIN_RUNTIME_NODE_TYPE_IDS.UNKNOWN_NODE
        });
        expect(placeholder.getComponentById('movement').data.speed).toBe(8);
        expect(graph.exportState().nodes[0]).toMatchObject({
            customPayload: {difficulty: 'hard'},
            typeId: 'third-party.enemy-node'
        });

        const duplicate = graph.duplicateNode(placeholder.id);
        expect(duplicate.originalTypeId).toBe('third-party.enemy-node');
        expect(graph.exportState().nodes.find(node => node.id === duplicate.id).typeId)
            .toBe('third-party.enemy-node');
    });


    test('rejects invalid component data without replacing the active graph', () => {
        const graph = createGraph();
        const existing = graph.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
            id: 'existing-component-test',
            sceneId: 'scene-a'
        });

        expect(() => graph.importState({
            activeSceneId: 'scene-a',
            nodes: [{
                components: [{
                    data: 10,
                    id: 'invalid-component',
                    typeId: 'example.invalid'
                }],
                id: 'invalid-node',
                parentId: getSceneRootNodeId('scene-a'),
                sceneId: 'scene-a',
                scope: NODE_SCOPES.SCENE,
                typeId: BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE
            }],
            scenes: [{id: 'scene-a', name: 'Scene A'}],
            version: 1
        })).toThrow(/validation failed/i);
        expect(graph.getNode(existing.id)).toBe(existing);
    });

});
