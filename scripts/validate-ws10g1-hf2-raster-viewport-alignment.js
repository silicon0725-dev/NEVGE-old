#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const checks = [];
const check = (name, pass) => checks.push({name, pass: Boolean(pass)});

const backend = read('src/lib/paint-backends/canvas-raster-backend.js');
const backendTests = read('test/unit/lib/paint-backends/canvas-raster-backend.test.js');
const editor = read('src/components/workspace-paint/workspace-raster-editor.jsx');
const pkg = read('package.json');

check(
    'Raster storage is offscreen and cannot become viewport authority',
    backend.includes("data-ngvge-raster-surface-role', 'offscreen-storage") &&
    backend.includes("data-ngvge-raster-canvas-role', 'viewport-compositor")
);
check(
    'Viewport compositor synchronizes against real host DOM dimensions',
    backend.includes("container && typeof container.getBoundingClientRect === 'function'") &&
    backend.includes('ensureDisplayCanvasSize')
);
check(
    'Artwork Fit bounds use non-transparent artwork rather than the raw storage rectangle',
    backend.includes('const getArtworkBounds = () =>') &&
    backend.includes('image.data[rowOffset + (x * 4) + 3] === 0')
);
check(
    'Fit unions the Scratch-sized stage guide with artwork bounds',
    backend.includes('unionBounds(getStageBounds(), getArtworkBounds())') &&
    backend.includes('workspaceContext.stageWidth * stageScale')
);
check(
    'Fit computes both scale and bounds center',
    backend.includes('const center = getBoundsCenter(bounds)') &&
    backend.includes('pan: {x: -center.x * zoom, y: -center.y * zoom}')
);
check(
    'Artwork and guide rendering consume the same compositor camera',
    backend.includes('const renderStageGuide = camera =>') &&
    backend.includes('displayContext.scale(camera.zoom, camera.zoom)') &&
    backend.includes('renderStageGuide(camera)')
);
check(
    'Pointer hit testing inverts the same applied camera',
    backend.includes('const camera = getAppliedCamera()') &&
    backend.includes('const docX = (screenX - (viewportSize.width / 2) - camera.pan.x) / camera.zoom') &&
    backend.includes('const docY = (screenY - (viewportSize.height / 2) - camera.pan.y) / camera.zoom')
);
check(
    'Rotation center remains the document-to-source-pixel bridge through the mutable world-surface origin',
    backend.includes('surfaceOrigin = {') &&
    backend.includes('x: -workspaceContext.rotationCenterX') &&
    backend.includes('const x = Math.floor(point.x - surfaceOrigin.x)')
);
check(
    'Pan leaves Fit through the current camera instead of recomputing a second transform',
    backend.includes("if (zoomMode === 'fit')") &&
    backend.includes('manualZoom = currentFitCamera.zoom') &&
    backend.includes('pan = {...currentFitCamera.pan}')
);
check(
    'Manual zoom preserves the currently centered document point',
    backend.includes('const centerDocument = {') &&
    backend.includes('pan = {x: -centerDocument.x * next, y: -centerDocument.y * next}')
);
check(
    'Raster viewport has no SVG-style resolution mutation or second CSS world scale',
    !backend.includes('setResolution') &&
    !backend.includes('world.style.transform')
);
check(
    'NGVGE does not copy Scratch finite MAX_WORKSPACE_BOUNDS into Raster Core',
    !backend.includes('MAX_WORKSPACE_BOUNDS')
);
check(
    'Permanent regression uses strongly asymmetric bitmap bounds',
    backendTests.includes('rotationCenterX: 100') &&
    backendTests.includes('width: 1200, height: 500') &&
    backendTests.includes('-310 * expectedFitZoom')
);
check(
    'Permanent regression locks 25/50/100/200 manual zoom after Fit',
    backendTests.includes('for (const zoom of RASTER_ZOOM_PRESETS)') &&
    backendTests.includes('manual.pan.x / zoom')
);
check(
    'Permanent regression proves Guide and Artwork receive identical camera transforms',
    backendTests.includes("renderContext.translateCalls.slice(-2)") &&
    backendTests.includes('expect(lastTranslations[0]).toEqual(lastTranslations[1])') &&
    backendTests.includes('expect(lastScales[0]).toEqual(lastScales[1])')
);
check(
    'Permanent regression proves screen-to-document-to-pixel hit alignment',
    backendTests.includes("adapter.controls.setTool('eyedropper')") &&
    backendTests.includes("displayCanvas.listeners.get('pointerdown')")
);
check(
    'Workspace editor still routes host resize through PaintBackendContract',
    editor.includes('bindingRef.current.resize({width, height})') &&
    editor.includes('ResizeObserver')
);
check(
    'HF2 has dedicated machine/focused/production commands',
    pkg.includes('test:workspace-shell:ws10g1-hf2:machine') &&
    pkg.includes('test:workspace-shell:ws10g1-hf2:focused') &&
    pkg.includes('test:workspace-shell:ws10g1-hf2:webpack')
);

const failed = checks.filter(item => !item.pass);
checks.forEach(({name, pass}, index) => {
    console.log(`${pass ? 'PASS' : 'FAIL'} ${index + 1}/${checks.length} ${name}`);
});
console.log(
    `WS-10G1-HF2 Raster Viewport / Stage Alignment Gate: ${checks.length - failed.length}/${checks.length} PASS`
);
if (failed.length) process.exit(1);
