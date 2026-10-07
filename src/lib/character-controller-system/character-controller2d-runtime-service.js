'use strict';

const {
    CHARACTER_CONTROLLER2D_COMPONENT_OWNER,
    CHARACTER_CONTROLLER2D_SCHEMA_VERSION,
    CHARACTER_CONTROLLER2D_TYPE_ID,
    applyCharacterController2DPatch,
    normalizeCharacterController2D
} = require('../../core/character-controller2d');
const {COLLIDER2D_TYPE_ID} = require('../../core/collider2d');
const {TRANSFORM2D_TYPE_ID, normalizeTransform2D} = require('../../core/transform2d');
const {
    collisionFiltersMatch,
    convexPolygonsOverlap
} = require('../collision-system/collider2d-runtime-service');
const {COMPONENT_CARDINALITIES} = require('../runtime-nodes/runtime-component-contract');
const {worldDeltaToNodeLocalDelta} = require('../transform-system/transform2d-hierarchy-projection');
const {FRAME_PROFILER_CATEGORY, getFrameTimeProfiler} = require('../frame-profiler');
const {createRapier2DShapeQueryBackend} = require('../physics-system/rapier2d-shape-query-backend');

const CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_ID = 'ngvge.character-controller2d-runtime';
const CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_VERSION = 1;
const EPSILON = 1e-8;
const CONTACT_SLOP = 1e-4;
const STABLE_CONTACT_NODE_BONUS = 0.05;
const STABLE_CONTACT_NORMAL_BONUS = 0.02;

const CHARACTER_CONTROLLER2D_RUNTIME_COMPONENT_DESCRIPTOR = Object.freeze({
    cardinality: COMPONENT_CARDINALITIES.ONE,
    ownerModuleId: CHARACTER_CONTROLLER2D_COMPONENT_OWNER,
    schemaVersion: CHARACTER_CONTROLLER2D_SCHEMA_VERSION,
    typeId: CHARACTER_CONTROLLER2D_TYPE_ID
});

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return Object.freeze(value);
};

const clonePortable = value => JSON.parse(JSON.stringify(value));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const subtract = (a, b) => [a[0] - b[0], a[1] - b[1]];
const scale = (value, scalar) => [value[0] * scalar, value[1] * scalar];
const length = value => Math.hypot(value[0], value[1]);
const normalize = value => {
    const magnitude = length(value);
    return magnitude <= EPSILON ? [0, 0] : [value[0] / magnitude, value[1] / magnitude];
};
const translatePoints = (points, motion) => points.map(point => add(point, motion));
const centerOfPoints = points => points.length ? scale(points.reduce((sum, point) => add(sum, point), [0, 0]), 1 / points.length) : [0, 0];

const projectPolygon = (points, axis) => points.reduce((projection, point) => {
    const value = dot(point, axis);
    return {max: Math.max(projection.max, value), min: Math.min(projection.min, value)};
}, {max: -Infinity, min: Infinity});

const polygonAxes = points => points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    const edge = subtract(next, point);
    const magnitude = length(edge);
    return magnitude <= EPSILON ? null : [-edge[1] / magnitude, edge[0] / magnitude];
}).filter(Boolean);

const convexPolygonPenetration = (movingPoints, staticPoints) => {
    if (!movingPoints.length || !staticPoints.length || !convexPolygonsOverlap(movingPoints, staticPoints)) return null;
    const movingCenter = centerOfPoints(movingPoints);
    const staticCenter = centerOfPoints(staticPoints);
    let depth = Infinity;
    let normal = null;
    for (const axis of polygonAxes(movingPoints).concat(polygonAxes(staticPoints))) {
        const movingProjection = projectPolygon(movingPoints, axis);
        const staticProjection = projectPolygon(staticPoints, axis);
        const overlap = Math.min(movingProjection.max, staticProjection.max) -
            Math.max(movingProjection.min, staticProjection.min);
        if (overlap < -EPSILON) return null;
        if (overlap < depth) {
            depth = Math.max(0, overlap);
            const direction = subtract(movingCenter, staticCenter);
            normal = dot(direction, axis) >= 0 ? axis.slice() : scale(axis, -1);
        }
    }
    return normal ? {depth, normal: normalize(normal)} : null;
};

/**
 * Continuous SAT for a convex polygon translated by `motion` against a stationary convex polygon.
 * Rotation/shape are fixed for the duration of one CharacterController2D move.
 */
const sweepConvexPolygons = (movingPoints, motionValue, staticPoints) => {
    const motion = [Number(motionValue[0]) || 0, Number(motionValue[1]) || 0];
    if (!movingPoints.length || !staticPoints.length || length(motion) <= EPSILON) return null;

    const penetration = convexPolygonPenetration(movingPoints, staticPoints);
    if (penetration && penetration.depth > CONTACT_SLOP) {
        return {
            initialOverlap: true,
            normal: penetration.normal,
            penetrationDepth: penetration.depth,
            t: 0
        };
    }

    let entryTime = -Infinity;
    let exitTime = Infinity;
    let hitNormal = null;
    const axes = polygonAxes(movingPoints).concat(polygonAxes(staticPoints));
    for (const axis of axes) {
        const movingProjection = projectPolygon(movingPoints, axis);
        const staticProjection = projectPolygon(staticPoints, axis);
        const speed = dot(motion, axis);
        if (Math.abs(speed) <= EPSILON) {
            if (movingProjection.max < staticProjection.min - EPSILON ||
                staticProjection.max < movingProjection.min - EPSILON) return null;
            continue;
        }

        let axisEntry;
        let axisExit;
        let axisNormal;
        if (speed > 0) {
            axisEntry = (staticProjection.min - movingProjection.max) / speed;
            axisExit = (staticProjection.max - movingProjection.min) / speed;
            axisNormal = scale(axis, -1);
        } else {
            axisEntry = (staticProjection.max - movingProjection.min) / speed;
            axisExit = (staticProjection.min - movingProjection.max) / speed;
            axisNormal = axis.slice();
        }
        if (axisEntry > entryTime) {
            entryTime = axisEntry;
            hitNormal = axisNormal;
        }
        exitTime = Math.min(exitTime, axisExit);
        if (entryTime - EPSILON > exitTime) return null;
    }

    if (!hitNormal || exitTime < -EPSILON || entryTime > 1 + EPSILON) return null;
    const t = Math.max(0, Math.min(1, entryTime));
    let normal = normalize(hitNormal);
    // SAT axes have arbitrary sign. Orient the contact normal from the static surface toward the moving body
    // at impact so floor/wall classification and touching-away rejection are deterministic.
    const movingCenterAtImpact = add(centerOfPoints(movingPoints), scale(motion, t));
    const staticCenter = centerOfPoints(staticPoints);
    if (dot(subtract(movingCenterAtImpact, staticCenter), normal) < 0) normal = scale(normal, -1);
    // A touching polygon moving away from the surface must not be reported as a new collision.
    if (t <= EPSILON && dot(motion, normal) >= -EPSILON) return null;
    return {
        initialOverlap: false,
        normal,
        penetrationDepth: 0,
        t
    };
};

const getComponent = (node, typeId) => {
    const components = node && Array.isArray(node.components) ? node.components : [];
    return components.find(component => component && component.typeId === typeId) || null;
};

const createCharacterController2DComponentOptions = (data, options = {}) => {
    const result = {
        data: normalizeCharacterController2D(data),
        enabled: options.enabled !== false,
        schemaVersion: CHARACTER_CONTROLLER2D_SCHEMA_VERSION,
        typeId: CHARACTER_CONTROLLER2D_TYPE_ID
    };
    if (options.componentId) result.id = String(options.componentId);
    return result;
};

const registerCharacterController2DComponent = typeRegistration => {
    if (!typeRegistration || typeof typeRegistration.getComponentTypeDescriptor !== 'function' ||
        typeof typeRegistration.registerComponentTypeDescriptor !== 'function') {
        throw new TypeError('CharacterController2D requires Runtime Node Type Registration capability.');
    }
    const existing = typeRegistration.getComponentTypeDescriptor(CHARACTER_CONTROLLER2D_TYPE_ID);
    if (existing && existing.ownerModuleId === CHARACTER_CONTROLLER2D_COMPONENT_OWNER &&
        existing.schemaVersion === CHARACTER_CONTROLLER2D_SCHEMA_VERSION && existing.cardinality === COMPONENT_CARDINALITIES.ONE) {
        return existing;
    }
    return typeRegistration.registerComponentTypeDescriptor(
        CHARACTER_CONTROLLER2D_RUNTIME_COMPONENT_DESCRIPTOR,
        {replace: Boolean(existing)}
    );
};

const createRuntimeState = () => ({
    collisions: [],
    floorNodeId: null,
    floorNormal: [0, 0],
    floorPlatformPosition: null,
    lastSafeTransform: null,
    lastSafeWorldOrigin: null,
    onFloor: false,
    onWall: false,
    recoveryCount: 0,
    recoveryStatus: 'uninitialized',
    stableFloorNodeId: null,
    stableFloorNormal: [0, 0],
    stableWallNodeId: null,
    stableWallNormal: [0, 0],
    velocity: [0, 0],
    wallNodeId: null,
    wallNormal: [0, 0],
    _floorSelectionScore: -Infinity,
    _wallSelectionScore: -Infinity
});

const publicRuntimeState = state => ({
    collisions: state.collisions,
    floorNodeId: state.floorNodeId,
    floorNormal: state.floorNormal,
    floorPlatformPosition: state.floorPlatformPosition,
    lastSafeWorldOrigin: state.lastSafeWorldOrigin,
    onFloor: state.onFloor,
    onWall: state.onWall,
    recoveryCount: state.recoveryCount,
    recoveryStatus: state.recoveryStatus,
    stableFloorNodeId: state.stableFloorNodeId,
    stableFloorNormal: state.stableFloorNormal,
    stableWallNodeId: state.stableWallNodeId,
    stableWallNormal: state.stableWallNormal,
    velocity: state.velocity,
    wallNodeId: state.wallNodeId,
    wallNormal: state.wallNormal
});

const createCharacterController2DRuntimeService = options => {
    const runtimeNodeModel = options && options.runtimeNodeModel;
    const typeRegistration = options && options.typeRegistration;
    const transformRuntimeStore = options && options.transformRuntimeStore;
    const colliderRuntimeService = options && options.colliderRuntimeService;
    const sceneRuntime = options && options.sceneRuntime;
    const scratchRuntime = options && options.scratchRuntime;
    const frameProfiler = scratchRuntime ? getFrameTimeProfiler(scratchRuntime) : null;
    const shapeQueryBackendLoader = options && options.shapeQueryBackendLoader;
    const shapeQueryBackendFactory = options && options.shapeQueryBackendFactory ?
        options.shapeQueryBackendFactory : createRapier2DShapeQueryBackend;

    if (!runtimeNodeModel || typeof runtimeNodeModel.listNodes !== 'function' ||
        typeof runtimeNodeModel.getNodeSnapshot !== 'function' || typeof runtimeNodeModel.subscribe !== 'function' ||
        typeof runtimeNodeModel.setComponentData !== 'function') {
        throw new TypeError('CharacterController2D Runtime Service requires Runtime Node Model capability.');
    }
    if (!transformRuntimeStore || typeof transformRuntimeStore.getRuntimeTransform !== 'function' ||
        typeof transformRuntimeStore.getPersistentTransform !== 'function' ||
        typeof transformRuntimeStore.patchRuntimeTransform !== 'function' ||
        typeof transformRuntimeStore.replaceRuntimeTransform !== 'function' ||
        typeof transformRuntimeStore.hydrateNodeFromPersistent !== 'function') {
        throw new TypeError('CharacterController2D Runtime Service requires Transform2D Runtime Store.');
    }
    if (!colliderRuntimeService || typeof colliderRuntimeService.getCollider !== 'function' ||
        typeof colliderRuntimeService.listColliders !== 'function') {
        throw new TypeError('CharacterController2D Runtime Service requires Collider2D Runtime Service.');
    }
    if (!sceneRuntime || typeof sceneRuntime.getActiveSceneId !== 'function') {
        throw new TypeError('CharacterController2D Runtime Service requires Scene Runtime capability.');
    }

    registerCharacterController2DComponent(typeRegistration);
    const states = new Map();
    const listeners = new Set();
    let disposed = false;
    let revision = 0;
    let unsubscribeNodes = () => {};
    let unsubscribeScene = () => {};
    let detachRuntimeLifecycle = () => {};
    let shapeQueryBackend = options && options.shapeQueryBackend ? options.shapeQueryBackend : null;
    let shapeQueryBackendError = null;
    let shapeQueryBackendPromise = null;
    let shapeQueryBackendState = shapeQueryBackend ? 'ready' : 'unavailable';

    const emit = change => {
        revision += 1;
        const event = deepFreeze(Object.assign({revision}, clonePortable(change || {})));
        listeners.forEach(listener => {
            try { listener(event); } catch { /* advisory listener */ }
        });
        return event;
    };

    const initializeShapeQueryBackend = () => {
        if (shapeQueryBackend) {
            shapeQueryBackendState = 'ready';
            return Promise.resolve(true);
        }
        if (shapeQueryBackendPromise) return shapeQueryBackendPromise;
        if (typeof shapeQueryBackendLoader !== 'function') {
            shapeQueryBackendState = 'unavailable';
            return Promise.resolve(false);
        }
        shapeQueryBackendState = 'initializing';
        shapeQueryBackendPromise = Promise.resolve().then(() => shapeQueryBackendLoader()).then(moduleValue => {
            shapeQueryBackend = shapeQueryBackendFactory({RAPIER: moduleValue});
            shapeQueryBackendError = null;
            shapeQueryBackendState = 'ready';
            emit({backendId: shapeQueryBackend.backendId || null, type: 'character:shape-query-backend-ready'});
            return true;
        }).catch(error => {
            shapeQueryBackend = null;
            shapeQueryBackendError = error;
            shapeQueryBackendState = 'failed';
            emit({code: error && error.code, message: error && error.message, type: 'character:shape-query-backend-failed'});
            return false;
        });
        return shapeQueryBackendPromise;
    };

    const getControllerComponent = node => getComponent(node, CHARACTER_CONTROLLER2D_TYPE_ID);

    const ensureState = nodeId => {
        if (!states.has(nodeId)) states.set(nodeId, createRuntimeState());
        return states.get(nodeId);
    };

    const buildControllerView = node => {
        if (!node) return null;
        const component = getControllerComponent(node);
        if (!component) return null;
        const colliderComponent = getComponent(node, COLLIDER2D_TYPE_ID);
        const transformComponent = getComponent(node, TRANSFORM2D_TYPE_ID);
        const state = ensureState(node.id);
        const transform = transformRuntimeStore.getRuntimeTransform(node.id) ||
            (transformComponent ? normalizeTransform2D(transformComponent.data) : normalizeTransform2D());
        const colliderView = colliderRuntimeService.getCollider(node.id);
        return deepFreeze({
            active: node.activeInHierarchy !== false && component.activeInHierarchy !== false && component.enabled !== false,
            colliderComponentId: colliderComponent ? colliderComponent.id : null,
            componentId: component.id,
            config: normalizeCharacterController2D(component.data),
            name: node.name,
            nodeId: node.id,
            sceneId: node.sceneId,
            state: clonePortable(publicRuntimeState(state)),
            transform: clonePortable(transform),
            worldOrigin: colliderView && colliderView.worldOrigin ? colliderView.worldOrigin.slice() : transform.position.slice()
        });
    };

    const getController = nodeId => buildControllerView(runtimeNodeModel.getNodeSnapshot(nodeId));
    const listControllers = (sceneId = sceneRuntime.getActiveSceneId()) => runtimeNodeModel.listNodes({
        includeRoots: false,
        sceneId
    }).map(buildControllerView).filter(Boolean).filter(controller => controller.active);

    const assertMovableController = nodeId => {
        const controller = getController(nodeId);
        if (!controller) {
            throw Object.assign(new Error(`CharacterController2D component not found for node: ${nodeId}`), {
                code: 'NGVGE_CHARACTER_CONTROLLER2D_COMPONENT_NOT_FOUND'
            });
        }
        const collider = colliderRuntimeService.getCollider(nodeId);
        if (!collider || !collider.active) {
            throw Object.assign(new Error('CharacterBody2D requires an active Collider2D component.'), {
                code: 'NGVGE_CHARACTER_CONTROLLER2D_COLLIDER_REQUIRED'
            });
        }
        if (collider.config.sensor) {
            throw Object.assign(new Error('CharacterBody2D Collider2D must be solid (sensor=false).'), {
                code: 'NGVGE_CHARACTER_CONTROLLER2D_SOLID_COLLIDER_REQUIRED'
            });
        }
        return {collider, controller};
    };

    const solidCandidates = collider => colliderRuntimeService.listColliders(collider.sceneId).filter(other => (
        other.nodeId !== collider.nodeId && other.active && !other.config.sensor &&
        collisionFiltersMatch(collider.config, other.config)
    ));

    const measureCharacterQuery = callback => (frameProfiler ?
        frameProfiler.measure(FRAME_PROFILER_CATEGORY.CHARACTER_COLLISION_QUERY, callback) : callback());

    const createCollisionQuerySession = (nodeId, colliderValue) => {
        const collider = colliderValue || colliderRuntimeService.getCollider(nodeId);
        if (!collider || !collider.active || collider.config.sensor) return null;
        const candidates = solidCandidates(collider);
        const backend = shapeQueryBackendState === 'ready' ? shapeQueryBackend : null;
        const preparedMoving = backend && typeof backend.prepareCollider === 'function' ? backend.prepareCollider(collider) : null;
        const preparedCandidates = backend && preparedMoving ? candidates.map(candidate => ({
            collider: candidate,
            prepared: backend.prepareCollider(candidate)
        })).filter(entry => entry.prepared) : [];
        if (frameProfiler) {
            frameProfiler.count('characterCollisionQuerySessions', 1);
            frameProfiler.count('characterCollisionCandidates', candidates.length);
            if (preparedMoving) {
                frameProfiler.count('characterRapierQuerySessions', 1);
                frameProfiler.count('characterRapierPreparedCandidates', preparedCandidates.length);
            }
        }
        return {
            backend,
            candidates,
            collider,
            nodeId,
            preparedCandidates,
            preparedMoving
        };
    };

    const translateCollisionQuerySession = (session, worldDelta) => {
        if (!session || !session.backend || !session.preparedMoving ||
            typeof session.backend.translatePrepared !== 'function') return;
        session.preparedMoving = session.backend.translatePrepared(session.preparedMoving, worldDelta);
    };

    const syncCollisionQuerySessionPosition = (session, nodeId) => {
        if (!session || session.nodeId !== nodeId || !session.backend || !session.preparedMoving ||
            typeof session.backend.withPosition !== 'function') return;
        const collider = colliderRuntimeService.getCollider(nodeId);
        if (!collider) return;
        const prepared = session.backend.prepareCollider(collider);
        if (!prepared) return;
        session.preparedMoving = session.backend.withPosition(session.preparedMoving, prepared.position);
        session.collider = collider;
    };

    const findPenetratingCollision = (nodeId, querySession = null) => measureCharacterQuery(() => {
        const collider = colliderRuntimeService.getCollider(nodeId);
        if (!collider || !collider.active || collider.config.sensor) return null;
        const session = querySession || createCollisionQuerySession(nodeId, collider);
        let deepest = null;
        if (session && session.backend && session.preparedMoving &&
            session.preparedCandidates.length === session.candidates.length && session.preparedCandidates.length) {
            session.preparedCandidates.forEach(entry => {
                const penetration = session.backend.penetrationPrepared(session.preparedMoving, entry.prepared);
                if (frameProfiler) frameProfiler.count('characterRapierContactQueries', 1);
                if (!penetration || penetration.depth <= CONTACT_SLOP) return;
                const other = entry.collider;
                const candidate = {
                    componentId: other.componentId,
                    depth: penetration.depth,
                    name: other.name,
                    nodeId: other.nodeId,
                    normal: penetration.normal.slice()
                };
                if (!deepest || candidate.depth > deepest.depth + CONTACT_SLOP ||
                    (Math.abs(candidate.depth - deepest.depth) <= CONTACT_SLOP &&
                        candidate.nodeId.localeCompare(deepest.nodeId) < 0)) deepest = candidate;
            });
        } else {
            const candidates = session ? session.candidates : solidCandidates(collider);
            candidates.forEach(other => {
                const penetration = convexPolygonPenetration(collider.worldPoints, other.worldPoints);
                if (frameProfiler) frameProfiler.count('characterSatPenetrationQueries', 1);
                if (!penetration || penetration.depth <= CONTACT_SLOP) return;
                const candidate = {
                    componentId: other.componentId,
                    depth: penetration.depth,
                    name: other.name,
                    nodeId: other.nodeId,
                    normal: penetration.normal.slice()
                };
                if (!deepest || candidate.depth > deepest.depth + CONTACT_SLOP ||
                    (Math.abs(candidate.depth - deepest.depth) <= CONTACT_SLOP &&
                        candidate.nodeId.localeCompare(deepest.nodeId) < 0)) deepest = candidate;
            });
        }
        return deepest ? deepFreeze(deepest) : null;
    });

    const isPlacementLegal = (nodeId, querySession = null) => !findPenetratingCollision(nodeId, querySession);

    const captureSafePlacement = (nodeId, querySession = null) => {
        const state = ensureState(nodeId);
        if (!isPlacementLegal(nodeId, querySession)) return false;
        const transform = transformRuntimeStore.getRuntimeTransform(nodeId) ||
            transformRuntimeStore.getPersistentTransform(nodeId);
        const collider = colliderRuntimeService.getCollider(nodeId);
        if (!transform || !collider) return false;
        state.lastSafeTransform = clonePortable(transform);
        state.lastSafeWorldOrigin = collider.worldOrigin ? collider.worldOrigin.slice() : null;
        state.recoveryStatus = 'stable';
        return true;
    };

    const restoreLastSafePlacement = (nodeId, querySession = null) => {
        const state = ensureState(nodeId);
        if (!state.lastSafeTransform) {
            state.recoveryStatus = 'failed-no-anchor';
            return false;
        }
        const before = transformRuntimeStore.getRuntimeTransform(nodeId) ||
            transformRuntimeStore.getPersistentTransform(nodeId);
        try {
            transformRuntimeStore.replaceRuntimeTransform(nodeId, clonePortable(state.lastSafeTransform));
            syncCollisionQuerySessionPosition(querySession, nodeId);
        } catch {
            state.recoveryStatus = 'failed-restore';
            return false;
        }
        if (!isPlacementLegal(nodeId, querySession)) {
            if (before) {
                try { transformRuntimeStore.replaceRuntimeTransform(nodeId, before); syncCollisionQuerySessionPosition(querySession, nodeId); } catch { /* best effort rollback */ }
            }
            state.recoveryStatus = 'failed-anchor-invalid';
            return false;
        }
        const collider = colliderRuntimeService.getCollider(nodeId);
        state.lastSafeWorldOrigin = collider && collider.worldOrigin ? collider.worldOrigin.slice() : state.lastSafeWorldOrigin;
        state.recoveryCount += 1;
        state.recoveryStatus = 'restored-last-safe';
        state.velocity = [0, 0];
        state.collisions = [];
        state.floorNodeId = null;
        state.floorNormal = [0, 0];
        state.floorPlatformPosition = null;
        state.onFloor = false;
        state.onWall = false;
        state.wallNodeId = null;
        state.wallNormal = [0, 0];
        state._floorSelectionScore = -Infinity;
        state._wallSelectionScore = -Infinity;
        emit({
            nodeId,
            recoveryCount: state.recoveryCount,
            type: 'character:recovered-last-safe'
        });
        return true;
    };

    const validateOrRecoverPlacement = (nodeId, querySession = null) => {
        if (isPlacementLegal(nodeId, querySession)) {
            captureSafePlacement(nodeId, querySession);
            return false;
        }
        return restoreLastSafePlacement(nodeId, querySession);
    };

    const findEarliestCollision = (nodeId, motionValue, queryOptions = {}) => measureCharacterQuery(() => {
        const {collider} = assertMovableController(nodeId);
        const motion = [Number(motionValue[0]) || 0, Number(motionValue[1]) || 0];
        if (length(motion) <= EPSILON) return null;
        const excluded = new Set(Array.isArray(queryOptions.excludeNodeIds) ? queryOptions.excludeNodeIds : []);
        const session = queryOptions.querySession || createCollisionQuerySession(nodeId, collider);
        let nearest = null;
        if (session && session.backend && session.preparedMoving &&
            session.preparedCandidates.length === session.candidates.length && session.preparedCandidates.length) {
            session.preparedCandidates.forEach(entry => {
                const other = entry.collider;
                if (excluded.has(other.nodeId)) return;
                const sweep = session.backend.castPrepared(session.preparedMoving, motion, entry.prepared);
                if (frameProfiler) frameProfiler.count('characterRapierShapeCasts', 1);
                if (!sweep) return;
                const candidate = Object.assign({}, sweep, {
                    componentId: other.componentId,
                    impactCenter: add(session.preparedMoving.position, scale(motion, sweep.t)),
                    name: other.name,
                    nodeId: other.nodeId,
                    sensor: other.config.sensor
                });
                if (!nearest || candidate.t < nearest.t - EPSILON ||
                    (Math.abs(candidate.t - nearest.t) <= EPSILON && candidate.nodeId.localeCompare(nearest.nodeId) < 0)) {
                    nearest = candidate;
                }
            });
            return nearest ? deepFreeze(nearest) : null;
        }
        const currentCollider = colliderRuntimeService.getCollider(nodeId) || collider;
        const candidates = session ? session.candidates : solidCandidates(currentCollider);
        candidates.forEach(other => {
            if (excluded.has(other.nodeId)) return;
            const sweep = sweepConvexPolygons(currentCollider.worldPoints, motion, other.worldPoints);
            if (frameProfiler) frameProfiler.count('characterSatShapeCasts', 1);
            if (!sweep) return;
            const candidate = Object.assign({}, sweep, {
                componentId: other.componentId,
                name: other.name,
                nodeId: other.nodeId,
                sensor: other.config.sensor
            });
            if (!nearest || candidate.t < nearest.t - EPSILON ||
                (Math.abs(candidate.t - nearest.t) <= EPSILON && candidate.nodeId.localeCompare(nearest.nodeId) < 0)) {
                nearest = candidate;
            }
        });
        return nearest ? deepFreeze(candidateWithImpact(currentCollider.worldPoints, motion, nearest)) : null;
    });

    const candidateWithImpact = (movingPoints, motion, candidate) => {
        const impactCenter = add(centerOfPoints(movingPoints), scale(motion, candidate.t));
        return Object.assign({}, candidate, {impactCenter});
    };

    const patchPositionBy = (nodeId, worldDelta, querySession = null) => {
        if (length(worldDelta) <= EPSILON) return transformRuntimeStore.getRuntimeTransform(nodeId);
        const localDelta = worldDeltaToNodeLocalDelta(
            worldDelta,
            nodeId,
            runtimeNodeModel,
            transformRuntimeStore
        );
        const current = transformRuntimeStore.getRuntimeTransform(nodeId) || transformRuntimeStore.getPersistentTransform(nodeId);
        const nextPosition = add(current.position, localDelta);
        const snapshot = transformRuntimeStore.patchRuntimeTransform(nodeId, {position: nextPosition});
        translateCollisionQuerySession(querySession, worldDelta);
        return snapshot && snapshot.transform ? snapshot.transform : transformRuntimeStore.getRuntimeTransform(nodeId);
    };

    const classifyNormal = (normal, config) => {
        const up = config.upDirection;
        const alignment = dot(normal, up);
        const floorThreshold = Math.cos(config.maxSlopeDegrees * Math.PI / 180);
        return {
            ceiling: alignment <= -floorThreshold,
            floor: alignment >= floorThreshold,
            wall: Math.abs(alignment) < floorThreshold
        };
    };

    const resetContacts = state => {
        state.collisions = [];
        state.floorNodeId = null;
        state.floorNormal = [0, 0];
        state.floorPlatformPosition = null;
        state.onFloor = false;
        state.onWall = false;
        state.wallNodeId = null;
        state.wallNormal = [0, 0];
        state._floorSelectionScore = -Infinity;
        state._wallSelectionScore = -Infinity;
    };

    const contactStabilityBonus = (collision, stableNodeId, stableNormal) => {
        let score = 0;
        if (collision.nodeId && collision.nodeId === stableNodeId) score += STABLE_CONTACT_NODE_BONUS;
        if (Array.isArray(stableNormal) && stableNormal.length === 2) {
            score += Math.max(0, dot(collision.normal, stableNormal)) * STABLE_CONTACT_NORMAL_BONUS;
        }
        return score;
    };

    const recordCollision = (nodeId, collision, config) => {
        if (!collision) return;
        const state = ensureState(nodeId);
        const classification = classifyNormal(collision.normal, config);
        const upAlignment = dot(collision.normal, config.upDirection);
        state.collisions.push(clonePortable(collision));
        if (classification.floor) {
            const score = upAlignment +
                contactStabilityBonus(collision, state.stableFloorNodeId, state.stableFloorNormal);
            if (!state.onFloor || score > state._floorSelectionScore + EPSILON) {
                state.onFloor = true;
                state._floorSelectionScore = score;
                state.floorNormal = collision.normal.slice();
                state.floorNodeId = collision.nodeId;
                const floorCollider = colliderRuntimeService.getCollider(collision.nodeId);
                state.floorPlatformPosition = floorCollider && floorCollider.worldOrigin ?
                    floorCollider.worldOrigin.slice() : null;
            }
        }
        if (classification.wall) {
            const score = (1 - Math.abs(upAlignment)) +
                contactStabilityBonus(collision, state.stableWallNodeId, state.stableWallNormal);
            if (!state.onWall || score > state._wallSelectionScore + EPSILON) {
                state.onWall = true;
                state._wallSelectionScore = score;
                state.wallNormal = collision.normal.slice();
                state.wallNodeId = collision.nodeId;
            }
        }
    };

    const finalizeStableContacts = state => {
        if (state.onFloor && state.floorNodeId) {
            state.stableFloorNodeId = state.floorNodeId;
            state.stableFloorNormal = state.floorNormal.slice();
        }
        if (state.onWall && state.wallNodeId) {
            state.stableWallNodeId = state.wallNodeId;
            state.stableWallNormal = state.wallNormal.slice();
        }
    };

    const carryByPreviousFloor = (nodeId, querySession = null) => {
        const state = ensureState(nodeId);
        if (!state.floorNodeId || !state.floorPlatformPosition) return [0, 0];
        const floorCollider = colliderRuntimeService.getCollider(state.floorNodeId);
        if (!floorCollider || !floorCollider.active || floorCollider.config.sensor || !floorCollider.worldOrigin) return [0, 0];
        const delta = subtract(floorCollider.worldOrigin, state.floorPlatformPosition);
        if (length(delta) > EPSILON) patchPositionBy(nodeId, delta, querySession);
        state.floorPlatformPosition = floorCollider.worldOrigin.slice();
        return delta;
    };

    const moveAndCollideInternal = (nodeId, motionValue, controller, internalOptions = {}) => {
        const querySession = internalOptions.querySession || null;
        const motion = [Number(motionValue[0]) || 0, Number(motionValue[1]) || 0];
        if (length(motion) <= EPSILON) return deepFreeze({
            collided: false,
            collision: null,
            remainder: [0, 0],
            travel: [0, 0]
        });
        const hit = findEarliestCollision(nodeId, motion, internalOptions);
        if (!hit) {
            patchPositionBy(nodeId, motion, querySession);
            return deepFreeze({
                collided: false,
                collision: null,
                remainder: [0, 0],
                travel: motion.slice()
            });
        }

        const motionLength = length(motion);
        const nominalTravelLength = motionLength * hit.t;
        const separationMargin = Math.max(controller.config.safeMargin, CONTACT_SLOP * 0.5);
        const safeTravelLength = Math.max(0, nominalTravelLength - separationMargin);
        const safeT = motionLength <= EPSILON ? 0 : safeTravelLength / motionLength;
        const travel = scale(motion, safeT);
        const remainder = scale(motion, Math.max(0, 1 - hit.t));
        if (length(travel) > EPSILON) patchPositionBy(nodeId, travel, querySession);
        const collision = deepFreeze(Object.assign({}, clonePortable(hit), {
            remainder,
            travel
        }));
        return deepFreeze({
            collided: true,
            collision,
            remainder,
            travel
        });
    };

    const tryStep = (nodeId, wallCollision, remainder, controller, querySession = null) => {
        const config = controller.config;
        if (config.stepHeight <= EPSILON || !classifyNormal(wallCollision.normal, config).wall || length(remainder) <= EPSILON) {
            return null;
        }
        const upMotion = scale(config.upDirection, config.stepHeight);
        if (findEarliestCollision(nodeId, upMotion, {querySession})) return null;
        const beforeStep = transformRuntimeStore.getRuntimeTransform(nodeId);
        patchPositionBy(nodeId, upMotion, querySession);
        const forward = moveAndCollideInternal(nodeId, remainder, controller, {querySession});
        const forwardBlockedBySameSurface = forward.collided && forward.collision &&
            forward.collision.nodeId === wallCollision.nodeId &&
            length(forward.travel) <= Math.max(config.safeMargin * 2, CONTACT_SLOP * 4);
        if (length(forward.travel) <= EPSILON || forwardBlockedBySameSurface) {
            transformRuntimeStore.replaceRuntimeTransform(nodeId, beforeStep);
            syncCollisionQuerySessionPosition(querySession, nodeId);
            return null;
        }

        const downDistance = config.stepHeight + config.floorSnapLength;
        const downMotion = scale(config.upDirection, -downDistance);
        const floorHit = findEarliestCollision(nodeId, downMotion, {querySession});
        if (!floorHit || !classifyNormal(floorHit.normal, config).floor) {
            transformRuntimeStore.replaceRuntimeTransform(nodeId, beforeStep);
            syncCollisionQuerySessionPosition(querySession, nodeId);
            return null;
        }
        const snapped = moveAndCollideInternal(nodeId, downMotion, controller, {querySession});
        return deepFreeze({forward, floor: snapped, stepped: true});
    };

    const snapToFloor = (nodeId, controller, querySession = null) => {
        const config = controller.config;
        if (config.floorSnapLength <= EPSILON) return null;
        const state = ensureState(nodeId);
        if (state.onFloor || dot(state.velocity, config.upDirection) > EPSILON) return null;
        const downMotion = scale(config.upDirection, -config.floorSnapLength);
        const hit = findEarliestCollision(nodeId, downMotion, {querySession});
        if (!hit || !classifyNormal(hit.normal, config).floor) return null;
        const result = moveAndCollideInternal(nodeId, downMotion, controller, {querySession});
        if (result.collided) recordCollision(nodeId, result.collision, config);
        return result;
    };

    const moveAndCollide = (nodeId, motionValue) => {
        const {collider, controller} = assertMovableController(nodeId);
        const state = ensureState(nodeId);
        const querySession = createCollisionQuerySession(nodeId, collider);
        captureSafePlacement(nodeId, querySession);
        carryByPreviousFloor(nodeId, querySession);
        resetContacts(state);
        const result = moveAndCollideInternal(nodeId, motionValue, controller, {querySession});
        if (result.collided) recordCollision(nodeId, result.collision, controller.config);
        finalizeStableContacts(state);
        const recovered = validateOrRecoverPlacement(nodeId, querySession);
        emit({
            collided: result.collided,
            nodeId,
            recovered,
            recoveryStatus: state.recoveryStatus,
            type: 'character:move-and-collide'
        });
        return deepFreeze(Object.assign({}, clonePortable(result), {
            recovered,
            recoveryStatus: state.recoveryStatus
        }));
    };

    const moveAndSlide = (nodeId, motionValue) => {
        const {collider, controller} = assertMovableController(nodeId);
        const state = ensureState(nodeId);
        const querySession = createCollisionQuerySession(nodeId, collider);
        captureSafePlacement(nodeId, querySession);
        const platformDelta = carryByPreviousFloor(nodeId, querySession);
        resetContacts(state);
        let remaining = [Number(motionValue[0]) || 0, Number(motionValue[1]) || 0];
        let totalTravel = platformDelta.slice();
        let slides = 0;

        while (slides < controller.config.maxSlides && length(remaining) > EPSILON) {
            const result = moveAndCollideInternal(nodeId, remaining, controller, {querySession});
            totalTravel = add(totalTravel, result.travel);
            if (!result.collided) {
                remaining = [0, 0];
                break;
            }
            recordCollision(nodeId, result.collision, controller.config);
            const stepped = tryStep(nodeId, result.collision, result.remainder, controller, querySession);
            if (stepped) {
                totalTravel = add(totalTravel, add(stepped.forward.travel, stepped.floor.travel));
                if (stepped.floor.collided) recordCollision(nodeId, stepped.floor.collision, controller.config);
                remaining = [0, 0];
                break;
            }

            const normal = result.collision.normal;
            const remainderDot = dot(result.remainder, normal);
            remaining = remainderDot < 0 ? subtract(result.remainder, scale(normal, remainderDot)) : result.remainder.slice();
            const velocityDot = dot(state.velocity, normal);
            if (velocityDot < 0) state.velocity = subtract(state.velocity, scale(normal, velocityDot));
            slides += 1;
        }

        const snapped = snapToFloor(nodeId, controller, querySession);
        if (snapped) totalTravel = add(totalTravel, snapped.travel);
        finalizeStableContacts(state);
        const recovered = validateOrRecoverPlacement(nodeId, querySession);
        emit({
            collisionCount: state.collisions.length,
            nodeId,
            onFloor: state.onFloor,
            onWall: state.onWall,
            recovered,
            recoveryStatus: state.recoveryStatus,
            slideCount: slides,
            type: 'character:move-and-slide'
        });
        return deepFreeze({
            collisions: clonePortable(state.collisions),
            onFloor: state.onFloor,
            onWall: state.onWall,
            recovered,
            recoveryStatus: state.recoveryStatus,
            remaining: remaining.slice(),
            travel: totalTravel,
            velocity: state.velocity.slice()
        });
    };

    const setVelocity = (nodeId, value) => {
        assertMovableController(nodeId);
        if (!Array.isArray(value) || value.length !== 2 || value.some(item => !Number.isFinite(Number(item)))) {
            throw Object.assign(new TypeError('CharacterController2D velocity must contain two finite numbers.'), {
                code: 'NGVGE_CHARACTER_CONTROLLER2D_VELOCITY_INVALID'
            });
        }
        const state = ensureState(nodeId);
        state.velocity = value.map(Number);
        emit({nodeId, type: 'character:velocity', velocity: state.velocity.slice()});
        return deepFreeze(state.velocity.slice());
    };

    const moveUsingVelocity = (nodeId, deltaValue = 1) => {
        const delta = Number(deltaValue);
        if (!Number.isFinite(delta) || delta < 0) {
            throw Object.assign(new TypeError('CharacterController2D delta must be a non-negative finite number.'), {
                code: 'NGVGE_CHARACTER_CONTROLLER2D_DELTA_INVALID'
            });
        }
        const state = ensureState(nodeId);
        return moveAndSlide(nodeId, scale(state.velocity, delta));
    };

    const patchPersistentController = (nodeId, patch, mutationOptions = {}) => {
        const node = runtimeNodeModel.getNodeSnapshot(nodeId);
        const component = getControllerComponent(node);
        if (!node || !component) {
            throw Object.assign(new Error(`CharacterController2D component not found for node: ${nodeId}`), {
                code: 'NGVGE_CHARACTER_CONTROLLER2D_COMPONENT_NOT_FOUND'
            });
        }
        const next = applyCharacterController2DPatch(component.data, patch);
        runtimeNodeModel.setComponentData(nodeId, component.id, next, {
            transactionId: mutationOptions.transactionId || `character-controller2d:persistent-patch:${nodeId}`
        });
        emit({componentId: component.id, nodeId, type: 'persistent-character-controller-patch'});
        return deepFreeze(clonePortable(next));
    };

    const resetRuntimeState = nodeId => {
        const resetOne = id => {
            const node = runtimeNodeModel.getNodeSnapshot(id);
            if (!getControllerComponent(node)) return;
            states.set(id, createRuntimeState());
            try { transformRuntimeStore.hydrateNodeFromPersistent(id); } catch { /* deleted/incomplete node */ }
        };
        if (nodeId) resetOne(nodeId);
        else listControllers().forEach(controller => resetOne(controller.nodeId));
        emit({nodeId: nodeId || null, type: 'character:runtime-reset'});
    };

    unsubscribeNodes = runtimeNodeModel.subscribe(change => {
        if (!change || typeof change !== 'object') return;
        if (change.type === 'runtime:replaced') {
            states.clear();
            listControllers().forEach(controller => ensureState(controller.nodeId));
            emit({type: 'character:runtime-replaced'});
            return;
        }
        if (change.type === 'node:destroy' && change.nodeId) {
            states.delete(change.nodeId);
            emit({nodeId: change.nodeId, type: 'character:detach'});
        }
        if (change.componentTypeId === CHARACTER_CONTROLLER2D_TYPE_ID && change.nodeId) {
            if (change.type === 'component:remove') states.delete(change.nodeId);
            else ensureState(change.nodeId);
            emit({nodeId: change.nodeId, type: 'character:component-change'});
        }
    });
    if (typeof sceneRuntime.subscribe === 'function') {
        unsubscribeScene = sceneRuntime.subscribe(() => emit({type: 'character:scene-change'}));
    }
    if (scratchRuntime && typeof scratchRuntime.on === 'function' && typeof scratchRuntime.removeListener === 'function') {
        const resetForRunBoundary = () => resetRuntimeState();
        scratchRuntime.on('PROJECT_START', resetForRunBoundary);
        scratchRuntime.on('PROJECT_STOP_ALL', resetForRunBoundary);
        detachRuntimeLifecycle = () => {
            scratchRuntime.removeListener('PROJECT_START', resetForRunBoundary);
            scratchRuntime.removeListener('PROJECT_STOP_ALL', resetForRunBoundary);
        };
    }

    listControllers().forEach(controller => ensureState(controller.nodeId));
    initializeShapeQueryBackend();

    return Object.freeze({
        capabilityId: CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_ID,
        version: CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_VERSION,
        dispose: () => {
            if (disposed) return;
            disposed = true;
            unsubscribeNodes();
            unsubscribeScene();
            detachRuntimeLifecycle();
            states.clear();
            listeners.clear();
        },
        findEarliestCollision,
        getController,
        initializeShapeQueryBackend,
        getPersistentController: nodeId => {
            const node = runtimeNodeModel.getNodeSnapshot(nodeId);
            const component = getControllerComponent(node);
            return component ? normalizeCharacterController2D(component.data) : null;
        },
        getStatus: () => deepFreeze({
            controllerCount: listControllers().length,
            disposed,
            revision,
            runtimeStateCount: states.size,
            shapeQueryBackendError: shapeQueryBackendError ? {
                code: shapeQueryBackendError.code || null,
                message: shapeQueryBackendError.message || String(shapeQueryBackendError)
            } : null,
            shapeQueryBackendId: shapeQueryBackend ? shapeQueryBackend.backendId || null : null,
            shapeQueryBackendState
        }),
        getVelocity: nodeId => ensureState(nodeId).velocity.slice(),
        listControllers,
        moveAndCollide,
        moveAndSlide,
        moveUsingVelocity,
        patchPersistentController,
        resetRuntimeState,
        setVelocity,
        subscribe: listener => {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    });
};

module.exports = {
    CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_ID,
    CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_VERSION,
    CHARACTER_CONTROLLER2D_RUNTIME_COMPONENT_DESCRIPTOR,
    convexPolygonPenetration,
    createCharacterController2DComponentOptions,
    createCharacterController2DRuntimeService,
    registerCharacterController2DComponent,
    sweepConvexPolygons
};
