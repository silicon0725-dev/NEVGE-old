'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const assertSelectedColliderPassivePresentationFastPathContract = () => {
    const projection = read('src/lib/transform-system/transform2d-hierarchy-projection.js');
    const runtime = read('src/lib/collision-system/collider2d-runtime-service.js');
    const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
    const profiler = read('src/lib/frame-profiler/frame-time-profiler.js');
    const inspector = read('src/components/project-inspector/project-inspector.jsx');

    assert.match(projection, /const hierarchy = getTransformHierarchy\(nodeId, runtimeNodeModel, transformRuntimeStore\);/);
    assert.match(runtime, /changedNodeIds/);
    assert.match(runtime, /requestRefresh\('transform-hierarchy-change'/);
    assert.match(runtime, /affectedColliderNodeIds/);
    assert.match(gizmo, /passiveSelectedRefreshHandler/);
    assert.match(gizmo, /selectedAffected|selectedOnlyAffected/);
    assert.match(gizmo, /legacySelectedOnly/);
    assert.match(gizmo, /applyFastAuthoringPresentation\(group, gizmo, toStagePoint, nodeToWorld, transformPreview\)/);
    assert.match(gizmo, /colliderSelectedDirectDom/);
    assert.match(profiler, /COLLIDER_SELECTED_PRESENTATION/);
    assert.match(inspector, /PASSIVE_RUNTIME_INSPECTOR_REFRESH_MS = 83/);
    assert.match(inspector, /change && change\.type === 'physics:step'/);
    assert.match(inspector, /isPassiveColliderGeometryRefreshEvent/);

    return {
        contract: 'selected-collider-passive-presentation-fast-path',
        batchHierarchyProjection: true,
        changedNodeAttribution: true,
        passiveSelectedDOM: true,
        sampledInspectorTelemetry: true
    };
};

module.exports = {assertSelectedColliderPassivePresentationFastPathContract};
