'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const assertCollider2DAuthoringCompletenessContract = async () => {
    const inspector = read('src/components/project-inspector/project-inspector.jsx');
    const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
    const authoring = read('src/lib/editor-visualization/collider-shape-authoring.js');
    const runtime = read('src/lib/collision-system/collider2d-runtime-service.js');
    const projection = read('src/lib/transform-system/transform2d-hierarchy-projection.js');

    assert.match(inspector, /Rectangle Size/);
    assert.match(inspector, /Circle Size/);
    assert.match(inspector, /Capsule Size/);
    assert.match(inspector, /Polygon Vertices/);
    assert.match(gizmo, /createCollider2DEditorClient/);
    assert.match(gizmo, /onPointerDown/);
    assert.match(gizmo, /screenToWorld/);
    assert.match(authoring, /convertColliderShapePreservingBounds/);
    assert.match(runtime, /worldPointToShapeLocal/);
    assert.match(projection, /unprojectPointThroughHierarchy/);

    return {
        authority: 'Collider2D command path',
        directStageAuthoring: true,
        inspectorShapeSizing: true,
        transformAware: true
    };
};

module.exports = {assertCollider2DAuthoringCompletenessContract};
