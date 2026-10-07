'use strict';

const PHYSICS_MATERIAL2D_RESOURCE_TYPE_ID = 'ngvge.physics-material2d-resource';
const PHYSICS_MATERIAL2D_SCHEMA_VERSION = 1;
const PHYSICS_MATERIAL2D_DEFAULT_DATA = Object.freeze({friction: 0.5, restitution: 0});
const PHYSICS_MATERIAL2D_CONTRACT = Object.freeze({
    contractId: 'ngvge.physics-material2d-resource-contract',
    contractVersion: '1',
    identity: Object.freeze({backendMaterialHandlePersistent: false, resourceIdAuthority: 'ngvge:resource:*'}),
    massPolicy: Object.freeze({densityDeferred: true, rigidBodyMassAuthority: 'ngvge.rigidbody2d.mass'}),
    persistence: Object.freeze({nativeProject: '.ne', scratchProjection: 'native-only'}),
    resourceTypeId: PHYSICS_MATERIAL2D_RESOURCE_TYPE_ID,
    schemaVersion: PHYSICS_MATERIAL2D_SCHEMA_VERSION
});
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const normalizePhysicsMaterial2D = value => {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return {
        friction: clamp(Math.max(0, finite(source.friction, 0.5)), 0, 10),
        restitution: clamp(finite(source.restitution, 0), 0, 1)
    };
};
const applyPhysicsMaterial2DPatch = (current, patch) => {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('PhysicsMaterial2D patch must be portable.');
    const unsupported = Object.keys(patch).filter(key => !['friction', 'restitution'].includes(key));
    if (unsupported.length) throw Object.assign(new TypeError(`Unsupported PhysicsMaterial2D field(s): ${unsupported.join(', ')}`), {
        code: 'NGVGE_PHYSICS_MATERIAL2D_PATCH_FIELD_UNSUPPORTED'
    });
    return normalizePhysicsMaterial2D(Object.assign({}, normalizePhysicsMaterial2D(current), patch));
};
module.exports = {
    PHYSICS_MATERIAL2D_CONTRACT,
    PHYSICS_MATERIAL2D_DEFAULT_DATA,
    PHYSICS_MATERIAL2D_RESOURCE_TYPE_ID,
    PHYSICS_MATERIAL2D_SCHEMA_VERSION,
    applyPhysicsMaterial2DPatch,
    normalizePhysicsMaterial2D
};
