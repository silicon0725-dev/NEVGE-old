'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const assertCharacterControllerCollisionBroadPhaseContract = () => {
    const collider = read('src/lib/collision-system/collider2d-runtime-service.js');
    const controller = read('src/lib/character-controller-system/character-controller2d-runtime-service.js');
    const testDrive = read('src/components/stage/character-controller2d-test-drive.jsx');
    assert(collider.includes('const queryCollidersInAABB ='));
    assert(controller.includes('const queryAABB = sweptAABB(collider.worldPoints, motion);'));
    assert(controller.includes('const withCollisionRefreshBatch ='));
    assert(collider.includes('nativeStatus.areaCount === 0'));
    assert(testDrive.includes('FRAME_PROFILER_CATEGORY.CHARACTER_CONTROLLER'));
    return {broadPhase: true, collisionRefreshBatching: true, profilerAttribution: true};
};

module.exports = {assertCharacterControllerCollisionBroadPhaseContract};
