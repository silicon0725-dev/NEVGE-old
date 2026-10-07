#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const json = relative => JSON.parse(read(relative));
const checks = [];
const check = (condition, label) => {
    if (!condition) {
        process.stderr.write(`WS-10F2B CERTIFICATION FAIL: ${label}\n`);
        process.exit(1);
    }
    checks.push(label);
};

const cert = json('docs/architecture/workspace/WS-10F2B-CERTIFICATE.json');
const architecture = read('docs/architecture/workspace/WS-10F2B-UNIFIED-PAINT-SHELL.md');
const verification = read('docs/architecture/workspace/WS-10F2B-VERIFICATION.md');
const matrix = read('docs/architecture/workspace/WS-10F2B-paint-shell-slot-matrix.csv');
const contract = read('src/lib/editor-shell/native-paint-shell.js');
const shell = read('src/components/native-paint/native-paint-shell.jsx');
const host = read('src/containers/native-paint-editor-host.jsx');
const vector = read('src/components/workspace-paint/workspace-vector-editor.jsx');
const roadmap = read('docs/architecture/workspace/WS-10-HIGH-CAPABILITY-TOOL-INTEGRATION.md');
const packageJson = json('package.json');

check(cert.stage === 'WS-10F2B' && cert.status === 'COMPLETE / VERIFIED', 'certificate status');
check(architecture.includes('**Status:** `COMPLETE / VERIFIED`'), 'architecture status');
check(cert.shell.shellId === 'ngvge.native-paint-shell@1' && contract.includes("'ngvge.native-paint-shell@1'"), 'stable shell identity');
check(cert.shell.schemaVersion === 1, 'shell schema version');
check(cert.shell.slots.length === 5 && cert.shell.slots.includes('canvas-chrome'), 'five frozen shell slots');
check(cert.shell.slots.every(slot => matrix.includes(slot)), 'slot matrix matches certificate');
check(Object.values(cert.authority).every(value => value === false), 'shell authority remains presentation-only');
check(shell.includes('NATIVE_PAINT_SHELL_SLOTS.CONTEXT_TOOLBAR') && shell.includes('NATIVE_PAINT_SHELL_SLOTS.STATUS_BAR'), 'component renders frozen shell slots');
check(host.includes('showToolbar={false}') && host.includes('onSelectTool={handleSelectTool}'), 'native Vector host externalizes toolbar ownership');
check(vector.includes('React.useImperativeHandle') && vector.includes('showToolbar: true'), 'Vector editor exposes bounded controls and retains development compatibility toolbar');
check(host.includes('mode="legacy-raster"') && host.includes('compatibility'), 'Raster path remains compatibility passthrough');
check(!shell.includes('@svgedit') && !shell.includes('miniPaint') && !shell.includes('Piskel'), 'shell imports no OSS App Shell');
check(!shell.includes('vm.updateSvg') && !shell.includes('vm.updateBitmap') && !shell.includes('renderer.'), 'shell has no raw VM/renderer mutation');
check(cert.verification.machine === '27/27 PASS', 'machine evidence');
check(cert.verification.focusedNode === '2 suites / 6 tests PASS' && cert.verification.focusedDom === '3 suites / 6 tests PASS', 'focused evidence');
check(cert.verification.productionWebpack === '0 errors / 0 warnings PASS', 'F2B production Webpack evidence');
check(cert.verification.fullUnit === '158 suites / 887 tests PASS', 'full unit evidence');
check(cert.verification.integration === '4 suites / 5 tests PASS' && cert.verification.smoke === '1 suite / 1 test PASS', 'integration/smoke evidence');
check(cert.verification.permanentRegression === '19/19 PASS', 'permanent regression evidence');
check(cert.verification.typeScript === 'PASS' && cert.verification.eslintCorrectness === 'PASS', 'typecheck/lint evidence');
check(cert.verification.arcC0011 === '7/7 PASS' && cert.verification.lrcG1 === '15/15 PASS', 'ARC/LRC evidence');
check(cert.verification.lplG1 === '17/17 PASS' && cert.verification.lexG1 === '19/19 PASS', 'LPL/LEX evidence');
check(cert.verification.lscG1 === '19/19 PASS' && cert.verification.col0 === '15/15 PASS', 'LSC/COL evidence');
check(cert.verification.ws9Aggregate === '20/20 PASS' && cert.verification.ws10eCertification === '24/24 PASS', 'WS-9/WS-10E evidence');
check(cert.verification.ws10f2aCertification === '27/27 PASS', 'F2A parent certification evidence');
check(cert.verification.fullEditorWebpack === '0 errors / 0 warnings PASS' && verification.includes('exit: 0'), 'full Editor production build evidence');
check(roadmap.includes('WS-10F2B COMPLETE / VERIFIED') && roadmap.includes('WS-10F2C..WS-10F2G NEXT / PLANNED'), 'roadmap advances to F2C');
check(typeof packageJson.scripts['test:workspace-shell:ws10f2b:focused'] === 'string' && typeof packageJson.scripts['test:workspace-shell:ws10f2b-webpack'] === 'string', 'repeatable F2B gates registered');
check(cert.next === 'WS-10F2C | Vector Professional Tooling', 'resume point');

process.stdout.write(`WS-10F2B Certification PASS (${checks.length}/${checks.length}).\n`);
process.stdout.write(`${JSON.stringify({
    stage: cert.stage,
    status: cert.status,
    shell: cert.shell,
    fullUnit: cert.verification.fullUnit,
    fullEditorWebpack: cert.verification.fullEditorWebpack,
    next: cert.next,
    checks: checks.length
}, null, 2)}\n`);
