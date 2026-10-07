'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const assertRapierShapeAwareCollisionContract = () => {
    const queryBackend = read('src/lib/physics-system/rapier2d-shape-query-backend.js');
    const adapter = read('src/lib/physics-system/rapier2d-backend-adapter.js');
    const character = read('src/lib/character-controller-system/character-controller2d-runtime-service.js');
    assert.match(queryBackend, /new RAPIER\.Cuboid/);
    assert.match(queryBackend, /new RAPIER\.Ball/);
    assert.match(queryBackend, /new RAPIER\.Capsule/);
    assert.match(queryBackend, /\.castShape\(/);
    assert.match(queryBackend, /\.contactShape\(/);
    assert.match(adapter, /ColliderDesc\.cuboid/);
    assert.match(adapter, /ColliderDesc\.ball/);
    assert.match(adapter, /ColliderDesc\.capsule/);
    assert.match(adapter, /setTranslation', \[toMeters\(primitive\.center\[0\]\), toMeters\(primitive\.center\[1\]\)\]\)/);
    assert.doesNotMatch(adapter, /setTranslation', \[\{x:/);
    assert.match(character, /preparedCandidates\.length === session\.candidates\.length/);
    assert.match(character, /sweepConvexPolygons/);
    return {contract: 'rapier-shape-aware-collision', status: 'PASS'};
};

module.exports = {assertRapierShapeAwareCollisionContract};
