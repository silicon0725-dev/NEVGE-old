'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const assertScratchContinuousMotionUIContainmentContract = () => {
  const policy = read('src/lib/scratch-sprite-adapter/scratch-runtime-update-policy.js');
  const hoc = read('src/lib/vm-listener-hoc.jsx');
  const inspector = read('src/components/project-inspector/project-inspector.jsx');
  const nodeDb = read('src/lib/project-nodes/node-database.js');
  assert.match(policy, /PASSIVE_SCRATCH_TARGET_UI_REFRESH_MS/);
  assert.match(policy, /createScratchTargetTopologySignature/);
  assert.match(hoc, /scratchTargetUiCoalescedSignals/);
  assert.match(inspector, /hasActiveScratchThreads\(vm\)/);
  assert.match(nodeDb, /nextTargetTopologySignature === lastTargetTopologySignature/);
  return {guiSampling: true, inspectorSampling: true, topologyOnlyNodeSync: true};
};
module.exports = {assertScratchContinuousMotionUIContainmentContract};
