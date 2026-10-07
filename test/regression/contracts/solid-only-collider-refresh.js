'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '../../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const assertSolidOnlyColliderRefreshContract = () => {
    const collider = read('src/lib/collision-system/collider2d-runtime-service.js');
    const moduleDefinition = read('src/lib/scene-system/module-definition.js');
    assert.match(collider, /nativeStatus\.areaCount === 0 && !mustInspectExternalSensors && areaOverlapState\.size === 0/);
    assert.match(collider, /computeAreaOverlaps\(area, colliders\)/);
    assert.match(collider, /type:\s*'area:enter'/);
    assert.match(collider, /type:\s*'area:exit'/);
    assert.match(moduleDefinition, /scratchRuntime:\s*vm && vm\.runtime/);
    return 'solid-only Collider refresh skips redundant geometry while Area semantics remain authoritative';
};

module.exports = {assertSolidOnlyColliderRefreshContract};
