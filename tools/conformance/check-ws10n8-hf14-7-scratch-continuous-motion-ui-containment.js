#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const policy = read('src/lib/scratch-sprite-adapter/scratch-runtime-update-policy.js');
const hoc = read('src/lib/vm-listener-hoc.jsx');
const inspector = read('src/components/project-inspector/project-inspector.jsx');
const nodeDb = read('src/lib/project-nodes/node-database.js');
const profiler = read('src/lib/frame-profiler/frame-time-profiler.js');
const checks = [
  ['diagnostics version', /WS-10N8-HF14\.(?:[789]|10)/.test(profiler)],
  ['passive target UI sampling policy', /PASSIVE_SCRATCH_TARGET_UI_REFRESH_MS\s*=\s*83/.test(policy)],
  ['topology signature excludes position churn', /createScratchTargetTopologySignature/.test(policy) && !/target\.x|target\.y/.test(policy)],
  ['GUI target serialization is sampled while scripts run', /hasActiveScratchThreads\(this\.props\.vm\)/.test(hoc) && /scratchTargetUiCoalescedSignals/.test(hoc)],
  ['GUI target sync is profiled', /SCRATCH_TARGET_UI_SYNC/.test(profiler) && /scratchTargetUiFlushes/.test(hoc)],
  ['Inspector targetsUpdate is sampled', /PASSIVE_SCRATCH_TARGET_UI_REFRESH_MS/.test(inspector) && /hasActiveScratchThreads\(vm\)/.test(inspector)],
  ['Node database ignores topology-stable targetsUpdate', /nextTargetTopologySignature === lastTargetTopologySignature/.test(nodeDb)],
  ['Node database still syncs on topology changes', /database\.syncTargets\(\)/.test(nodeDb)]
];
checks.forEach(([label, ok]) => { assert.ok(ok, label); console.log(`PASS ${label}`); });
console.log(`HF14.7 conformance: ${checks.length}/${checks.length} PASS`);
