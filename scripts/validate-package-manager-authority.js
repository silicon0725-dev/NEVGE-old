#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const exists = relativePath => fs.existsSync(path.join(root, relativePath));
const failures = [];

const expect = (condition, message) => {
    if (!condition) failures.push(message);
};

const packageJson = JSON.parse(read('package.json'));
expect(packageJson.packageManager === 'bun@1.3.14',
    'package.json#packageManager must be exactly bun@1.3.14');
expect(packageJson.engines && packageJson.engines.node === '22.x || 24.x',
    'package.json#engines.node must declare the supported Node.js 22/24 LTS lines');
expect(packageJson.engines && packageJson.engines.bun === '1.3.14',
    'package.json#engines.bun must match packageManager');
expect(packageJson.scripts && packageJson.scripts['test:ci-contract'] ===
    'node scripts/validate-package-manager-authority.js',
'package.json must expose test:ci-contract');

expect(read('.nvmrc').trim() === '24', '.nvmrc must select the primary Node.js 24 line');
expect(exists('bun.lock'), 'bun.lock must exist');
expect(/^\s*\{[\s\S]*"lockfileVersion"\s*:\s*1\b/.test(read('bun.lock')),
    'bun.lock must be a recognized text lockfile');

for (const lock of ['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb']) {
    expect(!exists(lock), `${lock} must not coexist with bun.lock`);
}
expect(!exists('.github/workflows/getlock.yml'),
    'the legacy package-lock generation workflow must be removed');

const ci = read('.github/workflows/node.js.yml');
expect(/node-version:\s*\['24',\s*'22'\]/.test(ci),
    'CI must exercise Node.js 24 primary and Node.js 22 compatibility lines');
expect(ci.includes('oven-sh/setup-bun@v2'), 'CI must setup Bun');
expect(ci.includes('bun install --frozen-lockfile'), 'CI must install from frozen bun.lock');
expect(ci.includes('bun run test:regression'), 'CI must run the permanent regression gate');
expect(ci.includes('bun run test:unit'), 'CI must run the unit gate');
expect(ci.includes('bun run test:lint'), 'CI must run the ESLint correctness gate');
expect(ci.includes('bun run build'), 'CI must run the production build');
expect(!/\bnpm\s+(?:ci|install)\b/.test(ci), 'CI must not install project dependencies with npm');

const build = read('.github/workflows/build.yml');
expect(/node-version:\s*'24'/.test(build), 'deployment build must use primary Node.js 24');
expect(build.includes('oven-sh/setup-bun@v2'), 'deployment build must setup Bun');
expect(build.includes('bun install --frozen-lockfile'), 'deployment build must install from frozen bun.lock');
expect(!/\bnpm\s+(?:ci|install)\b/.test(build),
    'deployment build must not install project dependencies with npm');

const changelog = read('.github/workflows/generate-changes.yml');
expect(/node-version:\s*'24'/.test(changelog), 'changelog workflow must use primary Node.js 24');
expect(changelog.includes('oven-sh/setup-bun@v2'), 'changelog workflow must setup Bun');
expect(changelog.includes('bun add --no-save @octokit/rest dayjs'),
    'workflow-local changelog dependencies must be ephemeral and must not create a second lockfile');
expect(!/\bnpm\s+(?:ci|install)\b/.test(changelog),
    'changelog workflow must not invoke npm install');

const workflowDir = path.join(root, '.github', 'workflows');
for (const name of fs.readdirSync(workflowDir)) {
    if (!/\.ya?ml$/i.test(name)) continue;
    const contents = fs.readFileSync(path.join(workflowDir, name), 'utf8');
    expect(!/\bnpm\s+ci\b/.test(contents), `${name} must not invoke npm ci`);
}

if (failures.length) {
    console.error('R6 package-manager authority validation FAILED');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
} else {
    console.log('R6 package-manager authority validation passed.');
    console.log(JSON.stringify({
        packageManager: packageJson.packageManager,
        nodePrimary: 24,
        nodeCompatibility: 22,
        lockfile: 'bun.lock',
        frozenInstall: true
    }, null, 2));
}
