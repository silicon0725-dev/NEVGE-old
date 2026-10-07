const RUNTIME_NODE_PRIMARY_MODE_ID = 'runtime-node-primary';
const LEGACY_SPRITES_COMPATIBILITY_UI_ID = 'scratch-target-pane';
const LEGACY_SPRITES_WINDOW_ID = 'targets';

const normalizeLegacySpritesWindowState = savedState => {
    const visible = Boolean(savedState && savedState.visible === true);
    return {
        visible,
        minimized: visible && Boolean(savedState && savedState.isMinimized === true)
    };
};

const serializeLegacySpritesWindowState = state => {
    const visible = Boolean(state && state.visible === true);
    return {
        visible,
        isMinimized: visible && Boolean(state && state.minimized === true)
    };
};

export {
    RUNTIME_NODE_PRIMARY_MODE_ID,
    LEGACY_SPRITES_COMPATIBILITY_UI_ID,
    LEGACY_SPRITES_WINDOW_ID,
    normalizeLegacySpritesWindowState,
    serializeLegacySpritesWindowState
};
