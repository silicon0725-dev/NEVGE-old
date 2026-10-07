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
const tsconfig = JSON.parse(read('tsconfig.02agent.json'));
const scripts = packageJson.scripts || {};
const devDependencies = packageJson.devDependencies || {};

expect(devDependencies.typescript === '5.8.3',
    'TypeScript compiler must be pinned to 5.8.3 in devDependencies');
expect(devDependencies['@types/react'] === '19.2.18',
    '@types/react must be pinned so the scoped gate does not depend on peer-hoisting');
expect(scripts['test:typecheck:scope'] === 'node scripts/validate-typescript-scope.js',
    'package.json must expose test:typecheck:scope');
expect(scripts['test:typecheck:02agent'] ===
    'node ./node_modules/typescript/bin/tsc --project tsconfig.02agent.json --pretty false',
'package.json must expose the local TypeScript 02agent compiler gate');
expect(scripts['test:typecheck'] === 'node scripts/validate-typescript-scope.js && node ./node_modules/typescript/bin/tsc --project tsconfig.02agent.json --pretty false',
    'package.json must expose the composed TypeScript gate');

const options = tsconfig.compilerOptions || {};
expect(options.noEmit === true, '02agent TypeScript gate must be noEmit');
expect(options.strict === true, '02agent TypeScript gate must run in strict mode');
expect(options.allowJs === true && options.checkJs === false,
    '02agent may consume legacy JS, but the scoped gate must not expand into checkJs migration');
expect(Array.isArray(tsconfig.include) && tsconfig.include.length > 0,
    'tsconfig.02agent.json must define an explicit include boundary');
for (const entry of tsconfig.include || []) {
    expect(entry.startsWith('src/addons/addons/02agent/'),
        `TypeScript include escapes the 02agent boundary: ${entry}`);
}

expect(exists('src/addons/addons/02agent/typecheck-globals.d.ts'),
    '02agent runtime ambient declarations must exist');
expect(exists('src/addons/addons/02agent/typecheck-react-draggable.d.ts'),
    'react-draggable compatibility augmentation must exist');

const sourceRoot = path.join(root, 'src');
const scopedRoot = path.join(root, 'src', 'addons', 'addons', '02agent');
const tsFiles = [];
const visit = directory => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(full);
        else if (/\.tsx?$/.test(entry.name)) tsFiles.push(full);
    }
};
visit(sourceRoot);
const escaped = tsFiles.filter(file => !file.startsWith(`${scopedRoot}${path.sep}`));
expect(escaped.length === 0,
    `TypeScript source exists outside the declared 02agent boundary: ${escaped.map(file => path.relative(root, file)).join(', ')}`);
expect(tsFiles.length >= 40, '02agent TypeScript scope unexpectedly lost source files');

const ci = read('.github/workflows/node.js.yml');
expect(ci.includes('bun run test:typecheck'), 'CI must run the TypeScript gate');
expect((scripts.test || '').includes('bun run test:typecheck'), 'the aggregate test command must run the TypeScript gate');

const lockText = read('bun.lock');
const lock = JSON.parse(lockText.replace(/,\s*([}\]])/g, '$1'));
const workspace = lock.workspaces && lock.workspaces[''];
expect(workspace && workspace.devDependencies && workspace.devDependencies.typescript === '5.8.3',
    'bun.lock root workspace must pin TypeScript 5.8.3');
expect(workspace && workspace.devDependencies && workspace.devDependencies['@types/react'] === '19.2.18',
    'bun.lock root workspace must pin @types/react 19.2.18');
expect(lock.packages && Array.isArray(lock.packages.typescript) && lock.packages.typescript[0] === 'typescript@5.8.3',
    'bun.lock must contain the TypeScript 5.8.3 package resolution');

if (failures.length) {
    console.error('R9 TypeScript scope validation FAILED');
    failures.forEach(failure => console.error(`- ${failure}`));
    process.exitCode = 1;
} else {
    console.log('R9 TypeScript scope validation passed.');
    console.log(JSON.stringify({
        scope: 'src/addons/addons/02agent',
        sourceFiles: tsFiles.length,
        strict: true,
        noEmit: true,
        compiler: devDependencies.typescript
    }, null, 2));
}
