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

const backend = read('src/lib/paint-backends/svg-edit-vector-backend.js');
const transfer = read('src/lib/paint-backends/svg-edit-vector-transfer.js');
const editor = read('src/components/workspace-paint/workspace-vector-editor.jsx');
const shell = read('src/components/native-paint/native-paint-shell.jsx');
const toolProfiles = read('src/lib/editor-shell/paint-tool-profiles.js');
const host = read('src/containers/native-paint-editor-host.jsx');
const backendTests = read('test/unit/lib/paint-backends/svg-edit-vector-backend.test.js');
const editorTests = read('test/unit/components/workspace-vector-professional-tooling.test.jsx');
const shellTests = read('test/unit/components/native-paint-shell.test.jsx');

check('NGVGE tool vocabulary includes Selection and Direct Selection',
    backend.includes("'select'") && backend.includes("'direct-select'"));
check('NGVGE tool vocabulary includes Pen/Text/Hand/Zoom',
    ["'path'", "'text'", "'hand'", "'zoom'"].every(token => backend.includes(token)));
check('backend owns a bounded professional command vocabulary', backend.includes('VECTOR_PAINT_COMMANDS'));
check('object commands include delete/cut/copy/paste/duplicate/group/ungroup',
    ['delete', 'cut', 'copy', 'paste', 'duplicate', 'group', 'ungroup'].every(command => backend.includes(`'${command}'`)));
check('arrange commands include forward/backward/front/back',
    ['bring-forward', 'send-backward', 'bring-front', 'send-back'].every(command => backend.includes(`'${command}'`)));
check('nudge command maps through moveSelectedElements',
    backend.includes("case 'move-selection'") && backend.includes("'moveSelectedElements'"));
check('Direct Selection uses SVG-Edit pathActions rather than private NGVGE path identity',
    backend.includes('enterDirectSelectionIfPossible') && backend.includes('canvas.pathActions.toEditMode'));
check('path tooling includes add/delete/convert/open-close anchors/segments',
    ['path-add-anchor', 'path-delete-anchor', 'path-convert-anchor', 'path-open-close']
        .every(command => backend.includes(`'${command}'`)));
check('path add anchor is a controlled alias over SVG-Edit clonePathNode foundation',
    backend.includes("case 'path-add-anchor':") && backend.includes("'pathActions.clonePathNode'"));
check('line and curve conversion use SVG path segment types 4 and 6',
    backend.includes('.call(canvas.pathActions, 4)') && backend.includes('.call(canvas.pathActions, 6)'));
check('no-selection object mutations are guarded before SVG-Edit operations',
    backend.includes('requiresSelection.has(command) && !hasSelection'));
check('path commands are guarded outside native pathedit mode',
    backend.includes('pathCommands.has(command) && !selectionState.directEditing'));
check('empty clipboard paste does not synthesize dirty state',
    backend.includes('An empty/private clipboard must remain a presentation no-op'));
check('command bridge never synthesizes dirty state for backend no-op mutations',
    backend.includes('const runMutation = operation => operation();') &&
    !backend.includes('mutationRevision === before) onChanged()'));
check('Hand pan remains presentation-only and shares svgcontent/selectorParentGroup offset',
    backend.includes('applyPresentationTransform') && backend.includes("root.querySelector('#selectorParentGroup')") &&
    backend.includes("content.setAttribute('x', x)") && backend.includes("selectorParent.setAttribute('transform', `translate(${x},${y})`)"));
check('vector workspace is explicitly unbounded instead of using svgcontent as the edit boundary',
    backend.includes('show_outside_canvas: true') && backend.includes("content.setAttribute('overflow', 'visible')") &&
    backend.includes("background.setAttribute('visibility', 'hidden')"));
check('Scratch-style stage guide is presentation-only and never promoted into authored SVG content',
    backend.includes("VECTOR_STAGE_GUIDE_ID = 'ngvge-vector-stage-guide'") &&
    backend.includes("'data-ngvge-presentation-only': 'stage-size-guide'") &&
    backend.includes("VECTOR_STAGE_GUIDE_OUTER_STROKE = '#4280D7'"));
check('stage guide derives from runtime stage size around the Scratch-style editor origin',
    backend.includes('editorOrigin.x - workspaceContext.stageWidth / 2') &&
    backend.includes('editorOrigin.y - workspaceContext.stageHeight / 2') &&
    host.includes('target.runtime.stageWidth') && host.includes('target.runtime.stageHeight'));
check('Fit uses stage plus real stroked artwork bounds rather than finite SVG viewport alone',
    backend.includes('unionBounds(getStageBounds(), getArtworkBounds())') && backend.includes('canvas.getStrokedBBox(items)'));
check('off-viewport authoring is normalized only at portable export boundary',
    backend.includes('normalizeSvgToArtworkBounds(svgText, artworkBounds)') &&
    transfer.includes('data-ngvge-export-normalized') && transfer.includes('sourceOrigin'));
check('export normalization preserves rotation-center semantics through the same coordinate translation',
    backend.includes('editorOrigin.x - normalizedArtwork.sourceOrigin.x') &&
    editor.includes('controlsRef.current.getExportMetadata()') &&
    editor.includes('createWorkingCopyEditFromSvgEditTransfer(transfer, exportMetadata || {})'));
check('Fit resets pan instead of resizing document semantics',
    backend.includes("zoomMode = VECTOR_ZOOM_MODES.FIT") && backend.includes('presentationPan = {x: 0, y: 0}') &&
    !backend.includes('setResolution(viewport'));
check('workspace editor maps required V/A/P/T/M/L/H/Z shortcuts',
    ['v', 'a', 'p', 't', 'm', 'l', 'h', 'z'].every(key => editor.includes(`${key}:`)));
check('workspace editor maps Delete/Backspace and primary clipboard/history shortcuts',
    editor.includes("key === 'Delete' || key === 'Backspace'") && editor.includes("lower === 'z'") &&
    editor.includes("c: 'copy'") && editor.includes("x: 'cut'") && editor.includes("v: 'paste'"));
check('workspace editor maps group/ungroup and duplicate shortcuts',
    editor.includes("d: 'duplicate'") && editor.includes("g: event.shiftKey ? 'ungroup' : 'group'"));
check('workspace editor maps arrow nudge with Shift acceleration',
    editor.includes("const step = event.shiftKey ? 10 : 1") && editor.includes("runCommand('move-selection', delta)"));
check('Space temporarily enters Hand pan without changing authored tool semantics',
    editor.includes("key === ' ' || key === 'Spacebar'") && editor.includes("'hand-temporary'"));
check('Zoom pointer interaction drives presentation zoom rather than document resize',
    editor.includes("activeTool === 'zoom'") && editor.includes('setPresentationZoom(nextZoom)'));
check('Native Paint Shell owns professional tool presentation through the shared Paint tool profile',
    shell.includes('getPaintToolLabel(activeTool)') &&
    toolProfiles.includes("label: 'Direct Selection'") && toolProfiles.includes("label: 'Hand'") && toolProfiles.includes("label: 'Zoom'"));
check('Native Paint Shell owns context action toolbar and shared zoom selector',
    shell.includes('aria-label="Selection actions"') && shell.includes('aria-label={`${modeLabel} zoom`}'));
check('Native host supplies selection-aware object/path actions',
    host.includes('vectorContextActions') && host.includes("id: 'path-add-anchor'") && host.includes("id: 'bring-front'"));
check('Native host routes commands only through WorkspaceVectorEditor imperative surface',
    host.includes('vectorEditorRef.current.runCommand(command)') && !host.includes('vm.updateSvg') && !host.includes('vm.updateBitmap'));
check('Native host routes zoom only through editor presentation controls',
    host.includes('vectorEditorRef.current.fitToView()') && host.includes('vectorEditorRef.current.setZoom(value)'));
check('workspace editor keeps backend App Shell absent',
    !editor.includes('svg-editor') && !editor.includes('SVGEdit') && !shell.includes('@svgedit'));
check('backend permanent tests cover object/path professional command routing',
    backendTests.includes('routes object editing commands through SVG-Edit operations') &&
    backendTests.includes('routes path-node operations through pathActions'));
check('backend permanent tests keep HF1 alignment through Hand pan',
    backendTests.includes('Hand pan offsets svgcontent and selectorParentGroup together'));
check('permanent regression covers infinite workspace, stage guide, fit union, and off-viewport export',
    backendTests.includes('uses an unbounded SVG-Edit workspace with a Scratch-style stage guide') &&
    backendTests.includes('fits stage plus artwork while preserving selection/content alignment outside the source SVG viewport') &&
    backendTests.includes('exports off-viewport artwork tightly and shifts rotation center'));
check('DOM regression crosses keyboard, Direct Selection, Hand/Space, and Zoom',
    editorTests.includes('professional shortcuts, Direct Selection, Hand/Space pan, and Zoom'));
check('Shell DOM regression covers selection actions and fixed zoom controls',
    shellTests.includes("toHaveBeenCalledWith('duplicate')") && shellTests.includes("'Vector zoom'"));
check('F2C does not claim Project/Resource/Transaction/Persistence authority in UI adapter',
    !backend.includes('saveProject') && !backend.includes('commitProject') && !backend.includes('ResourceId =') &&
    !editor.includes('vm.updateSvg') && !editor.includes('vm.updateBitmap'));

checks.forEach(({name, pass}, index) => console.log(`${pass ? 'PASS' : 'FAIL'} ${index + 1}/${checks.length} ${name}`));
const passed = checks.filter(item => item.pass).length;
console.log(`WS-10F2C Vector Professional Tooling Machine Gate: ${passed}/${checks.length} PASS`);
if (passed !== checks.length) process.exit(1);
