'use strict';

const {createEngineCommand} = require('../protocol');

const COLLIDER2D_TYPE_ID = 'ngvge.collider2d';
const COLLIDER2D_SCHEMA_VERSION = 1;
const COLLIDER2D_COMPONENT_OWNER = 'ngvge.scene-system';
const COLLIDER2D_PATCH_COMMAND_TYPE = 'PatchCollider2D';
const COLLIDER2D_PATCH_APPLIED_EVENT_TYPE = 'Collider2DPatchApplied';
const COLLIDER2D_TRANSFORM_INHERITANCE = Object.freeze({
    INHERIT_NODE: 'inherit-node',
    IGNORE_NODE_SCALE: 'ignore-node-scale'
});
const COLLIDER2D_SHAPE_TYPES = Object.freeze({
    CAPSULE: 'capsule',
    CIRCLE: 'circle',
    CONVEX_POLYGON: 'convex-polygon',
    RECTANGLE: 'rectangle'
});
const COLLIDER2D_MAX_POLYGON_POINTS = 32;
const COLLIDER2D_MIN_DIMENSION = 0.001;
const COLLIDER2D_MAX_LAYER_MASK = 0xFFFFFFFF;

const COLLIDER2D_DEFAULT_SHAPE = Object.freeze({
    size: Object.freeze([100, 100]),
    type: COLLIDER2D_SHAPE_TYPES.RECTANGLE
});

const COLLIDER2D_DEFAULT_DATA = Object.freeze({
    collisionLayer: 1,
    collisionMask: 1,
    offset: Object.freeze([0, 0]),
    rotation: 0,
    sensor: true,
    shape: COLLIDER2D_DEFAULT_SHAPE,
    transformInheritance: COLLIDER2D_TRANSFORM_INHERITANCE.INHERIT_NODE
});

const COLLIDER2D_CONTRACT = Object.freeze({
    componentOwner: COLLIDER2D_COMPONENT_OWNER,
    contractId: 'ngvge.collider2d-contract',
    contractVersion: '1',
    identity: Object.freeze({
        backendHandlePersistent: false,
        colliderIdSource: 'Runtime ComponentId',
        nodeIdIsColliderId: false
    }),
    persistence: Object.freeze({
        nativeProject: '.ne',
        scratchProjection: 'native-only'
    }),
    querySemantics: Object.freeze({
        collisionFilter: '(a.layer & b.mask) && (b.layer & a.mask)',
        geometryAuthority: 'Collider2D.shape + Transform2D',
        rigidBodyRequired: false,
        sensorChangesQueryParticipation: false,
        sensorMeaning: 'trigger-non-solid'
    }),
    schemaVersion: COLLIDER2D_SCHEMA_VERSION,
    transform: Object.freeze({
        localOffsetField: 'offset',
        localRotationField: 'rotation',
        nodeSource: 'Transform2D',
        supportedInheritance: Object.freeze(Object.values(COLLIDER2D_TRANSFORM_INHERITANCE))
    }),
    typeId: COLLIDER2D_TYPE_ID
});

const isPlainObject = value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
};

const finiteNumber = (value, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};

const positiveNumber = (value, fallback) => Math.max(
    COLLIDER2D_MIN_DIMENSION,
    Math.abs(finiteNumber(value, fallback))
);

const normalizeVec2 = (value, fallback) => {
    const source = Array.isArray(value) && value.length === 2 ? value : fallback;
    return [finiteNumber(source[0], fallback[0]), finiteNumber(source[1], fallback[1])];
};

const normalizePositiveVec2 = (value, fallback) => {
    const source = Array.isArray(value) && value.length === 2 ? value : fallback;
    return [positiveNumber(source[0], fallback[0]), positiveNumber(source[1], fallback[1])];
};

const normalizeLayerMask = (value, fallback) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback >>> 0;
    const integer = Math.trunc(number);
    if (integer <= 0) return 0;
    if (integer >= COLLIDER2D_MAX_LAYER_MASK) return COLLIDER2D_MAX_LAYER_MASK;
    return integer >>> 0;
};

const normalizePolygonPoints = (value, fallback) => {
    const source = Array.isArray(value) ? value : fallback;
    const points = source.slice(0, COLLIDER2D_MAX_POLYGON_POINTS).map(point => normalizeVec2(point, [0, 0]));
    if (points.length >= 3) return points;
    return fallback.map(point => point.slice());
};

const DEFAULT_POLYGON_POINTS = Object.freeze([
    Object.freeze([-50, -50]),
    Object.freeze([50, -50]),
    Object.freeze([50, 50]),
    Object.freeze([-50, 50])
]);

const isConvexPolygon = points => {
    if (!Array.isArray(points) || points.length < 3) return false;
    let sign = 0;
    for (let index = 0; index < points.length; index++) {
        const a = points[index];
        const b = points[(index + 1) % points.length];
        const c = points[(index + 2) % points.length];
        if (![a, b, c].every(point => Array.isArray(point) && point.length === 2 &&
            point.every(value => Number.isFinite(Number(value))))) return false;
        const cross = ((Number(b[0]) - Number(a[0])) * (Number(c[1]) - Number(b[1]))) -
            ((Number(b[1]) - Number(a[1])) * (Number(c[0]) - Number(b[0])));
        if (Math.abs(cross) <= Number.EPSILON) continue;
        const nextSign = Math.sign(cross);
        if (sign && nextSign !== sign) return false;
        sign = nextSign;
    }
    return sign !== 0;
};

const normalizeCollider2DShape = value => {
    const source = isPlainObject(value) ? value : COLLIDER2D_DEFAULT_SHAPE;
    switch (source.type) {
    case COLLIDER2D_SHAPE_TYPES.CIRCLE:
        return {
            radius: positiveNumber(source.radius, 50),
            type: COLLIDER2D_SHAPE_TYPES.CIRCLE
        };
    case COLLIDER2D_SHAPE_TYPES.CAPSULE: {
        const radius = positiveNumber(source.radius, 25);
        return {
            height: Math.max(radius * 2, positiveNumber(source.height, 100)),
            radius,
            type: COLLIDER2D_SHAPE_TYPES.CAPSULE
        };
    }
    case COLLIDER2D_SHAPE_TYPES.CONVEX_POLYGON: {
        const points = normalizePolygonPoints(source.points, DEFAULT_POLYGON_POINTS);
        return {
            points: isConvexPolygon(points) ? points : DEFAULT_POLYGON_POINTS.map(point => point.slice()),
            type: COLLIDER2D_SHAPE_TYPES.CONVEX_POLYGON
        };
    }
    case COLLIDER2D_SHAPE_TYPES.RECTANGLE:
    default:
        return {
            size: normalizePositiveVec2(source.size, COLLIDER2D_DEFAULT_SHAPE.size),
            type: COLLIDER2D_SHAPE_TYPES.RECTANGLE
        };
    }
};

const normalizeTransformInheritance = value => (
    Object.values(COLLIDER2D_TRANSFORM_INHERITANCE).includes(value) ?
        value : COLLIDER2D_DEFAULT_DATA.transformInheritance
);

const normalizeCollider2D = value => {
    const source = isPlainObject(value) ? value : {};
    return {
        collisionLayer: normalizeLayerMask(source.collisionLayer, COLLIDER2D_DEFAULT_DATA.collisionLayer),
        collisionMask: normalizeLayerMask(source.collisionMask, COLLIDER2D_DEFAULT_DATA.collisionMask),
        offset: normalizeVec2(source.offset, COLLIDER2D_DEFAULT_DATA.offset),
        rotation: finiteNumber(source.rotation, COLLIDER2D_DEFAULT_DATA.rotation),
        sensor: typeof source.sensor === 'boolean' ? source.sensor : COLLIDER2D_DEFAULT_DATA.sensor,
        shape: normalizeCollider2DShape(source.shape),
        transformInheritance: normalizeTransformInheritance(source.transformInheritance)
    };
};

const COLLIDER2D_PATCH_FIELDS = new Set([
    'collisionLayer',
    'collisionMask',
    'offset',
    'rotation',
    'sensor',
    'shape',
    'transformInheritance'
]);

const assertFiniteVec2 = (value, field) => {
    if (!Array.isArray(value) || value.length !== 2 || value.some(item => !Number.isFinite(Number(item)))) {
        const error = new TypeError(`Collider2D ${field} must contain exactly two finite numbers.`);
        error.code = `NGVGE_COLLIDER2D_${field.toUpperCase()}_INVALID`;
        throw error;
    }
    return value.map(Number);
};

const assertShape = value => {
    if (!isPlainObject(value) || !Object.values(COLLIDER2D_SHAPE_TYPES).includes(value.type)) {
        const error = new TypeError('Collider2D shape must be a supported shape object.');
        error.code = 'NGVGE_COLLIDER2D_SHAPE_INVALID';
        throw error;
    }
    if (value.type === COLLIDER2D_SHAPE_TYPES.RECTANGLE) {
        const size = assertFiniteVec2(value.size, 'shape_size');
        if (size.some(number => number <= 0)) throw Object.assign(new TypeError('Rectangle size must be positive.'), {
            code: 'NGVGE_COLLIDER2D_SHAPE_SIZE_INVALID'
        });
    } else if (value.type === COLLIDER2D_SHAPE_TYPES.CIRCLE) {
        if (!Number.isFinite(Number(value.radius)) || Number(value.radius) <= 0) throw Object.assign(
            new TypeError('Circle radius must be positive.'), {code: 'NGVGE_COLLIDER2D_SHAPE_RADIUS_INVALID'}
        );
    } else if (value.type === COLLIDER2D_SHAPE_TYPES.CAPSULE) {
        const radius = Number(value.radius);
        const height = Number(value.height);
        if (!Number.isFinite(radius) || !Number.isFinite(height) || radius <= 0 || height < radius * 2) {
            throw Object.assign(new TypeError('Capsule radius must be positive and height must be at least diameter.'), {
                code: 'NGVGE_COLLIDER2D_SHAPE_CAPSULE_INVALID'
            });
        }
    } else if (value.type === COLLIDER2D_SHAPE_TYPES.CONVEX_POLYGON) {
        if (!Array.isArray(value.points) || value.points.length < 3 || value.points.length > COLLIDER2D_MAX_POLYGON_POINTS) {
            throw Object.assign(new TypeError('Convex polygon requires 3-32 points.'), {
                code: 'NGVGE_COLLIDER2D_SHAPE_POINTS_INVALID'
            });
        }
        const points = value.points.map(point => assertFiniteVec2(point, 'shape_point'));
        if (!isConvexPolygon(points)) {
            throw Object.assign(new TypeError('Convex polygon points must define a non-degenerate convex polygon.'), {
                code: 'NGVGE_COLLIDER2D_SHAPE_CONVEXITY_INVALID'
            });
        }
    }
    return normalizeCollider2DShape(value);
};

const normalizeCollider2DPatch = value => {
    if (!isPlainObject(value)) {
        const error = new TypeError('Collider2D patch must be a plain portable object.');
        error.code = 'NGVGE_COLLIDER2D_PATCH_INVALID';
        throw error;
    }
    const unsupported = Object.keys(value).filter(key => !COLLIDER2D_PATCH_FIELDS.has(key));
    if (unsupported.length) {
        const error = new TypeError(`Collider2D patch contains unsupported field(s): ${unsupported.join(', ')}`);
        error.code = 'NGVGE_COLLIDER2D_PATCH_FIELD_UNSUPPORTED';
        error.fields = unsupported;
        throw error;
    }
    if (!Object.keys(value).length) {
        const error = new TypeError('Collider2D patch must change at least one field.');
        error.code = 'NGVGE_COLLIDER2D_PATCH_EMPTY';
        throw error;
    }
    const result = {};
    if (Object.prototype.hasOwnProperty.call(value, 'collisionLayer')) {
        if (!Number.isFinite(Number(value.collisionLayer)) || Number(value.collisionLayer) < 0) throw Object.assign(
            new TypeError('Collider2D collisionLayer must be a non-negative finite integer.'),
            {code: 'NGVGE_COLLIDER2D_LAYER_INVALID'}
        );
        result.collisionLayer = normalizeLayerMask(value.collisionLayer, 1);
    }
    if (Object.prototype.hasOwnProperty.call(value, 'collisionMask')) {
        if (!Number.isFinite(Number(value.collisionMask)) || Number(value.collisionMask) < 0) throw Object.assign(
            new TypeError('Collider2D collisionMask must be a non-negative finite integer.'),
            {code: 'NGVGE_COLLIDER2D_MASK_INVALID'}
        );
        result.collisionMask = normalizeLayerMask(value.collisionMask, 1);
    }
    if (Object.prototype.hasOwnProperty.call(value, 'offset')) result.offset = assertFiniteVec2(value.offset, 'offset');
    if (Object.prototype.hasOwnProperty.call(value, 'rotation')) {
        if (!Number.isFinite(Number(value.rotation))) throw Object.assign(new TypeError('Collider2D rotation must be finite.'), {
            code: 'NGVGE_COLLIDER2D_ROTATION_INVALID'
        });
        result.rotation = Number(value.rotation);
    }
    if (Object.prototype.hasOwnProperty.call(value, 'sensor')) {
        if (typeof value.sensor !== 'boolean') throw Object.assign(new TypeError('Collider2D sensor must be boolean.'), {
            code: 'NGVGE_COLLIDER2D_SENSOR_INVALID'
        });
        result.sensor = value.sensor;
    }
    if (Object.prototype.hasOwnProperty.call(value, 'shape')) result.shape = assertShape(value.shape);
    if (Object.prototype.hasOwnProperty.call(value, 'transformInheritance')) {
        if (!Object.values(COLLIDER2D_TRANSFORM_INHERITANCE).includes(value.transformInheritance)) {
            throw Object.assign(new TypeError('Collider2D transformInheritance is unsupported.'), {
                code: 'NGVGE_COLLIDER2D_TRANSFORM_INHERITANCE_INVALID'
            });
        }
        result.transformInheritance = value.transformInheritance;
    }
    return result;
};

const applyCollider2DPatch = (current, patch) => normalizeCollider2D(Object.assign(
    {},
    normalizeCollider2D(current),
    normalizeCollider2DPatch(patch)
));

const createCollider2DPatchComponentCommand = ({componentId, nodeId, patch}) => createEngineCommand(
    COLLIDER2D_PATCH_COMMAND_TYPE,
    {
        componentId,
        nodeId,
        patch: normalizeCollider2DPatch(patch)
    }
);

module.exports = {
    COLLIDER2D_COMPONENT_OWNER,
    COLLIDER2D_CONTRACT,
    COLLIDER2D_DEFAULT_DATA,
    COLLIDER2D_MAX_LAYER_MASK,
    COLLIDER2D_MAX_POLYGON_POINTS,
    COLLIDER2D_PATCH_APPLIED_EVENT_TYPE,
    COLLIDER2D_PATCH_COMMAND_TYPE,
    COLLIDER2D_SCHEMA_VERSION,
    COLLIDER2D_SHAPE_TYPES,
    COLLIDER2D_TRANSFORM_INHERITANCE,
    COLLIDER2D_TYPE_ID,
    applyCollider2DPatch,
    createCollider2DPatchComponentCommand,
    isConvexPolygon,
    normalizeCollider2D,
    normalizeCollider2DPatch,
    normalizeCollider2DShape
};
