#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const checks = [];
const check = (condition, label) => {
    if (!condition) {
        process.stderr.write(`WS-9D FAIL: ${label}\n`);
        process.exit(1);
    }
    checks.push(label);
};

const capability = read('src/lib/editor-shell/tool-capability.js');
const descriptors = read('src/lib/editor-shell/tool-capability-descriptors.js');
const manifests = read('src/lib/editor-shell/tool-ecosystem-manifests.js');
const context = read('src/lib/editor-shell/workspace-context.js');
const consumer = read('src/lib/editor-shell/workspace-context-consumer.js');
const agentRuntime = read('src/lib/editor-shell/agent-workspace-runtime.js');
const agentModel = read('src/lib/editor-shell/agent-workspace-model.js');
const gui = read('src/components/gui/gui.jsx');
const packageJson = read('package.json');

check(
    consumer.includes("WORKSPACE_CONTEXT_CONSUMER_ADMISSION_ID = 'ngvge.workspace-context-consumer-admission@1'") &&
    consumer.includes('capabilityHost.admit(toolId)') &&
    consumer.includes('providerRegistry.bind({') &&
    consumer.includes('WORKSPACE_TOOL_CAPABILITIES.CONTEXT_READ') &&
    !consumer.includes('contextService'),
    'Context consumer admission remains versioned and may only resolve Context through admitted provider binding'
);
check(
    descriptors.includes('toolId: TOOL_IDS.AGENT') &&
    descriptors.includes('capabilityId: WORKSPACE_TOOL_CAPABILITIES.CONTEXT_READ') &&
    descriptors.includes('access: TOOL_CAPABILITY_ACCESS.QUERY'),
    'Agent explicitly declares context-read/query rather than implicit Context access'
);
check(
    manifests.includes('toolId: TOOL_IDS.AGENT') &&
    manifests.includes('TOOL_ECOSYSTEM_SERVICES.CONTEXT') &&
    manifests.includes('TOOL_ECOSYSTEM_SERVICES.AGENT_TRANSACTION'),
    'Agent has an active ecosystem manifest with Context and reviewed transaction dependencies'
);
check(
    !agentRuntime.includes('getCurrentNodeId') &&
    agentRuntime.includes('contextReadCapability.getSnapshot()') &&
    agentRuntime.includes('context.primaryNodeId'),
    'Agent production runtime no longer consumes getCurrentNodeId bypass'
);
check(
    !agentRuntime.includes('WorkspaceContextService') &&
    !agentRuntime.includes('workspaceContextService') &&
    agentRuntime.includes('contextReadCapability'),
    'Agent receives a capability facade rather than raw WorkspaceContextService'
);
check(
    gui.includes('admitWorkspaceContextConsumer') &&
    gui.includes('toolId: TOOL_IDS.AGENT') &&
    gui.includes('contextReadCapability: agentContextConsumer.contextRead'),
    'GUI bootstrap performs Agent capability admission before runtime construction'
);
check(
    !gui.includes('agentSelectedNodeIdRef') && !gui.includes('getCurrentNodeId:'),
    'GUI removes the legacy Agent selected-Node ref callback path'
);
check(
    capability.includes("event.type !== 'tool:unregistered'") &&
    capability.includes("this.revokeTool(event.toolId, 'tool-unregistered')") &&
    capability.includes('subscribeRevocation') && capability.includes('dispose ()'),
    'Tool unload and Capability Host disposal revoke leases immediately'
);
check(
    context.includes('capabilityLease.subscribeRevocation') && context.includes('cleanup()'),
    'Context subscriptions detach immediately when capability admission is revoked'
);
check(
    agentModel.includes('notifyContextChanged') &&
    agentRuntime.includes("model.notifyContextChanged()"),
    'Agent model revision follows admitted Context events instead of retaining stale selection UI'
);
check(
    agentRuntime.includes('return Object.freeze({nodeId, node: projectSafeNode(snapshot)})') &&
    !agentRuntime.includes('projectId: context.projectId') &&
    !agentRuntime.includes('resourceId: context.resourceId'),
    'Agent migration preserves the WS-7 minimal safe Node context projection'
);
check(
    !descriptors.includes('POST_MVP_TOOL_IDS.TERMINAL') && !descriptors.includes('POST_MVP_TOOL_IDS.PAINT'),
    'WS-9D itself does not couple Agent migration to Post-MVP Tool manifest constants; later admitted tools use stable TOOL_IDS descriptors'
);
check(
    packageJson.includes('test:workspace-shell:ws9d:focused') &&
    packageJson.includes('test:workspace-shell:ws9d-webpack') &&
    packageJson.includes('test:workspace-shell:ws9d-certification'),
    'WS-9D defines repeatable focused, Webpack, and cumulative certification gates'
);

process.stdout.write(`WS-9D Context Consumer Admission & Agent Migration PASS (${checks.length}/${checks.length}).\n`);
process.stdout.write(`${JSON.stringify({
    consumerAdmissionId: 'ngvge.workspace-context-consumer-admission@1',
    agentToolId: 'ngvge.tool.agent',
    contextCapability: 'ngvge.workspace-capability.context-read#query',
    legacyGetCurrentNodeId: false,
    checks: checks.length
}, null, 2)}\n`);
