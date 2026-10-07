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

const toolbar = read('src/components/stage/collider2d-debug-toolbar.jsx');
const runtimeService = read('src/lib/collision-system/collider2d-runtime-service.js');
const toolbarTest = read('test/unit/components/collider2d-debug-toolbar.test.jsx');
const runtimeTest = read('test/unit/lib/collision-system/collider2d-runtime-service.test.js');

check('debug toolbar ignores transient preview begin', () => assert(toolbar.includes("change.type === 'authoring-preview-begin'")));
check('debug toolbar ignores transient preview patch', () => assert(toolbar.includes("change.type === 'authoring-preview-patch'")));
check('debug toolbar ignores transient preview cancel', () => assert(toolbar.includes("change.type === 'authoring-preview-cancel'")));
check('toolbar still admits persistent collider refresh', () => assert(toolbarTest.includes("emitColliderChange({type: 'persistent-collider-patch'})")));
check('toolbar transient notification containment is unit locked', () => {
    assert(toolbarTest.includes('does not rerender status for transient authoring preview notifications'));
    assert(toolbarTest.includes('getStatus).toHaveBeenCalledTimes(1)'));
});
check('runtime status no longer materializes listColliders', () => {
    const statusStart = runtimeService.indexOf('const getColliderStatus');
    const statusEnd = runtimeService.indexOf('const getCollider =', statusStart);
    const statusBlock = runtimeService.slice(statusStart, statusEnd);
    assert(statusStart >= 0 && !statusBlock.includes('listColliders('));
});
check('external provider count fast path is supported', () => assert(runtimeService.includes("typeof provider.getColliderCount === 'function'")));
check('known non-sensor providers skip external geometry listing', () => assert(runtimeService.includes('if (countKnown && !needsSensorInspection) return;')));
check('lightweight external status path is unit locked', () => {
    assert(runtimeTest.includes('uses lightweight external collider counts for status without enumerating stable non-sensor projections'));
    assert(runtimeTest.includes('expect(listColliders).not.toHaveBeenCalled()'));
});
check('authoring preview caches component identity at begin', () => {
    assert(runtimeService.includes('const authoringPreviewComponentIds = new Map();'));
    assert(runtimeService.includes('authoringPreviewComponentIds.set(nodeId, component.id);'));
});
check('preview patch consumes cached component identity', () => assert(runtimeService.includes('let componentId = authoringPreviewComponentIds.get(nodeId);')));
check('preview patch consumes cached transient base', () => assert(runtimeService.includes('let base = authoringPreviewConfigs.get(nodeId);')));
check('repeated Runtime Node snapshot elimination is unit locked', () => {
    assert(runtimeTest.includes('keeps preview patch hot path off repeated Runtime Node snapshots after begin'));
    assert(runtimeTest.includes('getNodeSnapshot).not.toHaveBeenCalled()'));
});
check('preview cache clears on cancel', () => assert(runtimeService.includes('authoringPreviewComponentIds.delete(nodeId);')));
check('preview cache clears on dispose', () => assert(runtimeService.includes('authoringPreviewComponentIds.clear();')));
check('HF9 does not alter collider tessellation constants', () => {
    assert(runtimeService.includes('const CIRCLE_SEGMENTS = 32;'));
    assert(runtimeService.includes('const CAPSULE_ARC_SEGMENTS = 16;'));
});

console.log(`WS-10N8-HF9 Preview Notification Containment Conformance: ${checks.length}/${checks.length} PASS`);
checks.forEach(name => console.log(`PASS ${name}`));
