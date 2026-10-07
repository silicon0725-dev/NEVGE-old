import {
    createDefaultWorkspaceLayout,
    createDefaultWorkspacePreferences,
    normalizeWorkspaceLayout,
    normalizeWorkspacePreferences
} from './workspace-schema';

const WORKSPACE_LEGACY_MIGRATION_ID = 'ngvge.workspace-legacy-migration@1';
const WORKSPACE_LEGACY_MIGRATION_VERSION = 1;

const LEGACY_KEYS = Object.freeze({
    WINDOW_STATES: 'scratch-gui-window-states',
    CUSTOM_UI: 'tw:customUI',
    EDITOR_BACKGROUND: 'tw:editorBackground',
    THEME: 'tw:theme',
    BLOCK_FLYOUT_WIDTH: 'tw:blockFlyoutWidth'
});

const safeJSON = value => {
    if (typeof value !== 'string') return null;
    try {
        return JSON.parse(value);
    } catch (e) {
        return null;
    }
};

const readLegacyValue = (storage, key) => {
    try {
        return storage && typeof storage.getItem === 'function' ? storage.getItem(key) : null;
    } catch (e) {
        return null;
    }
};

const mapWindowIdToToolId = (toolRegistry, windowId) => {
    const definition = toolRegistry.list().find(tool => (
        tool.singleton && tool.window && tool.window.id === windowId
    ));
    return definition ? definition.id : null;
};

const migrateLegacyWorkspaceState = ({storage, toolRegistry, defaultPinnedToolIds = []} = {}) => {
    const diagnostics = [];
    const legacyWindowStates = safeJSON(readLegacyValue(storage, LEGACY_KEYS.WINDOW_STATES)) || {};
    const windows = [];
    const windowOptions = {};
    Object.keys(legacyWindowStates).forEach(windowId => {
        if (windowId.startsWith('minimized-')) return;
        const state = legacyWindowStates[windowId];
        if (!state || typeof state !== 'object') return;
        const toolId = mapWindowIdToToolId(toolRegistry, windowId);
        if (!toolId) {
            diagnostics.push({code: 'WS4_LEGACY_WINDOW_UNKNOWN', windowId});
            return;
        }
        const definition = toolRegistry.require(toolId);
        if (!definition.window.capabilities.persist) return;
        const defaultPosition = definition.window.defaultPosition;
        const defaultSize = definition.window.defaultSize;
        windows.push({
            windowId,
            toolId,
            visible: typeof state.visible === 'boolean' ? state.visible : definition.window.defaultVisible,
            minimized: Boolean(state.isMinimized || state.minimized),
            maximized: Boolean(state.isFullScreen || state.maximized),
            position: state.position || defaultPosition,
            size: state.size || defaultSize
        });
        if (typeof state.autoFit === 'boolean') {
            windowOptions[windowId] = {autoFit: state.autoFit};
        }
    });
    const blockFlyoutWidth = Number(readLegacyValue(storage, LEGACY_KEYS.BLOCK_FLYOUT_WIDTH));
    const layout = normalizeWorkspaceLayout({
        ...createDefaultWorkspaceLayout({
            pinnedToolIds: defaultPinnedToolIds,
            order: defaultPinnedToolIds
        }),
        windows,
        toolPanels: {
            blockFlyoutWidth: Number.isFinite(blockFlyoutWidth) ? blockFlyoutWidth : null
        },
        windowOptions
    });

    const defaults = createDefaultWorkspacePreferences();
    const legacyCustomUI = readLegacyValue(storage, LEGACY_KEYS.CUSTOM_UI);
    const legacyBackground = safeJSON(readLegacyValue(storage, LEGACY_KEYS.EDITOR_BACKGROUND));
    const legacyTheme = safeJSON(readLegacyValue(storage, LEGACY_KEYS.THEME));
    const preferences = normalizeWorkspacePreferences({
        ...defaults,
        workspace: {
            ...defaults.workspace,
            mode: legacyCustomUI === null ? defaults.workspace.mode :
                (legacyCustomUI === 'false' ? 'classic' : 'custom')
        },
        user: {
            appearance: {
                editorBackground: legacyBackground || defaults.user.appearance.editorBackground,
                theme: legacyTheme || defaults.user.appearance.theme
            }
        },
        device: {migrationVersion: WORKSPACE_LEGACY_MIGRATION_VERSION}
    });

    return Object.freeze({
        migrationId: WORKSPACE_LEGACY_MIGRATION_ID,
        migrationVersion: WORKSPACE_LEGACY_MIGRATION_VERSION,
        layout,
        preferences,
        diagnostics: Object.freeze(diagnostics)
    });
};

export {
    WORKSPACE_LEGACY_MIGRATION_ID,
    WORKSPACE_LEGACY_MIGRATION_VERSION,
    LEGACY_KEYS,
    migrateLegacyWorkspaceState
};
