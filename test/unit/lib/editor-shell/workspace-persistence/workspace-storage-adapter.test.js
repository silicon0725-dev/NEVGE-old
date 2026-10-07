import {
    WORKSPACE_STORAGE_KEYS,
    WorkspaceStorageAdapter,
    createDefaultWorkspaceLayout,
    createDefaultWorkspacePreferences
} from '../../../../../src/lib/editor-shell/workspace-persistence';

class MemoryStorage {
    constructor () {
        this.map = new Map();
    }
    getItem (key) { return this.map.has(key) ? this.map.get(key) : null; }
    setItem (key, value) { this.map.set(key, String(value)); }
    removeItem (key) { this.map.delete(key); }
}

describe('WS-4 Workspace Storage Adapter', () => {
    test('physically separates Layout, Workspace, User and Device records', () => {
        const storage = new MemoryStorage();
        const adapter = new WorkspaceStorageAdapter({storage});
        adapter.writeLayout(createDefaultWorkspaceLayout());
        adapter.writePreferences(createDefaultWorkspacePreferences());
        expect([...storage.map.keys()].sort()).toEqual(Object.values(WORKSPACE_STORAGE_KEYS).sort());
        expect(WORKSPACE_STORAGE_KEYS.LAYOUT).not.toBe(WORKSPACE_STORAGE_KEYS.USER_PREFERENCES);
        expect(WORKSPACE_STORAGE_KEYS.WORKSPACE_PREFERENCES).not.toBe(WORKSPACE_STORAGE_KEYS.DEVICE_PREFERENCES);
        expect([...storage.map.keys()].some(key => /secret|session|project/.test(key))).toBe(false);
    });

    test('round-trips versioned layout and scoped preferences', () => {
        const storage = new MemoryStorage();
        const adapter = new WorkspaceStorageAdapter({storage});
        const layout = createDefaultWorkspaceLayout({
            pinnedToolIds: ['ngvge.tool.assets'],
            order: ['ngvge.tool.assets']
        });
        const preferences = createDefaultWorkspacePreferences();
        adapter.writeLayout(layout);
        adapter.writePreferences(preferences);
        expect(adapter.readLayout()).toMatchObject({
            schemaVersion: 1,
            dock: {pinnedToolIds: ['ngvge.tool.assets']}
        });
        expect(adapter.readPreferences()).toEqual(preferences);
        const persistedLayout = JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEYS.LAYOUT));
        expect(persistedLayout.schemaId).toBe('ngvge.workspace-layout@1');
    });

    test('invalid durable data fails visibly instead of silently becoming authority', () => {
        const storage = new MemoryStorage();
        const adapter = new WorkspaceStorageAdapter({storage});
        storage.setItem(WORKSPACE_STORAGE_KEYS.LAYOUT, JSON.stringify({schemaVersion: 99}));
        expect(() => adapter.readLayout()).toThrow(/Unsupported WorkspaceLayoutSchema version/);
    });
});
