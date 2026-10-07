import {
    WORKSPACE_LAYOUT_SCHEMA_ID,
    WORKSPACE_LAYOUT_SCHEMA_VERSION,
    WORKSPACE_PREFERENCES_SCHEMA_ID,
    WORKSPACE_PREFERENCES_SCHEMA_VERSION,
    WORKSPACE_PERSISTENCE_SCOPES,
    WORKSPACE_PERSISTED_DOMAIN_SCOPES,
    createDefaultWorkspaceLayout,
    createDefaultWorkspacePreferences,
    normalizeWorkspaceLayout,
    normalizeWorkspacePreferences
} from '../../../../../src/lib/editor-shell/workspace-persistence';

const TOOL_ID = 'ngvge.tool.assets';

describe('WS-4 Workspace schemas', () => {
    test('publishes two stable v1 schemas and six distinct authority scopes', () => {
        expect(WORKSPACE_LAYOUT_SCHEMA_ID).toBe('ngvge.workspace-layout@1');
        expect(WORKSPACE_LAYOUT_SCHEMA_VERSION).toBe(1);
        expect(WORKSPACE_PREFERENCES_SCHEMA_ID).toBe('ngvge.workspace-preferences@1');
        expect(WORKSPACE_PREFERENCES_SCHEMA_VERSION).toBe(1);
        expect(Object.values(WORKSPACE_PERSISTENCE_SCOPES).sort()).toEqual([
            'device', 'project', 'secret', 'session', 'user', 'workspace'
        ]);
        expect(WORKSPACE_PERSISTED_DOMAIN_SCOPES.projectState).toBe('project');
        expect(WORKSPACE_PERSISTED_DOMAIN_SCOPES.sessionUI).toBe('session');
        expect(WORKSPACE_PERSISTED_DOMAIN_SCOPES.secret).toBe('secret');
        expect(WORKSPACE_PERSISTED_DOMAIN_SCOPES.dockPlacement).toBe('workspace');
        expect(WORKSPACE_PERSISTED_DOMAIN_SCOPES.userAppearance).toBe('user');
    });

    test('normalizes all required Workspace layout domains without backend identity', () => {
        const layout = normalizeWorkspaceLayout({
            schemaId: WORKSPACE_LAYOUT_SCHEMA_ID,
            schemaVersion: 1,
            windows: [{
                windowId: 'asset-manager',
                toolId: TOOL_ID,
                visible: true,
                minimized: false,
                maximized: false,
                position: {x: 20, y: 30},
                size: {width: 420, height: 500}
            }],
            dock: {
                pinnedToolIds: [TOOL_ID],
                order: [TOOL_ID],
                placement: {schemaVersion: 1, placement: 'left', alignment: 'end', offsetX: 4, offsetY: -8},
                organization: {schemaVersion: 1, containers: [], separators: []}
            },
            toolPanels: {projectExplorerWidth: 300, blockFlyoutWidth: 260},
            windowOptions: {stage: {autoFit: true}}
        });
        expect(layout).toMatchObject({
            schemaVersion: 1,
            dock: {pinnedToolIds: [TOOL_ID]},
            toolPanels: {projectExplorerWidth: 300, blockFlyoutWidth: 260},
            windowOptions: {stage: {autoFit: true}}
        });
        expect(JSON.stringify(layout)).not.toMatch(/renderer|targetRuntimeId|extensionManager|\"vm\"/);
        expect(Object.isFrozen(layout)).toBe(true);
    });

    test('preferences separate Workspace, User appearance and Device migration state', () => {
        const preferences = normalizeWorkspacePreferences({
            schemaId: WORKSPACE_PREFERENCES_SCHEMA_ID,
            schemaVersion: 1,
            workspace: {mode: 'custom', dockPresentation: 'sidebar', organizationMode: 'grouped'},
            user: {appearance: {theme: {gui: 'dark'}, editorBackground: {blur: 4, target: 'both'}}},
            device: {migrationVersion: 1}
        });
        expect(preferences.workspace).toEqual({
            mode: 'custom', dockPresentation: 'sidebar', organizationMode: 'grouped'
        });
        expect(preferences.user.appearance.theme).toEqual({gui: 'dark'});
        expect(preferences.device.migrationVersion).toBe(1);
        expect(preferences).not.toHaveProperty('secret');
        expect(preferences).not.toHaveProperty('session');
        expect(preferences).not.toHaveProperty('project');
    });

    test('schemas fail closed for unknown fields, unstable ToolIds and unsupported versions', () => {
        expect(() => normalizeWorkspaceLayout({...createDefaultWorkspaceLayout(), renderer: {}}))
            .toThrow(/unsupported field/);
        expect(() => normalizeWorkspaceLayout({
            ...createDefaultWorkspaceLayout(),
            dock: {...createDefaultWorkspaceLayout().dock, pinnedToolIds: ['scratch.asset']}
        })).toThrow(/stable ngvge\.tool/);
        expect(() => normalizeWorkspacePreferences({...createDefaultWorkspacePreferences(), secret: {token: 'x'}}))
            .toThrow(/unsupported field/);
        expect(() => normalizeWorkspacePreferences({schemaVersion: 2})).toThrow(/Unsupported WorkspacePreferencesSchema/);
    });
});
