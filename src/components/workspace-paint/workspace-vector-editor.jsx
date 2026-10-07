import SvgCanvas from '@svgedit/svgcanvas';
import PropTypes from 'prop-types';
import React from 'react';

import {
    SVG_EDIT_VECTOR_BACKEND_DESCRIPTOR,
    VECTOR_PAINT_TOOLS,
    createSvgEditVectorBackendAdapter
} from '../../lib/paint-backends/svg-edit-vector-backend';
import {createPaintBackendBinding} from '../../lib/paint-backends/paint-backend-contract';
import {
    createSvgEditVectorTransferFromWorkingCopy,
    createWorkingCopyEditFromSvgEditTransfer
} from '../../lib/paint-backends/svg-edit-vector-transfer';

import styles from './workspace-paint.css';

const TOOL_LABELS = Object.freeze({
    select: 'Selection',
    'direct-select': 'Direct Selection',
    freehand: 'Pencil',
    line: 'Line',
    rect: 'Rectangle',
    ellipse: 'Ellipse',
    path: 'Pen',
    text: 'Text',
    hand: 'Hand',
    zoom: 'Zoom'
});

const TOOL_SHORTCUTS = Object.freeze({
    v: 'select',
    a: 'direct-select',
    p: 'path',
    t: 'text',
    m: 'rect',
    l: 'ellipse',
    h: 'hand',
    z: 'zoom'
});

const EMPTY_SELECTION = Object.freeze({
    count: 0,
    tags: [],
    canGroup: false,
    canUngroup: false,
    canDirectSelect: false,
    directEditing: false
});
const DEFAULT_ZOOM = Object.freeze({mode: 'fit', zoom: 1, zoomPercent: 100, pan: {x: 0, y: 0}});
const DEFAULT_STAGE_SIZE = Object.freeze({width: 480, height: 360});

const isTextEntryTarget = target => Boolean(target && (
    target.isContentEditable ||
    /^(INPUT|TEXTAREA|SELECT)$/i.test(target.tagName || '')
));

const WorkspaceVectorEditor = React.forwardRef(({
    workingCopy,
    stageSize,
    onApplyEdit,
    onBackendStateChange,
    onError,
    showToolbar
}, forwardedRef) => {
    const containerRef = React.useRef(null);
    const bindingRef = React.useRef(null);
    const controlsRef = React.useRef(null);
    const panGestureRef = React.useRef(null);
    const [ready, setReady] = React.useState(false);
    const [activeTool, setActiveTool] = React.useState('select');
    const [history, setHistory] = React.useState({canUndo: false, canRedo: false});
    const [selection, setSelection] = React.useState(EMPTY_SELECTION);
    const [zoom, setZoomState] = React.useState(DEFAULT_ZOOM);
    const [spacePanning, setSpacePanning] = React.useState(false);

    const reportError = React.useCallback(error => {
        if (typeof onError === 'function') onError(error);
    }, [onError]);

    const syncBackendState = React.useCallback(() => {
        const binding = bindingRef.current;
        const controls = controlsRef.current;
        if (!binding || !controls) return;
        try {
            setHistory(binding.getHistoryState());
            setActiveTool(controls.getTool());
            setSelection(controls.getSelectionState());
            setZoomState(controls.getZoomState());
        } catch (error) {
            reportError(error);
        }
    }, [reportError]);

    const syncExport = React.useCallback(() => {
        const binding = bindingRef.current;
        if (!binding) return;
        try {
            const transfer = binding.exportTransfer();
            const exportMetadata = controlsRef.current && typeof controlsRef.current.getExportMetadata === 'function' ?
                controlsRef.current.getExportMetadata() : null;
            onApplyEdit(createWorkingCopyEditFromSvgEditTransfer(transfer, exportMetadata || {}));
            syncBackendState();
        } catch (error) {
            reportError(error);
        }
    }, [onApplyEdit, reportError, syncBackendState]);

    React.useEffect(() => {
        if (!containerRef.current) return;
        let unsubscribe = () => {};
        try {
            const adapter = createSvgEditVectorBackendAdapter({SvgCanvasClass: SvgCanvas});
            const binding = createPaintBackendBinding({
                descriptor: SVG_EDIT_VECTOR_BACKEND_DESCRIPTOR,
                implementation: adapter.implementation
            });
            binding.mount(containerRef.current, {
                dimensions: [640, 420],
                initFill: {color: 'ffffff', opacity: 1},
                initStroke: {color: '111111', opacity: 1, width: 2},
                initTool: 'select',
                no_save_warning: true,
                showlayers: false
            });
            bindingRef.current = binding;
            controlsRef.current = adapter.controls;
            unsubscribe = binding.subscribe(event => {
                if (event.type === 'content:changed' || event.type === 'history:undo' ||
                    event.type === 'history:redo') {
                    syncExport();
                } else if (event.type === 'selection:changed' || event.type === 'tool:changed') {
                    syncBackendState();
                }
            });
            setReady(true);
            syncBackendState();
        } catch (error) {
            reportError(error);
        }
        return () => {
            unsubscribe();
            if (bindingRef.current) bindingRef.current.dispose();
            bindingRef.current = null;
            controlsRef.current = null;
            setReady(false);
        };
    }, [reportError, syncBackendState, syncExport]);

    React.useEffect(() => {
        if (!ready || !bindingRef.current || !workingCopy) return;
        try {
            const transfer = createSvgEditVectorTransferFromWorkingCopy(workingCopy);
            const stageWidth = Number(stageSize && stageSize.width);
            const stageHeight = Number(stageSize && stageSize.height);
            const rotationCenterX = Number(workingCopy.rotationCenterX);
            const rotationCenterY = Number(workingCopy.rotationCenterY);
            controlsRef.current.setWorkspaceContext({
                stageWidth: Number.isFinite(stageWidth) && stageWidth > 0 ? stageWidth : DEFAULT_STAGE_SIZE.width,
                stageHeight: Number.isFinite(stageHeight) && stageHeight > 0 ? stageHeight : DEFAULT_STAGE_SIZE.height,
                rotationCenterX: Number.isFinite(rotationCenterX) ? rotationCenterX : transfer.document.viewport.width / 2,
                rotationCenterY: Number.isFinite(rotationCenterY) ? rotationCenterY : transfer.document.viewport.height / 2
            });
            bindingRef.current.load(transfer);
            bindingRef.current.setActiveTarget({});
            controlsRef.current.setTool('select');
            syncBackendState();
        } catch (error) {
            reportError(error);
        }
    }, [ready, workingCopy && workingCopy.workingCopyId, reportError, syncBackendState]);

    React.useEffect(() => {
        if (!ready || !controlsRef.current) return;
        try {
            const workspace = controlsRef.current.getWorkspaceState();
            if (!workspace || !workspace.stage) return;
            const stageWidth = Number(stageSize && stageSize.width);
            const stageHeight = Number(stageSize && stageSize.height);
            controlsRef.current.setWorkspaceContext({
                ...workspace.stage,
                stageWidth: Number.isFinite(stageWidth) && stageWidth > 0 ? stageWidth : DEFAULT_STAGE_SIZE.width,
                stageHeight: Number.isFinite(stageHeight) && stageHeight > 0 ? stageHeight : DEFAULT_STAGE_SIZE.height
            });
            syncBackendState();
        } catch (error) {
            reportError(error);
        }
    }, [ready, stageSize && stageSize.width, stageSize && stageSize.height, reportError, syncBackendState]);

    React.useEffect(() => {
        if (!ready || !containerRef.current || !bindingRef.current) return;
        const element = containerRef.current;
        let observer = null;

        const applySize = (width, height) => {
            if (!bindingRef.current || !Number.isFinite(width) || width <= 0 ||
                !Number.isFinite(height) || height <= 0) return;
            try {
                bindingRef.current.resize({width, height});
                syncBackendState();
            } catch (error) {
                reportError(error);
            }
        };

        const measure = () => {
            const rect = typeof element.getBoundingClientRect === 'function' ? element.getBoundingClientRect() : null;
            const width = Number(rect && rect.width) || Number(element.clientWidth);
            const height = Number(rect && rect.height) || Number(element.clientHeight);
            applySize(width, height);
        };

        measure();
        if (typeof ResizeObserver === 'function') {
            observer = new ResizeObserver(entries => {
                const entry = entries && entries[0];
                const rect = entry && entry.contentRect;
                if (rect) applySize(Number(rect.width), Number(rect.height));
                else measure();
            });
            observer.observe(element);
        } else if (typeof window !== 'undefined') {
            window.addEventListener('resize', measure);
        }

        return () => {
            if (observer) observer.disconnect();
            else if (typeof window !== 'undefined') window.removeEventListener('resize', measure);
        };
    }, [ready, reportError, syncBackendState]);

    const chooseTool = React.useCallback(tool => {
        try {
            controlsRef.current.setTool(tool);
            syncBackendState();
            if (bindingRef.current) bindingRef.current.focus();
        } catch (error) {
            reportError(error);
        }
    }, [reportError, syncBackendState]);

    const runHistory = React.useCallback(direction => {
        try {
            const binding = bindingRef.current;
            if (!binding) return false;
            const result = direction === 'undo' ? binding.undo() : binding.redo();
            syncBackendState();
            return result;
        } catch (error) {
            reportError(error);
            return false;
        }
    }, [reportError, syncBackendState]);

    const runCommand = React.useCallback((command, payload = {}) => {
        try {
            if (!controlsRef.current) return null;
            const result = controlsRef.current.runCommand(command, payload);
            syncBackendState();
            if (bindingRef.current) bindingRef.current.focus();
            return result;
        } catch (error) {
            reportError(error);
            return null;
        }
    }, [reportError, syncBackendState]);

    const setPresentationZoom = React.useCallback(value => {
        try {
            if (!controlsRef.current) return null;
            const result = value === 'fit' ? controlsRef.current.fitToView() : controlsRef.current.setZoom(value);
            syncBackendState();
            return result;
        } catch (error) {
            reportError(error);
            return null;
        }
    }, [reportError, syncBackendState]);

    const panPresentationBy = React.useCallback((dx, dy) => {
        try {
            if (!controlsRef.current || typeof controlsRef.current.panBy !== 'function') return null;
            const result = controlsRef.current.panBy(dx, dy);
            syncBackendState();
            return result;
        } catch (error) {
            reportError(error);
            return null;
        }
    }, [reportError, syncBackendState]);

    const handleKeyDown = React.useCallback(event => {
        if (!ready || isTextEntryTarget(event.target)) return;
        const key = String(event.key || '');
        const lower = key.toLowerCase();
        const primary = event.ctrlKey || event.metaKey;

        if (!primary && !event.altKey && (key === ' ' || key === 'Spacebar')) {
            event.preventDefault();
            if (!event.repeat) setSpacePanning(true);
            return;
        }

        if (primary) {
            if (lower === 'z') {
                event.preventDefault();
                runHistory(event.shiftKey ? 'redo' : 'undo');
                return;
            }
            const command = {
                c: 'copy',
                x: 'cut',
                v: 'paste',
                d: 'duplicate',
                g: event.shiftKey ? 'ungroup' : 'group'
            }[lower];
            if (command) {
                event.preventDefault();
                runCommand(command);
                return;
            }
        }

        if (key === 'Delete' || key === 'Backspace') {
            event.preventDefault();
            if (selection.directEditing) runCommand('path-delete-anchor');
            else runCommand('delete');
            return;
        }
        if (key === 'Escape') {
            event.preventDefault();
            runCommand('clear-selection');
            return;
        }
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) {
            event.preventDefault();
            const step = event.shiftKey ? 10 : 1;
            const delta = {
                ArrowLeft: {dx: -step, dy: 0},
                ArrowRight: {dx: step, dy: 0},
                ArrowUp: {dx: 0, dy: -step},
                ArrowDown: {dx: 0, dy: step}
            }[key];
            runCommand('move-selection', delta);
            return;
        }
        if (!primary && !event.altKey && TOOL_SHORTCUTS[lower]) {
            event.preventDefault();
            chooseTool(TOOL_SHORTCUTS[lower]);
        }
    }, [chooseTool, ready, runCommand, runHistory, selection.directEditing]);

    const handleKeyUp = React.useCallback(event => {
        if (event.key === ' ' || event.key === 'Spacebar') {
            event.preventDefault();
            setSpacePanning(false);
            panGestureRef.current = null;
        }
    }, []);

    const handlePointerDownCapture = React.useCallback(event => {
        if (!ready || event.button !== 0) return;
        if (activeTool === 'zoom' && !spacePanning) {
            event.preventDefault();
            event.stopPropagation();
            const currentZoom = Number(zoom && zoom.zoom) || 1;
            const nextZoom = Math.max(0.05, Math.min(32, currentZoom * (event.shiftKey ? 0.5 : 2)));
            setPresentationZoom(nextZoom);
            return;
        }
        if (activeTool !== 'hand' && !spacePanning) return;
        event.preventDefault();
        event.stopPropagation();
        panGestureRef.current = {pointerId: event.pointerId, x: event.clientX, y: event.clientY};
        if (event.currentTarget && typeof event.currentTarget.setPointerCapture === 'function') {
            event.currentTarget.setPointerCapture(event.pointerId);
        }
    }, [activeTool, ready, setPresentationZoom, spacePanning, zoom]);

    const handlePointerMoveCapture = React.useCallback(event => {
        const gesture = panGestureRef.current;
        if (!gesture || gesture.pointerId !== event.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        const dx = Number(event.clientX) - gesture.x;
        const dy = Number(event.clientY) - gesture.y;
        gesture.x = Number(event.clientX);
        gesture.y = Number(event.clientY);
        if (dx || dy) panPresentationBy(dx, dy);
    }, [panPresentationBy]);

    const endPanGesture = React.useCallback(event => {
        const gesture = panGestureRef.current;
        if (!gesture || (event.pointerId !== undefined && gesture.pointerId !== event.pointerId)) return;
        panGestureRef.current = null;
        if (event.currentTarget && event.pointerId !== undefined &&
            typeof event.currentTarget.releasePointerCapture === 'function') {
            try {
                event.currentTarget.releasePointerCapture(event.pointerId);
            } catch {
                // Pointer capture may already be released by the browser.
            }
        }
    }, []);

    React.useImperativeHandle(forwardedRef, () => ({
        focus: () => {
            if (bindingRef.current) bindingRef.current.focus();
        },
        fitToView: () => setPresentationZoom('fit'),
        getState: () => ({ready, activeTool, history, selection, zoom}),
        panBy: panPresentationBy,
        redo: () => runHistory('redo'),
        runCommand,
        setTool: chooseTool,
        setZoom: value => setPresentationZoom(value),
        undo: () => runHistory('undo')
    }), [activeTool, chooseTool, history, panPresentationBy, ready, runCommand, runHistory, selection, setPresentationZoom, zoom]);

    React.useEffect(() => {
        if (typeof onBackendStateChange === 'function') {
            onBackendStateChange({ready, activeTool, history, selection, zoom});
        }
    }, [activeTool, history, onBackendStateChange, ready, selection, zoom]);

    return (
        <div className={styles.vectorEditor} data-ngvge-vector-backend="ngvge.paint-backend.svg-edit">
            {showToolbar ? (
                <div className={styles.vectorToolbar} role="toolbar" aria-label="Vector tools">
                    {VECTOR_PAINT_TOOLS.map(tool => (
                        <button
                            key={tool}
                            type="button"
                            aria-pressed={activeTool === tool}
                            className={activeTool === tool ? styles.vectorToolActive : ''}
                            disabled={!ready}
                            onClick={() => chooseTool(tool)}
                        >
                            {TOOL_LABELS[tool]}
                        </button>
                    ))}
                    <span className={styles.vectorToolbarDivider} />
                    <button type="button" disabled={!ready || !history.canUndo} onClick={() => runHistory('undo')}>Undo</button>
                    <button type="button" disabled={!ready || !history.canRedo} onClick={() => runHistory('redo')}>Redo</button>
                </div>
            ) : null}
            <div
                ref={containerRef}
                className={styles.vectorCanvas}
                tabIndex="0"
                aria-label="SVG vector canvas"
                data-ngvge-vector-workspace="unbounded"
                data-ngvge-vector-tool={spacePanning ? 'hand-temporary' : activeTool}
                onBlur={() => {
                    setSpacePanning(false);
                    panGestureRef.current = null;
                }}
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyUp}
                onPointerCancelCapture={endPanGesture}
                onPointerDownCapture={handlePointerDownCapture}
                onPointerMoveCapture={handlePointerMoveCapture}
                onPointerUpCapture={endPanGesture}
            />
        </div>
    );
});

WorkspaceVectorEditor.displayName = 'WorkspaceVectorEditor';

WorkspaceVectorEditor.propTypes = {
    workingCopy: PropTypes.shape({
        workingCopyId: PropTypes.string.isRequired,
        resourceId: PropTypes.string.isRequired,
        dataFormat: PropTypes.string.isRequired,
        rotationCenterX: PropTypes.number,
        rotationCenterY: PropTypes.number,
        content: PropTypes.object.isRequired
    }).isRequired,
    stageSize: PropTypes.shape({
        width: PropTypes.number,
        height: PropTypes.number
    }),
    onApplyEdit: PropTypes.func.isRequired,
    onBackendStateChange: PropTypes.func,
    onError: PropTypes.func,
    showToolbar: PropTypes.bool
};

WorkspaceVectorEditor.defaultProps = {
    onBackendStateChange: null,
    onError: null,
    showToolbar: true,
    stageSize: DEFAULT_STAGE_SIZE
};

export {TOOL_LABELS, TOOL_SHORTCUTS};
export default WorkspaceVectorEditor;
