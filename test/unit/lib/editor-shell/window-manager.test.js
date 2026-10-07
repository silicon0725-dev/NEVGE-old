import {TOOL_IDS, createCoreToolRegistry} from '../../../../src/lib/editor-shell/tool-registry';
import {createWindowDescriptor} from '../../../../src/lib/editor-shell/window-model';
import {
    WORKSPACE_WINDOW_MANAGER_ID,
    WINDOW_MANAGER_STATE_SCHEMA_VERSION,
    WindowManager
} from '../../../../src/lib/editor-shell/window-manager';

describe('Workspace Window Manager foundation', () => {
    const registry = createCoreToolRegistry();
    const nodeExplorer = createWindowDescriptor(registry.require(TOOL_IDS.NODE_EXPLORER));
    const inspector = createWindowDescriptor(registry.require(TOOL_IDS.INSPECTOR));
    const assets = createWindowDescriptor(registry.require(TOOL_IDS.ASSETS));
    const editorTool = registry.require(TOOL_IDS.EDITOR);

    test('registers WindowDescriptor instances as runtime window state without backend identity', () => {
        const manager = new WindowManager();
        const state = manager.registerWindow(nodeExplorer, {visible: true}, {initialZIndex: 465});
        expect(manager.id).toBe(WORKSPACE_WINDOW_MANAGER_ID);
        expect(state).toMatchObject({
            schemaVersion: WINDOW_MANAGER_STATE_SCHEMA_VERSION,
            managerId: WORKSPACE_WINDOW_MANAGER_ID,
            windowId: 'project-explorer',
            toolId: TOOL_IDS.NODE_EXPLORER,
            visible: true,
            active: false,
            zIndex: 465
        });
        expect(state).not.toHaveProperty('targetRuntimeId');
        expect(Object.isFrozen(state)).toBe(true);
    });

    test('owns open close minimize restore and focus fallback semantics', () => {
        const manager = new WindowManager({zIndexBase: 500});
        manager.registerWindow(nodeExplorer, {visible: true});
        manager.registerWindow(inspector, {visible: true});

        manager.activate(nodeExplorer.windowId);
        expect(manager.getActiveWindowId()).toBe(nodeExplorer.windowId);
        const explorerZ = manager.getState(nodeExplorer.windowId).zIndex;

        manager.activate(inspector.windowId);
        expect(manager.getActiveWindowId()).toBe(inspector.windowId);
        expect(manager.getState(inspector.windowId).zIndex).toBeGreaterThan(explorerZ);

        manager.minimize(inspector.windowId);
        expect(manager.getState(inspector.windowId).minimized).toBe(true);
        expect(manager.getActiveWindowId()).toBe(nodeExplorer.windowId);

        manager.restore(inspector.windowId);
        expect(manager.getState(inspector.windowId).minimized).toBe(false);
        expect(manager.getActiveWindowId()).toBe(inspector.windowId);

        manager.close(inspector.windowId);
        expect(manager.getState(inspector.windowId).visible).toBe(false);
        expect(manager.getActiveWindowId()).toBe(nodeExplorer.windowId);
    });


    test('restore is idempotent for visible windows and does not publish a false restore lifecycle event', () => {
        const manager = new WindowManager();
        manager.registerWindow(nodeExplorer, {visible: true});
        const events = [];
        manager.subscribe(event => events.push(event));
        const revision = manager.revision;

        const restored = manager.restore(nodeExplorer.windowId, {activate: false});

        expect(restored).toBe(manager.requireState(nodeExplorer.windowId));
        expect(manager.revision).toBe(revision);
        expect(events).toEqual([]);
    });

    test('restore opens a hidden non-minimized window without publishing Dock restore semantics', () => {
        const manager = new WindowManager();
        manager.registerWindow(nodeExplorer, {visible: true});
        manager.close(nodeExplorer.windowId);
        const events = [];
        manager.subscribe(event => events.push(event));

        manager.restore(nodeExplorer.windowId, {activate: false});

        expect(manager.requireState(nodeExplorer.windowId)).toMatchObject({
            visible: true,
            minimized: false
        });
        expect(events.map(event => event.type)).toEqual(['window:opened']);
    });

    test('owns move resize maximize and normal geometry restoration', () => {
        const manager = new WindowManager();
        manager.registerWindow(assets, {
            position: {x: 100, y: 110},
            size: {width: 900, height: 620}
        });
        manager.move(assets.windowId, {x: 160, y: 170});
        manager.resize(assets.windowId, {width: 1000, height: 700});
        manager.maximize(assets.windowId, {
            position: {x: 0, y: 0},
            size: {width: 1200, height: 800}
        });
        expect(manager.getState(assets.windowId)).toMatchObject({
            maximized: true,
            position: {x: 0, y: 0},
            size: {width: 1200, height: 800},
            normalPosition: {x: 160, y: 170},
            normalSize: {width: 1000, height: 700}
        });
        manager.restoreMaximized(assets.windowId);
        expect(manager.getState(assets.windowId)).toMatchObject({
            maximized: false,
            position: {x: 160, y: 170},
            size: {width: 1000, height: 700}
        });
    });

    test('supports dynamic multi-instance editor windows with stable WindowIds', () => {
        const manager = new WindowManager();
        const first = createWindowDescriptor(editorTool, {instanceId: 1});
        const second = createWindowDescriptor(editorTool, {instanceId: 2});
        manager.registerWindow(first, {visible: true});
        manager.registerWindow(second, {visible: true});
        manager.activate(second.windowId);
        expect(manager.listStates().map(state => state.windowId)).toEqual(['editor-1', 'editor-2']);
        expect(manager.getActiveWindowId()).toBe('editor-2');
        manager.unregisterWindow('editor-2');
        expect(manager.hasWindow('editor-2')).toBe(false);
        expect(manager.getActiveWindowId()).toBe('editor-1');
    });

    test('fails closed for duplicate registration and unsupported operations', () => {
        const manager = new WindowManager();
        manager.registerWindow(nodeExplorer);
        expect(() => manager.registerWindow(nodeExplorer)).toThrow(/already registered/);
        expect(() => manager.maximize(nodeExplorer.windowId, {
            position: {x: 0, y: 0},
            size: {width: 1000, height: 700}
        })).toThrow(/does not allow maximize/);
        expect(() => manager.resize('missing-window', {width: 10, height: 10})).toThrow(/not registered/);
    });

    test('exports portable geometry and visibility without focus or z-order authority', () => {
        const manager = new WindowManager();
        manager.registerWindow(assets, {visible: true});
        manager.activate(assets.windowId);
        const portable = manager.toPortableState(assets.windowId);
        expect(portable).toEqual({
            visible: true,
            minimized: false,
            maximized: false,
            position: assets.geometry.defaultPosition,
            size: assets.geometry.defaultSize
        });
        expect(portable).not.toHaveProperty('active');
        expect(portable).not.toHaveProperty('zIndex');
        expect(portable).not.toHaveProperty('lastFocusedAt');
        expect(Object.isFrozen(portable)).toBe(true);
        expect(Object.isFrozen(portable.position)).toBe(true);
        expect(Object.isFrozen(portable.size)).toBe(true);
    });

    test('publishes immutable lifecycle events for Workspace consumers', () => {
        const manager = new WindowManager();
        const events = [];
        const unsubscribe = manager.subscribe(event => events.push(event));
        manager.registerWindow(nodeExplorer);
        manager.open(nodeExplorer.windowId);
        manager.minimize(nodeExplorer.windowId);
        unsubscribe();
        manager.restore(nodeExplorer.windowId);
        expect(events.some(event => event.type === 'window:registered')).toBe(true);
        expect(events.some(event => event.type === 'window:activated')).toBe(true);
        expect(events.some(event => event.type === 'window:minimized')).toBe(true);
        expect(Object.isFrozen(events[0])).toBe(true);
    });
});
