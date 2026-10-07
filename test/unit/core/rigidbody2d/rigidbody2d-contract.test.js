'use strict';
const {
    RIGIDBODY2D_CONTRACT,
    RIGIDBODY2D_TYPE_ID,
    applyRigidBody2DPatch,
    normalizeRigidBody2D
} = require('../../../../src/core/rigidbody2d');

describe('WS-10N8 RigidBody2D contract', () => {
    test('provides stable authored rigidbody semantics without backend identity', () => {
        expect(RIGIDBODY2D_TYPE_ID).toBe('ngvge.rigidbody2d');
        expect(RIGIDBODY2D_CONTRACT.identity.backendHandlePersistent).toBe(false);
        expect(RIGIDBODY2D_CONTRACT.identity.rigidBodyIdSource).toBe('Runtime ComponentId');
        expect(RIGIDBODY2D_CONTRACT.persistence.runtimeVelocityPersistent).toBe(false);
    });
    test('normalizes P0 dynamic body authoring properties', () => {
        expect(normalizeRigidBody2D({mass: 2, velocity: [100, -20], gravityScale: 0.5, friction: 3, restitution: 2})).toEqual(expect.objectContaining({
            mass: 2, velocity: [100, -20], gravityScale: 0.5, friction: 3, restitution: 1
        }));
        expect(applyRigidBody2DPatch({}, {ccd: true, freezeRotation: true})).toEqual(expect.objectContaining({ccd: true, freezeRotation: true}));
    });
    test('rejects unsupported persistent fields such as a backend handle', () => {
        expect(() => applyRigidBody2DPatch({}, {backendHandle: 123})).toThrow(expect.objectContaining({
            code: 'NGVGE_RIGIDBODY2D_PATCH_FIELD_UNSUPPORTED'
        }));
    });
});
