#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcRoot = path.join(root, 'src');
const entry = path.join(srcRoot, 'containers', 'native-paint-editor-host.jsx');
const requiredRuntimeFiles = [
    'src/components/workspace-paint/workspace-raster-editor.jsx',
    'src/lib/paint-backends/canvas-raster-backend.js',
    'src/lib/paint-backends/canvas-raster-transfer.js',
    'src/lib/paint-backends/mini-paint-derived-raster-ops.js'
];

const checks = [];
const check = (name, pass, detail = '') => checks.push({name, pass: Boolean(pass), detail});
const fileExists = rel => fs.existsSync(path.join(root, rel)) && fs.statSync(path.join(root, rel)).isFile();

for (const rel of requiredRuntimeFiles) {
    check(`runtime dependency exists: ${rel}`, fileExists(rel));
}

const importPattern = /(?:import\s+(?:[^'";]+?\s+from\s+)?|require\s*\()(['"])([^'"]+)\1/g;
const candidatesFor = base => [
    base,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.json`,
    path.join(base, 'index.js'),
    path.join(base, 'index.jsx')
];

const resolveRelative = (fromFile, request) => {
    const base = path.resolve(path.dirname(fromFile), request);
    return candidatesFor(base).find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
};

const visited = new Set();
const missing = [];
const stack = [entry];
while (stack.length) {
    const file = stack.pop();
    if (!file || visited.has(file)) continue;
    visited.add(file);
    if (!fs.existsSync(file)) {
        missing.push({from: '<entry>', request: path.relative(root, file)});
        continue;
    }
    const source = fs.readFileSync(file, 'utf8');
    importPattern.lastIndex = 0;
    let match;
    while ((match = importPattern.exec(source))) {
        const request = match[2];
        if (!request.startsWith('.')) continue;
        const resolved = resolveRelative(file, request);
        if (!resolved) {
            missing.push({from: path.relative(root, file), request});
            continue;
        }
        if (resolved.startsWith(srcRoot + path.sep)) stack.push(resolved);
    }
}

check('Native Paint runtime relative-import closure resolves from a clean source tree', missing.length === 0,
    missing.map(item => `${item.from} -> ${item.request}`).join('; '));
check('WorkspaceRasterEditor is imported by the Native Paint host',
    fs.readFileSync(entry, 'utf8').includes("../components/workspace-paint/workspace-raster-editor.jsx"));

const failed = checks.filter(item => !item.pass);
checks.forEach(({name, pass, detail}, index) => {
    console.log(`${pass ? 'PASS' : 'FAIL'} ${index + 1}/${checks.length} ${name}${detail && !pass ? ` :: ${detail}` : ''}`);
});
console.log(`WS-10G1-HF1a Runtime Import Closure Gate: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length) process.exit(1);
