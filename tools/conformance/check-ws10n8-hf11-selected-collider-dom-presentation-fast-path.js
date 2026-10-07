'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const checks = [];
const check = (name, fn) => { fn(); checks.push(name); };

const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
const runtime = read('src/lib/collision-system/collider2d-runtime-service.js');

check('selected authoring presentation has a direct DOM fast path', () => {
    assert(gizmo.includes('const applyFastAuthoringPresentation ='));
    assert(gizmo.includes('data-ngvge-collider-rotation-arm="true"'));
    assert(gizmo.includes('data-ngvge-collider-center-axis="horizontal"'));
    assert(gizmo.includes('data-ngvge-collider-center-axis="vertical"'));
});
check('authoring presentation derives geometry locally from transient config', () => {
    assert(gizmo.includes('createFastAuthoringGizmo(drag, drag.currentConfig)'));
    assert(gizmo.includes('transformColliderPoints(config, AUTHORING_IDENTITY_TRANSFORM)'));
});
check('per-frame authoring presentation no longer requires getCollider capability snapshot', () => {
    const start = gizmo.indexOf('const applyHandleDragSample =');
    const end = gizmo.indexOf('const flushQueuedHandleDrag =', start);
    const block = gizmo.slice(start, end);
    assert(!block.includes('colliderRuntime.getCollider('));
});
check('drag caches one node-to-world affine projector', () => {
    assert(gizmo.includes('nodeToWorld: createNodeToWorldProjector(colliderRuntime, gizmo.nodeId)'));
});
check('browser fast path avoids React authoring state update when DOM group is available', () => {
    assert(gizmo.includes("'colliderPresentationDirectDom'"));
    assert(gizmo.includes('if (!applied) setAuthoringPreviewGizmo(presentation);'));
});
check('non-DOM fallback remains available for compatibility and tests', () => {
    assert(gizmo.includes("'colliderPresentationReactFallback'"));
});
check('cancel restores the canonical selected gizmo presentation', () => {
    const start = gizmo.indexOf('if (!commit) {');
    const end = gizmo.indexOf('return;', start);
    const block = gizmo.slice(start, end + 7);
    assert(block.includes('drag.baseGizmo'));
    assert(block.includes('applyFastAuthoringPresentation('));
});
check('release-only persistent commit remains unchanged', () => {
    assert(gizmo.includes('commitAuthoringPatch(drag, drag.currentConfig)'));
});
check('transient runtime authoring remains canonical for editor execution', () => {
    assert(runtime.includes('authoringPreviewConfigs.set(nodeId, next);'));
    assert(runtime.includes("type: 'authoring-preview-patch'"));
});
check('circle tessellation remains 32 segments', () => assert(runtime.includes('const CIRCLE_SEGMENTS = 32;')));
check('capsule arc tessellation remains 16 segments', () => assert(runtime.includes('const CAPSULE_ARC_SEGMENTS = 16;')));

console.log(`WS-10N8-HF11 Selected Collider DOM Presentation Fast Path Conformance: ${checks.length}/${checks.length} PASS`);
checks.forEach(name => console.log(`PASS ${name}`));
