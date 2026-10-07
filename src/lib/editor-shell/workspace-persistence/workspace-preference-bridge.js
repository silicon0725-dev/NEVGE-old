import {
    createDefaultWorkspaceLayout,
    createDefaultWorkspacePreferences,
    normalizeWorkspaceLayout,
    normalizeWorkspacePreferences
} from './workspace-schema';
import {WorkspaceStorageAdapter} from './workspace-storage-adapter';
import {getActiveWorkspacePersistenceHost} from './workspace-persistence-host';

const createAdapter = () => new WorkspaceStorageAdapter();

const readPreferences = () => {
    try {
        return createAdapter().readPreferences() || createDefaultWorkspacePreferences();
    } catch (e) {
        return createDefaultWorkspacePreferences();
    }
};

const writePreferences = updater => {
    const host = getActiveWorkspacePersistenceHost();
    if (host) return updater(host, null);
    const adapter = createAdapter();
    const current = readPreferences();
    const next = updater(null, JSON.parse(JSON.stringify(current)));
    if (!next) return false;
    try {
        return adapter.writePreferences(normalizeWorkspacePreferences(next));
    } catch (e) {
        return false;
    }
};

const getWorkspaceModeCustomUI = fallback => {
    try {
        const preferences = createAdapter().readPreferences();
        if (!preferences) return fallback;
        return preferences.workspace.mode !== 'classic';
    } catch (e) {
        return fallback;
    }
};

const setWorkspaceModeCustomUI = customUI => writePreferences((host, next) => {
    const mode = customUI ? 'custom' : 'classic';
    if (host) return host.setWorkspaceMode(mode);
    next.workspace.mode = mode;
    return next;
});

const getWorkspaceEditorBackground = fallback => {
    try {
        const preferences = createAdapter().readPreferences();
        return preferences ? preferences.user.appearance.editorBackground : fallback;
    } catch (e) {
        return fallback;
    }
};

const setWorkspaceEditorBackground = editorBackground => writePreferences((host, next) => {
    if (host) return host.setUserAppearance({editorBackground});
    next.user.appearance.editorBackground = editorBackground;
    return next;
});

const getWorkspaceThemePreference = fallback => {
    try {
        const preferences = createAdapter().readPreferences();
        return preferences && preferences.user.appearance.theme !== null ?
            preferences.user.appearance.theme : fallback;
    } catch (e) {
        return fallback;
    }
};

const setWorkspaceThemePreference = theme => writePreferences((host, next) => {
    if (host) return host.setUserAppearance({theme});
    next.user.appearance.theme = theme;
    return next;
});

const readLayout = () => {
    try {
        return createAdapter().readLayout() || createDefaultWorkspaceLayout();
    } catch (e) {
        return createDefaultWorkspaceLayout();
    }
};

const getWorkspaceToolPanelSize = (name, fallback = null) => {
    const layout = readLayout();
    const value = layout.toolPanels[name];
    return Number.isFinite(value) ? value : fallback;
};

const setWorkspaceToolPanelSize = (name, value) => {
    const host = getActiveWorkspacePersistenceHost();
    if (host) return host.setToolPanelSize(name, value);
    try {
        const adapter = createAdapter();
        const layout = JSON.parse(JSON.stringify(readLayout()));
        layout.toolPanels = {...layout.toolPanels, [name]: value};
        return adapter.writeLayout(normalizeWorkspaceLayout(layout));
    } catch (e) {
        return false;
    }
};

export {
    getWorkspaceModeCustomUI,
    setWorkspaceModeCustomUI,
    getWorkspaceEditorBackground,
    setWorkspaceEditorBackground,
    getWorkspaceThemePreference,
    setWorkspaceThemePreference,
    getWorkspaceToolPanelSize,
    setWorkspaceToolPanelSize
};
