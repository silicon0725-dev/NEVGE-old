'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkgRoot = path.join(root, 'node_modules', '@svgedit', 'svgcanvas');
const read = rel => fs.readFileSync(path.join(pkgRoot, rel), 'utf8');

const pkg = JSON.parse(read('package.json'));
const selectedElem = read('core/selected-elem.js');
const select = read('core/select.js');
const events = read('core/event.js');

const checks = [
    ['real package identity is @svgedit/svgcanvas', pkg.name === '@svgedit/svgcanvas'],
    ['real package version remains audited 7.4.2', pkg.version === '7.4.2'],
    ['updateCanvas obtains SVG-Edit zoom', /const updateCanvas = \(w, h\) => \{[\s\S]*?const zoom = svgCanvas\.getZoom\(\)/.test(selectedElem)],
    ['updateCanvas centers authored content using document dimensions times zoom', selectedElem.includes('const x = (w - svgCanvas.contentW * zoom) / 2') && selectedElem.includes('const y = (h - svgCanvas.contentH * zoom) / 2')],
    ['svgcontent presentation width and height are document dimensions times zoom', selectedElem.includes('width: svgCanvas.contentW * zoom') && selectedElem.includes('height: svgCanvas.contentH * zoom')],
    ['svgcontent keeps document-space viewBox while presentation size carries zoom', selectedElem.includes('viewBox: `0 0 ${svgCanvas.contentW} ${svgCanvas.contentH}`')],
    ['selectorParentGroup receives the exact updateCanvas centering translation', selectedElem.includes("svgCanvas.selectorManager.selectorParentGroup.setAttribute(\n    'transform',\n    `translate(${x},${y})`\n  )")],
    ['selectorParentGroup is a sibling attached directly to svgroot', select.includes('svgCanvas.getSvgRoot().append(this.selectorParentGroup)')],
    ['selection bbox coordinates are explicitly multiplied by SVG-Edit zoom', select.includes('transformBox(l * zoom, t * zoom, w * zoom, h * zoom, m)')],
    ['selection transform translations are explicitly multiplied by SVG-Edit zoom', select.includes('m.e *= zoom') && select.includes('m.f *= zoom')],
    ['selection offset/grip geometry also follows SVG-Edit zoom', select.includes('offset *= zoom')],
    ['rubber-band selection lives inside selectorParentGroup', select.includes('this.selectorParentGroup.append(this.rubberBandBox)')],
    ['hit testing derives root CTM from svgcontent child rather than NGVGE outer scaling', events.includes("const svgContent = $id('svgcontent')") && events.includes('const screenCTM = rootGroup?.getScreenCTM?.()')],
    ['hit testing multiplies transformed pointer coordinates by the same SVG-Edit zoom', events.includes('const mouseX = pt.x * zoom') && events.includes('const mouseY = pt.y * zoom')]
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
    console.error('WS-10F2B HF1 real SVG-Edit DOM/transform contract gate: FAIL');
    failed.forEach(([name]) => console.error(`- ${name}`));
    process.exit(1);
}

console.log('WS-10F2B HF1 real SVG-Edit DOM/transform contract gate: PASS');
console.log(JSON.stringify({package: `${pkg.name}@${pkg.version}`, checks: checks.length, failed: 0}, null, 2));
