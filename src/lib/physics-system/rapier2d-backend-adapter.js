'use strict';

const {
    PHYSICS2D_BACKEND_CONTRACT_ID,
    PHYSICS2D_BACKEND_CONTRACT_VERSION,
    PHYSICS2D_BODY_KINDS
} = require('../../core/physics2d');
const {fitPrimitiveGeometry} = require('./rapier2d-shape-query-backend');

const RAPPIER2D_BACKEND_ID = 'ngvge.physics2d.backend.rapier2d';
const RAPPIER2D_BACKEND_VERSION = '0.19.3-poc1';
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clone = value => JSON.parse(JSON.stringify(value));

const callChain = (target, method, args) => {
    if (target && typeof target[method] === 'function') {
        const result = target[method](...args);
        return result || target;
    }
    return target;
};

const createRapier2DBackendAdapter = options => {
    const source = options && typeof options === 'object' ? options : {};
    const RAPIER = source.RAPIER;
    const worldUnitsPerMeter = Math.max(0.000001, finite(source.worldUnitsPerMeter, 100));
    if (!RAPIER || typeof RAPIER.World !== 'function' || !RAPIER.RigidBodyDesc || !RAPIER.ColliderDesc) {
        throw Object.assign(new TypeError('Rapier2D backend requires an initialized Rapier2D module.'), {
            code: 'NGVGE_RAPIER2D_MODULE_REQUIRED'
        });
    }
    const toMeters = value => finite(value) / worldUnitsPerMeter;
    const toWorld = value => finite(value) * worldUnitsPerMeter;
    const vecToMeters = value => [toMeters(value[0]), toMeters(value[1])];
    const makeCollisionGroups = config => {
        const layer = (Number(config && config.collisionLayer) || 0) & 0xFFFF;
        const mask = (Number(config && config.collisionMask) || 0) & 0xFFFF;
        return ((layer << 16) | mask) >>> 0;
    };

    const createWorld = worldOptions => {
        const gravity = worldOptions && Array.isArray(worldOptions.gravity) ? worldOptions.gravity : [0, -980];
        const world = new RAPIER.World({x: toMeters(gravity[0]), y: toMeters(gravity[1])});
        const records = new Map();
        let disposed = false;
        const removeRecord = record => {
            if (!record) return;
            if (record.body && typeof world.removeRigidBody === 'function') {
                try { world.removeRigidBody(record.body); } catch { /* backend cleanup best effort */ }
            }
        };
        const makeBodyDesc = descriptor => {
            const kind = descriptor.kind;
            let desc;
            if (kind === PHYSICS2D_BODY_KINDS.DYNAMIC) desc = RAPIER.RigidBodyDesc.dynamic();
            else if (kind === PHYSICS2D_BODY_KINDS.KINEMATIC && RAPIER.RigidBodyDesc.kinematicPositionBased) {
                desc = RAPIER.RigidBodyDesc.kinematicPositionBased();
            } else desc = RAPIER.RigidBodyDesc.fixed();
            const position = vecToMeters(descriptor.position || [0, 0]);
            desc = callChain(desc, 'setTranslation', position);
            desc = callChain(desc, 'setRotation', [finite(descriptor.rotationDegrees) * DEG_TO_RAD]);
            if (kind === PHYSICS2D_BODY_KINDS.DYNAMIC) {
                const velocity = vecToMeters(descriptor.velocity || [0, 0]);
                desc = callChain(desc, 'setLinvel', velocity);
                desc = callChain(desc, 'setAngvel', [finite(descriptor.angularVelocityDegrees) * DEG_TO_RAD]);
                desc = callChain(desc, 'setGravityScale', [finite(descriptor.gravityScale, 1)]);
                desc = callChain(desc, 'setLinearDamping', [Math.max(0, finite(descriptor.linearDamping))]);
                desc = callChain(desc, 'setAngularDamping', [Math.max(0, finite(descriptor.angularDamping))]);
                if (descriptor.freezeRotation) desc = callChain(desc, 'lockRotations', []);
                desc = callChain(desc, 'setCcdEnabled', [Boolean(descriptor.ccd)]);
                desc = callChain(desc, 'setCanSleep', [true]);
            }
            return desc;
        };
        const createCollider = (colliderDescriptor, body) => {
            const points = Array.isArray(colliderDescriptor.localPoints) ? colliderDescriptor.localPoints : [];
            if (points.length < 3) return null;
            const primitive = fitPrimitiveGeometry(colliderDescriptor.shapeType, points);
            let desc = null;
            if (primitive && primitive.kind === 'cuboid' && typeof RAPIER.ColliderDesc.cuboid === 'function') {
                desc = RAPIER.ColliderDesc.cuboid(
                    toMeters(primitive.halfExtents[0]),
                    toMeters(primitive.halfExtents[1])
                );
            } else if (primitive && primitive.kind === 'ball' && typeof RAPIER.ColliderDesc.ball === 'function') {
                desc = RAPIER.ColliderDesc.ball(toMeters(primitive.radius));
            } else if (primitive && primitive.kind === 'capsule' && typeof RAPIER.ColliderDesc.capsule === 'function') {
                desc = RAPIER.ColliderDesc.capsule(toMeters(primitive.halfHeight), toMeters(primitive.radius));
            }
            if (desc && primitive) {
                desc = callChain(desc, 'setTranslation', [toMeters(primitive.center[0]), toMeters(primitive.center[1])]);
                desc = callChain(desc, 'setRotation', [finite(primitive.rotation)]);
            } else {
                const flat = new Float32Array(points.length * 2);
                points.forEach((point, index) => {
                    flat[index * 2] = toMeters(point[0]);
                    flat[index * 2 + 1] = toMeters(point[1]);
                });
                desc = typeof RAPIER.ColliderDesc.convexHull === 'function' ? RAPIER.ColliderDesc.convexHull(flat) : null;
            }
            if (!desc) return null;
            desc = callChain(desc, 'setSensor', [Boolean(colliderDescriptor.sensor)]);
            desc = callChain(desc, 'setFriction', [Math.max(0, finite(colliderDescriptor.friction, 0.5))]);
            desc = callChain(desc, 'setRestitution', [Math.max(0, Math.min(1, finite(colliderDescriptor.restitution, 0)))]);
            desc = callChain(desc, 'setCollisionGroups', [makeCollisionGroups(colliderDescriptor)]);
            if (Number.isFinite(Number(colliderDescriptor.mass)) && typeof desc.setMass === 'function') {
                desc = callChain(desc, 'setMass', [Math.max(0.000001, Number(colliderDescriptor.mass))]);
            }
            return world.createCollider(desc, body);
        };
        const createRecord = descriptor => {
            const body = world.createRigidBody(makeBodyDesc(descriptor));
            const colliders = (descriptor.colliders || []).map(item => createCollider(item, body)).filter(Boolean);
            if (descriptor.sleeping && body && typeof body.sleep === 'function') body.sleep();
            return {body, colliders, descriptor: clone(descriptor)};
        };
        const updateKinematicOrFixedPose = (record, descriptor) => {
            if (!record || !record.body) return;
            const p = vecToMeters(descriptor.position || [0, 0]);
            const r = finite(descriptor.rotationDegrees) * DEG_TO_RAD;
            if (descriptor.kind === PHYSICS2D_BODY_KINDS.KINEMATIC) {
                if (typeof record.body.setNextKinematicTranslation === 'function') record.body.setNextKinematicTranslation({x: p[0], y: p[1]});
                else if (typeof record.body.setTranslation === 'function') record.body.setTranslation({x: p[0], y: p[1]}, true);
                if (typeof record.body.setNextKinematicRotation === 'function') record.body.setNextKinematicRotation(r);
                else if (typeof record.body.setRotation === 'function') record.body.setRotation(r, true);
            } else if (descriptor.kind !== PHYSICS2D_BODY_KINDS.DYNAMIC) {
                if (typeof record.body.setTranslation === 'function') record.body.setTranslation({x: p[0], y: p[1]}, true);
                if (typeof record.body.setRotation === 'function') record.body.setRotation(r, true);
            }
        };
        return Object.freeze({
            dispose: () => {
                if (disposed) return;
                disposed = true;
                records.forEach(removeRecord);
                records.clear();
                if (typeof world.free === 'function') world.free();
            },
            getBodyState: bodyId => {
                const record = records.get(bodyId);
                if (!record || !record.body) return null;
                const translation = typeof record.body.translation === 'function' ? record.body.translation() : {x: 0, y: 0};
                const velocity = typeof record.body.linvel === 'function' ? record.body.linvel() : {x: 0, y: 0};
                const rotation = typeof record.body.rotation === 'function' ? record.body.rotation() : 0;
                const angularVelocity = typeof record.body.angvel === 'function' ? record.body.angvel() : 0;
                return Object.freeze({
                    angularVelocityDegrees: finite(angularVelocity) * RAD_TO_DEG,
                    backendHandle: typeof record.body.handle === 'undefined' ? null : record.body.handle,
                    position: [toWorld(translation.x), toWorld(translation.y)],
                    rotationDegrees: finite(rotation) * RAD_TO_DEG,
                    sleeping: typeof record.body.isSleeping === 'function' ? Boolean(record.body.isSleeping()) : false,
                    velocity: [toWorld(velocity.x), toWorld(velocity.y)]
                });
            },
            getDebugStatus: () => Object.freeze({bodyCount: records.size, disposed, worldUnitsPerMeter}),
            syncBodies: descriptors => {
                if (disposed) return;
                const nextIds = new Set((descriptors || []).map(item => item.bodyId));
                Array.from(records.keys()).forEach(bodyId => {
                    if (nextIds.has(bodyId)) return;
                    removeRecord(records.get(bodyId));
                    records.delete(bodyId);
                });
                (descriptors || []).forEach(descriptor => {
                    const previous = records.get(descriptor.bodyId);
                    const structuralSignature = JSON.stringify({
                        colliders: descriptor.colliders,
                        kind: descriptor.kind,
                        mass: descriptor.mass,
                        freezeRotation: descriptor.freezeRotation,
                        ccd: descriptor.ccd
                    });
                    if (!previous || previous.structuralSignature !== structuralSignature) {
                        if (previous) removeRecord(previous);
                        const record = createRecord(descriptor);
                        record.structuralSignature = structuralSignature;
                        records.set(descriptor.bodyId, record);
                        return;
                    }
                    previous.descriptor = clone(descriptor);
                    updateKinematicOrFixedPose(previous, descriptor);
                });
            },
            step: deltaSeconds => {
                if (disposed) return;
                if (Number.isFinite(Number(deltaSeconds))) {
                    if (world.integrationParameters && Object.prototype.hasOwnProperty.call(world.integrationParameters, 'dt')) {
                        world.integrationParameters.dt = Number(deltaSeconds);
                    } else if (Object.prototype.hasOwnProperty.call(world, 'timestep')) world.timestep = Number(deltaSeconds);
                }
                world.step();
            }
        });
    };

    return Object.freeze({
        backendId: RAPPIER2D_BACKEND_ID,
        backendVersion: RAPPIER2D_BACKEND_VERSION,
        contractId: PHYSICS2D_BACKEND_CONTRACT_ID,
        contractVersion: PHYSICS2D_BACKEND_CONTRACT_VERSION,
        createWorld,
        getStatus: () => Object.freeze({backendId: RAPPIER2D_BACKEND_ID, backendVersion: RAPPIER2D_BACKEND_VERSION, worldUnitsPerMeter})
    });
};

module.exports = {
    RAPPIER2D_BACKEND_ID,
    RAPPIER2D_BACKEND_VERSION,
    createRapier2DBackendAdapter
};
