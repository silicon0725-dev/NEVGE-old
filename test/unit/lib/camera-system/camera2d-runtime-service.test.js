const {EventEmitter} = require('events');
const {CAMERA2D_TYPE_ID} = require('../../../../src/core/camera2d');
const {TRANSFORM2D_TYPE_ID} = require('../../../../src/core/transform2d');
const {
    CAMERA2D_RUNTIME_CAPABILITY_ID,
    createCamera2DRuntimeService
} = require('../../../../src/lib/camera-system');

const clone = value => JSON.parse(JSON.stringify(value));

const makeNode = (id, {priority = 0, enabled = true, position = [0, 0], rotation = 0, zoom = [1, 1]} = {}) => ({
    components: [
        {id: `${id}:transform`, typeId: TRANSFORM2D_TYPE_ID, data: {position, rotation, scale: [1, 1]}},
        {id: `${id}:camera`, typeId: CAMERA2D_TYPE_ID, data: {enabled, offset: [0, 0], priority, zoom}}
    ],
    id,
    name: id,
    sceneId: 'scene-a'
});

const makeHarness = nodesInput => {
    const nodes = new Map(nodesInput.map(node => [node.id, clone(node)]));
    const nodeListeners = new Set();
    const transformListeners = new Set();
    const runtimeTransforms = new Map(nodesInput.map(node => {
        const transform = node.components.find(component => component.typeId === TRANSFORM2D_TYPE_ID);
        return [node.id, clone(transform.data)];
    }));
    const registered = new Map();
    const applied = [];
    const scratchRuntime = new EventEmitter();

    const runtimeNodeModel = {
        getNodeSnapshot: jest.fn(id => nodes.has(id) ? clone(nodes.get(id)) : null),
        listNodes: jest.fn(options => Array.from(nodes.values())
            .filter(node => !options || !options.sceneId || node.sceneId === options.sceneId)
            .map(clone)),
        setComponentData: jest.fn((nodeId, componentId, data) => {
            const node = nodes.get(nodeId);
            const component = node.components.find(item => item.id === componentId);
            component.data = clone(data);
            nodeListeners.forEach(listener => listener({
                componentId,
                componentTypeId: component.typeId,
                nodeId,
                type: 'component:data'
            }));
            return clone(component);
        }),
        subscribe: jest.fn(listener => {
            nodeListeners.add(listener);
            return () => nodeListeners.delete(listener);
        })
    };
    const transformRuntimeStore = {
        getRuntimeTransform: jest.fn(id => runtimeTransforms.has(id) ? clone(runtimeTransforms.get(id)) : null),
        hydrateNodeFromPersistent: jest.fn(id => {
            const node = nodes.get(id);
            if (!node) return null;
            const component = node.components.find(item => item.typeId === TRANSFORM2D_TYPE_ID);
            runtimeTransforms.set(id, clone(component.data));
            transformListeners.forEach(listener => listener({nodeId: id, type: 'runtime:hydrate'}));
            return {nodeId: id, transform: clone(component.data)};
        }),
        patchRuntimeTransform: jest.fn((id, patch) => {
            const current = runtimeTransforms.get(id);
            const next = Object.assign({}, current, clone(patch));
            runtimeTransforms.set(id, next);
            transformListeners.forEach(listener => listener({nodeId: id, type: 'runtime:patch'}));
            return {nodeId: id, transform: clone(next)};
        }),
        subscribe: jest.fn(listener => {
            transformListeners.add(listener);
            return () => transformListeners.delete(listener);
        })
    };
    const typeRegistration = {
        getComponentTypeDescriptor: jest.fn(id => registered.get(id) || null),
        registerComponentTypeDescriptor: jest.fn(descriptor => {
            registered.set(descriptor.typeId, clone(descriptor));
            return clone(descriptor);
        })
    };
    const sceneRuntime = {getActiveSceneId: jest.fn(() => 'scene-a')};
    const renderAdapter = {applyViewport: jest.fn(state => applied.push(clone(state)))};

    const service = createCamera2DRuntimeService({
        renderAdapter,
        runtimeNodeModel,
        sceneRuntime,
        scratchRuntime,
        transformRuntimeStore,
        typeRegistration
    });
    return {
        applied,
        nodes,
        renderAdapter,
        runtimeTransforms,
        scratchRuntime,
        service,
        transformRuntimeStore,
        typeRegistration
    };
};

describe('WS-10N4 Camera2D Runtime Service', () => {
    test('registers Camera2D and selects highest-priority enabled camera deterministically', () => {
        const harness = makeHarness([
            makeNode('camera-a', {priority: 1}),
            makeNode('camera-b', {priority: 5, position: [20, 10]})
        ]);
        expect(harness.service.capabilityId).toBe(CAMERA2D_RUNTIME_CAPABILITY_ID);
        expect(harness.typeRegistration.registerComponentTypeDescriptor).toHaveBeenCalled();
        expect(harness.service.getViewportState()).toEqual(expect.objectContaining({
            activeCameraNodeId: 'camera-b',
            position: [20, 10],
            priority: 5
        }));
        harness.service.dispose();
    });

    test('keeps runtime Camera and Transform patches ephemeral until explicitly persisted', () => {
        const harness = makeHarness([makeNode('camera-a')]);
        harness.service.patchRuntimeCamera('camera-a', {zoom: [3, 2]});
        harness.service.patchRuntimeTransform('camera-a', {position: [12, -8], rotation: 30});
        expect(harness.service.getCamera('camera-a')).toEqual(expect.objectContaining({
            config: expect.objectContaining({zoom: [3, 2]}),
            transform: expect.objectContaining({position: [12, -8], rotation: 30})
        }));
        expect(harness.service.getPersistentCamera('camera-a').zoom).toEqual([1, 1]);
        const persistentTransform = harness.nodes.get('camera-a').components
            .find(component => component.typeId === TRANSFORM2D_TYPE_ID).data;
        expect(persistentTransform.position).toEqual([0, 0]);
        harness.service.dispose();
    });

    test('persistent Camera edits mutate semantic component data and refresh runtime view', () => {
        const harness = makeHarness([makeNode('camera-a')]);
        harness.service.patchPersistentCamera('camera-a', {offset: [4, 5], priority: 9});
        expect(harness.nodes.get('camera-a').components.find(component => component.typeId === CAMERA2D_TYPE_ID).data)
            .toEqual({enabled: true, offset: [4, 5], priority: 9, zoom: [1, 1]});
        expect(harness.service.getViewportState()).toEqual(expect.objectContaining({offset: [4, 5], priority: 9}));
        harness.service.dispose();
    });

    test('world/screen conversion is reversible with position, offset, rotation and nonuniform zoom', () => {
        const node = makeNode('camera-a', {position: [10, -20], rotation: 30, zoom: [2, 0.5]});
        node.components.find(component => component.typeId === CAMERA2D_TYPE_ID).data.offset = [4, 6];
        const harness = makeHarness([node]);
        const world = [37, 12];
        const screen = harness.service.worldToScreen(world);
        const roundTrip = harness.service.screenToWorld(screen);
        expect(roundTrip[0]).toBeCloseTo(world[0], 8);
        expect(roundTrip[1]).toBeCloseTo(world[1], 8);
        harness.service.dispose();
    });

    test('stop/start boundary restores authored Camera and Transform runtime state', () => {
        const harness = makeHarness([makeNode('camera-a', {position: [2, 3]})]);
        harness.service.patchRuntimeCamera('camera-a', {enabled: false, zoom: [4, 4]});
        harness.service.patchRuntimeTransform('camera-a', {position: [100, 200]});
        harness.scratchRuntime.emit('PROJECT_STOP_ALL');
        expect(harness.service.getCamera('camera-a')).toEqual(expect.objectContaining({
            config: {enabled: true, offset: [0, 0], priority: 0, zoom: [1, 1]},
            transform: expect.objectContaining({position: [2, 3]})
        }));
        harness.service.dispose();
    });
});
