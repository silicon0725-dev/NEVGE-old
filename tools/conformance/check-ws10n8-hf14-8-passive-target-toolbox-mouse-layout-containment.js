#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const policy = read('src/lib/scratch-sprite-adapter/scratch-runtime-update-policy.js');
const hoc = read('src/lib/vm-listener-hoc.jsx');
const blocks = read('src/containers/blocks.jsx');
const stage = read('src/containers/stage.jsx');
const profiler = read('src/lib/frame-profiler/frame-time-profiler.js');
const checks = [
  ['diagnostics version', /WS-10N8-HF14\.(?:[89]|10)/.test(profiler)],
  ['full target list uses slower passive sampling', /PASSIVE_SCRATCH_TARGET_LIST_REFRESH_MS\s*=\s*250/.test(policy) && /PASSIVE_SCRATCH_TARGET_LIST_REFRESH_MS/.test(hoc)],
  ['Inspector sampling policy remains independently available', /PASSIVE_SCRATCH_TARGET_UI_REFRESH_MS\s*=\s*83/.test(policy)],
  ['Blockly position sync defers while scripts run', /hasActiveScratchThreads\(this\.props\.vm\)/.test(blocks) && /pendingRuntimeToolboxPositionSync/.test(blocks)],
  ['Blockly position sync flushes when run stops', /PROJECT_RUN_STOP/.test(blocks) && /onProjectRunStopForToolboxPosition/.test(blocks)],
  ['Blockly position sync has independent profiler attribution', /SCRATCH_TOOLBOX_POSITION_SYNC/.test(profiler) && /scratchToolboxPositionDeferredSignals/.test(blocks)],
  ['Stage mousemove uses cached layout geometry', /onMouseMove \(e\) \{\s*this\.refreshRectIfStale\(\)/.test(stage) && /SCRATCH_STAGE_RECT_CACHE_MAX_AGE_MS/.test(stage)],
  ['Stage layout reads are independently profiled', /SCRATCH_MOUSE_INPUT_LAYOUT/.test(profiler) && /scratchMouseRectCacheHits/.test(stage)],
  ['Scratch VM execution is not throttled by HF14.8', !/setFramerate|runtime\.frameLoop|vm\.stopAll/.test(policy)]
];
checks.forEach(([label, ok]) => { assert.ok(ok, label); console.log(`PASS ${label}`); });
console.log(`HF14.8 conformance: ${checks.length}/${checks.length} PASS`);
