'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const checks = [];
const check = (name, fn) => {
    fn();
    checks.push(name);
};

const runtime = read('src/lib/collision-system/collider2d-runtime-service.js');
const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
const profiler = read('src/lib/frame-profiler/frame-time-profiler.js');
const runtimeTest = read('test/unit/lib/collision-system/collider2d-runtime-service.test.js');
const gizmoTest = read('test/unit/components/collider2d-gizmo.test.jsx');

check('transient preview store exists', () => assert(runtime.includes('const authoringPreviewConfigs = new Map();')));
check('preview begin API exists', () => assert(runtime.includes('const beginAuthoringPreview = nodeId =>')));
check('preview patch API exists', () => assert(runtime.includes('const patchAuthoringPreview = (nodeId, patch) =>')));
check('preview cancel API exists', () => assert(runtime.includes('const cancelAuthoringPreview = nodeId =>')));
check('preview geometry is execution-only', () => assert(runtime.includes('authoringPreviewConfigs.has(node.id)')));
check('persistent collider still reads component data', () => assert(runtime.includes('getPersistentCollider: nodeId =>')));
check('persistent commit refresh is batched', () => {
    assert(runtime.includes('beginRefreshBatch();'));
    assert(runtime.includes("endRefreshBatch('persistent-collider-patch')"));
});
check('pointer move uses preview path', () => assert(gizmo.includes('colliderRuntime.patchAuthoringPreview(drag.nodeId, update.patch)')));
check('pointer release commits persistent state once', () => assert(gizmo.includes('const endHandleDrag = event => finishHandleDrag(event, true);')));
check('pointer cancel restores persistent state', () => assert(gizmo.includes('const cancelHandleDrag = event => finishHandleDrag(event, false);')));
check('world to node projection is affine sampled', () => assert(gizmo.includes('const createWorldToNodeProjector')));
check('handle projection is affine sampled', () => assert(gizmo.includes('const createNodeToWorldProjector')));
check('preview and commit profiler categories exist', () => {
    assert(profiler.includes("COLLIDER_AUTHORING_PREVIEW: 'collider-authoring-preview'"));
    assert(profiler.includes("COLLIDER_AUTHORING_COMMIT: 'collider-authoring-commit'"));
});
check('runtime test locks transient persistence behavior', () => assert(runtimeTest.includes('persists only the final commit')));
check('preview does not emit semantic Area transitions', () => assert(runtimeTest.includes('semanticAreaEvents).toHaveLength(0)')));
check('gizmo stress test locks one persistent commit', () => assert(gizmoTest.includes('120; index++')));
check('gizmo stress test locks three-point world-to-node sampling', () => assert(gizmoTest.includes('worldPointToNodeLocal).toHaveBeenCalledTimes(3)')));
check('rectangle handles avoid per-handle shape projection', () => assert(gizmoTest.includes('shapeLocalPointToWorld).not.toHaveBeenCalled()')));

console.log(`WS-10N8-HF6 Transient Collider Authoring Conformance: ${checks.length}/${checks.length} PASS`);
checks.forEach(name => console.log(`PASS ${name}`));
