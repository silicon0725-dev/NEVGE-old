import {TOOL_IDS, createCoreToolRegistry} from '../../../../src/lib/editor-shell/tool-registry';
import {
    WORKSPACE_WINDOW_MODEL_ID,
    WINDOW_DESCRIPTOR_SCHEMA_VERSION,
    WINDOW_STATE_SCHEMA_VERSION,
    createWindowDescriptor,
    normalizeWindowState
} from '../../../../src/lib/editor-shell/window-model';

describe('Workspace Window Model foundation', () => {
    const registry = createCoreToolRegistry();

    test('creates frozen portable descriptors for singleton tools', () => {
        const descriptor = createWindowDescriptor(registry.require(TOOL_IDS.NODE_EXPLORER));
        expect(descriptor).toMatchObject({
            schemaVersion: WINDOW_DESCRIPTOR_SCHEMA_VERSION,
            modelId: WORKSPACE_WINDOW_MODEL_ID,
            windowId: 'project-explorer',
            toolId: TOOL_IDS.NODE_EXPLORER,
            role: 'primary',
            title: 'Node Explorer',
            singleton: true
        });
        expect(Object.isFrozen(descriptor)).toBe(true);
        expect(Object.isFrozen(descriptor.geometry)).toBe(true);
    });

    test('derives stable multi-instance editor WindowIds without backend identity', () => {
        const editorTool = registry.require(TOOL_IDS.EDITOR);
        const first = createWindowDescriptor(editorTool, {instanceId: 1});
        const second = createWindowDescriptor(editorTool, {instanceId: 2});
        expect(first.windowId).toBe('editor-1');
        expect(second.windowId).toBe('editor-2');
        expect(first.toolId).toBe(TOOL_IDS.EDITOR);
        expect(first.windowId).not.toContain('target');
    });

    test('normalizes visibility, minimization and geometry into a portable state', () => {
        const descriptor = createWindowDescriptor(registry.require(TOOL_IDS.LEGACY_SPRITES));
        const state = normalizeWindowState(descriptor, {
            visible: false,
            minimized: true,
            position: {x: 44, y: 55},
            size: {width: 9999, height: 10}
        });
        expect(state).toEqual({
            schemaVersion: WINDOW_STATE_SCHEMA_VERSION,
            modelId: WORKSPACE_WINDOW_MODEL_ID,
            windowId: 'targets',
            toolId: TOOL_IDS.LEGACY_SPRITES,
            visible: false,
            minimized: false,
            maximized: false,
            position: {x: 44, y: 55},
            size: {width: 600, height: 211}
        });
        expect(Object.isFrozen(state)).toBe(true);
    });

    test('preserves capability semantics instead of inventing WS-2 focus or z-order state', () => {
        const descriptor = createWindowDescriptor(registry.require(TOOL_IDS.INSPECTOR));
        expect(descriptor.capabilities).toEqual({
            close: true,
            minimize: true,
            maximize: false,
            resize: true,
            persist: true
        });
        const state = normalizeWindowState(descriptor);
        expect(state).not.toHaveProperty('active');
        expect(state).not.toHaveProperty('zIndex');
        expect(state).not.toHaveProperty('focusedAt');
    });
});
