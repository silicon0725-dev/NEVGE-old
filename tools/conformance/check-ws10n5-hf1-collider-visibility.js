'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const checks = [];
const check = (name, condition) => {
    checks.push({name, pass: Boolean(condition)});
};

const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
const stageCss = read('src/components/stage/stage.css');
const creation = read('src/lib/functional-node/functional-node-creation-service.js');
const test = read('test/unit/components/collider2d-gizmo.test.jsx');

check('stage overlay enumerates active Collider2D views', gizmo.includes('colliderRuntime.listColliders()'));
check('stage overlay no longer depends exclusively on selected NodeId', gizmo.includes('gizmos.map(gizmo =>'));
check('selected collider remains explicitly highlighted', gizmo.includes('colliderGizmoSelected'));
check('sensor collider presentation remains dashed', gizmo.includes('colliderGizmoSensor'));
check('overlay remains editor presentation only', gizmo.includes('data-ngvge-collider-overlay="true"'));
check('selected collider presentation is visually stronger', stageCss.includes('.collider-gizmo-selected'));
check('functional archetype label becomes the default authored name', creation.includes('createOptions.name = archetype.label.trim()'));
check('HF1 DOM test covers multiple visible colliders', test.includes("expect(polygons).toHaveLength(2)"));
check('HF1 DOM test covers runtime geometry refresh', test.includes("collision:refresh"));

const failed = checks.filter(item => !item.pass);
if (failed.length) {
    failed.forEach(item => console.error(`FAIL ${item.name}`));
    console.error(`WS-10N5-HF1 Collider Visibility Conformance FAIL (${checks.length - failed.length}/${checks.length}).`);
    process.exit(1);
}
console.log(`WS-10N5-HF1 Collider Visibility Conformance PASS (${checks.length}/${checks.length}).`);
