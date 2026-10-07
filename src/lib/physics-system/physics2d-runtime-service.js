'use strict';

const {
    PHYSICS2D_BODY_KINDS,
    assertPhysics2DBackendAdapter,
    normalizePhysics2DSettings
} = require('../../core/physics2d');
const {
    RIGIDBODY2D_COMPONENT_OWNER,
    RIGIDBODY2D_SCHEMA_VERSION,
    RIGIDBODY2D_TYPE_ID,
    applyRigidBody2DPatch,
    normalizeRigidBody2D
} = require('../../core/rigidbody2d');
const {CHARACTER_CONTROLLER2D_TYPE_ID} = require('../../core/character-controller2d');
const {TRANSFORM2D_TYPE_ID} = require('../../core/transform2d');
const {COMPONENT_CARDINALITIES} = require('../runtime-nodes/runtime-component-contract');
const {worldDeltaToNodeLocalDelta} = require('../transform-system/transform2d-hierarchy-projection');
const {createRapier2DBackendAdapter} = require('./rapier2d-backend-adapter');
const {materializePortableCapabilityValue} = require('../first-party-modules/materialize-portable-capability-value');
const {getPerformanceQualityPreferences} = require('../performance-quality');
const {FRAME_PROFILER_CATEGORY, getFrameTimeProfiler} = require('../frame-profiler');
const {
    RUNTIME_PHASE_IDS,
    RUNTIME_PHASE_PRIORITIES,
    getRuntimePhaseScheduler
} = require('../runtime-scheduler');

const PHYSICS2D_RUNTIME_CAPABILITY_ID = 'ngvge.physics2d-runtime';
const PHYSICS2D_RUNTIME_CAPABILITY_VERSION = 1;
const PHYSICS2D_SCHEDULER_TIME_BUDGET_MS = 12;
const monotonicNow = () => {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
    return Date.now();
};
const RIGIDBODY2D_RUNTIME_COMPONENT_DESCRIPTOR = Object.freeze({
    cardinality: COMPONENT_CARDINALITIES.ONE,
    ownerModuleId: RIGIDBODY2D_COMPONENT_OWNER,
    schemaVersion: RIGIDBODY2D_SCHEMA_VERSION,
    typeId: RIGIDBODY2D_TYPE_ID
});
const clone = value => JSON.parse(JSON.stringify(value));
const freeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(key => freeze(value[key]));
    return Object.freeze(value);
};
const getComponent = (node, typeId) => {
    const components = node && Array.isArray(node.components) ? node.components : [];
    return components.find(component => component && component.typeId === typeId) || null;
};
const center = points => {
    if (!Array.isArray(points) || !points.length) return [0, 0];
    const sum = points.reduce((acc, point) => [acc[0] + Number(point[0] || 0), acc[1] + Number(point[1] || 0)], [0, 0]);
    return [sum[0] / points.length, sum[1] / points.length];
};
const registerRigidBody2DComponent = typeRegistration => {
    if (!typeRegistration || typeof typeRegistration.getComponentTypeDescriptor !== 'function' ||
        typeof typeRegistration.registerComponentTypeDescriptor !== 'function') {
        throw new TypeError('RigidBody2D requires Runtime Node Type Registration capability.');
    }
    const existing = typeRegistration.getComponentTypeDescriptor(RIGIDBODY2D_TYPE_ID);
    if (existing && existing.ownerModuleId === RIGIDBODY2D_COMPONENT_OWNER &&
        existing.schemaVersion === RIGIDBODY2D_SCHEMA_VERSION && existing.cardinality === COMPONENT_CARDINALITIES.ONE) return existing;
    return typeRegistration.registerComponentTypeDescriptor(RIGIDBODY2D_RUNTIME_COMPONENT_DESCRIPTOR, {replace: Boolean(existing)});
};
const createRigidBody2DComponentOptions = (data, options = {}) => {
    const result = {
        data: normalizeRigidBody2D(data),
        enabled: options.enabled !== false,
        schemaVersion: RIGIDBODY2D_SCHEMA_VERSION,
        typeId: RIGIDBODY2D_TYPE_ID
    };
    if (options.componentId) result.id = String(options.componentId);
    return result;
};

const createPhysics2DRuntimeService = options => {
    const runtimeNodeModel = options && options.runtimeNodeModel;
    const typeRegistration = options && options.typeRegistration;
    const transformRuntimeStore = options && options.transformRuntimeStore;
    const colliderRuntimeService = options && options.colliderRuntimeService;
    const sceneRuntime = options && options.sceneRuntime;
    const scratchRuntime = options && options.scratchRuntime;
    const materialResources = options && options.physicsMaterialResources;
    const backendLoader = options && options.backendLoader;
    const backendAdapterLoader = options && options.backendAdapterLoader;
    const backendFactory = options && options.backendFactory ? options.backendFactory : createRapier2DBackendAdapter;
    const baseSettings = normalizePhysics2DSettings(options && options.settings);
    const qualityPreferences = scratchRuntime ? getPerformanceQualityPreferences(scratchRuntime) : null;
    const frameProfiler = scratchRuntime ? getFrameTimeProfiler(scratchRuntime) : null;
    const phaseScheduler = options && options.phaseScheduler ? options.phaseScheduler :
        (scratchRuntime ? getRuntimePhaseScheduler(scratchRuntime) : null);
    const resolveSettings = () => {
        const quality = qualityPreferences ? qualityPreferences.getPhysicsSettings() : null;
        return normalizePhysics2DSettings(Object.assign({}, baseSettings, quality ? {
            fixedDeltaSeconds: 1 / quality.fixedHz,
            maxCatchUpSteps: quality.maxCatchUpSteps
        } : null));
    };
    let settings = resolveSettings();
    if (!runtimeNodeModel || typeof runtimeNodeModel.getNodeSnapshot !== 'function' || typeof runtimeNodeModel.listNodes !== 'function' ||
        typeof runtimeNodeModel.setComponentData !== 'function') throw new TypeError('Physics2D Runtime Service requires Runtime Node Model.');
    if (!transformRuntimeStore || typeof transformRuntimeStore.getRuntimeTransform !== 'function' ||
        typeof transformRuntimeStore.patchRuntimeTransform !== 'function' || typeof transformRuntimeStore.hydrateNodeFromPersistent !== 'function') {
        throw new TypeError('Physics2D Runtime Service requires Transform2D Runtime Store.');
    }
    if (!colliderRuntimeService || typeof colliderRuntimeService.listColliders !== 'function') {
        throw new TypeError('Physics2D Runtime Service requires Collider2D Runtime Service.');
    }
    if (!sceneRuntime || typeof sceneRuntime.getActiveSceneId !== 'function') throw new TypeError('Physics2D Runtime Service requires Scene Runtime.');
    registerRigidBody2DComponent(typeRegistration);

    let backendAdapter = null;
    let backendError = null;
    let backendInitPromise = null;
    let backendState = 'unavailable';
    let worldRecord = null;
    let revision = 0;
    let running = false;
    let disposed = false;
    let accumulator = 0;
    let lastTimestamp = null;
    const listeners = new Set();
    const dynamicDefinitions = new Map();
    const runtimeStates = new Map();
    const dirtyDynamicBodies = new Set();
    let descriptorCache = Object.freeze([]);
    let descriptorSyncDirty = true;
    let unsubscribeNodes = () => {};
    let unsubscribeCollider = () => {};
    let unsubscribeTransform = () => {};
    let unsubscribeScene = () => {};
    let unsubscribeQuality = () => {};
    let detachScratchRuntime = () => {};
    let unregisterPhysicsPhase = () => {};
    let schedulerTickCount = 0;
    let droppedBacklogCount = 0;
    let droppedBacklogStepCount = 0;
    let schedulerBudgetExhaustionCount = 0;

    const emit = event => {
        revision += 1;
        const frozen = freeze(Object.assign({revision}, clone(event || {})));
        listeners.forEach(listener => { try { listener(frozen); } catch { /* advisory */ } });
        return frozen;
    };
    const getMaterial = config => {
        if (config && config.physicsMaterialResourceId && materialResources && typeof materialResources.getMaterial === 'function') {
            const record = materialResources.getMaterial(config.physicsMaterialResourceId);
            if (record && record.data) return record.data;
        }
        return {friction: config ? config.friction : 0.5, restitution: config ? config.restitution : 0};
    };
    const bodyKindFor = (node, collider) => {
        if (!node || collider.sourceKind === 'tilemap') return PHYSICS2D_BODY_KINDS.FIXED;
        if (getComponent(node, RIGIDBODY2D_TYPE_ID)) return PHYSICS2D_BODY_KINDS.DYNAMIC;
        if (getComponent(node, CHARACTER_CONTROLLER2D_TYPE_ID)) return PHYSICS2D_BODY_KINDS.KINEMATIC;
        return collider.config && collider.config.sensor ? PHYSICS2D_BODY_KINDS.SENSOR : PHYSICS2D_BODY_KINDS.FIXED;
    };
    const bodyIdFor = (node, collider, kind) => {
        if (kind === PHYSICS2D_BODY_KINDS.DYNAMIC) return getComponent(node, RIGIDBODY2D_TYPE_ID).id;
        const colliderKey = collider.projectionId || collider.componentId || collider.nodeId;
        return `ngvge:physics-runtime:${kind}:${colliderKey}`;
    };
    const computeDynamicDefinition = (node, collider, bodyId) => {
        const bodyComponent = getComponent(node, RIGIDBODY2D_TYPE_ID);
        const config = normalizeRigidBody2D(bodyComponent.data);
        const origin = Array.isArray(collider.worldOrigin) ? collider.worldOrigin.slice() : center(collider.worldPoints);
        const transform = transformRuntimeStore.getRuntimeTransform(node.id) || transformRuntimeStore.getPersistentTransform(node.id);
        return {
            baseLocalRotation: transform && Number.isFinite(Number(transform.rotation)) ? Number(transform.rotation) : 0,
            baseWorldOrigin: origin,
            bodyId,
            colliderLocalPoints: collider.worldPoints.map(point => [point[0] - origin[0], point[1] - origin[1]]),
            componentId: bodyComponent.id,
            config,
            nodeId: node.id
        };
    };
    const descriptorFor = collider => {
        const node = runtimeNodeModel.getNodeSnapshot(collider.nodeId);
        const rigidBodyComponent = getComponent(node, RIGIDBODY2D_TYPE_ID);
        if (rigidBodyComponent && (rigidBodyComponent.enabled === false || !normalizeRigidBody2D(rigidBodyComponent.data).enabled)) {
            return null;
        }
        const kind = bodyKindFor(node, collider);
        const bodyId = bodyIdFor(node, collider, kind);
        let position = Array.isArray(collider.worldOrigin) ? collider.worldOrigin.slice() : center(collider.worldPoints);
        let localPoints = collider.worldPoints.map(point => [point[0] - position[0], point[1] - position[1]]);
        let rigidConfig = null;
        let baseLocalRotation = 0;
        if (kind === PHYSICS2D_BODY_KINDS.DYNAMIC) {
            if (!dynamicDefinitions.has(bodyId) || dirtyDynamicBodies.has(bodyId)) {
                dynamicDefinitions.set(bodyId, computeDynamicDefinition(node, collider, bodyId));
                dirtyDynamicBodies.delete(bodyId);
            }
            const definition = dynamicDefinitions.get(bodyId);
            localPoints = definition.colliderLocalPoints.map(point => point.slice());
            rigidConfig = definition.config;
            baseLocalRotation = definition.baseLocalRotation;
            const state = runtimeStates.get(bodyId);
            if (state && Array.isArray(state.position)) position = state.position.slice();
            else position = definition.baseWorldOrigin.slice();
        }
        const material = getMaterial(rigidConfig);
        return {
            angularDamping: rigidConfig ? rigidConfig.angularDamping : 0,
            angularVelocityDegrees: rigidConfig ? rigidConfig.angularVelocity : 0,
            baseLocalRotation,
            bodyId,
            ccd: rigidConfig ? rigidConfig.ccd : false,
            colliders: [{
                colliderId: collider.projectionId || collider.componentId,
                collisionLayer: collider.config.collisionLayer,
                collisionMask: collider.config.collisionMask,
                friction: material.friction,
                mass: rigidConfig ? rigidConfig.mass : null,
                localPoints,
                restitution: material.restitution,
                sensor: collider.config.sensor,
                shapeType: collider.config && collider.config.shape ? collider.config.shape.type : null
            }],
            freezeRotation: rigidConfig ? rigidConfig.freezeRotation : true,
            gravityScale: rigidConfig ? rigidConfig.gravityScale : 0,
            kind,
            linearDamping: rigidConfig ? rigidConfig.linearDamping : 0,
            mass: rigidConfig ? rigidConfig.mass : 0,
            nodeId: collider.nodeId,
            position,
            rotationDegrees: 0,
            sleeping: rigidConfig ? rigidConfig.sleeping : false,
            velocity: rigidConfig ? rigidConfig.velocity : [0, 0]
        };
    };
    const listBodyDescriptors = () => {
        const sceneId = sceneRuntime.getActiveSceneId();
        const descriptors = colliderRuntimeService.listColliders(sceneId, {includeInactive: false}).map(descriptorFor).filter(Boolean);
        const seenDynamic = new Set(descriptors.filter(item => item.kind === PHYSICS2D_BODY_KINDS.DYNAMIC).map(item => item.bodyId));
        Array.from(dynamicDefinitions.keys()).forEach(bodyId => { if (!seenDynamic.has(bodyId)) dynamicDefinitions.delete(bodyId); });
        return descriptors;
    };
    const ensureWorld = () => {
        if (!backendAdapter || backendState !== 'ready') return null;
        const sceneId = sceneRuntime.getActiveSceneId();
        if (worldRecord && worldRecord.sceneId === sceneId) return worldRecord.world;
        if (worldRecord && worldRecord.world && typeof worldRecord.world.dispose === 'function') worldRecord.world.dispose();
        worldRecord = {sceneId, world: backendAdapter.createWorld({gravity: settings.gravity, sceneId})};
        runtimeStates.clear();
        dynamicDefinitions.clear();
        descriptorCache = Object.freeze([]);
        descriptorSyncDirty = true;
        return worldRecord.world;
    };
    const applyDynamicState = (descriptor, state) => {
        if (!state || !descriptor || descriptor.kind !== PHYSICS2D_BODY_KINDS.DYNAMIC) return;
        const nodeId = descriptor.nodeId;
        const collider = colliderRuntimeService.getCollider(nodeId);
        if (!collider) return;
        const currentOrigin = Array.isArray(collider.worldOrigin) ? collider.worldOrigin : center(collider.worldPoints);
        const worldDelta = [state.position[0] - currentOrigin[0], state.position[1] - currentOrigin[1]];
        const currentTransform = transformRuntimeStore.getRuntimeTransform(nodeId) || transformRuntimeStore.getPersistentTransform(nodeId);
        if (currentTransform) {
            const localDelta = worldDeltaToNodeLocalDelta(worldDelta, nodeId, runtimeNodeModel, transformRuntimeStore);
            transformRuntimeStore.patchRuntimeTransform(nodeId, {
                position: [currentTransform.position[0] + localDelta[0], currentTransform.position[1] + localDelta[1]],
                rotation: descriptor.baseLocalRotation + state.rotationDegrees
            });
        }
        runtimeStates.set(descriptor.bodyId, freeze({
            angularVelocity: state.angularVelocityDegrees,
            backendHandlePresent: state.backendHandle !== null && typeof state.backendHandle !== 'undefined',
            position: state.position.slice(),
            sleeping: Boolean(state.sleeping),
            velocity: state.velocity.slice()
        }));
    };
    const runFixedStep = deltaSeconds => {
        if (backendState !== 'ready') return false;
        const world = ensureWorld();
        if (!world) return false;
        let descriptors = descriptorCache;
        if (descriptorSyncDirty) {
            const syncDescriptors = () => {
                descriptors = Object.freeze(listBodyDescriptors());
                world.syncBodies(descriptors);
                descriptorCache = descriptors;
                descriptorSyncDirty = false;
            };
            if (frameProfiler) frameProfiler.measure(FRAME_PROFILER_CATEGORY.PHYSICS_DESCRIPTOR_SYNC, syncDescriptors);
            else syncDescriptors();
        }
        const stepBackend = () => world.step(deltaSeconds || settings.fixedDeltaSeconds);
        if (frameProfiler) frameProfiler.measure(FRAME_PROFILER_CATEGORY.PHYSICS_BACKEND_STEP, stepBackend);
        else stepBackend();
        const writeBack = () => {
            const canBatchCollisionRefresh = typeof colliderRuntimeService.beginRefreshBatch === 'function' &&
                typeof colliderRuntimeService.endRefreshBatch === 'function';
            if (canBatchCollisionRefresh) colliderRuntimeService.beginRefreshBatch();
            try {
                descriptors.filter(item => item.kind === PHYSICS2D_BODY_KINDS.DYNAMIC).forEach(descriptor => {
                    const state = materializePortableCapabilityValue(world.getBodyState(descriptor.bodyId));
                    if (state) applyDynamicState(descriptor, state);
                });
            } finally {
                if (canBatchCollisionRefresh) colliderRuntimeService.endRefreshBatch('physics-step');
            }
        };
        if (frameProfiler) frameProfiler.measure(FRAME_PROFILER_CATEGORY.PHYSICS_WRITEBACK, writeBack);
        else writeBack();
        emit({bodyCount: descriptors.length, type: 'physics:step'});
        return true;
    };
    const fixedStep = deltaSeconds => (frameProfiler ?
        frameProfiler.measure(FRAME_PROFILER_CATEGORY.PHYSICS, () => runFixedStep(deltaSeconds)) :
        runFixedStep(deltaSeconds));
    const resetRuntimeTransforms = () => runtimeNodeModel.listNodes({includeRoots: false}).forEach(node => {
        if (getComponent(node, RIGIDBODY2D_TYPE_ID)) {
            try { transformRuntimeStore.hydrateNodeFromPersistent(node.id); } catch { /* best effort */ }
        }
    });
    const resetWorld = reason => {
        if (worldRecord && worldRecord.world && typeof worldRecord.world.dispose === 'function') worldRecord.world.dispose();
        worldRecord = null;
        accumulator = 0;
        lastTimestamp = null;
        runtimeStates.clear();
        dynamicDefinitions.clear();
        descriptorCache = Object.freeze([]);
        descriptorSyncDirty = true;
        resetRuntimeTransforms();
        emit({reason: reason || 'reset', type: 'physics:reset'});
    };
    const advance = (deltaSecondsValue, executionOptions = {}) => {
        if (!running || backendState !== 'ready') return 0;
        const delta = Math.min(settings.maxFrameDeltaSeconds, Math.max(0, Number(deltaSecondsValue) || 0));
        const requestedBudgetMs = Number(executionOptions.timeBudgetMs);
        const timeBudgetMs = Number.isFinite(requestedBudgetMs) && requestedBudgetMs > 0 ? requestedBudgetMs : null;
        const startedAt = timeBudgetMs === null ? 0 : monotonicNow();
        accumulator += delta;
        let steps = 0;
        let budgetExhausted = false;
        while (accumulator + 1e-12 >= settings.fixedDeltaSeconds && steps < settings.maxCatchUpSteps) {
            fixedStep(settings.fixedDeltaSeconds);
            accumulator -= settings.fixedDeltaSeconds;
            steps += 1;
            if (timeBudgetMs !== null && accumulator + 1e-12 >= settings.fixedDeltaSeconds &&
                monotonicNow() - startedAt >= timeBudgetMs) {
                budgetExhausted = true;
                break;
            }
        }
        if ((budgetExhausted || steps >= settings.maxCatchUpSteps) && accumulator >= settings.fixedDeltaSeconds) {
            const droppedSteps = Math.max(1, Math.floor(accumulator / settings.fixedDeltaSeconds));
            accumulator %= settings.fixedDeltaSeconds;
            droppedBacklogCount += 1;
            droppedBacklogStepCount += droppedSteps;
            if (budgetExhausted) schedulerBudgetExhaustionCount += 1;
            if (frameProfiler) {
                frameProfiler.count('physicsBacklogDrops', 1);
                frameProfiler.count('physicsDroppedBacklogSteps', droppedSteps);
                if (budgetExhausted) frameProfiler.count('physicsSchedulerBudgetExhaustions', 1);
            }
        }
        if (frameProfiler) frameProfiler.count('physicsFixedSteps', steps);
        return steps;
    };
    const initializeBackend = () => {
        if (backendInitPromise) return backendInitPromise;
        if (typeof backendAdapterLoader !== 'function' && typeof backendLoader !== 'function') {
            backendState = 'unavailable';
            return Promise.resolve(false);
        }
        backendState = 'initializing';
        backendInitPromise = Promise.resolve().then(async () => {
            if (typeof backendAdapterLoader === 'function') {
                return assertPhysics2DBackendAdapter(await backendAdapterLoader());
            }
            const moduleValue = await backendLoader();
            return assertPhysics2DBackendAdapter(backendFactory({RAPIER: moduleValue, worldUnitsPerMeter: 100}));
        }).then(adapter => {
            backendAdapter = adapter;
            backendState = 'ready';
            backendError = null;
            emit({backendId: backendAdapter.backendId, type: 'physics:backend-ready'});
            if (scratchRuntime && typeof scratchRuntime.emit === 'function') scratchRuntime.emit('targetsUpdate');
            return true;
        }).catch(error => {
            backendAdapter = null;
            backendError = error;
            backendState = 'failed';
            emit({code: error && error.code, message: error && error.message, type: 'physics:backend-failed'});
            return false;
        });
        return backendInitPromise;
    };
    const patchPersistentRigidBody = (nodeId, patch, mutationOptions = {}) => {
        const node = runtimeNodeModel.getNodeSnapshot(nodeId);
        const component = getComponent(node, RIGIDBODY2D_TYPE_ID);
        if (!component) throw Object.assign(new Error(`RigidBody2D component not found for node: ${nodeId}`), {
            code: 'NGVGE_RIGIDBODY2D_COMPONENT_NOT_FOUND'
        });
        const next = applyRigidBody2DPatch(component.data, patch);
        runtimeNodeModel.setComponentData(nodeId, component.id, next, {
            transactionId: mutationOptions.transactionId || `rigidbody2d:persistent-patch:${nodeId}`
        });
        dirtyDynamicBodies.add(component.id);
        descriptorSyncDirty = true;
        emit({componentId: component.id, nodeId, type: 'rigidbody:persistent-patch'});
        return freeze(clone(next));
    };
    const getRigidBody = nodeId => {
        const node = runtimeNodeModel.getNodeSnapshot(nodeId);
        const component = getComponent(node, RIGIDBODY2D_TYPE_ID);
        if (!component) return null;
        const config = normalizeRigidBody2D(component.data);
        const state = runtimeStates.get(component.id) || freeze({
            angularVelocity: config.angularVelocity,
            backendHandlePresent: false,
            position: null,
            sleeping: config.sleeping,
            velocity: config.velocity.slice()
        });
        return freeze({
            componentId: component.id,
            config,
            nodeId,
            state: clone(state)
        });
    };

    unsubscribeNodes = typeof runtimeNodeModel.subscribe === 'function' ? runtimeNodeModel.subscribe(change => {
        if (!change || !change.nodeId) return;
        const node = runtimeNodeModel.getNodeSnapshot(change.nodeId);
        const body = getComponent(node, RIGIDBODY2D_TYPE_ID);
        const componentTypeId = String(change.componentTypeId || '');
        if (body && (componentTypeId === RIGIDBODY2D_TYPE_ID || componentTypeId === TRANSFORM2D_TYPE_ID ||
            componentTypeId.indexOf('collider2d') !== -1)) dirtyDynamicBodies.add(body.id);
        if (change.type === 'node:create' || change.type === 'node:destroy' || change.type === 'runtime:replaced' ||
            componentTypeId === RIGIDBODY2D_TYPE_ID || componentTypeId === TRANSFORM2D_TYPE_ID ||
            componentTypeId.indexOf('collider2d') !== -1 || componentTypeId === CHARACTER_CONTROLLER2D_TYPE_ID) {
            descriptorSyncDirty = true;
        }
    }) : () => {};
    unsubscribeCollider = typeof colliderRuntimeService.subscribe === 'function' ? colliderRuntimeService.subscribe(change => {
        if (!change) return;
        if (change.type === 'collision:refresh' && change.reason === 'physics-step') return;
        if (change.type === 'area:enter' || change.type === 'area:exit') return;
        descriptorSyncDirty = true;
        if (change.nodeId) {
            const node = runtimeNodeModel.getNodeSnapshot(change.nodeId);
            const body = getComponent(node, RIGIDBODY2D_TYPE_ID);
            if (body && change.type !== 'collision:refresh') dirtyDynamicBodies.add(body.id);
        }
    }) : () => {};
    unsubscribeTransform = typeof transformRuntimeStore.subscribe === 'function' ? transformRuntimeStore.subscribe(() => {}) : () => {};
    unsubscribeScene = typeof sceneRuntime.subscribe === 'function' ? sceneRuntime.subscribe(() => resetWorld('scene-change')) : () => {};
    unsubscribeQuality = qualityPreferences && typeof qualityPreferences.subscribe === 'function' ?
        qualityPreferences.subscribe(change => {
            if (!change || change.kind !== 'physics') return;
            settings = resolveSettings();
            accumulator = 0;
            lastTimestamp = null;
            emit({
                fixedDeltaSeconds: settings.fixedDeltaSeconds,
                maxCatchUpSteps: settings.maxCatchUpSteps,
                quality: qualityPreferences.getPhysicsQuality(),
                type: 'physics:quality-change'
            });
        }) : () => {};
    const stopScheduledPhysics = () => {
        unregisterPhysicsPhase();
        unregisterPhysicsPhase = () => {};
        lastTimestamp = null;
    };
    const startScheduledPhysics = () => {
        stopScheduledPhysics();
        if (!phaseScheduler) return false;
        unregisterPhysicsPhase = phaseScheduler.registerFramePhase(
            RUNTIME_PHASE_IDS.PHYSICS2D,
            frame => {
                if (!running) return;
                schedulerTickCount += 1;
                const delta = Math.min(settings.maxFrameDeltaSeconds, Math.max(0, Number(frame.deltaSeconds) || 0));
                advance(delta, {timeBudgetMs: PHYSICS2D_SCHEDULER_TIME_BUDGET_MS});
            },
            {priority: RUNTIME_PHASE_PRIORITIES.PHYSICS2D}
        );
        return true;
    };
    if (scratchRuntime && typeof scratchRuntime.on === 'function') {
        const start = () => {
            running = true;
            resetWorld('project-start');
            startScheduledPhysics();
        };
        const stop = () => {
            running = false;
            stopScheduledPhysics();
            resetWorld('project-stop');
        };
        scratchRuntime.on('PROJECT_START', start);
        scratchRuntime.on('PROJECT_STOP_ALL', stop);
        // Physics is intentionally not attached to Scratch AFTER_EXECUTE. It runs as an independent
        // Runtime Phase Scheduler frame phase, so VM stalls do not synchronously accumulate physics work.
        detachScratchRuntime = () => {
            stopScheduledPhysics();
            if (typeof scratchRuntime.removeListener !== 'function') return;
            scratchRuntime.removeListener('PROJECT_START', start);
            scratchRuntime.removeListener('PROJECT_STOP_ALL', stop);
        };
    }

    initializeBackend();

    return Object.freeze({
        capabilityId: PHYSICS2D_RUNTIME_CAPABILITY_ID,
        version: PHYSICS2D_RUNTIME_CAPABILITY_VERSION,
        advance,
        dispose: () => {
            if (disposed) return;
            disposed = true;
            running = false;
            unsubscribeNodes();
            unsubscribeCollider();
            unsubscribeTransform();
            unsubscribeScene();
            unsubscribeQuality();
            detachScratchRuntime();
            if (worldRecord && worldRecord.world && typeof worldRecord.world.dispose === 'function') worldRecord.world.dispose();
            worldRecord = null;
            listeners.clear();
        },
        getRigidBody,
        getStatus: () => freeze({
            backendError: backendError ? {code: backendError.code || null, message: backendError.message || String(backendError)} : null,
            backendId: backendAdapter ? backendAdapter.backendId : null,
            backendReady: backendState === 'ready',
            backendState,
            cachedBodyDescriptorCount: descriptorCache.length,
            descriptorSyncDirty,
            disposed,
            fixedDeltaSeconds: settings.fixedDeltaSeconds,
            gravity: settings.gravity.slice(),
            maxCatchUpSteps: settings.maxCatchUpSteps,
            physicsQuality: qualityPreferences ? qualityPreferences.getPhysicsQuality() : null,
            droppedBacklogCount,
            droppedBacklogStepCount,
            running,
            runtimeRigidBodyCount: runtimeStates.size,
            schedulerBudgetExhaustionCount,
            schedulerTickCount,
            schedulerTimeBudgetMs: PHYSICS2D_SCHEDULER_TIME_BUDGET_MS,
            revision
        }),
        initializeBackend,
        listRigidBodies: () => Object.freeze(runtimeNodeModel.listNodes({includeRoots: false})
            .map(node => getRigidBody(node.id)).filter(Boolean)),
        patchPersistentRigidBody,
        reset: reason => resetWorld(reason || 'manual'),
        startSimulation: () => { running = true; resetWorld('manual-start'); return true; },
        stepFixed: () => fixedStep(settings.fixedDeltaSeconds),
        stopSimulation: () => { running = false; resetWorld('manual-stop'); return true; },
        subscribe: listener => {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    });
};

module.exports = {
    PHYSICS2D_RUNTIME_CAPABILITY_ID,
    PHYSICS2D_RUNTIME_CAPABILITY_VERSION,
    RIGIDBODY2D_RUNTIME_COMPONENT_DESCRIPTOR,
    createPhysics2DRuntimeService,
    createRigidBody2DComponentOptions,
    registerRigidBody2DComponent
};
