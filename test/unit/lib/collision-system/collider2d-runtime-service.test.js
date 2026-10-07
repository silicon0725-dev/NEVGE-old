'use strict';

const {EventEmitter} = require('events');
const {
    COLLIDER2D_RUNTIME_CAPABILITY_ID,
    createCollider2DRuntimeService,
    transformColliderPoints
} = require('../../../../src/lib/collision-system');

const makeNode = (id, position, options = {}) => ({
    activeInHierarchy: true,
    components: [
        {
            activeInHierarchy: true,
            data: {position, rotation: options.rotation || 0, scale: options.scale || [1, 1]},
            enabled: true,
            id: `transform:${id}`,
            schemaVersion: 1,
            typeId: 'ngvge.transform2d'
        },
        {
            activeInHierarchy: true,
            data: Object.assign({
                collisionLayer: 1,
                collisionMask: 1,
                offset: [0, 0],
                rotation: 0,
                sensor: options.sensor !== false,
                shape: options.shape || {type: 'rectangle', size: [20, 20]},
                transformInheritance: 'inherit-node'
            }, options.collider || {}),
            enabled: true,
            id: `collider:${id}`,
            schemaVersion: 1,
            typeId: 'ngvge.collider2d'
        }
    ],
    enabled: true,
    id,
    name: id,
    parentId: options.parentId || null,
    sceneId: 'scene-a'
});


const makeTransformNode = (id, position, options = {}) => ({
    activeInHierarchy: true,
    components: [{
        activeInHierarchy: true,
        data: {position, rotation: options.rotation || 0, scale: options.scale || [1, 1]},
        enabled: true,
        id: `transform:${id}`,
        schemaVersion: 1,
        typeId: 'ngvge.transform2d'
    }],
    enabled: true,
    id,
    name: id,
    parentId: options.parentId || null,
    sceneId: 'scene-a'
});

const makeHarness = () => {
    const emitter = new EventEmitter();
    const transformEmitter = new EventEmitter();
    const nodes = new Map([
        ['area-a', makeNode('area-a', [0, 0])],
        ['area-b', makeNode('area-b', [10, 0])],
        ['area-c', makeNode('area-c', [100, 0])]
    ]);
    const descriptors = new Map();
    const runtimeNodeModel = {
        getNodeSnapshot: jest.fn(id => nodes.get(id) || null),
        listNodes: jest.fn(options => Array.from(nodes.values()).filter(node => !options || !options.sceneId || node.sceneId === options.sceneId)),
        setComponentData: jest.fn((nodeId, componentId, data) => {
            const node = nodes.get(nodeId);
            const component = node.components.find(item => item.id === componentId);
            component.data = data;
            emitter.emit('change', {componentId, componentTypeId: component.typeId, nodeId, type: 'component:data'});
            return component;
        }),
        subscribe: listener => {
            emitter.on('change', listener);
            return () => emitter.off('change', listener);
        }
    };
    const typeRegistration = {
        getComponentTypeDescriptor: id => descriptors.get(id) || null,
        registerComponentTypeDescriptor: descriptor => {
            descriptors.set(descriptor.typeId, descriptor);
            return descriptor;
        }
    };
    const transformRuntimeStore = {
        getRuntimeTransform: jest.fn(nodeId => {
            const node = nodes.get(nodeId);
            const component = node && node.components.find(item => item.typeId === 'ngvge.transform2d');
            return component ? component.data : null;
        }),
        subscribe: listener => {
            transformEmitter.on('change', listener);
            return () => transformEmitter.off('change', listener);
        }
    };
    const sceneRuntime = {
        getActiveSceneId: () => 'scene-a',
        subscribe: () => () => {}
    };
    const service = createCollider2DRuntimeService({
        runtimeNodeModel,
        sceneRuntime,
        transformRuntimeStore,
        typeRegistration
    });
    return {emitter, nodes, runtimeNodeModel, service, transformEmitter, transformRuntimeStore};
};

describe('WS-10N5 Collider2D runtime service', () => {
    test('registers Collider2D and exposes rigidbody-independent overlap/query operations', () => {
        const {service} = makeHarness();
        expect(service.capabilityId).toBe(COLLIDER2D_RUNTIME_CAPABILITY_ID);
        expect(service.overlaps('area-a', 'area-b')).toBe(true);
        expect(service.overlaps('area-a', 'area-c')).toBe(false);
        expect(service.getOverlaps('area-a')).toEqual(['area-b']);
        expect(service.queryPoint([0, 0]).map(hit => hit.nodeId)).toContain('area-a');
        expect(service.raycast([-50, 0], [50, 0]).nodeId).toBe('area-a');
        service.dispose();
    });

    test('keeps preview patch hot path off repeated Runtime Node snapshots after begin', () => {
        const {runtimeNodeModel, service} = makeHarness();
        service.beginAuthoringPreview('area-a');
        runtimeNodeModel.getNodeSnapshot.mockClear();

        service.patchAuthoringPreview('area-a', {shape: {type: 'circle', radius: 25}});
        service.patchAuthoringPreview('area-a', {shape: {type: 'circle', radius: 30}});

        expect(runtimeNodeModel.getNodeSnapshot).not.toHaveBeenCalled();
        expect(service.getCollider('area-a').config.shape).toEqual({type: 'circle', radius: 30});
        service.dispose();
    });

    test('uses lightweight external collider counts for status without enumerating stable non-sensor projections', () => {
        const {service} = makeHarness();
        const listColliders = jest.fn(() => Object.freeze([]));
        const getColliderCount = jest.fn(() => 1024);
        const unregister = service.registerExternalColliderProvider({
            containsSensors: false,
            getColliderCount,
            id: 'test.large-tilemap-provider',
            listColliders,
            stableSnapshots: true
        });
        listColliders.mockClear();
        getColliderCount.mockClear();

        const status = service.getStatus();

        expect(status.activeColliderCount).toBe(1027);
        expect(status.areaCount).toBe(3);
        expect(getColliderCount).toHaveBeenCalledTimes(1);
        expect(listColliders).not.toHaveBeenCalled();
        unregister();
        service.dispose();
    });

    test('keeps Collider authoring preview transient and persists only the final commit', () => {
        const {runtimeNodeModel, service} = makeHarness();
        expect(service.getPersistentCollider('area-a').shape.size).toEqual([20, 20]);

        const semanticAreaEvents = [];
        const unsubscribe = service.subscribe(event => {
            if (event.type === 'area:enter' || event.type === 'area:exit') semanticAreaEvents.push(event);
        });
        service.beginAuthoringPreview('area-a');
        service.patchAuthoringPreview('area-a', {offset: [100, 0], shape: {type: 'rectangle', size: [80, 40]}});
        expect(service.getCollider('area-a').config.shape.size).toEqual([80, 40]);
        expect(service.getPersistentCollider('area-a').shape.size).toEqual([20, 20]);
        expect(service.overlaps('area-a', 'area-c')).toBe(true);
        expect(semanticAreaEvents).toHaveLength(0);
        expect(runtimeNodeModel.setComponentData).not.toHaveBeenCalled();

        expect(service.cancelAuthoringPreview('area-a')).toBe(true);
        expect(service.getCollider('area-a').config.shape.size).toEqual([20, 20]);
        expect(runtimeNodeModel.setComponentData).not.toHaveBeenCalled();

        service.beginAuthoringPreview('area-a');
        service.patchAuthoringPreview('area-a', {shape: {type: 'rectangle', size: [100, 60]}});
        service.patchPersistentCollider('area-a', service.getCollider('area-a').config);
        expect(runtimeNodeModel.setComponentData).toHaveBeenCalledTimes(1);
        expect(service.getPersistentCollider('area-a').shape.size).toEqual([100, 60]);
        expect(service.getCollider('area-a').config.shape.size).toEqual([100, 60]);
        unsubscribe();
        service.dispose();
    });

    test('honors collision layers/masks and emits Area enter/exit after Transform changes', () => {
        const {nodes, service, transformEmitter} = makeHarness();
        const events = [];
        const unsubscribe = service.subscribe(event => {
            if (event.type === 'area:enter' || event.type === 'area:exit') events.push(event);
        });
        nodes.get('area-b').components[0].data.position = [60, 0];
        transformEmitter.emit('change', {nodeId: 'area-b', type: 'runtime:replace'});
        expect(service.overlaps('area-a', 'area-b')).toBe(false);
        expect(events.some(event => event.type === 'area:exit' && event.areaNodeId === 'area-a' &&
            event.otherNodeId === 'area-b')).toBe(true);

        service.patchPersistentCollider('area-a', {collisionMask: 2});
        nodes.get('area-b').components[0].data.position = [0, 0];
        transformEmitter.emit('change', {nodeId: 'area-b', type: 'runtime:replace'});
        expect(service.overlaps('area-a', 'area-b')).toBe(false);
        unsubscribe();
        service.dispose();
    });

    test('projects child colliders through semantic parent transforms and refreshes Area transitions from parent motion', () => {
        const {nodes, service, transformEmitter} = makeHarness();
        nodes.set('parent-a', makeTransformNode('parent-a', [-120, 0]));
        nodes.set('parent-b', makeTransformNode('parent-b', [120, 0]));
        nodes.get('area-a').parentId = 'parent-a';
        nodes.get('area-b').parentId = 'parent-b';
        nodes.get('area-a').components[0].data.position = [0, 0];
        nodes.get('area-b').components[0].data.position = [0, 0];

        expect(service.overlaps('area-a', 'area-b')).toBe(false);
        expect(service.getCollider('area-a').worldOrigin).toEqual([-120, 0]);
        expect(service.getCollider('area-b').worldOrigin).toEqual([120, 0]);
        service.refresh('hierarchy-test-separated');

        const events = [];
        const unsubscribe = service.subscribe(event => {
            if (event.type === 'area:enter') events.push(event);
        });
        nodes.get('parent-b').components[0].data.position = [-120, 0];
        transformEmitter.emit('change', {nodeId: 'parent-b', type: 'runtime:replace'});

        expect(service.overlaps('area-a', 'area-b')).toBe(true);
        expect(events.some(event => event.areaNodeId === 'area-a' && event.otherNodeId === 'area-b')).toBe(true);
        unsubscribe();
        service.dispose();
    });

    test('shape query and gizmo geometry follow Transform2D including non-uniform scale', () => {
        const {nodes, service} = makeHarness();
        nodes.get('area-a').components[0].data.scale = [2, 0.5];
        const gizmo = service.getGizmo('area-a');
        expect(gizmo.worldPoints).toEqual(expect.arrayContaining([[-20, -5], [20, -5], [20, 5], [-20, 5]]));
        expect(service.queryShape({type: 'rectangle', size: [5, 5]}, {position: [15, 0]}).map(hit => hit.nodeId))
            .toContain('area-a');
        service.dispose();
    });

    test('geometry helper supports circle/capsule projection without backend identities', () => {
        const circle = transformColliderPoints({shape: {type: 'circle', radius: 10}}, {
            position: [5, 6], rotation: 0, scale: [2, 1]
        });
        expect(circle).toHaveLength(32);
        expect(Math.max(...circle.map(point => point[0]))).toBeCloseTo(25);
        const capsule = transformColliderPoints({shape: {type: 'capsule', radius: 5, height: 30}}, {
            position: [0, 0], rotation: 90, scale: [1, 1]
        });
        expect(capsule.length).toBeGreaterThan(20);
    });
    test('provides reversible node/shape-local projection for editor collider handles', () => {
        const {nodes, service} = makeHarness();
        nodes.set('parent-authoring', makeTransformNode('parent-authoring', [30, -20], {rotation: 30, scale: [2, 0.5]}));
        nodes.get('area-a').parentId = 'parent-authoring';
        nodes.get('area-a').components[0].data.position = [12, 8];
        nodes.get('area-a').components[1].data.offset = [5, -4];
        nodes.get('area-a').components[1].data.rotation = 25;

        const shapeLocal = [17, 9];
        const world = service.shapeLocalPointToWorld('area-a', shapeLocal);
        const roundTrip = service.worldPointToShapeLocal('area-a', world);
        expect(roundTrip[0]).toBeCloseTo(shapeLocal[0], 6);
        expect(roundTrip[1]).toBeCloseTo(shapeLocal[1], 6);

        const nodeLocal = [3, 6];
        const nodeWorld = service.nodeLocalPointToWorld('area-a', nodeLocal);
        const nodeRoundTrip = service.worldPointToNodeLocal('area-a', nodeWorld);
        expect(nodeRoundTrip[0]).toBeCloseTo(nodeLocal[0], 6);
        expect(nodeRoundTrip[1]).toBeCloseTo(nodeLocal[1], 6);
        service.dispose();
    });


    test('builds one cached debug overlap snapshot and coalesces batched Transform refreshes', () => {
        const {service, transformEmitter} = makeHarness();
        const snapshot = service.getDebugSnapshot();
        expect(snapshot.colliders.find(item => item.nodeId === 'area-a').overlapping).toBe(true);
        expect(snapshot.colliders.find(item => item.nodeId === 'area-c').overlapping).toBe(false);
        expect(service.getDebugSnapshot()).toBe(snapshot);

        const refreshes = [];
        const unsubscribe = service.subscribe(event => {
            if (event.type === 'collision:refresh') refreshes.push(event);
        });
        service.beginRefreshBatch();
        transformEmitter.emit('change', {nodeId: 'area-a', type: 'runtime:patch'});
        transformEmitter.emit('change', {nodeId: 'area-b', type: 'runtime:patch'});
        expect(refreshes).toHaveLength(0);
        service.endRefreshBatch('test-batch');
        expect(refreshes).toHaveLength(1);
        expect(refreshes[0].reason).toBe('test-batch');
        expect(refreshes[0].changedNodeIds).toEqual(['area-a', 'area-b']);
        expect(service.getDebugSnapshot()).not.toBe(snapshot);
        unsubscribe();
        service.dispose();
    });

    test('identifies the exact Transform node behind a single collision refresh for selected-gizmo fast paths', () => {
        const {service, transformEmitter} = makeHarness();
        const refreshes = [];
        const unsubscribe = service.subscribe(event => {
            if (event.type === 'collision:refresh') refreshes.push(event);
        });
        transformEmitter.emit('change', {nodeId: 'area-a', type: 'runtime:patch'});
        expect(refreshes).toHaveLength(1);
        expect(refreshes[0].changedNodeIds).toEqual(['area-a']);
        unsubscribe();
        service.dispose();
    });

    test('resolves parent Transform changes to the exact affected Collider node set', () => {
        const {emitter, nodes, service, transformEmitter} = makeHarness();
        nodes.set('body-parent', makeTransformNode('body-parent', [0, 0]));
        nodes.get('area-a').parentId = 'body-parent';
        emitter.emit('change', {nodeId: 'area-a', type: 'node:attach'});
        const refreshes = [];
        const unsubscribe = service.subscribe(event => {
            if (event.type === 'collision:refresh') refreshes.push(event);
        });
        transformEmitter.emit('change', {nodeId: 'body-parent', type: 'runtime:patch'});
        expect(refreshes).toHaveLength(1);
        expect(refreshes[0].changedNodeIds).toEqual(['body-parent']);
        expect(refreshes[0].affectedColliderNodeIds).toEqual(['area-a']);
        unsubscribe();
        service.dispose();
    });

    test('returns viewport-scoped debug geometry and skips global overlap work unless Contacts is requested', () => {
        const {service} = makeHarness();
        const fast = service.getDebugViewportSnapshot({minX: -25, minY: -25, maxX: 35, maxY: 25});
        expect(fast.colliders.map(item => item.nodeId).sort()).toEqual(['area-a', 'area-b']);
        expect(fast.colliders.every(item => item.overlapping === false)).toBe(true);
        expect(fast.totalColliderCount).toBe(3);
        expect(fast.visibleColliderCount).toBe(2);
        const limited = service.getDebugViewportSnapshot(
            {minX: -25, minY: -25, maxX: 35, maxY: 25},
            {maxColliders: 1}
        );
        expect(limited.colliders).toHaveLength(1);
        expect(limited.visibleColliderCount).toBe(1);
        expect(limited.totalColliderCount).toBe(3);

        const contacts = service.getDebugViewportSnapshot(
            {minX: -25, minY: -25, maxX: 35, maxY: 25},
            {includeOverlapState: true}
        );
        expect(contacts.colliders.filter(item => item.overlapping).map(item => item.nodeId).sort())
            .toEqual(['area-a', 'area-b']);
        service.dispose();
    });

    test('uses solid-only refresh fast path without rebuilding Circle/Capsule world geometry', () => {
        const {nodes, runtimeNodeModel, service, transformEmitter, transformRuntimeStore} = makeHarness();
        nodes.forEach(node => {
            const collider = node.components.find(component => component.typeId === 'ngvge.collider2d');
            collider.data.sensor = false;
        });
        const externalList = jest.fn(() => Object.freeze([]));
        service.registerExternalColliderProvider({
            containsSensors: false,
            id: 'test-static-tilemap',
            listColliders: externalList,
            stableSnapshots: true
        });
        externalList.mockClear();
        transformEmitter.emit('change', {nodeId: 'area-a', type: 'runtime:patch'});
        runtimeNodeModel.listNodes.mockClear();
        transformRuntimeStore.getRuntimeTransform.mockClear();
        externalList.mockClear();

        for (let index = 0; index < 20; index++) {
            transformEmitter.emit('change', {nodeId: 'area-a', type: 'runtime:patch'});
        }
        // The lightweight sensor-status pass still lists native nodes, but solid-only refresh must not
        // project any Transform geometry or enumerate stable external TileMap colliders.
        expect(runtimeNodeModel.listNodes).toHaveBeenCalledTimes(20);
        expect(transformRuntimeStore.getRuntimeTransform).not.toHaveBeenCalled();
        expect(externalList).not.toHaveBeenCalled();
        service.dispose();
    });

});
