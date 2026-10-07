'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const assertPreviewNotificationContainmentContract = () => {
    const toolbar = read('src/components/stage/collider2d-debug-toolbar.jsx');
    const runtimeService = read('src/lib/collision-system/collider2d-runtime-service.js');

    assert(toolbar.includes("change.type === 'authoring-preview-patch'"),
        'Collider debug toolbar must not synchronously rerender status for transient preview patches');
    assert(runtimeService.includes('const getColliderStatus ='),
        'Collider runtime must keep a lightweight status path separate from full geometry listing');
    const statusStart = runtimeService.indexOf('const getColliderStatus =');
    const statusEnd = runtimeService.indexOf('const getCollider =', statusStart);
    assert(!runtimeService.slice(statusStart, statusEnd).includes('listColliders('),
        'Collider status must not enumerate full collider geometry');
    assert(runtimeService.includes('const authoringPreviewComponentIds = new Map();'),
        'Transient preview must cache component identity for its hot path');

    return {
        contract: 'WS-10N8-HF9 Preview Notification Containment',
        invariants: 4
    };
};

module.exports = {assertPreviewNotificationContainmentContract};
