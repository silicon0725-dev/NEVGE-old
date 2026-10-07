'use strict';
const {PHYSICS2D_BODY_KINDS} = require('../../../../src/core/physics2d');
const {createRapier2DBackendAdapter} = require('../../../../src/lib/physics-system');
const {createFakeRapier2D} = require('../../../helpers/fake-rapier2d');


describe('WS-10N8 Rapier2D backend adapter contract', () => {
    test('maps NGVGE world units to a private backend world and never exposes handles in semantic descriptors', () => {
        const adapter = createRapier2DBackendAdapter({RAPIER: createFakeRapier2D(), worldUnitsPerMeter: 100});
        const world = adapter.createWorld({gravity: [0, -980]});
        world.syncBodies([{
            bodyId: 'ngvge:component:rigid-1', nodeId: 'ngvge:node:ball', kind: PHYSICS2D_BODY_KINDS.DYNAMIC,
            position: [0, 100], rotationDegrees: 0, velocity: [0, 0], angularVelocityDegrees: 0,
            gravityScale: 1, mass: 1, colliders: [{colliderId: 'c1', localPoints: [[-10,-10],[10,-10],[10,10],[-10,10]], collisionLayer: 1, collisionMask: 1}]
        }]);
        world.step(1 / 60);
        const state = world.getBodyState('ngvge:component:rigid-1');
        expect(state.position[1]).toBeLessThan(100);
        expect(state.backendHandle).not.toBeNull();
        expect(adapter.getStatus()).not.toHaveProperty('backendHandle');
    });
    test('maps rectangle/circle/capsule descriptors to native Rapier primitives before convex fallback', () => {
        const RAPIER = createFakeRapier2D();
        const adapter = createRapier2DBackendAdapter({RAPIER, worldUnitsPerMeter: 100});
        const world = adapter.createWorld({gravity: [0, 0]});
        const body = (id, shapeType, localPoints) => ({
            bodyId: id, nodeId: id, kind: PHYSICS2D_BODY_KINDS.FIXED, position: [0, 0], rotationDegrees: 0,
            velocity: [0, 0], angularVelocityDegrees: 0, gravityScale: 0, mass: 0,
            colliders: [{colliderId: `${id}:c`, localPoints, shapeType, collisionLayer: 1, collisionMask: 1}]
        });
        const circle = Array.from({length: 32}, (_, index) => {
            const angle = index / 32 * Math.PI * 2;
            return [Math.cos(angle) * 50, Math.sin(angle) * 50];
        });
        const capsule = [];
        for (let index = 0; index <= 16; index++) {
            const angle = index / 16 * Math.PI;
            capsule.push([Math.cos(angle) * 25, 25 + Math.sin(angle) * 25]);
        }
        for (let index = 0; index <= 16; index++) {
            const angle = Math.PI + index / 16 * Math.PI;
            capsule.push([Math.cos(angle) * 25, -25 + Math.sin(angle) * 25]);
        }
        world.syncBodies([
            body('rect', 'rectangle', [[-50, -25], [50, -25], [50, 25], [-50, 25]]),
            body('circle', 'circle', circle),
            body('capsule', 'capsule', capsule)
        ]);
        expect(RAPIER.__createdColliderDescs.map(item => item.kind)).toEqual(['cuboid', 'ball', 'capsule']);
        RAPIER.__createdColliderDescs.forEach(item => {
            expect(item.setTranslation).toHaveLength(2);
            expect(item.setTranslation.every(Number.isFinite)).toBe(true);
        });
    });

});
