import {BLOCKS_CUSTOM, Theme} from '.';
import {getWorkspaceThemePreference, setWorkspaceThemePreference} from '../editor-shell/workspace-persistence';

const matchMedia = query => (window.matchMedia ? window.matchMedia(query) : null);
const PREFERS_HIGH_CONTRAST_QUERY = matchMedia('(prefers-contrast: more)');
const PREFERS_DARK_QUERY = matchMedia('(prefers-color-scheme: dark)');

const STORAGE_KEY = 'tw:theme';

/**
 * @returns {Theme} detected theme
 */
const systemPreferencesTheme = () => {
    if (PREFERS_HIGH_CONTRAST_QUERY && PREFERS_HIGH_CONTRAST_QUERY.matches) {
        return Theme.highContrast;
    }
    if (PREFERS_DARK_QUERY && PREFERS_DARK_QUERY.matches) {
        return Theme.dark;
    }
    return Theme.light;
};

/**
 * @param {function} onChange callback; no guarantees about arguments
 * @returns {function} call to remove event listeners to prevent memory leak
 */
const onSystemPreferenceChange = onChange => {
    if (
        !PREFERS_HIGH_CONTRAST_QUERY ||
        !PREFERS_DARK_QUERY ||
        // Some old browsers don't support addEventListener on media queries
        !PREFERS_HIGH_CONTRAST_QUERY.addEventListener ||
        !PREFERS_DARK_QUERY.addEventListener
    ) {
        return () => {};
    }

    PREFERS_HIGH_CONTRAST_QUERY.addEventListener('change', onChange);
    PREFERS_DARK_QUERY.addEventListener('change', onChange);

    return () => {
        PREFERS_HIGH_CONTRAST_QUERY.removeEventListener('change', onChange);
        PREFERS_DARK_QUERY.removeEventListener('change', onChange);
    };
};

/**
 * @returns {Theme} the theme
 */
const detectTheme = () => {
    const systemPreferences = systemPreferencesTheme();

    try {
        const local = localStorage.getItem(STORAGE_KEY);
        let legacyPreference = null;
        if (local === 'dark') {
            legacyPreference = {gui: Theme.dark.gui, accent: Theme.dark.accent, blocks: Theme.dark.blocks};
        } else if (local === 'light') {
            legacyPreference = {gui: Theme.light.gui, accent: Theme.light.accent, blocks: Theme.light.blocks};
        } else if (local) {
            legacyPreference = JSON.parse(local);
        }
        const workspacePreference = getWorkspaceThemePreference(legacyPreference) || {};
        return new Theme(
            workspacePreference.accent || systemPreferences.accent,
            workspacePreference.gui || systemPreferences.gui,
            workspacePreference.blocks || systemPreferences.blocks
        );
    } catch (e) {
        return systemPreferences;
    }
};

/**
 * @param {Theme} theme the theme
 */
const persistTheme = theme => {
    const systemPreferences = systemPreferencesTheme();
    const nonDefaultSettings = {};

    if (theme.accent !== systemPreferences.accent) {
        nonDefaultSettings.accent = theme.accent;
    }
    if (theme.gui !== systemPreferences.gui) {
        nonDefaultSettings.gui = theme.gui;
    }
    // custom blocks are managed by addon at runtime, don't save here
    if (theme.blocks !== systemPreferences.blocks && theme.blocks !== BLOCKS_CUSTOM) {
        nonDefaultSettings.blocks = theme.blocks;
    }

    setWorkspaceThemePreference(Object.keys(nonDefaultSettings).length ? nonDefaultSettings : null);
};

export {
    onSystemPreferenceChange,
    detectTheme,
    persistTheme
};
