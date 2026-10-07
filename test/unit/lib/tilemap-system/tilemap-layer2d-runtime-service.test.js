'use strict';

const {EventEmitter} = require('events');
const {createCollider2DRuntimeService} = require('../../../../src/lib/collision-system');
const {
    createTileMapLayer2DRuntimeService,
    createTileSetResourceService
} = require('../../../../src/lib/tilemap-system');

const makeHarness = () => {
    const emitter = new EventEmitter();
    const transformEmitter = new EventEmitter();
    const descriptors = new Map();
    const tileSetResources = createTileSetResourceService({runtime: {emitProjectChanged: jest.fn()}});
    const tileSet = tileSetResources.createTileSet({
        name: 'Map',
        data: {tileSize: [32, 32]}
    });
    tileSetResources.setTileDefinition(tileSet.resourceId, 0, {
        atlas: [0, 0],
        collision: [{id: 'solid', offset: [0, 0], rotation: 0, shape: {type: 'rectangle', size: [32, 32]}}],
        navigation: {enabled: true}
    });
    const nodes = new Map([
        ['tilemap', {
            activeInHierarchy: true,
            components: [
                {activeInHierarchy: true, data: {position: [0, 0], rotation: 0, scale: [1, 1]}, enabled: true, id: 't-map', typeId: 'ngvge.transform2d'},
                {activeInHierarchy: true, data: {
                    tileSetResourceId: tileSet.resourceId,
                    chunks: [{chunkX: 0, chunkY: 0, cells: [{x: 0, y: 0, tileId: 0}]}]
                }, enabled: true, id: 'tm-map', typeId: 'ngvge.tilemap-layer2d'}
            ],
            id: 'tilemap', name: 'TileMapLayer2D', parentId: null, sceneId: 'scene-a'
        }],
        ['character', {
            activeInHierarchy: true,
            components: [
                {activeInHierarchy: true, data: {position: [0, 0], rotation: 0, scale: [1, 1]}, enabled: true, id: 't-char', typeId: 'ngvge.transform2d'},
                {activeInHierarchy: true, data: {collisionLayer: 1, collisionMask: 0xFFFFFFFF, offset: [0, 0], rotation: 0, sensor: false, shape: {type: 'rectangle', size: [10, 10]}}, enabled: true, id: 'c-char', typeId: 'ngvge.collider2d'}
            ],
            id: 'character', name: 'Character', parentId: null, sceneId: 'scene-a'
        }]
    ]);
    const runtimeNodeModel = {
        getNodeSnapshot: id => nodes.get(id) || null,
        listNodes: jest.fn(options => Array.from(nodes.values()).filter(node => !options || !options.sceneId || node.sceneId === options.sceneId)),
        setComponentData: jest.fn((nodeId, componentId, data) => {
            const node = nodes.get(nodeId);
            const component = node.components.find(item => item.id === componentId);
            component.data = data;
            emitter.emit('change', {componentId, componentTypeId: component.typeId, nodeId, type: 'component:data'});
            return component;
        }),
        subscribe: listener => { emitter.on('change', listener); return () => emitter.off('change', listener); }
    };
    const typeRegistration = {
        getComponentTypeDescriptor: id => descriptors.get(id) || null,
        registerComponentTypeDescriptor: descriptor => { descriptors.set(descriptor.typeId, descriptor); return descriptor; }
    };
    const transformRuntimeStore = {
        getRuntimeTransform: nodeId => {
            const node = nodes.get(nodeId);
            const component = node && node.components.find(item => item.typeId === 'ngvge.transform2d');
            return component ? component.data : null;
        },
        subscribe: listener => { transformEmitter.on('change', listener); return () => transformEmitter.off('change', listener); }
    };
    const sceneRuntime = {getActiveSceneId: () => 'scene-a', subscribe: () => () => {}};
    const colliderRuntime = createCollider2DRuntimeService({runtimeNodeModel, sceneRuntime, transformRuntimeStore, typeRegistration});
    const tileMapRuntime = createTileMapLayer2DRuntimeService({
        colliderRuntimeService: colliderRuntime,
        runtimeNodeModel,
        sceneRuntime,
        tileSetResources,
        transformRuntimeStore,
        typeRegistration
    });
    return {colliderRuntime, nodes, runtimeNodeModel, tileMapRuntime, tileSet, tileSetResources, transformEmitter};
};

describe('WS-10N7 TileMapLayer2D Runtime service', () => {
    test('maps sparse grid coordinates through Transform2D and projects Tile collision into the unified Collider runtime', () => {
        const {colliderRuntime, nodes, tileMapRuntime, transformEmitter} = makeHarness();
        expect(tileMapRuntime.worldPointToCell('tilemap', [0, 0])).toEqual([0, 0]);
        expect(tileMapRuntime.cellToWorld('tilemap', [2, -1])).toEqual([64, -32]);
        const projections = tileMapRuntime.listCollisionProjections();
        expect(projections).toHaveLength(1);
        expect(projections[0]).toMatchObject({nodeId: 'tilemap', sourceKind: 'tilemap'});
        expect(colliderRuntime.queryPoint([0, 0]).map(hit => hit.nodeId)).toContain('tilemap');
        expect(colliderRuntime.overlaps('character', 'tilemap')).toBe(true);

        nodes.get('character').components[0].data.position = [100, 0];
        transformEmitter.emit('change', {nodeId: 'character', type: 'runtime:replace'});
        expect(colliderRuntime.overlaps('character', 'tilemap')).toBe(false);
        tileMapRuntime.dispose();
        colliderRuntime.dispose();
    });

    test('persists cell edits as Sparse Chunks and keeps TileSet binding by ResourceId', () => {
        const {tileMapRuntime, tileSet} = makeHarness();
        tileMapRuntime.setCell('tilemap', -17, 33, {tileId: 0, flipY: true});
        const persistent = tileMapRuntime.getPersistentLayer('tilemap');
        expect(persistent.tileSetResourceId).toBe(tileSet.resourceId);
        expect(persistent.chunks).toEqual(expect.arrayContaining([
            expect.objectContaining({chunkX: -2, chunkY: 2})
        ]));
        expect(tileMapRuntime.getLayer('tilemap').cells).toEqual(expect.arrayContaining([
            expect.objectContaining({x: -17, y: 33, tileId: 0, flipY: true})
        ]));
        tileMapRuntime.dispose();
    });

    test('does not rebuild TileMap projections for unrelated dynamic-node Transform changes', () => {
        const {tileMapRuntime, transformEmitter} = makeHarness();
        const events = [];
        const unsubscribe = tileMapRuntime.subscribe(event => events.push(event));
        const before = tileMapRuntime.listCollisionProjections();
        transformEmitter.emit('change', {nodeId: 'character', type: 'runtime:patch'});
        expect(events.some(event => event.type === 'tilemap:transform-refresh')).toBe(false);
        expect(tileMapRuntime.listCollisionProjections()).toBe(before);
        transformEmitter.emit('change', {nodeId: 'tilemap', type: 'runtime:patch'});
        expect(events.some(event => event.type === 'tilemap:transform-refresh')).toBe(true);
        expect(tileMapRuntime.listCollisionProjections()).not.toBe(before);
        unsubscribe();
        tileMapRuntime.dispose();
    });

    test('queries Tile collision projections by viewport AABB without flattening distant sparse chunks', () => {
        const {tileMapRuntime} = makeHarness();
        tileMapRuntime.setCell('tilemap', 1000, 1000, {tileId: 0});
        const near = tileMapRuntime.queryCollisionProjectionsInAABB('scene-a', {
            minX: -64, maxX: 64, minY: -64, maxY: 64
        });
        expect(near).toHaveLength(1);
        expect(near[0].sourceKey).toBe('0,0:0');
        const far = tileMapRuntime.queryCollisionProjectionsInAABB('scene-a', {
            minX: 31900, maxX: 32100, minY: 31900, maxY: 32100
        });
        expect(far.some(projection => projection.sourceKey === '1000,1000:0')).toBe(true);
        tileMapRuntime.setCell('tilemap', 1, 0, {tileId: 0});
        const limited = tileMapRuntime.queryCollisionProjectionsInAABB('scene-a', {
            minX: -64, maxX: 96, minY: -64, maxY: 64
        }, {maxResults: 1});
        expect(limited).toHaveLength(1);
        tileMapRuntime.dispose();
    });

    test('caches TileMap Transform dependency membership so unrelated physics motion is O(1)', () => {
        const {colliderRuntime, runtimeNodeModel, tileMapRuntime, transformEmitter} = makeHarness();
        // Isolate the TileMap listener from the Collider runtime's own Transform subscription.
        colliderRuntime.dispose();
        // Warm the dependency set once.
        transformEmitter.emit('change', {nodeId: 'character', type: 'runtime:patch'});
        runtimeNodeModel.listNodes.mockClear();
        for (let index = 0; index < 60; index++) {
            transformEmitter.emit('change', {nodeId: 'character', type: 'runtime:patch'});
        }
        expect(runtimeNodeModel.listNodes).not.toHaveBeenCalled();
        tileMapRuntime.dispose();
    });

    test('reuses frozen viewport collision projections across repeated queries and unrelated dynamic motion', () => {
        const {tileMapRuntime, transformEmitter} = makeHarness();
        const viewport = {minX: -64, maxX: 64, minY: -64, maxY: 64};
        const first = tileMapRuntime.queryCollisionProjectionsInAABB('scene-a', viewport);
        const second = tileMapRuntime.queryCollisionProjectionsInAABB('scene-a', viewport);
        expect(second).toBe(first);
        expect(second[0]).toBe(first[0]);
        expect(Object.isFrozen(second)).toBe(true);
        expect(Object.isFrozen(second[0])).toBe(true);

        transformEmitter.emit('change', {nodeId: 'character', type: 'runtime:patch'});
        const afterDynamicMotion = tileMapRuntime.queryCollisionProjectionsInAABB('scene-a', viewport);
        expect(afterDynamicMotion).toBe(first);
        tileMapRuntime.dispose();
    });

    test('invalidates viewport collision projection reuse when TileSet collision geometry changes', () => {
        const {tileMapRuntime, tileSet, tileSetResources} = makeHarness();
        const viewport = {minX: -64, maxX: 64, minY: -64, maxY: 64};
        const first = tileMapRuntime.queryCollisionProjectionsInAABB('scene-a', viewport);
        const firstWidth = first[0].worldAABB.maxX - first[0].worldAABB.minX;
        tileSetResources.setTileDefinition(tileSet.resourceId, 0, {
            atlas: [0, 0],
            collision: [{id: 'solid', offset: [0, 0], rotation: 0, shape: {type: 'rectangle', size: [16, 32]}}]
        });
        const next = tileMapRuntime.queryCollisionProjectionsInAABB('scene-a', viewport);
        expect(next).not.toBe(first);
        expect(next[0]).not.toBe(first[0]);
        expect(next[0].worldAABB.maxX - next[0].worldAABB.minX).toBeLessThan(firstWidth);
        tileMapRuntime.dispose();
    });

});
