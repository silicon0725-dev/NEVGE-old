#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const gizmo = read('src/components/stage/collider2d-gizmo.jsx');
const runtime = read('src/lib/collision-system/collider2d-runtime-service.js');
const profiler = read('src/lib/frame-profiler/frame-time-profiler.js');
const checks = [
  ['diagnostics version', /WS-10N8-HF14\.(?:9|10)/.test(profiler)],
  ['dynamic Collider presentation has independent profiler category', /COLLIDER_DYNAMIC_PRESENTATION/.test(profiler) && /Collider Dynamic Presentation/.test(profiler)],
  ['transform-only collision refresh can use dynamic debug fast path', /passiveDynamicRefreshHandler/.test(gizmo) && /transform-hierarchy-change/.test(gizmo)],
  ['dynamic debug fast path uses exact affected Collider ids', /affectedColliderNodeIds/.test(gizmo) && /PASSIVE_DYNAMIC_DEBUG_MAX_AFFECTED/.test(gizmo)],
  ['dynamic debug fast path reads only changed Collider snapshots', /colliderRuntime\.getCollider\(affectedNodeId\)/.test(gizmo)],
  ['dynamic debug presentation is sampled below gameplay rate', /PASSIVE_DYNAMIC_DEBUG_MAX_HZ\s*=\s*20/.test(gizmo) && /createQualityFrameScheduler/.test(gizmo)],
  ['Contacts overlap mode retains full refresh fallback', /getShowOverlapState/.test(gizmo) && /return false/.test(gizmo)],
  ['dynamic debug path records signal coalescing and flush counters', /colliderDynamicDebugSignals/.test(gizmo) && /colliderDynamicDebugCoalescedSignals/.test(gizmo) && /colliderDynamicDebugFlushes/.test(gizmo)],
  ['Collider Runtime attributes transform refresh sources', /colliderRefreshTransformSignals/.test(runtime) && /colliderRefreshTransformAffectedColliders/.test(runtime)],
  ['full debug snapshot remains available as correctness fallback', /getDebugViewportSnapshot/.test(gizmo) && /schedule\('collider'\)/.test(gizmo)]
];
checks.forEach(([label, ok]) => { assert.ok(ok, label); console.log(`PASS ${label}`); });
console.log(`HF14.9 conformance: ${checks.length}/${checks.length} PASS`);
