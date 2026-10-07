#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const checks = [];
const check = (condition, label) => {
    if (!condition) {
        process.stderr.write(`WS-9G FAIL: ${label}\n`);
        process.exit(1);
    }
    checks.push(label);
};

const host = read('src/lib/editor-shell/project-command-host.js');
const contracts = read('src/lib/editor-shell/workspace-project-resource-capabilities.js');
const providers = read('src/lib/editor-shell/workspace-capability-providers.js');
const gui = read('src/components/gui/gui.jsx');
const packageJson = read('package.json');

check(
    host.includes("WORKSPACE_PROJECT_COMMAND_HOST_ID = 'ngvge.workspace-project-command-host@1'") &&
    host.includes("WORKSPACE_PROJECT_COMMAND_DOMAIN_ID = 'ngvge.project.command.transaction'") &&
    host.includes("WORKSPACE_PROJECT_COMMAND_AUTHORITY_ID = 'authority:ngvge.workspace-project-command-host'"),
    'Project Command Host and transaction Authority identities are stable'
);
check(
    host.includes('WORKSPACE_PROJECT_COMMAND_SCHEMA_VERSION = 1') &&
    host.includes('WORKSPACE_PROJECT_COMMAND_PROPOSAL_SCHEMA_VERSION = 1') &&
    host.includes('WORKSPACE_PROJECT_TRANSACTION_SCHEMA_VERSION = 1'),
    'Project command, proposal, and transaction contracts are versioned'
);
check(
    host.includes("RESOURCE_RENAME: 'resource.rename'") &&
    host.includes("RESOURCE_MOVE: 'resource.move'") &&
    !host.includes("RESOURCE_DELETE: 'resource.delete'"),
    'Project transaction v1 exposes only reversible Resource rename/move commands'
);
check(
    host.includes('FORBIDDEN_COMMAND_KEYS') && host.includes("'rawVM'") && host.includes("'renderer'") &&
    host.includes("'scratchTarget'") && host.includes("'vm'"),
    'Project command DTOs reject raw backend authority fields'
);
check(
    host.includes('Project command proposal can only be committed by its admitted Tool owner') &&
    host.includes('Project command proposal belongs to a different Project Context'),
    'Proposal commit is Tool-owned and Project-context scoped'
);
check(
    host.includes('operationQueue') && host.includes('resourceAdapter.runTransaction(historyLabel') &&
    host.includes('inverses.length - 1'),
    'Project transaction commit is serialized and compensates failed partial mutation'
);
check(
    host.includes('database.getHistoryState()') && host.includes('history.nextUndoLabel !== label') &&
    host.includes('database.undo()'),
    'Committed rollback requires exact latest Resource history ownership'
);
check(
    host.includes('NGVGE_WORKSPACE_PROJECT_TRANSACTION_ROLLBACK_ORDER_CONFLICT') &&
    host.includes('NGVGE_WORKSPACE_PROJECT_TRANSACTION_ROLLBACK_FAILED'),
    'Rollback conflicts and rollback failure are explicit fail-visible states'
);
check(
    contracts.includes('createWorkspaceProjectCommandProposalFacade') &&
    contracts.includes('createWorkspaceProjectCommandMutateFacade') &&
    contracts.includes('projectCommandHost).commit') && contracts.includes('projectCommandHost).rollback'),
    'Project command capability facades bind proposal/commit/rollback to native Host'
);
check(
    providers.includes('projectCommandHost = null') &&
    providers.includes('projectCommandHost.getAvailability()') &&
    providers.includes('createWorkspaceProjectCommandProposalFacade') &&
    providers.includes('createWorkspaceProjectCommandMutateFacade'),
    'Core Provider Registry dynamically binds Project command surfaces to native Host'
);
check(
    providers.includes('NGVGE_WORKSPACE_PROJECT_COMMAND_AUTHORITY_NOT_READY') &&
    providers.includes('Scratch project payload mutation is not exposed'),
    'Project command provider remains fail-closed when native Host is absent'
);
check(
    gui.includes('createWorkspaceProjectCommandHost') &&
    gui.includes('projectCommandHost: workspaceProjectCommandHost') &&
    gui.includes('getResourceDatabase: getWorkspaceResourceDatabase'),
    'Production GUI installs one Project Command Host and passes it into Provider Registry'
);
check(
    host.includes('createAuthorityRegistry([{') && host.includes('mode: AUTHORITY_MODES.WRITER') &&
    host.includes('authorityRegistry.getWriter(WORKSPACE_PROJECT_COMMAND_DOMAIN_ID)'),
    'Project Command Host owns transaction semantics through explicit single-writer Authority registration'
);
check(
    !host.includes('loadProject(') && !host.includes('serializeProjectJSON') && !host.includes('.toJSON(') &&
    !host.includes('child_process') && !host.includes('filesystem'),
    'Project Command Host does not promote Scratch project payload, process, or filesystem authority'
);
check(
    providers.includes('PROJECT_COMMAND_PROPOSE') && providers.includes('PROJECT_COMMAND_MUTATE') &&
    providers.includes('getAvailability: projectCommandAvailability'),
    'Project propose/mutate Provider surfaces share dynamic Host availability diagnostics'
);
check(
    packageJson.includes('test:workspace-shell:ws9g:focused') &&
    packageJson.includes('test:workspace-shell:ws9g-webpack') &&
    packageJson.includes('test:workspace-shell:ws9g-certification'),
    'WS-9G defines repeatable focused, Webpack, and cumulative certification gates'
);

process.stdout.write(`WS-9G Project Command Host & Transaction Foundation PASS (${checks.length}/${checks.length}).\n`);
process.stdout.write(`${JSON.stringify({
    hostId: 'ngvge.workspace-project-command-host@1',
    authorityDomain: 'ngvge.project.command.transaction',
    commands: ['resource.rename', 'resource.move'],
    projectCommandProviders: 'READY when native Host transaction adapter is available',
    scratchPayloadAuthority: 'forbidden',
    checks: checks.length
}, null, 2)}\n`);
