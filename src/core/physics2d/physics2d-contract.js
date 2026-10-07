'use strict';

const PHYSICS2D_CONTRACT_ID = 'ngvge.physics2d-contract';
const PHYSICS2D_CONTRACT_VERSION = 1;
const PHYSICS2D_BACKEND_CONTRACT_ID = 'ngvge.physics2d-backend-adapter';
const PHYSICS2D_BACKEND_CONTRACT_VERSION = 1;

const PHYSICS2D_BODY_KINDS = Object.freeze({
    DYNAMIC: 'dynamic',
    FIXED: 'fixed',
    KINEMATIC: 'kinematic-position',
    SENSOR: 'sensor-fixed'
});

const PHYSICS2D_DEFAULT_SETTINGS = Object.freeze({
    fixedDeltaSeconds: 1 / 60,
    gravity: Object.freeze([0, -980]),
    maxCatchUpSteps: 8,
    maxFrameDeltaSeconds: 0.25
});

const PHYSICS2D_CONTRACT = Object.freeze({
    contractId: PHYSICS2D_CONTRACT_ID,
    contractVersion: String(PHYSICS2D_CONTRACT_VERSION),
    backend: Object.freeze({
        contractId: PHYSICS2D_BACKEND_CONTRACT_ID,
        contractVersion: String(PHYSICS2D_BACKEND_CONTRACT_VERSION),
        handlesPersistent: false,
        replaceable: true,
        selectedBackendIsSemanticIdentity: false
    }),
    identity: Object.freeze({
        backendColliderHandlePersistent: false,
        backendRigidBodyHandlePersistent: false,
        colliderIdentity: 'Collider2D Runtime ComponentId / runtime projection id',
        nodeIdentity: 'NodeId',
        rigidBodyIdentity: 'RigidBody2D Runtime ComponentId'
    }),
    scheduling: Object.freeze({
        defaultFixedDeltaSeconds: PHYSICS2D_DEFAULT_SETTINGS.fixedDeltaSeconds,
        editorFrameRateIsPhysicsAuthority: false,
        maxCatchUpSteps: PHYSICS2D_DEFAULT_SETTINGS.maxCatchUpSteps
    }),
    transform: Object.freeze({
        dynamicRuntimeWritesPersistentProject: false,
        runtimeAuthority: 'Transform2DRuntimeStore',
        stopRestoresAuthoredTransform: true
    })
});

const finiteNumber = (value, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};

const normalizePhysics2DSettings = value => {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const gravity = Array.isArray(source.gravity) && source.gravity.length === 2 ? source.gravity : PHYSICS2D_DEFAULT_SETTINGS.gravity;
    return {
        fixedDeltaSeconds: Math.max(1 / 1000, Math.min(1, finiteNumber(
            source.fixedDeltaSeconds,
            PHYSICS2D_DEFAULT_SETTINGS.fixedDeltaSeconds
        ))),
        gravity: [finiteNumber(gravity[0], 0), finiteNumber(gravity[1], -980)],
        maxCatchUpSteps: Math.max(1, Math.min(64, Math.trunc(finiteNumber(
            source.maxCatchUpSteps,
            PHYSICS2D_DEFAULT_SETTINGS.maxCatchUpSteps
        )))),
        maxFrameDeltaSeconds: Math.max(0.001, Math.min(2, finiteNumber(
            source.maxFrameDeltaSeconds,
            PHYSICS2D_DEFAULT_SETTINGS.maxFrameDeltaSeconds
        )))
    };
};

const assertPhysics2DBackendAdapter = adapter => {
    if (!adapter || typeof adapter !== 'object') throw new TypeError('Physics2D backend adapter is required.');
    const required = ['backendId', 'createWorld'];
    required.forEach(field => {
        if ((field === 'backendId' && (typeof adapter[field] !== 'string' || !adapter[field].trim())) ||
            (field === 'createWorld' && typeof adapter[field] !== 'function')) {
            throw new TypeError(`Physics2D backend adapter is missing ${field}.`);
        }
    });
    if (adapter.contractId !== PHYSICS2D_BACKEND_CONTRACT_ID ||
        Number(adapter.contractVersion) !== PHYSICS2D_BACKEND_CONTRACT_VERSION) {
        const error = new Error('Physics2D backend adapter contract mismatch.');
        error.code = 'NGVGE_PHYSICS2D_BACKEND_CONTRACT_MISMATCH';
        throw error;
    }
    return adapter;
};

module.exports = {
    PHYSICS2D_BACKEND_CONTRACT_ID,
    PHYSICS2D_BACKEND_CONTRACT_VERSION,
    PHYSICS2D_BODY_KINDS,
    PHYSICS2D_CONTRACT,
    PHYSICS2D_CONTRACT_ID,
    PHYSICS2D_CONTRACT_VERSION,
    PHYSICS2D_DEFAULT_SETTINGS,
    assertPhysics2DBackendAdapter,
    normalizePhysics2DSettings
};
