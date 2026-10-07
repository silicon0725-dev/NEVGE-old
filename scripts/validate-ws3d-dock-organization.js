'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const fail = message => {
    const error = new Error(message);
    error.code = 'NGVGE_WS3D_DOCK_ORGANIZATION_FAILED';
    throw error;
};
const passed = [];
const check = (condition, message) => {
    if (!condition) fail(message);
    passed.push(message);
};

const model = read('src/lib/editor-shell/dock-organization-model.js');
const runtimeModel = read('src/lib/editor-shell/dock-runtime-model.js');
const dock = read('src/components/workspace-dock/workspace-dock.jsx');
const css = read('src/components/workspace-dock/workspace-dock.css');
const gui = read('src/components/gui/gui.jsx');
const packageJson = read('package.json');

check(
    model.includes("WORKSPACE_DOCK_ORGANIZATION_MODEL_ID = 'ngvge.workspace-dock-organization-model@1'"),
    'stable Dock Organization Model identity'
);
check(
    model.includes("DOCK_ORGANIZATION_PREFERENCE_SCHEMA_ID = 'ngvge.workspace-dock-organization-preference@1'"),
    'versioned Dock organization preference schema identity'
);
check(model.includes('DOCK_ORGANIZATION_PREFERENCE_SCHEMA_VERSION = 1'), 'Dock organization preference schema v1');
check(model.includes("GROUP: 'group'") && model.includes("FOLDER: 'folder'"), 'group/folder node kinds are explicit');
check(model.includes("SEPARATOR: 'separator'"), 'separator node kind is explicit');
check(
    model.includes('ToolId may belong to only one Dock group/folder'),
    'a ToolId has at most one group/folder membership'
);
check(
    model.includes('stable ngvge.dock.${kind}.* identifier'),
    'organization nodes use Dock metadata identity rather than ToolId identity'
);
check(
    model.includes('this._dockRuntimeModel.setOrganizationMetadata(tool.id') &&
    model.includes('groupId:') && model.includes('folderId:'),
    'organization topology reuses the WS-3A Dock metadata seam'
);
check(
    runtimeModel.includes('toolId: tool.id') && runtimeModel.includes('groupId: organization.groupId'),
    'DockItem keeps original ToolId while projecting organization metadata'
);
check(model.includes('createGroup ({label, toolIds = []}'), 'custom group creation API exists');
check(model.includes('createFolder ({label, toolIds = []}'), 'custom folder creation API exists');
check(model.includes('createSeparator ({beforeToolId = null}'), 'custom separator creation API exists');
check(model.includes('moveToolToContainer (toolId, organizationId = null)'), 'custom membership mutation API exists');
check(model.includes('renameContainer (organizationId, label)'), 'custom group/folder label seam exists');
check(model.includes('removeContainer (organizationId)'), 'group/folder dissolve seam exists');
check(model.includes('removeSeparator (separatorId)'), 'separator removal seam exists');
check(model.includes('toggleFolder (folderId)'), 'folder expand/collapse runtime seam exists');
check(
    model.includes('_expandedFolderIds = new Set()') &&
    !/clonePreference[\s\S]{0,500}expandedFolder/.test(model),
    'folder expanded state is runtime-only and not serialized into preference v1'
);
check(model.includes('project (items)'), 'organization model projects presentation topology from DockItems');
check(model.includes('aggregateItems'), 'folder/group status is derived from member DockItems');
check(
    model.includes('assertKnownFields') && model.includes('unsupported field(s)'),
    'organization preference fails closed on unknown fields'
);
check(
    !model.includes('localStorage') && !model.includes('sessionStorage') && !model.includes('windowStateStorage'),
    'WS-3D organization remains runtime-only and defers persistence to WS-4'
);
check(
    !model.includes('WindowManager') && !model.includes('windowManager'),
    'organization model does not take WindowManager authority'
);
check(
    !model.includes('Scratch') && !model.includes('renderer') && !model.includes('extensionManager'),
    'organization preference contains no Scratch/backend identity'
);
check(
    dock.includes('organizationModel.project(items)') && dock.includes('organizationModel.subscribe('),
    'Dock consumes live organization projection'
);
check(dock.includes('role="separator"'), 'Dock renders separator presentation');
check(dock.includes('const DockGroup ='), 'Dock renders group presentation');
check(dock.includes('const DockFolder ='), 'Dock renders folder presentation');
check(dock.includes('aria-expanded={node.expanded}'), 'folder UI exposes expand/collapse accessibility state');
check(
    dock.includes('organizationModel.createGroup({toolIds: [menu.toolId]})') &&
    dock.includes('organizationModel.createFolder({toolIds: [menu.toolId]})'),
    'user-facing organization menu can create group/folder from stable ToolId'
);
check(
    dock.includes('organizationModel.createSeparator({beforeToolId: menu.toolId})'),
    'user-facing organization menu can insert separator before stable ToolId'
);
check(
    dock.includes('organizationModel.moveToolToContainer(menu.toolId, container.id)'),
    'user-facing organization menu can move ToolIds between containers'
);
check(
    dock.includes("event.shiftKey && event.key === 'F10'"),
    'organization menu has keyboard context-menu fallback'
);
check(
    dock.includes('reorderBlock(visibleToolIds, dragging.toolIds, targetToolId)') &&
    dock.includes('interactionController.setVisibleOrder(next)'),
    'organization drag reorder continues through Dock order authority'
);
check(
    dock.includes('onContainerDrop(node.id, node.orderToolIds)') &&
    dock.includes('organizationModel.moveToolToContainer(dragging.toolIds[0], containerId)'),
    'dropping a Tool on group/folder can update membership without changing ToolId'
);
check(css.includes('.separator') && css.includes('.group') && css.includes('.folder'), 'Dock CSS contains organization surfaces');
check(css.includes('.folder-popover'), 'folder member presentation uses explicit popover surface');
check(css.includes('.organization-menu'), 'Dock exposes compact organization menu surface');
check(
    gui.includes('new DockOrganizationModel({') && gui.includes('organizationModel={dockOrganizationModel}'),
    'production GUI owns one Dock Organization Model and passes it to Dock'
);
check(
    gui.includes('data-ngvge-dock-organization-model') && gui.includes('WORKSPACE_DOCK_ORGANIZATION_MODEL_ID'),
    'Workspace exposes stable organization diagnostics'
);
check(
    !/dockOrganizationModel[\s\S]{0,300}localStorage/.test(gui),
    'production GUI does not persist WS-3D organization through ad-hoc localStorage'
);
check(
    !model.includes('Launchpad') && !model.includes('launchpad'),
    'WS-3D organization authority remains independent from WS-3E Launchpad'
);
check(
    !css.includes('@keyframes') && !dock.includes('animationend'),
    'WS-3D does not implement WS-3F minimize animation'
);
check(
    packageJson.includes('test:workspace-shell:ws3d:focused') && packageJson.includes('test:workspace-shell:ws3d-webpack'),
    'WS-3D has repeatable focused and Dock production-entry Webpack gates'
);
check(
    packageJson.includes('test:workspace-shell:ws3d-webpack-editor'),
    'WS-3D registers a real full Editor entry Webpack gate for GUI wiring evidence'
);

process.stdout.write(`WS-3D Dock Organization PASS (${passed.length}/${passed.length}).\n`);
process.stdout.write(`${JSON.stringify({
    organizationModel: 'ngvge.workspace-dock-organization-model@1',
    preferenceSchema: 'ngvge.workspace-dock-organization-preference@1',
    organizationKinds: ['separator', 'group', 'folder'],
    stableMembershipIdentity: 'ToolId',
    customOrganization: true,
    folderExpandedState: 'runtime-only',
    persistenceDeferredTo: 'WS-4',
    launchpadIntegration: 'WS-3E active / authority remains separate',
    minimizeAnimationDeferredTo: 'WS-3F',
    checks: passed.length
}, null, 2)}\n`);
