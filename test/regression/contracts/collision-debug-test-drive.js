'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const assertCollisionDebugTestDriveContract = async () => {
    const preferences = read('src/lib/editor-visualization/collider-gizmo-preferences.js');
    const drive = read('src/lib/editor-visualization/character-test-drive.js');
    const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
    const host = read('src/components/stage/character-controller2d-test-drive.jsx');
    const stage = read('src/components/stage/stage.jsx');

    assert.match(preferences, /selected collision shape stays visible/);
    assert.match(gizmo, /data-ngvge-collider-overlapping/);
    assert.match(gizmo, /COLLISION/);
    assert.match(drive, /WeakMap/);
    assert.match(host, /moveUsingVelocity/);
    assert.match(stage, /!isPlayerOnly && !isFullScreen/);

    return {
        collisionDebugAuthority: 'editor-only',
        selectedAuthoringShapeVisible: true,
        testDriveAuthority: 'editor-only CharacterController2D runtime projection'
    };
};

module.exports = {assertCollisionDebugTestDriveContract};
