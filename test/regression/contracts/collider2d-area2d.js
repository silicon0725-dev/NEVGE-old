'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    COLLIDER2D_CONTRACT,
    COLLIDER2D_SHAPE_TYPES,
    isConvexPolygon,
    normalizeCollider2D
} = require('../../../src/core/collider2d');
const {
    FUNCTIONAL_COMPONENT_TYPE_IDS,
    FUNCTIONAL_NODE_ARCHETYPE_IDS,
    FUNCTIONAL_NODE_IMPLEMENTATION_STATES,
    getFunctionalNodeArchetype
} = require('../../../src/core/functional-node');

const read = relative => fs.readFileSync(path.resolve(__dirname, '../../..', relative), 'utf8');

const assertCollider2DArea2DContract = () => {
    assert.strictEqual(COLLIDER2D_CONTRACT.typeId, 'ngvge.collider2d');
    assert.strictEqual(COLLIDER2D_CONTRACT.persistence.nativeProject, '.ne');
    assert.strictEqual(COLLIDER2D_CONTRACT.persistence.scratchProjection, 'native-only');
    assert.strictEqual(COLLIDER2D_CONTRACT.identity.backendHandlePersistent, false);
    assert.strictEqual(COLLIDER2D_CONTRACT.querySemantics.rigidBodyRequired, false);
    assert.deepStrictEqual(new Set(Object.values(COLLIDER2D_SHAPE_TYPES)), new Set([
        'rectangle', 'circle', 'capsule', 'convex-polygon'
    ]));
    assert.deepStrictEqual(normalizeCollider2D().shape, {size: [100, 100], type: 'rectangle'});
    assert.strictEqual(isConvexPolygon([[0, 0], [10, 0], [10, 10], [0, 10]]), true);
    assert.strictEqual(isConvexPolygon([[0, 0], [10, 0], [5, 2], [10, 10], [0, 10]]), false);

    const area = getFunctionalNodeArchetype(FUNCTIONAL_NODE_ARCHETYPE_IDS.AREA_2D);
    assert(area);
    assert.strictEqual(area.implementation, FUNCTIONAL_NODE_IMPLEMENTATION_STATES.IMPLEMENTED);
    assert.deepStrictEqual(area.components.map(component => component.typeId), [
        FUNCTIONAL_COMPONENT_TYPE_IDS.TRANSFORM_2D,
        FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D
    ]);
    assert.strictEqual(area.defaults[FUNCTIONAL_COMPONENT_TYPE_IDS.COLLIDER_2D].sensor, true);

    const runtimeSource = read('src/lib/collision-system/collider2d-runtime-service.js');
    const blocksSource = read('src/lib/collision-system/collider2d-scratch-blocks.js');
    assert.match(runtimeSource, /queryPoint/);
    assert.match(runtimeSource, /queryShape/);
    assert.match(runtimeSource, /raycast/);
    assert.match(runtimeSource, /projectPointsThroughHierarchy/);
    assert.match(runtimeSource, /worldOrigin/);
    assert.match(runtimeSource, /type:\s*'area:enter'/);
    assert.match(runtimeSource, /type:\s*'area:exit'/);
    assert.doesNotMatch(runtimeSource, /Rapier|Box2D|physicsHandle|rigidBodyHandle/);
    assert.doesNotMatch(blocksSource, /setComponentData|patchPersistentCollider|PatchCollider2D/);

    return {
        area2DNativeSensorPreset: true,
        backendIdentityExcluded: true,
        collisionSeparatedFromRigidBodyPhysics: true,
        convexPolygonValidated: true,
        nativeScratchTouchingUnmodified: true,
        queryAndAreaTransitionsPresent: true
    };
};

module.exports = {assertCollider2DArea2DContract};
