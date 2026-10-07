#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const checks = [];
const check = (condition, label) => {
    if (!condition) {
        process.stderr.write(`WS-8 FAIL: ${label}\n`);
        process.exit(1);
    }
    checks.push(label);
};

const registry = read('src/lib/editor-shell/tool-registry.js');
const ecosystem = read('src/lib/editor-shell/tool-ecosystem.js');
const manifests = read('src/lib/editor-shell/tool-ecosystem-manifests.js');
const persistence = read('src/lib/editor-shell/workspace-tool-persistence.js');
const todoModel = read('src/lib/editor-shell/todo-tool-model.js');
const todoComponent = read('src/components/workspace-todo/workspace-todo.jsx');
const dock = read('src/components/workspace-dock/workspace-dock.jsx');
const launchpad = read('src/components/workspace-launchpad/workspace-launchpad.jsx');
const launchpadModel = read('src/lib/editor-shell/launchpad-model.js');
const gui = read('src/components/gui/gui.jsx');
const intakeTemplate = read('docs/architecture/workspace/OSS-INTAKE-TEMPLATE.md');
const packageJson = read('package.json');

const todoDefinitionStart = registry.indexOf('id: TOOL_IDS.TODO');
const todoDefinitionEnd = registry.indexOf('id: TOOL_IDS.EDITOR', todoDefinitionStart);
const todoDefinition = registry.slice(todoDefinitionStart, todoDefinitionEnd);
const pinnedStart = gui.indexOf('const DEFAULT_DOCK_PINNED_TOOL_IDS');
const pinnedEnd = gui.indexOf(']);', pinnedStart) + 3;
const pinnedSource = gui.slice(pinnedStart, pinnedEnd);

check(
    ecosystem.includes("WORKSPACE_TOOL_ECOSYSTEM_REGISTRY_ID = 'ngvge.workspace-tool-ecosystem-registry@1'") &&
    ecosystem.includes('TOOL_ECOSYSTEM_MANIFEST_SCHEMA_VERSION = 1'),
    'Tool Ecosystem Registry and manifest schema identities are versioned'
);
check(
    ecosystem.includes("ACTIVE: 'active'") && ecosystem.includes("PLANNED: 'planned'") &&
    ecosystem.includes("OSS_WRAPPED: 'oss-wrapped'"),
    'ecosystem manifest freezes lifecycle and OSS-wrapped origin semantics'
);
check(
    ecosystem.includes('Active OSS-wrapped tools require approved OSS Intake ADR identity') &&
    ecosystem.includes('Non-active Tool ecosystem manifest cannot leak into ToolRegistry'),
    'activation fails closed on missing OSS ADR or planned ToolRegistry leakage'
);
check(
    !ecosystem.includes("SECRET: 'secret'") && !ecosystem.includes("PROJECT: 'project'"),
    'ordinary ecosystem persistence scopes exclude Secret and Project ownership'
);
check(
    manifests.includes('TODO: TOOL_IDS.TODO') &&
    manifests.includes("TERMINAL: 'ngvge.tool.terminal'") &&
    manifests.includes('PAINT: TOOL_IDS.PAINT'),
    'Post-MVP Todo/Terminal/Paint ToolIds are stable and reserved'
);
check(
    manifests.includes('toolId: POST_MVP_TOOL_IDS.TODO') &&
    manifests.includes('lifecycle: TOOL_ECOSYSTEM_LIFECYCLE.ACTIVE'),
    'Todo is the active reference ecosystem Tool'
);
check(
    manifests.includes('toolId: POST_MVP_TOOL_IDS.TERMINAL') &&
    manifests.includes('lifecycle: TOOL_ECOSYSTEM_LIFECYCLE.PLANNED'),
    'unactivated Post-MVP tools remain planned ecosystem candidates'
);
check(
    manifests.includes('toolId: POST_MVP_TOOL_IDS.PAINT') &&
    manifests.includes("adrId: 'ADR-WS10A-SCRATCH-PAINT-INTAKE'") &&
    manifests.includes("backendSelection: 'scratch-paint@2.1.61'"),
    'later activation of Better Paint remains gated by an approved OSS Intake ADR'
);
check(
    (manifests.match(/status: OSS_INTAKE_STATUS\.REQUIRED/g) || []).length >= 1 &&
    (manifests.match(/backendSelection: 'unselected'/g) || []).length >= 1,
    'still-planned OSS candidates require intake and do not preselect an implementation backend'
);
check(
    registry.includes("TODO: 'ngvge.tool.todo'") && registry.includes("TODO: 'todo'"),
    'Todo ToolId and WindowId are stable and distinct'
);
check(
    todoDefinition.includes("title: 'Todo'") && todoDefinition.includes("commandScope: 'workspace'") &&
    todoDefinition.includes('source: {kind: TOOL_SOURCE_KINDS.FIRST_PARTY') &&
    todoDefinition.includes('singleton: true') && todoDefinition.includes('defaultVisible: false'),
    'Todo is a default-hidden singleton first-party Workspace Tool'
);
check(
    !registry.includes("'ngvge.tool.terminal'") && registry.includes("PAINT: 'ngvge.tool.paint'"),
    'planned tools stay absent while later approved tools may enter ToolRegistry'
);
check(
    !pinnedSource.includes('TOOL_IDS.TODO'),
    'Todo remains Launchpad-discoverable without forcing a default Dock pin'
);
check(
    dock.includes("'todo': (") && launchpad.includes("'todo': <path"),
    'Todo has SVG-only Dock and Launchpad functional iconography'
);
check(
    !launchpadModel.includes('ngvge.tool.todo'),
    'Launchpad Todo discovery remains ToolRegistry-driven with no duplicate tool list'
);
check(
    persistence.includes("WORKSPACE_TOOL_PERSISTENCE_SERVICE_ID = 'ngvge.workspace-tool-persistence@1'") &&
    persistence.includes("WORKSPACE_TOOL_STATE_STORAGE_KEY = 'ngvge:workspace:tool-state:v1'") &&
    persistence.includes("this.scope = 'workspace'"),
    'Tool state is owned by a dedicated versioned Workspace persistence service'
);
check(
    persistence.includes('MAX_TOOL_STATE_BYTES = 64 * 1024') && persistence.includes('FORBIDDEN_KEYS') &&
    ['apikey', 'password', 'secret', 'token', 'vm', 'renderer', 'targetid', 'backendid']
        .every(key => persistence.includes(`'${key}'`)),
    'Tool persistence is bounded and rejects secrets/backend identity'
);
check(
    !todoModel.includes('localStorage') && !todoComponent.includes('localStorage') &&
    !todoModel.includes('sessionStorage') && !todoComponent.includes('sessionStorage'),
    'Todo consumes Workspace persistence service rather than owning browser storage'
);
check(
    todoModel.includes("WORKSPACE_TODO_TOOL_MODEL_ID = 'ngvge.workspace-todo-tool-model@1'") &&
    todoModel.includes('TOOL_IDS.TODO') && todoModel.includes('persistenceService.setState'),
    'Todo model has stable identity and delegates persistence to Workspace service'
);
check(
    !todoModel.includes('vm') && !todoModel.includes('renderer') && !todoModel.includes('targetId') &&
    !todoModel.includes('ResourceId') && !todoModel.includes('NodeId'),
    'Todo reference Tool has no accidental Project/Resource/backend authority'
);
check(
    !todoComponent.includes('document.body') && !todoComponent.includes('z-index') &&
    !todoComponent.includes('DraggableWindow'),
    'Todo view does not mount an independent App or own window/z-index state'
);
check(
    gui.includes(
        'const WORKSPACE_TOOL_ECOSYSTEM_REGISTRY = createCoreToolEcosystemRegistry(WORKSPACE_TOOL_REGISTRY)'
    ) &&
    gui.includes('const TODO_ECOSYSTEM_MANIFEST = WORKSPACE_TOOL_ECOSYSTEM_REGISTRY.require(TOOL_IDS.TODO)'),
    'production GUI validates active Todo against the ecosystem admission registry'
);
check(
    gui.includes('const TODO_WINDOW = createWindowDescriptor(TODO_TOOL)') &&
    gui.includes('registerStaticWindow(TODO_WINDOW, false, 470)') &&
    gui.includes('case TOOL_IDS.TODO:') && gui.includes('handleOpenTodo();'),
    'Todo uses ToolRegistry, WindowModel, WindowManager, and existing Workspace launch authority'
);
check(
    gui.includes('createWorkspaceToolPersistenceService()') &&
    gui.includes('new TodoToolModel({') && gui.includes('persistenceService: workspaceToolPersistenceService'),
    'production GUI composes Todo over the shared Workspace Tool Persistence service'
);
check(
    gui.includes('<WorkspaceTodo model={todoModel} />') &&
    gui.includes('data-ngvge-tool-id={TODO_WINDOW.toolId}') &&
    gui.includes('enableStatePersistence={false}'),
    'Todo renders inside managed Workspace Window without legacy per-window persistence'
);
check(
    ['semantic responsibility', 'License', 'Maintenance', 'Bundle / runtime footprint', 'Browser / desktop support',
        'Backend seam', 'Migration / escape plan'].every(term => intakeTemplate.includes(term)),
    'OSS Intake ADR template captures required Handoff decision dimensions'
);
check(
    intakeTemplate.includes('never owns NGVGE ToolId') && intakeTemplate.includes('NodeId') &&
    intakeTemplate.includes('ResourceId') && intakeTemplate.includes('Authority'),
    'OSS Intake template preserves ARC-0001 semantic ownership'
);
check(
    packageJson.includes('test:workspace-shell:ws8:focused') &&
    packageJson.includes('test:workspace-shell:ws8-webpack') &&
    packageJson.includes('test:workspace-shell:ws8-webpack-editor'),
    'WS-8 defines repeatable focused and real production Webpack gates'
);

process.stdout.write(`WS-8 Post-MVP Tool Ecosystem PASS (${checks.length}/${checks.length}).\n`);
process.stdout.write(`${JSON.stringify({
    ecosystemRegistryId: 'ngvge.workspace-tool-ecosystem-registry@1',
    referenceToolId: 'ngvge.tool.todo',
    plannedToolIds: ['ngvge.tool.terminal'],
    activatedAfterWs8: ['ngvge.tool.paint'],
    checks: checks.length
}, null, 2)}\n`);
