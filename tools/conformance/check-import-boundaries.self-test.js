#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {checkRepository} = require('./check-import-boundaries');

const DEFAULT_POLICY = {
    coreRoot: 'src/core',
    allowedBarePackages: [],
    sourceExtensions: ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx'],
    forbiddenAmbientGlobals: ['Scratch', 'document', 'process'],
    policy: {
        symlinksForbiddenInsideCore: true
    }
};

const createFixture = files => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ngvge-c001-import-boundary-'));
    for (const [relative, content] of Object.entries(files)) {
        const absolute = path.join(root, relative);
        fs.mkdirSync(path.dirname(absolute), {recursive: true});
        fs.writeFileSync(absolute, content);
    }
    return root;
};

const run = (files, policy = DEFAULT_POLICY) => {
    const root = createFixture(files);
    try {
        return checkRepository({repoRoot: root, policy});
    } finally {
        fs.rmSync(root, {recursive: true, force: true});
    }
};

const expectCode = (result, code) => {
    assert.strictEqual(result.valid, false, `expected ${code}, but gate passed`);
    assert(result.violations.some(issue => issue.code === code), `missing expected violation ${code}`);
};

expectCode(run({
    'README.md': 'fixture without a core ownership zone\n'
}), 'CORE_OWNERSHIP_ZONE_MISSING');

const local = run({
    'src/core/a.js': "import {b} from './b'; export {b};\n",
    'src/core/b.js': 'export const b = 1;\n'
});
assert.strictEqual(local.valid, true, JSON.stringify(local.violations));

const commentOnly = run({
    'src/core/a.js': "// import React from 'react'\nexport const value = 'require(\\\"scratch-vm\\\")';\n"
});
assert.strictEqual(commentOnly.valid, true, JSON.stringify(commentOnly.violations));

expectCode(run({
    'src/core/a.js': "import React from 'react';\n"
}), 'CORE_BARE_IMPORT_FORBIDDEN');

expectCode(run({
    'src/core/a.js': "export {value} from '../legacy/value';\n",
    'src/legacy/value.js': 'export const value = 1;\n'
}), 'CORE_IMPORT_ESCAPES_OWNERSHIP_ZONE');

expectCode(run({
    'src/core/a.js': "const vm = require('scratch-vm'); module.exports = vm;\n"
}), 'CORE_BARE_IMPORT_FORBIDDEN');

expectCode(run({
    'src/core/a.js': "export const load = () => import('../../components/gui/gui.jsx');\n"
}), 'CORE_IMPORT_ESCAPES_OWNERSHIP_ZONE');

expectCode(run({
    'src/core/a.js': 'export const load = name => import(name);\n'
}), 'CORE_NON_LITERAL_IMPORT_FORBIDDEN');

expectCode(run({
    'src/core/a.js': 'export const load = name => require(name);\n'
}), 'CORE_NON_LITERAL_REQUIRE_FORBIDDEN');

const allowlisted = run({
    'src/core/a.js': "import thing from 'pure-contract-lib'; export default thing;\n"
}, {
    ...DEFAULT_POLICY,
    allowedBarePackages: ['pure-contract-lib']
});
assert.strictEqual(allowlisted.valid, true, JSON.stringify(allowlisted.violations));

expectCode(run({
    'src/core/a.js': 'export const root = document.body;\n'
}), 'CORE_AMBIENT_BACKEND_GLOBAL_FORBIDDEN');

const shadowed = run({
    'src/core/a.js': 'const document = {body: 1}; export const root = document.body;\n'
});
assert.strictEqual(shadowed.valid, true, JSON.stringify(shadowed.violations));

expectCode(run({
    'src/core/a.js': 'export const env = process.env.NODE_ENV;\n'
}), 'CORE_AMBIENT_BACKEND_GLOBAL_FORBIDDEN');

process.stdout.write('ARC-C001 Import Boundary self-test PASS: 13 contract cases.\n');
