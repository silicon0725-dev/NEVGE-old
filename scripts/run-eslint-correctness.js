#!/usr/bin/env node
'use strict';

const {spawnSync} = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const eslint = path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js');
const config = path.join(root, '.eslintrc.correctness.js');

const groups = [
    {
        name: 'source/tooling',
        args: [
            'src',
            'scripts',
            'static/extensions',
            '.eslintrc.js',
            '.eslintrc.correctness.js',
            'commitlint.config.js',
            'generate-changelog.js',
            'jest.unit-dom.config.js',
            'release.config.js',
            'webpack.config.js',
            '--ext', '.js,.jsx'
        ]
    },
    {
        name: 'tests',
        args: ['test', '--ext', '.js,.jsx', '--no-ignore']
    }
];

let failed = false;
for (const group of groups) {
    const result = spawnSync(process.execPath, [
        eslint,
        '--no-eslintrc',
        '--config', config,
        '--quiet',
        ...group.args
    ], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    });

    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);

    if (result.error || result.status !== 0) {
        failed = true;
        console.error(`R7 ESLint correctness group FAILED: ${group.name}`);
        if (result.error) console.error(result.error.stack || result.error.message);
    } else {
        console.log(`PASS ESLint correctness: ${group.name}`);
    }
}

if (failed) {
    process.exitCode = 1;
} else {
    console.log('R7 ESLint correctness validation passed.');
    console.log(JSON.stringify({
        groups: groups.map(group => group.name),
        inlineSuppressionsHonored: false,
        legacyStyleRulesIncluded: false
    }, null, 2));
}
