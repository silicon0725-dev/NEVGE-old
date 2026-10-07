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
        process.stderr.write(`WS-10A CERTIFICATION FAIL: ${label}\n`);
        process.exit(1);
    }
    checks.push(label);
};

const cert = json('docs/architecture/workspace/WS-10A-CERTIFICATE.json');
const stage = read('docs/architecture/workspace/WS-10A-BETTER-PAINT-TOOL-ADMISSION-RESOURCE-EDITING-SESSION.md');
const verification = read('docs/architecture/workspace/WS-10A-VERIFICATION.md');
const adr = read('docs/architecture/workspace/ADR-WS10A-SCRATCH-PAINT-INTAKE.md');
const registry = read('src/lib/editor-shell/tool-registry.js');
const manifests = read('src/lib/editor-shell/tool-ecosystem-manifests.js');
const descriptors = read('src/lib/editor-shell/tool-capability-descriptors.js');
const runtime = read('src/lib/editor-shell/paint-tool-runtime.js');
const gui = read('src/components/gui/gui.jsx');
const packageJson = json('package.json');

check(cert.stage === 'WS-10A' && cert.status === 'COMPLETE / VERIFIED', 'WS-10A certificate is frozen COMPLETE / VERIFIED');
check(stage.includes('**Status:** `COMPLETE / VERIFIED`'), 'WS-10A architecture record is frozen COMPLETE / VERIFIED');
check(cert.workspaceParent === 'WS-9 | COMPLETE / CERTIFIED', 'WS-10A remains a consumer of the certified WS-9 foundation');
check(cert.identities.toolId === 'ngvge.tool.paint' && cert.identities.windowId === 'paint', 'Paint ToolId and WindowId are certified');
check(cert.identities.sessionId === 'ngvge.workspace-paint-tool-session@1', 'Paint session identity is certified');
check(cert.identities.backendAdapterId === 'ngvge.workspace-paint-backend.scratch-paint@1', 'Paint backend adapter identity is certified');
check(cert.identities.backendPackage === 'scratch-paint@2.1.61' && adr.includes('GPL-3.0'), 'Approved OSS package/version/license evidence is frozen');
check(registry.includes("PAINT: 'ngvge.tool.paint'") && registry.includes('id: TOOL_IDS.PAINT'), 'Paint remains registered through ToolRegistry');
check(manifests.includes("adrId: 'ADR-WS10A-SCRATCH-PAINT-INTAKE'") && manifests.includes('TOOL_ECOSYSTEM_LIFECYCLE.ACTIVE'), 'Paint activation remains gated by the approved OSS Intake');
check(descriptors.includes('toolId: TOOL_IDS.PAINT') && descriptors.match(/capabilityId: WORKSPACE_TOOL_CAPABILITIES\.PROJECT_COMMAND/g).length >= 2, 'Paint remains capability-admitted for reviewed Project mutation');
check(cert.rules.resourceDirectMutation === false && !runtime.includes('WORKSPACE_TOOL_CAPABILITIES.RESOURCE_COMMAND'), 'Paint has no direct Resource mutation surface');
check(runtime.includes('prepareMutationReview') && runtime.includes('projectMutate.execute'), 'Paint commit remains Review Evidence -> Project transaction');
check(runtime.includes('prepareRollbackReview') && runtime.includes('projectMutate.rollback'), 'Paint rollback remains fresh-review protected');
check(cert.rules.rawScratchBackendAuthorityExposed === false && !runtime.includes('vm.updateSvg') && !runtime.includes('vm.updateBitmap') && !runtime.includes('renameCostume'), 'Paint runtime exposes no raw Scratch mutation path');
check(cert.rules.paintContentReplacementActivated === false, 'WS-10A does not falsely certify image content replacement');
check(cert.rules.terminalActivated === false && manifests.includes('toolId: POST_MVP_TOOL_IDS.TERMINAL'), 'Better Terminal remains planned');
check(gui.includes('createWorkspacePaintToolSession({') && gui.includes('<WorkspacePaint') && gui.includes('session={paintSession}'), 'Production GUI owns the admitted Paint session and managed view');
check(cert.verification.machine === '18/18 PASS' && cert.verification.focused === '8 suites / 46 tests PASS', 'Stage-specific executable evidence is recorded');
check(cert.verification.fullUnit === '142 suites / 787 tests PASS' && cert.verification.permanentRegression === '19/19 PASS', 'Full unit and permanent regression evidence is recorded');
check(cert.verification.fullEditorWebpack === '0 errors / 0 warnings PASS', 'Real Editor production Webpack evidence is recorded');
check(cert.verification.ws9Aggregate === '20/20 PASS', 'WS-9 aggregate certification remains green after Paint activation');
check(verification.includes('ARC-C001.1 baseline') && verification.includes('LSC-G1') && verification.includes('LRC-G1') && verification.includes('LPL-G1') && verification.includes('LEX-G1') && verification.includes('COL-0'), 'Frozen architecture/containment gate evidence is recorded');
check(typeof packageJson.scripts['test:workspace-shell:ws10a-certification'] === 'string', 'Repeatable WS-10A certification script is registered');

process.stdout.write(`WS-10A Certification PASS (${checks.length}/${checks.length}).\n`);
process.stdout.write(`${JSON.stringify({
    stage: 'WS-10A',
    status: 'COMPLETE / VERIFIED',
    toolId: 'ngvge.tool.paint',
    backend: 'scratch-paint@2.1.61',
    reviewedMutation: true,
    contentReplacement: false,
    checks: checks.length
}, null, 2)}\n`);
