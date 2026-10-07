import PropTypes from 'prop-types';
import React from 'react';

import {
    BITMAP_RASTER_BACKEND_DESCRIPTOR,
    BITMAP_RASTER_TOOLS,
    createCanvasRasterBackendAdapter
} from '../../lib/paint-backends/canvas-raster-backend';
import {createPaintBackendBinding} from '../../lib/paint-backends/paint-backend-contract';
import {
    createStaticBitmapTransferFromWorkingCopy,
    createWorkingCopyEditFromCanvasRasterTransfer,
    probeBitmapWorkingCopyDimensions
} from '../../lib/paint-backends/canvas-raster-transfer';

import styles from './workspace-paint.css';

const DEFAULT_STAGE_SIZE = Object.freeze({width: 480, height: 360});
const EMPTY_STATE = Object.freeze({
    ready: false,
    activeTool: 'brush',
    history: {canUndo: false, canRedo: false},
    zoom: {mode: 'fit', zoom: 1, zoomPercent: 100, pan: {x: 0, y: 0}},
    color: {r: 0, g: 0, b: 0, a: 255},
    brushSize: 8
});

const TOOL_SHORTCUTS = Object.freeze({
    b: 'brush',
    e: 'eraser',
    g: 'fill',
    i: 'eyedropper',
    h: 'hand',
    z: 'zoom'
});

const isTextEntryTarget = target => Boolean(target && (
    target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/i.test(target.tagName || '')
));

const resolveRasterWorkspaceGeometry = ({workingCopy, sourceGeometry, dimensions, stageSize}) => {
    const width = Math.max(1, Number(dimensions && dimensions.width) || 1);
    const height = Math.max(1, Number(dimensions && dimensions.height) || 1);
    const sourceGeometryAvailable = Boolean(sourceGeometry && typeof sourceGeometry === 'object');
    const sourceRotationCenterX = Number(sourceGeometryAvailable && sourceGeometry.rotationCenterX);
    const sourceRotationCenterY = Number(sourceGeometryAvailable && sourceGeometry.rotationCenterY);
    const sourceBitmapResolution = Number(sourceGeometryAvailable && sourceGeometry.bitmapResolution);
    const workingRotationCenterX = Number(workingCopy && workingCopy.rotationCenterX);
    const workingRotationCenterY = Number(workingCopy && workingCopy.rotationCenterY);
    const workingBitmapResolution = Number(workingCopy && workingCopy.bitmapResolution);
    const stageWidth = Number(stageSize && stageSize.width);
    const stageHeight = Number(stageSize && stageSize.height);

    // Scratch Paint treats an absent bitmap rotation center as the decoded image center.
    // The Resource bridge historically normalized absent geometry to 0, which destroys the
    // distinction between "missing" and an intentional top-left pivot. When the live Scratch
    // costume geometry is available, it is therefore the compatibility/adoption hint for a
    // clean Raster session. Explicit finite 0 values remain valid and are never replaced.
    const rotationCenterX = sourceGeometryAvailable ?
        (Number.isFinite(sourceRotationCenterX) ? sourceRotationCenterX : width / 2) :
        (Number.isFinite(workingRotationCenterX) ? workingRotationCenterX : width / 2);
    const rotationCenterY = sourceGeometryAvailable ?
        (Number.isFinite(sourceRotationCenterY) ? sourceRotationCenterY : height / 2) :
        (Number.isFinite(workingRotationCenterY) ? workingRotationCenterY : height / 2);
    const bitmapResolution = Number.isFinite(sourceBitmapResolution) && sourceBitmapResolution > 0 ?
        sourceBitmapResolution :
        (Number.isFinite(workingBitmapResolution) && workingBitmapResolution > 0 ? workingBitmapResolution : 2);

    return Object.freeze({
        stageWidth: Number.isFinite(stageWidth) && stageWidth > 0 ? stageWidth : DEFAULT_STAGE_SIZE.width,
        stageHeight: Number.isFinite(stageHeight) && stageHeight > 0 ? stageHeight : DEFAULT_STAGE_SIZE.height,
        rotationCenterX,
        rotationCenterY,
        bitmapResolution
    });
};

const resolveRasterExportGeometry = ({workspaceState, workspaceGeometry, workingCopy}) => {
    const surfaceRotationCenter = workspaceState && workspaceState.surface &&
        workspaceState.surface.rotationCenter;
    const bitmapResolution = workspaceGeometry ? workspaceGeometry.bitmapResolution : workingCopy.bitmapResolution;
    const rotationCenterX = surfaceRotationCenter && Number.isFinite(surfaceRotationCenter.x) ?
        surfaceRotationCenter.x : (workspaceGeometry ? workspaceGeometry.rotationCenterX : workingCopy.rotationCenterX);
    const rotationCenterY = surfaceRotationCenter && Number.isFinite(surfaceRotationCenter.y) ?
        surfaceRotationCenter.y : (workspaceGeometry ? workspaceGeometry.rotationCenterY : workingCopy.rotationCenterY);
    return Object.freeze({bitmapResolution, rotationCenterX, rotationCenterY});
};

const WorkspaceRasterEditor = React.forwardRef(({
    workingCopy,
    stageSize,
    sourceGeometry,
    onApplyEdit,
    onBackendStateChange,
    onError
}, forwardedRef) => {
    const hostRef = React.useRef(null);
    const bindingRef = React.useRef(null);
    const controlsRef = React.useRef(null);
    const panGestureRef = React.useRef(null);
    const workingCopyRef = React.useRef(workingCopy);
    const workspaceGeometryRef = React.useRef(null);
    const [state, setState] = React.useState(EMPTY_STATE);
    const [spacePanning, setSpacePanning] = React.useState(false);

    React.useEffect(() => {
        workingCopyRef.current = workingCopy;
    }, [workingCopy]);

    const reportError = React.useCallback(error => {
        if (typeof onError === 'function') onError(error);
    }, [onError]);

    const syncState = React.useCallback(() => {
        if (!controlsRef.current) return;
        try {
            setState(controlsRef.current.getState());
        } catch (error) {
            reportError(error);
        }
    }, [reportError]);

    const syncExport = React.useCallback(() => {
        const binding = bindingRef.current;
        const currentWorkingCopy = workingCopyRef.current;
        if (!binding || !controlsRef.current || !currentWorkingCopy) return;
        try {
            const transfer = binding.exportTransfer();
            const geometry = workspaceGeometryRef.current;
            const workspaceState = controlsRef.current.getWorkspaceState();
            onApplyEdit(createWorkingCopyEditFromCanvasRasterTransfer(transfer, resolveRasterExportGeometry({
                workspaceState,
                workspaceGeometry: geometry,
                workingCopy: currentWorkingCopy
            })));
            syncState();
        } catch (error) {
            reportError(error);
        }
    }, [onApplyEdit, reportError, syncState]);

    React.useEffect(() => {
        if (!hostRef.current) return;
        let unsubscribe = () => {};
        try {
            const adapter = createCanvasRasterBackendAdapter();
            const binding = createPaintBackendBinding({
                descriptor: BITMAP_RASTER_BACKEND_DESCRIPTOR,
                implementation: adapter.implementation
            });
            binding.mount(hostRef.current, {width: 640, height: 420});
            bindingRef.current = binding;
            controlsRef.current = adapter.controls;
            unsubscribe = binding.subscribe(event => {
                if (event.type === 'content:changed' || event.type === 'history:undo' || event.type === 'history:redo') {
                    syncExport();
                } else {
                    syncState();
                }
            });
            controlsRef.current.setTool('brush');
            syncState();
        } catch (error) {
            reportError(error);
        }
        return () => {
            unsubscribe();
            if (bindingRef.current) bindingRef.current.dispose();
            bindingRef.current = null;
            controlsRef.current = null;
        };
    }, [reportError, syncExport, syncState]);

    React.useEffect(() => {
        if (!bindingRef.current || !controlsRef.current || !workingCopy) return undefined;
        let cancelled = false;
        probeBitmapWorkingCopyDimensions(workingCopy).then(dimensions => {
            if (cancelled || !bindingRef.current || !controlsRef.current) return;
            const geometry = resolveRasterWorkspaceGeometry({workingCopy, sourceGeometry, dimensions, stageSize});
            workspaceGeometryRef.current = geometry;
            controlsRef.current.setWorkspaceContext(geometry);
            const transfer = createStaticBitmapTransferFromWorkingCopy(workingCopy, dimensions);
            bindingRef.current.load(transfer);
            bindingRef.current.setActiveTarget(transfer.activeTarget);
            controlsRef.current.setTool('brush');
            syncState();
        }).catch(reportError);
        return () => { cancelled = true; };
    }, [
        workingCopy && workingCopy.workingCopyId,
        stageSize && stageSize.width,
        stageSize && stageSize.height,
        sourceGeometry && sourceGeometry.bitmapResolution,
        sourceGeometry && sourceGeometry.rotationCenterX,
        sourceGeometry && sourceGeometry.rotationCenterY,
        reportError,
        syncState
    ]);

    React.useEffect(() => {
        if (!hostRef.current || !bindingRef.current) return undefined;
        const host = hostRef.current;
        let observer = null;
        const measure = () => {
            if (!bindingRef.current) return;
            const rect = host.getBoundingClientRect();
            const width = Number(rect.width) || Number(host.clientWidth);
            const height = Number(rect.height) || Number(host.clientHeight);
            if (width > 0 && height > 0) bindingRef.current.resize({width, height});
            syncState();
        };
        measure();
        if (typeof ResizeObserver === 'function') {
            observer = new ResizeObserver(measure);
            observer.observe(host);
        } else if (typeof window !== 'undefined') {
            window.addEventListener('resize', measure);
        }
        return () => {
            if (observer) observer.disconnect();
            else if (typeof window !== 'undefined') window.removeEventListener('resize', measure);
        };
    }, [syncState]);

    const setTool = React.useCallback(tool => {
        try {
            if (!controlsRef.current) return false;
            controlsRef.current.setTool(tool);
            if (bindingRef.current) bindingRef.current.focus();
            syncState();
            return true;
        } catch (error) {
            reportError(error);
            return false;
        }
    }, [reportError, syncState]);

    const undo = React.useCallback(() => {
        try {
            const result = bindingRef.current ? bindingRef.current.undo() : false;
            syncState();
            return result;
        } catch (error) {
            reportError(error);
            return false;
        }
    }, [reportError, syncState]);

    const redo = React.useCallback(() => {
        try {
            const result = bindingRef.current ? bindingRef.current.redo() : false;
            syncState();
            return result;
        } catch (error) {
            reportError(error);
            return false;
        }
    }, [reportError, syncState]);

    const setZoom = React.useCallback(value => {
        try {
            if (!controlsRef.current) return null;
            const result = controlsRef.current.setZoom(value);
            syncState();
            return result;
        } catch (error) {
            reportError(error);
            return null;
        }
    }, [reportError, syncState]);

    const fitToView = React.useCallback(() => {
        try {
            if (!controlsRef.current) return null;
            const result = controlsRef.current.fitToView();
            syncState();
            return result;
        } catch (error) {
            reportError(error);
            return null;
        }
    }, [reportError, syncState]);

    React.useImperativeHandle(forwardedRef, () => ({
        setTool,
        undo,
        redo,
        focus: () => bindingRef.current && bindingRef.current.focus(),
        getState: () => controlsRef.current ? controlsRef.current.getState() : EMPTY_STATE,
        setZoom,
        fitToView
    }), [fitToView, redo, setTool, setZoom, undo]);

    React.useEffect(() => {
        if (typeof onBackendStateChange === 'function') onBackendStateChange(state);
    }, [onBackendStateChange, state]);

    React.useEffect(() => {
        const handleKeyDown = event => {
            if (isTextEntryTarget(event.target)) return;
            const key = String(event.key || '').toLowerCase();
            const modifier = event.ctrlKey || event.metaKey;
            if (modifier && key === 'z') {
                event.preventDefault();
                if (event.shiftKey) redo();
                else undo();
                return;
            }
            if (!modifier && !event.altKey && key === ' ') {
                setSpacePanning(true);
                event.preventDefault();
                return;
            }
            if (!modifier && !event.altKey && TOOL_SHORTCUTS[key]) {
                event.preventDefault();
                setTool(TOOL_SHORTCUTS[key]);
            }
        };
        const handleKeyUp = event => {
            if (String(event.key || '').toLowerCase() === ' ') setSpacePanning(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [redo, setTool, undo]);

    const shouldPan = spacePanning || state.activeTool === 'hand';
    const handlePointerDownCapture = event => {
        if (!shouldPan || !controlsRef.current) return;
        panGestureRef.current = {pointerId: event.pointerId, x: event.clientX, y: event.clientY};
        event.preventDefault();
        event.stopPropagation();
    };
    const handlePointerMoveCapture = event => {
        const gesture = panGestureRef.current;
        if (!gesture || gesture.pointerId !== event.pointerId || !controlsRef.current) return;
        const dx = event.clientX - gesture.x;
        const dy = event.clientY - gesture.y;
        panGestureRef.current = {...gesture, x: event.clientX, y: event.clientY};
        controlsRef.current.panBy(dx, dy);
        syncState();
        event.preventDefault();
        event.stopPropagation();
    };
    const handlePointerEndCapture = event => {
        const gesture = panGestureRef.current;
        if (!gesture || gesture.pointerId !== event.pointerId) return;
        panGestureRef.current = null;
        event.preventDefault();
        event.stopPropagation();
    };

    return (
        <div
            className={styles.rasterEditor}
            data-ngvge-raster-editor="true"
            data-ngvge-raster-ready={state.ready ? 'true' : 'false'}
            data-ngvge-raster-tool={spacePanning ? 'hand-temporary' : state.activeTool}
            onPointerDownCapture={handlePointerDownCapture}
            onPointerMoveCapture={handlePointerMoveCapture}
            onPointerUpCapture={handlePointerEndCapture}
            onPointerCancelCapture={handlePointerEndCapture}
        >
            <div className={styles.rasterCanvasHost} ref={hostRef} />
        </div>
    );
});

WorkspaceRasterEditor.displayName = 'WorkspaceRasterEditor';
WorkspaceRasterEditor.propTypes = {
    workingCopy: PropTypes.shape({
        workingCopyId: PropTypes.string.isRequired,
        resourceId: PropTypes.string.isRequired,
        dataFormat: PropTypes.string.isRequired,
        bitmapResolution: PropTypes.number,
        rotationCenterX: PropTypes.number,
        rotationCenterY: PropTypes.number,
        content: PropTypes.shape({kind: PropTypes.string.isRequired}).isRequired
    }).isRequired,
    stageSize: PropTypes.shape({width: PropTypes.number, height: PropTypes.number}),
    sourceGeometry: PropTypes.shape({
        bitmapResolution: PropTypes.number,
        rotationCenterX: PropTypes.number,
        rotationCenterY: PropTypes.number
    }),
    onApplyEdit: PropTypes.func.isRequired,
    onBackendStateChange: PropTypes.func,
    onError: PropTypes.func
};

export {BITMAP_RASTER_TOOLS, resolveRasterExportGeometry, resolveRasterWorkspaceGeometry};
export default WorkspaceRasterEditor;
