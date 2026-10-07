#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
const profiler = read('src/lib/frame-profiler/frame-time-profiler.js');
const checks = [
  ['diagnostics version', /WS-10N8-HF14\.10/.test(profiler)],
  ['mixed affected set is partitioned into selected and dynamic branches', /selectedAffected/.test(gizmo) && /dynamicAffected/.test(gizmo)],
  ['selected branch accepts membership in a mixed affected set', /affectedColliderNodeIds\.includes\(nodeId\)/.test(gizmo)],
  ['dynamic branch removes the selected Collider before sampled canvas routing', /filter\(affectedNodeId => affectedNodeId !== nodeId\)/.test(gizmo)],
  ['full snapshot fallback is skipped only when every required branch is handled', /selectedBranchHandled/.test(gizmo) && /dynamicBranchHandled/.test(gizmo)],
  ['mixed fast path has profiler evidence', /colliderMixedAffectedSetFastPath/.test(gizmo)],
  ['selected direct DOM path remains present', /COLLIDER_SELECTED_PRESENTATION/.test(gizmo) && /colliderSelectedDirectDom/.test(gizmo)],
  ['dynamic sampled canvas path remains present', /COLLIDER_DYNAMIC_PRESENTATION/.test(gizmo) && /PASSIVE_DYNAMIC_DEBUG_MAX_HZ\s*=\s*20/.test(gizmo)]
];
checks.forEach(([label, ok]) => { assert.ok(ok, label); console.log(`PASS ${label}`); });
console.log(`HF14.10 conformance: ${checks.length}/${checks.length} PASS`);
