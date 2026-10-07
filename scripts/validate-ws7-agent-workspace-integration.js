#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const walk = relative => {
    const target = path.join(root, relative);
    const output = [];
    const visit = current => {
        fs.readdirSync(current, {withFileTypes: true}).forEach(entry => {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) visit(full);
            else output.push(path.relative(root, full));
        });
    };
    visit(target);
    return output;
};
const checks = [];
const check = (condition, label) => {
    if (!condition) {
        process.stderr.write(`WS-7 FAIL: ${label}\n`);
        process.exit(1);
    }
    checks.push(label);
};

const registry = read('src/lib/editor-shell/tool-registry.js');
const nodeBoundary = read('src/lib/editor-shell/node-workspace-command.js');
const changeSet = read('src/lib/editor-shell/agent-change-set.js');
const transaction = read('src/lib/editor-shell/agent-transaction-host.js');
const model = read('src/lib/editor-shell/agent-workspace-model.js');
const runtime = read('src/lib/editor-shell/agent-workspace-runtime.js');
const component = read('src/components/workspace-agent/workspace-agent.jsx');
const dock = read('src/components/workspace-dock/workspace-dock.jsx');
const launchpad = read('src/components/workspace-launchpad/workspace-launchpad.jsx');
const gui = read('src/components/gui/gui.jsx');
const legacyPolicy = read('src/addons/addons/02agent/legacySafetyPolicy.ts');
const packageJson = read('package.json');

const agentFiles = [
    'src/lib/editor-shell/agent-change-set.js',
    'src/lib/editor-shell/agent-transaction-host.js',
    'src/lib/editor-shell/agent-workspace-model.js',
    'src/lib/editor-shell/agent-workspace-runtime.js',
    'src/components/workspace-agent/workspace-agent.jsx'
];
const agentSource = agentFiles.map(read).join('\n');
const reviewedClientConsumers = walk('src').filter(relative => {
    if (!/\.(js|jsx|ts|tsx)$/.test(relative)) return false;
    return read(relative).includes('createReviewedAgentNodeCommandClient');
});

const agentDefinitionStart = registry.indexOf('id: TOOL_IDS.AGENT');
const agentDefinitionEnd = registry.indexOf('id: TOOL_IDS.EDITOR', agentDefinitionStart);
const agentDefinition = registry.slice(agentDefinitionStart, agentDefinitionEnd);
const pinnedStart = gui.indexOf('const DEFAULT_DOCK_PINNED_TOOL_IDS');
const pinnedEnd = gui.indexOf(']);', pinnedStart) + 3;
const pinnedSource = gui.slice(pinnedStart, pinnedEnd);

check(
    registry.includes("AGENT: 'ngvge.tool.agent'") && registry.includes("AGENT: 'agent'"),
    'Agent ToolId and WindowId are stable and distinct'
);
check(
    agentDefinition.includes("title: 'NGVGE Agent'") &&
    agentDefinition.includes("commandScope: 'agent'") &&
    agentDefinition.includes('source: {kind: TOOL_SOURCE_KINDS.FIRST_PARTY') &&
    agentDefinition.includes('singleton: true') &&
    agentDefinition.includes('defaultVisible: false'),
    'Agent is a default-hidden singleton first-party Workspace Tool'
);
check(
    dock.includes("'agent': (") && launchpad.includes("'agent': <path"),
    'Agent exposes SVG-only Dock and Launchpad glyphs'
);
check(
    !pinnedSource.includes('TOOL_IDS.AGENT'),
    'Agent remains discoverable through ToolRegistry/Launchpad without forcing a default Dock pin'
);
check(
    changeSet.includes("WORKSPACE_AGENT_CHANGESET_MODEL_ID = 'ngvge.workspace-agent-changeset-model@1'") &&
    changeSet.includes('AGENT_CHANGESET_SCHEMA_VERSION = 1') &&
    changeSet.includes('AGENT_CHANGESET_OPERATION_SCHEMA_VERSION = 1'),
    'Agent ChangeSet identity and schemas are versioned'
);
check(
    changeSet.includes("WORKSPACE_NODE_COMMAND: 'workspace-node-command'") &&
    ['CreateNode', 'DuplicateNode', 'PatchNode', 'ReparentNode'].every(type => changeSet.includes(`'${type}'`)),
    'ChangeSet v1 contains only reversible Workspace Node command operations'
);
check(
    !changeSet.includes("'DestroyNode'") && changeSet.includes('NGVGE_AGENT_CHANGESET_COMMAND_NOT_REVERSIBLE'),
    'destructive Node deletion is fail-closed until a reversible Agent transaction adapter exists'
);
check(
    changeSet.includes('FORBIDDEN_KEYS') && ['renderer', 'targetId', 'vm', 'scratchTargetId']
        .every(key => changeSet.includes(`'${key}'`)),
    'ChangeSet rejects backend identity and raw runtime object smuggling'
);
check(
    transaction.includes("WORKSPACE_AGENT_TRANSACTION_HOST_ID = 'ngvge.workspace-agent-transaction-host@1'") &&
    transaction.includes('createReviewedAgentNodeCommandClient(workspaceNodeCommandHost)'),
    'Agent mutation enters a dedicated reviewed transaction host'
);
check(
    nodeBoundary.includes("AGENT_TRANSACTION_AUTHORIZATION = Symbol('ngvge.agent-reviewed-node-command')") &&
    nodeBoundary.includes('NGVGE_AGENT_NODE_REVIEW_REQUIRED'),
    'Workspace Node Host requires private reviewed-transaction authorization for Agent provenance'
);
check(
    nodeBoundary.includes('INTERACTIVE_TOOL_IDS = new Set([TOOL_IDS.NODE_EXPLORER, TOOL_IDS.INSPECTOR])') &&
    nodeBoundary.includes('createReviewedAgentNodeCommandClient'),
    'ordinary interactive Node clients cannot self-declare Agent mutation provenance'
);
check(
    reviewedClientConsumers.length === 2 &&
    reviewedClientConsumers.includes('src/lib/editor-shell/node-workspace-command.js') &&
    reviewedClientConsumers.includes('src/lib/editor-shell/agent-transaction-host.js'),
    'reviewed Agent Node client is consumed only by its defining boundary and transaction host'
);
check(
    transaction.includes('changeSet.state !== AGENT_CHANGESET_STATES.APPROVED') &&
    transaction.includes('NGVGE_AGENT_CHANGESET_REVIEW_REQUIRED'),
    'Transaction Host refuses unreviewed ChangeSets before any mutation'
);
check(
    transaction.includes('compensations.push(') && transaction.includes('executeCompensation(') &&
    transaction.includes('for (let index = compensations.length - 1; index >= 0; index--)'),
    'Agent transaction generates trusted compensation and rolls back in reverse order'
);
check(
    transaction.includes('rollback = async transactionId') &&
    transaction.includes('AGENT_TRANSACTION_STATES.ROLLED_BACK'),
    'committed Agent transactions expose an explicit Undo/Rollback lifecycle'
);
check(
    model.includes("WORKSPACE_AGENT_MODEL_ID = 'ngvge.workspace-agent-model@1'") &&
    runtime.includes("WORKSPACE_AGENT_RUNTIME_ID = 'ngvge.workspace-agent-runtime@1'"),
    'Agent Workspace model/runtime identities are stable'
);
check(
    model.includes('proposeChangeSet') && model.includes('rejectChangeSet') &&
    model.includes('applyChangeSet') && model.includes('async undo'),
    'Agent model exposes Proposal / Review / Apply / Reject / Undo workflow'
);
check(
    component.includes('Current Context') && component.includes('What AI can see') &&
    component.includes('Proposed Changes') && component.includes('Portable diff') &&
    component.includes('Apply reviewed ChangeSet') && component.includes('Reject') &&
    component.includes('Undo history'),
    'Agent Workspace UI emphasizes context, visibility, proposals, diff, review, and undo history'
);
check(
    component.includes('No raw VM / renderer mutation') &&
    model.includes('Raw VM object') && model.includes('Renderer internals') &&
    model.includes('Credential vault contents'),
    'UI and model explicitly present Agent visibility/mutation boundaries'
);
check(
    !agentSource.includes('src/addons/addons/02agent') &&
    !agentSource.includes('document.body.appendChild') &&
    !agentSource.includes('2147483647') &&
    !agentSource.includes('window.vm') &&
    !agentSource.includes('target.sprite') &&
    !agentSource.includes('renderer._'),
    'new Agent implementation does not inherit Legacy 02Agent portal or raw backend authority'
);
check(
    !agentSource.includes('localStorage') && !agentSource.includes('sessionStorage'),
    'ChangeSets/review/transaction history remain runtime-only and create no shadow persistence authority'
);
check(
    legacyPolicy.includes('LEGACY_AGENT_MUTATION_MODE = "read-only"') &&
    legacyPolicy.includes('future NGVGE ChangeSet/Authority path'),
    'Legacy 02Agent remains read-only containment and points mutation toward the new ChangeSet path'
);
check(
    gui.includes('const AGENT_TOOL = WORKSPACE_TOOL_REGISTRY.require(TOOL_IDS.AGENT)') &&
    gui.includes('const AGENT_WINDOW = createWindowDescriptor(AGENT_TOOL)') &&
    gui.includes('registerStaticWindow(AGENT_WINDOW, false'),
    'production GUI registers Agent through ToolRegistry, WindowModel, and WindowManager'
);
check(
    gui.includes('case TOOL_IDS.AGENT:') && gui.includes('handleOpenAgent();') &&
    gui.includes('return {windowId: AGENT_WINDOW.windowId};'),
    'Dock/Launchpad Agent activation uses existing Workspace launch authority'
);
check(
    (gui.match(/createWorkspaceAgentRuntime\s*\(/g) || []).length === 1 &&
    gui.includes('workspaceNodeCommandHost') && gui.includes('contextReadCapability: agentContextConsumer.contextRead') &&
    !gui.includes('getCurrentNodeId:'),
    'production GUI owns exactly one Agent runtime composed over the shared Node boundary and admitted Context capability'
);
check(
    gui.includes('<WorkspaceAgent model={agentModel} />') &&
    gui.includes('data-ngvge-tool-id={AGENT_WINDOW.toolId}') &&
    gui.includes('enableStatePersistence={false}'),
    'Agent renders inside a managed Workspace Window without legacy per-window persistence'
);
check(
    runtime.includes('workspaceNodeCommandHost.getNodeSnapshot(nodeId)') &&
    !runtime.includes('vm') && !runtime.includes('renderer') && !runtime.includes('targetId'),
    'Agent current context is projected through stable Node snapshots rather than VM/backend identity'
);
check(
    !read('src/lib/editor-shell/launchpad-model.js').includes('ngvge.tool.agent'),
    'Launchpad Agent discovery remains ToolRegistry-driven with no duplicate Agent list'
);
check(
    packageJson.includes('test:workspace-shell:ws7:focused') &&
    packageJson.includes('test:workspace-shell:ws7-webpack') &&
    packageJson.includes('test:workspace-shell:ws7-webpack-editor'),
    'WS-7 defines repeatable focused and real production Webpack gates'
);

process.stdout.write(`WS-7 NGVGE Agent Workspace Integration PASS (${checks.length}/${checks.length}).\n`);
process.stdout.write(`${JSON.stringify({
    toolId: 'ngvge.tool.agent',
    modelId: 'ngvge.workspace-agent-model@1',
    changeSetModelId: 'ngvge.workspace-agent-changeset-model@1',
    transactionHostId: 'ngvge.workspace-agent-transaction-host@1',
    checks: checks.length
}, null, 2)}\n`);
