import {TOOL_IDS, createCoreToolRegistry} from '../../../../../src/lib/editor-shell/tool-registry';
import {createWindowDescriptor} from '../../../../../src/lib/editor-shell/window-model';
import {WindowManager} from '../../../../../src/lib/editor-shell/window-manager';
import {DockRuntimeModel} from '../../../../../src/lib/editor-shell/dock-runtime-model';
import {DockPlacementModel} from '../../../../../src/lib/editor-shell/dock-placement-model';
import {DockOrganizationModel} from '../../../../../src/lib/editor-shell/dock-organization-model';
import {
    WORKSPACE_PERSISTENCE_HOST_ID,
    WORKSPACE_STORAGE_KEYS,
    WorkspacePersistenceHost,
    WorkspaceStorageAdapter,
    createWorkspacePersistenceBootstrap
} from '../../../../../src/lib/editor-shell/workspace-persistence';

class MemoryStorage {
    constructor () { this.map = new Map(); }
    getItem (key) { return this.map.has(key) ? this.map.get(key) : null; }
    setItem (key, value) { this.map.set(key, String(value)); }
    removeItem (key) { this.map.delete(key); }
}

const createFoundation = () => {
    const storage = new MemoryStorage();
    const storageAdapter = new WorkspaceStorageAdapter({storage});
    const toolRegistry = createCoreToolRegistry();
    const bootstrap = createWorkspacePersistenceBootstrap({
        toolRegistry,
        storageAdapter,
        defaultPinnedToolIds: [TOOL_IDS.NODE_EXPLORER, TOOL_IDS.ASSETS]
    });
    const windowManager = new WindowManager();
    const node = createWindowDescriptor(toolRegistry.require(TOOL_IDS.NODE_EXPLORER));
    const editor = createWindowDescriptor(toolRegistry.require(TOOL_IDS.EDITOR), {instanceId: 1});
    windowManager.registerWindow(node, {visible: true, position: {x: 12, y: 14}, size: {width: 320, height: 400}});
    windowManager.registerWindow(editor, {visible: true});
    const dockRuntimeModel = new DockRuntimeModel({
        toolRegistry,
        windowManager,
        pinnedToolIds: bootstrap.layout.dock.pinnedToolIds,
        order: bootstrap.layout.dock.order
    });
    const dockPlacementModel = new DockPlacementModel({preference: bootstrap.layout.dock.placement});
    const dockOrganizationModel = new DockOrganizationModel({
        toolRegistry,
        dockRuntimeModel,
        preference: bootstrap.layout.dock.organization
    });
    const host = new WorkspacePersistenceHost({
        toolRegistry,
        windowManager,
        dockRuntimeModel,
        dockPlacementModel,
        dockOrganizationModel,
        bootstrap,
        storageAdapter,
        defaultPinnedToolIds: [TOOL_IDS.NODE_EXPLORER, TOOL_IDS.ASSETS]
    });
    return {
        storage,
        toolRegistry,
        windowManager,
        dockRuntimeModel,
        dockPlacementModel,
        dockOrganizationModel,
        host
    };
};

describe('WS-4 Workspace Persistence Host', () => {
    test('owns a stable persistence host while excluding persist:false windows', () => {
        const {host} = createFoundation();
        expect(host.id).toBe(WORKSPACE_PERSISTENCE_HOST_ID);
        const layout = host.getLayout();
        expect(layout.windows.map(window => window.windowId)).toEqual(['project-explorer']);
        expect(layout.windows.some(window => window.windowId === 'editor-1')).toBe(false);
    });

    test('persists Window, Dock placement, organization, pinning and tool-panel state through one Host', () => {
        const {
            storage, windowManager, dockRuntimeModel, dockPlacementModel, dockOrganizationModel, host
        } = createFoundation();
        host.start();
        windowManager.move('project-explorer', {x: 80, y: 90});
        dockRuntimeModel.pin(TOOL_IDS.INSPECTOR);
        dockPlacementModel.patchPreference({placement: 'right', alignment: 'end', offsetX: -12, offsetY: 18});
        dockOrganizationModel.createGroup({label: 'Project', toolIds: [TOOL_IDS.NODE_EXPLORER]});
        host.setToolPanelSize('projectExplorerWidth', 360);
        host.writeLayoutNow();
        const persisted = JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEYS.LAYOUT));
        expect(persisted.windows[0].position).toEqual({x: 80, y: 90});
        expect(persisted.dock.pinnedToolIds).toContain(TOOL_IDS.INSPECTOR);
        expect(persisted.dock.placement).toMatchObject({placement: 'right', alignment: 'end', offsetX: -12, offsetY: 18});
        expect(persisted.dock.organization.containers[0].toolIds).toEqual([TOOL_IDS.NODE_EXPLORER]);
        expect(persisted.toolPanels.projectExplorerWidth).toBe(360);
        host.dispose();
    });

    test('writes Workspace/User/Device preferences without Session, Secret or Project scopes', () => {
        const {storage, host} = createFoundation();
        host.setDockPresentation('compact-shelf');
        host.setOrganizationMode('grouped');
        host.setWorkspaceMode('custom');
        host.setUserAppearance({theme: {gui: 'dark'}});
        const joined = [...storage.map.entries()].map(entry => entry.join(':')).join('\n');
        expect(JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEYS.WORKSPACE_PREFERENCES))).toEqual({
            mode: 'custom', dockPresentation: 'compact-shelf', organizationMode: 'grouped'
        });
        expect(JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEYS.USER_PREFERENCES)).appearance.theme).toEqual({gui: 'dark'});
        expect(joined).not.toMatch(/apiKey|token|secret|sessionUI|projectState/);
    });

    test('bootstrap migrates Legacy data once and keeps old keys available as fallback', () => {
        const storage = new MemoryStorage();
        storage.setItem('tw:customUI', 'false');
        const toolRegistry = createCoreToolRegistry();
        const storageAdapter = new WorkspaceStorageAdapter({storage});
        const bootstrap = createWorkspacePersistenceBootstrap({toolRegistry, storageAdapter});
        expect(bootstrap.preferences.workspace.mode).toBe('classic');
        expect(storage.getItem('tw:customUI')).toBe('false');
        expect(storage.getItem(WORKSPACE_STORAGE_KEYS.WORKSPACE_PREFERENCES)).not.toBeNull();
        expect(bootstrap.diagnostics.some(entry => entry.code === 'WS4_PREFERENCES_MIGRATED')).toBe(true);
    });
});
