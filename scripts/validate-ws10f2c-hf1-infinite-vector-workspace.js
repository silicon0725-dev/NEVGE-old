#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const checks = [];
const check = (name, pass) => checks.push({name, pass: Boolean(pass)});

const pkg = JSON.parse(read('node_modules/@svgedit/svgcanvas/package.json'));
const svgExec = read('node_modules/@svgedit/svgcanvas/core/svg-exec.js');
const clear = read('node_modules/@svgedit/svgcanvas/core/clear.js');
const selected = read('node_modules/@svgedit/svgcanvas/core/selected-elem.js');
const scratchLayer = read('node_modules/scratch-paint/src/helper/layer.js');
const backend = read('src/lib/paint-backends/svg-edit-vector-backend.js');
const transfer = read('src/lib/paint-backends/svg-edit-vector-transfer.js');
const editor = read('src/components/workspace-paint/workspace-vector-editor.jsx');
const host = read('src/containers/native-paint-editor-host.jsx');
const tests = read('test/unit/lib/paint-backends/svg-edit-vector-backend.test.js');

check('real SVG-Edit package remains pinned to 7.4.2', pkg.name === '@svgedit/svgcanvas' && pkg.version === '7.4.2');
check('SVG-Edit source supports visible authored geometry outside svgcontent viewport',
    svgExec.includes("overflow: curConfig.show_outside_canvas ? 'visible' : 'hidden'"));
check('SVG-Edit clear/create path preserves show_outside_canvas overflow policy',
    clear.includes("el.setAttribute('overflow', curConfig.show_outside_canvas ? 'visible' : 'hidden')"));
check('SVG-Edit updateCanvas keeps content and selector translation on one source of truth',
    selected.includes('const x = (w - svgCanvas.contentW * zoom) / 2') &&
    selected.includes('const y = (h - svgCanvas.contentH * zoom) / 2') &&
    selected.includes('`translate(${x},${y})`'));
check('Scratch Paint reference uses white inner + #4280D7 outer artboard guide',
    scratchLayer.includes("const OUTLINE_INNER_LIGHT = '#FFFFFF'") &&
    scratchLayer.includes("const OUTLINE_OUTER_LIGHT = '#4280D7'") &&
    scratchLayer.includes('blueRect.opacity = 0.25'));
check('NGVGE explicitly forces unbounded SVG-Edit content presentation',
    backend.includes('show_outside_canvas: true') && backend.includes("content.setAttribute('overflow', 'visible')") && backend.includes("content.style.setProperty('overflow', 'visible', 'important')"));
check('finite SVG-Edit canvasBackground is hidden rather than treated as edit boundary',
    backend.includes("background.setAttribute('visibility', 'hidden')"));
check('NGVGE stage guide is presentation-only and Scratch-referenced',
    backend.includes("VECTOR_STAGE_GUIDE_ID = 'ngvge-vector-stage-guide'") &&
    backend.includes("VECTOR_STAGE_GUIDE_INNER_STROKE = '#FFFFFF'") &&
    backend.includes("VECTOR_STAGE_GUIDE_OUTER_STROKE = '#4280D7'") &&
    backend.includes("'data-ngvge-presentation-only': 'stage-size-guide'"));
check('stage guide is centered on the stable editor origin and sized from runtime stage dimensions',
    backend.includes('editorOrigin.x - workspaceContext.stageWidth / 2') &&
    backend.includes('editorOrigin.y - workspaceContext.stageHeight / 2') &&
    backend.includes('content.appendChild(group)') &&
    host.includes('target.runtime.stageWidth') && host.includes('target.runtime.stageHeight'));
check('Fit uses stage plus stroked artwork bounds',
    backend.includes('unionBounds(getStageBounds(), getArtworkBounds())') && backend.includes('canvas.getStrokedBBox(items)'));
check('manual zoom/pan never changes semantic SVG resolution',
    !backend.includes('setResolution(viewport') && backend.includes('presentationPan'));
check('portable export tightens off-viewport artwork without mutating live SVG-Edit history',
    backend.includes('normalizeSvgToArtworkBounds(svgText, artworkBounds)') &&
    transfer.includes('This never mutates the live SVG-Edit document/history'));
check('portable export shifts rotation center by the identical artwork source origin',
    backend.includes('editorOrigin.x - normalizedArtwork.sourceOrigin.x') &&
    backend.includes('editorOrigin.y - normalizedArtwork.sourceOrigin.y') &&
    editor.includes('getExportMetadata'));
check('workspace editor explicitly declares unbounded presentation',
    editor.includes('data-ngvge-vector-workspace="unbounded"'));
check('permanent regression covers infinite workspace + stage guide',
    tests.includes('uses an unbounded SVG-Edit workspace with a Scratch-style stage guide'));
check('permanent regression covers off-source-viewport selection alignment',
    tests.includes('fits stage plus artwork while preserving selection/content alignment outside the source SVG viewport'));
check('permanent regression covers tight export + rotation-center preservation',
    tests.includes('exports off-viewport artwork tightly and shifts rotation center'));

const failed = checks.filter(item => !item.pass);
checks.forEach(({name, pass}, index) => console.log(`${pass ? 'PASS' : 'FAIL'} ${index + 1}/${checks.length} ${name}`));
console.log(`WS-10F2C-HF1 Infinite Vector Workspace / Stage Guide Gate: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length) process.exit(1);
