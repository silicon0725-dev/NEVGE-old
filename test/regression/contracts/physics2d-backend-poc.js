'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {PHYSICS2D_CONTRACT} = require('../../../src/core/physics2d');
const {RIGIDBODY2D_CONTRACT} = require('../../../src/core/rigidbody2d');
const {PHYSICS_MATERIAL2D_CONTRACT} = require('../../../src/core/physics-material2d');
const {
    FUNCTIONAL_NODE_ARCHETYPE_IDS,
    FUNCTIONAL_NODE_IMPLEMENTATION_STATES,
    getFunctionalNodeArchetype
} = require('../../../src/core/functional-node');
const ROOT = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const assertPhysics2DBackendPOCContract = () => {
    assert.strictEqual(PHYSICS2D_CONTRACT.backend.replaceable, true);
    assert.strictEqual(PHYSICS2D_CONTRACT.backend.handlesPersistent, false);
    assert.strictEqual(PHYSICS2D_CONTRACT.backend.selectedBackendIsSemanticIdentity, false);
    assert.strictEqual(PHYSICS2D_CONTRACT.transform.runtimeAuthority, 'Transform2DRuntimeStore');
    assert.strictEqual(PHYSICS2D_CONTRACT.transform.dynamicRuntimeWritesPersistentProject, false);
    assert.strictEqual(RIGIDBODY2D_CONTRACT.identity.rigidBodyIdSource, 'Runtime ComponentId');
    assert.strictEqual(RIGIDBODY2D_CONTRACT.identity.backendHandlePersistent, false);
    assert.strictEqual(PHYSICS_MATERIAL2D_CONTRACT.identity.resourceIdAuthority, 'ngvge:resource:*');
    assert.strictEqual(PHYSICS_MATERIAL2D_CONTRACT.massPolicy.densityDeferred, true);
    const rigid = getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.RIGID_BODY_2D);
    assert(rigid);
    assert.strictEqual(rigid.implementation, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED);
    assert(read('src/lib/functional-node/functional-node-creation-service.js').includes('status && status.backendReady'));
    assert(read('src/lib/physics-system/rapier2d-package-loader.js').includes('@dimforge/rapier2d-compat'));
    assert(!read('src/core/physics2d/physics2d-contract.js').includes('@dimforge'));
    assert(read('src/lib/physics-system/physics2d-runtime-service.js').includes('backendHandlePresent'));
    assert(!read('src/lib/physics-system/rapier2d-backend-adapter.js').includes('setAdditionalMass'));
    assert(read('src/lib/physics-system/rapier2d-backend-adapter.js').includes('setMass'));
    return {
        backendReplaceable: true,
        backendHandlesPrivate: true,
        rigidBodyComponentIdentity: true,
        physicsMaterialResourceAuthority: true,
        rigidBodyProductReadinessGated: true
    };
};
module.exports = {assertPhysics2DBackendPOCContract};
