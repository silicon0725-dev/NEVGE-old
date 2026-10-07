import {
    WORKSPACE_STORAGE_KEYS,
    getWorkspaceModeCustomUI,
    getWorkspaceEditorBackground,
    getWorkspaceThemePreference,
    getWorkspaceToolPanelSize,
    setWorkspaceModeCustomUI,
    setWorkspaceEditorBackground,
    setWorkspaceThemePreference,
    setWorkspaceToolPanelSize
} from '../../../../../src/lib/editor-shell/workspace-persistence';

class MemoryStorage {
    constructor () { this.map = new Map(); }
    getItem (key) { return this.map.has(key) ? this.map.get(key) : null; }
    setItem (key, value) { this.map.set(key, String(value)); }
    removeItem (key) { this.map.delete(key); }
    clear () { this.map.clear(); }
}

describe('WS-4 preference compatibility bridge', () => {
    beforeEach(() => {
        global.localStorage = new MemoryStorage();
    });

    afterEach(() => {
        delete global.localStorage;
    });

    test('new Workspace mode writes never rewrite the Legacy customUI key', () => {
        localStorage.setItem('tw:customUI', 'false');
        expect(setWorkspaceModeCustomUI(true)).toBe(true);
        expect(getWorkspaceModeCustomUI(false)).toBe(true);
        expect(localStorage.getItem('tw:customUI')).toBe('false');
        expect(JSON.parse(localStorage.getItem(WORKSPACE_STORAGE_KEYS.WORKSPACE_PREFERENCES)).mode).toBe('custom');
    });

    test('User appearance writes use User scope and preserve Legacy fallback records', () => {
        localStorage.setItem('tw:editorBackground', JSON.stringify({blur: 3, target: 'window'}));
        localStorage.setItem('tw:theme', JSON.stringify({gui: 'dark'}));
        expect(setWorkspaceEditorBackground({blur: 8, target: 'both'})).toBe(true);
        expect(setWorkspaceThemePreference({gui: 'dark'})).toBe(true);
        expect(getWorkspaceEditorBackground({}).blur).toBe(8);
        expect(getWorkspaceThemePreference(null)).toEqual({gui: 'dark'});
        expect(JSON.parse(localStorage.getItem('tw:editorBackground')).blur).toBe(3);
        expect(JSON.parse(localStorage.getItem('tw:theme'))).toEqual({gui: 'dark'});
        const user = JSON.parse(localStorage.getItem(WORKSPACE_STORAGE_KEYS.USER_PREFERENCES));
        expect(user.appearance.editorBackground.blur).toBe(8);
        expect(user.appearance.theme).toEqual({gui: 'dark'});
    });

    test('tool panel sizes move to Layout scope while the Legacy width stays fallback-only', () => {
        localStorage.setItem('tw:blockFlyoutWidth', '220');
        expect(setWorkspaceToolPanelSize('blockFlyoutWidth', 310)).toBe(true);
        expect(getWorkspaceToolPanelSize('blockFlyoutWidth', 220)).toBe(310);
        expect(localStorage.getItem('tw:blockFlyoutWidth')).toBe('220');
        const layout = JSON.parse(localStorage.getItem(WORKSPACE_STORAGE_KEYS.LAYOUT));
        expect(layout.toolPanels.blockFlyoutWidth).toBe(310);
    });
});
