'use strict';

const RAPIER = require('@dimforge/rapier2d-compat');
const {PHYSICS2D_BODY_KINDS} = require('../../../../src/core/physics2d');
const {createRapier2DBackendAdapter} = require('../../../../src/lib/physics-system');

describe('WS-10N8-HF14.1 real Rapier2D API compatibility', () => {
    beforeAll(async () => {
        await RAPIER.init();
    });

    test('native primitive collider descriptors use the real 0.19.3 translation signature and remain simulatable', () => {
        const adapter = createRapier2DBackendAdapter({RAPIER, worldUnitsPerMeter: 100});
        const world = adapter.createWorld({gravity: [0, -980]});
        const circle = Array.from({length: 32}, (_, index) => {
            const angle = index / 32 * Math.PI * 2;
            return [10 + Math.cos(angle) * 50, 20 + Math.sin(angle) * 50];
        });

        expect(() => world.syncBodies([{
            angularVelocityDegrees: 0,
            bodyId: 'real-rapier-circle',
            ccd: false,
            colliders: [{
                colliderId: 'real-rapier-circle:collider',
                collisionLayer: 1,
                collisionMask: 1,
                friction: 0.5,
                localPoints: circle,
                restitution: 0,
                sensor: false,
                shapeType: 'circle'
            }],
            freezeRotation: true,
            gravityScale: 1,
            kind: PHYSICS2D_BODY_KINDS.DYNAMIC,
            mass: 1,
            nodeId: 'real-rapier-circle',
            position: [0, 100],
            rotationDegrees: 0,
            sleeping: false,
            velocity: [0, 0]
        }])).not.toThrow();

        const before = world.getBodyState('real-rapier-circle');
        expect(before).not.toBeNull();
        world.step(1 / 60);
        const after = world.getBodyState('real-rapier-circle');
        expect(after.position[1]).toBeLessThan(before.position[1]);
        world.dispose();
    });
});
