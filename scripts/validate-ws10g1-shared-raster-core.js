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
const editor = read('src/components/workspace-paint/workspace-raster-editor.jsx');
const backend = read('src/lib/paint-backends/canvas-raster-backend.js');
const transfer = read('src/lib/paint-backends/canvas-raster-transfer.js');
const ops = read('src/lib/paint-backends/mini-paint-derived-raster-ops.js');
const notice = read('docs/third-party/WS-10G1-MINIPAINT-NOTICE.md');
const runtime = read('src/lib/editor-shell/paint-tool-runtime.js');
const backendTests = read('test/unit/lib/paint-backends/canvas-raster-backend.test.js');
const transferTests = read('test/unit/lib/paint-backends/canvas-raster-transfer.test.js');
const opsTests = read('test/unit/lib/paint-backends/mini-paint-derived-raster-ops.test.js');
const hostTests = read('test/unit/components/native-paint-host.test.jsx');
const pkg = read('package.json');

check('PNG/JPG are admitted as canonical Bitmap mode', model.includes("const BITMAP_DATA_FORMATS = new Set(['png', 'jpg', 'jpeg'])") && model.includes('BITMAP_DATA_FORMATS.has(dataFormat)') && model.includes('NATIVE_PAINT_MODES.BITMAP'));
check('unsupported raster formats remain legacy compatibility', model.includes('NATIVE_PAINT_MODES.LEGACY_RASTER'));
check('Bitmap canonical Resource adoption uses existing Native Paint host authority', model.includes('resources.ensureCostumeResource(target, costumeIndex)'));
check('Native container mounts WorkspaceRasterEditor for Bitmap', host.includes('WorkspaceRasterEditor') && host.includes('mode="bitmap"'));
check('Bitmap shell routes Undo/Redo/Zoom through raster imperative surface', host.includes('rasterEditorRef.current.undo()') && host.includes('rasterEditorRef.current.redo()') && host.includes('rasterEditorRef.current.setZoom'));
check('Bitmap no longer uses Scratch Paint compatibility surface', host.includes('NATIVE_PAINT_MODES.BITMAP') && host.includes('backendLabel="Raster Core"'));
check('Raster editor stays behind PaintBackendContract', editor.includes('createPaintBackendBinding') && backend.includes('normalizePaintBackendTransfer'));
check('Raster editor writes only through Working Copy callback', editor.includes('onApplyEdit(createWorkingCopyEditFromCanvasRasterTransfer') && !editor.includes('vm.updateBitmap'));
check('Working Copy metadata is read through ref so edits do not remount backend', editor.includes('workingCopyRef.current') && !editor.includes('[onApplyEdit, reportError, syncState, workingCopy]'));
check('Raster backend supports G1 tool POC', ['brush', 'eraser', 'fill', 'eyedropper', 'hand', 'zoom'].every(tool => backend.includes(`'${tool}'`)));
check('Raster backend provides 25/50/100/200 zoom presets', backend.includes('Object.freeze([0.25, 0.5, 1, 2])'));
check('Raster workspace has stage guide separate from bitmap storage', backend.includes('const renderStageGuide = camera =>') && backend.includes("data-ngvge-raster-surface-role', 'offscreen-storage") && backend.includes("data-ngvge-raster-canvas-role', 'viewport-compositor"));
check('Raster presentation uses one compositor camera without document resolution mutation', backend.includes('displayContext.translate') && backend.includes('displayContext.scale(camera.zoom, camera.zoom)') && !backend.includes('setResolution')); 
check('Bitmap stage guide honors Scratch bitmapResolution', backend.includes('workspaceContext.stageWidth * stageScale') && backend.includes('workspaceContext.bitmapResolution'));
check('Raster Fit includes artwork and stage range', backend.includes('getFitBounds') && backend.includes('unionBounds(getStageBounds(), getArtworkBounds())') && backend.includes('calculateFitView')); 
check('Brush and Eraser use Canvas2D without upstream App shell', backend.includes("globalCompositeOperation = erasing ? 'destination-out' : 'source-over'") && !backend.includes('miniPaint.App'));
check('Fill uses controlled miniPaint-derived portable pixel operation', backend.includes('floodFillRaster') && ops.includes('stack.push'));
check('Eyedropper uses portable RGBA sampling', backend.includes('sampleRasterPixel') && ops.includes('sampleRasterPixel'));
check('miniPaint derived code is pinned to reviewed commit and MIT notice', ops.includes('a79733eb803fc97084ef0ee4faa96b031e69e1c0') && notice.includes('MIT'));
check('miniPaint App/State/Layer authority is not copied into portable raster ops', !ops.includes("from './../app.js'") && !ops.includes('app.State') && !ops.includes('Base_layers_class'));
check('Bitmap transfer is frozen AnimatedRasterDocument', transfer.includes('ANIMATED_RASTER_DOCUMENT_SCHEMA_ID') && transfer.includes("mode: 'bitmap'") && transfer.includes("colorMode: 'rgba'"));
check('Static Bitmap transfer is exactly one Layer × one Frame × one Cel', transfer.includes("name: 'Artwork'") && transfer.includes('durationMs: 100') && transfer.includes("kind: 'rgba-raster'"));
check('Raster export preserves Working Copy rotation center and bitmapResolution', transfer.includes('rotationCenterX') && transfer.includes('rotationCenterY') && transfer.includes('bitmapResolution'));
check('Raster backend export cannot replace NGVGE Resource/ArtDocument identity', backendTests.includes('preserves semantic identity') && backendTests.includes('document.documentId'));
check('permanent tests cover portable flood fill', opsTests.includes('does not cross a separator') && opsTests.includes('non-contiguous fill'));
check('permanent tests cover static Bitmap semantic transfer', transferTests.includes('Layer × Frame = Cel') && transferTests.includes('rotation metadata'));
check('permanent Native host DOM test proves Bitmap Raster Core is mounted', hostTests.includes('shared Bitmap Raster Core'));
check('Paint runtime reports integrated Bitmap raster core instead of legacy', runtime.includes("bitmap-raster-core-integrated") && runtime.includes('CANVAS_RASTER_BACKEND_ADAPTER_ID') && runtime.includes('CANVAS_RASTER_BACKEND_PACKAGE'));
check('G1 does not create a Pixel backend yet', !host.includes('WorkspacePixelEditor') && !backend.includes("mode !== 'pixel'"));
check('G1 package exposes focused, machine and production Webpack commands', pkg.includes('test:workspace-shell:ws10g1:machine') && pkg.includes('test:workspace-shell:ws10g1:focused') && pkg.includes('test:workspace-shell:ws10g1:webpack'));

const failed = checks.filter(item => !item.pass);
checks.forEach(({name, pass}, index) => console.log(`${pass ? 'PASS' : 'FAIL'} ${index + 1}/${checks.length} ${name}`));
console.log(`WS-10G1 Shared Raster Core / Bitmap POC Gate: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length) process.exit(1);
