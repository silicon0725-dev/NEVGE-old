'use strict';
const {
    PHYSICS_MATERIAL2D_CONTRACT,
    PHYSICS_MATERIAL2D_RESOURCE_TYPE_ID,
    normalizePhysicsMaterial2D
} = require('../../../../src/core/physics-material2d');

describe('WS-10N8 PhysicsMaterial2D contract', () => {
    test('keeps ResourceId authority and backend material handles nonpersistent', () => {
        expect(PHYSICS_MATERIAL2D_RESOURCE_TYPE_ID).toBe('ngvge.physics-material2d-resource');
        expect(PHYSICS_MATERIAL2D_CONTRACT.identity.resourceIdAuthority).toBe('ngvge:resource:*');
        expect(PHYSICS_MATERIAL2D_CONTRACT.identity.backendMaterialHandlePersistent).toBe(false);
        expect(PHYSICS_MATERIAL2D_CONTRACT.massPolicy.rigidBodyMassAuthority).toBe('ngvge.rigidbody2d.mass');
        expect(PHYSICS_MATERIAL2D_CONTRACT.massPolicy.densityDeferred).toBe(true);
    });
    test('normalizes friction and restitution without competing with RigidBody mass authority', () => {
        expect(normalizePhysicsMaterial2D({density: 2, friction: 0.7, restitution: 1.5})).toEqual({
            friction: 0.7,
            restitution: 1
        });
    });
});
