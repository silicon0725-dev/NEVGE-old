'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = relative => fs.readFileSync(path.resolve(__dirname, '../../..', relative), 'utf8');

const assertSelectedColliderPreviewFastPathContract = () => {
    const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
    const inspector = read('src/components/project-inspector/project-inspector.jsx');
    const profiler = read('src/lib/frame-profiler/frame-time-profiler.js');

    assert(inspector.includes('if (isTransientColliderAuthoringEvent(change)) return;'));
    assert(gizmo.includes('if (isTransientColliderAuthoringEvent(change)) return;'));
    assert(gizmo.includes('authoringPreviewGizmo && gizmo.nodeId === authoringPreviewGizmo.nodeId'));
    assert(
        gizmo.includes('colliderRuntime.getCollider(drag.nodeId)') ||
        gizmo.includes('createFastAuthoringGizmo(drag, drag.currentConfig)')
    );
    assert(profiler.includes("COLLIDER_AUTHORING_PRESENTATION: 'collider-authoring-presentation'"));
    assert(gizmo.includes('commitAuthoringPatch(drag, drag.currentConfig)'));

    return {
        inspectorPreviewRefreshSuppressed: true,
        fullColliderDebugRefreshSuppressed: true,
        selectedPreviewFastPath: true,
        releaseOnlyPersistentCommit: true
    };
};

module.exports = {assertSelectedColliderPreviewFastPathContract};
