#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    runBindingContractChecks,
    scanSensitiveSource
} = require('./check-scratch-adapter-boundary');

const createFixture = files => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ngvge-c001-scratch-boundary-'));
    for (const [relative, source] of Object.entries(files)) {
        const absolute = path.join(root, relative);
        fs.mkdirSync(path.dirname(absolute), {recursive: true});
        fs.writeFileSync(absolute, source);
    }
    return root;
};

const runFixture = files => {
    const root = createFixture(files);
    try {
        return scanSensitiveSource({repoRoot: root});
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
};

const expectCode = (result, code) => {
    assert(result.violations.some(issue => issue.code === code), `Expected ${code}: ${JSON.stringify(result)}`);
};

const safe = runFixture({
    'src/core/protocol/value.js': "module.exports = Object.freeze({kind: 'command'});\n",
    'src/lib/runtime-nodes/model.js': "module.exports = {nodeId: 'ngvge:node:abcdefgh'};\n",
    'src/lib/persistence/value.js': "module.exports = {schemaVersion: 1};\n"
});
assert.strictEqual(safe.violations.length, 0, JSON.stringify(safe.violations));

expectCode(runFixture({
    'src/core/a.js': "const adapter = require('../lib/scratch-sprite-adapter'); module.exports = adapter;\n"
}), 'SCRATCH_ADAPTER_DEPENDENCY_LEAK');

expectCode(runFixture({
    'src/lib/runtime-nodes/model.js': "const snapshot = {targetRuntimeId: 'volatile'}; module.exports = snapshot;\n"
}), 'SCRATCH_VOLATILE_TARGET_ID_LEAK');

expectCode(runFixture({
    'src/lib/persistence/model.js': "module.exports = {kind: 'scratch-target'};\n"
}), 'SCRATCH_COMPATIBILITY_REPRESENTATION_LEAK');

const contract = runBindingContractChecks();
assert.strictEqual(contract.volatileTargetIdPersistentRejection, true);
assert.strictEqual(contract.immutableBindingViews, true);
assert.strictEqual(contract.staleProjectionRejected, true);

process.stdout.write('ARC-C001 Scratch Adapter Boundary self-test PASS (7/7 contract cases).\n');
