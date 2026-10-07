#!/usr/bin/env node
const assert = require('assert');
const {spawnSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const packageJson = require(path.join(root, 'package.json'));

const requiredFiles = [
    'jest.unit-dom.config.js',
    'scripts/run-unit-tests.js',
    'test/unit/support/test-dom-environment.js',
    'test/regression/run-regressions.js',
    'test/regression/contracts/runtime-detached-persistence.js',
    'test/regression/contracts/git-myers-diff.js',
    'test/regression/contracts/git-sb3-reconstruction.js'
];

for (const relativePath of requiredFiles) {
    assert(fs.existsSync(path.join(root, relativePath)), `Missing R5 test infrastructure file: ${relativePath}`);
}

assert.strictEqual(packageJson.scripts['test:unit'], 'node scripts/run-unit-tests.js');
assert.strictEqual(packageJson.scripts['test:unit:node'], 'node scripts/run-unit-tests.js --suite=node');
assert.strictEqual(packageJson.scripts['test:unit:dom'], 'node scripts/run-unit-tests.js --suite=dom');
assert.strictEqual(packageJson.scripts['test:regression'], 'node test/regression/run-regressions.js');

const run = (command, args) => {
    const result = spawnSync(command, args, {
        cwd: root,
        encoding: 'utf8',
        env: process.env
    });
    if (result.status !== 0) {
        process.stdout.write(result.stdout || '');
        process.stderr.write(result.stderr || '');
        throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
    }
    return `${result.stdout || ''}${result.stderr || ''}`;
};

const unitOutput = run(process.execPath, [
    path.join(root, 'scripts', 'run-unit-tests.js'),
    '--runInBand'
]);
assert(unitOutput.includes('60 passed, 60 total'), 'Node unit suite summary is missing.');
assert(unitOutput.includes('279 passed, 279 total'), 'Node unit test summary is missing.');
assert(unitOutput.includes('3 passed, 3 total'), 'DOM unit suite summary is missing.');
assert(unitOutput.includes('20 passed, 20 total'), 'DOM unit test summary is missing.');
assert(!/Cannot log after tests|Jest did not exit|document is not defined/i.test(unitOutput),
    'Unit output contains a forbidden infrastructure diagnostic.');

const regressionOutput = run(process.execPath, [path.join(root, 'test', 'regression', 'run-regressions.js')]);
assert(regressionOutput.includes('"failed": 0'), 'Permanent regression layer did not finish cleanly.');
assert(regressionOutput.includes('"passed": 3'), 'Permanent regression layer did not pass all three contracts.');

console.log('R5 Unit Test Infrastructure validation passed.');
