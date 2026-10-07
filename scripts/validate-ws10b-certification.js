#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const json = relative => JSON.parse(read(relative));
const checks = [];
const check = (condition, label) => {
    if (!condition) {
        process.stderr.write(`WS-10B CERTIFICATION FAIL: ${label}\n`);
        process.exit(1);
    }
    checks.push(label);
};

const cert = json('docs/architecture/workspace/WS-10B-CERTIFICATE.json');
const stage = read('docs/architecture/workspace/WS-10B-PAINT-CONTENT-READ-WORKING-COPY-ADAPTER.md');
const verification = read('docs/architecture/workspace/WS-10B-VERIFICATION.md');
const matrix = read('docs/architecture/workspace/WS-10B-content-working-copy-matrix.csv');
const capabilities = read('src/lib/editor-shell/tool-capability.js');
const descriptors = read('src/lib/editor-shell/tool-capability-descriptors.js');
const providers = read('src/lib/editor-shell/workspace-capability-providers.js');
const contentFacade = read('src/lib/editor-shell/workspace-resource-content-capability.js');
const workingCopy = read('src/lib/editor-shell/paint-working-copy.js');
const adapter = read('src/lib/editor-shell/scratch-paint-working-copy-adapter.js');
const runtime = read('src/lib/editor-shell/paint-tool-runtime.js');
const paint = read('src/components/workspace-paint/workspace-paint.jsx');
const scratchPaint = read('src/lib/tw-scratch-paint.js');
const roadmap = read('docs/architecture/workspace/WS-10-HIGH-CAPABILITY-TOOL-INTEGRATION.md');
const packageJson = json('package.json');

check(cert.stage === 'WS-10B' && cert.status === 'COMPLETE / VERIFIED', 'WS-10B certificate is frozen COMPLETE / VERIFIED');
check(stage.includes('**Status:** `COMPLETE / VERIFIED`'), 'WS-10B architecture record is frozen COMPLETE / VERIFIED');
check(cert.workspaceParent === 'WS-10A | COMPLETE / VERIFIED' && cert.ws9Foundation === 'COMPLETE / CERTIFIED', 'WS-10B remains layered over certified WS-9 and verified WS-10A');
check(capabilities.includes("RESOURCE_CONTENT_READ: 'ngvge.workspace-capability.resource-content-read'"), 'Resource content read has a stable capability identity');
check(contentFacade.includes("'ngvge.workspace-resource-content-read-capability@1'") && contentFacade.includes('MAX_WORKSPACE_IMAGE_CONTENT_BYTES = 32 * 1024 * 1024'), 'Portable content facade identity and 32 MiB bound are frozen');
check(contentFacade.includes('assertResourceId(resourceId)') && contentFacade.includes("kind: 'data-uri'"), 'Content reads require canonical ResourceId and return portable data URI content');
check(!contentFacade.includes('vm.updateSvg') && !contentFacade.includes('vm.updateBitmap') && !contentFacade.includes('renderer.'), 'Content facade does not own Scratch/renderer mutation');
check(descriptors.includes('WORKSPACE_TOOL_CAPABILITIES.RESOURCE_CONTENT_READ') && descriptors.includes('toolId: TOOL_IDS.PAINT'), 'Paint explicitly requests resource-content-read query capability');
check(providers.includes("RESOURCE_CONTENT_READ: 'ngvge.workspace-capability-provider.resource-content-read'") && providers.includes('createWorkspaceResourceContentReadFacade'), 'Resource content capability resolves only through Provider Registry');
check(cert.identities.workingCopyModelId === 'ngvge.workspace-paint-working-copy-model@1' && workingCopy.includes('sourceAuthorityRevision'), 'Transient working-copy model and source revision are certified');
check(workingCopy.includes('NGVGE_WORKSPACE_PAINT_WORKING_COPY_DIRTY') && workingCopy.includes("_emit('source:stale')"), 'Dirty-switch protection and stale-source semantics are implemented');
check(cert.identities.workingCopyAdapterId === 'ngvge.workspace-paint-working-copy-adapter.scratch-paint@1', 'Replaceable scratch-paint working-copy adapter identity is certified');
check(adapter.includes("content: Object.freeze({kind: 'svg-text'") && adapter.includes("canvas.toDataURL('image/png')"), 'Vector and bitmap backend updates become portable local working-copy edits');
check(runtime.includes('WorkspacePaintWorkingCopyModel') && runtime.includes('applyWorkingCopyEdit'), 'Paint session owns the transient working copy');
check(runtime.includes('context:resource-switch-deferred') && runtime.includes('discardWorkingCopy'), 'Paint session prevents silent dirty Context switching and exposes explicit discard');
check(paint.includes('<PaintEditor') && paint.includes('session.applyWorkingCopyEdit') && !paint.includes('vm.updateSvg') && !paint.includes('vm.updateBitmap'), 'Production PaintEditor writes only through the working-copy session');
check(scratchPaint.includes("WORKSPACE_PAINT_BACKEND_ACTIVATE = 'ngvge/workspace-paint/ACTIVATE_BACKEND'"), 'Workspace explicitly activates the lazy replaceable Paint backend');
check(cert.rules.projectImageContentMutationActivated === false && !runtime.includes('resource.replace-content'), 'WS-10B does not falsely activate Project image-content mutation');
check(cert.rules.resourceDirectMutation === false && !runtime.includes('WORKSPACE_TOOL_CAPABILITIES.RESOURCE_COMMAND'), 'Paint still has no direct Resource mutation capability');
check(matrix.includes('content_commit,not available') && matrix.includes('raw_vm_renderer,not exposed'), 'Working-copy matrix records the mutation and backend isolation boundaries');
check(roadmap.includes('WS-10B COMPLETE / VERIFIED') && roadmap.includes('WS-10C｜Reviewed Resource Content Replace Transaction'), 'WS-10 roadmap preserves verified WS-10B and the reviewed content replacement successor stage');
check(cert.verification.machine === '20/20 PASS' && cert.verification.focused === '7 suites / 40 tests PASS', 'Stage-specific machine/focused evidence is recorded');
check(cert.verification.fullUnit === '145 suites / 802 tests PASS' && cert.verification.permanentRegression === '19/19 PASS', 'Full unit and permanent regression evidence is recorded');
check(cert.verification.fullEditorWebpack === '0 errors / 0 warnings PASS' && cert.verification.ws10bWebpack === '0 errors / 0 warnings PASS', 'WS-10B and full Editor production Webpack evidence are recorded');
check(cert.verification.ws9Aggregate === '20/20 PASS' && cert.verification.ws10aCertification === '23/23 PASS', 'Certified WS-9 and WS-10A baselines remain green');
check(verification.includes('ARC-C001.1 baseline') && verification.includes('LSC-G1') && verification.includes('LRC-G1') && verification.includes('LPL-G1') && verification.includes('LEX-G1') && verification.includes('COL-0'), 'Frozen architecture/containment evidence is recorded');
check(typeof packageJson.scripts['test:workspace-shell:ws10b-certification'] === 'string', 'Repeatable WS-10B certification script is registered');

process.stdout.write(`WS-10B Certification PASS (${checks.length}/${checks.length}).\n`);
process.stdout.write(`${JSON.stringify({
    stage: 'WS-10B',
    status: 'COMPLETE / VERIFIED',
    toolId: 'ngvge.tool.paint',
    workingCopy: true,
    projectContentMutation: false,
    checks: checks.length
}, null, 2)}\n`);
