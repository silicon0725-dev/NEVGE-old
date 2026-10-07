'use strict';

const {EventEmitter} = require('events');
const {createPhysics2DRuntimeService} = require('../../../../src/lib/physics-system');
const {PERFORMANCE_PHYSICS_QUALITY, getPerformanceQualityPreferences} = require('../../../../src/lib/performance-quality');
const {createFakeRapier2D} = require('../../../helpers/fake-rapier2d');

const makeHarness = (options = {}) => {
    const events = new EventEmitter();
    const typeDescriptors = new Map();
    const persistent = new Map([['body', {position: [0, 100], rotation: 0, scale: [1, 1]}]]);
    const runtime = new Map([['body', {position: [0, 100], rotation: 0, scale: [1, 1]}]]);
    const node = {
        activeInHierarchy: true,
        components: [
            {activeInHierarchy: true, data: persistent.get('body'), enabled: true, id: 'transform-body', typeId: 'ngvge.transform2d'},
            {activeInHierarchy: true, data: {
                collisionLayer: 1,
                collisionMask: 1,
                offset: [0, 0],
                rotation: 0,
                sensor: false,
                shape: {type: 'rectangle', size: [20, 20]}
            }, enabled: true, id: 'collider-body', typeId: 'ngvge.collider2d'},
            {activeInHierarchy: true, data: {
                angularDamping: 0,
                angularVelocity: 0,
                ccd: false,
                enabled: true,
                freezeRotation: false,
                friction: 0.5,
                gravityScale: 1,
                linearDamping: 0,
                mass: 1,
                physicsMaterialResourceId: null,
                restitution: 0,
                sleeping: false,
                velocity: [0, 0]
            }, enabled: true, id: 'rigid-body-component', typeId: 'ngvge.rigidbody2d'}
        ],
        id: 'body',
        name: 'Body',
        parentId: null,
        sceneId: 'scene-a'
    };
    const runtimeNodeModel = {
        getNodeSnapshot: id => id === 'body' ? node : null,
        listNodes: () => [node],
        setComponentData: jest.fn((nodeId, componentId, data) => {
            const component = node.components.find(item => item.id === componentId);
            component.data = data;
            events.emit('node', {componentId, componentTypeId: component.typeId, nodeId, type: 'component:data'});
            return component;
        }),
        subscribe: listener => {
            events.on('node', listener);
            return () => events.off('node', listener);
        }
    };
    const typeRegistration = {
        getComponentTypeDescriptor: id => typeDescriptors.get(id) || null,
        registerComponentTypeDescriptor: descriptor => {
            typeDescriptors.set(descriptor.typeId, descriptor);
            return descriptor;
        }
    };
    const transformRuntimeStore = {
        getPersistentTransform: nodeId => persistent.get(nodeId) || null,
        getRuntimeTransform: nodeId => runtime.get(nodeId) || null,
        hydrateNodeFromPersistent: jest.fn(nodeId => {
            const value = persistent.get(nodeId);
            runtime.set(nodeId, JSON.parse(JSON.stringify(value)));
            return runtime.get(nodeId);
        }),
        patchRuntimeTransform: jest.fn((nodeId, patch) => {
            const current = runtime.get(nodeId);
            const next = Object.assign({}, current, patch);
            runtime.set(nodeId, next);
            return next;
        }),
        subscribe: () => () => {}
    };
    const colliderFor = () => {
        const position = runtime.get('body').position;
        return {
            componentId: 'collider-body',
            config: {collisionLayer: 1, collisionMask: 1, sensor: false},
            nodeId: 'body',
            sourceKind: 'component',
            worldOrigin: position.slice(),
            worldPoints: [
                [position[0] - 10, position[1] - 10],
                [position[0] + 10, position[1] - 10],
                [position[0] + 10, position[1] + 10],
                [position[0] - 10, position[1] + 10]
            ]
        };
    };
    const colliderRuntimeService = {
        beginRefreshBatch: jest.fn(),
        endRefreshBatch: jest.fn(),
        getCollider: id => id === 'body' ? colliderFor() : null,
        listColliders: jest.fn(() => [colliderFor()]),
        subscribe: () => () => {}
    };
    const sceneRuntime = {getActiveSceneId: () => 'scene-a', subscribe: () => () => {}};
    const service = createPhysics2DRuntimeService({
        backendLoader: async () => createFakeRapier2D(),
        colliderRuntimeService,
        phaseScheduler: options.phaseScheduler || null,
        runtimeNodeModel,
        sceneRuntime,
        scratchRuntime: options.scratchRuntime || null,
        transformRuntimeStore,
        typeRegistration
    });
    return {colliderRuntimeService, node, runtime, runtimeNodeModel, service, transformRuntimeStore};
};

describe('WS-10N8 Physics2D runtime service', () => {
    test('initializes a replaceable backend, advances dynamic bodies through runtime Transform2D only, and restores authored pose on stop', async () => {
        const {colliderRuntimeService, node, runtime, runtimeNodeModel, service, transformRuntimeStore} = makeHarness();
        await expect(service.initializeBackend()).resolves.toBe(true);
        expect(service.getStatus()).toMatchObject({backendReady: true, backendState: 'ready'});
        expect(service.getStatus().backendId).toBe('ngvge.physics2d.backend.rapier2d');

        const beforePersistent = JSON.parse(JSON.stringify(node.components[0].data));
        service.startSimulation();
        expect(service.stepFixed()).toBe(true);
        expect(runtime.get('body').position[1]).toBeLessThan(100);
        expect(colliderRuntimeService.beginRefreshBatch).toHaveBeenCalledTimes(1);
        expect(colliderRuntimeService.endRefreshBatch).toHaveBeenCalledWith('physics-step');
        const descriptorBuildCalls = colliderRuntimeService.listColliders.mock.calls.length;
        expect(service.stepFixed()).toBe(true);
        expect(colliderRuntimeService.listColliders).toHaveBeenCalledTimes(descriptorBuildCalls);
        expect(node.components[0].data).toEqual(beforePersistent);
        expect(runtimeNodeModel.setComponentData).not.toHaveBeenCalled();

        const view = service.getRigidBody('body');
        expect(view.componentId).toBe('rigid-body-component');
        expect(view.state.position[1]).toBeLessThan(100);
        expect(view.state.backendHandlePresent).toBe(true);
        expect(view.state).not.toHaveProperty('backendHandle');

        service.stopSimulation();
        expect(runtime.get('body').position).toEqual([0, 100]);
        expect(transformRuntimeStore.hydrateNodeFromPersistent).toHaveBeenCalledWith('body');
        expect(service.getRigidBody('body').state.velocity).toEqual([0, 0]);
        service.dispose();
    });

    test('disabled RigidBody2D stays out of the backend while its Collider2D semantic component can still exist', async () => {
        const {node, service} = makeHarness();
        await service.initializeBackend();
        service.patchPersistentRigidBody('body', {enabled: false});
        service.startSimulation();
        expect(service.stepFixed()).toBe(true);
        expect(service.getRigidBody('body').state.backendHandlePresent).toBe(false);
        expect(node.components.find(item => item.typeId === 'ngvge.collider2d')).toBeTruthy();
        service.dispose();
    });

    test('persistent RigidBody patch changes authored initial state without accepting backend identity', async () => {
        const {node, service, runtimeNodeModel} = makeHarness();
        await service.initializeBackend();
        expect(service.patchPersistentRigidBody('body', {mass: 3, velocity: [12, 34]})).toMatchObject({
            mass: 3,
            velocity: [12, 34]
        });
        expect(runtimeNodeModel.setComponentData).toHaveBeenCalledTimes(1);
        expect(node.components.find(item => item.typeId === 'ngvge.rigidbody2d').data.mass).toBe(3);
        expect(() => service.patchPersistentRigidBody('body', {backendHandle: 99})).toThrow(
            expect.objectContaining({code: 'NGVGE_RIGIDBODY2D_PATCH_FIELD_UNSUPPORTED'})
        );
        service.dispose();
    });
    test('applies Physics Quality as execution policy without mutating RigidBody authoring data', async () => {
        const scratchRuntime = new EventEmitter();
        const {node, service} = makeHarness({scratchRuntime});
        await service.initializeBackend();
        expect(service.getStatus()).toMatchObject({
            fixedDeltaSeconds: 1 / 60,
            maxCatchUpSteps: 8,
            physicsQuality: PERFORMANCE_PHYSICS_QUALITY.PRECISE
        });
        const before = JSON.parse(JSON.stringify(node.components.find(item => item.typeId === 'ngvge.rigidbody2d').data));
        getPerformanceQualityPreferences(scratchRuntime).setPhysicsQuality(PERFORMANCE_PHYSICS_QUALITY.PERFORMANCE);
        expect(service.getStatus()).toMatchObject({
            fixedDeltaSeconds: 1 / 30,
            maxCatchUpSteps: 2,
            physicsQuality: PERFORMANCE_PHYSICS_QUALITY.PERFORMANCE
        });
        expect(node.components.find(item => item.typeId === 'ngvge.rigidbody2d').data).toEqual(before);
        service.dispose();
    });

    test('bounds scheduler catch-up work by a CPU time budget and drops only accumulated backlog', async () => {
        const {service} = makeHarness();
        await service.initializeBackend();
        service.startSimulation();
        const nowSpy = jest.spyOn(global.performance, 'now')
            .mockReturnValueOnce(0)
            .mockReturnValue(2);
        const steps = service.advance(0.2, {timeBudgetMs: 1});
        nowSpy.mockRestore();
        expect(steps).toBe(1);
        expect(service.getStatus()).toMatchObject({
            droppedBacklogCount: 1,
            schedulerBudgetExhaustionCount: 1
        });
        expect(service.getStatus().droppedBacklogStepCount).toBeGreaterThan(0);
        service.dispose();
    });

    test('runs project physics on the Runtime Phase Scheduler instead of Scratch AFTER_EXECUTE', async () => {
        const scratchRuntime = new EventEmitter();
        let frameCallback = null;
        const unregister = jest.fn();
        const phaseScheduler = {
            registerFramePhase: jest.fn((id, callback) => {
                frameCallback = callback;
                return unregister;
            })
        };
        const {runtime, service} = makeHarness({phaseScheduler, scratchRuntime});
        await service.initializeBackend();
        expect(scratchRuntime.listenerCount('AFTER_EXECUTE')).toBe(0);

        scratchRuntime.emit('PROJECT_START');
        expect(phaseScheduler.registerFramePhase).toHaveBeenCalledTimes(1);
        expect(typeof frameCallback).toBe('function');
        const beforeY = runtime.get('body').position[1];
        frameCallback({deltaSeconds: 1 / 30, frameId: 1, timestamp: 100});
        expect(runtime.get('body').position[1]).toBeLessThan(beforeY);
        expect(service.getStatus().schedulerTickCount).toBe(1);

        scratchRuntime.emit('AFTER_EXECUTE');
        expect(service.getStatus().schedulerTickCount).toBe(1);
        scratchRuntime.emit('PROJECT_STOP_ALL');
        expect(unregister).toHaveBeenCalled();
        service.dispose();
    });

});
