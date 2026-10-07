'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const assertStageHotPathProjectionContract = () => {
    const affine = read('src/components/stage/stage-affine-projection.js');
    const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
    const collider = read('src/lib/collision-system/collider2d-runtime-service.js');
    const tileMap = read('src/lib/tilemap-system/tilemap-layer2d-runtime-service.js');
    const editor = read('src/components/stage/tilemap2d-editor.jsx');
    const renderer = read('src/components/stage/tilemap2d-renderer.jsx');
    assert(affine.includes('createAffinePointProjector'));
    assert(gizmo.includes('colliderDebugCanvas'));
    assert(collider.includes('getDebugViewportSnapshot'));
    assert(collider.includes('queryCollidersInAABB'));
    assert(tileMap.includes('queryCollisionProjectionsInAABB'));
    assert(tileMap.includes('transformDependencyNodeIds'));
    assert(editor.includes('listTileMapCellsInBounds'));
    assert(renderer.includes('layerRevision'));
    assert(renderer.includes('cameraRevision'));
    return {
        affineCapabilitySampling: true,
        collisionDebugCanvas: true,
        sparseViewportQueries: true,
        transformDependencySets: true
    };
};
module.exports = {assertStageHotPathProjectionContract};
