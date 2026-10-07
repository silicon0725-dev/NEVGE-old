'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const assertBrowserMainThreadAttributionContract = () => {
    const profiler = read('src/lib/frame-profiler/frame-time-profiler.js');
    const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
    assert(profiler.includes("'long-animation-frame'"));
    assert(profiler.includes('forcedStyleAndLayoutDuration'));
    assert(profiler.includes('browserMainThread: summarizeLongAnimationFrames()'));
    assert(profiler.includes("COLLIDER_POINTER_LAYOUT: 'collider-pointer-layout'"));
    assert(gizmo.includes('FRAME_PROFILER_CATEGORY.COLLIDER_POINTER_LAYOUT'));
    return {
        browserLongAnimationFrameAttribution: true,
        colliderPointerLayoutReadAttributed: true,
        executionDiagnosticsOnly: true,
        forcedStyleLayoutAttribution: true
    };
};

module.exports = {assertBrowserMainThreadAttributionContract};
