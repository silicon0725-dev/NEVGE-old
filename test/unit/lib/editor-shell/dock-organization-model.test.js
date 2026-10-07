import {TOOL_IDS, createCoreToolRegistry} from '../../../../src/lib/editor-shell/tool-registry';
import {WindowManager} from '../../../../src/lib/editor-shell/window-manager';
import {DockRuntimeModel} from '../../../../src/lib/editor-shell/dock-runtime-model';
import {
    WORKSPACE_DOCK_ORGANIZATION_MODEL_ID,
    DOCK_ORGANIZATION_PREFERENCE_SCHEMA_ID,
    DOCK_ORGANIZATION_PREFERENCE_SCHEMA_VERSION,
    DOCK_ORGANIZATION_KINDS,
    DockOrganizationModel,
    normalizeDockOrganizationPreference
} from '../../../../src/lib/editor-shell/dock-organization-model';

describe('WS-3D Dock Organization Model', () => {
    const createFoundation = ({preference} = {}) => {
        const toolRegistry = createCoreToolRegistry();
        const windowManager = new WindowManager();
        const dockRuntimeModel = new DockRuntimeModel({
            toolRegistry,
            windowManager,
            pinnedToolIds: [
                TOOL_IDS.NODE_EXPLORER,
                TOOL_IDS.INSPECTOR,
                TOOL_IDS.ASSETS,
                TOOL_IDS.STAGE,
                TOOL_IDS.EDITOR
            ],
            order: [
                TOOL_IDS.NODE_EXPLORER,
                TOOL_IDS.INSPECTOR,
                TOOL_IDS.ASSETS,
                TOOL_IDS.STAGE,
                TOOL_IDS.EDITOR
            ]
        });
        const organizationModel = new DockOrganizationModel({toolRegistry, dockRuntimeModel, preference});
        return {toolRegistry, windowManager, dockRuntimeModel, organizationModel};
    };

    test('publishes stable organization identity and versioned preference without backend identity', () => {
        const {organizationModel} = createFoundation();
        expect(organizationModel.id).toBe(WORKSPACE_DOCK_ORGANIZATION_MODEL_ID);
        expect(organizationModel.schemaId).toBe(DOCK_ORGANIZATION_PREFERENCE_SCHEMA_ID);
        expect(organizationModel.schemaVersion).toBe(DOCK_ORGANIZATION_PREFERENCE_SCHEMA_VERSION);
        const preference = organizationModel.getPreference();
        expect(preference).toEqual({schemaVersion: 1, containers: [], separators: []});
        expect(preference).not.toHaveProperty('windowId');
        expect(preference).not.toHaveProperty('renderer');
        expect(preference).not.toHaveProperty('vm');
        expect(Object.isFrozen(preference)).toBe(true);
    });

    test('creates groups and folders without changing ToolId identity and mirrors membership into Dock metadata seam', () => {
        const {dockRuntimeModel, organizationModel} = createFoundation();
        const group = organizationModel.createGroup({toolIds: [TOOL_IDS.NODE_EXPLORER]});
        const folder = organizationModel.createFolder({toolIds: [TOOL_IDS.ASSETS]});
        expect(group).toMatchObject({
            kind: DOCK_ORGANIZATION_KINDS.GROUP,
            toolIds: [TOOL_IDS.NODE_EXPLORER]
        });
        expect(folder).toMatchObject({
            kind: DOCK_ORGANIZATION_KINDS.FOLDER,
            toolIds: [TOOL_IDS.ASSETS]
        });
        expect(dockRuntimeModel.getItem(TOOL_IDS.NODE_EXPLORER)).toMatchObject({
            toolId: TOOL_IDS.NODE_EXPLORER,
            groupId: group.id,
            folderId: null
        });
        expect(dockRuntimeModel.getItem(TOOL_IDS.ASSETS)).toMatchObject({
            toolId: TOOL_IDS.ASSETS,
            groupId: null,
            folderId: folder.id
        });
    });

    test('moves tools between containers with at most one membership and supports dissolve', () => {
        const {dockRuntimeModel, organizationModel} = createFoundation();
        const group = organizationModel.createGroup({toolIds: [TOOL_IDS.NODE_EXPLORER]});
        const folder = organizationModel.createFolder({toolIds: [TOOL_IDS.ASSETS]});
        expect(organizationModel.moveToolToContainer(TOOL_IDS.NODE_EXPLORER, folder.id)).toBe(true);
        expect(organizationModel.getMembership(TOOL_IDS.NODE_EXPLORER)).toMatchObject({
            organizationId: folder.id,
            kind: 'folder'
        });
        expect(organizationModel.requireContainer(group.id).toolIds).toEqual([]);
        expect(dockRuntimeModel.getItem(TOOL_IDS.NODE_EXPLORER)).toMatchObject({
            groupId: null,
            folderId: folder.id
        });
        expect(organizationModel.removeContainer(folder.id)).toBe(true);
        expect(organizationModel.getMembership(TOOL_IDS.NODE_EXPLORER)).toBeNull();
        expect(dockRuntimeModel.getItem(TOOL_IDS.NODE_EXPLORER)).toMatchObject({groupId: null, folderId: null});
    });

    test('projects separator, group, folder and top-level tool nodes in Dock order', () => {
        const {dockRuntimeModel, organizationModel} = createFoundation();
        const group = organizationModel.createGroup({
            label: 'Project',
            toolIds: [TOOL_IDS.NODE_EXPLORER, TOOL_IDS.INSPECTOR]
        });
        const folder = organizationModel.createFolder({
            label: 'Creation',
            toolIds: [TOOL_IDS.ASSETS, TOOL_IDS.EDITOR]
        });
        organizationModel.createSeparator({beforeToolId: TOOL_IDS.ASSETS});
        const projection = organizationModel.project(dockRuntimeModel.listItems());
        expect(projection.nodes.map(node => node.kind)).toEqual(['group', 'separator', 'folder', 'tool']);
        expect(projection.nodes[0]).toMatchObject({id: group.id, label: 'Project'});
        expect(projection.nodes[2]).toMatchObject({id: folder.id, label: 'Creation', expanded: false});
        expect(projection.nodes[3]).toMatchObject({toolId: TOOL_IDS.STAGE});
        expect(projection.nodes[0].items.map(item => item.toolId)).toEqual([
            TOOL_IDS.NODE_EXPLORER,
            TOOL_IDS.INSPECTOR
        ]);
    });

    test('folder expanded state is runtime-only and does not mutate the organization preference', () => {
        const {dockRuntimeModel, organizationModel} = createFoundation();
        const folder = organizationModel.createFolder({toolIds: [TOOL_IDS.ASSETS]});
        const before = organizationModel.getPreference();
        expect(organizationModel.toggleFolder(folder.id)).toBe(true);
        expect(organizationModel.isFolderExpanded(folder.id)).toBe(true);
        expect(organizationModel.getPreference()).toBe(before);
        expect(organizationModel.project(dockRuntimeModel.listItems()).nodes.find(node => node.id === folder.id).expanded)
            .toBe(true);
    });

    test('rename changes organization label only and never ToolRegistry title/identity', () => {
        const {toolRegistry, organizationModel} = createFoundation();
        const group = organizationModel.createGroup({toolIds: [TOOL_IDS.NODE_EXPLORER]});
        organizationModel.renameContainer(group.id, 'Navigation');
        expect(organizationModel.requireContainer(group.id).label).toBe('Navigation');
        expect(toolRegistry.require(TOOL_IDS.NODE_EXPLORER)).toMatchObject({
            id: TOOL_IDS.NODE_EXPLORER,
            title: 'Node Explorer'
        });
    });

    test('fails closed for duplicate membership, unknown fields, unstable organization ids and backend-shaped fields', () => {
        const toolRegistry = createCoreToolRegistry();
        expect(() => normalizeDockOrganizationPreference(toolRegistry, {
            schemaVersion: 1,
            containers: [
                {id: 'ngvge.dock.group.a', kind: 'group', label: 'A', toolIds: [TOOL_IDS.ASSETS]},
                {id: 'ngvge.dock.folder.b', kind: 'folder', label: 'B', toolIds: [TOOL_IDS.ASSETS]}
            ],
            separators: []
        })).toThrow(/only one Dock group\/folder/);
        expect(() => normalizeDockOrganizationPreference(toolRegistry, {
            schemaVersion: 1,
            containers: [],
            separators: [],
            renderer: {}
        })).toThrow(/unsupported field/);
        expect(() => normalizeDockOrganizationPreference(toolRegistry, {
            schemaVersion: 1,
            containers: [{id: 'group-a', kind: 'group', label: 'A', toolIds: []}],
            separators: []
        })).toThrow(/stable ngvge\.dock\.group/);
    });

    test('allows only one separator per anchor and hides separators whose anchor tool is not visible', () => {
        const {dockRuntimeModel, organizationModel} = createFoundation();
        const first = organizationModel.createSeparator({beforeToolId: TOOL_IDS.ASSETS});
        expect(organizationModel.createSeparator({beforeToolId: TOOL_IDS.ASSETS})).toBe(first);
        dockRuntimeModel.unpin(TOOL_IDS.ASSETS);
        const projection = organizationModel.project(dockRuntimeModel.listItems());
        expect(projection.nodes.some(node => node.id === first.id)).toBe(false);
    });
});
