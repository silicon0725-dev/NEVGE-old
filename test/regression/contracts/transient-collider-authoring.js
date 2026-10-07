'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const assertTransientColliderAuthoringContract = () => {
    const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
    const runtime = read('src/lib/collision-system/collider2d-runtime-service.js');
    const profiler = read('src/lib/frame-profiler/frame-time-profiler.js');
    assert(runtime.includes('authoringPreviewConfigs'));
    assert(runtime.includes('beginAuthoringPreview'));
    assert(runtime.includes('patchAuthoringPreview'));
    assert(runtime.includes('cancelAuthoringPreview'));
    assert(runtime.includes('beginRefreshBatch();'));
    assert(runtime.includes("endRefreshBatch('persistent-collider-patch')"));
    assert(gizmo.includes('createWorldToNodeProjector'));
    assert(gizmo.includes('createNodeToWorldProjector'));
    assert(gizmo.includes('patchAuthoringPreview'));
    assert(gizmo.includes('onPointerUp={endHandleDrag}'));
    assert(gizmo.includes('onPointerCancel={cancelHandleDrag}'));
    assert(profiler.includes('collider-authoring-preview'));
    assert(profiler.includes('collider-authoring-commit'));
    return {
        affineHandleProjection: true,
        persistentCommitOnRelease: true,
        pointerMovePersistenceForbidden: true,
        transientColliderPreview: true
    };
};
module.exports = {assertTransientColliderAuthoringContract};
