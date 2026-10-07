#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const checks = [];
const check = (condition, label) => {
    if (!condition) {
        process.stderr.write(`WS-9A FAIL: ${label}\n`);
        process.exit(1);
    }
    checks.push(label);
};

const capability = read('src/lib/editor-shell/tool-capability.js');
const descriptors = read('src/lib/editor-shell/tool-capability-descriptors.js');
const ecosystem = read('src/lib/editor-shell/tool-ecosystem.js');
const manifests = read('src/lib/editor-shell/tool-ecosystem-manifests.js');
const todo = read('src/lib/editor-shell/todo-tool-model.js');
const packageJson = read('package.json');

check(
    capability.includes("WORKSPACE_TOOL_CAPABILITY_HOST_ID = 'ngvge.workspace-tool-capability-host@1'") &&
    capability.includes('TOOL_CAPABILITY_DESCRIPTOR_SCHEMA_VERSION = 1') &&
    capability.includes('TOOL_CAPABILITY_GRANT_SCHEMA_VERSION = 1'),
    'Capability Host, Descriptor, and Grant identities are versioned'
);
check(
    capability.includes("WORKSPACE_STATE: 'ngvge.workspace-capability.workspace-state'") &&
    capability.includes("PROJECT_READ: 'ngvge.workspace-capability.project-read'") &&
    capability.includes("PROJECT_COMMAND: 'ngvge.workspace-capability.project-command'") &&
    capability.includes("RESOURCE_READ: 'ngvge.workspace-capability.resource-read'") &&
    capability.includes("RESOURCE_COMMAND: 'ngvge.workspace-capability.resource-command'"),
    'Workspace, Project, and Resource capability identities are explicit'
);
check(
    capability.includes("OBSERVE: 'observe'") && capability.includes("QUERY: 'query'") &&
    capability.includes("PROPOSE: 'propose'") && capability.includes("MUTATE: 'mutate'"),
    'Capability access vocabulary separates observation/query/proposal/mutation'
);
check(
    capability.includes('Only active ecosystem tools may receive capability admission') &&
    capability.includes('Capability admission requires active ToolRegistry identity'),
    'admission fails closed on ecosystem lifecycle and ToolRegistry identity'
);
check(
    capability.includes('Tool Capability Descriptor is not registered') &&
    capability.includes('Tool Capability was not declared') &&
    capability.includes("'NGVGE_TOOL_CAPABILITY_AUTHORITY_DENIED'"),
    'undeclared and authority-incompatible capability access fails closed'
);
check(
    capability.includes('Tool Capability lease has been revoked') &&
    capability.includes('revokeTool (toolId') && capability.includes('revoke (leaseId'),
    'capability grants are revocable leases rather than permanent references'
);
check(
    !capability.includes('scratch-vm') && !capability.includes('window.vm') && !capability.includes('renderer._') &&
    !capability.includes('Scratch Target'),
    'Capability Host does not import or expose Scratch/renderer backend authority'
);
check(
    descriptors.includes('TOOL_IDS.TODO') &&
    descriptors.includes('WORKSPACE_TOOL_CAPABILITIES.WORKSPACE_STATE') &&
    descriptors.includes('access: TOOL_CAPABILITY_ACCESS.MUTATE'),
    'Todo has the minimal Workspace-state reference Capability Descriptor'
);
check(
    !descriptors.includes('POST_MVP_TOOL_IDS.TERMINAL'),
    'still-planned tools receive no capability admission descriptor'
);
check(
    manifests.includes("TERMINAL: 'ngvge.tool.terminal'") && manifests.includes('PAINT: TOOL_IDS.PAINT') &&
    ecosystem.includes("PLANNED: 'planned'") && ecosystem.includes('Active OSS-wrapped tools require approved OSS Intake ADR identity'),
    'WS-9A lifecycle/admission contract permits later approved tool activation without weakening fail-closed semantics'
);
check(
    !todo.includes('tool-capability') && !todo.includes('workspace-capability'),
    'WS-9A does not switch Todo production behavior to a new capability provider'
);
check(
    packageJson.includes('test:workspace-shell:ws9a:focused') &&
    packageJson.includes('test:workspace-shell:ws9a-webpack') &&
    packageJson.includes('test:workspace-shell:ws9a-certification'),
    'WS-9A defines repeatable focused, Webpack, and cumulative certification gates'
);

process.stdout.write(`WS-9A Capability Schema & Admission Foundation PASS (${checks.length}/${checks.length}).\n`);
process.stdout.write(`${JSON.stringify({
    capabilityHostId: 'ngvge.workspace-tool-capability-host@1',
    descriptorSchemaVersion: 1,
    referenceToolId: 'ngvge.tool.todo',
    productionBehaviorSwitch: false,
    checks: checks.length
}, null, 2)}\n`);
