import PropTypes from 'prop-types';
import React from 'react';

import {
    NATIVE_PAINT_SHELL_ID,
    NATIVE_PAINT_SHELL_SLOTS
} from '../../lib/editor-shell/native-paint-shell';
import {
    PAINT_MODE_IDS,
    getPaintModeLabel,
    getPaintToolDescriptor,
    getPaintToolsForMode,
    getPaintToolLabel
} from '../../lib/editor-shell/paint-tool-profiles';

import styles from './native-paint-shell.css';

const VECTOR_TOOL_LABELS = Object.freeze(getPaintToolsForMode(PAINT_MODE_IDS.VECTOR).reduce((labels, toolId) => {
    labels[toolId] = getPaintToolLabel(toolId);
    return labels;
}, {}));

const PANEL_LABELS = Object.freeze({
    properties: 'Properties',
    layers: 'Layers',
    color: 'Color'
});

const ToolGlyph = ({tool}) => {
    const descriptor = getPaintToolDescriptor(tool);
    const glyph = descriptor ? descriptor.glyph : tool;
    switch (glyph) {
    case 'select':
        return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 2.8 14.2 10l-4.4 1.1 2.6 4.4-2.2 1.3-2.5-4.3L5 16.2Z" /></svg>;
    case 'direct-select':
        return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 3.2 14 9.7l-4 1 2.3 4-2 1.1-2.2-3.8-2.5 3.2Z" /><circle cx="14.8" cy="5.1" r="1.4" /></svg>;
    case 'freehand':
    case 'pencil':
        return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 14.8c3.8-1 3.5-8.3 8.4-9.2 1.9-.3 3.4.8 3.2 2.5-.2 2.4-3.5 2.6-5.1 3.1-2.3.7-4.1 2-5.4 4.3" /><path d="M3.4 16.3h3.7" /></svg>;
    case 'brush':
        return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.7 3.2c1.2-1.2 3.2.8 2 2l-6.5 6.5-2.1-2.1Z" /><path d="M6.4 9.8c-2.8.5-2.2 3.3-3.8 5.2 2.6.3 5.1-.5 5.7-3.1" /></svg>;
    case 'eraser':
        return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 13.8 6.9-8.2c.6-.7 1.7-.8 2.4-.2l1.1.9c.7.6.8 1.7.2 2.4l-6.1 7.2H6.8Z" /><path d="M8.9 15.9h6.5" /></svg>;
    case 'fill':
        return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4.1 10.5 5.8-5.8 5.2 5.2-5.8 5.8Z" /><path d="M4.1 10.5h11M13.7 14.1c0-1.4 1.2-2.7 1.8-3.4.7.8 1.8 2 1.8 3.4 0 1-.8 1.8-1.8 1.8s-1.8-.8-1.8-1.8Z" /></svg>;
    case 'eyedropper':
        return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m11.2 4.2 4.6 4.6-7.6 7.6H4v-4.2Z" /><path d="m10.1 5.3 4.6 4.6M4.3 16.4l3.2-3.2" /></svg>;
    case 'line':
        return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 15.5 12-11" /></svg>;
    case 'rect':
        return <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="5" width="12" height="10" rx=".6" /></svg>;
    case 'ellipse':
        return <svg viewBox="0 0 20 20" aria-hidden="true"><ellipse cx="10" cy="10" rx="6.2" ry="5" /></svg>;
    case 'path':
        return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 15.3 9.2 5l2.2 5.1 3.7-4" /><circle cx="5" cy="15.3" r="1.2" /><circle cx="9.2" cy="5" r="1.2" /><circle cx="11.4" cy="10.1" r="1.2" /><circle cx="15.1" cy="6.1" r="1.2" /></svg>;
    case 'text':
        return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 5h11M10 5v10M7.3 15h5.4" /></svg>;
    case 'hand':
        return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.2 9.4V5.8c0-1.4 1.8-1.4 1.8 0v2.7-4c0-1.4 1.9-1.4 1.9 0v4-3.3c0-1.4 1.9-1.4 1.9 0v3.5-2.3c0-1.3 1.8-1.2 1.8.1v4.7c0 3-1.7 5.1-4.6 5.1H8c-1.7 0-2.8-.8-3.8-2.1L2.9 12.5c-.8-1.1.7-2.2 1.6-1.3l1.7 1.7Z" /></svg>;
    case 'zoom':
        return <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.6" cy="8.6" r="4.8" /><path d="m12.2 12.2 4 4M6.3 8.6h4.6M8.6 6.3v4.6" /></svg>;
    default:
        return <span aria-hidden="true">•</span>;
    }
};

ToolGlyph.propTypes = {tool: PropTypes.string.isRequired};

const HistoryGlyph = ({direction}) => (
    <svg viewBox="0 0 20 20" aria-hidden="true">
        {direction === 'undo' ? (
            <path d="M7.4 6.2 3.7 9.7l3.7 3.4M4.2 9.7h7.1c3 0 4.8 1.6 4.8 4.2" />
        ) : (
            <path d="m12.6 6.2 3.7 3.5-3.7 3.4m3.2-3.4H8.7c-3 0-4.8 1.6-4.8 4.2" />
        )}
    </svg>
);

HistoryGlyph.propTypes = {direction: PropTypes.oneOf(['undo', 'redo']).isRequired};

const NativePaintShell = ({
    activeTool,
    backendLabel,
    busy,
    canCommit,
    canRedo,
    canUndo,
    children,
    compatibility,
    contextActions,
    dirty,
    mode,
    notice,
    onCommit,
    onContextAction,
    onDiscard,
    onRedo,
    onReview,
    onSelectTool,
    onUndo,
    onZoomChange,
    resourceLabel,
    stale,
    tools,
    zoom
}) => {
    const [activePanel, setActivePanel] = React.useState(null);

    if (compatibility) {
        return (
            <section
                className={styles.compatibilityRoot}
                data-ngvge-native-paint-shell="true"
                data-ngvge-native-paint-shell-id={NATIVE_PAINT_SHELL_ID}
                data-ngvge-paint-shell-mode={mode}
            >
                <div className={styles.compatibilityCanvas}>{children}</div>
            </section>
        );
    }

    const modeLabel = getPaintModeLabel(mode);
    const activeToolLabel = getPaintToolLabel(activeTool);
    const stateLabel = stale ? 'Source changed' : (dirty ? 'Unsaved changes' : 'Saved');

    return (
        <section
            className={styles.root}
            data-ngvge-native-paint-shell="true"
            data-ngvge-native-paint-shell-id={NATIVE_PAINT_SHELL_ID}
            data-ngvge-paint-shell-mode={mode}
        >
            <header
                className={styles.contextBar}
                data-ngvge-paint-shell-slot={NATIVE_PAINT_SHELL_SLOTS.CONTEXT_TOOLBAR}
            >
                <div className={styles.contextIdentity}>
                    <span className={styles.modeBadge}>{modeLabel}</span>
                    <span className={styles.contextTool}>{activeToolLabel}</span>
                    <span className={styles.contextDivider} />
                    <span className={styles.documentLabel} title={resourceLabel}>{resourceLabel}</span>
                </div>
                {contextActions.length ? (
                    <div className={styles.selectionActions} role="toolbar" aria-label="Selection actions">
                        {contextActions.map(action => (
                            <button
                                key={action.id}
                                type="button"
                                className={styles.compactActionButton}
                                title={action.title || action.label}
                                disabled={busy || action.disabled}
                                onClick={() => onContextAction(action.id)}
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                ) : null}
                <div className={styles.contextActions}>
                    <button
                        type="button"
                        className={styles.iconButton}
                        title="Undo"
                        aria-label="Undo"
                        disabled={!canUndo || busy}
                        onClick={onUndo}
                    >
                        <HistoryGlyph direction="undo" />
                    </button>
                    <button
                        type="button"
                        className={styles.iconButton}
                        title="Redo"
                        aria-label="Redo"
                        disabled={!canRedo || busy}
                        onClick={onRedo}
                    >
                        <HistoryGlyph direction="redo" />
                    </button>
                    <span className={styles.actionDivider} />
                    {dirty ? (
                        <button type="button" className={styles.secondaryButton} disabled={busy} onClick={onDiscard}>
                            Discard
                        </button>
                    ) : null}
                    {dirty ? (
                        <button type="button" className={styles.secondaryButton} disabled={busy} onClick={onReview}>
                            Review
                        </button>
                    ) : null}
                    {canCommit ? (
                        <button type="button" className={styles.primaryButton} disabled={busy} onClick={onCommit}>
                            Commit
                        </button>
                    ) : null}
                </div>
            </header>

            {notice ? <div className={styles.notice} role="status">{notice}</div> : null}

            <div className={styles.workarea}>
                <nav
                    className={styles.toolRail}
                    aria-label={`${modeLabel} paint tools`}
                    data-ngvge-paint-shell-slot={NATIVE_PAINT_SHELL_SLOTS.TOOL_RAIL}
                >
                    {tools.map(tool => (
                        <button
                            key={tool}
                            type="button"
                            className={`${styles.toolButton} ${activeTool === tool ? styles.toolButtonActive : ''}`}
                            aria-label={getPaintToolLabel(tool)}
                            title={getPaintToolLabel(tool)}
                            aria-pressed={activeTool === tool}
                            disabled={busy}
                            onClick={() => onSelectTool(tool)}
                        >
                            <ToolGlyph tool={tool} />
                        </button>
                    ))}
                </nav>

                <div className={styles.canvasColumn}>
                    <main
                        className={styles.canvasChrome}
                        data-ngvge-paint-canvas-chrome="true"
                        data-ngvge-paint-shell-slot={NATIVE_PAINT_SHELL_SLOTS.CANVAS_CHROME}
                    >
                        {children}
                    </main>
                    <footer
                        className={styles.statusBar}
                        data-ngvge-paint-shell-slot={NATIVE_PAINT_SHELL_SLOTS.STATUS_BAR}
                    >
                        <div className={styles.statusLeft}>
                            <span className={`${styles.stateDot} ${dirty ? styles.stateDotDirty : ''} ${stale ? styles.stateDotStale : ''}`} />
                            <span>{stateLabel}</span>
                            <span className={styles.statusDivider} />
                            <span>{backendLabel}</span>
                        </div>
                        <div className={styles.statusRight}>
                            {zoom ? (
                                <select
                                    className={styles.zoomSelect}
                                    aria-label={`${modeLabel} zoom`}
                                    value={zoom && zoom.mode === 'manual' && [25, 50, 100, 200].includes(Math.round(zoom.zoomPercent)) ?
                                        String(Math.round(zoom.zoomPercent)) : 'fit'}
                                    onChange={event => onZoomChange(event.target.value === 'fit' ? 'fit' : Number(event.target.value) / 100)}
                                >
                                    <option value="25">25%</option>
                                    <option value="50">50%</option>
                                    <option value="100">100%</option>
                                    <option value="200">200%</option>
                                    <option value="fit">Fit ({zoom ? Math.round(zoom.zoomPercent) : 100}%)</option>
                                </select>
                            ) : null}
                            <span className={styles.statusDivider} />
                            <span>{modeLabel}</span>
                        </div>
                    </footer>
                </div>

                <aside
                    className={styles.panelDock}
                    aria-label="Paint panels"
                    data-ngvge-paint-shell-slot={NATIVE_PAINT_SHELL_SLOTS.PANEL_RAIL}
                >
                    <div className={styles.panelRail}>
                        {Object.keys(PANEL_LABELS).map(panel => (
                            <button
                                key={panel}
                                type="button"
                                className={`${styles.panelButton} ${activePanel === panel ? styles.panelButtonActive : ''}`}
                                title={PANEL_LABELS[panel]}
                                aria-label={PANEL_LABELS[panel]}
                                aria-pressed={activePanel === panel}
                                onClick={() => setActivePanel(activePanel === panel ? null : panel)}
                            >
                                {PANEL_LABELS[panel].slice(0, 1)}
                            </button>
                        ))}
                    </div>
                    {activePanel ? (
                        <div className={styles.panelDrawer} data-ngvge-paint-panel={activePanel}>
                            <div className={styles.panelHeader}>
                                <strong>{PANEL_LABELS[activePanel]}</strong>
                                <button type="button" aria-label="Close panel" onClick={() => setActivePanel(null)}>×</button>
                            </div>
                            <div className={styles.panelEmpty}>
                                {activePanel === 'properties' ? 'No editable selection properties yet.' : null}
                                {activePanel === 'layers' ? 'Layer mapping will attach to this dock.' : null}
                                {activePanel === 'color' ? 'Color and appearance controls will attach to this dock.' : null}
                            </div>
                        </div>
                    ) : null}
                </aside>
            </div>
        </section>
    );
};

NativePaintShell.propTypes = {
    activeTool: PropTypes.string,
    backendLabel: PropTypes.string,
    busy: PropTypes.bool,
    canCommit: PropTypes.bool,
    canRedo: PropTypes.bool,
    canUndo: PropTypes.bool,
    children: PropTypes.node.isRequired,
    compatibility: PropTypes.bool,
    contextActions: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        label: PropTypes.string.isRequired,
        title: PropTypes.string,
        disabled: PropTypes.bool
    })),
    dirty: PropTypes.bool,
    mode: PropTypes.string.isRequired,
    notice: PropTypes.string,
    onCommit: PropTypes.func,
    onContextAction: PropTypes.func,
    onDiscard: PropTypes.func,
    onRedo: PropTypes.func,
    onReview: PropTypes.func,
    onSelectTool: PropTypes.func,
    onUndo: PropTypes.func,
    onZoomChange: PropTypes.func,
    resourceLabel: PropTypes.string,
    stale: PropTypes.bool,
    tools: PropTypes.arrayOf(PropTypes.string),
    zoom: PropTypes.shape({
        mode: PropTypes.string,
        zoom: PropTypes.number,
        zoomPercent: PropTypes.number,
        pan: PropTypes.shape({x: PropTypes.number, y: PropTypes.number})
    })
};

NativePaintShell.defaultProps = {
    activeTool: 'select',
    backendLabel: 'Paint backend',
    busy: false,
    canCommit: false,
    canRedo: false,
    canUndo: false,
    compatibility: false,
    contextActions: [],
    dirty: false,
    notice: null,
    onCommit: () => {},
    onContextAction: () => {},
    onDiscard: () => {},
    onRedo: () => {},
    onReview: () => {},
    onSelectTool: () => {},
    onUndo: () => {},
    onZoomChange: () => {},
    resourceLabel: 'Untitled',
    stale: false,
    tools: [],
    zoom: null
};

export {VECTOR_TOOL_LABELS};
export default NativePaintShell;
