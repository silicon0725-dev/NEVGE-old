#!/usr/bin/env node
const {spawnSync} = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const JEST_BIN = path.join(ROOT, 'node_modules', 'jest', 'bin', 'jest.js');
const DOM_CONFIG = path.join(ROOT, 'jest.unit-dom.config.js');
const UNIT_PATTERN = 'test[\\\\/]unit';
const DOM_TESTS = [
    'test/unit/components/project-explorer.test.jsx',
    'test/unit/components/project-asset-manager.test.jsx',
    'test/unit/lib/editor-commands/editor-command-manager.test.js'
];
const DOM_IGNORE_PATTERN = DOM_TESTS
    .map(file => file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\//g, '[\\\\/]'))
    .join('|');

const cliArgs = process.argv.slice(2);
let suite = 'all';
const jestArgs = [];
for (const arg of cliArgs) {
    if (arg.startsWith('--suite=')) {
        suite = arg.slice('--suite='.length);
    } else {
        jestArgs.push(arg);
    }
}

if (!['all', 'node', 'dom'].includes(suite)) {
    process.stderr.write(`Unknown unit-test suite: ${suite}\n`);
    process.exit(2);
}

const runJest = (label, args) => {
    process.stdout.write(`\n=== ${label} ===\n`);
    const result = spawnSync(process.execPath, [JEST_BIN].concat(args), {
        cwd: ROOT,
        env: process.env,
        stdio: 'inherit'
    });
    if (result.error) {
        process.stderr.write(`${result.error.stack || result.error.message}\n`);
        return 1;
    }
    return typeof result.status === 'number' ? result.status : 1;
};

if (suite === 'all' || suite === 'node') {
    const nodeStatus = runJest('Unit / Node environment', [
        UNIT_PATTERN,
        `--testPathIgnorePatterns=${DOM_IGNORE_PATTERN}`
    ].concat(jestArgs));
    if (nodeStatus !== 0) process.exit(nodeStatus);
}

if (suite === 'all' || suite === 'dom') {
    const domStatus = runJest('Unit / DOM harness', [
        `--config=${DOM_CONFIG}`,
        '--runTestsByPath'
    ].concat(DOM_TESTS, jestArgs));
    if (domStatus !== 0) process.exit(domStatus);
}
