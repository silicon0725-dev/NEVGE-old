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

const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
const gizmoTest = read('test/unit/components/collider2d-gizmo.test.jsx');
const hf7 = read('src/lib/frame-profiler/frame-time-profiler.js');

check('pending pointer sample is execution-only ref state', () => assert(gizmo.includes('pendingPointerMove = React.useRef(null)')));
check('pointer flush frame is execution-only ref state', () => assert(gizmo.includes('pointerMoveFrame = React.useRef(null)')));
check('pointer input is copied instead of retaining SyntheticEvent', () => {
    assert(gizmo.includes('clientX: Number(event.clientX)'));
    assert(gizmo.includes('clientY: Number(event.clientY)'));
    assert(gizmo.includes('pointerId: event.pointerId'));
    assert(!gizmo.includes('pendingPointerMove.current = event'));
});
check('high-frequency motion is animation-frame scheduled', () => assert(gizmo.includes('window.requestAnimationFrame(flushQueuedHandleDrag)')));
check('only one pending frame is admitted', () => assert(gizmo.includes('if (pointerMoveFrame.current !== null) return;')));
check('latest sample replaces earlier samples', () => assert(gizmo.includes('pendingPointerMove.current = {')));
check('animation-frame flush clears pending sample', () => {
    assert(gizmo.includes('const sample = pendingPointerMove.current;'));
    assert(gizmo.includes('pendingPointerMove.current = null;'));
});
check('release flushes final pending sample before commit', () => {
    const finish = gizmo.indexOf('const finishHandleDrag');
    const flush = gizmo.indexOf('applyHandleDragSample(sample);', finish);
    const commit = gizmo.indexOf('commitAuthoringPatch(drag, drag.currentConfig)', finish);
    assert(finish >= 0 && flush > finish && commit > flush);
});
check('pointer cancel clears queued work', () => assert(gizmo.includes('cancelQueuedHandleDrag();')));
check('HF6 transient preview remains the movement authority', () => assert(gizmo.includes('colliderRuntime.patchAuthoringPreview')));
check('persistent command remains release-only', () => {
    const update = gizmo.slice(gizmo.indexOf('const updateHandleDrag'), gizmo.indexOf('const finishHandleDrag'));
    assert(!update.includes('commitAuthoringPatch('));
});
check('raw pointer samples are observable', () => assert(gizmo.includes("frameProfiler.count('colliderPointerSamples', 1)")));
check('preview flushes are observable', () => assert(gizmo.includes("frameProfiler.count('colliderPointerFlushes', 1)")));
check('120-to-1 coalescing is locked by unit test', () => {
    assert(gizmoTest.includes('for (let index = 0; index < 120; index++)'));
    assert(gizmoTest.includes('patchAuthoringPreview).toHaveBeenCalledTimes(1)'));
    assert(gizmoTest.includes('requestAnimationFrame).toHaveBeenCalledTimes(1)'));
});
check('HF7 LoAF attribution remains installed', () => assert(hf7.includes("'long-animation-frame'")));
check('HF8 does not alter collider tessellation constants', () => {
    const runtimeService = read('src/lib/collision-system/collider2d-runtime-service.js');
    assert(runtimeService.includes('const CIRCLE_SEGMENTS = 32;'));
    assert(runtimeService.includes('const CAPSULE_ARC_SEGMENTS = 16;'));
});
check('HF8 does not add project persistence to pointer queue', () => {
    const queueStart = gizmo.indexOf('const updateHandleDrag');
    const queueEnd = gizmo.indexOf('const finishHandleDrag');
    const queue = gizmo.slice(queueStart, queueEnd);
    assert(!queue.includes('setComponentData('));
    assert(!queue.includes('PatchCollider2D'));
});

console.log(`WS-10N8-HF8 Pointer-Move Frame Coalescing Conformance: ${checks.length}/${checks.length} PASS`);
checks.forEach(name => console.log(`PASS ${name}`));
