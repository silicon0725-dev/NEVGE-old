'use strict';

const {TILEMAP_AUTHORING_TOOLS} = require('./tilemap-authoring');

const TILEMAP_EDITOR_STATE_PROPERTY = 'ngvgeTileMapEditorState';
const VALID_TOOLS = new Set(Object.values(TILEMAP_AUTHORING_TOOLS));

const createTileMapEditorState = () => {
    const listeners = new Set();
    let state = {
        activeTileId: 0,
        flipX: false,
        flipY: false,
        rotation: 0,
        selection: null,
        clipboard: null,
        collisionDebug: true,
        gridVisible: true,
        navigationDebug: false,
        tool: TILEMAP_AUTHORING_TOOLS.PENCIL
    };
    const snapshot = () => Object.freeze(Object.assign({}, state));
    const emit = () => {
        const current = snapshot();
        listeners.forEach(listener => {
            try { listener(current); } catch { /* advisory */ }
        });
        return current;
    };
    return Object.freeze({
        getState: snapshot,
        patch: patch => {
            const source = patch && typeof patch === 'object' ? patch : {};
            const next = Object.assign({}, state);
            if (Object.prototype.hasOwnProperty.call(source, 'activeTileId')) {
                next.activeTileId = Math.max(0, Math.trunc(Number(source.activeTileId) || 0));
            }
            if (Object.prototype.hasOwnProperty.call(source, 'flipX')) next.flipX = Boolean(source.flipX);
            if (Object.prototype.hasOwnProperty.call(source, 'flipY')) next.flipY = Boolean(source.flipY);
            if (Object.prototype.hasOwnProperty.call(source, 'rotation')) next.rotation = ((Math.trunc(Number(source.rotation) || 0) % 4) + 4) % 4;
            if (Object.prototype.hasOwnProperty.call(source, 'selection')) next.selection = source.selection;
            if (Object.prototype.hasOwnProperty.call(source, 'clipboard')) next.clipboard = source.clipboard;
            if (Object.prototype.hasOwnProperty.call(source, 'collisionDebug')) next.collisionDebug = Boolean(source.collisionDebug);
            if (Object.prototype.hasOwnProperty.call(source, 'gridVisible')) next.gridVisible = Boolean(source.gridVisible);
            if (Object.prototype.hasOwnProperty.call(source, 'navigationDebug')) next.navigationDebug = Boolean(source.navigationDebug);
            if (Object.prototype.hasOwnProperty.call(source, 'tool') && VALID_TOOLS.has(source.tool)) next.tool = source.tool;
            state = next;
            return emit();
        },
        subscribe: listener => {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    });
};

const getTileMapEditorState = runtime => {
    if (!runtime) return null;
    if (!runtime[TILEMAP_EDITOR_STATE_PROPERTY]) runtime[TILEMAP_EDITOR_STATE_PROPERTY] = createTileMapEditorState();
    return runtime[TILEMAP_EDITOR_STATE_PROPERTY];
};

module.exports = {
    TILEMAP_EDITOR_STATE_PROPERTY,
    createTileMapEditorState,
    getTileMapEditorState
};
