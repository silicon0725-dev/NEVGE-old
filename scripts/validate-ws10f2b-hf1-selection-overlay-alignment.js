'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const backend = read('src/lib/paint-backends/svg-edit-vector-backend.js');
const component = read('src/components/workspace-paint/workspace-vector-editor.jsx');
const packageGate = read('scripts/validate-ws10f2b-hf1-svg-edit-dom-transform-contract.js');
const test = read('test/unit/lib/paint-backends/svg-edit-vector-backend.test.js');
const doc = read('docs/architecture/workspace/WS-10F2B-HF1-SELECTION-OVERLAY-ZOOM-TRANSFORM-ALIGNMENT.md');

const checks = [
    ['fit zoom has an explicit host-owned padding constant', backend.includes('const VECTOR_FIT_PADDING = 0.92')],
    ['viewport fit measures the real backend surface', backend.includes('getMeasuredViewport') && backend.includes('getBoundingClientRect')],
    ['SVG-Edit setZoom is the zoom source of truth', backend.includes('canvas.setZoom(requestedZoom)')],
    ['SVG-Edit updateCanvas is the geometry source of truth', backend.includes('canvas.updateCanvas(viewport.width, viewport.height)')],
    ['selector geometry is refreshed after viewport fit', backend.includes('refreshSelectionGeometry();')],
    ['selected SVG-Edit selectors are resized after zoom', /requestSelector\(element\)[\s\S]*?selector\.resize\(\)/.test(backend)],
    ['path node overlays receive zoom refresh', backend.includes('canvas.pathActions.zoomChange()')],
    ['legacy root viewBox scaling is actively removed', backend.includes("root.removeAttribute('viewBox')")],
    ['legacy root preserveAspectRatio scaling is actively removed', backend.includes("root.removeAttribute('preserveAspectRatio')")],
    ['document resolution remains outside host resize authority', !backend.includes('canvas.setResolution(') && !backend.includes('canvas.setCurrentZoom(')],
    ['host resize delegates to the presentation synchronizer', /resize \(size = \{\}\)[\s\S]*?syncPresentationViewport\(size\)/.test(backend)],
    ['manual zoom and Fit are separate presentation modes', backend.includes("FIT: 'fit'") && backend.includes("MANUAL: 'manual'") && backend.includes('fitToView ()')],
    ['permanent zoom presets are 25/50/100/200 percent', backend.includes('Object.freeze([0.25, 0.5, 1, 2])')],
    ['manual zoom survives host resize instead of forcing fit', backend.includes('zoomMode === VECTOR_ZOOM_MODES.MANUAL ? manualZoom : fitZoom')],
    ['React host observes real vector viewport size', component.includes('new ResizeObserver(') && component.includes('bindingRef.current.resize({width, height})')],
    ['ResizeObserver cleanup is explicit', component.includes('observer.disconnect()')],
    ['selection/content shared-coordinate regression is covered', test.includes('document and selector layers share one coordinate system')],
    ['selector refresh regression is covered', test.includes('refreshes selector geometry after fit zoom instead of scaling an independent overlay')],
    ['presentation-only resize regression is covered', test.includes('resize remains presentation-only and never writes container size or document resolution')],
    ['25/50/100/200 selector alignment matrix is covered', test.includes("keeps selected object and selector aligned at manual zoom %s") && test.includes("['25%', 0.25]") && test.includes("['200%', 2]")],
    ['Fit-after-manual zoom regression is covered', test.includes('Fit returns to shared SVG-Edit geometry after every permanent manual zoom preset')],
    ['manual zoom host-resize regression is covered', test.includes('host resize preserves manual zoom and only recomputes viewport centering')],
    ['real installed SVG-Edit transform contract has a source gate', packageGate.includes('real SVG-Edit DOM/transform contract gate') && packageGate.includes("pkg.version === '7.4.2'")],
    ['architecture record freezes shared viewport transform', doc.includes('shared SVG-Edit viewport transform')],
    ['architecture record forbids independent selector scaling', doc.includes('MUST NOT independently scale')]
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
    console.error('WS-10F2B HF1 selection overlay alignment gate: FAIL');
    failed.forEach(([name]) => console.error(`- ${name}`));
    process.exit(1);
}

console.log('WS-10F2B HF1 selection overlay alignment gate: PASS');
console.log(JSON.stringify({checks: checks.length, failed: 0}, null, 2));
