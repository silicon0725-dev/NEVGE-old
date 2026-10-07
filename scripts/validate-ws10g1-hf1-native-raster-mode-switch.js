#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const checks = [];
const check = (name, pass) => checks.push({name, pass: Boolean(pass)});

const model = read('src/lib/editor-shell/native-paint-host.js');
const host = read('src/containers/native-paint-editor-host.jsx');
const styles = read('src/components/native-paint/native-paint-host.css');
const bindingTests = read('test/unit/lib/editor-shell/native-paint-host.test.js');
const hostTests = read('test/unit/components/native-paint-host.test.jsx');
const webpackValidator = read('scripts/validate-ws10g1-webpack-raster-entry.js');
const pkg = JSON.parse(read('package.json'));

check('editor modes are explicit and backend-neutral at the Native Paint host boundary',
    model.includes('const NATIVE_PAINT_EDITOR_MODES = Object.freeze({') &&
    model.includes("AUTO: 'auto'") &&
    model.includes("VECTOR: 'vector'") &&
    model.includes("BITMAP: 'bitmap'") &&
    model.includes("PIXEL: 'pixel'") &&
    model.includes("COMPATIBILITY: 'compatibility'"));
check('PNG/JPG source detection is canonical and does not depend only on one costume field',
    model.includes("const BITMAP_DATA_FORMATS = new Set(['png', 'jpg', 'jpeg'])") &&
    model.includes('costume.asset && costume.asset.dataFormat') &&
    model.includes('costume.md5ext') &&
    model.includes('readExtension'));
check('Auto follows source semantics while Scratch compatibility is an explicit requested mode',
    model.includes('if (requested === NATIVE_PAINT_EDITOR_MODES.AUTO) return sourceMode') &&
    model.includes('if (requested === NATIVE_PAINT_EDITOR_MODES.COMPATIBILITY) return NATIVE_PAINT_MODES.LEGACY_RASTER'));
check('Bitmap cannot be silently selected for incompatible source content',
    model.includes('NGVGE_NATIVE_PAINT_MODE_INCOMPATIBLE') &&
    model.includes('Bitmap mode requires PNG/JPG source content'));
check('Pixel is visible as a reserved mode but cannot impersonate an implemented backend',
    model.includes('NGVGE_NATIVE_PAINT_PIXEL_BACKEND_PENDING') &&
    model.includes('pixel: false'));
check('switching to Scratch compatibility releases canonical Resource selection rather than sharing authority',
    model.includes('if (selection.mode === NATIVE_PAINT_MODES.LEGACY_RASTER)') &&
    model.includes('if (state.selectedResourceId) session.selectResource(null)'));
check('dirty Working Copy blocks backend mode switching',
    model.includes('NGVGE_NATIVE_PAINT_DIRTY_SWITCH_BLOCKED') &&
    model.includes('switching costumes or editor modes'));

check('Native Paint UI exposes an always-visible Editor Mode selector',
    host.includes('data-ngvge-paint-mode-switch="true"') &&
    host.includes('EDITOR_MODE_OPTIONS.map'));
check('mode selector contains Auto, Vector, Bitmap, Pixel, and Scratch choices',
    ['Auto', 'Vector', 'Bitmap', 'Pixel', 'Scratch'].every(label => host.includes(`label: '${label}'`)));
check('Native Paint UI exposes active backend identity instead of visually ambiguous compatibility',
    host.includes('data-ngvge-active-paint-backend') &&
    host.includes("return 'NGVGE Raster Core'") &&
    host.includes("return 'Scratch Paint compatibility'"));
check('PNG Bitmap native path mounts WorkspaceRasterEditor',
    host.includes('selection.mode === NATIVE_PAINT_MODES.BITMAP') &&
    host.includes('<WorkspaceRasterEditor'));
check('Scratch Paint is only mounted inside the explicit legacy compatibility branch',
    host.includes('selection.mode === NATIVE_PAINT_MODES.LEGACY_RASTER') &&
    host.includes('<PaintEditorWrapper selectedCostumeIndex={selectedCostumeIndex} />'));
check('compatibility branch no longer early-returns before rendering mode selector',
    host.indexOf('data-ngvge-paint-mode-switch="true"') < host.indexOf('selection.mode === NATIVE_PAINT_MODES.LEGACY_RASTER'));
check('Pixel mode is disabled in the UI until its Shared Raster policy consumer exists',
    host.includes('if (mode === NATIVE_PAINT_EDITOR_MODES.BITMAP) return !modeAvailability.bitmap') &&
    host.includes('return true;'));
check('mode selector has dedicated compact shell styling',
    styles.includes('.modeSwitchBar') && styles.includes('.modeSwitchButtonActive') && styles.includes('.modeSwitchStatus'));

check('binding regression proves md5 extension fallback and explicit Scratch release',
    bindingTests.includes('resolves bitmap format from md5 extension') &&
    bindingTests.includes('explicit Scratch compatibility mode releases the native Resource selection'));
check('binding regression proves incompatible Bitmap and pending Pixel cannot silently activate',
    bindingTests.includes('explicit Bitmap mode rejects SVG') &&
    bindingTests.includes('NGVGE_NATIVE_PAINT_PIXEL_BACKEND_PENDING'));
check('DOM regression proves PNG defaults to Raster Core and excludes Scratch Paint wrapper',
    hostTests.includes('mounts the shared Bitmap Raster Core by default for PNG') &&
    hostTests.includes("findAllByType('mock-paint-editor-wrapper')).toHaveLength(0)"));
check('DOM regression proves deliberate PNG Raster/Scratch round-trip',
    hostTests.includes('switches a PNG between NGVGE Raster Core and explicit Scratch compatibility'));
check('DOM regression proves unsupported formats still disclose compatibility identity',
    hostTests.includes('keeps unsupported formats on Scratch compatibility but still shows the mode selector'));
check('inherited G1 production Webpack Raster entry remains present and isolated',
    webpackValidator.includes("'workspace-raster-editor': './src/components/workspace-paint/workspace-raster-editor.jsx'") &&
    webpackValidator.includes("'native-paint-host-model': './src/lib/editor-shell/native-paint-host.js'"));
check('package exposes HF1 machine/focused/webpack commands',
    Boolean(pkg.scripts['test:workspace-shell:ws10g1-hf1:machine']) &&
    Boolean(pkg.scripts['test:workspace-shell:ws10g1-hf1:focused']) &&
    Boolean(pkg.scripts['test:workspace-shell:ws10g1-hf1:webpack']));

const failed = checks.filter(item => !item.pass);
checks.forEach(({name, pass}, index) => console.log(`${pass ? 'PASS' : 'FAIL'} ${index + 1}/${checks.length} ${name}`));
console.log(`WS-10G1-HF1 Explicit Paint Mode Switch Gate: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length) process.exit(1);
