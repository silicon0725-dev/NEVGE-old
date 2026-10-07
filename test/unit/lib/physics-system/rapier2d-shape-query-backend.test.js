'use strict';

const {
    createRapier2DShapeQueryBackend,
    fitPrimitiveGeometry
} = require('../../../../src/lib/physics-system');
const {COLLIDER2D_SHAPE_TYPES} = require('../../../../src/core/collider2d');

const circlePoints = (cx, cy, radius, segments = 32) => Array.from({length: segments}, (_, index) => {
    const angle = index / segments * Math.PI * 2;
    return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
});
const rectanglePoints = (cx, cy, width, height) => [
    [cx - width / 2, cy - height / 2],
    [cx + width / 2, cy - height / 2],
    [cx + width / 2, cy + height / 2],
    [cx - width / 2, cy + height / 2]
];
const capsulePoints = (cx, cy, radius, height) => {
    const straightHalf = Math.max(0, height / 2 - radius);
    const points = [];
    for (let index = 0; index <= 16; index++) {
        const angle = index / 16 * Math.PI;
        points.push([cx + Math.cos(angle) * radius, cy + straightHalf + Math.sin(angle) * radius]);
    }
    for (let index = 0; index <= 16; index++) {
        const angle = Math.PI + index / 16 * Math.PI;
        points.push([cx + Math.cos(angle) * radius, cy - straightHalf + Math.sin(angle) * radius]);
    }
    return points;
};
const collider = (nodeId, shape, worldPoints) => ({
    active: true,
    componentId: `${nodeId}:collider`,
    config: {collisionLayer: 1, collisionMask: 1, sensor: false, shape},
    name: nodeId,
    nodeId,
    worldPoints
});

describe('WS-10N8-HF14 Rapier shape-aware query backend', () => {
    let RAPIER;
    beforeAll(async () => {
        RAPIER = require('@dimforge/rapier2d-compat');
        if (typeof RAPIER.init === 'function') await RAPIER.init();
    });

    test('fits native rectangle/circle/capsule geometry to analytic Rapier primitives', () => {
        expect(fitPrimitiveGeometry(COLLIDER2D_SHAPE_TYPES.RECTANGLE, rectanglePoints(0, 0, 100, 60)).kind).toBe('cuboid');
        expect(fitPrimitiveGeometry(COLLIDER2D_SHAPE_TYPES.CIRCLE, circlePoints(0, 0, 50)).kind).toBe('ball');
        expect(fitPrimitiveGeometry(COLLIDER2D_SHAPE_TYPES.CAPSULE, capsulePoints(0, 0, 25, 100)).kind).toBe('capsule');
    });

    test('falls back when a semantic circle is non-uniformly distorted', () => {
        const stretched = circlePoints(0, 0, 50).map(point => [point[0] * 2, point[1]]);
        expect(fitPrimitiveGeometry(COLLIDER2D_SHAPE_TYPES.CIRCLE, stretched)).toBeNull();
    });

    test('casts an analytic circle into a box with the expected TOI and opposing normal', () => {
        const backend = createRapier2DShapeQueryBackend({RAPIER});
        const moving = backend.prepareCollider(collider('circle', {type: 'circle', radius: 50}, circlePoints(0, 0, 50)));
        const wall = backend.prepareCollider(collider('wall', {type: 'rectangle', size: [100, 200]}, rectanglePoints(200, 0, 100, 200)));
        expect(moving.shapeKind).toBe('ball');
        expect(wall.shapeKind).toBe('cuboid');
        const hit = backend.castPrepared(moving, [200, 0], wall);
        expect(hit).not.toBeNull();
        expect(hit.t).toBeCloseTo(0.5, 2);
        expect(hit.normal[0]).toBeLessThan(-0.99);
        expect(Math.abs(hit.normal[1])).toBeLessThan(0.02);
    });

    test('casts an analytic capsule without polygon SAT', () => {
        const backend = createRapier2DShapeQueryBackend({RAPIER});
        const moving = backend.prepareCollider(collider('capsule', {type: 'capsule', radius: 25, height: 100}, capsulePoints(0, 0, 25, 100)));
        const wall = backend.prepareCollider(collider('wall', {type: 'rectangle', size: [100, 200]}, rectanglePoints(200, 0, 100, 200)));
        expect(moving.shapeKind).toBe('capsule');
        const hit = backend.castPrepared(moving, [200, 0], wall);
        expect(hit).not.toBeNull();
        expect(hit.normal[0]).toBeLessThan(-0.99);
    });
});
