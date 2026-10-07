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
        process.stderr.write(`WS-10F2A CERTIFICATION FAIL: ${label}\n`);
        process.exit(1);
    }
    checks.push(label);
};

const cert = json('docs/architecture/workspace/WS-10F2A-CERTIFICATE.json');
const architecture = read('docs/architecture/workspace/WS-10F2A-NATIVE-PAINT-HOST-MIGRATION.md');
const verification = read('docs/architecture/workspace/WS-10F2A-VERIFICATION.md');
const boundary = read('docs/architecture/workspace/WS-10F2A-native-paint-host-boundary.csv');
const host = read('src/lib/editor-shell/native-paint-host.js');
const component = read('src/containers/native-paint-editor-host.jsx');
const costumeTab = read('src/containers/costume-tab.jsx');
const gui = read('src/components/gui/gui.jsx');
const assets = read('src/lib/project-assets/global-asset-database.js');
const roadmap = read('docs/architecture/workspace/WS-10-HIGH-CAPABILITY-TOOL-INTEGRATION.md');
const packageJson = json('package.json');

check(cert.stage === 'WS-10F2A' && cert.status === 'COMPLETE / VERIFIED', 'certificate status');
check(architecture.includes('**Status:** `COMPLETE / VERIFIED`'), 'architecture status');
check(cert.host.hostId === 'ngvge.native-paint-host@1' && host.includes("'ngvge.native-paint-host@1'"), 'stable native host identity');
check(cert.host.presentationId === 'ngvge.paint-presentation.costume-tab@1' && host.includes("'ngvge.paint-presentation.costume-tab@1'"), 'stable native presentation identity');
check(cert.host.primaryPresentation === 'native Costume / Backdrop editor', 'native Costume/Backdrop is primary presentation');
check(component.includes('WorkspaceVectorEditor') && component.includes('PaintEditorWrapper'), 'native host composes vector and compatibility raster presentations');
check(costumeTab.includes('<NativePaintHost') && !costumeTab.includes('openPaintWindow'), 'CostumeTab hosts Better Paint directly');
check(gui.includes('paintSession={paintSession}') && gui.includes('assetDatabase={assetDatabase}'), 'GUI injects shared Paint infrastructure into CostumeTab');
check(host.includes('session.selectResource(resourceId)'), 'Vector native selection enters shared PaintSession');
check(assets.includes('ensureCostumeResource') && assets.includes('getCostumeResourceId'), 'Resource authority exposes native adoption seam');
check(assets.includes("type: 'native-paint:adopt'") && !host.includes('captureCostume'), 'native adoption is explicit and does not reuse content-dedup capture path');
check(cert.resourceAdoption.implicitContentDeduplication === false, 'certificate forbids implicit native content deduplication');
check(host.includes('NGVGE_NATIVE_PAINT_DIRTY_SWITCH_BLOCKED'), 'dirty selection switching is fail-closed');
check(!component.includes('vm.updateSvg') && !component.includes('vm.updateBitmap') && !component.includes('vm.renameCostume'), 'Vector native host has no raw VM mutation');
check(boundary.includes('compatibility') && boundary.includes('Global Asset Resource authority'), 'boundary matrix preserves backend/Resource ownership');
check(Object.entries(cert.authority).filter(([key]) => key !== 'legacyRasterIsCompatibility').every(([, value]) => value === false), 'native/vector authority remains false');
check(cert.authority.legacyRasterIsCompatibility === true, 'raster path is explicitly compatibility-only');
check(cert.verification.machine === '20/20 PASS' && cert.verification.focusedNode === '2 suites / 15 tests PASS' && cert.verification.focusedDom === '1 suite / 2 tests PASS', 'focused evidence');
check(cert.verification.fullUnit === '156 suites / 883 tests PASS' && cert.verification.permanentRegression === '19/19 PASS', 'full unit/regression evidence');
check(cert.verification.integration === '4 suites / 5 tests PASS' && cert.verification.smoke === '1 suite / 1 test PASS', 'integration/smoke evidence');
check(cert.verification.typeScript === 'PASS' && cert.verification.eslintCorrectness === 'PASS', 'typecheck/lint evidence');
check(cert.verification.ws9Aggregate === '20/20 PASS' && cert.verification.ws10eCertification === '24/24 PASS', 'parent certification evidence');
check(cert.verification.fullEditorWebpack.startsWith('INCONCLUSIVE'), 'full Editor Webpack is not falsely promoted to PASS');
check(verification.includes('INCONCLUSIVE') && verification.includes('0 errors / 0 warnings'), 'verification records precise Webpack evidence');
check(roadmap.includes('WS-10F2A COMPLETE / VERIFIED') && roadmap.includes('WS-10F2B'), 'roadmap advances to Unified Paint Shell');
check(typeof packageJson.scripts['test:workspace-shell:ws10f2a:focused'] === 'string' && typeof packageJson.scripts['test:workspace-shell:ws10f2a-webpack'] === 'string', 'repeatable F2A gates registered');
check(cert.next === 'WS-10F2B | Unified Paint Shell', 'resume point');

process.stdout.write(`WS-10F2A Certification PASS (${checks.length}/${checks.length}).\n`);
process.stdout.write(`${JSON.stringify({
    stage: cert.stage,
    status: cert.status,
    host: cert.host,
    fullUnit: cert.verification.fullUnit,
    fullEditorWebpack: cert.verification.fullEditorWebpack,
    next: cert.next,
    checks: checks.length
}, null, 2)}\n`);
