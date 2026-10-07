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
const eventSource = read('node_modules/@svgedit/svgcanvas/core/event.js');
const selected = read('node_modules/@svgedit/svgcanvas/core/selected-elem.js');
const scratchCanvas = read('node_modules/scratch-paint/src/containers/paper-canvas.jsx');
const scratchLayer = read('node_modules/scratch-paint/src/helper/layer.js');
const scratchView = read('node_modules/scratch-paint/src/helper/view.js');
const scratchExport = read('node_modules/scratch-paint/src/hocs/update-image-hoc.jsx');
const backend = read('src/lib/paint-backends/svg-edit-vector-backend.js');
const tests = read('test/unit/lib/paint-backends/svg-edit-vector-backend.test.js');

check('real SVG-Edit package remains pinned to 7.4.2', pkg.name === '@svgedit/svgcanvas' && pkg.version === '7.4.2');
check('SVG-Edit show_outside_canvas controls nested svg overflow presentation',
    svgExec.includes("overflow: curConfig.show_outside_canvas ? 'visible' : 'hidden'"));
check('SVG-Edit hit testing derives coordinates from the live DOM screen CTM',
    eventSource.includes('getScreenCTM') && eventSource.includes('inverse()'));
check('SVG-Edit updateCanvas owns content and selector viewport translation together',
    selected.includes('const x = (w - svgCanvas.contentW * zoom) / 2') &&
    selected.includes('const y = (h - svgCanvas.contentH * zoom) / 2') &&
    selected.includes('`translate(${x},${y})`'));

check('Scratch reference rebases imported SVG rotation center to a fixed editor center',
    scratchCanvas.includes('rotationPoint = new paper.Point(rotationCenterX, rotationCenterY)') &&
    scratchCanvas.includes('item.translate(CENTER.subtract(rotationPoint.multiply(2)))'));
check('Scratch reference keeps browser canvas/view size synchronized for pointer alignment',
    scratchCanvas.includes('paper.view.setViewSize(elemSize)'));
check('Scratch reference separates guide layers from painting content and removes guides for export',
    scratchLayer.includes('const hideGuideLayers = function') && scratchExport.includes('hideGuideLayers(true'));
check('Scratch reference exports content-tight and derives rotation center from the fixed editor origin',
    scratchExport.includes("bounds: 'content'") &&
    scratchExport.includes('translate(-bounds.x, -bounds.y)') &&
    scratchExport.includes('(SVG_ART_BOARD_WIDTH / 2) - bounds.x'));
check('Scratch pan/zoom operates on the view rather than resizing authored content',
    scratchView.includes('paper.project.view.scrollBy') && scratchView.includes('zoomOnFixedPoint'));

check('NGVGE uses a stable editorOrigin rather than stage-guide coordinates as a second viewport authority',
    backend.includes('let editorOrigin = {x: 0, y: 0}') &&
    backend.includes('const rebaseArtworkToEditorOrigin = () =>'));
check('NGVGE rebases authored roots through public SVG-Edit selection/move operations without history authority',
    backend.includes('canvas.addToSelection(items, false)') &&
    backend.includes('items.map(() => dx)') && backend.includes('items.map(() => dy)') &&
    backend.includes('false\n        );'));
check('stage guide lives inside svgcontent and therefore inherits the exact artwork view transform',
    backend.includes('content.appendChild(group)') &&
    backend.includes('updateStageGuide(content)') &&
    !backend.includes('updateStageGuide(root, x, y, zoom)'));
check('stage guide coordinates remain document-space instead of being multiplied by zoom',
    backend.includes("rect.setAttribute('x', bounds.x)") &&
    backend.includes("rect.setAttribute('width', bounds.width)") &&
    !backend.includes('bounds.x * zoom'));
check('live nested svg overflow defeats authored inline overflow:hidden while preserving Resource serialization',
    backend.includes("content.style.setProperty('overflow', 'visible', 'important')") &&
    backend.includes('restoreAuthoredOverflowForSerialization(content)'));
check('stage guide is detached from authored SVG serialization and restored afterward',
    backend.includes('const detachedGuide = detachStageGuide()') &&
    backend.includes('restoreStageGuide(detachedGuide)'));
check('artwork bounds exclude presentation guide and are computed from authored root items',
    backend.includes('const getAuthoredRootItems = () =>') &&
    backend.includes('canvas.getStrokedBBox(items)'));
check('Fit remains union(stage guide, actual artwork), not finite source SVG dimensions',
    backend.includes('unionBounds(getStageBounds(), getArtworkBounds())'));
check('export rotation center is reconstructed from editor origin and tight source origin',
    backend.includes('editorOrigin.x - normalizedArtwork.sourceOrigin.x') &&
    backend.includes('editorOrigin.y - normalizedArtwork.sourceOrigin.y'));
check('host resize still cannot become document semantic resize', !backend.includes('setResolution(viewport'));

check('permanent regression covers authored inline overflow hidden', tests.includes('overflow:hidden'));
check('permanent regression covers editor-origin rebase and selector alignment',
    tests.includes('rebases the costume rotation center to one Scratch-style editor origin shared by art, guide and selection'));
check('permanent regression covers guide-in-content without independent transform',
    tests.includes("expect(createdCanvas.stageGuide.parentNode).toBe(createdCanvas.content)") &&
    tests.includes("expect(createdCanvas.stageGuide.getAttribute('transform')).toBeNull()"));

const failed = checks.filter(item => !item.pass);
checks.forEach(({name, pass}, index) => console.log(`${pass ? 'PASS' : 'FAIL'} ${index + 1}/${checks.length} ${name}`));
console.log(`WS-10F2C-HF2 Scratch-Style Unbounded Viewport Alignment Gate: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length) process.exit(1);
