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

const projection = read('src/lib/transform-system/transform2d-hierarchy-projection.js');
const colliderRuntime = read('src/lib/collision-system/collider2d-runtime-service.js');
const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
const profiler = read('src/lib/frame-profiler/frame-time-profiler.js');
const inspector = read('src/components/project-inspector/project-inspector.jsx');

check('HF14.4 batch projection resolves hierarchy once', () => {
    assert.match(projection, /const hierarchy = getTransformHierarchy\(nodeId, runtimeNodeModel, transformRuntimeStore\);/);
    assert.match(projection, /return \(Array\.isArray\(points\) \? points : \[\]\)\.map\(point => \{/);
});
check('HF14.4 collision refresh identifies changed Transform nodes', () => {
    assert.match(colliderRuntime, /pendingRefreshNodeIds/);
    assert.match(colliderRuntime, /changedNodeIds/);
    assert.match(colliderRuntime, /requestRefresh\('transform-hierarchy-change'/);
    assert.match(colliderRuntime, /affectedColliderNodeIds/);
});
check('HF14.4 passive selected refresh bypasses full collider revision when safe', () => {
    assert.match(gizmo, /passiveSelectedRefreshHandler/);
    assert.match(gizmo, /change\.type !== 'collision:refresh'/);
    assert.match(gizmo, /selectedAffected|selectedOnlyAffected/);
    assert.match(gizmo, /legacySelectedOnly/);
    assert.match(gizmo, /getShowOverlapState/);
});
check('HF14.4 passive selected presentation uses direct DOM path', () => {
    assert.match(gizmo, /selectedNodeGroupRef/);
    assert.match(gizmo, /applyFastAuthoringPresentation\(group, gizmo, toStagePoint, nodeToWorld, transformPreview\)/);
    assert.match(gizmo, /colliderSelectedDirectDom/);
    assert.match(gizmo, /colliderSelectedReactFallback/);
});
check('HF14.4 passive selected refresh is frame-coalesced', () => {
    assert.match(gizmo, /passiveSelectedFrame/);
    assert.match(gizmo, /colliderSelectedPassiveCoalesced/);
    assert.match(gizmo, /requestPresentationFrame/);
});
check('HF14.4 selected presentation has independent profiler category', () => {
    assert.match(profiler, /COLLIDER_SELECTED_PRESENTATION: 'collider-selected-presentation'/);
    assert.match(profiler, /Collider Selected Presentation/);
    assert.match(profiler, /WS-10N8-HF14\.(?:[456789]|10)/);
});
check('HF14.4 Project Inspector samples high-frequency runtime transforms', () => {
    assert.match(inspector, /PASSIVE_RUNTIME_INSPECTOR_REFRESH_MS = 83/);
    assert.match(inspector, /change && change\.type === 'runtime:patch'/);
    assert.match(inspector, /PASSIVE_RUNTIME_INSPECTOR_REFRESH_MS - elapsed/);
});
check('HF14.4 Project Inspector contains duplicate physics and collider refresh fanout', () => {
    assert.match(inspector, /change && change\.type === 'physics:step'/);
    assert.match(inspector, /isPassiveColliderGeometryRefreshEvent/);
    assert.match(inspector, /change\.type === 'collision:refresh'/);
});
check('HF14.4 keeps HF11 transient authoring DOM fast path', () => {
    assert.match(gizmo, /isTransientColliderAuthoringEvent/);
    assert.match(gizmo, /colliderPresentationDirectDom/);
});
check('HF14.4 keeps shape tessellation fallback precision', () => {
    const collision = read('src/lib/collision-system/collider2d-runtime-service.js');
    assert.match(collision, /CIRCLE_SEGMENTS = 32/);
    assert.match(collision, /CAPSULE_ARC_SEGMENTS = 16/);
});

console.log(`HF14.4 conformance ${checks.length}/${checks.length} PASS`);
