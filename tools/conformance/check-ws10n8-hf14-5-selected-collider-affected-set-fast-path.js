#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const checks = [];
const check = (name, fn) => {
    fn();
    checks.push(name);
    console.log(`PASS ${name}`);
};

const runtime = read('src/lib/collision-system/collider2d-runtime-service.js');
const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
const profiler = read('src/lib/frame-profiler/frame-time-profiler.js');

check('HF14.5 builds a reverse Transform-to-Collider dependency map', () => {
    assert.match(runtime, /nativeTransformAffectedColliderNodeIds = new Map\(\)/);
    assert.match(runtime, /affectedColliderNodeIds\.get\(entry\.nodeId\)\.add\(node\.id\)/);
});
check('HF14.5 emits actual affected Collider node IDs for transform refreshes', () => {
    assert.match(runtime, /getAffectedColliderNodeIdsForTransform/);
    assert.match(runtime, /affectedColliderNodeIds: getAffectedColliderNodeIdsForTransform\(change\.nodeId\)/);
    assert.match(runtime, /affectedColliderNodeIds\.length \? \{affectedColliderNodeIds\} : \{\}/);
});
check('HF14.5 batches affected Collider attribution across physics writeback', () => {
    assert.match(runtime, /pendingAffectedColliderNodeIds/);
    assert.match(runtime, /pendingAffectedColliderNodeIds\.add/);
    assert.match(runtime, /Array\.from\(pendingAffectedColliderNodeIds\)/);
});
check('HF14.5 selected fast path keys off affected Collider set', () => {
    assert.match(gizmo, /const selectedAffected = affectedColliderNodeIds\.includes\(nodeId\)/);
    assert.match(gizmo, /affectedColliderNodeIds\.includes\(nodeId\)/);
    assert.match(gizmo, /colliderSelectedFastPathEligible/);
});
check('HF14.5 retains conservative fallback for unknown changes while later generations may split mixed affected sets', () => {
    assert.match(gizmo, /colliderSelectedAffectedSetMiss/);
    assert.match(gizmo, /return false/);
    assert.match(gizmo, /legacySelectedOnly/);
});
check('HF14.5 retains direct DOM selected presentation and React fallback', () => {
    assert.match(gizmo, /colliderSelectedDirectDom/);
    assert.match(gizmo, /colliderSelectedReactFallback/);
    assert.match(gizmo, /setColliderRevision/);
});
check('HF14.5 diagnostics version is explicit', () => {
    assert.match(profiler, /WS-10N8-HF14\.(?:[56789]|10)/);
});
check('HF14.5 keeps shape tessellation fallback precision', () => {
    assert.match(runtime, /CIRCLE_SEGMENTS = 32/);
    assert.match(runtime, /CAPSULE_ARC_SEGMENTS = 16/);
});

console.log(`HF14.5 conformance ${checks.length}/${checks.length} PASS`);
