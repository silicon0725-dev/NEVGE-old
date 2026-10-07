import PropTypes from 'prop-types';
import React from 'react';

import {TILEMAP_AUTHORING_TOOLS, getTileMapEditorState} from '../../lib/tilemap-system';
import styles from './stage.css';

const TOOL_LABELS = [
    [TILEMAP_AUTHORING_TOOLS.PENCIL, 'Pencil'],
    [TILEMAP_AUTHORING_TOOLS.ERASER, 'Eraser'],
    [TILEMAP_AUTHORING_TOOLS.PICKER, 'Picker'],
    [TILEMAP_AUTHORING_TOOLS.RECTANGLE, 'Rectangle'],
    [TILEMAP_AUTHORING_TOOLS.LINE, 'Line'],
    [TILEMAP_AUTHORING_TOOLS.FLOOD_FILL, 'Fill'],
    [TILEMAP_AUTHORING_TOOLS.RANDOM_VARIANT, 'Random Variant'],
    [TILEMAP_AUTHORING_TOOLS.TERRAIN, 'Terrain'],
    [TILEMAP_AUTHORING_TOOLS.SELECT, 'Select'],
    [TILEMAP_AUTHORING_TOOLS.PASTE, 'Paste']
];

const TileMap2DToolbar = ({active, onCopy, vm}) => {
    const runtime = vm && vm.runtime;
    const editorState = React.useMemo(() => (runtime ? getTileMapEditorState(runtime) : null), [runtime]);
    const [state, setState] = React.useState(() => editorState ? editorState.getState() : null);
    React.useEffect(() => {
        if (!editorState) return () => {};
        setState(editorState.getState());
        return editorState.subscribe(setState);
    }, [editorState]);
    if (!active || !editorState || !state) return null;
    return (
        <div className={styles.tileMapToolbar} data-ngvge-tilemap-toolbar="true">
            <select
                aria-label="TileMap tool"
                className={styles.tileMapToolSelect}
                value={state.tool}
                onChange={event => editorState.patch({tool: event.target.value})}
            >
                {TOOL_LABELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <label className={styles.tileMapToolbarField}>
                <span>Tile</span>
                <input
                    min="0"
                    type="number"
                    value={state.activeTileId}
                    onChange={event => editorState.patch({activeTileId: event.target.value})}
                />
            </label>
            <button
                className={styles.tileMapToolbarButton}
                title="Rotate placed tile 90°"
                type="button"
                onClick={() => editorState.patch({rotation: (state.rotation + 1) % 4})}
            >
                R{state.rotation * 90}°
            </button>
            <button
                className={styles.tileMapToolbarButton}
                data-active={state.flipX ? 'true' : 'false'}
                type="button"
                onClick={() => editorState.patch({flipX: !state.flipX})}
            >Flip X</button>
            <button
                className={styles.tileMapToolbarButton}
                data-active={state.flipY ? 'true' : 'false'}
                type="button"
                onClick={() => editorState.patch({flipY: !state.flipY})}
            >Flip Y</button>
            <button className={styles.tileMapToolbarButton} type="button" onClick={onCopy}>Copy</button>
            <button
                className={styles.tileMapToolbarButton}
                disabled={!state.clipboard || !state.clipboard.cells || !state.clipboard.cells.length}
                type="button"
                onClick={() => editorState.patch({tool: TILEMAP_AUTHORING_TOOLS.PASTE})}
            >Paste</button>
            <label className={styles.tileMapToolbarCheck}>
                <input
                    checked={state.gridVisible}
                    type="checkbox"
                    onChange={event => editorState.patch({gridVisible: event.target.checked})}
                />Grid
            </label>
            <label className={styles.tileMapToolbarCheck}>
                <input
                    checked={state.navigationDebug}
                    type="checkbox"
                    onChange={event => editorState.patch({navigationDebug: event.target.checked})}
                />Navigation
            </label>
            <label className={styles.tileMapToolbarCheck}>
                <input
                    checked={state.collisionDebug}
                    type="checkbox"
                    onChange={event => editorState.patch({collisionDebug: event.target.checked})}
                />Collision
            </label>
        </div>
    );
};

TileMap2DToolbar.propTypes = {
    active: PropTypes.bool,
    onCopy: PropTypes.func,
    vm: PropTypes.object
};
TileMap2DToolbar.defaultProps = {
    active: false,
    onCopy: () => {},
    vm: null
};

export default TileMap2DToolbar;
