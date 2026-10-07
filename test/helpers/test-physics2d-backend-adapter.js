'use strict';

const {
    PHYSICS2D_BACKEND_CONTRACT_ID,
    PHYSICS2D_BACKEND_CONTRACT_VERSION,
    PHYSICS2D_BODY_KINDS
} = require('../../src/core/physics2d');

const createTestPhysics2DBackendAdapter = tracker => Object.freeze({
    backendId: 'ngvge.physics2d.backend.test-contract',
    backendVersion: '1',
    contractId: PHYSICS2D_BACKEND_CONTRACT_ID,
    contractVersion: PHYSICS2D_BACKEND_CONTRACT_VERSION,
    createWorld: options => {
        const gravity = options && Array.isArray(options.gravity) ? options.gravity.slice() : [0, -980];
        const states = new Map();
        return Object.freeze({
            dispose: () => states.clear(),
            getBodyState: bodyId => {
                const state = states.get(bodyId);
                return state ? JSON.parse(JSON.stringify(state)) : null;
            },
            syncBodies: descriptors => {
                tracker.syncCalls += 1;
                tracker.lastDescriptors = JSON.parse(JSON.stringify(descriptors || []));
                const nextIds = new Set((descriptors || []).map(item => item.bodyId));
                Array.from(states.keys()).forEach(id => {
                    if (!nextIds.has(id)) states.delete(id);
                });
                (descriptors || []).forEach(descriptor => {
                    const previous = states.get(descriptor.bodyId);
                    if (previous) return;
                    states.set(descriptor.bodyId, {
                        angularVelocityDegrees: Number(descriptor.angularVelocityDegrees) || 0,
                        backendHandle: `test-private:${descriptor.bodyId}`,
                        kind: descriptor.kind,
                        position: (descriptor.position || [0, 0]).slice(),
                        rotationDegrees: Number(descriptor.rotationDegrees) || 0,
                        sleeping: Boolean(descriptor.sleeping),
                        velocity: (descriptor.velocity || [0, 0]).slice(),
                        gravityScale: Number(descriptor.gravityScale) || 0
                    });
                });
            },
            step: deltaSeconds => {
                tracker.stepCalls += 1;
                const dt = Number(deltaSeconds) || 1 / 60;
                states.forEach(state => {
                    if (state.kind !== PHYSICS2D_BODY_KINDS.DYNAMIC || state.sleeping) return;
                    state.velocity[0] += gravity[0] * state.gravityScale * dt;
                    state.velocity[1] += gravity[1] * state.gravityScale * dt;
                    state.position[0] += state.velocity[0] * dt;
                    state.position[1] += state.velocity[1] * dt;
                    state.rotationDegrees += state.angularVelocityDegrees * dt;
                });
            }
        });
    }
});

const createTestPhysics2DTracker = () => ({lastDescriptors: [], stepCalls: 0, syncCalls: 0});

module.exports = {createTestPhysics2DBackendAdapter, createTestPhysics2DTracker};
