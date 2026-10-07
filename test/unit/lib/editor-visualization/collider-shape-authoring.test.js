import {
    applyColliderShapeHandleDrag,
    convertColliderShapePreservingBounds,
    getColliderShapeAuthoringHandles,
    insertConvexPolygonPoint,
    removeConvexPolygonPoint
} from '../../../../src/lib/editor-visualization';

describe('WS-10N6-HF5 Collider2D shape authoring math', () => {
    test('preserves effective bounds when switching shape type', () => {
        expect(convertColliderShapePreservingBounds({type: 'rectangle', size: [120, 80]}, 'circle')).toEqual({
            radius: 60,
            type: 'circle'
        });
        expect(convertColliderShapePreservingBounds({type: 'circle', radius: 30}, 'rectangle')).toEqual({
            size: [60, 60],
            type: 'rectangle'
        });
    });

    test('exposes shape-specific resize, offset and rotation handles', () => {
        const rectangle = getColliderShapeAuthoringHandles({
            shape: {type: 'rectangle', size: [100, 60]},
            offset: [0, 0], rotation: 0
        });
        expect(rectangle.map(handle => handle.kind)).toEqual(expect.arrayContaining([
            'rectangle-width', 'rectangle-height', 'rectangle-size', 'offset', 'rotation'
        ]));
        expect(rectangle.filter(handle => handle.kind === 'rectangle-size')).toHaveLength(4);

        const circle = getColliderShapeAuthoringHandles({shape: {type: 'circle', radius: 25}});
        expect(circle.some(handle => handle.kind === 'circle-radius')).toBe(true);
    });

    test('resizes rectangle/circle/capsule and keeps capsule height legal', () => {
        const rectangle = applyColliderShapeHandleDrag({shape: {type: 'rectangle', size: [100, 100]}}, {
            id: 'size-ne', kind: 'rectangle-size'
        }, {shapeLocal: [80, 30]});
        expect(rectangle.patch.shape.size).toEqual([160, 60]);

        const circle = applyColliderShapeHandleDrag({shape: {type: 'circle', radius: 20}}, {
            id: 'radius', kind: 'circle-radius'
        }, {shapeLocal: [30, 40]});
        expect(circle.patch.shape.radius).toBe(50);

        const capsule = applyColliderShapeHandleDrag({shape: {type: 'capsule', radius: 20, height: 60}}, {
            id: 'radius', kind: 'capsule-radius'
        }, {shapeLocal: [40, 0]});
        expect(capsule.patch.shape).toEqual({type: 'capsule', radius: 40, height: 80});
    });

    test('moves local offset and rotates around the collider center', () => {
        const moved = applyColliderShapeHandleDrag({offset: [0, 0], shape: {type: 'rectangle', size: [20, 20]}}, {
            id: 'offset', kind: 'offset'
        }, {nodeLocal: [12, -8]});
        expect(moved.patch.offset).toEqual([12, -8]);

        const rotated = applyColliderShapeHandleDrag({offset: [10, 10], shape: {type: 'rectangle', size: [20, 20]}}, {
            id: 'rotation', kind: 'rotation'
        }, {nodeLocal: [20, 10]});
        expect(rotated.patch.rotation).toBeCloseTo(-90);
    });

    test('polygon vertex edits reject concave shapes while add/remove keeps at least three vertices', () => {
        const config = {shape: {type: 'convex-polygon', points: [[-10, -10], [10, -10], [10, 10], [-10, 10]]}};
        const rejected = applyColliderShapeHandleDrag(config, {id: 'vertex-1', kind: 'polygon-vertex'}, {
            shapeLocal: [-20, 0]
        });
        expect(rejected.valid).toBe(false);

        const added = insertConvexPolygonPoint(config.shape.points);
        expect(added).toHaveLength(5);
        let points = added;
        points = removeConvexPolygonPoint(points, 0);
        points = removeConvexPolygonPoint(points, 0);
        points = removeConvexPolygonPoint(points, 0);
        expect(points).toHaveLength(3);
    });
});
