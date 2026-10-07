'use strict';

const {
    COLLIDER2D_COMPONENT_OWNER,
    COLLIDER2D_SCHEMA_VERSION,
    COLLIDER2D_SHAPE_TYPES,
    COLLIDER2D_TRANSFORM_INHERITANCE,
    COLLIDER2D_TYPE_ID,
    applyCollider2DPatch,
    normalizeCollider2D,
    normalizeCollider2DShape
} = require('../../core/collider2d');
const {TRANSFORM2D_TYPE_ID, normalizeTransform2D} = require('../../core/transform2d');
const {
    getHierarchyWorldOrigin,
    getTransformHierarchy,
    projectPointThroughHierarchy,
    projectPointsThroughHierarchy,
    unprojectPointThroughHierarchy
} = require('../transform-system/transform2d-hierarchy-projection');
const {COMPONENT_CARDINALITIES} = require('../runtime-nodes/runtime-component-contract');
const {FRAME_PROFILER_CATEGORY, getFrameTimeProfiler} = require('../frame-profiler');

const COLLIDER2D_RUNTIME_CAPABILITY_ID = 'ngvge.collider2d-runtime';
const COLLIDER2D_RUNTIME_CAPABILITY_VERSION = 1;
const CIRCLE_SEGMENTS = 32;
const CAPSULE_ARC_SEGMENTS = 16;
const EPSILON = 1e-9;

const COLLIDER2D_RUNTIME_COMPONENT_DESCRIPTOR = Object.freeze({
    cardinality: COMPONENT_CARDINALITIES.ONE,
    ownerModuleId: COLLIDER2D_COMPONENT_OWNER,
    schemaVersion: COLLIDER2D_SCHEMA_VERSION,
    typeId: COLLIDER2D_TYPE_ID
});

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return Object.freeze(value);
};

const clonePortable = value => JSON.parse(JSON.stringify(value));

const getColliderComponent = node => {
    const components = node && Array.isArray(node.components) ? node.components : [];
    return components.find(component => component && component.typeId === COLLIDER2D_TYPE_ID) || null;
};

const getTransformComponent = node => {
    const components = node && Array.isArray(node.components) ? node.components : [];
    return components.find(component => component && component.typeId === TRANSFORM2D_TYPE_ID) || null;
};

const createCollider2DComponentOptions = (data, options = {}) => {
    const result = {
        data: normalizeCollider2D(data),
        enabled: options.enabled !== false,
        schemaVersion: COLLIDER2D_SCHEMA_VERSION,
        typeId: COLLIDER2D_TYPE_ID
    };
    if (options.componentId) result.id = String(options.componentId);
    return result;
};

const registerCollider2DComponent = typeRegistration => {
    if (!typeRegistration || typeof typeRegistration.getComponentTypeDescriptor !== 'function' ||
        typeof typeRegistration.registerComponentTypeDescriptor !== 'function') {
        throw new TypeError('Collider2D requires Runtime Node Type Registration capability.');
    }
    const existing = typeRegistration.getComponentTypeDescriptor(COLLIDER2D_TYPE_ID);
    if (existing && existing.ownerModuleId === COLLIDER2D_COMPONENT_OWNER &&
        existing.schemaVersion === COLLIDER2D_SCHEMA_VERSION && existing.cardinality === COMPONENT_CARDINALITIES.ONE) {
        return existing;
    }
    return typeRegistration.registerComponentTypeDescriptor(
        COLLIDER2D_RUNTIME_COMPONENT_DESCRIPTOR,
        {replace: Boolean(existing)}
    );
};

const rotatePoint = (point, degrees) => {
    const radians = degrees * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return [point[0] * cos - point[1] * sin, point[0] * sin + point[1] * cos];
};

const rectanglePoints = size => {
    const halfX = size[0] / 2;
    const halfY = size[1] / 2;
    return [[-halfX, -halfY], [halfX, -halfY], [halfX, halfY], [-halfX, halfY]];
};

const circlePoints = radius => Array.from({length: CIRCLE_SEGMENTS}, (_, index) => {
    const angle = (index / CIRCLE_SEGMENTS) * Math.PI * 2;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
});

const capsulePoints = (radius, height) => {
    const straightHalf = Math.max(0, (height / 2) - radius);
    const points = [];
    for (let index = 0; index <= CAPSULE_ARC_SEGMENTS; index++) {
        const angle = (index / CAPSULE_ARC_SEGMENTS) * Math.PI;
        points.push([Math.cos(angle) * radius, straightHalf + Math.sin(angle) * radius]);
    }
    for (let index = 0; index <= CAPSULE_ARC_SEGMENTS; index++) {
        const angle = Math.PI + (index / CAPSULE_ARC_SEGMENTS) * Math.PI;
        points.push([Math.cos(angle) * radius, -straightHalf + Math.sin(angle) * radius]);
    }
    return points;
};

const localShapePoints = shapeValue => {
    const shape = normalizeCollider2DShape(shapeValue);
    switch (shape.type) {
    case COLLIDER2D_SHAPE_TYPES.CIRCLE:
        return circlePoints(shape.radius);
    case COLLIDER2D_SHAPE_TYPES.CAPSULE:
        return capsulePoints(shape.radius, shape.height);
    case COLLIDER2D_SHAPE_TYPES.CONVEX_POLYGON:
        return shape.points.map(point => point.slice());
    case COLLIDER2D_SHAPE_TYPES.RECTANGLE:
    default:
        return rectanglePoints(shape.size);
    }
};

const colliderLocalPoints = configValue => {
    const config = normalizeCollider2D(configValue);
    return localShapePoints(config.shape).map(point => {
        const colliderRotated = rotatePoint(point, config.rotation);
        return [colliderRotated[0] + config.offset[0], colliderRotated[1] + config.offset[1]];
    });
};

const transformColliderPoints = (configValue, transformValue) => {
    const config = normalizeCollider2D(configValue);
    const transform = normalizeTransform2D(transformValue);
    const scale = config.transformInheritance === COLLIDER2D_TRANSFORM_INHERITANCE.IGNORE_NODE_SCALE ?
        [1, 1] : transform.scale;
    return colliderLocalPoints(config).map(point => {
        const scaled = [point[0] * scale[0], point[1] * scale[1]];
        const nodeRotated = rotatePoint(scaled, transform.rotation);
        return [nodeRotated[0] + transform.position[0], nodeRotated[1] + transform.position[1]];
    });
};

const transformColliderPointsForNode = (configValue, nodeId, runtimeNodeModel, transformRuntimeStore) => {
    const config = normalizeCollider2D(configValue);
    return projectPointsThroughHierarchy(
        colliderLocalPoints(config),
        nodeId,
        runtimeNodeModel,
        transformRuntimeStore,
        {ignoreOwnerScale: config.transformInheritance === COLLIDER2D_TRANSFORM_INHERITANCE.IGNORE_NODE_SCALE}
    );
};

const polygonAABB = points => points.reduce((bounds, point) => ({
    maxX: Math.max(bounds.maxX, point[0]),
    maxY: Math.max(bounds.maxY, point[1]),
    minX: Math.min(bounds.minX, point[0]),
    minY: Math.min(bounds.minY, point[1])
}), {maxX: -Infinity, maxY: -Infinity, minX: Infinity, minY: Infinity});

const aabbOverlaps = (a, b) => !(
    a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY
);

const projectPolygon = (points, axis) => points.reduce((projection, point) => {
    const value = point[0] * axis[0] + point[1] * axis[1];
    return {max: Math.max(projection.max, value), min: Math.min(projection.min, value)};
}, {max: -Infinity, min: Infinity});

const polygonAxes = points => points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    const edge = [next[0] - point[0], next[1] - point[1]];
    const length = Math.hypot(edge[0], edge[1]);
    return length <= EPSILON ? null : [-edge[1] / length, edge[0] / length];
}).filter(Boolean);

const convexPolygonsOverlapNarrow = (a, b) => {
    const axes = polygonAxes(a).concat(polygonAxes(b));
    return axes.every(axis => {
        const projectionA = projectPolygon(a, axis);
        const projectionB = projectPolygon(b, axis);
        return projectionA.max + EPSILON >= projectionB.min && projectionB.max + EPSILON >= projectionA.min;
    });
};

const convexPolygonsOverlap = (a, b) => {
    if (!a.length || !b.length || !aabbOverlaps(polygonAABB(a), polygonAABB(b))) return false;
    return convexPolygonsOverlapNarrow(a, b);
};

const colliderViewsOverlap = (a, b) => Boolean(
    a && b && a.worldAABB && b.worldAABB &&
    aabbOverlaps(a.worldAABB, b.worldAABB) &&
    convexPolygonsOverlapNarrow(a.worldPoints, b.worldPoints)
);

const colliderProjectionId = collider => (
    collider && (collider.projectionId || collider.componentId || collider.nodeId)
);

const pointInPolygon = (point, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0];
        const yi = polygon[i][1];
        const xj = polygon[j][0];
        const yj = polygon[j][1];
        const intersects = ((yi > point[1]) !== (yj > point[1])) &&
            (point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || EPSILON) + xi);
        if (intersects) inside = !inside;
    }
    return inside;
};

const cross = (a, b) => a[0] * b[1] - a[1] * b[0];

const segmentIntersection = (from, to, a, b) => {
    const r = [to[0] - from[0], to[1] - from[1]];
    const s = [b[0] - a[0], b[1] - a[1]];
    const denominator = cross(r, s);
    if (Math.abs(denominator) <= EPSILON) return null;
    const qMinusP = [a[0] - from[0], a[1] - from[1]];
    const t = cross(qMinusP, s) / denominator;
    const u = cross(qMinusP, r) / denominator;
    if (t < -EPSILON || t > 1 + EPSILON || u < -EPSILON || u > 1 + EPSILON) return null;
    return {point: [from[0] + r[0] * t, from[1] + r[1] * t], t};
};

const rayPolygonIntersection = (from, to, polygon) => {
    if (pointInPolygon(from, polygon)) return {point: from.slice(), t: 0};
    let nearest = null;
    polygon.forEach((point, index) => {
        const next = polygon[(index + 1) % polygon.length];
        const hit = segmentIntersection(from, to, point, next);
        if (hit && (!nearest || hit.t < nearest.t)) nearest = hit;
    });
    return nearest;
};

const collisionFiltersMatch = (a, b) => (
    Boolean((a.collisionLayer & b.collisionMask) >>> 0) && Boolean((b.collisionLayer & a.collisionMask) >>> 0)
);

const normalizeQueryMask = value => {
    if (typeof value === 'undefined' || value === null) return 0xFFFFFFFF;
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return number === 0 ? 0 : 0xFFFFFFFF;
    return Math.min(0xFFFFFFFF, Math.trunc(number)) >>> 0;
};

const createCollider2DRuntimeService = options => {
    const runtimeNodeModel = options && options.runtimeNodeModel;
    const typeRegistration = options && options.typeRegistration;
    const transformRuntimeStore = options && options.transformRuntimeStore;
    const sceneRuntime = options && options.sceneRuntime;
    const scratchRuntime = options && options.scratchRuntime;
    const frameProfiler = scratchRuntime ? getFrameTimeProfiler(scratchRuntime) : null;
    if (!runtimeNodeModel || typeof runtimeNodeModel.listNodes !== 'function' ||
        typeof runtimeNodeModel.getNodeSnapshot !== 'function' || typeof runtimeNodeModel.subscribe !== 'function' ||
        typeof runtimeNodeModel.setComponentData !== 'function') {
        throw new TypeError('Collider2D Runtime Service requires Runtime Node Model capability.');
    }
    if (!transformRuntimeStore || typeof transformRuntimeStore.getRuntimeTransform !== 'function' ||
        typeof transformRuntimeStore.subscribe !== 'function') {
        throw new TypeError('Collider2D Runtime Service requires Transform2D Runtime Store.');
    }
    if (!sceneRuntime || typeof sceneRuntime.getActiveSceneId !== 'function') {
        throw new TypeError('Collider2D Runtime Service requires Scene Runtime capability.');
    }

    registerCollider2DComponent(typeRegistration);
    const listeners = new Set();
    const areaOverlapState = new Map();
    const externalColliderProviders = new Map();
    let disposed = false;
    let revision = 0;
    let geometryRevision = 0;
    let refreshBatchDepth = 0;
    let pendingRefreshReason = null;
    const pendingRefreshNodeIds = new Set();
    const pendingAffectedColliderNodeIds = new Set();
    const debugSnapshotCache = new Map();
    const nonOverlapDebugColliderCache = new WeakMap();
    const authoringPreviewConfigs = new Map();
    const authoringPreviewComponentIds = new Map();
    let nativeTransformDependenciesDirty = true;
    let nativeTransformDependencyNodeIds = new Set();
    let nativeTransformAffectedColliderNodeIds = new Map();
    let unsubscribeNodes = () => {};
    let unsubscribeTransform = () => {};
    let unsubscribeScene = () => {};

    const emit = change => {
        revision += 1;
        const event = deepFreeze(Object.assign({revision}, clonePortable(change || {})));
        listeners.forEach(listener => {
            try { listener(event); } catch { /* advisory listener */ }
        });
        return event;
    };
    const invalidateGeometry = () => {
        geometryRevision += 1;
        debugSnapshotCache.clear();
    };
    const listCacheKey = (sceneId, listOptions = {}) => `${sceneId || ''}|${listOptions.includeInactive === true ? 'all' : 'active'}`;

    const getColliderRecord = nodeId => {
        const node = runtimeNodeModel.getNodeSnapshot(nodeId);
        const component = getColliderComponent(node);
        if (!node || !component) return null;
        const config = authoringPreviewConfigs.has(node.id) ?
            normalizeCollider2D(authoringPreviewConfigs.get(node.id)) : normalizeCollider2D(component.data);
        return {component, config, node};
    };

    const buildColliderView = node => {
        const component = getColliderComponent(node);
        if (!node || !component) return null;
        const transformComponent = getTransformComponent(node);
        const transform = transformRuntimeStore.getRuntimeTransform(node.id) ||
            (transformComponent ? normalizeTransform2D(transformComponent.data) : normalizeTransform2D());
        const config = authoringPreviewConfigs.has(node.id) ?
            normalizeCollider2D(authoringPreviewConfigs.get(node.id)) : normalizeCollider2D(component.data);
        const worldPoints = transformColliderPointsForNode(config, node.id, runtimeNodeModel, transformRuntimeStore);
        const transformHierarchy = getTransformHierarchy(node.id, runtimeNodeModel, transformRuntimeStore);
        return deepFreeze({
            active: node.activeInHierarchy !== false && component.activeInHierarchy !== false && component.enabled !== false,
            componentId: component.id,
            config,
            name: node.name,
            nodeId: node.id,
            sceneId: node.sceneId,
            transform: clonePortable(transform),
            transformHierarchyNodeIds: transformHierarchy.map(entry => entry.nodeId),
            worldAABB: polygonAABB(worldPoints),
            worldOrigin: getHierarchyWorldOrigin(node.id, runtimeNodeModel, transformRuntimeStore),
            worldPoints
        });
    };

    const listNativeColliders = (sceneId = sceneRuntime.getActiveSceneId(), listOptions = {}) => runtimeNodeModel.listNodes({
        includeRoots: false,
        sceneId
    }).map(buildColliderView).filter(Boolean).filter(collider => (
        listOptions.includeInactive === true || collider.active
    ));

    const appendExternalColliderValues = (projected, provider, values, listOptions = {}) => {
        if (!Array.isArray(values)) return;
        const acceptsStableSnapshots = provider.stableSnapshots === true && Object.isFrozen(values);
        values.forEach(collider => {
            if (!collider || !Array.isArray(collider.worldPoints) || collider.worldPoints.length < 3) return;
            if (listOptions.includeInactive !== true && collider.active === false) return;
            if (acceptsStableSnapshots && Object.isFrozen(collider) && collider.worldAABB && collider.worldOrigin) {
                projected.push(collider);
                return;
            }
            const portable = clonePortable(collider);
            if (!portable.worldAABB) portable.worldAABB = polygonAABB(portable.worldPoints);
            if (!portable.worldOrigin) portable.worldOrigin = [
                (portable.worldAABB.minX + portable.worldAABB.maxX) / 2,
                (portable.worldAABB.minY + portable.worldAABB.maxY) / 2
            ];
            projected.push(deepFreeze(portable));
        });
    };

    const listExternalColliders = (sceneId = sceneRuntime.getActiveSceneId(), listOptions = {}) => {
        const projected = [];
        externalColliderProviders.forEach(provider => {
            if (!provider || typeof provider.listColliders !== 'function') return;
            let values = [];
            try { values = provider.listColliders(sceneId, listOptions); } catch { values = []; }
            appendExternalColliderValues(projected, provider, values, listOptions);
        });
        return projected;
    };

    const listExternalCollidersInAABB = (sceneId, worldAABB, listOptions = {}) => {
        const projected = [];
        let totalColliderCount = 0;
        let totalColliderCountExact = true;
        externalColliderProviders.forEach(provider => {
            if (!provider || typeof provider.listColliders !== 'function') return;
            let values = [];
            if (typeof provider.queryCollidersInAABB === 'function') {
                try { values = provider.queryCollidersInAABB(sceneId, worldAABB, listOptions); } catch { values = []; }
                if (typeof provider.getColliderCount === 'function') {
                    try { totalColliderCount += Math.max(0, Math.trunc(Number(provider.getColliderCount(sceneId)) || 0)); }
                    catch { totalColliderCount += Array.isArray(values) ? values.length : 0; totalColliderCountExact = false; }
                } else {
                    totalColliderCount += Array.isArray(values) ? values.length : 0;
                    totalColliderCountExact = false;
                }
            } else {
                try { values = provider.listColliders(sceneId, listOptions); } catch { values = []; }
                totalColliderCount += Array.isArray(values) ? values.length : 0;
            }
            appendExternalColliderValues(projected, provider, values, listOptions);
        });
        return {colliders: projected, totalColliderCount, totalColliderCountExact};
    };

    const listColliders = (sceneId = sceneRuntime.getActiveSceneId(), listOptions = {}) => Object.freeze(
        listNativeColliders(sceneId, listOptions).concat(listExternalColliders(sceneId, listOptions))
    );

    const getNativeColliderStatus = (sceneId = sceneRuntime.getActiveSceneId()) => {
        let activeColliderCount = 0;
        let areaCount = 0;
        runtimeNodeModel.listNodes({includeRoots: false, sceneId}).forEach(node => {
            const component = getColliderComponent(node);
            if (!component || node.activeInHierarchy === false || component.activeInHierarchy === false || component.enabled === false) return;
            activeColliderCount += 1;
            const config = authoringPreviewConfigs.has(node.id) ?
                authoringPreviewConfigs.get(node.id) : component.data;
            if (config && config.sensor === true) areaCount += 1;
        });
        return {activeColliderCount, areaCount};
    };

    const getExternalColliderStatus = (sceneId = sceneRuntime.getActiveSceneId()) => {
        let activeColliderCount = 0;
        let areaCount = 0;
        externalColliderProviders.forEach(provider => {
            if (!provider) return;
            let countKnown = false;
            if (typeof provider.getColliderCount === 'function') {
                try {
                    activeColliderCount += Math.max(0, Math.trunc(Number(provider.getColliderCount(sceneId)) || 0));
                    countKnown = true;
                } catch { /* fallback to listColliders below */ }
            }
            const needsSensorInspection = provider.containsSensors !== false;
            if (countKnown && !needsSensorInspection) return;
            let values = [];
            try { values = typeof provider.listColliders === 'function' ? provider.listColliders(sceneId, {includeInactive: false}) : []; }
            catch { values = []; }
            if (!countKnown) activeColliderCount += Array.isArray(values) ? values.filter(collider => collider && collider.active !== false).length : 0;
            if (needsSensorInspection && Array.isArray(values)) {
                areaCount += values.filter(collider => collider && collider.active !== false && (collider.sensor === true || Boolean(collider.config && collider.config.sensor))).length;
            }
        });
        return {activeColliderCount, areaCount};
    };

    const getColliderStatus = (sceneId = sceneRuntime.getActiveSceneId()) => {
        const nativeStatus = getNativeColliderStatus(sceneId);
        const externalStatus = getExternalColliderStatus(sceneId);
        return deepFreeze({
            activeColliderCount: nativeStatus.activeColliderCount + externalStatus.activeColliderCount,
            areaCount: nativeStatus.areaCount + externalStatus.areaCount,
            disposed,
            externalProviderCount: externalColliderProviders.size,
            geometryRevision,
            revision
        });
    };

    const getCollider = nodeId => buildColliderView(runtimeNodeModel.getNodeSnapshot(nodeId));

    const worldPointToNodeLocal = (nodeId, pointValue) => {
        const record = getColliderRecord(nodeId);
        if (!record) return null;
        const point = Array.isArray(pointValue) && pointValue.length === 2 ? pointValue.map(Number) : [0, 0];
        return unprojectPointThroughHierarchy(
            point,
            nodeId,
            runtimeNodeModel,
            transformRuntimeStore,
            {ignoreOwnerScale: record.config.transformInheritance === COLLIDER2D_TRANSFORM_INHERITANCE.IGNORE_NODE_SCALE}
        );
    };

    const nodeLocalPointToWorld = (nodeId, pointValue) => {
        const record = getColliderRecord(nodeId);
        if (!record) return null;
        const point = Array.isArray(pointValue) && pointValue.length === 2 ? pointValue.map(Number) : [0, 0];
        return projectPointThroughHierarchy(
            point,
            nodeId,
            runtimeNodeModel,
            transformRuntimeStore,
            {ignoreOwnerScale: record.config.transformInheritance === COLLIDER2D_TRANSFORM_INHERITANCE.IGNORE_NODE_SCALE}
        );
    };

    const worldPointToShapeLocal = (nodeId, pointValue) => {
        const record = getColliderRecord(nodeId);
        if (!record) return null;
        const point = Array.isArray(pointValue) && pointValue.length === 2 ? pointValue.map(Number) : [0, 0];
        const nodePoint = unprojectPointThroughHierarchy(
            point,
            nodeId,
            runtimeNodeModel,
            transformRuntimeStore,
            {ignoreOwnerScale: record.config.transformInheritance === COLLIDER2D_TRANSFORM_INHERITANCE.IGNORE_NODE_SCALE}
        );
        if (!nodePoint) return null;
        return rotatePoint([
            nodePoint[0] - record.config.offset[0],
            nodePoint[1] - record.config.offset[1]
        ], -record.config.rotation);
    };

    const shapeLocalPointToWorld = (nodeId, pointValue) => {
        const record = getColliderRecord(nodeId);
        if (!record) return null;
        const point = Array.isArray(pointValue) && pointValue.length === 2 ? pointValue.map(Number) : [0, 0];
        const rotated = rotatePoint(point, record.config.rotation);
        return projectPointThroughHierarchy(
            [rotated[0] + record.config.offset[0], rotated[1] + record.config.offset[1]],
            nodeId,
            runtimeNodeModel,
            transformRuntimeStore,
            {ignoreOwnerScale: record.config.transformInheritance === COLLIDER2D_TRANSFORM_INHERITANCE.IGNORE_NODE_SCALE}
        );
    };

    const overlaps = (firstNodeId, secondNodeId, queryOptions = {}) => {
        if (!firstNodeId || !secondNodeId || firstNodeId === secondNodeId) return false;
        const sceneId = queryOptions.sceneId || sceneRuntime.getActiveSceneId();
        const candidates = listColliders(sceneId, {includeInactive: queryOptions.includeInactive});
        const firstCandidates = candidates.filter(collider => collider.nodeId === firstNodeId);
        const secondCandidates = candidates.filter(collider => collider.nodeId === secondNodeId);
        return firstCandidates.some(first => secondCandidates.some(second => (
            (queryOptions.ignoreFilters === true || collisionFiltersMatch(first.config, second.config)) &&
            colliderViewsOverlap(first, second)
        )));
    };

    const computeAreaOverlaps = (area, candidates = listColliders(area && area.sceneId)) => {
        if (!area || !area.active || !area.config.sensor) return new Set();
        return new Set(candidates.filter(other => (
            other.nodeId !== area.nodeId && collisionFiltersMatch(area.config, other.config) &&
            colliderViewsOverlap(area, other)
        )).map(other => other.nodeId));
    };

    const computeDebugOverlapIds = colliders => {
        const overlapping = new Set();
        const sorted = colliders.slice().sort((left, right) => (
            left.worldAABB.minX - right.worldAABB.minX ||
            left.worldAABB.minY - right.worldAABB.minY ||
            String(colliderProjectionId(left)).localeCompare(String(colliderProjectionId(right)))
        ));
        for (let leftIndex = 0; leftIndex < sorted.length; leftIndex++) {
            const left = sorted[leftIndex];
            for (let rightIndex = leftIndex + 1; rightIndex < sorted.length; rightIndex++) {
                const right = sorted[rightIndex];
                if (right.worldAABB.minX > left.worldAABB.maxX + EPSILON) break;
                if (left.nodeId === right.nodeId) continue;
                if (!collisionFiltersMatch(left.config, right.config) || !aabbOverlaps(left.worldAABB, right.worldAABB)) continue;
                if (!convexPolygonsOverlapNarrow(left.worldPoints, right.worldPoints)) continue;
                overlapping.add(colliderProjectionId(left));
                overlapping.add(colliderProjectionId(right));
            }
        }
        return overlapping;
    };

    const withDebugOverlapState = (collider, overlapping) => {
        if (!collider || typeof collider !== 'object') return collider;
        if (overlapping === true) return deepFreeze(Object.assign({}, collider, {overlapping: true}));
        if (Object.isFrozen(collider)) {
            const cached = nonOverlapDebugColliderCache.get(collider);
            if (cached) return cached;
            const wrapped = deepFreeze(Object.assign({}, collider, {overlapping: false}));
            nonOverlapDebugColliderCache.set(collider, wrapped);
            return wrapped;
        }
        return deepFreeze(Object.assign({}, collider, {overlapping: false}));
    };

    const getDebugSnapshot = (sceneId = sceneRuntime.getActiveSceneId(), snapshotOptions = {}) => {
        const includeInactive = snapshotOptions.includeInactive === true;
        const includeOverlapState = snapshotOptions.includeOverlapState !== false;
        const key = `${listCacheKey(sceneId, {includeInactive})}|overlap:${includeOverlapState ? 'yes' : 'no'}`;
        const cached = debugSnapshotCache.get(key);
        if (cached && cached.geometryRevision === geometryRevision) return cached.snapshot;
        const colliders = listColliders(sceneId, {includeInactive});
        const overlappingIds = includeOverlapState ? computeDebugOverlapIds(colliders) : new Set();
        const snapshot = deepFreeze({
            colliders: colliders.map(collider => withDebugOverlapState(
                collider, overlappingIds.has(colliderProjectionId(collider))
            )),
            geometryRevision,
            sceneId
        });
        debugSnapshotCache.set(key, {geometryRevision, snapshot});
        return snapshot;
    };

    const getDebugViewportSnapshot = (worldAABBValue, snapshotOptions = {}) => {
        const sceneId = snapshotOptions.sceneId || sceneRuntime.getActiveSceneId();
        const includeInactive = snapshotOptions.includeInactive === true;
        const includeOverlapState = snapshotOptions.includeOverlapState === true;
        const worldAABB = worldAABBValue && typeof worldAABBValue === 'object' ? {
            maxX: Number(worldAABBValue.maxX),
            maxY: Number(worldAABBValue.maxY),
            minX: Number(worldAABBValue.minX),
            minY: Number(worldAABBValue.minY)
        } : null;
        if (!worldAABB || !Object.values(worldAABB).every(Number.isFinite)) {
            return deepFreeze({
                colliders: [],
                geometryRevision,
                sceneId,
                totalColliderCount: 0,
                visibleColliderCount: 0
            });
        }
        const maxColliders = Number.isFinite(Number(snapshotOptions.maxColliders)) ?
            Math.max(0, Math.trunc(Number(snapshotOptions.maxColliders))) : Infinity;
        const nativeColliders = listNativeColliders(sceneId, {includeInactive});
        const visibleNative = nativeColliders.filter(collider => collider.worldAABB && aabbOverlaps(collider.worldAABB, worldAABB));
        const nativeLimited = visibleNative.slice(0, maxColliders);
        const remaining = Number.isFinite(maxColliders) ? Math.max(0, maxColliders - nativeLimited.length) : Infinity;
        const external = listExternalCollidersInAABB(sceneId, worldAABB, {includeInactive, maxResults: remaining});
        const visible = nativeLimited.concat(external.colliders).filter(collider => (
            collider.worldAABB && aabbOverlaps(collider.worldAABB, worldAABB)
        )).slice(0, maxColliders);
        const overlappingIds = includeOverlapState ? computeDebugOverlapIds(visible) : new Set();
        return deepFreeze({
            colliders: visible.map(collider => withDebugOverlapState(
                collider, overlappingIds.has(colliderProjectionId(collider))
            )),
            geometryRevision,
            sceneId,
            totalColliderCount: nativeColliders.length + external.totalColliderCount,
            totalColliderCountExact: external.totalColliderCountExact,
            visibleColliderCount: visible.length
        });
    };

    const refreshOverlapsInternal = (reason, changedNodeIds = [], affectedColliderNodeIds = []) => {
        if (disposed) return;
        const refreshMetadata = Object.assign(
            {},
            changedNodeIds.length ? {changedNodeIds} : {},
            affectedColliderNodeIds.length ? {affectedColliderNodeIds} : {}
        );
        invalidateGeometry();
        const nativeStatus = getNativeColliderStatus();
        const mustInspectExternalSensors = Array.from(externalColliderProviders.values()).some(provider => (
            !provider || provider.containsSensors !== false
        ));
        // Solid-only scenes do not have Area enter/exit semantics to recompute. In that case a transform
        // change only invalidates geometry/debug snapshots; rebuilding every Circle/Capsule world polygon
        // here would duplicate work already handled by the physics/query backend.
        if (nativeStatus.areaCount === 0 && !mustInspectExternalSensors && areaOverlapState.size === 0) {
            if (frameProfiler) frameProfiler.count('colliderSolidOnlyRefreshSkips', 1);
            emit(Object.assign({geometryRevision, reason: reason || 'refresh', type: 'collision:refresh'},
                refreshMetadata));
            return;
        }
        const nativeColliders = listNativeColliders();
        const nativeAreas = nativeColliders.filter(collider => collider.config.sensor);
        let externalColliders = [];
        if (nativeAreas.length || mustInspectExternalSensors || areaOverlapState.size) {
            externalColliders = listExternalColliders();
        }
        const colliders = nativeColliders.concat(externalColliders);
        const activeAreas = nativeAreas.concat(externalColliders.filter(collider => collider.config.sensor));
        const presentAreaIds = new Set(activeAreas.map(area => area.nodeId));
        activeAreas.forEach(area => {
            const previous = areaOverlapState.get(area.nodeId) || new Set();
            const next = computeAreaOverlaps(area, colliders);
            next.forEach(otherNodeId => {
                if (!previous.has(otherNodeId)) emit({
                    areaNodeId: area.nodeId,
                    otherNodeId,
                    reason: reason || 'refresh',
                    type: 'area:enter'
                });
            });
            previous.forEach(otherNodeId => {
                if (!next.has(otherNodeId)) emit({
                    areaNodeId: area.nodeId,
                    otherNodeId,
                    reason: reason || 'refresh',
                    type: 'area:exit'
                });
            });
            areaOverlapState.set(area.nodeId, next);
        });
        Array.from(areaOverlapState.keys()).forEach(areaNodeId => {
            if (presentAreaIds.has(areaNodeId)) return;
            const previous = areaOverlapState.get(areaNodeId) || new Set();
            previous.forEach(otherNodeId => emit({
                areaNodeId,
                otherNodeId,
                reason: reason || 'area-removed',
                type: 'area:exit'
            }));
            areaOverlapState.delete(areaNodeId);
        });
        emit(Object.assign({geometryRevision, reason: reason || 'refresh', type: 'collision:refresh'},
            refreshMetadata));
    };
    const refreshOverlaps = (reason, changedNodeIds = [], affectedColliderNodeIds = []) => {
        if (!frameProfiler) return refreshOverlapsInternal(reason, changedNodeIds, affectedColliderNodeIds);
        frameProfiler.count('colliderRuntimeRefreshes', 1);
        return frameProfiler.measure(FRAME_PROFILER_CATEGORY.COLLIDER_RUNTIME_REFRESH, () => (
            refreshOverlapsInternal(reason, changedNodeIds, affectedColliderNodeIds)
        ));
    };
    const requestRefresh = (reason, refreshOptions = {}) => {
        const changedNodeIds = Array.isArray(refreshOptions.changedNodeIds) ? refreshOptions.changedNodeIds :
            (refreshOptions.nodeId ? [refreshOptions.nodeId] : []);
        const affectedColliderNodeIds = Array.isArray(refreshOptions.affectedColliderNodeIds) ?
            refreshOptions.affectedColliderNodeIds : [];
        if (frameProfiler && frameProfiler.isEnabled()) {
            if (reason === 'transform-hierarchy-change') {
                frameProfiler.count('colliderRefreshTransformSignals', 1);
                frameProfiler.count('colliderRefreshTransformAffectedColliders', affectedColliderNodeIds.length);
                if (!affectedColliderNodeIds.length) frameProfiler.count('colliderRefreshTransformNoAffectedSet', 1);
            } else if (reason === 'scene-change') {
                frameProfiler.count('colliderRefreshSceneSignals', 1);
            } else {
                frameProfiler.count('colliderRefreshOtherSignals', 1);
            }
        }
        if (refreshBatchDepth > 0) {
            pendingRefreshReason = reason || pendingRefreshReason || 'batched-refresh';
            changedNodeIds.forEach(nodeId => { if (nodeId) pendingRefreshNodeIds.add(nodeId); });
            affectedColliderNodeIds.forEach(nodeId => { if (nodeId) pendingAffectedColliderNodeIds.add(nodeId); });
            return false;
        }
        refreshOverlaps(reason, changedNodeIds.filter(Boolean), affectedColliderNodeIds.filter(Boolean));
        return true;
    };
    const beginRefreshBatch = () => {
        refreshBatchDepth += 1;
        return refreshBatchDepth;
    };
    const endRefreshBatch = reason => {
        if (refreshBatchDepth > 0) refreshBatchDepth -= 1;
        if (refreshBatchDepth === 0 && pendingRefreshReason) {
            const pending = reason || pendingRefreshReason;
            const changedNodeIds = Array.from(pendingRefreshNodeIds);
            const affectedColliderNodeIds = Array.from(pendingAffectedColliderNodeIds);
            pendingRefreshReason = null;
            pendingRefreshNodeIds.clear();
            pendingAffectedColliderNodeIds.clear();
            refreshOverlaps(pending, changedNodeIds, affectedColliderNodeIds);
        }
        return refreshBatchDepth;
    };

    const getOverlaps = nodeId => {
        const collider = getCollider(nodeId);
        if (!collider) return Object.freeze([]);
        const candidates = listColliders(collider.sceneId);
        const matches = collider.config.sensor ? computeAreaOverlaps(collider, candidates) : new Set(
            candidates.filter(other => (
                other.nodeId !== collider.nodeId && collisionFiltersMatch(collider.config, other.config) &&
                colliderViewsOverlap(collider, other)
            )).map(other => other.nodeId)
        );
        return Object.freeze(Array.from(matches).sort());
    };

    const queryPoint = (pointValue, queryOptions = {}) => {
        const point = Array.isArray(pointValue) && pointValue.length === 2 ? pointValue.map(Number) : [0, 0];
        const mask = normalizeQueryMask(queryOptions.collisionMask);
        const sceneId = queryOptions.sceneId || sceneRuntime.getActiveSceneId();
        return Object.freeze(listColliders(sceneId, {includeInactive: queryOptions.includeInactive}).filter(collider => {
            if (!((collider.config.collisionLayer & mask) >>> 0)) return false;
            if (queryOptions.sensors === false && collider.config.sensor) return false;
            if (queryOptions.solids === false && !collider.config.sensor) return false;
            return pointInPolygon(point, collider.worldPoints);
        }).map(collider => deepFreeze({
            componentId: collider.componentId,
            name: collider.name,
            nodeId: collider.nodeId,
            sensor: collider.config.sensor
        })));
    };

    const raycast = (fromValue, toValue, queryOptions = {}) => {
        const from = Array.isArray(fromValue) && fromValue.length === 2 ? fromValue.map(Number) : [0, 0];
        const to = Array.isArray(toValue) && toValue.length === 2 ? toValue.map(Number) : [0, 0];
        const mask = normalizeQueryMask(queryOptions.collisionMask);
        const sceneId = queryOptions.sceneId || sceneRuntime.getActiveSceneId();
        const hits = listColliders(sceneId, {includeInactive: queryOptions.includeInactive}).map(collider => {
            if (!((collider.config.collisionLayer & mask) >>> 0)) return null;
            if (queryOptions.sensors === false && collider.config.sensor) return null;
            if (queryOptions.solids === false && !collider.config.sensor) return null;
            const intersection = rayPolygonIntersection(from, to, collider.worldPoints);
            if (!intersection) return null;
            return deepFreeze({
                componentId: collider.componentId,
                distance: Math.hypot(intersection.point[0] - from[0], intersection.point[1] - from[1]),
                name: collider.name,
                nodeId: collider.nodeId,
                point: intersection.point,
                sensor: collider.config.sensor,
                t: intersection.t
            });
        }).filter(Boolean).sort((a, b) => a.t - b.t || a.nodeId.localeCompare(b.nodeId));
        if (queryOptions.all === true) return Object.freeze(hits);
        return hits[0] || null;
    };

    const queryShape = (shapeValue, transformValue, queryOptions = {}) => {
        const queryConfig = normalizeCollider2D({
            collisionLayer: normalizeQueryMask(queryOptions.collisionLayer),
            collisionMask: normalizeQueryMask(queryOptions.collisionMask),
            offset: queryOptions.offset || [0, 0],
            rotation: queryOptions.rotation || 0,
            sensor: true,
            shape: shapeValue,
            transformInheritance: queryOptions.transformInheritance
        });
        const queryTransform = normalizeTransform2D(transformValue);
        const queryPoints = transformColliderPoints(queryConfig, queryTransform);
        const sceneId = queryOptions.sceneId || sceneRuntime.getActiveSceneId();
        return Object.freeze(listColliders(sceneId, {includeInactive: queryOptions.includeInactive}).filter(collider => {
            if (!((collider.config.collisionLayer & queryConfig.collisionMask) >>> 0)) return false;
            return convexPolygonsOverlap(queryPoints, collider.worldPoints);
        }).map(collider => deepFreeze({
            componentId: collider.componentId,
            name: collider.name,
            nodeId: collider.nodeId,
            sensor: collider.config.sensor
        })));
    };

    const getPersistentColliderRecord = nodeId => {
        const node = runtimeNodeModel.getNodeSnapshot(nodeId);
        const component = getColliderComponent(node);
        if (!node || !component) {
            const error = new Error(`Collider2D component not found for node: ${nodeId}`);
            error.code = 'NGVGE_COLLIDER2D_COMPONENT_NOT_FOUND';
            throw error;
        }
        return {component, node};
    };

    const beginAuthoringPreview = nodeId => {
        const {component} = getPersistentColliderRecord(nodeId);
        const config = normalizeCollider2D(component.data);
        authoringPreviewConfigs.set(nodeId, config);
        authoringPreviewComponentIds.set(nodeId, component.id);
        invalidateGeometry();
        emit({componentId: component.id, geometryRevision, nodeId, type: 'authoring-preview-begin'});
        return deepFreeze(clonePortable(config));
    };

    const patchAuthoringPreview = (nodeId, patch) => {
        let componentId = authoringPreviewComponentIds.get(nodeId);
        let base = authoringPreviewConfigs.get(nodeId);
        if (!base || !componentId) {
            const {component} = getPersistentColliderRecord(nodeId);
            componentId = component.id;
            base = normalizeCollider2D(component.data);
            authoringPreviewComponentIds.set(nodeId, componentId);
        }
        const next = applyCollider2DPatch(base, patch);
        authoringPreviewConfigs.set(nodeId, next);
        invalidateGeometry();
        emit({componentId, geometryRevision, nodeId, type: 'authoring-preview-patch'});
        return deepFreeze(clonePortable(next));
    };

    const cancelAuthoringPreview = nodeId => {
        const existing = authoringPreviewConfigs.get(nodeId);
        if (!existing) return false;
        authoringPreviewConfigs.delete(nodeId);
        authoringPreviewComponentIds.delete(nodeId);
        invalidateGeometry();
        emit({geometryRevision, nodeId, type: 'authoring-preview-cancel'});
        return true;
    };

    const patchPersistentCollider = (nodeId, patch, mutationOptions = {}) => {
        const {component} = getPersistentColliderRecord(nodeId);
        const next = applyCollider2DPatch(component.data, patch);
        beginRefreshBatch();
        try {
            const result = runtimeNodeModel.setComponentData(nodeId, component.id, next, {
                transactionId: mutationOptions.transactionId || `collider2d:persistent-patch:${nodeId}`
            });
            if (result && result.applied === false) {
                const error = new Error(result.error && result.error.message ? result.error.message : 'Collider2D persistent patch failed.');
                error.code = result.error && result.error.code ? result.error.code : 'NGVGE_COLLIDER2D_PERSISTENT_PATCH_FAILED';
                throw error;
            }
            authoringPreviewConfigs.delete(nodeId);
            authoringPreviewComponentIds.delete(nodeId);
            requestRefresh('persistent-collider-patch');
            emit({componentId: component.id, nodeId, type: 'persistent-collider-patch'});
            return deepFreeze(clonePortable(next));
        } finally {
            endRefreshBatch('persistent-collider-patch');
        }
    };

    const getGizmo = nodeId => {
        const collider = getCollider(nodeId);
        if (!collider) return null;
        return deepFreeze({
            aabb: collider.worldAABB,
            componentId: collider.componentId,
            nodeId: collider.nodeId,
            sensor: collider.config.sensor,
            shapeType: collider.config.shape.type,
            worldPoints: collider.worldPoints
        });
    };

    unsubscribeNodes = runtimeNodeModel.subscribe(change => {
        if (!change || typeof change !== 'object') return;
        if (change.type === 'runtime:replaced' || change.type === 'node:create' || change.type === 'node:destroy' ||
            change.type === 'node:attach' || change.type === 'node:detach' || change.componentTypeId === COLLIDER2D_TYPE_ID) {
            nativeTransformDependenciesDirty = true;
        }
        if (change.type === 'runtime:replaced' || change.type === 'node:destroy' || change.type === 'node:active' ||
            change.type === 'node:enabled' || change.componentTypeId === COLLIDER2D_TYPE_ID) {
            requestRefresh('runtime-node-change');
        }
    });
    const rebuildNativeTransformDependencies = () => {
        if (!nativeTransformDependenciesDirty) return;
        const dependencyNodeIds = new Set();
        const affectedColliderNodeIds = new Map();
        runtimeNodeModel.listNodes({
            includeRoots: false,
            sceneId: sceneRuntime.getActiveSceneId()
        }).forEach(node => {
            if (!getColliderComponent(node)) return;
            getTransformHierarchy(node.id, runtimeNodeModel, transformRuntimeStore).forEach(entry => {
                dependencyNodeIds.add(entry.nodeId);
                if (!affectedColliderNodeIds.has(entry.nodeId)) affectedColliderNodeIds.set(entry.nodeId, new Set());
                affectedColliderNodeIds.get(entry.nodeId).add(node.id);
            });
        });
        nativeTransformDependencyNodeIds = dependencyNodeIds;
        nativeTransformAffectedColliderNodeIds = affectedColliderNodeIds;
        nativeTransformDependenciesDirty = false;
    };
    const getNativeTransformDependencyNodeIds = () => {
        rebuildNativeTransformDependencies();
        return nativeTransformDependencyNodeIds;
    };
    const getAffectedColliderNodeIdsForTransform = changedNodeId => {
        rebuildNativeTransformDependencies();
        return Array.from(nativeTransformAffectedColliderNodeIds.get(changedNodeId) || []);
    };
    const transformAffectsCollider = changedNodeId => getNativeTransformDependencyNodeIds().has(changedNodeId);

    unsubscribeTransform = transformRuntimeStore.subscribe(change => {
        if (!change || !change.nodeId || !transformAffectsCollider(change.nodeId)) return;
        requestRefresh('transform-hierarchy-change', {
            affectedColliderNodeIds: getAffectedColliderNodeIdsForTransform(change.nodeId),
            nodeId: change.nodeId
        });
    });
    if (typeof sceneRuntime.subscribe === 'function') {
        unsubscribeScene = sceneRuntime.subscribe(() => requestRefresh('scene-change'));
    }
    refreshOverlaps('bootstrap');

    return Object.freeze({
        capabilityId: COLLIDER2D_RUNTIME_CAPABILITY_ID,
        version: COLLIDER2D_RUNTIME_CAPABILITY_VERSION,
        dispose: () => {
            if (disposed) return;
            disposed = true;
            unsubscribeNodes();
            unsubscribeTransform();
            unsubscribeScene();
            listeners.clear();
            areaOverlapState.clear();
            externalColliderProviders.clear();
            debugSnapshotCache.clear();
            authoringPreviewConfigs.clear();
            authoringPreviewComponentIds.clear();
            nativeTransformDependencyNodeIds.clear();
        },
        getCollider,
        getGizmo,
        getOverlaps,
        getPersistentCollider: nodeId => {
            const node = runtimeNodeModel.getNodeSnapshot(nodeId);
            const component = getColliderComponent(node);
            return component ? normalizeCollider2D(component.data) : null;
        },
        getStatus: () => getColliderStatus(),
        beginAuthoringPreview,
        beginRefreshBatch,
        cancelAuthoringPreview,
        endRefreshBatch,
        getDebugSnapshot,
        getDebugViewportSnapshot,
        listColliders,
        registerExternalColliderProvider: provider => {
            if (!provider || typeof provider.id !== 'string' || !provider.id.trim() || typeof provider.listColliders !== 'function') {
                throw new TypeError('External Collider2D provider requires stable id and listColliders().');
            }
            const id = provider.id.trim();
            if (externalColliderProviders.has(id)) {
                const error = new Error(`External Collider2D provider already registered: ${id}`);
                error.code = 'NGVGE_COLLIDER2D_EXTERNAL_PROVIDER_DUPLICATE';
                throw error;
            }
            externalColliderProviders.set(id, provider);
            requestRefresh('external-provider-register');
            return () => {
                if (!externalColliderProviders.delete(id)) return false;
                requestRefresh('external-provider-unregister');
                return true;
            };
        },
        nodeLocalPointToWorld,
        overlaps,
        patchAuthoringPreview,
        patchPersistentCollider,
        queryPoint,
        queryShape,
        raycast,
        shapeLocalPointToWorld,
        refresh: reason => requestRefresh(reason || 'manual'),
        subscribe: listener => {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        worldPointToNodeLocal,
        worldPointToShapeLocal
    });
};

module.exports = {
    COLLIDER2D_RUNTIME_CAPABILITY_ID,
    COLLIDER2D_RUNTIME_CAPABILITY_VERSION,
    COLLIDER2D_RUNTIME_COMPONENT_DESCRIPTOR,
    collisionFiltersMatch,
    convexPolygonsOverlap,
    createCollider2DComponentOptions,
    createCollider2DRuntimeService,
    pointInPolygon,
    registerCollider2DComponent,
    transformColliderPoints,
    transformColliderPointsForNode
};
