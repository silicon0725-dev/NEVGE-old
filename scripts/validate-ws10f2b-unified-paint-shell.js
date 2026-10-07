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

const contract = read('src/lib/editor-shell/native-paint-shell.js');
const shell = read('src/components/native-paint/native-paint-shell.jsx');
const shellCss = read('src/components/native-paint/native-paint-shell.css');
const host = read('src/containers/native-paint-editor-host.jsx');
const vector = read('src/components/workspace-paint/workspace-vector-editor.jsx');
const vectorCss = read('src/components/workspace-paint/workspace-paint.css');
const shellTests = read('test/unit/lib/editor-shell/native-paint-shell.test.js');
const shellDomTests = read('test/unit/components/native-paint-shell.test.jsx');
const hostDomTests = read('test/unit/components/native-paint-host.test.jsx');
const architecture = read('docs/architecture/workspace/WS-10F2B-UNIFIED-PAINT-SHELL.md');
const matrix = read('docs/architecture/workspace/WS-10F2B-paint-shell-slot-matrix.csv');

check('stable unified shell identity', contract.includes("ngvge.native-paint-shell@1"));
check('shell schema remains versioned', contract.includes('NATIVE_PAINT_SHELL_SCHEMA_VERSION = 1'));
check('context toolbar slot frozen', contract.includes("CONTEXT_TOOLBAR: 'context-toolbar'"));
check('tool rail slot frozen', contract.includes("TOOL_RAIL: 'tool-rail'"));
check('canvas chrome slot frozen', contract.includes("CANVAS_CHROME: 'canvas-chrome'"));
check('panel rail slot frozen', contract.includes("PANEL_RAIL: 'panel-rail'"));
check('status bar slot frozen', contract.includes("STATUS_BAR: 'status-bar'"));
check('shell contract owns no project/resource/transaction authority',
    contract.includes('project: false') && contract.includes('resource: false') && contract.includes('transaction: false'));
check('shell contract owns no persistence/backend identity',
    contract.includes('persistence: false') && contract.includes('backendIdentity: false'));
check('native shell renders stable shell id', shell.includes('data-ngvge-native-paint-shell-id={NATIVE_PAINT_SHELL_ID}'));
check('native shell renders context/tool/canvas/panel/status slots',
    ['CONTEXT_TOOLBAR', 'TOOL_RAIL', 'CANVAS_CHROME', 'PANEL_RAIL', 'STATUS_BAR']
        .every(slot => shell.includes(`NATIVE_PAINT_SHELL_SLOTS.${slot}`)));
check('vector native host consumes unified shell', host.includes('<NativePaintShell') && host.includes('mode="vector"'));
check('legacy raster remains explicit compatibility passthrough',
    host.includes('mode="legacy-raster"') && host.includes('compatibility') && host.includes('<PaintEditorWrapper'));
check('native vector editor disables backend-owned toolbar', host.includes('showToolbar={false}'));
check('vector editor still keeps internal toolbar for compatibility presentation',
    vector.includes('showToolbar ?') && vector.includes('showToolbar: true'));
check('vector backend exposes bounded presentation controls through ref',
    vector.includes('React.useImperativeHandle') && vector.includes('setTool: chooseTool') && vector.includes("undo: () => runHistory('undo')"));
check('native shell owns vector tool selection', host.includes('onSelectTool={handleSelectTool}') && host.includes('tools={VECTOR_PAINT_TOOLS}'));
check('native shell owns undo/redo chrome', host.includes('onUndo={handleUndo}') && host.includes('onRedo={handleRedo}'));
check('review/commit/discard remain PaintSession operations',
    host.includes('paintSession.reviewChanges()') && host.includes('paintSession.commitReviewedChanges()') && host.includes('paintSession.discardWorkingCopy()'));
check('shell does not import SVG-Edit/miniPaint/Piskel app shells',
    !shell.includes('@svgedit') && !shell.includes('miniPaint') && !shell.includes('Piskel'));
check('shell does not contain raw VM mutation',
    !shell.includes('vm.updateSvg') && !shell.includes('vm.updateBitmap') && !shell.includes('renderer.'));
check('canvas chrome is flex-hosted instead of fixed standalone editor sizing',
    shellCss.includes('.canvasChrome') && vectorCss.includes('.vectorEditor') && vectorCss.includes('min-height: 0'));
check('contract regression exists', shellTests.includes('presentation-only and backend-neutral'));
check('DOM regression covers panel/tool/status shell',
    shellDomTests.includes('collapsible panel dock') && shellDomTests.includes('data-ngvge-paint-canvas-chrome'));
check('native host regression proves external vector toolbar', hostDomTests.includes('vectorEditor.props.showToolbar').valueOf());
check('architecture declares OSS backends as canvas engines only',
    architecture.includes('OSS backend is a canvas/editing engine, not the Paint application shell'));
check('slot matrix reserves future bitmap/pixel consumers', matrix.includes('Bitmap') && matrix.includes('Pixel'));

checks.forEach(({name, pass}, index) => console.log(`${pass ? 'PASS' : 'FAIL'} ${index + 1}/${checks.length} ${name}`));
const passed = checks.filter(item => item.pass).length;
console.log(`WS-10F2B Unified Paint Shell: ${passed}/${checks.length} PASS`);
if (passed !== checks.length) process.exit(1);
