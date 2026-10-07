#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const checks = [];
const check = (condition, label) => {
    if (!condition) {
        process.stderr.write(`WS-10B FAIL: ${label}\n`);
        process.exit(1);
    }
    checks.push(label);
};

const capability = read('src/lib/editor-shell/tool-capability.js');
const descriptors = read('src/lib/editor-shell/tool-capability-descriptors.js');
const providers = read('src/lib/editor-shell/workspace-capability-providers.js');
const content = read('src/lib/editor-shell/workspace-resource-content-capability.js');
const workingCopy = read('src/lib/editor-shell/paint-working-copy.js');
const adapter = read('src/lib/editor-shell/scratch-paint-working-copy-adapter.js');
const runtime = read('src/lib/editor-shell/paint-tool-runtime.js');
const component = read('src/components/workspace-paint/workspace-paint.jsx');
const lazyPaint = read('src/lib/tw-scratch-paint.js');
const gui = read('src/components/gui/gui.jsx');
const packageJson = read('package.json');

check(capability.includes("RESOURCE_CONTENT_READ: 'ngvge.workspace-capability.resource-content-read'"), 'Resource Content Read has a stable capability surface');
check(descriptors.includes('WORKSPACE_TOOL_CAPABILITIES.RESOURCE_CONTENT_READ') && descriptors.includes('toolId: TOOL_IDS.PAINT'), 'Paint explicitly declares Resource Content Read query admission');
check(providers.includes("RESOURCE_CONTENT_READ: 'ngvge.workspace-capability-provider.resource-content-read'"), 'Resource Content Read has a stable Provider identity');
check(providers.includes('createWorkspaceResourceContentReadFacade({getResourceDatabase})'), 'Provider binds content reads behind canonical Resource authority');
check(content.includes("WORKSPACE_RESOURCE_CONTENT_READ_CAPABILITY_ID = 'ngvge.workspace-resource-content-read-capability@1'"), 'Portable Resource Content facade has a stable identity');
check(content.includes('MAX_WORKSPACE_IMAGE_CONTENT_BYTES') && content.includes('NGVGE_WORKSPACE_RESOURCE_CONTENT_BUDGET_EXCEEDED'), 'Image content reads are bounded and fail-visible');
check(content.includes('database.getDataURL(internalAssetId)') && !content.includes('vm.'), 'Scratch asset transport stays inside Provider closure and no VM is exposed');
check(content.includes("contentMayHaveChanged: CONTENT_AFFECTING_RESOURCE_EVENTS.has(source.type)"), 'Content source events distinguish metadata from content-affecting changes');
check(workingCopy.includes("WORKSPACE_PAINT_WORKING_COPY_MODEL_ID = 'ngvge.workspace-paint-working-copy-model@1'"), 'Transient Paint Working Copy has a stable model identity');
check(workingCopy.includes('dirty: false') && workingCopy.includes('stale: false') && workingCopy.includes('sourceAuthorityRevision'), 'Working Copy owns dirty/stale/source-revision state');
check(workingCopy.includes('NGVGE_WORKSPACE_PAINT_WORKING_COPY_DIRTY') && workingCopy.includes('discardDirty'), 'Dirty Working Copy cannot be silently replaced');
check(adapter.includes("SCRATCH_PAINT_WORKING_COPY_ADAPTER_ID = 'ngvge.workspace-paint-working-copy-adapter.scratch-paint@1'"), 'scratch-paint Working Copy adapter seam has a stable identity');
check(adapter.includes('fromScratchPaintUpdate') && adapter.includes('toScratchPaintDocument'), 'Backend input/output conversion is isolated in an adapter');
check(runtime.includes('WorkspacePaintWorkingCopyModel') && runtime.includes('WORKSPACE_TOOL_CAPABILITIES.RESOURCE_CONTENT_READ'), 'Paint session consumes admitted content capability through Working Copy model');
check(runtime.includes('applyWorkingCopyEdit') && runtime.includes('discardWorkingCopy') && runtime.includes('reloadWorkingCopy'), 'Paint session exposes explicit transient edit/discard/reload lifecycle');
check(!runtime.includes('vm.updateSvg') && !runtime.includes('vm.updateBitmap') && !runtime.includes('replaceAssetFromCostume'), 'WS-10B Paint session does not mutate Project image content');
check(component.includes('<PaintEditor') && component.includes('fromScratchPaintUpdate') && component.includes('getWorkingCopyContent'), 'Managed Paint view mounts scratch-paint only over the transient Working Copy');
check(lazyPaint.includes('WORKSPACE_PAINT_BACKEND_ACTIVATE') && gui.includes('activateWorkspacePaintBackend'), 'scratch-paint reducer is explicitly activated by managed Workspace composition');
check(!component.includes('document.body') && !component.includes('localStorage') && !component.includes('vm.update'), 'Paint view owns no independent app/window/persistence/VM mutation authority');
check(packageJson.includes('test:workspace-shell:ws10b:focused') && packageJson.includes('test:workspace-shell:ws10b-webpack'), 'WS-10B repeatable focused and production Webpack gates are registered');

process.stdout.write(`WS-10B Paint Content Read / Working Copy Adapter PASS (${checks.length}/${checks.length}).\n`);
process.stdout.write(`${JSON.stringify({stage: 'WS-10B', workingCopy: true, projectContentMutation: false, checks: checks.length}, null, 2)}\n`);
