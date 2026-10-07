import {TOOL_IDS, createCoreToolRegistry} from '../../../../src/lib/editor-shell/tool-registry';
import {createWindowDescriptor} from '../../../../src/lib/editor-shell/window-model';
import {WindowManager} from '../../../../src/lib/editor-shell/window-manager';
import {DockRuntimeModel} from '../../../../src/lib/editor-shell/dock-runtime-model';
import {
    WORKSPACE_DOCK_INTERACTION_CONTROLLER_ID,
    DockInteractionController
} from '../../../../src/lib/editor-shell/dock-interaction-controller';

describe('WS-3B Dock Interaction Controller', () => {
    const createFoundation = () => {
        const toolRegistry = createCoreToolRegistry();
        const windowManager = new WindowManager();
        const dockRuntimeModel = new DockRuntimeModel({toolRegistry, windowManager});
        const launchTool = jest.fn();
        const controller = new DockInteractionController({
            toolRegistry,
            windowManager,
            dockRuntimeModel,
            launchTool
        });
        return {toolRegistry, windowManager, dockRuntimeModel, launchTool, controller};
    };

    test('publishes stable controller identity and launches stopped tools through callback', () => {
        const {controller, launchTool} = createFoundation();
        launchTool.mockReturnValue({windowId: 'project-explorer'});
        const result = controller.activateTool(TOOL_IDS.NODE_EXPLORER);
        expect(controller.id).toBe(WORKSPACE_DOCK_INTERACTION_CONTROLLER_ID);
        expect(launchTool).toHaveBeenCalledWith(
            TOOL_IDS.NODE_EXPLORER,
            expect.objectContaining({id: TOOL_IDS.NODE_EXPLORER})
        );
        expect(result).toMatchObject({
            action: 'launch',
            toolId: TOOL_IDS.NODE_EXPLORER,
            windowId: 'project-explorer'
        });
        expect(Object.isFrozen(result)).toBe(true);
    });

    test('restores minimized singleton windows through WindowManager authority', () => {
        const {toolRegistry, windowManager, launchTool, controller} = createFoundation();
        const descriptor = createWindowDescriptor(toolRegistry.require(TOOL_IDS.INSPECTOR));
        windowManager.registerWindow(descriptor, {visible: true});
        windowManager.minimize(descriptor.windowId);
        const result = controller.activateTool(TOOL_IDS.INSPECTOR);
        expect(result.action).toBe('restore');
        expect(windowManager.requireState(descriptor.windowId)).toMatchObject({
            visible: true,
            minimized: false,
            active: true
        });
        expect(launchTool).not.toHaveBeenCalled();
    });

    test('focuses running non-active windows without relaunching them', () => {
        const {toolRegistry, windowManager, launchTool, controller} = createFoundation();
        const node = createWindowDescriptor(toolRegistry.require(TOOL_IDS.NODE_EXPLORER));
        const inspector = createWindowDescriptor(toolRegistry.require(TOOL_IDS.INSPECTOR));
        windowManager.registerWindow(node, {visible: true});
        windowManager.registerWindow(inspector, {visible: true});
        windowManager.activate(inspector.windowId);
        const result = controller.activateTool(TOOL_IDS.NODE_EXPLORER);
        expect(result).toMatchObject({action: 'focus', windowId: node.windowId});
        expect(windowManager.getActiveWindowId()).toBe(node.windowId);
        expect(launchTool).not.toHaveBeenCalled();
    });

    test('does not mutate WindowManager when the requested tool is already active', () => {
        const {toolRegistry, windowManager, controller} = createFoundation();
        const node = createWindowDescriptor(toolRegistry.require(TOOL_IDS.NODE_EXPLORER));
        windowManager.registerWindow(node, {visible: true});
        windowManager.activate(node.windowId);
        const revision = windowManager.revision;
        const result = controller.activateTool(TOOL_IDS.NODE_EXPLORER);
        expect(result.action).toBe('already-active');
        expect(windowManager.revision).toBe(revision);
    });

    test('selects the most recently focused running instance for multi-instance tools', () => {
        const {toolRegistry, windowManager, controller} = createFoundation();
        const editorTool = toolRegistry.require(TOOL_IDS.EDITOR);
        const first = createWindowDescriptor(editorTool, {instanceId: 1});
        const second = createWindowDescriptor(editorTool, {instanceId: 2});
        const inspector = createWindowDescriptor(toolRegistry.require(TOOL_IDS.INSPECTOR));
        windowManager.registerWindow(first, {visible: true});
        windowManager.registerWindow(second, {visible: true});
        windowManager.registerWindow(inspector, {visible: true});
        windowManager.activate(first.windowId);
        windowManager.activate(second.windowId);
        windowManager.activate(inspector.windowId);
        const result = controller.activateTool(TOOL_IDS.EDITOR);
        expect(result).toMatchObject({action: 'focus', windowId: second.windowId});
        expect(windowManager.getActiveWindowId()).toBe(second.windowId);
    });

    test('prefers the most recently focused minimized instance and restores it', () => {
        const {toolRegistry, windowManager, controller} = createFoundation();
        const editorTool = toolRegistry.require(TOOL_IDS.EDITOR);
        const first = createWindowDescriptor(editorTool, {instanceId: 1});
        const second = createWindowDescriptor(editorTool, {instanceId: 2});
        windowManager.registerWindow(first, {visible: true});
        windowManager.registerWindow(second, {visible: true});
        windowManager.activate(first.windowId);
        windowManager.minimize(first.windowId);
        windowManager.activate(second.windowId);
        windowManager.minimize(second.windowId);
        const result = controller.activateTool(TOOL_IDS.EDITOR);
        expect(result).toMatchObject({action: 'restore', windowId: second.windowId});
        expect(windowManager.requireState(second.windowId)).toMatchObject({minimized: false, active: true});
    });

    test('pin toggles and visible reorder only mutate Dock Runtime Model metadata', () => {
        const {windowManager, dockRuntimeModel, controller} = createFoundation();
        const managerRevision = windowManager.revision;
        expect(controller.togglePin(TOOL_IDS.ASSETS).action).toBe('pin');
        expect(controller.togglePin(TOOL_IDS.EDITOR).action).toBe('pin');
        expect(controller.setVisibleOrder([TOOL_IDS.EDITOR, TOOL_IDS.ASSETS]).action).toBe('reorder');
        expect(dockRuntimeModel.getOrder()).toEqual([TOOL_IDS.EDITOR, TOOL_IDS.ASSETS]);
        expect(windowManager.revision).toBe(managerRevision);
        expect(controller.togglePin(TOOL_IDS.ASSETS).action).toBe('unpin');
    });

    test('fails closed for unknown tools and invalid dependency authority', () => {
        const {toolRegistry, windowManager, dockRuntimeModel, launchTool, controller} = createFoundation();
        expect(() => controller.activateTool('ngvge.tool.missing')).toThrow(/not registered/);
        expect(() => new DockInteractionController({
            toolRegistry,
            windowManager: {},
            dockRuntimeModel,
            launchTool
        })).toThrow(/Window Manager/);
    });
});
