import {TOOL_IDS, createCoreToolRegistry} from '../../../../../src/lib/editor-shell/tool-registry';
import {
    LEGACY_KEYS,
    WORKSPACE_LEGACY_MIGRATION_ID,
    migrateLegacyWorkspaceState
} from '../../../../../src/lib/editor-shell/workspace-persistence';

class MemoryStorage {
    constructor (entries = {}) { this.map = new Map(Object.entries(entries)); }
    getItem (key) { return this.map.has(key) ? this.map.get(key) : null; }
    setItem (key, value) { this.map.set(key, String(value)); }
}

describe('WS-4 Legacy Workspace Migration', () => {
    test('reads, validates and normalizes Legacy window/UI data without deleting the compatibility source', () => {
        const legacyWindows = {
            'project-explorer': {
                position: {x: 111, y: 222},
                size: {width: 333, height: 444},
                isMinimized: true,
                autoFit: false
            },
            'unknown-window': {position: {x: 1, y: 2}, size: {width: 3, height: 4}}
        };
        const storage = new MemoryStorage({
            [LEGACY_KEYS.WINDOW_STATES]: JSON.stringify(legacyWindows),
            [LEGACY_KEYS.CUSTOM_UI]: 'false',
            [LEGACY_KEYS.EDITOR_BACKGROUND]: JSON.stringify({blur: 7, target: 'window'}),
            [LEGACY_KEYS.BLOCK_FLYOUT_WIDTH]: '287'
        });
        const migration = migrateLegacyWorkspaceState({
            storage,
            toolRegistry: createCoreToolRegistry(),
            defaultPinnedToolIds: [TOOL_IDS.NODE_EXPLORER]
        });
        expect(migration.migrationId).toBe(WORKSPACE_LEGACY_MIGRATION_ID);
        expect(migration.layout.windows[0]).toMatchObject({
            windowId: 'project-explorer',
            toolId: TOOL_IDS.NODE_EXPLORER,
            minimized: true,
            position: {x: 111, y: 222},
            size: {width: 333, height: 444}
        });
        expect(migration.layout.toolPanels.blockFlyoutWidth).toBe(287);
        expect(migration.preferences.workspace.mode).toBe('classic');
        expect(migration.diagnostics).toContainEqual({code: 'WS4_LEGACY_WINDOW_UNKNOWN', windowId: 'unknown-window'});
        expect(storage.getItem(LEGACY_KEYS.WINDOW_STATES)).toBe(JSON.stringify(legacyWindows));
        expect(storage.getItem(LEGACY_KEYS.CUSTOM_UI)).toBe('false');
    });

    test('multi-instance persist:false Editor state never becomes a durable WS-4 Window entry', () => {
        const storage = new MemoryStorage({
            [LEGACY_KEYS.WINDOW_STATES]: JSON.stringify({
                'editor-1': {position: {x: 10, y: 20}, size: {width: 500, height: 400}}
            })
        });
        const migration = migrateLegacyWorkspaceState({storage, toolRegistry: createCoreToolRegistry()});
        expect(migration.layout.windows).toEqual([]);
    });
});
