'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const fail = message => {
    console.error(`R8 test gate integrity failed: ${message}`);
    process.exitCode = 1;
};

const packageJSON = JSON.parse(read('package.json'));
const scripts = packageJSON.scripts || {};
const smoke = String(scripts['test:smoke'] || '');
const integration = String(scripts['test:integration'] || '');
const aggregate = String(scripts.test || '');

if (!smoke) fail('package.json is missing test:smoke.');
if (!integration) fail('package.json is missing test:integration.');
if (/--passWithNoTests\b/.test(smoke)) fail('test:smoke must not use --passWithNoTests.');
if (/--passWithNoTests\b/.test(integration)) fail('test:integration must not use --passWithNoTests.');
if (!smoke.includes('test[') || !smoke.includes('smoke')) fail('test:smoke must target test/smoke.');
if (!integration.includes('test[') || !integration.includes('integration')) fail('test:integration must target test/integration.');
if (!aggregate.includes('test:smoke')) fail('aggregate test script does not execute test:smoke.');
if (!aggregate.includes('test:integration')) fail('aggregate test script does not execute test:integration.');

const collectTests = directory => {
    const absolute = path.join(root, directory);
    if (!fs.existsSync(absolute)) return [];
    return fs.readdirSync(absolute, {withFileTypes: true}).flatMap(entry => {
        const relative = path.join(directory, entry.name);
        if (entry.isDirectory()) return collectTests(relative);
        return /\.(test|spec)\.[cm]?[jt]sx?$/.test(entry.name) ? [relative] : [];
    });
};

const smokeTests = collectTests('test/smoke');
const integrationTests = collectTests('test/integration');
if (smokeTests.length < 1) fail('test/smoke contains no executable test files.');
if (integrationTests.length < 1) fail('test/integration contains no executable test files.');

const ci = read('.github/workflows/node.js.yml');
if (!ci.includes('bun run test:smoke')) fail('CI does not execute test:smoke.');
if (!ci.includes('bun run test:integration')) fail('CI does not execute test:integration.');

if (!process.exitCode) {
    console.log('R8 smoke/integration gate integrity validation passed.');
    console.log(JSON.stringify({smokeTests: smokeTests.length, integrationTests: integrationTests.length}, null, 2));
}
