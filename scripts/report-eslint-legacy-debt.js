#!/usr/bin/env node
'use strict';

const {spawnSync} = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const eslint = path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js');
const result = spawnSync(process.execPath, [
    eslint,
    '.',
    '--ext', '.js,.jsx',
    '--format', 'json'
], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
});

if (result.error) {
    console.error('Legacy ESLint inventory could not start.');
    console.error(result.error.stack || result.error.message);
    process.exit(1);
}

// ESLint exit 1 means lint diagnostics were found. Exit 2 means the lint
// infrastructure itself failed, which is the condition R7 must reject.
if (result.status !== 0 && result.status !== 1) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    console.error(`Legacy ESLint infrastructure FAILED with exit ${result.status}.`);
    process.exit(1);
}

let reports;
try {
    reports = JSON.parse(result.stdout || '[]');
} catch (error) {
    if (result.stderr) process.stderr.write(result.stderr);
    console.error('Legacy ESLint did not produce valid JSON output.');
    console.error(error.message);
    process.exit(1);
}

let errors = 0;
let warnings = 0;
let affectedFiles = 0;
const byRule = new Map();
for (const report of reports) {
    errors += report.errorCount || 0;
    warnings += report.warningCount || 0;
    if ((report.errorCount || 0) + (report.warningCount || 0) > 0) affectedFiles += 1;
    for (const message of report.messages || []) {
        const rule = message.ruleId || '(parser/config)';
        byRule.set(rule, (byRule.get(rule) || 0) + 1);
    }
}

const topRules = [...byRule.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 20)
    .map(([rule, count]) => ({rule, count}));

console.log('R7 legacy ESLint debt inventory completed without infrastructure crash.');
console.log(JSON.stringify({
    eslintExitCode: result.status,
    filesScanned: reports.length,
    affectedFiles,
    errors,
    warnings,
    topRules
}, null, 2));
