'use strict';

const {createEngineCommand} = require('../protocol');

const RIGIDBODY2D_TYPE_ID = 'ngvge.rigidbody2d';
const RIGIDBODY2D_SCHEMA_VERSION = 1;
const RIGIDBODY2D_COMPONENT_OWNER = 'ngvge.scene-system';
const RIGIDBODY2D_PATCH_COMMAND_TYPE = 'PatchRigidBody2D';
const RIGIDBODY2D_PATCH_APPLIED_EVENT_TYPE = 'RigidBody2DPatchApplied';

const RIGIDBODY2D_DEFAULT_DATA = Object.freeze({
    angularDamping: 0,
    angularVelocity: 0,
    ccd: false,
    enabled: true,
    freezeRotation: false,
    friction: 0.5,
    gravityScale: 1,
    linearDamping: 0,
    mass: 1,
    physicsMaterialResourceId: null,
    restitution: 0,
    sleeping: false,
    velocity: Object.freeze([0, 0])
});

const RIGIDBODY2D_CONTRACT = Object.freeze({
    componentOwner: RIGIDBODY2D_COMPONENT_OWNER,
    contractId: 'ngvge.rigidbody2d-contract',
    contractVersion: '1',
    identity: Object.freeze({
        backendHandlePersistent: false,
        nodeIdIsRigidBodyId: false,
        rigidBodyIdSource: 'Runtime ComponentId'
    }),
    persistence: Object.freeze({
        authoredVelocityMeaning: 'initial-runtime-state',
        nativeProject: '.ne',
        runtimeVelocityPersistent: false,
        scratchProjection: 'native-only'
    }),
    runtime: Object.freeze({
        backendAuthority: 'ngvge.physics2d-contract@1 adapter',
        dynamicTransformWrites: 'Transform2DRuntimeStore only',
        fullRigidBodyBackendRequired: true
    }),
    schemaVersion: RIGIDBODY2D_SCHEMA_VERSION,
    typeId: RIGIDBODY2D_TYPE_ID
});

const isPlainObject = value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
};
const finiteNumber = (value, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const normalizeVec2 = (value, fallback) => {
    const source = Array.isArray(value) && value.length === 2 ? value : fallback;
    return [finiteNumber(source[0], fallback[0]), finiteNumber(source[1], fallback[1])];
};
const normalizeResourceId = value => (
    typeof value === 'string' && value.startsWith('ngvge:resource:') ? value : null
);

const normalizeRigidBody2D = value => {
    const source = isPlainObject(value) ? value : {};
    return {
        angularDamping: clamp(Math.max(0, finiteNumber(source.angularDamping, RIGIDBODY2D_DEFAULT_DATA.angularDamping)), 0, 1000),
        angularVelocity: finiteNumber(source.angularVelocity, RIGIDBODY2D_DEFAULT_DATA.angularVelocity),
        ccd: typeof source.ccd === 'boolean' ? source.ccd : RIGIDBODY2D_DEFAULT_DATA.ccd,
        enabled: typeof source.enabled === 'boolean' ? source.enabled : RIGIDBODY2D_DEFAULT_DATA.enabled,
        freezeRotation: typeof source.freezeRotation === 'boolean' ? source.freezeRotation : RIGIDBODY2D_DEFAULT_DATA.freezeRotation,
        friction: clamp(Math.max(0, finiteNumber(source.friction, RIGIDBODY2D_DEFAULT_DATA.friction)), 0, 10),
        gravityScale: clamp(finiteNumber(source.gravityScale, RIGIDBODY2D_DEFAULT_DATA.gravityScale), -100, 100),
        linearDamping: clamp(Math.max(0, finiteNumber(source.linearDamping, RIGIDBODY2D_DEFAULT_DATA.linearDamping)), 0, 1000),
        mass: clamp(Math.max(0.000001, finiteNumber(source.mass, RIGIDBODY2D_DEFAULT_DATA.mass)), 0.000001, 1e12),
        physicsMaterialResourceId: normalizeResourceId(source.physicsMaterialResourceId),
        restitution: clamp(finiteNumber(source.restitution, RIGIDBODY2D_DEFAULT_DATA.restitution), 0, 1),
        sleeping: typeof source.sleeping === 'boolean' ? source.sleeping : RIGIDBODY2D_DEFAULT_DATA.sleeping,
        velocity: normalizeVec2(source.velocity, RIGIDBODY2D_DEFAULT_DATA.velocity)
    };
};

const RIGIDBODY2D_PATCH_FIELDS = new Set(Object.keys(RIGIDBODY2D_DEFAULT_DATA));

const normalizeRigidBody2DPatch = value => {
    if (!isPlainObject(value)) throw Object.assign(new TypeError('RigidBody2D patch must be a plain portable object.'), {
        code: 'NGVGE_RIGIDBODY2D_PATCH_INVALID'
    });
    const unsupported = Object.keys(value).filter(key => !RIGIDBODY2D_PATCH_FIELDS.has(key));
    if (unsupported.length) throw Object.assign(new TypeError(`RigidBody2D patch contains unsupported field(s): ${unsupported.join(', ')}`), {
        code: 'NGVGE_RIGIDBODY2D_PATCH_FIELD_UNSUPPORTED', fields: unsupported
    });
    if (!Object.keys(value).length) throw Object.assign(new TypeError('RigidBody2D patch must change at least one field.'), {
        code: 'NGVGE_RIGIDBODY2D_PATCH_EMPTY'
    });
    const normalized = normalizeRigidBody2D(Object.assign({}, RIGIDBODY2D_DEFAULT_DATA, value));
    const result = {};
    Object.keys(value).forEach(key => { result[key] = normalized[key]; });
    return result;
};

const applyRigidBody2DPatch = (current, patch) => normalizeRigidBody2D(Object.assign(
    {}, normalizeRigidBody2D(current), normalizeRigidBody2DPatch(patch)
));

const createRigidBody2DPatchComponentCommand = ({componentId, nodeId, patch}) => createEngineCommand(
    RIGIDBODY2D_PATCH_COMMAND_TYPE,
    {componentId, nodeId, patch: normalizeRigidBody2DPatch(patch)}
);

module.exports = {
    RIGIDBODY2D_COMPONENT_OWNER,
    RIGIDBODY2D_CONTRACT,
    RIGIDBODY2D_DEFAULT_DATA,
    RIGIDBODY2D_PATCH_APPLIED_EVENT_TYPE,
    RIGIDBODY2D_PATCH_COMMAND_TYPE,
    RIGIDBODY2D_SCHEMA_VERSION,
    RIGIDBODY2D_TYPE_ID,
    applyRigidBody2DPatch,
    createRigidBody2DPatchComponentCommand,
    normalizeRigidBody2D,
    normalizeRigidBody2DPatch
};
