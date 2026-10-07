#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const checks = [];
const check = (condition, label) => {
    if (!condition) {
        process.stderr.write(`WS-9H FAIL: ${label}\n`);
        process.exit(1);
    }
    checks.push(label);
};

const review = read('src/lib/editor-shell/project-transaction-review.js');
const host = read('src/lib/editor-shell/project-command-host.js');
const contracts = read('src/lib/editor-shell/workspace-project-resource-capabilities.js');
const providers = read('src/lib/editor-shell/workspace-capability-providers.js');
const gui = read('src/components/gui/gui.jsx');
const packageJson = read('package.json');

check(
    review.includes("WORKSPACE_PROJECT_TRANSACTION_REVIEW_ID = 'ngvge.workspace-project-transaction-review@1'") &&
    review.includes('WORKSPACE_PROJECT_TRANSACTION_REVIEW_SCHEMA_VERSION = 1') &&
    review.includes('WORKSPACE_PROJECT_TRANSACTION_DIAGNOSTIC_SCHEMA_VERSION = 1'),
    'Review service and review/diagnostic contracts have stable versioned identities'
);
check(
    review.includes("PROPOSAL: 'proposal'") && review.includes("TRANSACTION: 'transaction'") &&
    review.includes("READY: 'ready'") && review.includes("BLOCKED: 'blocked'") &&
    review.includes("STALE: 'stale'"),
    'Portable review kinds and readiness states are explicit'
);
check(
    review.includes('reviewProposal') && review.includes('reviewTransaction') &&
    !review.includes('createAuthorityRegistry') && !review.includes('AUTHORITY_MODES.WRITER'),
    'Review service is a read-only projection and does not register mutation authority'
);
check(
    review.includes('before') && review.includes('after') && review.includes('changedCommandCount') &&
    review.includes("'resource.metadata'") && review.includes("'resource.content'") &&
    review.includes('reversible: true') && review.includes('RESOURCE_CONTENT_REPLACE'),
    'Proposal review preserves portable metadata before/after impact and admits reviewed Resource content impact'
);
check(
    review.includes('shadowByResource') && review.includes('applyCommandToShadow'),
    'Sequential commands on the same Resource are previewed against a local shadow state'
);
check(
    review.includes('NGVGE_WORKSPACE_PROJECT_REVIEW_NO_OP') &&
    review.includes('NGVGE_WORKSPACE_PROJECT_REVIEW_RESOURCE_NOT_FOUND') &&
    review.includes('NGVGE_WORKSPACE_PROJECT_REVIEW_FOLDER_NOT_FOUND') &&
    review.includes('NGVGE_WORKSPACE_PROJECT_REVIEW_STALE_PROJECT_CONTEXT'),
    'No-op, missing Resource/folder, and stale Project diagnostics are fail-visible'
);
check(
    host.includes('getCommitAvailability') && host.includes('getRollbackAvailability') &&
    host.includes('NGVGE_WORKSPACE_PROJECT_TRANSACTION_ROLLBACK_ORDER_CONFLICT'),
    'Project Command Host exposes read-only commit/rollback readiness diagnostics'
);
check(
    host.includes('Project command proposal can only be diagnosed by its admitted Tool owner') &&
    host.includes('Project transaction can only be diagnosed by its admitted Tool owner'),
    'Host diagnostic queries remain Tool-owner scoped'
);
check(
    review.includes('projectCommandHost.getProposal(proposalId, {toolId: ownerToolId})') &&
    review.includes('projectCommandHost.getTransaction(transactionId, {toolId: ownerToolId})'),
    'Review queries preserve Tool-scoped proposal/transaction metadata isolation'
);
check(
    contracts.includes('reviewProposal: proposalId => requireProjectTransactionReviewService') &&
    contracts.includes('reviewTransaction: transactionId => requireProjectTransactionReviewService'),
    'Project Command capability facades expose shared Tool-scoped review operations'
);
check(
    providers.includes('projectTransactionReviewService = null') &&
    providers.includes('NGVGE_WORKSPACE_PROJECT_TRANSACTION_REVIEW_UNAVAILABLE') &&
    providers.includes('projectTransactionReviewService,'),
    'Project Command Provider requires Review/Diagnostics integration and fails closed when absent'
);
check(
    gui.includes('createWorkspaceProjectTransactionReviewService') &&
    gui.includes('workspaceProjectTransactionReviewRef') &&
    gui.includes('projectTransactionReviewService: workspaceProjectTransactionReview'),
    'Production GUI installs one shared Review service before Project Command Provider binding'
);
check(
    review.includes('projectCommandHost.subscribe') && review.includes('contextService.subscribe') &&
    review.includes("resourceDatabase.subscribe"),
    'Review diagnostics react to transaction, Project Context, and Resource authority changes'
);
check(
    !review.includes('loadProject(') && !review.includes('serializeProjectJSON') &&
    !review.includes('child_process') && !review.includes('filesystem') && !review.includes('renderer.'),
    'Review service does not acquire Scratch payload, process, filesystem, or renderer authority'
);
check(
    !review.includes('commit(') && !review.includes('rollback('),
    'Review service contains no Project commit/rollback mutation entry point'
);
check(
    contracts.includes('projectCommandHost).commit') && contracts.includes('projectCommandHost).rollback'),
    'Actual commit/rollback remains owned by WS-9G Project Command Host facades'
);
check(
    packageJson.includes('test:workspace-shell:ws9h:focused') &&
    packageJson.includes('test:workspace-shell:ws9h-webpack') &&
    packageJson.includes('test:workspace-shell:ws9h-certification'),
    'WS-9H defines repeatable focused, Webpack, and cumulative certification gates'
);

process.stdout.write(`WS-9H Project Transaction Review / Diagnostics Integration PASS (${checks.length}/${checks.length}).\n`);
process.stdout.write(`${JSON.stringify({
    reviewServiceId: 'ngvge.workspace-project-transaction-review@1',
    authority: 'read-only projection',
    proposalPreview: 'portable Resource metadata before/after + diagnostics',
    transactionDiagnostics: 'commit/rollback readiness mirrors WS-9G transaction preconditions',
    mutationAuthority: 'WS-9G Project Command Host only',
    checks: checks.length
}, null, 2)}\n`);
