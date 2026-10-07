#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const json = rel => JSON.parse(read(rel));
const files = {
    backend: 'src/lib/paint-backends/svg-edit-vector-backend.js',
    transfer: 'src/lib/paint-backends/svg-edit-vector-transfer.js',
    index: 'src/lib/paint-backends/index.js',
    candidates: 'src/lib/paint-backends/paint-backend-candidates.js',
    component: 'src/components/workspace-paint/workspace-vector-editor.jsx',
    paint: 'src/components/workspace-paint/workspace-paint.jsx',
    runtime: 'src/lib/editor-shell/paint-tool-runtime.js',
    architecture: 'docs/architecture/workspace/WS-10F-VECTOR-BACKEND-INTEGRATION.md',
    matrix: 'docs/architecture/workspace/WS-10F-vector-backend-boundary.csv',
    roadmap: 'docs/architecture/workspace/WS-10-HIGH-CAPABILITY-TOOL-INTEGRATION.md'
};
const checks=[];
const check=(name,fn,detail='')=>{let passed=false;try{passed=Boolean(fn());}catch(e){detail=detail||e.message;}checks.push({name,passed,detail});};
Object.entries(files).forEach(([n,r])=>check(`file:${n}`,()=>fs.existsSync(path.join(root,r)),r));
const backend=read(files.backend), transfer=read(files.transfer), component=read(files.component), paint=read(files.paint), runtime=read(files.runtime), candidates=read(files.candidates), architecture=read(files.architecture), matrix=read(files.matrix), pkg=json('package.json'), lock=read('bun.lock');
check('adapter-id',()=>backend.includes("ngvge.paint-backend-adapter.svg-edit@1"));
check('controls-id',()=>backend.includes("ngvge.vector-paint-backend-controls@1"));
check('transfer-adapter-id',()=>transfer.includes("ngvge.paint-backend-transfer-adapter.svg-edit@1"));
check('package-exact-pin',()=>pkg.dependencies && pkg.dependencies['@svgedit/svgcanvas']==='7.4.2');
check('bun-lock-exact',()=>lock.includes('"@svgedit/svgcanvas": "7.4.2"') && lock.includes('"@svgedit/svgcanvas@7.4.2"') && lock.includes('sha512-18PixrbaGstEsZfijYeF+y69LDOfP/c68aVKR+Hh8S/YckbhxT4VpKJFf5Ang/Zd/Vvy63jPuf9O4pEDc4Gv+A=='));
check('real-production-import',()=>component.includes("import SvgCanvas from '@svgedit/svgcanvas'"));
check('paint-backend-binding',()=>component.includes('createPaintBackendBinding') && component.includes('SVG_EDIT_VECTOR_BACKEND_DESCRIPTOR'));
check('canonical-vector-transfer',()=>transfer.includes('VECTOR_ART_DOCUMENT_SCHEMA_ID') && transfer.includes("role: 'document-source'") && transfer.includes("kind: 'svg-text'"));
check('stable-resource-art-identity',()=>transfer.includes('makeDocumentId') && backend.includes('loadedTransfer') && architecture.includes('preserve both'));
check('vector-tool-whitelist',()=>['select','freehand','line','rect','ellipse','path','text'].every(t=>backend.includes(`'${t}'`)));
check('freehand-private-map',()=>backend.includes("tool === 'freehand' ? 'fhpath' : tool"));
check('changed-event',()=>backend.includes("canvas.bind('changed', onChanged)") && component.includes("event.type === 'content:changed'"));
check('history-surface',()=>backend.includes('undoMgr') && backend.includes('getHistoryState') && component.includes("runHistory('undo')"));
check('presentation-resize-only',()=>backend.includes('Never call setResolution here') && !/resize \([\s\S]*?setResolution\(/.test(backend));
check('document-scoped-target',()=>backend.includes('document-scoped') && backend.includes('NGVGE_PAINT_SVG_EDIT_TARGET_INVALID'));
check('svg-production-branch',()=>paint.includes('isVectorWorkingCopy') && paint.includes('<WorkspaceVectorEditor'));
check('raster-compat-branch',()=>paint.includes('toScratchPaintDocument') && runtime.includes("status: 'compatibility-raster-backend'"));
check('svg-runtime-diagnostics',()=>runtime.includes('SVG_EDIT_VECTOR_BACKEND_ADAPTER_ID') && runtime.includes('SVG_EDIT_VECTOR_BACKEND_PACKAGE'));
check('candidate-version',()=>candidates.includes("version: '7.4.2'") && candidates.includes("productionIntake: 'VECTOR_ADAPTER_INTEGRATED_WS10F'"));
check('no-full-app-shell',()=>!component.includes("from 'svgedit'") && !component.includes('Editor.js') && architecture.includes('full `svgedit` Editor/App Shell is not integrated'));
check('no-vm-renderer-mutation',()=>!backend.includes('Scratch.vm') && !backend.includes('vm.updateSvg') && !backend.includes('renderer.') && !component.includes('vm.updateSvg'));
check('project-save-reviewed',()=>architecture.includes('WS-10C reviewed resource.content.replace'));
check('timeline-authority-false',()=>matrix.includes('Timeline,NGVGE,none,FROZEN'));
check('conditional-status-recorded',()=>architecture.includes('IMPLEMENTED / CONDITIONAL VERIFIED') && architecture.includes('package-byte'));
const failed=checks.filter(x=>!x.passed); checks.forEach(x=>console.log(`${x.passed?'PASS':'FAIL'} ${x.name}${x.detail?` :: ${x.detail}`:''}`)); console.log(`WS-10F Vector integration machine checks: ${checks.length-failed.length}/${checks.length} PASS`); if(failed.length)process.exit(1);
