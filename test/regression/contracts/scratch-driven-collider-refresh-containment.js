'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const assertScratchDrivenColliderRefreshContainmentContract = () => {
    const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
    const runtime = read('src/lib/collision-system/collider2d-runtime-service.js');
    assert.match(gizmo, /PASSIVE_DYNAMIC_DEBUG_MAX_HZ\s*=\s*20/);
    assert.match(gizmo, /passiveDynamicRefreshHandler/);
    assert.match(gizmo, /colliderRuntime\.getCollider\(affectedNodeId\)/);
    assert.match(gizmo, /colliderDynamicDebugCoalescedSignals/);
    assert.match(runtime, /colliderRefreshTransformSignals/);
    assert.match(runtime, /affectedColliderNodeIds:\s*getAffectedColliderNodeIdsForTransform/);
};
module.exports = {assertScratchDrivenColliderRefreshContainmentContract};
