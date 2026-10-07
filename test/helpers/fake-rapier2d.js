'use strict';

const makeDescFactory = kind => () => {
    const state = {kind};
    const desc = {state};
    [
        'setTranslation', 'setRotation', 'setLinvel', 'setAngvel', 'setGravityScale',
        'setLinearDamping', 'setAngularDamping', 'setCcdEnabled', 'setCanSleep', 'setAdditionalMass'
    ].forEach(name => {
        desc[name] = (...args) => {
            state[name] = args;
            return desc;
        };
    });
    desc.lockRotations = () => {
        state.locked = true;
        return desc;
    };
    return desc;
};

const createFakeRapier2D = () => {
    let nextHandle = 10;
    const createdColliderDescs = [];
    class World {
        constructor(gravity) {
            this.gravity = gravity;
            this.integrationParameters = {dt: 1 / 60};
            this.bodies = [];
        }
        createRigidBody(desc) {
            const state = desc.state;
            const position = state.setTranslation || [0, 0];
            const velocity = state.setLinvel || [0, 0];
            const body = {
                gravityScale: (state.setGravityScale || [state.kind === 'dynamic' ? 1 : 0])[0],
                handle: nextHandle++,
                kind: state.kind,
                p: {x: position[0], y: position[1]},
                r: (state.setRotation || [0])[0],
                sleeping: false,
                v: {x: velocity[0], y: velocity[1]},
                w: (state.setAngvel || [0])[0],
                angvel() { return this.w; },
                isSleeping() { return this.sleeping; },
                linvel() { return this.v; },
                rotation() { return this.r; },
                setNextKinematicRotation(value) { this.r = value; },
                setNextKinematicTranslation(value) { this.p = value; },
                setRotation(value) { this.r = value; },
                setTranslation(value) { this.p = value; },
                sleep() { this.sleeping = true; },
                translation() { return this.p; }
            };
            this.bodies.push(body);
            return body;
        }
        createCollider(desc, body) {
            createdColliderDescs.push(desc && desc.state ? Object.assign({}, desc.state) : null);
            return {body, desc, handle: nextHandle++};
        }
        removeRigidBody(body) {
            this.bodies = this.bodies.filter(item => item !== body);
        }
        step() {
            const dt = this.integrationParameters.dt;
            this.bodies.forEach(body => {
                if (body.kind !== 'dynamic' || body.sleeping) return;
                body.v.y += this.gravity.y * body.gravityScale * dt;
                body.p.x += body.v.x * dt;
                body.p.y += body.v.y * dt;
                body.r += body.w * dt;
            });
        }
        free() {}
    }
    const colliderDescriptor = (kind, values) => {
        const state = {kind, values: Array.isArray(values) ? values.slice() : values};
        const desc = {state};
        [
            'setSensor', 'setFriction', 'setRestitution', 'setCollisionGroups', 'setDensity', 'setMass',
            'setRotation'
        ].forEach(name => {
            desc[name] = (...args) => {
                state[name] = args;
                return desc;
            };
        });
        desc.setTranslation = (x, y) => {
            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                throw new TypeError('The translation components must be numbers.');
            }
            state.setTranslation = [x, y];
            return desc;
        };
        return desc;
    };
    const colliderFactory = flat => colliderDescriptor('convex-hull', Array.from(flat));
    return {
        ColliderDesc: {
            ball: radius => colliderDescriptor('ball', [radius]),
            capsule: (halfHeight, radius) => colliderDescriptor('capsule', [halfHeight, radius]),
            convexHull: colliderFactory,
            cuboid: (hx, hy) => colliderDescriptor('cuboid', [hx, hy])
        },
        __createdColliderDescs: createdColliderDescs,
        RigidBodyDesc: {
            dynamic: makeDescFactory('dynamic'),
            fixed: makeDescFactory('fixed'),
            kinematicPositionBased: makeDescFactory('kinematic')
        },
        World
    };
};

module.exports = {createFakeRapier2D};
