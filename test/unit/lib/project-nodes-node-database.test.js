import {STABLE_ID_KINDS, formatStableIdentity, isStableIdentity} from '../../../src/core/identity';
import {getPropertyHistory} from '../../../src/lib/project-inspector/property-history';
import {
    DATABASE_VERSION,
    createNodeDatabase,
    installNodeDatabase
} from '../../../src/lib/project-nodes/node-database';
import {getNodeTypeRegistry} from '../../../src/lib/project-nodes/node-type-registry';

const createTarget = (id, name, isStage = false) => ({
    id,
    isOriginal: true,
    isStage,
    getName: () => name
});

const createVM = (targetIds = ['stage', 'player']) => {
    const listeners = {};
    const stage = createTarget(targetIds[0], 'Stage', true);
    const player = createTarget(targetIds[1], 'Player');
    const runtime = {
        targets: [stage, player],
        emitProjectChanged: jest.fn(),
        getTargetById: id => runtime.targets.find(target => target.id === id) || null,
        on: jest.fn((event, listener) => {
            listeners[event] = listener;
        })
    };
    const vm = {
        runtime,
        emitTargetsUpdate: jest.fn(),
        on: jest.fn((event, listener) => {
            listeners[event] = listener;
        })
    };
    return {listeners, player, runtime, stage, vm};
};

describe('NGVGE node database', () => {
    test('creates target-backed nodes and child nodes', () => {
        const {player, vm} = createVM();
        const database = installNodeDatabase(vm);
        const playerNode = database.getNodeForTarget(player.id);

        expect(isStableIdentity(playerNode.id, STABLE_ID_KINDS.NODE)).toBe(true);
        expect(playerNode.id).not.toContain(player.id);
        expect(playerNode.typeId).toBe('ngvge.sprite-target');

        const body = database.createNode('ngvge.physics-body2d', playerNode.id, {
            name: 'Player Body'
        });
        const collider = database.createNode('ngvge.collider2d', body.id, {
            name: 'Hitbox'
        });

        expect(database.getChildren(playerNode.id).map(node => node.id)).toEqual([body.id]);
        expect(database.getChildren(body.id).map(node => node.id)).toEqual([collider.id]);
        expect(database.getNearestTargetNode(collider.id).targetId).toBe(player.id);
    });


    test('duplicates a custom node and its subtree', () => {
        const {player, vm} = createVM();
        const database = installNodeDatabase(vm);
        const playerNode = database.getNodeForTarget(player.id);
        const body = database.createNode('ngvge.physics-body2d', playerNode.id, {
            name: 'Player Body'
        });
        const collider = database.createNode('ngvge.collider2d', body.id, {
            name: 'Hitbox'
        });

        const duplicate = database.duplicateNode(body.id);
        const duplicateChildren = database.getChildren(duplicate.id);

        expect(duplicate.name).toBe('Player Body Copy');
        expect(duplicate.parentId).toBe(playerNode.id);
        expect(duplicate.id).not.toBe(body.id);
        expect(duplicateChildren).toHaveLength(1);
        expect(duplicateChildren[0].name).toBe('Hitbox');
        expect(duplicateChildren[0].id).not.toBe(collider.id);
    });

    test('updates node metadata and supports shared Undo/Redo history', () => {
        const {player, runtime, vm} = createVM();
        const database = installNodeDatabase(vm);
        const history = getPropertyHistory(runtime);
        const playerNode = database.getNodeForTarget(player.id);
        const collider = database.createNode('ngvge.collider2d', playerNode.id);

        database.renameNode(collider.id, 'Damage Area');
        database.setNodeProperty(collider.id, 'radius', 32);

        expect(database.getNode(collider.id).name).toBe('Damage Area');
        expect(database.getNode(collider.id).properties.radius).toBe(32);

        history.undo();
        expect(database.getNode(collider.id).properties.radius).toBe(24);
        history.redo();
        expect(database.getNode(collider.id).properties.radius).toBe(32);
    });



    test('does not resync node topology for position-only Scratch target updates', () => {
        const {listeners, player, vm} = createVM();
        const database = installNodeDatabase(vm);
        const changes = [];
        database.subscribe(change => changes.push(change));
        const playerNodeBefore = database.getNodeForTarget(player.id);

        player.x = 150;
        player.y = -75;
        listeners.targetsUpdate();

        expect(changes).toHaveLength(0);
        expect(database.getNodeForTarget(player.id).id).toBe(playerNodeBefore.id);

        player.getName = () => 'Player Renamed';
        listeners.targetsUpdate();
        expect(changes).toHaveLength(1);
        expect(database.getNodeForTarget(player.id).name).toBe('Player Renamed');
    });

    test('removes a target-backed compatibility subtree when the Scratch target is deleted', () => {
        const {player, runtime, vm} = createVM();
        const database = installNodeDatabase(vm);
        const playerNode = database.getNodeForTarget(player.id);
        const body = database.createNode('ngvge.physics-body2d', playerNode.id, {
            name: 'Player Body'
        });
        const collider = database.createNode('ngvge.collider2d', body.id, {
            name: 'Hitbox'
        });

        runtime.targets = runtime.targets.filter(target => target.id !== player.id);
        database.syncTargets();

        expect(database.getNode(playerNode.id)).toBeNull();
        expect(database.getNode(body.id)).toBeNull();
        expect(database.getNode(collider.id)).toBeNull();
        expect(database.getChildren(null).map(node => node.id)).not.toContain(body.id);
    });

    test('serializes hierarchy and rebinds target nodes by target order', () => {
        const first = createVM(['stage-old', 'player-old']);
        const database = createNodeDatabase(first.vm);
        const playerNode = database.getNodeForTarget(first.player.id);
        const body = database.createNode('ngvge.physics-body2d', playerNode.id);
        const collider = database.createNode('ngvge.collider2d', body.id);
        const snapshot = database.serializeProject();

        expect(snapshot.version).toBe(DATABASE_VERSION);
        expect(snapshot.targetBindings).toEqual(expect.arrayContaining([playerNode.id]));
        expect(JSON.stringify(snapshot)).not.toContain('player-old');

        const second = createVM(['stage-new', 'player-new']);
        const restored = createNodeDatabase(second.vm);
        restored.deserializeProject(snapshot);

        const restoredPlayerNode = restored.getNodeForTarget(second.player.id);
        expect(restoredPlayerNode.id).toBe(playerNode.id);
        expect(restored.getChildren(restoredPlayerNode.id)[0].id).toBe(body.id);
        expect(restored.getChildren(body.id)[0].id).toBe(collider.id);
    });

    test('migrates legacy target-derived ids without losing hierarchy or target rebinding', () => {
        const second = createVM(['stage-new', 'player-new']);
        let nextId = 0;
        const restored = createNodeDatabase(second.vm, {
            nodeIdFactory: () => {
                nextId += 1;
                return formatStableIdentity(STABLE_ID_KINDS.NODE, `project-node-${String(nextId).padStart(8, '0')}`);
            }
        });
        const legacySnapshot = {
            editorState: {expandedNodeIds: ['target-node:player-old', 'node:body']},
            nodes: [
                {
                    childIds: [],
                    enabled: true,
                    id: 'target-node:stage-old',
                    name: 'Stage',
                    parentId: null,
                    properties: {},
                    typeId: 'ngvge.stage-target'
                },
                {
                    childIds: ['node:body'],
                    enabled: true,
                    id: 'target-node:player-old',
                    name: 'Player',
                    parentId: null,
                    properties: {},
                    typeId: 'ngvge.sprite-target'
                },
                {
                    childIds: [],
                    enabled: true,
                    id: 'node:body',
                    name: 'Body',
                    parentId: 'target-node:player-old',
                    properties: {},
                    typeId: 'ngvge.physics-body2d'
                }
            ],
            targetBindings: ['target-node:stage-old', 'target-node:player-old'],
            version: 3
        };

        restored.deserializeProject(legacySnapshot);

        const playerNode = restored.getNodeForTarget(second.player.id);
        expect(isStableIdentity(playerNode.id, STABLE_ID_KINDS.NODE)).toBe(true);
        expect(playerNode.id).not.toBe('target-node:player-old');
        expect(restored.getNode('node:body').parentId).toBe(playerNode.id);
        expect(restored.getChildren(playerNode.id).map(node => node.id)).toEqual(['node:body']);
        expect(restored.getExpandedNodeIds()).toEqual(expect.arrayContaining([playerNode.id, 'node:body']));

        const migratedSnapshot = restored.serializeProject();
        expect(JSON.stringify(migratedSnapshot)).not.toContain('target-node:');
        expect(JSON.stringify(migratedSnapshot)).not.toContain('player-old');
    });

    test('supports batch node mutations as one hierarchy operation', () => {
        const {player, vm} = createVM();
        const database = installNodeDatabase(vm);
        const playerNode = database.getNodeForTarget(player.id);
        const group = database.createNode('ngvge.node2d', playerNode.id, {name: 'Group'});
        const child = database.createNode('ngvge.node2d', group.id, {name: 'Child'});
        const sibling = database.createNode('ngvge.node2d', playerNode.id, {name: 'Sibling'});

        database.reparentNodes([sibling.id], group.id);
        expect(database.getNode(sibling.id).parentId).toBe(group.id);
        expect(database.canReparentNodes([group.id], child.id).ok).toBe(false);

        const duplicates = database.duplicateNodes([group.id, child.id]);
        expect(duplicates).toHaveLength(1);
        expect(database.getChildren(duplicates[0].id)).toHaveLength(2);

        database.setNodesEnabled([group.id], false);
        expect(database.getNode(group.id).enabled).toBe(false);
        expect(database.getNode(child.id).enabled).toBe(false);
        expect(database.getNode(sibling.id).enabled).toBe(false);

        database.deleteNodes([group.id, child.id]);
        expect(database.getNode(group.id)).toBeNull();
        expect(database.getNode(child.id)).toBeNull();
        expect(database.getNode(sibling.id)).toBeNull();
    });

    test('persists scene tree expanded state with the node database', () => {
        const first = createVM(['stage-old', 'player-old']);
        const database = createNodeDatabase(first.vm);
        const playerNode = database.getNodeForTarget(first.player.id);
        const body = database.createNode('ngvge.physics-body2d', playerNode.id);

        database.setNodeExpanded(playerNode.id, true);
        database.setNodeExpanded(body.id, true);
        const snapshot = database.serializeProject();

        expect(snapshot.editorState.expandedNodeIds).toEqual(expect.arrayContaining([playerNode.id, body.id]));

        const second = createVM(['stage-new', 'player-new']);
        const restored = createNodeDatabase(second.vm);
        restored.deserializeProject(snapshot);

        expect(restored.getExpandedNodeIds()).toEqual(expect.arrayContaining([playerNode.id, body.id]));
    });

    test('keeps deprecated collision compatibility types loadable but out of new-node menus', () => {
        const {runtime} = createVM();
        const registry = getNodeTypeRegistry(runtime);

        expect(registry.getType('ngvge.collider2d')).toMatchObject({
            creationHidden: true,
            deprecated: true,
            legacyCompatibilityOnly: true
        });
        expect(registry.getType('ngvge.physics-body2d')).toMatchObject({
            creationHidden: true,
            deprecated: true,
            legacyCompatibilityOnly: true
        });
        expect(registry.listTypes().some(nodeType => nodeType.id === 'ngvge.collider2d')).toBe(false);
        expect(registry.listTypes().some(nodeType => nodeType.id === 'ngvge.physics-body2d')).toBe(false);
        expect(registry.listTypes({includeDeprecatedCompatibility: true})
            .some(nodeType => nodeType.id === 'ngvge.collider2d')).toBe(true);
    });

    test('allows future plugins to register additional node types', () => {
        const {runtime} = createVM();
        const registry = getNodeTypeRegistry(runtime);

        registry.register({
            category: 'Plugin',
            defaults: {strength: 1},
            fields: [{id: 'strength', label: 'Strength', type: 'number'}],
            icon: 'P',
            id: 'plugin.example-node',
            label: 'Example Node',
            pluginId: 'plugin.example'
        });

        expect(registry.getType('plugin.example-node')).toMatchObject({
            label: 'Example Node',
            pluginId: 'plugin.example'
        });
        expect(registry.listTypes().some(nodeType => nodeType.id === 'plugin.example-node')).toBe(true);
    });
});
