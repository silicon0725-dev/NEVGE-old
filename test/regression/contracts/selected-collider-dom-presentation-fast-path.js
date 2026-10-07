'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = relative => fs.readFileSync(path.resolve(__dirname, '../../..', relative), 'utf8');

const assertSelectedColliderDOMPresentationFastPathContract = () => {
    const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
    const runtime = read('src/lib/collision-system/collider2d-runtime-service.js');
    const sampleStart = gizmo.indexOf('const applyHandleDragSample =');
    const sampleEnd = gizmo.indexOf('const flushQueuedHandleDrag =', sampleStart);
    const sampleBlock = gizmo.slice(sampleStart, sampleEnd);

    assert(gizmo.includes('const applyFastAuthoringPresentation ='));
    assert(gizmo.includes('createFastAuthoringGizmo(drag, drag.currentConfig)'));
    assert(gizmo.includes('transformColliderPoints(config, AUTHORING_IDENTITY_TRANSFORM)'));
    assert(!sampleBlock.includes('colliderRuntime.getCollider('));
    assert(gizmo.includes('colliderPresentationDirectDom'));
    assert(gizmo.includes('if (!applied) setAuthoringPreviewGizmo(presentation);'));
    assert(gizmo.includes('commitAuthoringPatch(drag, drag.currentConfig)'));
    assert(runtime.includes('const CIRCLE_SEGMENTS = 32;'));
    assert(runtime.includes('const CAPSULE_ARC_SEGMENTS = 16;'));

    return {
        directDOMPresentation: true,
        perFrameRuntimeSnapshotRemoved: true,
        reactFallbackRetained: true,
        releaseOnlyPersistentCommit: true
    };
};

module.exports = {assertSelectedColliderDOMPresentationFastPathContract};
