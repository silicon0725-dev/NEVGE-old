'use strict';

const {
    convexPolygonPenetration,
    sweepConvexPolygons
} = require('../../../../src/lib/character-controller-system');

const rectangle = (cx, cy, width, height) => {
    const hw = width / 2;
    const hh = height / 2;
    return [
        [cx - hw, cy - hh],
        [cx + hw, cy - hh],
        [cx + hw, cy + hh],
        [cx - hw, cy + hh]
    ];
};

describe('WS-10N6 CharacterController2D kinematic sweep', () => {
    test('continuously sweeps into a floor and reports an upward surface normal', () => {
        const hit = sweepConvexPolygons(
            rectangle(0, 100, 50, 50),
            [0, -100],
            rectangle(0, 0, 200, 50)
        );
        expect(hit).not.toBeNull();
        expect(hit.t).toBeCloseTo(0.5);
        expect(hit.normal[0]).toBeCloseTo(0);
        expect(hit.normal[1]).toBeCloseTo(1);
    });

    test('continuously sweeps into a wall and reports an opposing wall normal', () => {
        const hit = sweepConvexPolygons(
            rectangle(0, 0, 50, 50),
            [200, 0],
            rectangle(100, 0, 50, 200)
        );
        expect(hit).not.toBeNull();
        expect(hit.t).toBeCloseTo(0.25);
        expect(hit.normal[0]).toBeCloseTo(-1);
        expect(hit.normal[1]).toBeCloseTo(0);
    });

    test('does not report a touching surface when the character moves away', () => {
        expect(sweepConvexPolygons(
            rectangle(0, 50, 50, 50),
            [0, 20],
            rectangle(0, 0, 200, 50)
        )).toBeNull();
    });

    test('treats sub-slop resting penetration as contact instead of a blocking initial overlap', () => {
        expect(sweepConvexPolygons(
            rectangle(0, 49.99995, 50, 50),
            [0, 20],
            rectangle(0, 0, 200, 50)
        )).toBeNull();
    });

    test('reports penetration separately for initial overlap recovery/diagnostics', () => {
        const penetration = convexPolygonPenetration(
            rectangle(0, 10, 50, 50),
            rectangle(0, 0, 200, 50)
        );
        expect(penetration).not.toBeNull();
        expect(penetration.depth).toBeGreaterThan(0);
        expect(penetration.normal[1]).toBeGreaterThan(0);
    });
});
