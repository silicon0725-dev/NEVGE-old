'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const backend = read('src/lib/paint-backends/svg-edit-vector-backend.js');
const css = read('src/components/workspace-paint/workspace-paint.css');
const test = read('test/unit/lib/paint-backends/svg-edit-vector-backend.test.js');

// HF3 froze the semantic requirement that an embedded SVG-Edit canvas is
// responsive, fits its authored SVG and provides a standalone currentColor
// baseline without mutating the authored document. It intentionally does not
// freeze HF3's original outer-svgroot viewBox implementation: SVG-Edit's own
// updateCanvas() is allowed (and preferred) when later stages need its selector
// and content presentation layers to share one coordinate system.
const checks = [
    ['presentation helper exists', /const syncPresentationViewport = (?:requested|\(.*?\)) =>/.test(backend)],
    ['presentation uses SVG-Edit zoom API', backend.includes('canvas.setZoom(requestedZoom)') || backend.includes('canvas.setZoom(fitZoom)')],
    ['presentation uses SVG-Edit canvas geometry API', backend.includes('canvas.updateCanvas(viewport.width, viewport.height)')],
    ['obsolete root viewBox shim is removed', backend.includes("root.removeAttribute('viewBox')")],
    ['obsolete root preserveAspectRatio shim is removed', backend.includes("root.removeAttribute('preserveAspectRatio')")],
    ['standalone currentColor is isolated to black', backend.includes("root.style.color = '#000000'")],
    ['load refreshes presentation viewport', /load \(transfer\)[\s\S]*?syncPresentationViewport\(\);[\s\S]*?loadedTransfer/.test(backend)],
    ['resize refreshes presentation viewport', /resize \(size = \{\}\)[\s\S]*?syncPresentationViewport\(size\)/.test(backend)],
    ['document resolution mutation remains forbidden', !backend.includes('canvas.setResolution(') && !backend.includes('canvas.setCurrentZoom(')],
    ['vector canvas fills backend surface', /\.vectorCanvas > svg \{[\s\S]*?width: 100%;[\s\S]*?height: 100%;/.test(css)],
    ['responsive presentation regression is covered', test.includes('fits through SVG-Edit updateCanvas so document and selector layers share one coordinate system')],
    ['presentation/source isolation is asserted', test.includes("expect(binding.exportTransfer().contentEntries[0].content.text).toBe(source)")]
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
    console.error('WS-10F HF3 SVG-Edit vector presentation gate: FAIL');
    failed.forEach(([name]) => console.error(`- ${name}`));
    process.exit(1);
}

console.log('WS-10F HF3 SVG-Edit vector presentation gate: PASS');
console.log(JSON.stringify({checks: checks.length, failed: 0}, null, 2));
