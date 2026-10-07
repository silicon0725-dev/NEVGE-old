'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const assertTransientTransformDragPreviewContract = async () => {
    const stage = read('src/containers/stage.jsx');
    const preview = read('src/lib/editor-visualization/editor-transform-preview.js');
    const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
    const inspector = read('src/components/project-inspector/project-inspector.jsx');

    assert.match(preview, /authoredPosition/);
    assert.match(preview, /previewPosition/);
    assert.doesNotMatch(preview, /writeProject|serialize|localStorage/);
    assert.match(stage, /getBindingByTargetRuntimeId/);
    assert.match(stage, /context\.editorClient\.patchComponent/);
    assert.match(stage, /cameraRuntime\.screenToWorld/);
    assert.match(stage, /label:\s*'Move Sprite'/);
    assert.match(stage, /handleDragCancelKeyDown/);
    assert.match(gizmo, /isNodeDescendantOrSelf/);
    assert.match(gizmo, /convexPolygonsOverlap/);
    assert.match(inspector, /Editor Drag Preview/);

    return {
        cameraAware: true,
        colliderSubtreePreview: true,
        oneCommitPerDrag: true,
        scratchRuntimePreviewAuthority: false,
        transientEditorState: true
    };
};

module.exports = {assertTransientTransformDragPreviewContract};
