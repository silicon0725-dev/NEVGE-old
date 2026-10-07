'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const assertMixedAffectedColliderRoutingContract = () => {
    const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
    assert.match(gizmo, /const selectedAffected = Boolean\(nodeId && affectedColliderNodeIds\.includes\(nodeId\)\)/);
    assert.match(gizmo, /const dynamicAffected = affectedColliderNodeIds\.filter\(affectedNodeId => affectedNodeId !== nodeId\)/);
    assert.match(gizmo, /const selectedBranchHandled = !selectedAffected \|\| selectedHandled/);
    assert.match(gizmo, /const dynamicBranchHandled = !dynamicAffected\.length \|\| dynamicHandled/);
    assert.match(gizmo, /allAffectedColliderNodeIds\.filter\(affectedNodeId => affectedNodeId !== nodeId\)/);
    assert.match(gizmo, /colliderMixedAffectedSetFastPath/);
    return {contract: 'mixed-affected-collider-routing', status: 'PASS'};
};
module.exports = {assertMixedAffectedColliderRoutingContract};
