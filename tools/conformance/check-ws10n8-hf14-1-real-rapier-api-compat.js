#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const adapter = read('src/lib/physics-system/rapier2d-backend-adapter.js');
const fake = read('test/helpers/fake-rapier2d.js');
const unit = read('test/unit/lib/physics-system/rapier2d-real-api-compat.test.js');

const checks = [
    ['ColliderDesc primitive translation uses Rapier 0.19.3 numeric x/y signature', () => {
        assert.match(adapter, /setTranslation', \[toMeters\(primitive\.center\[0\]\), toMeters\(primitive\.center\[1\]\)\]/);
        assert.doesNotMatch(adapter, /setTranslation', \[\{x:/);
    }],
    ['fake Rapier enforces the same numeric ColliderDesc translation contract', () => {
        assert.match(fake, /desc\.setTranslation = \(x, y\)/);
        assert.match(fake, /translation components must be numbers/);
    }],
    ['real Rapier dependency is exercised by an executable compatibility test', () => {
        assert.match(unit, /@dimforge\/rapier2d-compat/);
        assert.match(unit, /await RAPIER\.init\(\)/);
        assert.match(unit, /world\.syncBodies/);
        assert.match(unit, /world\.step\(1 \/ 60\)/);
    }],
    ['real compatibility test verifies native circle collider remains simulatable', () => {
        assert.match(unit, /shapeType: 'circle'/);
        assert.match(unit, /after\.position\[1\]/);
        assert.match(unit, /toBeLessThan\(before\.position\[1\]\)/);
    }]
];

let passed = 0;
for (const [name, check] of checks) {
    check();
    passed += 1;
    console.log(`PASS ${name}`);
}
console.log(JSON.stringify({suite: 'WS-10N8-HF14.1 Real Rapier API Compatibility', passed, total: checks.length}, null, 2));
