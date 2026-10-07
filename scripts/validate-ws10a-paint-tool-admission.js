#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const checks = [];
const check = (condition, label) => {
    if (!condition) {
        process.stderr.write(`WS-10A FAIL: ${label}\n`);
        process.exit(1);
    }
    checks.push(label);
};

const registry = read('src/lib/editor-shell/tool-registry.js');
const manifests = read('src/lib/editor-shell/tool-ecosystem-manifests.js');
const descriptors = read('src/lib/editor-shell/tool-capability-descriptors.js');
const runtime = read('src/lib/editor-shell/paint-tool-runtime.js');
const component = read('src/components/workspace-paint/workspace-paint.jsx');
const dock = read('src/components/workspace-dock/workspace-dock.jsx');
const launchpad = read('src/components/workspace-launchpad/workspace-launchpad.jsx');
const gui = read('src/components/gui/gui.jsx');
const adr = read('docs/architecture/workspace/ADR-WS10A-SCRATCH-PAINT-INTAKE.md');
const packageJson = read('package.json');

check(
    registry.includes("PAINT: 'ngvge.tool.paint'") && registry.includes("PAINT: 'paint'"),
    'Better Paint has stable ToolId and WindowId identities'
);
check(
    registry.includes('id: TOOL_IDS.PAINT') && registry.includes("iconKey: 'paint'") &&
    registry.includes("providerId: 'ngvge.oss.scratch-paint-adapter'"),
    'Paint is a managed singleton Workspace Tool rather than an independent app'
);
check(
    manifests.includes('toolId: POST_MVP_TOOL_IDS.PAINT') &&
    manifests.includes('lifecycle: TOOL_ECOSYSTEM_LIFECYCLE.ACTIVE') &&
    manifests.includes('authority: TOOL_ECOSYSTEM_AUTHORITIES.PROJECT_COMMAND'),
    'Paint activation uses reviewed Project-command ecosystem authority'
);
check(
    manifests.includes("status: OSS_INTAKE_STATUS.APPROVED") &&
    manifests.includes("adrId: 'ADR-WS10A-SCRATCH-PAINT-INTAKE'") &&
    manifests.includes("backendSelection: 'scratch-paint@2.1.61'"),
    'scratch-paint activation is gated by approved OSS Intake identity'
);
check(
    manifests.includes('toolId: POST_MVP_TOOL_IDS.TERMINAL') &&
    manifests.includes("TERMINAL: 'ngvge.tool.terminal'") && !registry.includes("TERMINAL: 'ngvge.tool.terminal'"),
    'Better Terminal remains planned and does not leak into ToolRegistry'
);
check(
    descriptors.includes('toolId: TOOL_IDS.PAINT') &&
    descriptors.includes('capabilityId: WORKSPACE_TOOL_CAPABILITIES.CONTEXT_READ') &&
    descriptors.includes('capabilityId: WORKSPACE_TOOL_CAPABILITIES.RESOURCE_READ') &&
    descriptors.match(/capabilityId: WORKSPACE_TOOL_CAPABILITIES\.PROJECT_COMMAND/g).length >= 2,
    'Paint declares Context, Resource read, and reviewed Project command capability surfaces'
);
check(
    descriptors.includes('TOOL_ECOSYSTEM_AUTHORITIES.PROJECT_COMMAND') &&
    descriptors.includes("description: 'Query ResourceId-addressed data"),
    'Project-command tools may query portable Resource descriptors without acquiring Resource writer authority'
);
check(
    runtime.includes("WORKSPACE_PAINT_TOOL_SESSION_ID = 'ngvge.workspace-paint-tool-session@1'") &&
    runtime.includes("WORKSPACE_PAINT_BACKEND_ADAPTER_ID = 'ngvge.workspace-paint-backend.scratch-paint@1'"),
    'Paint session and backend adapter seam have stable identities'
);
check(
    runtime.includes('host.admit(TOOL_IDS.PAINT)') && runtime.includes('providers.bind({capabilityLease: lease') &&
    runtime.includes('WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND'),
    'Paint runtime receives all access through WS-9 admission and Provider binding'
);
check(
    runtime.includes('projectPropose.createProposal') && runtime.includes('projectPropose.reviewProposal') &&
    runtime.includes('projectPropose.prepareMutationReview') && runtime.includes('projectMutate.execute'),
    'Paint commit path is Proposal -> Review -> Evidence -> Project transaction'
);
check(
    runtime.includes('projectMutate.prepareRollbackReview') && runtime.includes('projectMutate.rollback'),
    'Paint rollback requires a fresh reviewed rollback transaction'
);
check(
    !runtime.includes('vm.updateSvg') && !runtime.includes('vm.updateBitmap') && !runtime.includes('renameCostume') &&
    !runtime.includes('scratchTarget') && !runtime.includes('renderer.'),
    'WS-10A does not bypass reviewed Project mutation through Scratch backend setters'
);
check(
    component.includes('data-ngvge-tool-id="ngvge.tool.paint"') &&
    component.includes('reviewChanges') && component.includes('Commit Reviewed'),
    'Paint UI exposes the reviewed transaction workflow visibly'
);
check(
    !component.includes('DraggableWindow') && !component.includes('document.body') &&
    !component.includes('localStorage') && !component.includes('sessionStorage'),
    'Paint view owns neither window authority nor browser persistence'
);
check(
    gui.includes('const PAINT_WINDOW = createWindowDescriptor(PAINT_TOOL)') &&
    gui.includes('registerStaticWindow(PAINT_WINDOW, false, 471)') &&
    gui.includes('createWorkspacePaintToolSession({') && gui.includes('<WorkspacePaint') && gui.includes('session={paintSession}'),
    'production GUI composes Paint over ToolRegistry, WindowManager, and admitted session runtime'
);
check(
    dock.includes("'paint': (") && launchpad.includes("'paint': <path"),
    'Paint has SVG-only Dock and Launchpad iconography'
);
check(
    adr.includes('GPL-3.0') && adr.includes('scratch-paint@2.1.61') &&
    adr.includes('Backend seam') && adr.includes('Migration / escape plan'),
    'OSS Intake records license, backend seam, and escape plan'
);
check(
    packageJson.includes('test:workspace-shell:ws10a:focused') &&
    packageJson.includes('test:workspace-shell:ws10a-webpack'),
    'WS-10A defines repeatable focused and production Webpack gates'
);

process.stdout.write(`WS-10A Better Paint Tool Admission & Resource Editing Session PASS (${checks.length}/${checks.length}).\n`);
process.stdout.write(`${JSON.stringify({
    toolId: 'ngvge.tool.paint',
    sessionId: 'ngvge.workspace-paint-tool-session@1',
    backendAdapterId: 'ngvge.workspace-paint-backend.scratch-paint@1',
    backendPackage: 'scratch-paint@2.1.61',
    directResourceMutation: false,
    reviewedProjectMutation: true,
    checks: checks.length
}, null, 2)}\n`);
