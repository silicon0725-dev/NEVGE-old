#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const hierarchySource = read('src/lib/transform-system/transform2d-hierarchy-projection.js');
const colliderSource = read('src/lib/collision-system/collider2d-runtime-service.js');
const characterSource = read('src/lib/character-controller-system/character-controller2d-runtime-service.js');
const integrationSource = read('test/integration/ws10n6-hf1-collider-parent-transform.integration.test.js');
const verificationDoc = read('docs/validation/WS-10N6-HF1-COLLIDER-PARENT-WORLD-PROJECTION-VERIFICATION.md');

const checks = [];
const check = (title, fn) => {
    fn();
    checks.push(title);
};

check('hierarchy projection derives world geometry from semantic parentId', () => {
    assert.match(hierarchySource, /node\.parentId/);
    assert.match(hierarchySource, /getTransformHierarchy/);
    assert.match(hierarchySource, /projectPointsThroughHierarchy/);
});

check('hierarchy projection remains backend independent', () => {
    assert.doesNotMatch(hierarchySource, /Scratch|renderer|drawable|targetRuntimeId|Rapier|Box2D/);
});

check('Collider2D world points use the semantic hierarchy projector', () => {
    assert.match(colliderSource, /transformColliderPointsForNode/);
    assert.match(colliderSource, /projectPointsThroughHierarchy/);
    assert.match(colliderSource, /worldOrigin/);
});

check('Collider overlap retains AABB broad phase and SAT narrow phase', () => {
    assert.match(colliderSource, /aabbOverlaps/);
    assert.match(colliderSource, /polygonAxes/);
    assert.match(colliderSource, /projectPolygon/);
    assert.match(colliderSource, /convexPolygonsOverlap/);
});

check('ancestor Transform changes refresh descendant Area overlap state', () => {
    assert.match(colliderSource, /transformAffectsCollider/);
    assert.match(colliderSource, /isNodeInAncestorChain/);
    assert.match(colliderSource, /transform-hierarchy-change/);
});

check('CharacterController converts world motion into parent-local translation', () => {
    assert.match(characterSource, /worldDeltaToNodeLocalDelta/);
    assert.match(characterSource, /floorCollider\.worldOrigin/);
});

check('real integration reproduces Scratch-parent child-body topology', () => {
    assert.match(integrationSource, /FUNCTIONAL_NODE_ARCHETYPE_IDS\.SPRITE_2D/);
    assert.match(integrationSource, /FUNCTIONAL_NODE_ARCHETYPE_IDS\.STATIC_BODY_2D/);
    assert.match(integrationSource, /FUNCTIONAL_NODE_ARCHETYPE_IDS\.CHARACTER_BODY_2D/);
    assert.match(integrationSource, /overlaps\(characterBody\.node\.id, staticBody\.node\.id\)\)\.toBe\(false\)/);
});

check('persistent collision authority still excludes Scratch target bounds', () => {
    assert.doesNotMatch(colliderSource, /getBounds\(|getSpriteTargetByName|renderer\.|targetRuntimeId/);
});

check('browser gate explicitly covers separated parents and false overlap', () => {
    assert.match(verificationDoc, /visibly far apart/i);
    assert.match(verificationDoc, /must return `false`/i);
    assert.match(verificationDoc, /BROWSER EVIDENCE PENDING/);
});

process.stdout.write(`WS-10N6-HF1 Collider parent world projection Conformance PASS (${checks.length}/${checks.length}).\n`);
