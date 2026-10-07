import {normalizePaintBackendTransfer} from './paint-backend-contract';
import {MINIPAINT_BACKEND_ID, getPaintBackendCandidate} from './paint-backend-candidates';
import {floodFillRaster, normalizeRgba, sampleRasterPixel} from './mini-paint-derived-raster-ops';

const CANVAS_RASTER_BACKEND_ADAPTER_ID = 'ngvge.paint-backend-adapter.canvas-raster@1';
const CANVAS_RASTER_BACKEND_PACKAGE = 'ngvge-controlled-raster-core/minipaint-derived@ws10g1';
const BITMAP_RASTER_BACKEND_DESCRIPTOR = getPaintBackendCandidate(MINIPAINT_BACKEND_ID);
const BITMAP_RASTER_TOOLS = Object.freeze(['brush', 'eraser', 'fill', 'eyedropper', 'hand', 'zoom']);
const RASTER_ZOOM_PRESETS = Object.freeze([0.25, 0.5, 1, 2]);
const RASTER_FIT_PADDING = 0.9;
const RASTER_SURFACE_GROWTH_CHUNK = 64;
const RASTER_SURFACE_GROWTH_PADDING = 32;
const DEFAULT_STAGE_SIZE = Object.freeze({width: 480, height: 360});
const DEFAULT_VIEWPORT_SIZE = Object.freeze({width: 640, height: 420});
const DEFAULT_COLOR = Object.freeze({r: 0, g: 0, b: 0, a: 255});

const makeBackendError = (code, message, ErrorClass = Error) => {
    const error = new ErrorClass(message);
    error.code = code;
    return error;
};

const clonePortable = value => JSON.parse(JSON.stringify(value));

const requireDom = documentRef => {
    if (!documentRef || typeof documentRef.createElement !== 'function') {
        throw makeBackendError(
            'NGVGE_PAINT_RASTER_DOM_REQUIRED',
            'Canvas Raster backend requires a browser-like document.',
            TypeError
        );
    }
    return documentRef;
};

const rgbaCss = color => {
    const normalized = normalizeRgba(color);
    return `rgba(${normalized.r}, ${normalized.g}, ${normalized.b}, ${normalized.a / 255})`;
};

const unionBounds = (first, second) => {
    if (!first) return second ? {...second} : null;
    if (!second) return {...first};
    return {
        left: Math.min(first.left, second.left),
        top: Math.min(first.top, second.top),
        right: Math.max(first.right, second.right),
        bottom: Math.max(first.bottom, second.bottom)
    };
};

const getBoundsCenter = bounds => ({
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2
});

const createCanvasRasterBackendAdapter = ({
    documentRef = typeof document === 'undefined' ? null : document,
    ImageClass = typeof Image === 'undefined' ? null : Image
} = {}) => {
    const DOM = requireDom(documentRef);
    let container = null;
    let viewport = null;
    let displayCanvas = null;
    let displayContext = null;
    let surfaceCanvas = null;
    let surfaceContext = null;
    let surfaceOrigin = {x: 0, y: 0};
    let loadedTransfer = null;
    let activeTarget = null;
    let disposed = false;
    let ready = false;
    let activeTool = 'brush';
    let color = DEFAULT_COLOR;
    let brushSize = 8;
    let zoomMode = 'fit';
    let manualZoom = 1;
    let effectiveZoom = 1;
    let pan = {x: 0, y: 0};
    let presentationPan = {x: 0, y: 0};
    let fitCamera = {zoom: 1, pan: {x: 0, y: 0}};
    let fitCameraDirty = true;
    let viewportSize = {...DEFAULT_VIEWPORT_SIZE};
    let workspaceContext = {
        stageWidth: DEFAULT_STAGE_SIZE.width,
        stageHeight: DEFAULT_STAGE_SIZE.height,
        rotationCenterX: 0,
        rotationCenterY: 0,
        bitmapResolution: 2
    };
    let history = [];
    let historyIndex = -1;
    let drawing = false;
    let strokeChanged = false;
    let lastDocumentPoint = null;
    let loadToken = 0;
    let revision = 0;
    let artworkBoundsCache = null;
    let artworkBoundsDirty = true;
    const listeners = new Set();

    const assertActive = () => {
        if (disposed) throw makeBackendError('NGVGE_PAINT_RASTER_DISPOSED', 'Canvas Raster backend has been disposed.');
    };

    const assertMounted = () => {
        assertActive();
        if (!surfaceCanvas || !surfaceContext || !displayCanvas || !displayContext || !viewport) {
            throw makeBackendError('NGVGE_PAINT_RASTER_NOT_MOUNTED', 'Mount Canvas Raster before using it.');
        }
    };

    const emit = type => {
        revision += 1;
        const event = Object.freeze({type, backendId: MINIPAINT_BACKEND_ID, revision, ready});
        listeners.forEach(listener => {
            try {
                listener(event);
            } catch {
                // Backend observers never become Project/Resource authority.
            }
        });
    };

    const getSourceEntry = transfer => {
        const contentId = transfer.activeTarget && transfer.activeTarget.contentId;
        const entry = transfer.contentEntries.find(item => item.semanticId === contentId) || transfer.contentEntries[0];
        if (!entry || entry.role !== 'cel-content' || !entry.content || entry.content.kind !== 'data-uri') {
            throw makeBackendError(
                'NGVGE_PAINT_RASTER_SOURCE_INVALID',
                'Canvas Raster backend requires one RGBA cel-content data URI.'
            );
        }
        return entry;
    };

    const getStageScale = () => (
        Number.isFinite(workspaceContext.bitmapResolution) && workspaceContext.bitmapResolution > 0 ?
            workspaceContext.bitmapResolution : 1
    );

    const getStageBounds = () => {
        const stageScale = getStageScale();
        const width = workspaceContext.stageWidth * stageScale;
        const height = workspaceContext.stageHeight * stageScale;
        return {
            left: -width / 2,
            top: -height / 2,
            right: width / 2,
            bottom: height / 2
        };
    };

    const getSurfaceBounds = () => {
        if (!surfaceCanvas) return null;
        return {
            left: surfaceOrigin.x,
            top: surfaceOrigin.y,
            right: surfaceOrigin.x + surfaceCanvas.width,
            bottom: surfaceOrigin.y + surfaceCanvas.height
        };
    };

    const getSurfaceRotationCenter = () => ({
        x: -surfaceOrigin.x,
        y: -surfaceOrigin.y
    });

    const alignGrowth = value => Math.ceil(Math.max(0, value) / RASTER_SURFACE_GROWTH_CHUNK) *
        RASTER_SURFACE_GROWTH_CHUNK;

    const ensureSurfaceContainsBounds = bounds => {
        if (!surfaceCanvas || !surfaceContext || !bounds) return false;
        const current = getSurfaceBounds();
        const leftGrowth = alignGrowth(current.left - bounds.left +
            (bounds.left < current.left ? RASTER_SURFACE_GROWTH_PADDING : 0));
        const topGrowth = alignGrowth(current.top - bounds.top +
            (bounds.top < current.top ? RASTER_SURFACE_GROWTH_PADDING : 0));
        const rightGrowth = alignGrowth(bounds.right - current.right +
            (bounds.right > current.right ? RASTER_SURFACE_GROWTH_PADDING : 0));
        const bottomGrowth = alignGrowth(bounds.bottom - current.bottom +
            (bounds.bottom > current.bottom ? RASTER_SURFACE_GROWTH_PADDING : 0));
        if (!leftGrowth && !topGrowth && !rightGrowth && !bottomGrowth) return false;

        const replacement = DOM.createElement('canvas');
        replacement.setAttribute('data-ngvge-raster-surface-role', 'offscreen-storage');
        replacement.width = surfaceCanvas.width + leftGrowth + rightGrowth;
        replacement.height = surfaceCanvas.height + topGrowth + bottomGrowth;
        const replacementContext = replacement.getContext('2d', {willReadFrequently: true});
        if (!replacementContext) {
            throw makeBackendError(
                'NGVGE_PAINT_RASTER_CONTEXT_REQUIRED',
                'Canvas Raster requires Canvas 2D while expanding the unbounded world surface.'
            );
        }
        replacementContext.imageSmoothingEnabled = false;
        replacementContext.globalCompositeOperation = 'source-over';
        replacementContext.clearRect(0, 0, replacement.width, replacement.height);
        replacementContext.drawImage(surfaceCanvas, leftGrowth, topGrowth);
        surfaceCanvas = replacement;
        surfaceContext = replacementContext;
        surfaceOrigin = {x: current.left - leftGrowth, y: current.top - topGrowth};
        invalidateArtworkBounds();
        return true;
    };

    const invalidateArtworkBounds = () => {
        artworkBoundsDirty = true;
        artworkBoundsCache = null;
    };

    const getArtworkBounds = () => {
        if (!surfaceContext || !surfaceCanvas || surfaceCanvas.width < 1 || surfaceCanvas.height < 1) return null;
        if (!artworkBoundsDirty) return artworkBoundsCache ? {...artworkBoundsCache} : null;
        const image = surfaceContext.getImageData(0, 0, surfaceCanvas.width, surfaceCanvas.height);
        let minX = surfaceCanvas.width;
        let minY = surfaceCanvas.height;
        let maxX = -1;
        let maxY = -1;
        for (let y = 0; y < surfaceCanvas.height; y++) {
            const rowOffset = y * surfaceCanvas.width * 4;
            for (let x = 0; x < surfaceCanvas.width; x++) {
                if (image.data[rowOffset + (x * 4) + 3] === 0) continue;
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
        artworkBoundsDirty = false;
        if (maxX < minX || maxY < minY) {
            artworkBoundsCache = null;
            return null;
        }
        const surface = getSurfaceBounds();
        artworkBoundsCache = {
            left: surface.left + minX,
            top: surface.top + minY,
            right: surface.left + maxX + 1,
            bottom: surface.top + maxY + 1
        };
        return {...artworkBoundsCache};
    };

    const getFitBounds = () => unionBounds(getStageBounds(), getArtworkBounds());

    const syncViewportSizeFromDom = () => {
        const measuredElement = container && typeof container.getBoundingClientRect === 'function' ?
            container : viewport;
        if (!measuredElement || typeof measuredElement.getBoundingClientRect !== 'function') return false;
        const rect = measuredElement.getBoundingClientRect();
        const width = Math.round(Number(rect.width) || Number(measuredElement.clientWidth) || 0);
        const height = Math.round(Number(rect.height) || Number(measuredElement.clientHeight) || 0);
        if (width <= 0 || height <= 0) return false;
        const changed = viewportSize.width !== width || viewportSize.height !== height;
        viewportSize = {width, height};
        return changed;
    };

    const ensureDisplayCanvasSize = () => {
        if (!displayCanvas) return;
        const width = Math.max(1, Math.round(viewportSize.width));
        const height = Math.max(1, Math.round(viewportSize.height));
        if (displayCanvas.width !== width) displayCanvas.width = width;
        if (displayCanvas.height !== height) displayCanvas.height = height;
    };

    const calculateFitView = () => {
        const bounds = getFitBounds();
        if (!bounds) return {zoom: 1, pan: {x: 0, y: 0}, center: {x: 0, y: 0}};
        const width = Math.max(1, bounds.right - bounds.left);
        const height = Math.max(1, bounds.bottom - bounds.top);
        const availableWidth = Math.max(1, viewportSize.width * RASTER_FIT_PADDING);
        const availableHeight = Math.max(1, viewportSize.height * RASTER_FIT_PADDING);
        const zoom = Math.max(0.01, Math.min(availableWidth / width, availableHeight / height));
        const center = getBoundsCenter(bounds);
        return {
            zoom,
            center,
            pan: {x: -center.x * zoom, y: -center.y * zoom}
        };
    };

    const refreshFitCamera = () => {
        const fitView = calculateFitView();
        fitCamera = {zoom: fitView.zoom, pan: {...fitView.pan}};
        fitCameraDirty = false;
        return fitCamera;
    };

    const getAppliedCamera = () => {
        if (zoomMode === 'fit') {
            if (fitCameraDirty) refreshFitCamera();
            return {
                zoom: fitCamera.zoom,
                pan: {x: fitCamera.pan.x + pan.x, y: fitCamera.pan.y + pan.y}
            };
        }
        return {zoom: manualZoom, pan: {...pan}};
    };

    const renderStageGuide = camera => {
        if (!displayContext) return;
        const stage = getStageBounds();
        const width = stage.right - stage.left;
        const height = stage.bottom - stage.top;
        displayContext.save();
        displayContext.translate((viewportSize.width / 2) + camera.pan.x, (viewportSize.height / 2) + camera.pan.y);
        displayContext.scale(camera.zoom, camera.zoom);
        displayContext.lineWidth = 2 / camera.zoom;
        displayContext.strokeStyle = 'rgba(66,128,215,.25)';
        displayContext.strokeRect(stage.left, stage.top, width, height);
        displayContext.lineWidth = 1 / camera.zoom;
        displayContext.strokeStyle = 'rgba(255,255,255,.82)';
        displayContext.strokeRect(stage.left, stage.top, width, height);
        displayContext.restore();
    };

    const renderPresentation = () => {
        if (!displayContext || !displayCanvas) return;
        syncViewportSizeFromDom();
        ensureDisplayCanvasSize();
        const camera = getAppliedCamera();
        effectiveZoom = camera.zoom;
        presentationPan = camera.pan;
        displayContext.save();
        displayContext.setTransform(1, 0, 0, 1, 0, 0);
        displayContext.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
        displayContext.restore();
        if (ready && surfaceCanvas) {
            displayContext.save();
            displayContext.imageSmoothingEnabled = false;
            displayContext.translate((viewportSize.width / 2) + camera.pan.x, (viewportSize.height / 2) + camera.pan.y);
            displayContext.scale(camera.zoom, camera.zoom);
            displayContext.drawImage(
                surfaceCanvas,
                -workspaceContext.rotationCenterX,
                -workspaceContext.rotationCenterY
            );
            displayContext.restore();
        }
        renderStageGuide(camera);
    };

    const updatePresentation = () => {
        renderPresentation();
    };

    const getZoomState = () => Object.freeze({
        mode: zoomMode,
        zoom: effectiveZoom,
        zoomPercent: Math.round(effectiveZoom * 10000) / 100,
        pan: Object.freeze({x: presentationPan.x, y: presentationPan.y})
    });

    const captureSnapshot = () => {
        if (!surfaceContext || !surfaceCanvas || surfaceCanvas.width < 1 || surfaceCanvas.height < 1) return null;
        const image = surfaceContext.getImageData(0, 0, surfaceCanvas.width, surfaceCanvas.height);
        return {
            width: image.width,
            height: image.height,
            origin: {...surfaceOrigin},
            data: new Uint8ClampedArray(image.data)
        };
    };

    const restoreSnapshot = snapshot => {
        if (!snapshot || !surfaceContext || !surfaceCanvas) return false;
        if (surfaceCanvas.width !== snapshot.width || surfaceCanvas.height !== snapshot.height) {
            surfaceCanvas.width = snapshot.width;
            surfaceCanvas.height = snapshot.height;
            surfaceContext = surfaceCanvas.getContext('2d', {willReadFrequently: true});
        }
        let image;
        if (typeof surfaceContext.createImageData === 'function') {
            image = surfaceContext.createImageData(snapshot.width, snapshot.height);
            image.data.set(snapshot.data);
        } else if (typeof ImageData === 'function') {
            image = new ImageData(new Uint8ClampedArray(snapshot.data), snapshot.width, snapshot.height);
        } else {
            throw makeBackendError(
                'NGVGE_PAINT_RASTER_IMAGE_DATA_UNAVAILABLE',
                'Canvas Raster history requires ImageData support.'
            );
        }
        surfaceContext.putImageData(image, 0, 0);
        surfaceOrigin = snapshot.origin ? {...snapshot.origin} : {...surfaceOrigin};
        invalidateArtworkBounds();
        updatePresentation();
        return true;
    };

    const resetHistory = () => {
        const initial = captureSnapshot();
        history = initial ? [initial] : [];
        historyIndex = history.length ? 0 : -1;
    };

    const pushHistory = () => {
        const snapshot = captureSnapshot();
        if (!snapshot) return;
        history = history.slice(0, historyIndex + 1);
        history.push(snapshot);
        historyIndex = history.length - 1;
        if (history.length > 50) {
            history.shift();
            historyIndex -= 1;
        }
    };

    const getHistoryState = () => Object.freeze({
        canUndo: historyIndex > 0,
        canRedo: historyIndex >= 0 && historyIndex < history.length - 1
    });

    const clientToDocument = event => {
        if (!viewport) return null;
        syncViewportSizeFromDom();
        const rect = viewport.getBoundingClientRect();
        const camera = getAppliedCamera();
        effectiveZoom = camera.zoom;
        presentationPan = camera.pan;
        const screenX = Number(event.clientX) - Number(rect.left || 0);
        const screenY = Number(event.clientY) - Number(rect.top || 0);
        const docX = (screenX - (viewportSize.width / 2) - camera.pan.x) / camera.zoom;
        const docY = (screenY - (viewportSize.height / 2) - camera.pan.y) / camera.zoom;
        if (!Number.isFinite(docX) || !Number.isFinite(docY)) return null;
        return {x: docX, y: docY};
    };

    const documentToPixel = point => {
        if (!point || !surfaceCanvas) return null;
        const x = Math.floor(point.x - surfaceOrigin.x);
        const y = Math.floor(point.y - surfaceOrigin.y);
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 ||
            x >= surfaceCanvas.width || y >= surfaceCanvas.height) {
            return null;
        }
        return {x, y};
    };


    const documentToPixelUnchecked = point => {
        if (!point || !surfaceCanvas) return null;
        const x = Math.floor(point.x - surfaceOrigin.x);
        const y = Math.floor(point.y - surfaceOrigin.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return {x, y};
    };

    const getStrokeBounds = (from, to = from) => {
        const radius = Math.max(1, brushSize / 2) + 2;
        return {
            left: Math.min(from.x, to.x) - radius,
            top: Math.min(from.y, to.y) - radius,
            right: Math.max(from.x, to.x) + radius,
            bottom: Math.max(from.y, to.y) + radius
        };
    };

    const configureStroke = erasing => {
        surfaceContext.lineWidth = brushSize;
        surfaceContext.lineCap = 'round';
        surfaceContext.lineJoin = 'round';
        surfaceContext.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
        surfaceContext.strokeStyle = erasing ? 'rgba(0,0,0,1)' : rgbaCss(color);
        surfaceContext.fillStyle = erasing ? 'rgba(0,0,0,1)' : rgbaCss(color);
    };

    const drawDot = (point, erasing) => {
        configureStroke(erasing);
        surfaceContext.beginPath();
        surfaceContext.arc(point.x + 0.5, point.y + 0.5, Math.max(0.5, brushSize / 2), 0, Math.PI * 2);
        surfaceContext.fill();
        invalidateArtworkBounds();
        renderPresentation();
    };

    const drawSegment = (from, to, erasing) => {
        configureStroke(erasing);
        surfaceContext.beginPath();
        surfaceContext.moveTo(from.x + 0.5, from.y + 0.5);
        surfaceContext.lineTo(to.x + 0.5, to.y + 0.5);
        surfaceContext.stroke();
        invalidateArtworkBounds();
        renderPresentation();
    };

    const commitMutation = type => {
        invalidateArtworkBounds();
        pushHistory();
        renderPresentation();
        emit(type || 'content:changed');
    };

    const onPointerDown = event => {
        if (!ready || !surfaceContext) return;
        if (activeTool === 'hand' || activeTool === 'zoom') return;
        const documentPoint = clientToDocument(event);
        if (!documentPoint) return;
        if (activeTool === 'brush') ensureSurfaceContainsBounds(getStrokeBounds(documentPoint));
        const point = activeTool === 'brush' || activeTool === 'eraser' ?
            documentToPixelUnchecked(documentPoint) : documentToPixel(documentPoint);
        if (!point) return;
        if (typeof displayCanvas.setPointerCapture === 'function' && typeof event.pointerId !== 'undefined') {
            try {
                displayCanvas.setPointerCapture(event.pointerId);
            } catch { /* ignored */ }
        }
        if (activeTool === 'brush' || activeTool === 'eraser') {
            drawing = true;
            strokeChanged = true;
            lastDocumentPoint = documentPoint;
            drawDot(point, activeTool === 'eraser');
            event.preventDefault();
            return;
        }
        if (activeTool === 'fill') {
            const image = surfaceContext.getImageData(0, 0, surfaceCanvas.width, surfaceCanvas.height);
            if (floodFillRaster(image, {x: point.x, y: point.y, color, tolerance: 0, contiguous: true})) {
                surfaceContext.putImageData(image, 0, 0);
                commitMutation('content:changed');
            }
            event.preventDefault();
            return;
        }
        if (activeTool === 'eyedropper') {
            const image = surfaceContext.getImageData(0, 0, surfaceCanvas.width, surfaceCanvas.height);
            const sampled = sampleRasterPixel(image, point.x, point.y);
            if (sampled) {
                color = sampled;
                emit('color:changed');
            }
            event.preventDefault();
        }
    };

    const onPointerMove = event => {
        if (!drawing || !ready || (activeTool !== 'brush' && activeTool !== 'eraser')) return;
        const documentPoint = clientToDocument(event);
        if (!documentPoint || !lastDocumentPoint) return;
        if (activeTool === 'brush') ensureSurfaceContainsBounds(getStrokeBounds(lastDocumentPoint, documentPoint));
        const point = documentToPixelUnchecked(documentPoint);
        const lastPoint = documentToPixelUnchecked(lastDocumentPoint);
        if (!point || !lastPoint) return;
        drawSegment(lastPoint, point, activeTool === 'eraser');
        lastDocumentPoint = documentPoint;
        strokeChanged = true;
        event.preventDefault();
    };

    const endStroke = event => {
        if (!drawing) return;
        drawing = false;
        lastDocumentPoint = null;
        if (strokeChanged) {
            strokeChanged = false;
            commitMutation('content:changed');
        }
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
    };

    const createDom = mountContainer => {
        container = mountContainer;
        viewport = DOM.createElement('div');
        viewport.setAttribute('data-ngvge-raster-viewport', 'true');
        viewport.setAttribute('data-ngvge-raster-camera-authority', 'compositor');
        viewport.tabIndex = 0;
        Object.assign(viewport.style, {
            position: 'relative',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            outline: 'none',
            backgroundColor: '#1b1d20',
            backgroundImage: [
                'linear-gradient(45deg, rgba(255,255,255,.025) 25%, transparent 25%)',
                'linear-gradient(-45deg, rgba(255,255,255,.025) 25%, transparent 25%)',
                'linear-gradient(45deg, transparent 75%, rgba(255,255,255,.025) 75%)',
                'linear-gradient(-45deg, transparent 75%, rgba(255,255,255,.025) 75%)'
            ].join(', '),
            backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
            backgroundSize: '16px 16px'
        });
        displayCanvas = DOM.createElement('canvas');
        displayCanvas.setAttribute('data-ngvge-raster-canvas', 'true');
        displayCanvas.setAttribute('data-ngvge-raster-canvas-role', 'viewport-compositor');
        Object.assign(displayCanvas.style, {
            position: 'absolute',
            inset: '0',
            display: 'block',
            width: '100%',
            height: '100%',
            imageRendering: 'auto',
            touchAction: 'none'
        });
        surfaceCanvas = DOM.createElement('canvas');
        surfaceCanvas.setAttribute('data-ngvge-raster-surface-role', 'offscreen-storage');
        viewport.appendChild(displayCanvas);
        container.appendChild(viewport);
        displayContext = displayCanvas.getContext('2d', {willReadFrequently: false});
        surfaceContext = surfaceCanvas.getContext('2d', {willReadFrequently: true});
        if (!displayContext || !surfaceContext) {
            throw makeBackendError('NGVGE_PAINT_RASTER_CONTEXT_REQUIRED', 'Canvas Raster requires Canvas 2D.');
        }
        displayCanvas.addEventListener('pointerdown', onPointerDown);
        displayCanvas.addEventListener('pointermove', onPointerMove);
        displayCanvas.addEventListener('pointerup', endStroke);
        displayCanvas.addEventListener('pointercancel', endStroke);
        displayCanvas.addEventListener('pointerleave', event => {
            if (drawing && !(event.buttons & 1)) endStroke(event);
        });
    };

    const implementation = {
        mount (mountContainer, options = {}) {
            assertActive();
            if (!mountContainer || typeof mountContainer.appendChild !== 'function') {
                throw makeBackendError(
                    'NGVGE_PAINT_RASTER_CONTAINER_INVALID',
                    'Canvas Raster requires a DOM mount container.',
                    TypeError
                );
            }
            if (viewport) {
                throw makeBackendError('NGVGE_PAINT_RASTER_ALREADY_MOUNTED', 'Canvas Raster is already mounted.');
            }
            createDom(mountContainer);
            const width = Number(
                options.width || options.viewportWidth || mountContainer.clientWidth || DEFAULT_VIEWPORT_SIZE.width
            );
            const height = Number(
                options.height || options.viewportHeight || mountContainer.clientHeight || DEFAULT_VIEWPORT_SIZE.height
            );
            viewportSize = {
                width: Number.isFinite(width) && width > 0 ? width : DEFAULT_VIEWPORT_SIZE.width,
                height: Number.isFinite(height) && height > 0 ? height : DEFAULT_VIEWPORT_SIZE.height
            };
            updatePresentation();
            return {adapterId: CANVAS_RASTER_BACKEND_ADAPTER_ID};
        },

        load (transfer) {
            assertMounted();
            const normalized = normalizePaintBackendTransfer(transfer);
            if (normalized.document.mode !== 'bitmap') {
                throw makeBackendError(
                    'NGVGE_PAINT_RASTER_MODE_INVALID',
                    'Canvas Raster G1 backend only accepts Bitmap mode.'
                );
            }
            const entry = getSourceEntry(normalized);
            if (!ImageClass) {
                throw makeBackendError(
                    'NGVGE_PAINT_RASTER_IMAGE_DECODER_REQUIRED',
                    'Canvas Raster requires browser Image decoding.'
                );
            }
            loadedTransfer = normalized;
            activeTarget = normalized.activeTarget;
            ready = false;
            history = [];
            historyIndex = -1;
            const token = ++loadToken;
            const image = new ImageClass();
            image.onload = () => {
                if (disposed || token !== loadToken) return;
                surfaceCanvas.width = normalized.document.canvas.width;
                surfaceCanvas.height = normalized.document.canvas.height;
                surfaceContext = surfaceCanvas.getContext('2d', {willReadFrequently: true});
                surfaceContext.globalCompositeOperation = 'source-over';
                surfaceContext.clearRect(0, 0, surfaceCanvas.width, surfaceCanvas.height);
                surfaceContext.drawImage(image, 0, 0, surfaceCanvas.width, surfaceCanvas.height);
                surfaceOrigin = {
                    x: -workspaceContext.rotationCenterX,
                    y: -workspaceContext.rotationCenterY
                };
                ready = true;
                invalidateArtworkBounds();
                fitCameraDirty = true;
                resetHistory();
                zoomMode = 'fit';
                pan = {x: 0, y: 0};
                updatePresentation();
                emit('content:loaded');
            };
            image.onerror = () => {
                if (disposed || token !== loadToken) return;
                ready = false;
                emit('content:load-error');
            };
            image.src = entry.content.dataUri;
            return {loading: true};
        },

        setActiveTarget (target) {
            assertMounted();
            activeTarget = target;
            return target;
        },

        exportTransfer () {
            assertMounted();
            if (!ready || !loadedTransfer) {
                throw makeBackendError(
                    'NGVGE_PAINT_RASTER_NOT_READY',
                    'Canvas Raster has not finished loading its bitmap.'
                );
            }
            const exported = clonePortable(loadedTransfer);
            const contentId = activeTarget && activeTarget.contentId;
            const entry = exported.contentEntries.find(item => item.semanticId === contentId) ||
                exported.contentEntries[0];
            entry.dataFormat = 'png';
            entry.content = {kind: 'data-uri', dataUri: surfaceCanvas.toDataURL('image/png')};
            if (exported.document && exported.document.canvas) {
                exported.document.canvas.width = surfaceCanvas.width;
                exported.document.canvas.height = surfaceCanvas.height;
            }
            exported.activeTarget = clonePortable(activeTarget || loadedTransfer.activeTarget);
            return exported;
        },

        resize (size = {}) {
            assertMounted();
            const width = Number(size.width);
            const height = Number(size.height);
            if (Number.isFinite(width) && width > 0) viewportSize.width = Math.round(width);
            if (Number.isFinite(height) && height > 0) viewportSize.height = Math.round(height);
            if (zoomMode === 'fit') fitCameraDirty = true;
            updatePresentation();
            return getZoomState();
        },

        focus () {
            assertMounted();
            if (typeof viewport.focus === 'function') viewport.focus();
            return true;
        },

        undo () {
            assertMounted();
            if (historyIndex <= 0) return false;
            historyIndex -= 1;
            restoreSnapshot(history[historyIndex]);
            emit('history:undo');
            return true;
        },

        redo () {
            assertMounted();
            if (historyIndex < 0 || historyIndex >= history.length - 1) return false;
            historyIndex += 1;
            restoreSnapshot(history[historyIndex]);
            emit('history:redo');
            return true;
        },

        getHistoryState () {
            assertActive();
            return getHistoryState();
        },

        subscribe (listener) {
            assertActive();
            if (typeof listener !== 'function') throw new TypeError('Canvas Raster listener must be a function.');
            listeners.add(listener);
            return () => listeners.delete(listener);
        },

        dispose () {
            if (disposed) return false;
            disposed = true;
            loadToken += 1;
            listeners.clear();
            if (displayCanvas) {
                displayCanvas.removeEventListener('pointerdown', onPointerDown);
                displayCanvas.removeEventListener('pointermove', onPointerMove);
                displayCanvas.removeEventListener('pointerup', endStroke);
                displayCanvas.removeEventListener('pointercancel', endStroke);
            }
            if (viewport && viewport.parentNode) viewport.parentNode.removeChild(viewport);
            container = null;
            viewport = null;
            displayCanvas = null;
            displayContext = null;
            surfaceCanvas = null;
            surfaceContext = null;
            loadedTransfer = null;
            activeTarget = null;
            history = [];
            return true;
        }
    };

    const controls = Object.freeze({
        id: 'ngvge.bitmap-raster-backend-controls@1',
        setTool (tool) {
            assertMounted();
            if (!BITMAP_RASTER_TOOLS.includes(tool)) {
                throw makeBackendError(
                    'NGVGE_PAINT_RASTER_TOOL_UNSUPPORTED',
                    `Unsupported Bitmap tool: ${String(tool)}`,
                    TypeError
                );
            }
            activeTool = tool;
            if (viewport) {
                viewport.setAttribute('data-ngvge-raster-tool', tool);
                viewport.style.cursor = tool === 'hand' ? 'grab' :
                    (tool === 'zoom' ? 'zoom-in' : 'crosshair');
            }
            emit('tool:changed');
            return activeTool;
        },
        getTool () {
            return activeTool;
        },
        setColor (nextColor) {
            color = normalizeRgba(nextColor);
            emit('color:changed');
            return color;
        },
        getColor () {
            return color;
        },
        setBrushSize (size) {
            const next = Number(size);
            if (!Number.isFinite(next) || next <= 0 || next > 512) {
                throw new TypeError('Raster brush size must be within (0, 512].');
            }
            brushSize = next;
            emit('brush:changed');
            return brushSize;
        },
        getBrushSize () {
            return brushSize;
        },
        setWorkspaceContext (next = {}) {
            const stageWidth = Number(next.stageWidth);
            const stageHeight = Number(next.stageHeight);
            const rotationCenterX = Number(next.rotationCenterX);
            const rotationCenterY = Number(next.rotationCenterY);
            const bitmapResolution = Number(next.bitmapResolution);
            if (!Number.isFinite(stageWidth) || stageWidth <= 0 || !Number.isFinite(stageHeight) || stageHeight <= 0 ||
                !Number.isFinite(rotationCenterX) || !Number.isFinite(rotationCenterY) ||
                !Number.isFinite(bitmapResolution) || bitmapResolution <= 0) {
                throw new TypeError(
                    'Raster workspace context requires stage size, rotation center, and bitmap resolution.'
                );
            }
            workspaceContext = {stageWidth, stageHeight, rotationCenterX, rotationCenterY, bitmapResolution};
            invalidateArtworkBounds();
            fitCameraDirty = true;
            updatePresentation();
            return controls.getWorkspaceState();
        },
        getWorkspaceState () {
            return Object.freeze({
                stage: Object.freeze({...workspaceContext}),
                viewport: Object.freeze({...viewportSize}),
                zoom: getZoomState(),
                surface: Object.freeze({
                    width: surfaceCanvas ? surfaceCanvas.width : 0,
                    height: surfaceCanvas ? surfaceCanvas.height : 0,
                    bounds: getSurfaceBounds(),
                    artworkBounds: getArtworkBounds(),
                    origin: Object.freeze({...surfaceOrigin}),
                    rotationCenter: Object.freeze(getSurfaceRotationCenter())
                })
            });
        },
        setZoom (value) {
            const next = Number(value);
            if (!Number.isFinite(next) || next <= 0 || next > 64) {
                throw new TypeError('Raster zoom must be a positive finite scale <= 64.');
            }
            const previousCamera = getAppliedCamera();
            const centerDocument = {
                x: -previousCamera.pan.x / previousCamera.zoom,
                y: -previousCamera.pan.y / previousCamera.zoom
            };
            zoomMode = 'manual';
            manualZoom = next;
            pan = {x: -centerDocument.x * next, y: -centerDocument.y * next};
            updatePresentation();
            emit('view:changed');
            return getZoomState();
        },
        fitToView () {
            zoomMode = 'fit';
            fitCameraDirty = true;
            pan = {x: 0, y: 0};
            updatePresentation();
            emit('view:changed');
            return getZoomState();
        },
        panBy (dx, dy) {
            const x = Number(dx);
            const y = Number(dy);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return getZoomState();
            if (zoomMode === 'fit') {
                const currentFitCamera = getAppliedCamera();
                zoomMode = 'manual';
                manualZoom = currentFitCamera.zoom;
                pan = {...currentFitCamera.pan};
            }
            pan = {x: pan.x + x, y: pan.y + y};
            updatePresentation();
            emit('view:changed');
            return getZoomState();
        },
        resetPan () {
            pan = {x: 0, y: 0};
            updatePresentation();
            emit('view:changed');
            return getZoomState();
        },
        getZoomState,
        getState () {
            return Object.freeze({
                ready,
                activeTool,
                history: getHistoryState(),
                zoom: getZoomState(),
                color,
                brushSize
            });
        },
        getCanvas () {
            return displayCanvas;
        },
        getSurfaceCanvas () {
            return surfaceCanvas;
        }
    });

    return Object.freeze({
        adapterId: CANVAS_RASTER_BACKEND_ADAPTER_ID,
        package: CANVAS_RASTER_BACKEND_PACKAGE,
        descriptor: BITMAP_RASTER_BACKEND_DESCRIPTOR,
        implementation,
        controls
    });
};

export {
    CANVAS_RASTER_BACKEND_ADAPTER_ID,
    CANVAS_RASTER_BACKEND_PACKAGE,
    BITMAP_RASTER_BACKEND_DESCRIPTOR,
    BITMAP_RASTER_TOOLS,
    RASTER_ZOOM_PRESETS,
    createCanvasRasterBackendAdapter
};
