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

const profiler = read('src/lib/frame-profiler/frame-time-profiler.js');
const toolbar = read('src/components/stage/frame-time-profiler-toolbar.jsx');
const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
const profilerTest = read('test/unit/lib/frame-profiler/frame-time-profiler.test.js');

check('Long Animation Frame observer exists', () => assert(profiler.includes("'long-animation-frame'")));
check('LoAF observer is capture scoped', () => {
    assert(profiler.includes('installLongAnimationFrameObserver();'));
    assert(profiler.includes('uninstallLongAnimationFrameObserver();'));
});
check('LoAF support degrades safely', () => assert(profiler.includes('longAnimationFrameSupported = false')));
check('LoAF memory is bounded', () => assert(profiler.includes('MAX_LONG_ANIMATION_FRAMES')));
check('LoAF scripts are bounded', () => assert(profiler.includes('MAX_LONG_ANIMATION_FRAME_SCRIPTS')));
check('forced style/layout attribution is captured', () => assert(profiler.includes('forcedStyleAndLayoutDuration')));
check('script source URL attribution is captured', () => assert(profiler.includes('sourceURL')));
check('script function attribution is captured', () => assert(profiler.includes('sourceFunctionName')));
check('script invoker attribution is captured', () => assert(profiler.includes('invokerType')));
check('browser main-thread summary is exported', () => assert(profiler.includes('browserMainThread: summarizeLongAnimationFrames()')));
check('top script aggregation exists', () => assert(profiler.includes('topScripts')));
check('top LoAF frames are exported', () => assert(profiler.includes('topFrames')));
check('Collider pointer layout category exists', () => assert(profiler.includes("COLLIDER_POINTER_LAYOUT: 'collider-pointer-layout'")));
check('getBoundingClientRect is measured', () => {
    assert(gizmo.includes('FRAME_PROFILER_CATEGORY.COLLIDER_POINTER_LAYOUT'));
    assert(gizmo.includes('svg.getBoundingClientRect()'));
});
check('HF7 remains diagnostic only', () => {
    assert(!profiler.includes('setComponentData('));
    assert(!profiler.includes('PatchCollider2D'));
});
check('toolbar surfaces LoAF state', () => assert(toolbar.includes('data-ngvge-frame-profiler-loaf')));
check('unit test locks forced-layout attribution', () => assert(profilerTest.includes('forcedStyleAndLayoutDuration: 31')));
check('unit test locks pointer-move attribution identity', () => assert(profilerTest.includes("sourceFunctionName: 'updateHandleDrag'")));

console.log(`WS-10N8-HF7 Browser Main-Thread Attribution Conformance: ${checks.length}/${checks.length} PASS`);
checks.forEach(name => console.log(`PASS ${name}`));
