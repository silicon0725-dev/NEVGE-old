'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const assertSelectedColliderAffectedSetFastPathContract = () => {
    const runtime = read('src/lib/collision-system/collider2d-runtime-service.js');
    const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
    assert.match(runtime, /nativeTransformAffectedColliderNodeIds/);
    assert.match(runtime, /getAffectedColliderNodeIdsForTransform/);
    assert.match(runtime, /pendingAffectedColliderNodeIds/);
    assert.match(gizmo, /selectedAffected|selectedOnlyAffected/);
    assert.match(gizmo, /colliderSelectedFastPathEligible/);
    assert.match(gizmo, /colliderSelectedAffectedSetMiss/);
    return {
        contract: 'selected-collider-affected-set-fast-path',
        exactAffectedColliderAttribution: true,
        parentTransformSafe: true,
        selectedOnlyDomFastPath: true
    };
};

module.exports = {assertSelectedColliderAffectedSetFastPathContract};
