'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const json = rel => JSON.parse(read(rel));

const checks = [];
const check = (name, condition, detail) => {
    checks.push({name, pass: Boolean(condition), detail});
};

const stageLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
const stageCerts = stageLetters.map(letter => json(`docs/architecture/workspace/WS-9${letter}-CERTIFICATE.json`));
const ws9Cert = json('docs/architecture/workspace/WS-9-CERTIFICATE.json');
const policy = read('src/lib/editor-shell/privileged-mutation-review-policy.js');
const providerCore = read('src/lib/editor-shell/workspace-capability-provider.js');
const providers = read('src/lib/editor-shell/workspace-capability-providers.js');
const capabilities = read('src/lib/editor-shell/workspace-project-resource-capabilities.js');
const context = read('src/lib/editor-shell/workspace-context.js');
const projectCommandHost = read('src/lib/editor-shell/project-command-host.js');
const review = read('src/lib/editor-shell/project-transaction-review.js');
const gui = read('src/components/gui/gui.jsx');
const packageJson = json('package.json');

check(
    'WS-9A through WS-9I certificates exist and are verified',
    stageCerts.every((cert, index) => cert.stage === `WS-9${stageLetters[index]}` && cert.status === 'COMPLETE / VERIFIED'),
    'All nine constituent stages must remain independently verified.'
);
check(
    'WS-9 aggregate certificate is COMPLETE / CERTIFIED',
    ws9Cert.stage === 'WS-9' && ws9Cert.status === 'COMPLETE / CERTIFIED',
    'Aggregate status must not be emitted before constituent verification.'
);
check(
    'Capability Host v1 remains certified',
    ws9Cert.certifiedIdentities.capabilityHost === 'ngvge.workspace-tool-capability-host@1',
    'WS-9 keeps the WS-9A admission identity.'
);
check(
    'Workspace Context remains certified as v1',
    ws9Cert.certifiedIdentities.workspaceContext === 'ngvge.workspace-context@1' &&
        context.includes("'ngvge.workspace-context@1'"),
    'Context stays a stable projection contract.'
);
check(
    'Provider Registry v1 remains the runtime binding layer',
    ws9Cert.certifiedIdentities.providerRegistry === 'ngvge.workspace-capability-provider-registry@1' &&
        providerCore.includes("'ngvge.workspace-capability-provider-registry@1'"),
    'Provider binding must not be replaced by per-tool service lookup.'
);
check(
    'Project Command Host v1 is the Project transaction coordinator',
    ws9Cert.certifiedIdentities.projectCommandHost === 'ngvge.workspace-project-command-host@1' &&
        projectCommandHost.includes("'ngvge.workspace-project-command-host@1'"),
    'Project command transaction identity must remain stable.'
);
check(
    'Project Transaction Review v1 remains read-only diagnostics',
    ws9Cert.certifiedIdentities.transactionReview === 'ngvge.workspace-project-transaction-review@1' &&
        review.includes("'ngvge.workspace-project-transaction-review@1'"),
    'Review does not become mutation authority.'
);
check(
    'Privileged Mutation Review Policy v1 is certified',
    ws9Cert.certifiedIdentities.privilegedMutationReviewPolicy === 'ngvge.workspace-privileged-mutation-review-policy@1' &&
        policy.includes("'ngvge.workspace-privileged-mutation-review-policy@1'"),
    'WS-9I policy identity is part of the aggregate contract.'
);
check(
    'Project mutation is review-required',
    policy.includes('WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND') &&
        policy.includes('WORKSPACE_MUTATION_REVIEW_MODES.REVIEW_REQUIRED'),
    'Privileged Project mutation cannot regress to optional review.'
);
check(
    'Direct Resource Tool mutation is denied',
    policy.includes('WORKSPACE_TOOL_CAPABILITIES.RESOURCE_COMMAND') &&
        policy.includes('WORKSPACE_MUTATION_REVIEW_MODES.DIRECT_DENIED') &&
        providers.includes('NGVGE_WORKSPACE_RESOURCE_DIRECT_MUTATION_REVIEW_REQUIRED'),
    'Resource command mutate cannot bypass reviewed Project transactions.'
);
check(
    'Review Evidence is bound to Tool and Capability lease',
    policy.includes('capabilityLeaseId') && policy.includes('state.toolId !== ownerToolId') &&
        policy.includes('state.capabilityLeaseId !== lease.id'),
    'Evidence may not be transferred between Tools or lease generations.'
);
check(
    'Review Evidence is revision-fresh and one-shot',
    policy.includes('currentReviewState.revision !== state.reviewRevision') &&
        policy.includes('WORKSPACE_MUTATION_REVIEW_EVIDENCE_STATES.CONSUMED'),
    'A reviewed mutation must be re-reviewed after source changes and cannot be replayed.'
);
check(
    'Project commit consumes Review Evidence before Host mutation',
    capabilities.includes('consumeCommitEvidence') && capabilities.includes('projectCommandHost.commit'),
    'Mutation facade must enforce policy rather than relying on UI discipline.'
);
check(
    'Project rollback consumes fresh Review Evidence',
    capabilities.includes('consumeRollbackEvidence') && capabilities.includes('projectCommandHost.rollback'),
    'Rollback is privileged mutation and follows the same admission model.'
);
check(
    'Production bootstrap wires Review Policy into Provider Registry',
    gui.includes('createWorkspacePrivilegedMutationReviewPolicy') &&
        gui.includes('privilegedMutationReviewPolicy: workspacePrivilegedMutationReviewPolicy'),
    'Production Tools must use the certified policy path.'
);
check(
    'No aggregate certificate claims Terminal or Paint activation',
    ws9Cert.certifiedRules.terminalActivated === false && ws9Cert.certifiedRules.paintActivated === false,
    'WS-9 certifies infrastructure, not unfinished high-capability tools.'
);
check(
    'Aggregate certificate preserves backend isolation',
    ws9Cert.certifiedRules.rawScratchBackendAuthorityExposed === false &&
        ws9Cert.certifiedRules.providerRegistryNotAuthority === true &&
        ws9Cert.certifiedRules.contextProjectionOnly === true,
    'Scratch/backend identity must not enter certified Tool semantics.'
);
check(
    'WS-9 certification package script is registered',
    typeof packageJson.scripts['test:workspace-shell:ws9-certification'] === 'string' &&
        packageJson.scripts['test:workspace-shell:ws9-certification'].includes('validate-ws9-certification.js'),
    'Certification must remain repeatable.'
);
check(
    'WS-9I certificate records full Editor Webpack PASS',
    stageCerts[8].verification.fullEditorWebpack === '0 errors / 0 warnings PASS',
    'The production GUI bootstrap change must compile through the real Editor entry.'
);
check(
    'WS-9 aggregate certificate records all frozen gate evidence',
    ws9Cert.verification.arcC0011Baseline.includes('PASS') &&
        ws9Cert.verification.lscG1.includes('PASS') &&
        ws9Cert.verification.lrcG1.includes('PASS') &&
        ws9Cert.verification.lplG1.includes('PASS') &&
        ws9Cert.verification.lexG1.includes('PASS') &&
        ws9Cert.verification.col0.includes('PASS'),
    'Aggregate certification must be anchored to existing frozen boundaries.'
);

let passed = 0;
for (const item of checks) {
    if (item.pass) {
        passed += 1;
        console.log(`PASS ${item.name} — ${item.detail}`);
    } else {
        console.error(`FAIL ${item.name} — ${item.detail}`);
    }
}

if (passed !== checks.length) {
    console.error(`\nWS-9 Certification FAILED (${passed}/${checks.length}).`);
    process.exit(1);
}

console.log(`\nWS-9 Capability / Context / Provider / Reviewed Mutation Certification PASS (${passed}/${checks.length}).`);
