'use strict';

const {COLLIDER2D_SHAPE_TYPES} = require('../../core/collider2d');

const EPSILON = 1e-7;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const subtract = (a, b) => [a[0] - b[0], a[1] - b[1]];
const scale = (value, scalar) => [value[0] * scalar, value[1] * scalar];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const length = value => Math.hypot(value[0], value[1]);
const centerOfPoints = points => points.length ? scale(points.reduce((sum, point) => add(sum, point), [0, 0]), 1 / points.length) : [0, 0];
const rotate = (value, radians) => {
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    return [value[0] * c - value[1] * s, value[0] * s + value[1] * c];
};
const flatPoints = points => {
    const flat = new Float32Array(points.length * 2);
    points.forEach((point, index) => {
        flat[index * 2] = finite(point[0]);
        flat[index * 2 + 1] = finite(point[1]);
    });
    return flat;
};
const relativeTolerance = size => Math.max(1e-5, Math.abs(size) * 1e-3);

const fitRectangle = points => {
    if (!Array.isArray(points) || points.length !== 4) return null;
    const edgeX = subtract(points[1], points[0]);
    const edgeY = subtract(points[3], points[0]);
    const width = length(edgeX);
    const height = length(edgeY);
    if (width <= EPSILON || height <= EPSILON) return null;
    const orthogonality = Math.abs(dot(edgeX, edgeY)) / (width * height);
    if (orthogonality > 1e-3) return null;
    const oppositeX = subtract(points[2], points[3]);
    const oppositeY = subtract(points[2], points[1]);
    if (length(subtract(edgeX, oppositeX)) > relativeTolerance(width) ||
        length(subtract(edgeY, oppositeY)) > relativeTolerance(height)) return null;
    return {
        center: centerOfPoints(points),
        halfExtents: [width / 2, height / 2],
        kind: 'cuboid',
        rotation: Math.atan2(edgeX[1], edgeX[0])
    };
};

const fitCircle = points => {
    if (!Array.isArray(points) || points.length < 8) return null;
    const center = centerOfPoints(points);
    const radii = points.map(point => length(subtract(point, center)));
    const radius = radii.reduce((sum, value) => sum + value, 0) / radii.length;
    if (radius <= EPSILON) return null;
    const tolerance = relativeTolerance(radius);
    if (radii.some(value => Math.abs(value - radius) > tolerance)) return null;
    return {center, kind: 'ball', radius, rotation: 0};
};

const fitCapsule = points => {
    // NGVGE's native capsule presentation uses two 16-segment semicircles, yielding 34 ordered points.
    if (!Array.isArray(points) || points.length !== 34) return null;
    const topEndA = points[0];
    const topEndB = points[16];
    const bottomEndA = points[17];
    const bottomEndB = points[33];
    const topCenter = scale(add(topEndA, topEndB), 0.5);
    const bottomCenter = scale(add(bottomEndA, bottomEndB), 0.5);
    const radiusTop = length(subtract(topEndA, topCenter));
    const radiusBottom = length(subtract(bottomEndA, bottomCenter));
    const radius = (radiusTop + radiusBottom) / 2;
    if (radius <= EPSILON || Math.abs(radiusTop - radiusBottom) > relativeTolerance(radius)) return null;
    const topTolerance = relativeTolerance(radius);
    for (let index = 0; index <= 16; index++) {
        if (Math.abs(length(subtract(points[index], topCenter)) - radius) > topTolerance) return null;
    }
    for (let index = 17; index <= 33; index++) {
        if (Math.abs(length(subtract(points[index], bottomCenter)) - radius) > topTolerance) return null;
    }
    const axis = subtract(topCenter, bottomCenter);
    const axisLength = length(axis);
    const center = scale(add(topCenter, bottomCenter), 0.5);
    if (axisLength <= relativeTolerance(radius)) return {center, kind: 'ball', radius, rotation: 0};
    const unitAxis = scale(axis, 1 / axisLength);
    // Rapier capsules are aligned to local +Y. Rotating +Y by theta yields [-sin(theta), cos(theta)].
    const rotation = Math.atan2(-unitAxis[0], unitAxis[1]);
    return {center, halfHeight: axisLength / 2, kind: 'capsule', radius, rotation};
};

const fitPrimitiveGeometry = (shapeType, points) => {
    switch (shapeType) {
    case COLLIDER2D_SHAPE_TYPES.RECTANGLE:
        return fitRectangle(points);
    case COLLIDER2D_SHAPE_TYPES.CIRCLE:
        return fitCircle(points);
    case COLLIDER2D_SHAPE_TYPES.CAPSULE:
        return fitCapsule(points);
    default:
        return null;
    }
};

const createRapierShapeFromGeometry = (RAPIER, geometry, points) => {
    if (geometry && geometry.kind === 'cuboid' && typeof RAPIER.Cuboid === 'function') {
        return new RAPIER.Cuboid(geometry.halfExtents[0], geometry.halfExtents[1]);
    }
    if (geometry && geometry.kind === 'ball' && typeof RAPIER.Ball === 'function') {
        return new RAPIER.Ball(geometry.radius);
    }
    if (geometry && geometry.kind === 'capsule' && typeof RAPIER.Capsule === 'function') {
        return new RAPIER.Capsule(geometry.halfHeight, geometry.radius);
    }
    if (typeof RAPIER.ConvexPolygon !== 'function') return null;
    const center = centerOfPoints(points);
    const localPoints = points.map(point => subtract(point, center));
    return new RAPIER.ConvexPolygon(flatPoints(localPoints), true);
};

const prepareColliderGeometry = (RAPIER, collider) => {
    if (!collider || !Array.isArray(collider.worldPoints) || collider.worldPoints.length < 3) return null;
    const points = collider.worldPoints.map(point => [finite(point[0]), finite(point[1])]);
    const shapeType = collider.config && collider.config.shape ? collider.config.shape.type : null;
    const primitive = fitPrimitiveGeometry(shapeType, points);
    const center = primitive ? primitive.center.slice() : centerOfPoints(points);
    const rotation = primitive ? finite(primitive.rotation) : 0;
    const shape = createRapierShapeFromGeometry(RAPIER, primitive, points);
    if (!shape) return null;
    return Object.freeze({
        componentId: collider.componentId || null,
        fallbackConvex: !primitive,
        name: collider.name || '',
        nodeId: collider.nodeId || null,
        position: center,
        projectionId: collider.projectionId || null,
        rotation,
        sensor: Boolean(collider.config && collider.config.sensor),
        shape,
        shapeKind: primitive ? primitive.kind : 'convex-polygon'
    });
};

const createRapier2DShapeQueryBackend = options => {
    const source = options && typeof options === 'object' ? options : {};
    const RAPIER = source.RAPIER;
    if (!RAPIER || typeof RAPIER.Ball !== 'function' || typeof RAPIER.Cuboid !== 'function' ||
        typeof RAPIER.Capsule !== 'function' || typeof RAPIER.ConvexPolygon !== 'function') {
        throw Object.assign(new TypeError('Rapier2D shape query backend requires initialized Rapier2D shape classes.'), {
            code: 'NGVGE_RAPIER2D_SHAPE_QUERY_MODULE_REQUIRED'
        });
    }
    const worldNormal = (normal, rotation) => {
        const value = normal ? [finite(normal.x), finite(normal.y)] : [0, 0];
        const rotated = rotate(value, finite(rotation));
        const magnitude = length(rotated);
        return magnitude <= EPSILON ? [0, 0] : scale(rotated, 1 / magnitude);
    };
    const position = prepared => ({x: finite(prepared.position[0]), y: finite(prepared.position[1])});
    const motionVector = value => ({x: finite(value && value[0]), y: finite(value && value[1])});
    return Object.freeze({
        backendId: 'ngvge.collision-query.rapier2d',
        backendVersion: '0.19.3-shape-aware-1',
        castPrepared: (moving, motion, stationary) => {
            if (!moving || !stationary || !moving.shape || !stationary.shape) return null;
            const hit = moving.shape.castShape(
                position(moving), finite(moving.rotation), motionVector(motion),
                stationary.shape, position(stationary), finite(stationary.rotation), {x: 0, y: 0},
                0, 1, true
            );
            if (!hit || !Number.isFinite(Number(hit.time_of_impact))) return null;
            return Object.freeze({
                initialOverlap: Number(hit.time_of_impact) <= EPSILON,
                normal: worldNormal(hit.normal2, stationary.rotation),
                t: Math.max(0, Math.min(1, Number(hit.time_of_impact)))
            });
        },
        penetrationPrepared: (moving, stationary) => {
            if (!moving || !stationary || !moving.shape || !stationary.shape) return null;
            const contact = moving.shape.contactShape(
                position(moving), finite(moving.rotation),
                stationary.shape, position(stationary), finite(stationary.rotation),
                0
            );
            if (!contact || !Number.isFinite(Number(contact.distance)) || Number(contact.distance) >= -EPSILON) return null;
            return Object.freeze({
                depth: Math.max(0, -Number(contact.distance)),
                normal: worldNormal(contact.normal2, stationary.rotation)
            });
        },
        prepareCollider: collider => prepareColliderGeometry(RAPIER, collider),
        translatePrepared: (prepared, delta) => {
            if (!prepared) return null;
            return Object.freeze(Object.assign({}, prepared, {
                position: add(prepared.position, [finite(delta && delta[0]), finite(delta && delta[1])])
            }));
        },
        withPosition: (prepared, nextPosition) => {
            if (!prepared) return null;
            return Object.freeze(Object.assign({}, prepared, {
                position: [finite(nextPosition && nextPosition[0]), finite(nextPosition && nextPosition[1])]
            }));
        }
    });
};

module.exports = {
    createRapier2DShapeQueryBackend,
    fitPrimitiveGeometry,
    prepareColliderGeometry
};
