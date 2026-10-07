#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

const repositoryRoot = path.resolve(__dirname, '../..');
const packageJson = require(path.join(repositoryRoot, 'package.json'));

const expectedScripts = {
    'test:regression': 'node test/regression/run-regressions.js',
    'test:regression:runtime-detached': 'node test/regression/run-runtime-detached-persistence.js',
    'test:regression:git-diff': 'node test/regression/run-git-myers-diff.js',
    'test:regression:git-sb3': 'node test/regression/run-git-sb3-reconstruction.js'
};

Object.entries(expectedScripts).forEach(([name, command]) => {
    assert.strictEqual(packageJson.scripts[name], command, `Missing or changed package script ${name}.`);
});

const permanentRuntime = require('../../test/regression/contracts/runtime-detached-persistence');
const permanentDiff = require('../../test/regression/contracts/git-myers-diff');
const permanentSb3 = require('../../test/regression/contracts/git-sb3-reconstruction');
const legacyRuntime = require('./runtime-detached-persistence-contract');
const legacyDiff = require('./git-myers-diff-contract');
const legacySb3 = require('./git-sb3-reconstruction-contract');

assert.strictEqual(
    legacyRuntime.assertRuntimeDetachedPersistenceContract,
    permanentRuntime.assertRuntimeDetachedPersistenceContract,
    'R1 compatibility entry point diverged from the permanent Runtime contract.'
);
assert.strictEqual(
    legacyDiff.assertGitMyersDiffContract,
    permanentDiff.assertGitMyersDiffContract,
    'R2 compatibility entry point diverged from the permanent Myers Diff contract.'
);
assert.strictEqual(
    legacySb3.assertGitSb3ReconstructionContract,
    permanentSb3.assertGitSb3ReconstructionContract,
    'R3 compatibility entry point diverged from the permanent SB3 contract.'
);

const architectureValidator = fs.readFileSync(
    path.join(repositoryRoot, 'scripts/validate-ngvge-task-0008.9.7.js'),
    'utf8'
);
assert(
    architectureValidator.includes("require('../test/regression/contracts/runtime-detached-persistence')"),
    '0008.9.7 architecture validator is not consuming the permanent Runtime regression contract.'
);

const run = spawnSync(process.execPath, ['test/regression/run-regressions.js'], {
    cwd: repositoryRoot,
    encoding: 'utf8'
});
if (run.stdout) process.stdout.write(run.stdout);
if (run.stderr) process.stderr.write(run.stderr);
assert.strictEqual(run.status, 0, 'Permanent regression runner failed.');

console.log('R4 permanent regression layer validation passed.');
