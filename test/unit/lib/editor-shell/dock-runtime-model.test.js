import {TOOL_IDS, createCoreToolRegistry} from '../../../../src/lib/editor-shell/tool-registry';
import {createWindowDescriptor} from '../../../../src/lib/editor-shell/window-model';
import {WindowManager} from '../../../../src/lib/editor-shell/window-manager';
import {
    WORKSPACE_DOCK_RUNTIME_MODEL_ID,
    DOCK_RUNTIME_STATE_SCHEMA_VERSION,
    DOCK_ITEM_SCHEMA_VERSION,
    DockRuntimeModel
} from '../../../../src/lib/editor-shell/dock-runtime-model';

describe('WS-3A Dock Runtime Model', () => {
    const createFoundation = () => {
        const toolRegistry = createCoreToolRegistry();
        const windowManager = new WindowManager();
        return {
            toolRegistry,
            windowManager,
            dock: new DockRuntimeModel({toolRegistry, windowManager})
        };
    };

    test('publishes stable model and item identities without backend handles', () => {
        const {toolRegistry, windowManager, dock} = createFoundation();
        const descriptor = createWindowDescriptor(toolRegistry.require(TOOL_IDS.NODE_EXPLORER));
        windowManager.registerWindow(descriptor, {visible: true});
        const item = dock.getItem(TOOL_IDS.NODE_EXPLORER);
        expect(dock.id).toBe(WORKSPACE_DOCK_RUNTIME_MODEL_ID);
        expect(dock.schemaVersion).toBe(DOCK_RUNTIME_STATE_SCHEMA_VERSION);
        expect(item).toMatchObject({
            schemaVersion: DOCK_ITEM_SCHEMA_VERSION,
            modelId: WORKSPACE_DOCK_RUNTIME_MODEL_ID,
            toolId: TOOL_IDS.NODE_EXPLORER,
            running: true,
            pinned: false,
            active: false,
            runningWindowIds: ['project-explorer']
        });
        expect(item).not.toHaveProperty('targetRuntimeId');
        expect(item).not.toHaveProperty('renderer');
        expect(item).not.toHaveProperty('vm');
        expect(Object.isFrozen(item)).toBe(true);
        expect(Object.isFrozen(item.instances)).toBe(true);
    });

    test('does not equate WindowManager registration with running state', () => {
        const {toolRegistry, windowManager, dock} = createFoundation();
        const descriptor = createWindowDescriptor(toolRegistry.require(TOOL_IDS.INSPECTOR));
        windowManager.registerWindow(descriptor, {visible: false});
        expect(windowManager.hasWindow(descriptor.windowId)).toBe(true);
        expect(dock.getItem(TOOL_IDS.INSPECTOR).running).toBe(false);
        expect(dock.listItems().map(item => item.toolId)).not.toContain(TOOL_IDS.INSPECTOR);

        dock.pin(TOOL_IDS.INSPECTOR);
        expect(dock.listItems().map(item => item.toolId)).toContain(TOOL_IDS.INSPECTOR);
        windowManager.open(descriptor.windowId, {activate: false});
        dock.unpin(TOOL_IDS.INSPECTOR);
        expect(dock.getItem(TOOL_IDS.INSPECTOR).running).toBe(true);
        expect(dock.listItems().map(item => item.toolId)).toContain(TOOL_IDS.INSPECTOR);
        windowManager.close(descriptor.windowId);
        expect(dock.getItem(TOOL_IDS.INSPECTOR).running).toBe(false);
        expect(dock.listItems().map(item => item.toolId)).not.toContain(TOOL_IDS.INSPECTOR);
    });

    test('projects minimized and active state directly from WindowManager', () => {
        const {toolRegistry, windowManager, dock} = createFoundation();
        const node = createWindowDescriptor(toolRegistry.require(TOOL_IDS.NODE_EXPLORER));
        const inspector = createWindowDescriptor(toolRegistry.require(TOOL_IDS.INSPECTOR));
        windowManager.registerWindow(node, {visible: true});
        windowManager.registerWindow(inspector, {visible: true});
        windowManager.activate(inspector.windowId);
        expect(dock.getItem(TOOL_IDS.INSPECTOR)).toMatchObject({
            running: true,
            active: true,
            activeWindowId: inspector.windowId
        });
        windowManager.minimize(inspector.windowId);
        expect(dock.getItem(TOOL_IDS.INSPECTOR)).toMatchObject({
            running: true,
            minimized: true,
            active: false,
            minimizedWindowIds: [inspector.windowId]
        });
        expect(dock.getItem(TOOL_IDS.NODE_EXPLORER).active).toBe(true);
    });

    test('keeps ToolId distinct from WindowId for multi-instance tools', () => {
        const {toolRegistry, windowManager, dock} = createFoundation();
        const editorTool = toolRegistry.require(TOOL_IDS.EDITOR);
        const first = createWindowDescriptor(editorTool, {instanceId: 1});
        const second = createWindowDescriptor(editorTool, {instanceId: 2});
        windowManager.registerWindow(first, {visible: true});
        windowManager.registerWindow(second, {visible: true});
        windowManager.activate(second.windowId);
        const item = dock.getItem(TOOL_IDS.EDITOR);
        expect(item.toolId).toBe(TOOL_IDS.EDITOR);
        expect(item.singleton).toBe(false);
        expect(item.runningWindowIds).toEqual(['editor-1', 'editor-2']);
        expect(item.activeWindowId).toBe('editor-2');
        expect(item.instances.map(instance => instance.windowId)).toEqual(['editor-1', 'editor-2']);
        expect(item.instances.every(instance => instance.windowId !== item.toolId)).toBe(true);
    });

    test('owns pinning and order metadata without mutating WindowManager', () => {
        const {toolRegistry, windowManager, dock} = createFoundation();
        const stage = createWindowDescriptor(toolRegistry.require(TOOL_IDS.STAGE));
        windowManager.registerWindow(stage, {visible: true});
        const managerRevision = windowManager.revision;
        dock.pin(TOOL_IDS.ASSETS);
        dock.pin(TOOL_IDS.NODE_EXPLORER);
        dock.setOrder([TOOL_IDS.NODE_EXPLORER, TOOL_IDS.ASSETS]);
        expect(dock.listItems().map(item => item.toolId)).toEqual([
            TOOL_IDS.NODE_EXPLORER,
            TOOL_IDS.ASSETS,
            TOOL_IDS.STAGE
        ]);
        expect(dock.getOrder()).toEqual([TOOL_IDS.NODE_EXPLORER, TOOL_IDS.ASSETS]);
        expect(windowManager.revision).toBe(managerRevision);
    });

    test('owns organization metadata but not organization presentation topology', () => {
        const {dock} = createFoundation();
        expect(dock.setOrganizationMetadata(TOOL_IDS.ASSETS, {
            groupId: 'project-tools',
            folderId: 'creation'
        })).toBe(true);
        expect(dock.getItem(TOOL_IDS.ASSETS)).toMatchObject({
            groupId: 'project-tools',
            folderId: 'creation'
        });
        expect(dock.setOrganizationMetadata(TOOL_IDS.ASSETS, {})).toBe(true);
        expect(dock.getOrganizationMetadata(TOOL_IDS.ASSETS)).toEqual({
            groupId: null,
            folderId: null
        });
    });

    test('publishes immutable projection events when WindowManager changes', () => {
        const {toolRegistry, windowManager, dock} = createFoundation();
        const events = [];
        const unsubscribe = dock.subscribe(event => events.push(event));
        const descriptor = createWindowDescriptor(toolRegistry.require(TOOL_IDS.NODE_EXPLORER));
        windowManager.registerWindow(descriptor, {visible: true});
        windowManager.activate(descriptor.windowId);
        unsubscribe();
        expect(events.length).toBeGreaterThanOrEqual(2);
        expect(events[0]).toMatchObject({
            modelId: WORKSPACE_DOCK_RUNTIME_MODEL_ID,
            type: 'dock:window-projection-changed',
            windowId: descriptor.windowId
        });
        expect(Object.isFrozen(events[0])).toBe(true);
        expect(dock.revision).toBeGreaterThanOrEqual(2);
    });

    test('fails closed for unknown ToolIds, duplicates, and invalid ownership sources', () => {
        const {toolRegistry, windowManager, dock} = createFoundation();
        expect(() => dock.pin('scratch.tool.sprite-list')).toThrow(/stable ngvge\.tool/);
        expect(() => dock.pin('ngvge.tool.missing')).toThrow(/not registered/);
        expect(() => dock.setOrder([TOOL_IDS.ASSETS, TOOL_IDS.ASSETS])).toThrow(/duplicate ToolId/);
        expect(() => new DockRuntimeModel({toolRegistry: {}, windowManager})).toThrow(/Tool Registry/);
        expect(() => new DockRuntimeModel({toolRegistry, windowManager: {}})).toThrow(/Window Manager/);
    });

    test('snapshot is a read-only projection and contains no WindowManager runtime authority copies', () => {
        const {toolRegistry, windowManager, dock} = createFoundation();
        const descriptor = createWindowDescriptor(toolRegistry.require(TOOL_IDS.STAGE));
        windowManager.registerWindow(descriptor, {visible: true});
        const snapshot = dock.getSnapshot({includeStopped: true});
        expect(snapshot).toMatchObject({
            schemaVersion: DOCK_RUNTIME_STATE_SCHEMA_VERSION,
            modelId: WORKSPACE_DOCK_RUNTIME_MODEL_ID
        });
        const stage = snapshot.items.find(item => item.toolId === TOOL_IDS.STAGE);
        expect(stage.running).toBe(true);
        expect(stage.instances[0]).not.toHaveProperty('zIndex');
        expect(stage.instances[0]).not.toHaveProperty('position');
        expect(stage.instances[0]).not.toHaveProperty('size');
        expect(Object.isFrozen(snapshot)).toBe(true);
    });
});
