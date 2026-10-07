'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const checks = [];
const check = (name, fn) => { fn(); checks.push(name); };

const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
const inspector = read('src/components/project-inspector/project-inspector.jsx');
const profiler = read('src/lib/frame-profiler/frame-time-profiler.js');
const runtime = read('src/lib/collision-system/collider2d-runtime-service.js');

check('project inspector recognizes transient Collider2D authoring events', () => {
    assert(inspector.includes("change.type === 'authoring-preview-begin'"));
    assert(inspector.includes("change.type === 'authoring-preview-patch'"));
    assert(inspector.includes("change.type === 'authoring-preview-cancel'"));
});
check('project inspector does not refresh for transient Collider2D authoring', () => {
    const start = inspector.indexOf('colliderRuntimeCapability.subscribe(change =>');
    const end = inspector.indexOf('});', start);
    const block = inspector.slice(start, end + 3);
    assert(block.includes('if (isTransientColliderAuthoringEvent(change)) return;'));
});
check('stage gizmo contains a selected-only authoring preview snapshot', () => {
    assert(gizmo.includes('const [authoringPreviewGizmo, setAuthoringPreviewGizmo] = React.useState(null);'));
});
check('stage gizmo excludes transient authoring events from full collider refresh', () => {
    const start = gizmo.indexOf('colliderRuntime.subscribe(change =>');
    const end = gizmo.indexOf('}));', start);
    const block = gizmo.slice(start, end + 4);
    assert(block.includes('if (isTransientColliderAuthoringEvent(change)) return;'));
    assert(block.includes("schedule('collider')"));
});
check('selected gizmo substitutes the local authoring preview snapshot', () => {
    assert(gizmo.includes('authoringPreviewGizmo && gizmo.nodeId === authoringPreviewGizmo.nodeId'));
});
check('authoring presentation reads one selected collider instead of full debug snapshot', () => {
    assert(
        gizmo.includes('colliderRuntime.getCollider(drag.nodeId)') ||
        gizmo.includes('createFastAuthoringGizmo(drag, drag.currentConfig)')
    );
    assert(!gizmo.includes('getDebugViewportSnapshot(drag.nodeId)'));
});
check('authoring presentation has an independent profiler category', () => {
    assert(profiler.includes("COLLIDER_AUTHORING_PRESENTATION: 'collider-authoring-presentation'"));
    assert(profiler.includes("'Collider Authoring Presentation'"));
    assert(gizmo.includes('FRAME_PROFILER_CATEGORY.COLLIDER_AUTHORING_PRESENTATION'));
});
check('transient preview runtime contract remains present', () => {
    assert(runtime.includes('authoringPreviewConfigs.set(nodeId, next);'));
    assert(runtime.includes("type: 'authoring-preview-patch'"));
});
check('persistent release-only command path remains present', () => {
    assert(gizmo.includes('commitAuthoringPatch(drag, drag.currentConfig)'));
});
check('preview state clears on node selection change', () => {
    assert(gizmo.includes('setAuthoringPreviewGizmo(null);'));
});
check('HF10 does not lower circle tessellation', () => assert(runtime.includes('const CIRCLE_SEGMENTS = 32;')));
check('HF10 does not lower capsule tessellation', () => assert(runtime.includes('const CAPSULE_ARC_SEGMENTS = 16;')));

console.log(`WS-10N8-HF10 Selected Collider Preview Fast Path Conformance: ${checks.length}/${checks.length} PASS`);
checks.forEach(name => console.log(`PASS ${name}`));
