'use strict';

const {
    COLLIDER2D_CONTRACT,
    COLLIDER2D_SHAPE_TYPES,
    COLLIDER2D_TRANSFORM_INHERITANCE,
    COLLIDER2D_TYPE_ID,
    applyCollider2DPatch,
    createCollider2DPatchComponentCommand,
    normalizeCollider2D,
    normalizeCollider2DPatch
} = require('../../../../src/core/collider2d');

const {PROTOCOL_DTO_KINDS} = require('../../../../src/core/protocol');

describe('WS-10N5 Collider2D core contract', () => {
    test('owns portable native collision semantics without backend handles', () => {
        expect(COLLIDER2D_CONTRACT.typeId).toBe(COLLIDER2D_TYPE_ID);
        expect(COLLIDER2D_CONTRACT.persistence).toEqual({
            nativeProject: '.ne',
            scratchProjection: 'native-only'
        });
        expect(COLLIDER2D_CONTRACT.identity.backendHandlePersistent).toBe(false);
        expect(COLLIDER2D_CONTRACT.querySemantics.rigidBodyRequired).toBe(false);
    });

    test('normalizes the Area-friendly rectangle default', () => {
        expect(normalizeCollider2D()).toEqual({
            collisionLayer: 1,
            collisionMask: 1,
            offset: [0, 0],
            rotation: 0,
            sensor: true,
            shape: {size: [100, 100], type: COLLIDER2D_SHAPE_TYPES.RECTANGLE},
            transformInheritance: COLLIDER2D_TRANSFORM_INHERITANCE.INHERIT_NODE
        });
    });

    test('supports rectangle, circle, capsule and convex polygon data', () => {
        expect(normalizeCollider2D({shape: {type: 'circle', radius: 12}}).shape).toEqual({
            radius: 12,
            type: COLLIDER2D_SHAPE_TYPES.CIRCLE
        });
        expect(normalizeCollider2D({shape: {type: 'capsule', radius: 10, height: 40}}).shape).toEqual({
            height: 40,
            radius: 10,
            type: COLLIDER2D_SHAPE_TYPES.CAPSULE
        });
        expect(normalizeCollider2D({shape: {
            type: 'convex-polygon',
            points: [[0, 0], [20, 0], [0, 20]]
        }}).shape.points).toHaveLength(3);
    });

    test('rejects concave or degenerate data for the Convex Polygon profile', () => {
        expect(() => normalizeCollider2DPatch({shape: {
            type: COLLIDER2D_SHAPE_TYPES.CONVEX_POLYGON,
            points: [[0, 0], [20, 0], [10, 5], [20, 20], [0, 20]]
        }})).toThrow(expect.objectContaining({code: 'NGVGE_COLLIDER2D_SHAPE_CONVEXITY_INVALID'}));
        expect(normalizeCollider2D({shape: {
            type: COLLIDER2D_SHAPE_TYPES.CONVEX_POLYGON,
            points: [[0, 0], [10, 0], [20, 0]]
        }}).shape.points).toEqual([[-50, -50], [50, -50], [50, 50], [-50, 50]]);
    });

    test('applies strict portable patches and rejects unsupported fields', () => {
        const next = applyCollider2DPatch(normalizeCollider2D(), {
            collisionLayer: 2,
            collisionMask: 4,
            offset: [3, -4],
            rotation: 15,
            sensor: false,
            shape: {type: 'circle', radius: 25},
            transformInheritance: COLLIDER2D_TRANSFORM_INHERITANCE.IGNORE_NODE_SCALE
        });
        expect(next).toEqual(expect.objectContaining({
            collisionLayer: 2,
            collisionMask: 4,
            offset: [3, -4],
            rotation: 15,
            sensor: false,
            shape: {type: 'circle', radius: 25}
        }));
        expect(() => normalizeCollider2DPatch({backendHandle: 7})).toThrow(expect.objectContaining({
            code: 'NGVGE_COLLIDER2D_PATCH_FIELD_UNSUPPORTED'
        }));
    });

    test('creates semantic PatchCollider2D protocol commands', () => {
        const command = createCollider2DPatchComponentCommand({
            componentId: 'component:collider',
            nodeId: 'node:area',
            patch: {sensor: false}
        });
        expect(command.kind).toBe(PROTOCOL_DTO_KINDS.COMMAND);
        expect(command.type).toBe('PatchCollider2D');
        expect(command.payload).toEqual(expect.objectContaining({
            componentId: 'component:collider',
            nodeId: 'node:area',
            patch: {sensor: false}
        }));
    });
});
