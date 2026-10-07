import {
    EDITOR_BACKGROUND_IMAGE_STORAGE,
    defaultEditorBackground,
    normalizeEditorBackground
} from './editor-background';
import {
    createPersistentEditorBackgroundURL,
    loadPersistentEditorBackgroundBlob
} from './editor-background-storage';

import {
    getWorkspaceEditorBackground,
    getWorkspaceModeCustomUI,
    getWorkspaceToolPanelSize,
    setWorkspaceEditorBackground,
    setWorkspaceModeCustomUI,
    setWorkspaceToolPanelSize
} from './editor-shell/workspace-persistence';

const CUSTOM_UI_KEY = 'tw:customUI';
const EDITOR_BACKGROUND_KEY = 'tw:editorBackground';
const TOOLBOX_LAYOUT_KEY = 'tw:toolboxLayout';
const BLOCK_FLYOUT_WIDTH_KEY = 'tw:blockFlyoutWidth';

const getLocalStorageItem = key => {
    try {
        if (typeof localStorage === 'undefined') {
            return null;
        }
        return localStorage.getItem(key);
    } catch (e) {
        return null;
    }
};

const setLocalStorageItem = (key, value) => {
    try {
        if (typeof localStorage === 'undefined') {
            return false;
        }
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        return false;
    }
};

const getPersistentCustomUI = (fallback = true) => {
    const stored = getLocalStorageItem(CUSTOM_UI_KEY);
    const legacyFallback = stored === null ? fallback : stored === 'true';
    return getWorkspaceModeCustomUI(legacyFallback);
};

const setPersistentCustomUI = customUI => setWorkspaceModeCustomUI(customUI === true);

const serializePersistentEditorBackground = editorBackground => {
    const normalized = normalizeEditorBackground(editorBackground);
    if (normalized.imageStorage === EDITOR_BACKGROUND_IMAGE_STORAGE.INDEXED_DB) {
        return Object.assign({}, normalized, {
            image: null
        });
    }
    return normalized;
};

const getPersistentEditorBackground = (fallback = defaultEditorBackground) => {
    const stored = getLocalStorageItem(EDITOR_BACKGROUND_KEY);
    let legacyFallback = normalizeEditorBackground(fallback);
    if (stored !== null) {
        try {
            legacyFallback = normalizeEditorBackground(JSON.parse(stored));
        } catch (e) {
            // keep fallback
        }
    }
    return normalizeEditorBackground(getWorkspaceEditorBackground(legacyFallback));
};

const setPersistentEditorBackground = editorBackground => (
    setWorkspaceEditorBackground(serializePersistentEditorBackground(editorBackground))
);

const getPersistentToolboxLayout = (fallback = null) => {
    const stored = getLocalStorageItem(TOOLBOX_LAYOUT_KEY);
    if (stored === null) {
        return fallback;
    }
    try {
        return JSON.parse(stored);
    } catch (e) {
        return fallback;
    }
};

const setPersistentToolboxLayout = toolboxLayout => (
    setLocalStorageItem(TOOLBOX_LAYOUT_KEY, JSON.stringify(toolboxLayout || {}))
);

const getPersistentBlockFlyoutWidth = (fallback = null) => {
    const stored = getLocalStorageItem(BLOCK_FLYOUT_WIDTH_KEY);
    const legacyWidth = Number(stored);
    const legacyFallback = Number.isFinite(legacyWidth) ? legacyWidth : fallback;
    return getWorkspaceToolPanelSize('blockFlyoutWidth', legacyFallback);
};

const setPersistentBlockFlyoutWidth = width => setWorkspaceToolPanelSize('blockFlyoutWidth', width);

const hydratePersistentEditorBackground = async background => {
    const normalized = normalizeEditorBackground(background);
    if (normalized.imageStorage !== EDITOR_BACKGROUND_IMAGE_STORAGE.INDEXED_DB) {
        return normalized;
    }
    try {
        const blob = await loadPersistentEditorBackgroundBlob();
        if (!blob) {
            return normalizeEditorBackground(Object.assign({}, normalized, {
                image: null,
                imageStorage: null
            }));
        }
        return normalizeEditorBackground(Object.assign({}, normalized, {
            image: createPersistentEditorBackgroundURL(blob)
        }));
    } catch (e) {
        return normalizeEditorBackground(Object.assign({}, normalized, {
            image: null,
            imageStorage: null
        }));
    }
};

export {
    CUSTOM_UI_KEY,
    EDITOR_BACKGROUND_KEY,
    TOOLBOX_LAYOUT_KEY,
    BLOCK_FLYOUT_WIDTH_KEY,
    getPersistentCustomUI,
    setPersistentCustomUI,
    getPersistentEditorBackground,
    hydratePersistentEditorBackground,
    setPersistentEditorBackground,
    getPersistentToolboxLayout,
    setPersistentToolboxLayout,
    getPersistentBlockFlyoutWidth,
    setPersistentBlockFlyoutWidth
};
