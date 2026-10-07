const NATIVE_PAINT_SHELL_ID = 'ngvge.native-paint-shell@1';
const NATIVE_PAINT_SHELL_SCHEMA_VERSION = 1;

const NATIVE_PAINT_SHELL_SLOTS = Object.freeze({
    CONTEXT_TOOLBAR: 'context-toolbar',
    TOOL_RAIL: 'tool-rail',
    CANVAS_CHROME: 'canvas-chrome',
    PANEL_RAIL: 'panel-rail',
    STATUS_BAR: 'status-bar'
});

const NATIVE_PAINT_SHELL_SLOT_ORDER = Object.freeze([
    NATIVE_PAINT_SHELL_SLOTS.CONTEXT_TOOLBAR,
    NATIVE_PAINT_SHELL_SLOTS.TOOL_RAIL,
    NATIVE_PAINT_SHELL_SLOTS.CANVAS_CHROME,
    NATIVE_PAINT_SHELL_SLOTS.PANEL_RAIL,
    NATIVE_PAINT_SHELL_SLOTS.STATUS_BAR
]);

const createNativePaintShellDescriptor = ({mode, compatibility = false} = {}) => Object.freeze({
    schemaVersion: NATIVE_PAINT_SHELL_SCHEMA_VERSION,
    shellId: NATIVE_PAINT_SHELL_ID,
    mode: typeof mode === 'string' && mode ? mode : 'unknown',
    compatibility: Boolean(compatibility),
    slots: NATIVE_PAINT_SHELL_SLOT_ORDER.slice(),
    authority: Object.freeze({
        project: false,
        resource: false,
        transaction: false,
        persistence: false,
        backendIdentity: false
    })
});

export {
    NATIVE_PAINT_SHELL_ID,
    NATIVE_PAINT_SHELL_SCHEMA_VERSION,
    NATIVE_PAINT_SHELL_SLOTS,
    NATIVE_PAINT_SHELL_SLOT_ORDER,
    createNativePaintShellDescriptor
};
