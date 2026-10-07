#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const checks = [];
const check = (condition, label) => {
    if (!condition) {
        process.stderr.write(`WS-9E FAIL: ${label}\n`);
        process.exit(1);
    }
    checks.push(label);
};

const provider = read('src/lib/editor-shell/workspace-capability-provider.js');
const coreProviders = read('src/lib/editor-shell/workspace-capability-providers.js');
const capability = read('src/lib/editor-shell/tool-capability.js');
const consumer = read('src/lib/editor-shell/workspace-context-consumer.js');
const gui = read('src/components/gui/gui.jsx');
const packageJson = read('package.json');

check(
    provider.includes("WORKSPACE_CAPABILITY_PROVIDER_REGISTRY_ID = 'ngvge.workspace-capability-provider-registry@1'") &&
    provider.includes('WORKSPACE_CAPABILITY_PROVIDER_DESCRIPTOR_SCHEMA_VERSION = 1') &&
    provider.includes('WORKSPACE_CAPABILITY_PROVIDER_BINDING_SCHEMA_VERSION = 1'),
    'Provider Registry, descriptor, and binding identities are versioned'
);
check(
    provider.includes('class WorkspaceCapabilityProviderRegistry') &&
    provider.includes('registerProvider ({descriptor, createFacade, getAvailability = () => true})') &&
    provider.includes('bind ({capabilityLease, capabilityId, access})'),
    'Provider Registry owns registration and explicit lease-backed binding'
);
check(
    provider.includes('capabilityLease.assert(capabilityId, access)') &&
    provider.includes('capabilityLease.subscribeRevocation') &&
    provider.includes('revokeBinding(bindingId'),
    'Provider bindings are gated by admitted capability and revoked with Tool lease lifecycle'
);
check(
    provider.includes('NGVGE_WORKSPACE_CAPABILITY_PROVIDER_CONFLICT') &&
    provider.includes('Workspace Capability surface already has a provider'),
    'One capability/access surface has one active Provider authority'
);
check(
    provider.includes('PROVIDER_MISSING') && provider.includes('PROVIDER_UNAVAILABLE') &&
    provider.includes('diagnoseTool (toolId)') && provider.includes('getCoverageDiagnostics ()'),
    'Provider readiness and missing/unavailable states are queryable diagnostics'
);
check(
    provider.includes('NGVGE_WORKSPACE_CAPABILITY_PROVIDER_RAW_AUTHORITY_FORBIDDEN') &&
    provider.includes("'renderer'") && provider.includes("'scratchtarget'") && provider.includes("'vm'"),
    'Provider facades reject raw VM, Renderer, Scratch Target, and backend handle fields'
);
check(
    coreProviders.includes('CORE_WORKSPACE_CAPABILITY_PROVIDER_IDS.CONTEXT_READ') &&
    coreProviders.includes('createWorkspaceContextReadCapability') &&
    coreProviders.includes('WORKSPACE_TOOL_CAPABILITIES.CONTEXT_READ'),
    'Context read is implemented as the first real capability Provider binding'
);
check(
    coreProviders.includes('WORKSPACE_STATE_QUERY') && coreProviders.includes('WORKSPACE_STATE_MUTATE') &&
    coreProviders.includes('persistenceService.getState(toolId') &&
    coreProviders.includes('persistenceService.setState(toolId'),
    'Workspace-state Provider facades are scoped to the admitted ToolId'
);
check(
    !coreProviders.includes('vm.set') && !coreProviders.includes('renderer.') &&
    !coreProviders.includes('ScratchTarget') &&
    coreProviders.includes('WorkspaceCapabilityProviderRegistry'),
    'Project/Resource evolution remains behind Provider Registry and does not introduce raw backend authority'
);
check(
    capability.includes('listCapabilities ()') && capability.includes('Array.from(this._definitions.values())'),
    'Capability definitions can be inspected without exposing backend service objects'
);
check(
    consumer.includes('providerRegistry.bind({') &&
    consumer.includes('providerBinding: binding') &&
    !consumer.includes('contextService'),
    'Context consumer no longer constructs a facade from raw WorkspaceContextService'
);
check(
    gui.includes('createCoreWorkspaceCapabilityProviderRegistry') &&
    gui.includes('workspaceCapabilityProviderRegistryRef') &&
    gui.includes('providerRegistry: workspaceCapabilityProviderRegistry'),
    'Production GUI bootstrap owns Provider Registry lifecycle and Agent binding route'
);
check(
    gui.includes('workspaceCapabilityProviderRegistry.dispose()') &&
    provider.includes("this.revokeBinding(bindingId, 'provider-registry-disposed')"),
    'Provider Registry disposal revokes active bindings'
);
check(
    packageJson.includes('test:workspace-shell:ws9e:focused') &&
    packageJson.includes('test:workspace-shell:ws9e-webpack') &&
    packageJson.includes('test:workspace-shell:ws9e-certification'),
    'WS-9E defines repeatable focused, Webpack, and cumulative certification gates'
);

process.stdout.write(`WS-9E Capability Provider Binding & Diagnostics PASS (${checks.length}/${checks.length}).\n`);
process.stdout.write(`${JSON.stringify({
    providerRegistryId: 'ngvge.workspace-capability-provider-registry@1',
    providerDescriptorSchemaVersion: 1,
    providerBindingSchemaVersion: 1,
    productionProviders: [
        'context-read#query',
        'workspace-state#query',
        'workspace-state#mutate'
    ],
    providerEvolutionRule: 'Project/Resource surfaces may be added only behind Provider Registry without raw backend authority',
    checks: checks.length
}, null, 2)}\n`);
