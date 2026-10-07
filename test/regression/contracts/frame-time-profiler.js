'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const assertFrameTimeProfilerContract = () => {
    const profiler = read('src/lib/frame-profiler/frame-time-profiler.js');
    const stage = read('src/components/stage/stage.jsx');
    const physics = read('src/lib/physics-system/physics2d-runtime-service.js');
    const collider = read('src/components/stage/collider2d-gizmo.jsx');
    const tileRenderer = read('src/components/stage/tilemap2d-renderer.jsx');
    assert(profiler.includes('let enabled = false'));
    assert(profiler.includes('restoreRenderer'));
    assert(profiler.includes("removeListener('BEFORE_EXECUTE'"));
    assert(stage.includes('React.Profiler'));
    assert(physics.includes('FRAME_PROFILER_CATEGORY.PHYSICS'));
    assert(collider.includes('FRAME_PROFILER_CATEGORY.COLLIDER_PREPARE'));
    assert(tileRenderer.includes('FRAME_PROFILER_CATEGORY.TILEMAP_RENDER'));
    return {
        browserCaptureRequired: true,
        disabledByDefault: true,
        executionDiagnosticsOnly: true,
        temporaryScratchProbes: true
    };
};
module.exports = {assertFrameTimeProfilerContract};
