#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const checks = [];
const check = (name, pass) => checks.push({name, pass: Boolean(pass)});

const backend = read('src/lib/paint-backends/canvas-raster-backend.js');
const editor = read('src/components/workspace-paint/workspace-raster-editor.jsx');
const backendTests = read('test/unit/lib/paint-backends/canvas-raster-backend.test.js');
const geometryTests = read('test/unit/components/workspace-raster-geometry.test.js');
const pkg = read('package.json');

check(
    'Imported PNG dimensions are storage seed only, not world bounds authority',
    backend.includes('let surfaceOrigin = {x: 0, y: 0}') &&
    backend.includes('const getSurfaceBounds = () =>') &&
    backend.includes('left: surfaceOrigin.x')
);
check(
    'Raster world surface expands in chunks when authored brush content crosses the imported PNG bounds',
    backend.includes('RASTER_SURFACE_GROWTH_CHUNK') &&
    backend.includes('const ensureSurfaceContainsBounds = bounds =>') &&
    backend.includes("DOM.createElement('canvas')") &&
    backend.includes('replacementContext.drawImage(surfaceCanvas, leftGrowth, topGrowth)')
);
check(
    'World expansion moves storage origin rather than stage/camera authority',
    backend.includes('surfaceOrigin = {x: current.left - leftGrowth, y: current.top - topGrowth}') &&
    !backend.includes('workspaceContext.rotationCenterX +=') &&
    !backend.includes('workspaceContext.rotationCenterY +=')
);
check(
    'Brush uses unbounded document points and expands before converting to storage pixels',
    backend.includes("if (activeTool === 'brush') ensureSurfaceContainsBounds(getStrokeBounds(documentPoint))") &&
    backend.includes('documentToPixelUnchecked(documentPoint)')
);
check(
    'Brush drag expansion covers the full world-space segment, not only the current pointer point',
    backend.includes('ensureSurfaceContainsBounds(getStrokeBounds(lastDocumentPoint, documentPoint))')
);
check(
    'Fill and eyedropper remain finite authored-content operations instead of attempting an infinite flood',
    backend.includes("if (activeTool === 'fill')") &&
    backend.includes("if (activeTool === 'eyedropper')") &&
    backend.includes('const point = activeTool === \'brush\' || activeTool === \'eraser\' ?')
);
check(
    'History snapshots preserve world-surface origin as well as RGBA bytes',
    backend.includes('origin: {...surfaceOrigin}') &&
    backend.includes('surfaceOrigin = snapshot.origin ? {...snapshot.origin}')
);
check(
    'Export dimensions follow the expanded authored raster storage',
    backend.includes('exported.document.canvas.width = surfaceCanvas.width') &&
    backend.includes('exported.document.canvas.height = surfaceCanvas.height')
);
check(
    'Export pivot derives from the expanded world-surface origin',
    backend.includes('const getSurfaceRotationCenter = () =>') &&
    backend.includes('rotationCenter: Object.freeze(getSurfaceRotationCenter())') &&
    editor.includes('resolveRasterExportGeometry')
);
check(
    'Permanent regression draws beyond the imported PNG and proves storage expansion',
    backendTests.includes('expands authored raster storage beyond the imported PNG') &&
    backendTests.includes('expanded.surface.width).toBeGreaterThan(32)') &&
    backendTests.includes('expanded.surface.bounds.left).toBeLessThanOrEqual')
);
check(
    'Permanent regression proves expansion does not move the compositor camera',
    backendTests.includes('const cameraBefore = adapter.controls.getZoomState()') &&
    backendTests.includes('expect(adapter.controls.getZoomState()).toEqual(cameraBefore)')
);
check(
    'Permanent regression proves undo restores storage dimensions and world origin',
    backendTests.includes('expect(binding.undo()).toBe(true)') &&
    backendTests.includes("expect(restored.surface.origin).toEqual({x: -16, y: -8})")
);
check(
    'Permanent regression proves expanded pivot wins during Working Copy export',
    geometryTests.includes('exports the expanded world-surface pivot') &&
    geometryTests.includes('rotationCenterX: 384') &&
    geometryTests.includes('rotationCenterY: 256')
);
check(
    'HF4 does not copy Scratch finite workspace clamps into NGVGE Raster Core',
    !backend.includes('MAX_WORKSPACE_BOUNDS') &&
    !backend.includes('getActionBounds') &&
    !backend.includes('clampViewBounds')
);
check(
    'HF4 has dedicated machine/focused/production commands',
    pkg.includes('test:workspace-shell:ws10g1-hf4:machine') &&
    pkg.includes('test:workspace-shell:ws10g1-hf4:focused') &&
    pkg.includes('test:workspace-shell:ws10g1-hf4:webpack')
);

const failed = checks.filter(item => !item.pass);
checks.forEach(({name, pass}, index) => {
    console.log(`${pass ? 'PASS' : 'FAIL'} ${index + 1}/${checks.length} ${name}`);
});
console.log(`WS-10G1-HF4 Unbounded Raster World Surface Gate: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length) process.exit(1);
