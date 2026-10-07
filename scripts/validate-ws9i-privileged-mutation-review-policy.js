#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const checks = [];
const check = (condition, label) => {
    if (!condition) {
        process.stderr.write(`WS-9I FAIL: ${label}\n`);
        process.exit(1);
    }
    checks.push(label);
};

const policy = read('src/lib/editor-shell/privileged-mutation-review-policy.js');
const contracts = read('src/lib/editor-shell/workspace-project-resource-capabilities.js');
const providers = read('src/lib/editor-shell/workspace-capability-providers.js');
const review = read('src/lib/editor-shell/project-transaction-review.js');
const capability = read('src/lib/editor-shell/tool-capability-descriptors.js');
const gui = read('src/components/gui/gui.jsx');
const packageJson = read('package.json');

check(
    policy.includes("WORKSPACE_PRIVILEGED_MUTATION_REVIEW_POLICY_ID = 'ngvge.workspace-privileged-mutation-review-policy@1'") &&
    policy.includes('WORKSPACE_PRIVILEGED_MUTATION_REVIEW_POLICY_SCHEMA_VERSION = 1') &&
    policy.includes('WORKSPACE_MUTATION_REVIEW_EVIDENCE_SCHEMA_VERSION = 1'),
    'Privileged mutation Review Policy and Evidence contracts have stable versioned identities'
);
check(
    policy.includes("REVIEW_REQUIRED: 'review-required'") &&
    policy.includes("DIRECT_DENIED: 'direct-denied'") &&
    policy.includes("NOT_REQUIRED: 'not-required'"),
    'Review Policy distinguishes required review, direct denial, and standard non-reviewed surfaces'
);
check(
    policy.includes('WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND') &&
    policy.includes("mode: WORKSPACE_MUTATION_REVIEW_MODES.REVIEW_REQUIRED"),
    'project-command#mutate is explicitly review-required'
);
check(
    policy.includes('WORKSPACE_TOOL_CAPABILITIES.RESOURCE_COMMAND') &&
    policy.includes("mode: WORKSPACE_MUTATION_REVIEW_MODES.DIRECT_DENIED") &&
    policy.includes('NGVGE_WORKSPACE_RESOURCE_DIRECT_MUTATION_REVIEW_REQUIRED'),
    'resource-command#mutate is explicitly denied as a direct privileged bypass'
);
check(
    capability.includes('capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND') &&
    capability.includes('capabilityId: WORKSPACE_TOOL_CAPABILITIES.RESOURCE_COMMAND') &&
    capability.match(/privilege: TOOL_CAPABILITY_PRIVILEGES\.SENSITIVE/g).length >= 2,
    'Both Project and Resource command capabilities remain classified sensitive'
);
check(
    policy.includes('capabilityLeaseId: capabilityLease.id') &&
    policy.includes('state.capabilityLeaseId !== lease.id') &&
    policy.includes('state.toolId !== ownerToolId'),
    'Review Evidence is bound to Capability lease generation and Tool owner'
);
check(
    policy.includes('projectId: review.projectId') &&
    policy.includes('review.projectId !== state.projectId') &&
    policy.includes('currentReviewState.revision !== state.reviewRevision'),
    'Review Evidence is Project-bound and revision-fresh'
);
check(
    policy.includes("CONSUMED: 'consumed'") &&
    policy.includes("state.state = WORKSPACE_MUTATION_REVIEW_EVIDENCE_STATES.CONSUMED") &&
    policy.includes('NGVGE_WORKSPACE_MUTATION_REVIEW_EVIDENCE_CONSUMED'),
    'Review Evidence is one-shot and reuse is fail-closed'
);
check(
    policy.includes('capabilityLease.subscribeRevocation') &&
    policy.includes("state.state = WORKSPACE_MUTATION_REVIEW_EVIDENCE_STATES.REVOKED") &&
    policy.includes('capability-lease:'),
    'Capability lease revocation invalidates outstanding Review Evidence'
);
check(
    policy.includes('prepareCommitReview') && policy.includes('prepareRollbackReview') &&
    policy.includes('consumeCommitEvidence') && policy.includes('consumeRollbackEvidence'),
    'Commit and rollback each require explicit Review Evidence lifecycle'
);
check(
    contracts.includes('prepareMutationReview') && contracts.includes('reviewEvidence') &&
    contracts.includes('.consumeCommitEvidence') && contracts.includes('.consumeRollbackEvidence'),
    'Project Command provider facades enforce Review Evidence before Host commit/rollback'
);
check(
    providers.includes('projectCommandMutateAvailability') &&
    providers.includes('NGVGE_WORKSPACE_PRIVILEGED_MUTATION_REVIEW_POLICY_UNAVAILABLE') &&
    providers.includes("policy.mode !== 'review-required'"),
    'Project mutation Provider fails closed when the shared Review Policy is absent or invalid'
);
check(
    providers.includes('resourceCommandMutateAvailability') &&
    providers.includes("policy.mode === 'direct-denied'") &&
    providers.includes('NGVGE_WORKSPACE_RESOURCE_DIRECT_MUTATION_REVIEW_REQUIRED'),
    'Core Resource mutate Provider is unavailable under direct-denied policy'
);
check(
    review.includes("emit('source:resource-binding'") &&
    review.includes("emit('source:resource'") && review.includes("emit('source:context'"),
    'Review freshness observes Resource authority replacement, Resource state, and Project Context changes'
);
check(
    gui.includes('createWorkspacePrivilegedMutationReviewPolicy') &&
    gui.includes('workspacePrivilegedMutationReviewPolicyRef') &&
    gui.includes('privilegedMutationReviewPolicy: workspacePrivilegedMutationReviewPolicy'),
    'Production GUI installs one shared Review Policy before Capability Provider binding'
);
check(
    !policy.includes('createAuthorityRegistry') && !policy.includes('AUTHORITY_MODES.WRITER') &&
    !policy.includes('vm.loadProject') && !policy.includes('renderer.') &&
    !policy.includes('child_process') && !policy.includes('filesystem'),
    'Review Policy owns admission evidence only and acquires no Project/backend/process authority'
);
check(
    contracts.indexOf('.consumeCommitEvidence') < contracts.indexOf('projectCommandHost).commit') &&
    contracts.indexOf('.consumeRollbackEvidence') < contracts.indexOf('projectCommandHost).rollback'),
    'Review Evidence is consumed before Project mutation reaches WS-9G Host'
);
check(
    packageJson.includes('test:workspace-shell:ws9i:focused') &&
    packageJson.includes('test:workspace-shell:ws9i-webpack') &&
    packageJson.includes('test:workspace-shell:ws9-certification'),
    'WS-9I and WS-9 define repeatable focused/Webpack/final certification gates'
);

process.stdout.write(`WS-9I Privileged Tool Mutation Review Policy PASS (${checks.length}/${checks.length}).\n`);
process.stdout.write(`${JSON.stringify({
    policyId: 'ngvge.workspace-privileged-mutation-review-policy@1',
    projectMutation: 'fresh one-shot Review Evidence required',
    resourceDirectMutation: 'denied; reviewed Project transaction required for supported operations',
    evidenceBinding: ['toolId', 'capabilityLeaseId', 'projectId', 'reviewRevision', 'subjectId', 'operation'],
    checks: checks.length
}, null, 2)}\n`);
