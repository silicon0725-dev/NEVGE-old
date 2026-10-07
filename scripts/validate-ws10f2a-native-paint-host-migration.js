#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const checks = [];
const check = (name, pass) => {
    checks.push({name, pass: Boolean(pass)});
    if (!pass) process.exitCode = 1;
};

const host = read('src/lib/editor-shell/native-paint-host.js');
const hostView = read('src/containers/native-paint-editor-host.jsx');
const costumeTab = read('src/containers/costume-tab.jsx');
const gui = read('src/components/gui/gui.jsx');
const assets = read('src/lib/project-assets/global-asset-database.js');
const ecosystem = read('src/lib/editor-shell/tool-ecosystem-manifests.js');
const architecture = read('docs/architecture/workspace/WS-10F2A-NATIVE-PAINT-HOST-MIGRATION.md');
const matrix = read('docs/architecture/workspace/WS-10F2A-native-paint-host-boundary.csv');
const hostTests = read('test/unit/lib/editor-shell/native-paint-host.test.js');
const assetTests = read('test/unit/lib/project-assets-global-database.test.js');
const viewTests = read('test/unit/components/native-paint-host.test.jsx');

check('stable native host id', host.includes("ngvge.native-paint-host@1"));
check('stable native presentation id', host.includes("ngvge.paint-presentation.costume-tab@1"));
check('native host distinguishes vector and legacy raster', host.includes("VECTOR: 'vector'") && host.includes("LEGACY_RASTER: 'legacy-raster'"));
check('CostumeTab installs Native Paint host', costumeTab.includes('<NativePaintHost'));
check('GUI injects shared Paint session into CostumeTab', gui.includes('paintSession={paintSession}') && gui.includes('assetDatabase={assetDatabase}'));
check('native Resource selection projects into Workspace Context', gui.includes('onPaintResourceSelectionContextChange={handleWorkspaceResourceSelectionContextChange}'));
check('Vector host renders existing SVG-Edit adapter component', hostView.includes('<WorkspaceVectorEditor'));
check('Raster remains explicit legacy compatibility surface', hostView.includes('<PaintEditorWrapper') && hostView.includes("data-ngvge-paint-mode=\"legacy-raster\""));
check('Vector host never calls raw VM update APIs', !hostView.includes('vm.updateSvg') && !hostView.includes('vm.updateBitmap') && !hostView.includes('renderer.'));
check('Resource authority exposes read-only costume Resource lookup', assets.includes('const getCostumeResourceId'));
check('Resource authority exposes idempotent native adoption', assets.includes('const ensureCostumeResource') && assets.includes("type: 'native-paint:adopt'"));
check('native adoption does not call explicit capture dedup path', /const ensureCostumeResource[\s\S]*?return record\.resourceId;/.test(assets) && !/const ensureCostumeResource[\s\S]*?captureCostume\(/.test(assets));
check('dirty native costume switching is fail-closed', host.includes('NGVGE_NATIVE_PAINT_DIRTY_SWITCH_BLOCKED') && costumeTab.includes('isNativePaintWorkingCopyDirty'));
check('dirty current costume destructive actions are guarded', costumeTab.includes('before deleting this costume') && costumeTab.includes('before duplicating this costume') && costumeTab.includes('before exporting this costume'));
check('standalone Paint window documented non-primary', ecosystem.includes('standalone Paint window remains a compatibility/development surface'));
check('architecture freezes native host as primary', architecture.includes('primary Better Paint presentation is the existing native Costume / Backdrop editor host'));
check('boundary matrix keeps raw VM mutation backend-only', matrix.includes('Renderer/VM raw mutation') && matrix.includes('FORBIDDEN FROM VECTOR HOST'));
check('unit regression covers no implicit dedup', assetTests.includes('distinct canonical Resources without deduplicating identical bytes'));
check('host regression covers dirty switch before adoption', hostTests.includes('before adopting it'));
check('DOM regression proves native SVG host mount', viewTests.includes('mounts SVG-Edit vector presentation inside the native costume/backdrop host'));

checks.forEach(({name, pass}, index) => console.log(`${pass ? 'PASS' : 'FAIL'} ${index + 1}/${checks.length} ${name}`));
const passed = checks.filter(item => item.pass).length;
console.log(`WS-10F2A Native Paint host migration: ${passed}/${checks.length} PASS`);
if (passed !== checks.length) process.exit(1);
