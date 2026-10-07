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

const pkg = JSON.parse(read('node_modules/@svgedit/svgcanvas/package.json'));
const selected = read('node_modules/@svgedit/svgcanvas/core/selected-elem.js');
const events = read('node_modules/@svgedit/svgcanvas/core/event.js');
const paths = read('node_modules/@svgedit/svgcanvas/core/path-actions.js');
const pathMethod = read('node_modules/@svgedit/svgcanvas/core/path-method.js');
const paste = read('node_modules/@svgedit/svgcanvas/core/paste-elem.js');

check('real SVG-Edit package is installed', pkg.name === '@svgedit/svgcanvas');
check('professional tooling contract is pinned to SVG-Edit 7.4.2', pkg.version === '7.4.2');
check('core exposes copy selection', selected.includes('svgCanvas.copySelectedElements = copySelectedElements'));
check('core exposes clone/duplicate selection', selected.includes('svgCanvas.cloneSelectedElements = cloneSelectedElements'));
check('core exposes delete selection', selected.includes('svgCanvas.deleteSelectedElements = deleteSelectedElements'));
check('core exposes group selection', selected.includes('svgCanvas.groupSelectedElements = groupSelectedElements'));
check('core exposes ungroup selection', selected.includes('svgCanvas.ungroupSelectedElement = ungroupSelectedElement'));
check('core exposes nudge/move selection', selected.includes('svgCanvas.moveSelectedElements = moveSelectedElements'));
check('core exposes forward/backward arrange', selected.includes('svgCanvas.moveUpDownSelected = moveUpDownSelected'));
check('core exposes front arrange', selected.includes('svgCanvas.moveToTopSelectedElement = moveToTopSelectedElem'));
check('core exposes back arrange', selected.includes('svgCanvas.moveToBottomSelectedElement = moveToBottomSelectedElem'));
check('paste is a real SvgCanvas operation', paste.includes('export const pasteElementsMethod'));
check('empty clipboard paste exits without mutation', paste.includes("if (!Array.isArray(clipb) || !clipb.length) return"));
check('successful paste emits changed', paste.includes("svgCanvas.call('changed', pasted)"));
check('Shift-click extends selection', events.includes("if (!evt.shiftKey)") && events.includes('svgCanvas.addToSelection([mouseTarget])'));
check('empty-canvas drag enters multiselect marquee mode', events.includes("svgCanvas.setCurrentMode('multiselect')"));
check('marquee resolves intersection selection', events.includes('const newList = svgCanvas.getIntersectionList()'));
check('Alt-drag duplicates through SvgCanvas clone operation', events.includes('if (evt.altKey)') && events.includes('svgCanvas.cloneSelectedElements(0, 0)'));
check('selection resize has a native transform mode', events.includes("case 'resize':"));
check('selection rotate has a native transform mode', events.includes("case 'rotate':"));
check('Shift constrains native selection scaling', events.includes("const maintainAspectRatio = (selected.tagName !== 'image' && evt.shiftKey)"));
check('Direct Selection enters native pathedit mode', paths.includes('toEditMode (element)') && paths.includes("svgCanvas.setCurrentMode('pathedit')"));
check('Bezier path editing exposes node duplication/add foundation', paths.includes('clonePathNode ()'));
check('Bezier path editing exposes node deletion', paths.includes('deletePathNode ()'));
check('Bezier path editing exposes segment conversion', paths.includes('setSegType (v)'));
check('Bezier path editing exposes open/close subpath', paths.includes('opencloseSubPath ()'));
check('Bezier path editing exposes linked control points', paths.includes('linkControlPoints (linkPoints)'));
check('segment conversion toggles line/curve when no explicit type is supplied',
    pathMethod.includes("newType = (oldType === 6) ? 4 : 6"));

checks.forEach(({name, pass}, index) => console.log(`${pass ? 'PASS' : 'FAIL'} ${index + 1}/${checks.length} ${name}`));
const passed = checks.filter(item => item.pass).length;
console.log(`WS-10F2C SVG-Edit Professional Core Contract: ${passed}/${checks.length} PASS`);
if (passed !== checks.length) process.exit(1);
