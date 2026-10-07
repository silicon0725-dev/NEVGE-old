import {
    COLLIDER2D_SHAPE_TYPES,
    isConvexPolygon,
    normalizeCollider2D
} from '../../core/collider2d';

const MIN_DIMENSION = 0.001;
const ROTATION_HANDLE_DISTANCE = 28;

const finite = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};

const positive = (value, fallback = MIN_DIMENSION) => Math.max(MIN_DIMENSION, Math.abs(finite(value, fallback)));

const normalizeAngle = degrees => {
    let value = finite(degrees, 0) % 360;
    if (value > 180) value -= 360;
    if (value <= -180) value += 360;
    return value;
};

const getShapeBounds = shapeValue => {
    const shape = normalizeCollider2D({shape: shapeValue}).shape;
    if (shape.type === COLLIDER2D_SHAPE_TYPES.CIRCLE) {
        return {height: shape.radius * 2, width: shape.radius * 2};
    }
    if (shape.type === COLLIDER2D_SHAPE_TYPES.CAPSULE) {
        return {height: shape.height, width: shape.radius * 2};
    }
    if (shape.type === COLLIDER2D_SHAPE_TYPES.CONVEX_POLYGON) {
        const xs = shape.points.map(point => point[0]);
        const ys = shape.points.map(point => point[1]);
        return {
            height: Math.max(MIN_DIMENSION, Math.max(...ys) - Math.min(...ys)),
            width: Math.max(MIN_DIMENSION, Math.max(...xs) - Math.min(...xs))
        };
    }
    return {height: shape.size[1], width: shape.size[0]};
};

const createDefaultColliderShape = type => {
    switch (type) {
    case COLLIDER2D_SHAPE_TYPES.CIRCLE:
        return {radius: 50, type};
    case COLLIDER2D_SHAPE_TYPES.CAPSULE:
        return {height: 100, radius: 25, type};
    case COLLIDER2D_SHAPE_TYPES.CONVEX_POLYGON:
        return {points: [[-50, -50], [50, -50], [50, 50], [-50, 50]], type};
    case COLLIDER2D_SHAPE_TYPES.RECTANGLE:
    default:
        return {size: [100, 100], type: COLLIDER2D_SHAPE_TYPES.RECTANGLE};
    }
};

const convertColliderShapePreservingBounds = (shapeValue, nextType) => {
    const bounds = getShapeBounds(shapeValue);
    const width = positive(bounds.width, 100);
    const height = positive(bounds.height, 100);
    switch (nextType) {
    case COLLIDER2D_SHAPE_TYPES.CIRCLE:
        return {radius: Math.max(width, height) / 2, type: nextType};
    case COLLIDER2D_SHAPE_TYPES.CAPSULE: {
        const radius = Math.max(MIN_DIMENSION, Math.min(width / 2, height / 2));
        return {height: Math.max(height, radius * 2), radius, type: nextType};
    }
    case COLLIDER2D_SHAPE_TYPES.CONVEX_POLYGON:
        return {
            points: [[-width / 2, -height / 2], [width / 2, -height / 2],
                [width / 2, height / 2], [-width / 2, height / 2]],
            type: nextType
        };
    case COLLIDER2D_SHAPE_TYPES.RECTANGLE:
    default:
        return {size: [width, height], type: COLLIDER2D_SHAPE_TYPES.RECTANGLE};
    }
};

const getColliderShapeAuthoringHandles = configValue => {
    const config = normalizeCollider2D(configValue);
    const shape = config.shape;
    const handles = [];
    const push = (id, kind, point, cursor) => handles.push(Object.freeze({cursor, id, kind, point}));

    if (shape.type === COLLIDER2D_SHAPE_TYPES.RECTANGLE) {
        const hx = shape.size[0] / 2;
        const hy = shape.size[1] / 2;
        push('size-e', 'rectangle-width', [hx, 0], 'ew-resize');
        push('size-w', 'rectangle-width', [-hx, 0], 'ew-resize');
        push('size-n', 'rectangle-height', [0, hy], 'ns-resize');
        push('size-s', 'rectangle-height', [0, -hy], 'ns-resize');
        push('size-ne', 'rectangle-size', [hx, hy], 'nesw-resize');
        push('size-nw', 'rectangle-size', [-hx, hy], 'nwse-resize');
        push('size-se', 'rectangle-size', [hx, -hy], 'nwse-resize');
        push('size-sw', 'rectangle-size', [-hx, -hy], 'nesw-resize');
    } else if (shape.type === COLLIDER2D_SHAPE_TYPES.CIRCLE) {
        push('radius', 'circle-radius', [shape.radius, 0], 'ew-resize');
    } else if (shape.type === COLLIDER2D_SHAPE_TYPES.CAPSULE) {
        push('radius', 'capsule-radius', [shape.radius, 0], 'ew-resize');
        push('height', 'capsule-height', [0, shape.height / 2], 'ns-resize');
    } else if (shape.type === COLLIDER2D_SHAPE_TYPES.CONVEX_POLYGON) {
        shape.points.forEach((point, index) => push(`vertex-${index}`, 'polygon-vertex', point.slice(), 'move'));
    }

    const bounds = getShapeBounds(shape);
    const rotationDistance = Math.max(bounds.width, bounds.height) / 2 + ROTATION_HANDLE_DISTANCE;
    push('offset', 'offset', [0, 0], 'move');
    push('rotation', 'rotation', [0, rotationDistance], 'grab');
    return Object.freeze(handles);
};

const applyColliderShapeHandleDrag = (configValue, handle, points = {}) => {
    const config = normalizeCollider2D(configValue);
    const shapePoint = Array.isArray(points.shapeLocal) ? points.shapeLocal.map(value => finite(value, 0)) : [0, 0];
    const nodePoint = Array.isArray(points.nodeLocal) ? points.nodeLocal.map(value => finite(value, 0)) : [0, 0];
    const kind = handle && handle.kind;

    if (kind === 'offset') return {patch: {offset: nodePoint}, valid: true};
    if (kind === 'rotation') {
        const dx = nodePoint[0] - config.offset[0];
        const dy = nodePoint[1] - config.offset[1];
        if (Math.hypot(dx, dy) <= MIN_DIMENSION) return {error: 'Rotation handle is too close to collider center.', valid: false};
        return {patch: {rotation: normalizeAngle((Math.atan2(dy, dx) * 180 / Math.PI) - 90)}, valid: true};
    }

    if (kind === 'rectangle-width' || kind === 'rectangle-height' || kind === 'rectangle-size') {
        const size = config.shape.size.slice();
        if (kind !== 'rectangle-height') size[0] = positive(Math.abs(shapePoint[0]) * 2, size[0]);
        if (kind !== 'rectangle-width') size[1] = positive(Math.abs(shapePoint[1]) * 2, size[1]);
        return {patch: {shape: {size, type: COLLIDER2D_SHAPE_TYPES.RECTANGLE}}, valid: true};
    }
    if (kind === 'circle-radius') {
        const radius = positive(Math.hypot(shapePoint[0], shapePoint[1]), config.shape.radius);
        return {patch: {shape: {radius, type: COLLIDER2D_SHAPE_TYPES.CIRCLE}}, valid: true};
    }
    if (kind === 'capsule-radius') {
        const radius = positive(Math.abs(shapePoint[0]), config.shape.radius);
        const height = Math.max(config.shape.height, radius * 2);
        return {patch: {shape: {height, radius, type: COLLIDER2D_SHAPE_TYPES.CAPSULE}}, valid: true};
    }
    if (kind === 'capsule-height') {
        const height = Math.max(config.shape.radius * 2, positive(Math.abs(shapePoint[1]) * 2, config.shape.height));
        return {patch: {shape: {height, radius: config.shape.radius, type: COLLIDER2D_SHAPE_TYPES.CAPSULE}}, valid: true};
    }
    if (kind === 'polygon-vertex') {
        const index = Number(String(handle.id || '').replace('vertex-', ''));
        if (!Number.isInteger(index) || index < 0 || index >= config.shape.points.length) {
            return {error: 'Polygon handle index is invalid.', valid: false};
        }
        const next = config.shape.points.map(point => point.slice());
        next[index] = shapePoint;
        if (!isConvexPolygon(next)) {
            return {error: 'Convex Polygon vertices must remain convex and non-degenerate.', valid: false};
        }
        return {patch: {shape: {points: next, type: COLLIDER2D_SHAPE_TYPES.CONVEX_POLYGON}}, valid: true};
    }
    return {error: `Unknown Collider2D authoring handle: ${kind}`, valid: false};
};

const insertConvexPolygonPoint = (pointsValue, afterIndex = null) => {
    const points = Array.isArray(pointsValue) ? pointsValue.map(point => [finite(point[0]), finite(point[1])]) : [];
    if (points.length < 3 || points.length >= 32) return points;
    let index = Number.isInteger(afterIndex) ? Math.max(0, Math.min(points.length - 1, afterIndex)) : -1;
    if (index < 0) {
        let longest = -1;
        for (let i = 0; i < points.length; i++) {
            const next = points[(i + 1) % points.length];
            const length = Math.hypot(next[0] - points[i][0], next[1] - points[i][1]);
            if (length > longest) {
                longest = length;
                index = i;
            }
        }
    }
    const nextIndex = (index + 1) % points.length;
    const midpoint = [
        (points[index][0] + points[nextIndex][0]) / 2,
        (points[index][1] + points[nextIndex][1]) / 2
    ];
    const result = points.slice();
    result.splice(index + 1, 0, midpoint);
    return result;
};

const removeConvexPolygonPoint = (pointsValue, index) => {
    const points = Array.isArray(pointsValue) ? pointsValue.map(point => point.slice()) : [];
    if (points.length <= 3 || !Number.isInteger(index) || index < 0 || index >= points.length) return points;
    const result = points.slice();
    result.splice(index, 1);
    return result;
};

export {
    ROTATION_HANDLE_DISTANCE,
    applyColliderShapeHandleDrag,
    convertColliderShapePreservingBounds,
    createDefaultColliderShape,
    getColliderShapeAuthoringHandles,
    getShapeBounds,
    insertConvexPolygonPoint,
    removeConvexPolygonPoint
};
