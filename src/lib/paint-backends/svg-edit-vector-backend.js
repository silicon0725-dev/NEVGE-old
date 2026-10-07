import {normalizePaintBackendTransfer} from './paint-backend-contract';
import {SVG_EDIT_BACKEND_ID, getPaintBackendCandidate} from './paint-backend-candidates';
import {normalizeSvgToArtworkBounds} from './svg-edit-vector-transfer';

const SVG_EDIT_VECTOR_BACKEND_ADAPTER_ID = 'ngvge.paint-backend-adapter.svg-edit@1';
const SVG_EDIT_VECTOR_BACKEND_PACKAGE = '@svgedit/svgcanvas@7.4.2';
const VECTOR_PAINT_BACKEND_CONTROLS_ID = 'ngvge.vector-paint-backend-controls@1';
const VECTOR_PAINT_TOOLS = Object.freeze([
    'select',
    'direct-select',
    'freehand',
    'line',
    'rect',
    'ellipse',
    'path',
    'text',
    'hand',
    'zoom'
]);
const VECTOR_PAINT_COMMANDS = Object.freeze([
    'delete',
    'cut',
    'copy',
    'paste',
    'duplicate',
    'group',
    'ungroup',
    'bring-forward',
    'send-backward',
    'bring-front',
    'send-back',
    'move-selection',
    'clear-selection',
    'path-add-anchor',
    'path-duplicate-anchor',
    'path-delete-anchor',
    'path-convert-anchor',
    'path-toggle-segment',
    'path-segment-line',
    'path-segment-curve',
    'path-open-close',
    'path-link-controls'
]);
const VECTOR_FIT_PADDING = 0.92;
const VECTOR_ZOOM_PRESETS = Object.freeze([0.25, 0.5, 1, 2]);
const VECTOR_ZOOM_MODES = Object.freeze({FIT: 'fit', MANUAL: 'manual'});
const VECTOR_STAGE_GUIDE_ID = 'ngvge-vector-stage-guide';
const VECTOR_STAGE_GUIDE_INNER_STROKE = '#FFFFFF';
const VECTOR_STAGE_GUIDE_OUTER_STROKE = '#4280D7';

const makeBackendError = (code, message, ErrorClass = Error) => {
    const error = new ErrorClass(message);
    error.code = code;
    return error;
};

const requireSvgCanvasClass = SvgCanvasClass => {
    if (typeof SvgCanvasClass !== 'function') {
        throw makeBackendError(
            'NGVGE_PAINT_SVG_EDIT_CLASS_REQUIRED',
            'SVG-Edit vector backend requires the @svgedit/svgcanvas default SvgCanvas class.',
            TypeError
        );
    }
    return SvgCanvasClass;
};

const assertContainer = container => {
    if (!container || typeof container.appendChild !== 'function') {
        throw makeBackendError(
            'NGVGE_PAINT_SVG_EDIT_CONTAINER_INVALID',
            'SVG-Edit vector backend requires a DOM-like mount container.',
            TypeError
        );
    }
    return container;
};

const clonePortable = value => JSON.parse(JSON.stringify(value));

const getSvgSourceEntry = transfer => {
    const entry = transfer.contentEntries.find(item => item.role === 'document-source');
    if (!entry || entry.dataFormat !== 'svg' || !entry.content || entry.content.kind !== 'svg-text') {
        throw makeBackendError(
            'NGVGE_PAINT_SVG_EDIT_SOURCE_INVALID',
            'SVG-Edit vector backend requires one canonical SVG document-source entry.'
        );
    }
    return entry;
};

const createSvgEditVectorBackendAdapter = ({SvgCanvasClass}) => {
    const Canvas = requireSvgCanvasClass(SvgCanvasClass);
    let container = null;
    let canvas = null;
    let loadedTransfer = null;
    let disposed = false;
    let dirty = false;
    let contentRevision = 0;
    let mutationRevision = 0;
    let requestedTool = 'select';
    const listeners = new Set();

    const assertActive = () => {
        if (disposed) {
            throw makeBackendError('NGVGE_PAINT_SVG_EDIT_DISPOSED', 'SVG-Edit vector backend has been disposed.');
        }
    };

    const assertMounted = () => {
        assertActive();
        if (!canvas) {
            throw makeBackendError('NGVGE_PAINT_SVG_EDIT_NOT_MOUNTED', 'Mount SVG-Edit before loading a vector document.');
        }
    };

    const emit = type => {
        contentRevision += 1;
        const event = Object.freeze({
            type,
            backendId: SVG_EDIT_BACKEND_ID,
            revision: contentRevision,
            dirty
        });
        listeners.forEach(listener => {
            try {
                listener(event);
            } catch {
                // Observers never gain backend or Resource authority.
            }
        });
    };

    const onChanged = () => {
        if (!loadedTransfer) return;
        mutationRevision += 1;
        dirty = true;
        emit('content:changed');
    };

    const getSelectedElements = () => (
        canvas && typeof canvas.getSelectedElements === 'function' ? canvas.getSelectedElements().filter(Boolean) : []
    );

    const getSelectionState = () => {
        assertMounted();
        const selected = getSelectedElements();
        const tags = selected.map(element => String(element && (element.tagName || element.nodeName) || '').toLowerCase());
        const directEditing = typeof canvas.getMode === 'function' && canvas.getMode() === 'pathedit';
        return Object.freeze({
            count: selected.length,
            tags,
            canGroup: selected.length > 1,
            canUngroup: selected.length === 1 && (tags[0] === 'g' || tags[0] === 'a'),
            canDirectSelect: selected.length === 1 && tags[0] === 'path',
            directEditing
        });
    };

    const enterDirectSelectionIfPossible = () => {
        if (!canvas || !canvas.pathActions || typeof canvas.pathActions.toEditMode !== 'function') return false;
        const selected = getSelectedElements();
        if (selected.length !== 1 || String(selected[0].tagName || selected[0].nodeName || '').toLowerCase() !== 'path') {
            return false;
        }
        canvas.pathActions.toEditMode(selected[0]);
        return true;
    };

    const leaveDirectSelection = () => {
        if (canvas && typeof canvas.getMode === 'function' && canvas.getMode() === 'pathedit' &&
            canvas.pathActions && typeof canvas.pathActions.clear === 'function') {
            canvas.pathActions.clear();
        }
    };

    const onSelected = () => {
        if (!loadedTransfer) return;
        if (requestedTool === 'direct-select') enterDirectSelectionIfPossible();
        emit('selection:changed');
    };

    let fallbackViewport = {width: 640, height: 480};
    let lastViewport = null;
    let zoomMode = VECTOR_ZOOM_MODES.FIT;
    let manualZoom = 1;
    let presentationPan = {x: 0, y: 0};
    let workspaceContext = null;
    let lastExportMetadata = null;
    // Native Vector follows Scratch Paint's editor-origin model: the costume registration
    // point is rebased to a stable editor origin and the stage is only a guide around it.
    // This stays adapter-local; Resource/ArtDocument coordinates are restored on export.
    let editorOrigin = {x: 0, y: 0};
    let contentOverflowSnapshot = null;

    const normalizeWorkspaceContext = context => {
        if (!context) return null;
        const stageWidth = Number(context.stageWidth);
        const stageHeight = Number(context.stageHeight);
        const rotationCenterX = Number(context.rotationCenterX);
        const rotationCenterY = Number(context.rotationCenterY);
        if (!Number.isFinite(stageWidth) || stageWidth <= 0 ||
            !Number.isFinite(stageHeight) || stageHeight <= 0 ||
            !Number.isFinite(rotationCenterX) || !Number.isFinite(rotationCenterY)) {
            throw makeBackendError(
                'NGVGE_PAINT_VECTOR_WORKSPACE_CONTEXT_INVALID',
                'Vector workspace context requires positive stageWidth/stageHeight and finite rotationCenterX/rotationCenterY.',
                TypeError
            );
        }
        return Object.freeze({stageWidth, stageHeight, rotationCenterX, rotationCenterY});
    };

    const normalizeBounds = bounds => {
        if (!bounds) return null;
        const x = Number(bounds.x);
        const y = Number(bounds.y);
        const width = Number(bounds.width);
        const height = Number(bounds.height);
        if (!Number.isFinite(x) || !Number.isFinite(y) ||
            !Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return null;
        return {x, y, width, height};
    };

    const unionBounds = (left, right) => {
        if (!left) return right ? {...right} : null;
        if (!right) return {...left};
        const x = Math.min(left.x, right.x);
        const y = Math.min(left.y, right.y);
        const maxX = Math.max(left.x + left.width, right.x + right.width);
        const maxY = Math.max(left.y + left.height, right.y + right.height);
        return {x, y, width: maxX - x, height: maxY - y};
    };

    const getSvgContent = () => (
        canvas && typeof canvas.getSvgContent === 'function' ? canvas.getSvgContent() : null
    );

    const getStageGuide = () => {
        const content = getSvgContent();
        return content && typeof content.querySelector === 'function' ?
            content.querySelector(`#${VECTOR_STAGE_GUIDE_ID}`) : null;
    };

    const getAuthoredRootItems = () => {
        const content = getSvgContent();
        if (!content || !content.children) return [];
        const result = [];
        Array.from(content.children).forEach(child => {
            if (!child || child === getStageGuide()) return;
            const name = String(child.localName || child.nodeName || '').toLowerCase();
            if (['defs', 'desc', 'metadata', 'style', 'title'].includes(name)) return;
            if (typeof canvas.isLayer === 'function' && canvas.isLayer(child) &&
                typeof canvas.getVisibleElements === 'function') {
                canvas.getVisibleElements(child).forEach(item => {
                    if (item && item !== getStageGuide()) result.push(item);
                });
                return;
            }
            if (typeof child.getBBox === 'function') result.push(child);
        });
        return result;
    };

    const getArtworkBounds = () => {
        if (!canvas || typeof canvas.getStrokedBBox !== 'function') return null;
        try {
            const items = getAuthoredRootItems();
            if (items.length) return normalizeBounds(canvas.getStrokedBBox(items));
            // Compatibility/fake hosts used by the conformance suite may not model the
            // full SVG-Edit layer DOM. Falling back here never changes production semantics.
            return normalizeBounds(canvas.getStrokedBBox());
        } catch {
            return null;
        }
    };

    const getStageBounds = () => workspaceContext ? ({
        x: editorOrigin.x - workspaceContext.stageWidth / 2,
        y: editorOrigin.y - workspaceContext.stageHeight / 2,
        width: workspaceContext.stageWidth,
        height: workspaceContext.stageHeight
    }) : null;

    const getPresentationBounds = (contentWidth, contentHeight) => {
        if (!workspaceContext) return {x: 0, y: 0, width: contentWidth, height: contentHeight};
        return unionBounds(getStageBounds(), getArtworkBounds()) || getStageBounds();
    };

    const captureContentOverflow = content => {
        if (!content || contentOverflowSnapshot) return;
        const style = content.style;
        contentOverflowSnapshot = {
            attribute: typeof content.getAttribute === 'function' ? content.getAttribute('overflow') : null,
            styleValue: style && typeof style.getPropertyValue === 'function' ?
                style.getPropertyValue('overflow') : (style && style.overflow) || '',
            stylePriority: style && typeof style.getPropertyPriority === 'function' ?
                style.getPropertyPriority('overflow') : ''
        };
    };

    const forceUnboundedContentOverflow = content => {
        if (!content) return;
        captureContentOverflow(content);
        if (typeof content.setAttribute === 'function') content.setAttribute('overflow', 'visible');
        if (content.style) {
            if (typeof content.style.setProperty === 'function') {
                // Source SVGs can carry style="overflow:hidden". A presentation attribute
                // alone loses to that inline declaration and clips art while selectors remain
                // visible outside svgcontent. Force the live nested SVG viewport open.
                content.style.setProperty('overflow', 'visible', 'important');
            } else {
                content.style.overflow = 'visible';
            }
        }
    };

    const restoreAuthoredOverflowForSerialization = content => {
        if (!content || !contentOverflowSnapshot) return;
        if (typeof content.setAttribute === 'function') {
            if (contentOverflowSnapshot.attribute === null && typeof content.removeAttribute === 'function') {
                content.removeAttribute('overflow');
            } else if (contentOverflowSnapshot.attribute !== null) {
                content.setAttribute('overflow', contentOverflowSnapshot.attribute);
            }
        }
        if (content.style) {
            if (typeof content.style.removeProperty === 'function') content.style.removeProperty('overflow');
            else content.style.overflow = '';
            if (contentOverflowSnapshot.styleValue) {
                if (typeof content.style.setProperty === 'function') {
                    content.style.setProperty(
                        'overflow',
                        contentOverflowSnapshot.styleValue,
                        contentOverflowSnapshot.stylePriority || ''
                    );
                } else {
                    content.style.overflow = contentOverflowSnapshot.styleValue;
                }
            }
        }
    };

    const rebaseArtworkToEditorOrigin = () => {
        if (!workspaceContext) {
            editorOrigin = {x: 0, y: 0};
            return false;
        }
        const items = getAuthoredRootItems();
        const dx = -workspaceContext.rotationCenterX;
        const dy = -workspaceContext.rotationCenterY;
        editorOrigin = {x: 0, y: 0};
        if (!items.length || (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9)) return false;
        if (typeof canvas.clearSelection !== 'function' ||
            typeof canvas.addToSelection !== 'function' ||
            typeof canvas.moveSelectedElements !== 'function') {
            throw makeBackendError(
                'NGVGE_PAINT_SVG_EDIT_API_INCOMPATIBLE',
                'SVG-Edit vector workspace rebasing requires clearSelection()/addToSelection()/moveSelectedElements().'
            );
        }
        canvas.clearSelection(true);
        canvas.addToSelection(items, false);
        canvas.moveSelectedElements(
            items.map(() => dx),
            items.map(() => dy),
            false
        );
        canvas.clearSelection(true);
        return true;
    };

    const getMeasuredViewport = requested => {
        const requestedWidth = requested && Number(requested.width);
        const requestedHeight = requested && Number(requested.height);
        if (Number.isFinite(requestedWidth) && requestedWidth > 0 &&
            Number.isFinite(requestedHeight) && requestedHeight > 0) {
            return {width: requestedWidth, height: requestedHeight};
        }

        let width = container && Number(container.clientWidth);
        let height = container && Number(container.clientHeight);
        if ((!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) &&
            container && typeof container.getBoundingClientRect === 'function') {
            const rect = container.getBoundingClientRect();
            width = Number(rect && rect.width);
            height = Number(rect && rect.height);
        }
        if (!Number.isFinite(width) || width <= 0) width = fallbackViewport.width;
        if (!Number.isFinite(height) || height <= 0) height = fallbackViewport.height;
        return {width, height};
    };

    const refreshSelectionGeometry = () => {
        if (!canvas || typeof canvas.getSelectedElements !== 'function') return;
        const selected = getSelectedElements();
        const manager = typeof canvas.gettingSelectorManager === 'function' ? canvas.gettingSelectorManager() : null;
        if (manager && typeof manager.requestSelector === 'function') {
            selected.forEach(element => {
                const selector = manager.requestSelector(element);
                if (selector && typeof selector.resize === 'function') selector.resize();
            });
        }
        if (canvas.pathActions && typeof canvas.pathActions.zoomChange === 'function') {
            canvas.pathActions.zoomChange();
        }
    };

    const ensureStageGuide = content => {
        if (!workspaceContext || !content || typeof content.querySelector !== 'function') return null;
        let group = content.querySelector(`#${VECTOR_STAGE_GUIDE_ID}`);
        if (group) return group;
        const ownerDocument = content.ownerDocument || (typeof document !== 'undefined' ? document : null);
        if (!ownerDocument || typeof ownerDocument.createElementNS !== 'function') return null;
        const createElement = (name, attributes) => {
            const element = ownerDocument.createElementNS('http://www.w3.org/2000/svg', name);
            Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
            return element;
        };
        group = createElement('g', {
            id: VECTOR_STAGE_GUIDE_ID,
            'aria-hidden': 'true',
            'pointer-events': 'none',
            'data-ngvge-presentation-only': 'stage-size-guide'
        });
        group.appendChild(createElement('rect', {
            'data-ngvge-stage-guide': 'outer',
            fill: 'none',
            stroke: VECTOR_STAGE_GUIDE_OUTER_STROKE,
            'stroke-opacity': '0.25',
            'stroke-width': '6',
            'vector-effect': 'non-scaling-stroke'
        }));
        group.appendChild(createElement('rect', {
            'data-ngvge-stage-guide': 'inner',
            fill: 'none',
            stroke: VECTOR_STAGE_GUIDE_INNER_STROKE,
            'stroke-opacity': '0.85',
            'stroke-width': '2',
            'vector-effect': 'non-scaling-stroke'
        }));
        const crosshair = createElement('g', {'data-ngvge-stage-guide': 'origin'});
        crosshair.appendChild(createElement('line', {
            'data-ngvge-stage-guide-origin': 'horizontal',
            stroke: '#FFFFFF',
            'stroke-opacity': '0.75',
            'stroke-width': '2',
            'vector-effect': 'non-scaling-stroke'
        }));
        crosshair.appendChild(createElement('line', {
            'data-ngvge-stage-guide-origin': 'vertical',
            stroke: '#FFFFFF',
            'stroke-opacity': '0.75',
            'stroke-width': '2',
            'vector-effect': 'non-scaling-stroke'
        }));
        group.appendChild(crosshair);
        // Scratch Paint keeps guides in the same project/view transform as artwork and
        // removes them only for export. Do the same here: never maintain a second manual
        // zoom/translation for the guide. svgcontent is the shared document->viewport CTM.
        if (typeof content.appendChild === 'function') content.appendChild(group);
        return group;
    };

    const updateStageGuide = content => {
        if (!workspaceContext) {
            const existing = content && typeof content.querySelector === 'function' ?
                content.querySelector(`#${VECTOR_STAGE_GUIDE_ID}`) : null;
            if (existing && existing.parentNode && typeof existing.parentNode.removeChild === 'function') {
                existing.parentNode.removeChild(existing);
            }
            return;
        }
        const group = ensureStageGuide(content);
        if (!group || typeof group.querySelector !== 'function') return;
        const bounds = getStageBounds();
        const outer = group.querySelector('[data-ngvge-stage-guide="outer"]');
        const inner = group.querySelector('[data-ngvge-stage-guide="inner"]');
        const horizontal = group.querySelector('[data-ngvge-stage-guide-origin="horizontal"]');
        const vertical = group.querySelector('[data-ngvge-stage-guide-origin="vertical"]');
        // Coordinates remain document-space. vector-effect keeps the guide stroke readable
        // while the parent svgcontent CTM handles every zoom/pan exactly once.
        [outer, inner].forEach(rect => {
            if (!rect) return;
            rect.setAttribute('x', bounds.x);
            rect.setAttribute('y', bounds.y);
            rect.setAttribute('width', bounds.width);
            rect.setAttribute('height', bounds.height);
        });
        const half = 8;
        if (horizontal) {
            horizontal.setAttribute('x1', editorOrigin.x - half);
            horizontal.setAttribute('y1', editorOrigin.y);
            horizontal.setAttribute('x2', editorOrigin.x + half);
            horizontal.setAttribute('y2', editorOrigin.y);
        }
        if (vertical) {
            vertical.setAttribute('x1', editorOrigin.x);
            vertical.setAttribute('y1', editorOrigin.y - half);
            vertical.setAttribute('x2', editorOrigin.x);
            vertical.setAttribute('y2', editorOrigin.y + half);
        }
    };

    const detachStageGuide = () => {
        const guide = getStageGuide();
        if (!guide || !guide.parentNode || typeof guide.parentNode.removeChild !== 'function') return null;
        const parent = guide.parentNode;
        const nextSibling = guide.nextSibling || null;
        parent.removeChild(guide);
        return {guide, parent, nextSibling};
    };

    const restoreStageGuide = detached => {
        if (!detached) return;
        const {guide, parent, nextSibling} = detached;
        if (nextSibling && nextSibling.parentNode === parent && typeof parent.insertBefore === 'function') {
            parent.insertBefore(guide, nextSibling);
        } else if (typeof parent.appendChild === 'function') {
            parent.appendChild(guide);
        }
    };

    const applyPresentationTransform = ({canvasInfo, viewport, zoom, presentationBounds}) => {
        const content = typeof canvas.getSvgContent === 'function' ? canvas.getSvgContent() : null;
        const root = typeof canvas.getSvgRoot === 'function' ? canvas.getSvgRoot() : null;
        if (!content || typeof content.setAttribute !== 'function' || !root || typeof root.querySelector !== 'function') {
            throw makeBackendError(
                'NGVGE_PAINT_SVG_EDIT_API_INCOMPATIBLE',
                'Installed @svgedit/svgcanvas does not expose the SVG DOM required for aligned infinite vector workspace presentation.'
            );
        }

        let x = Number(canvasInfo && canvasInfo.x);
        let y = Number(canvasInfo && canvasInfo.y);
        if (!Number.isFinite(x)) x = 0;
        if (!Number.isFinite(y)) y = 0;
        if (workspaceContext) {
            const center = zoomMode === VECTOR_ZOOM_MODES.FIT && presentationBounds ? {
                x: presentationBounds.x + presentationBounds.width / 2,
                y: presentationBounds.y + presentationBounds.height / 2
            } : {
                x: editorOrigin.x,
                y: editorOrigin.y
            };
            x = viewport.width / 2 - center.x * zoom;
            y = viewport.height / 2 - center.y * zoom;
        }
        x += presentationPan.x;
        y += presentationPan.y;

        // svgcontent, selectors, hit testing and the stage hint all share this one translation.
        // `show_outside_canvas` keeps authored geometry renderable beyond the finite SVG viewport;
        // the outer host root remains the only clipping viewport.
        content.setAttribute('x', x);
        content.setAttribute('y', y);
        forceUnboundedContentOverflow(content);
        const background = root.querySelector('#canvasBackground');
        if (background && typeof background.setAttribute === 'function') {
            background.setAttribute('x', x);
            background.setAttribute('y', y);
            background.setAttribute('visibility', 'hidden');
        }
        const selectorParent = root.querySelector('#selectorParentGroup');
        if (!selectorParent || typeof selectorParent.setAttribute !== 'function') {
            throw makeBackendError(
                'NGVGE_PAINT_SVG_EDIT_SELECTOR_ROOT_REQUIRED',
                'SVG-Edit selectorParentGroup is required to align content and selection through one transform authority.'
            );
        }
        selectorParent.setAttribute('transform', `translate(${x},${y})`);
        updateStageGuide(content);
        return {x, y};
    };

    const syncPresentationViewport = requested => {
        if (!canvas || typeof canvas.getSvgRoot !== 'function') return false;
        const root = canvas.getSvgRoot();
        if (!root || typeof root.setAttribute !== 'function') return false;
        if (typeof canvas.updateCanvas !== 'function' || typeof canvas.setZoom !== 'function') {
            throw makeBackendError(
                'NGVGE_PAINT_SVG_EDIT_API_INCOMPATIBLE',
                'Installed @svgedit/svgcanvas does not expose updateCanvas()/setZoom() required for aligned content and selection geometry.'
            );
        }

        const viewport = getMeasuredViewport(requested);
        const resolution = typeof canvas.getResolution === 'function' ? canvas.getResolution() : null;
        const contentWidth = Number(canvas.contentW) || Number(resolution && resolution.w);
        const contentHeight = Number(canvas.contentH) || Number(resolution && resolution.h);
        if (!Number.isFinite(contentWidth) || contentWidth <= 0 ||
            !Number.isFinite(contentHeight) || contentHeight <= 0) return false;

        const presentationBounds = getPresentationBounds(contentWidth, contentHeight);
        const fitZoom = Math.max(
            0.01,
            Math.min(
                viewport.width / presentationBounds.width,
                viewport.height / presentationBounds.height
            ) * VECTOR_FIT_PADDING
        );
        const requestedZoom = zoomMode === VECTOR_ZOOM_MODES.MANUAL ? manualZoom : fitZoom;

        // SVG-Edit 7.4.2 has one deliberate presentation transform chain:
        //   svgcontent: width/height = document * zoom, x/y = centered, own viewBox
        //   selector geometry: bbox * zoom
        //   selectorParentGroup: the same centered x/y translation as svgcontent
        // Hit testing also reads SVG-Edit's zoom/root CTM. The host must therefore
        // drive ONLY setZoom()+updateCanvas(); an outer svgroot viewBox would apply a
        // second scale to already-zoomed selector coordinates.
        canvas.setZoom(requestedZoom);
        const canvasInfo = canvas.updateCanvas(viewport.width, viewport.height);
        const actualZoom = typeof canvas.getZoom === 'function' ? Number(canvas.getZoom()) : requestedZoom;
        const zoom = Number.isFinite(actualZoom) && actualZoom > 0 ? actualZoom : requestedZoom;
        const offset = applyPresentationTransform({canvasInfo, viewport, zoom, presentationBounds});
        refreshSelectionGeometry();
        lastViewport = Object.freeze({
            ...viewport,
            zoom,
            zoomMode,
            zoomPercent: Math.round(zoom * 10000) / 100,
            pan: Object.freeze({...presentationPan}),
            offset: Object.freeze(offset),
            stageGuide: workspaceContext ? Object.freeze({...getStageBounds()}) : null
        });

        // Host presentation styles are safe because svgCanvasToString serializes the
        // authored svgcontent, not this outer root. Remove the HF3 root-viewBox shim
        // explicitly so old hotfix state cannot survive a remount/hot reload.
        if (typeof root.removeAttribute === 'function') {
            root.removeAttribute('viewBox');
            root.removeAttribute('preserveAspectRatio');
        }
        if (root.style) {
            root.style.display = 'block';
            root.style.width = '100%';
            root.style.height = '100%';
            root.style.overflow = 'hidden';
            root.style.color = '#000000';
        }
        return lastViewport;
    };

    const setPresentationZoom = zoom => {
        assertMounted();
        const normalized = Number(zoom);
        if (!Number.isFinite(normalized) || normalized <= 0) {
            throw makeBackendError(
                'NGVGE_PAINT_VECTOR_ZOOM_INVALID',
                'Vector presentation zoom must be a finite number greater than zero.',
                TypeError
            );
        }
        zoomMode = VECTOR_ZOOM_MODES.MANUAL;
        manualZoom = normalized;
        return syncPresentationViewport(lastViewport || undefined);
    };

    const fitPresentationToView = () => {
        assertMounted();
        zoomMode = VECTOR_ZOOM_MODES.FIT;
        presentationPan = {x: 0, y: 0};
        return syncPresentationViewport(lastViewport || undefined);
    };

    const panPresentationBy = (dx, dy) => {
        assertMounted();
        const x = Number(dx);
        const y = Number(dy);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            throw makeBackendError(
                'NGVGE_PAINT_VECTOR_PAN_INVALID',
                'Vector presentation pan requires finite dx/dy values.',
                TypeError
            );
        }
        if (zoomMode === VECTOR_ZOOM_MODES.FIT) {
            const currentZoom = lastViewport && Number(lastViewport.zoom);
            if (Number.isFinite(currentZoom) && currentZoom > 0) manualZoom = currentZoom;
            zoomMode = VECTOR_ZOOM_MODES.MANUAL;
        }
        presentationPan = {x: presentationPan.x + x, y: presentationPan.y + y};
        return syncPresentationViewport(lastViewport || undefined);
    };

    const setWorkspaceContext = context => {
        assertMounted();
        workspaceContext = normalizeWorkspaceContext(context);
        lastExportMetadata = null;
        if (loadedTransfer) syncPresentationViewport(lastViewport || undefined);
        return workspaceContext ? Object.freeze({...workspaceContext}) : null;
    };

    const requireCanvasOperation = (name, value) => {
        if (typeof value !== 'function') {
            throw makeBackendError(
                'NGVGE_PAINT_SVG_EDIT_API_INCOMPATIBLE',
                `Installed @svgedit/svgcanvas does not expose ${name}() required by Vector Professional Tooling.`
            );
        }
        return value;
    };

    const runMutation = operation => operation();

    const runCommand = (command, payload = {}) => {
        assertMounted();
        if (!VECTOR_PAINT_COMMANDS.includes(command)) {
            throw makeBackendError(
                'NGVGE_PAINT_VECTOR_COMMAND_UNSUPPORTED',
                `Unsupported NGVGE vector command: ${String(command)}`,
                TypeError
            );
        }

        const selectionState = getSelectionState();
        const hasSelection = selectionState.count > 0;
        const requiresSelection = new Set([
            'copy', 'cut', 'delete', 'duplicate',
            'bring-forward', 'send-backward', 'bring-front', 'send-back', 'move-selection'
        ]);
        const pathCommands = new Set([
            'path-add-anchor', 'path-duplicate-anchor', 'path-delete-anchor', 'path-convert-anchor',
            'path-toggle-segment', 'path-segment-line', 'path-segment-curve', 'path-open-close', 'path-link-controls'
        ]);
        if (requiresSelection.has(command) && !hasSelection) return selectionState;
        if (command === 'group' && !selectionState.canGroup) return selectionState;
        if (command === 'ungroup' && !selectionState.canUngroup) return selectionState;
        if (pathCommands.has(command) && !selectionState.directEditing) return selectionState;

        switch (command) {
        case 'copy':
            requireCanvasOperation('copySelectedElements', canvas.copySelectedElements).call(canvas);
            break;
        case 'cut':
            runMutation(() => requireCanvasOperation('cutSelectedElements', canvas.cutSelectedElements).call(canvas));
            break;
        case 'paste': {
            const before = mutationRevision;
            requireCanvasOperation('pasteElements', canvas.pasteElements).call(canvas, 'in_place');
            // SVG-Edit emits `changed` only when clipboard content was actually inserted.
            // An empty/private clipboard must remain a presentation no-op and must not dirty the Working Copy.
            if (mutationRevision !== before) return getSelectionState();
            break;
        }
        case 'delete':
            runMutation(() => requireCanvasOperation('deleteSelectedElements', canvas.deleteSelectedElements).call(canvas));
            break;
        case 'duplicate': {
            const offset = Number(payload.offset);
            const delta = Number.isFinite(offset) ? offset : 10;
            runMutation(() => requireCanvasOperation('cloneSelectedElements', canvas.cloneSelectedElements).call(canvas, delta, delta));
            break;
        }
        case 'group':
            runMutation(() => requireCanvasOperation('groupSelectedElements', canvas.groupSelectedElements).call(canvas));
            break;
        case 'ungroup':
            runMutation(() => requireCanvasOperation('ungroupSelectedElement', canvas.ungroupSelectedElement).call(canvas));
            break;
        case 'bring-forward':
            runMutation(() => requireCanvasOperation('moveUpDownSelected', canvas.moveUpDownSelected).call(canvas, 'Up'));
            break;
        case 'send-backward':
            runMutation(() => requireCanvasOperation('moveUpDownSelected', canvas.moveUpDownSelected).call(canvas, 'Down'));
            break;
        case 'bring-front':
            runMutation(() => requireCanvasOperation('moveToTopSelectedElement', canvas.moveToTopSelectedElement).call(canvas));
            break;
        case 'send-back':
            runMutation(() => requireCanvasOperation('moveToBottomSelectedElement', canvas.moveToBottomSelectedElement).call(canvas));
            break;
        case 'move-selection': {
            const dx = Number(payload.dx);
            const dy = Number(payload.dy);
            if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
                throw makeBackendError(
                    'NGVGE_PAINT_VECTOR_MOVE_INVALID',
                    'Vector move-selection requires finite dx/dy values.',
                    TypeError
                );
            }
            runMutation(() => requireCanvasOperation('moveSelectedElements', canvas.moveSelectedElements).call(canvas, dx, dy, true));
            break;
        }
        case 'clear-selection':
            leaveDirectSelection();
            requireCanvasOperation('clearSelection', canvas.clearSelection).call(canvas);
            requestedTool = 'select';
            if (typeof canvas.setMode === 'function') canvas.setMode('select');
            emit('selection:changed');
            break;
        case 'path-add-anchor':
        case 'path-duplicate-anchor':
            runMutation(() => requireCanvasOperation('pathActions.clonePathNode', canvas.pathActions && canvas.pathActions.clonePathNode).call(canvas.pathActions));
            break;
        case 'path-delete-anchor':
            runMutation(() => requireCanvasOperation('pathActions.deletePathNode', canvas.pathActions && canvas.pathActions.deletePathNode).call(canvas.pathActions));
            break;
        case 'path-convert-anchor':
        case 'path-toggle-segment':
            runMutation(() => requireCanvasOperation('pathActions.setSegType', canvas.pathActions && canvas.pathActions.setSegType).call(canvas.pathActions));
            break;
        case 'path-segment-line':
            runMutation(() => requireCanvasOperation('pathActions.setSegType', canvas.pathActions && canvas.pathActions.setSegType).call(canvas.pathActions, 4));
            break;
        case 'path-segment-curve':
            runMutation(() => requireCanvasOperation('pathActions.setSegType', canvas.pathActions && canvas.pathActions.setSegType).call(canvas.pathActions, 6));
            break;
        case 'path-open-close':
            runMutation(() => requireCanvasOperation('pathActions.opencloseSubPath', canvas.pathActions && canvas.pathActions.opencloseSubPath).call(canvas.pathActions));
            break;
        case 'path-link-controls':
            requireCanvasOperation('pathActions.linkControlPoints', canvas.pathActions && canvas.pathActions.linkControlPoints)
                .call(canvas.pathActions, payload.linked !== false);
            break;
        default:
            break;
        }
        return getSelectionState();
    };

    const controls = Object.freeze({
        id: VECTOR_PAINT_BACKEND_CONTROLS_ID,
        getTool () {
            assertMounted();
            return requestedTool;
        },
        setTool (tool) {
            assertMounted();
            if (!VECTOR_PAINT_TOOLS.includes(tool)) {
                throw makeBackendError(
                    'NGVGE_PAINT_VECTOR_TOOL_UNSUPPORTED',
                    `Unsupported NGVGE vector tool: ${String(tool)}`,
                    TypeError
                );
            }
            if (requestedTool === 'direct-select' && tool !== 'direct-select') leaveDirectSelection();
            requestedTool = tool;
            if (tool === 'direct-select') {
                if (!enterDirectSelectionIfPossible()) {
                    requireCanvasOperation('setMode', canvas.setMode).call(canvas, 'select');
                }
            } else {
                const mode = tool === 'freehand' ? 'fhpath' : (tool === 'hand' || tool === 'zoom' ? 'select' : tool);
                requireCanvasOperation('setMode', canvas.setMode).call(canvas, mode);
            }
            emit('tool:changed');
            return tool;
        },
        getSelectionState,
        runCommand,
        setWorkspaceContext,
        getWorkspaceState () {
            assertMounted();
            return Object.freeze({
                unbounded: true,
                stage: workspaceContext ? Object.freeze({...workspaceContext}) : null,
                artworkBounds: getArtworkBounds()
            });
        },
        getExportMetadata () {
            assertMounted();
            return lastExportMetadata ? Object.freeze({...lastExportMetadata}) : null;
        },
        getZoomState () {
            assertMounted();
            const zoom = lastViewport && Number(lastViewport.zoom);
            return Object.freeze({
                mode: zoomMode,
                zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : manualZoom,
                zoomPercent: Number.isFinite(zoom) && zoom > 0 ? Math.round(zoom * 10000) / 100 : manualZoom * 100,
                pan: Object.freeze({...presentationPan})
            });
        },
        setZoom (zoom) {
            return setPresentationZoom(zoom);
        },
        fitToView () {
            return fitPresentationToView();
        },
        panBy (dx, dy) {
            return panPresentationBy(dx, dy);
        },
        resetPan () {
            presentationPan = {x: 0, y: 0};
            return syncPresentationViewport(lastViewport || undefined);
        }
    });


    const implementation = {
        mount (nextContainer, options = {}) {
            assertActive();
            if (canvas) {
                throw makeBackendError('NGVGE_PAINT_SVG_EDIT_ALREADY_MOUNTED', 'SVG-Edit vector backend is already mounted.');
            }
            container = assertContainer(nextContainer);
            const config = {
                no_save_warning: true,
                showlayers: false,
                imgImport: true,
                baseUnit: 'px',
                selectNew: false,
                ...options,
                // NGVGE owns an unbounded presentation workspace. The finite SVG document
                // viewport is authoring data, not a clipping/editing boundary.
                show_outside_canvas: true
            };
            if (Array.isArray(config.dimensions) && config.dimensions.length >= 2) {
                const width = Number(config.dimensions[0]);
                const height = Number(config.dimensions[1]);
                if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
                    fallbackViewport = {width, height};
                }
            }
            // NGVGE owns the surrounding Workspace UI. SvgCanvas only receives its dedicated content container.
            canvas = new Canvas(container, config);
            if (!canvas || typeof canvas.setSvgString !== 'function' || typeof canvas.getSvgString !== 'function' ||
                typeof canvas.updateCanvas !== 'function' || typeof canvas.setZoom !== 'function') {
                canvas = null;
                container = null;
                throw makeBackendError(
                    'NGVGE_PAINT_SVG_EDIT_API_INCOMPATIBLE',
                    'Installed @svgedit/svgcanvas does not expose the required v7 SvgCanvas API.'
                );
            }
            syncPresentationViewport();
            if (typeof canvas.bind === 'function') {
                canvas.bind('changed', onChanged);
                canvas.bind('selected', onSelected);
            }
            return {
                backendAdapterId: SVG_EDIT_VECTOR_BACKEND_ADAPTER_ID,
                package: SVG_EDIT_VECTOR_BACKEND_PACKAGE,
                mounted: true
            };
        },

        load (transfer) {
            assertMounted();
            const normalized = normalizePaintBackendTransfer(transfer);
            const source = getSvgSourceEntry(normalized);
            // Loading/rebasing is adapter presentation setup, never a Working Copy mutation.
            // Null the loaded transfer so SVG-Edit's internal selected/changed events cannot dirty
            // the new document while its Scratch-style editor origin is established.
            loadedTransfer = null;
            contentOverflowSnapshot = null;
            const accepted = canvas.setSvgString(source.content.text, true);
            if (accepted === false) {
                throw makeBackendError('NGVGE_PAINT_SVG_EDIT_LOAD_REJECTED', 'SVG-Edit rejected the canonical SVG source.');
            }
            const content = getSvgContent();
            forceUnboundedContentOverflow(content);
            rebaseArtworkToEditorOrigin();
            if (canvas.undoMgr && typeof canvas.undoMgr.resetUndoStack === 'function') {
                canvas.undoMgr.resetUndoStack();
            }
            zoomMode = VECTOR_ZOOM_MODES.FIT;
            presentationPan = {x: 0, y: 0};
            lastExportMetadata = null;
            requestedTool = 'select';
            syncPresentationViewport();
            loadedTransfer = clonePortable(normalized);
            dirty = false;
            emit('document:loaded');
            return {
                documentId: normalized.document.documentId,
                resourceId: normalized.document.resourceId,
                loaded: true
            };
        },

        setActiveTarget (target) {
            assertMounted();
            if (!loadedTransfer) {
                throw makeBackendError(
                    'NGVGE_PAINT_SVG_EDIT_DOCUMENT_REQUIRED',
                    'Load a vector document before selecting a target.'
                );
            }
            if (target && Object.keys(target).length) {
                throw makeBackendError(
                    'NGVGE_PAINT_SVG_EDIT_TARGET_INVALID',
                    'SVG-Edit v1 integration is document-scoped; raster/private target identities are forbidden.'
                );
            }
            return {documentScoped: true};
        },

        exportTransfer () {
            assertMounted();
            if (!loadedTransfer) {
                throw makeBackendError(
                    'NGVGE_PAINT_SVG_EDIT_DOCUMENT_REQUIRED',
                    'Load a vector document before export.'
                );
            }
            const artworkBounds = getArtworkBounds();
            const content = getSvgContent();
            const detachedGuide = detachStageGuide();
            let svgText;
            try {
                // The live editor forces svgcontent overflow open so off-artboard geometry is
                // visible/hit-testable. Restore the authored inline overflow while serializing;
                // presentation policy must never leak into Resource content.
                restoreAuthoredOverflowForSerialization(content);
                svgText = canvas.getSvgString();
            } finally {
                forceUnboundedContentOverflow(content);
                restoreStageGuide(detachedGuide);
            }
            if (typeof svgText !== 'string' || !svgText.trim()) {
                throw makeBackendError('NGVGE_PAINT_SVG_EDIT_EXPORT_INVALID', 'SVG-Edit returned an empty SVG document.');
            }
            const normalizedArtwork = normalizeSvgToArtworkBounds(svgText, artworkBounds);
            const exported = clonePortable(loadedTransfer);
            const source = getSvgSourceEntry(exported);
            source.dataFormat = 'svg';
            source.content = {kind: 'svg-text', text: normalizedArtwork.text};
            exported.document.viewport = clonePortable(normalizedArtwork.viewport);
            exported.activeTarget = {};
            lastExportMetadata = workspaceContext ? Object.freeze({
                // Mirrors Scratch Paint's content-tight export: the editor registration origin
                // stays fixed while the serialized SVG is translated by -artworkBounds origin.
                rotationCenterX: editorOrigin.x - normalizedArtwork.sourceOrigin.x,
                rotationCenterY: editorOrigin.y - normalizedArtwork.sourceOrigin.y,
                sourceOriginX: normalizedArtwork.sourceOrigin.x,
                sourceOriginY: normalizedArtwork.sourceOrigin.y,
                normalizedArtwork: normalizedArtwork.normalized
            }) : null;
            return normalizePaintBackendTransfer(exported);
        },

        resize (size = {}) {
            assertMounted();
            // Workspace geometry stays presentation-only. SVG-Edit's updateCanvas()
            // synchronizes content and selector coordinates without changing the
            // canonical document resolution returned by getResolution()/export.
            const viewport = syncPresentationViewport(size);
            return viewport || {width: null, height: null, zoom: null};
        },

        focus () {
            assertMounted();
            if (container && typeof container.focus === 'function') container.focus();
            return true;
        },

        dispose () {
            if (disposed) return false;
            disposed = true;
            if (canvas && typeof canvas.unbind === 'function') {
                canvas.unbind('changed', onChanged);
                canvas.unbind('selected', onSelected);
            }
            if (container && typeof container.replaceChildren === 'function') container.replaceChildren();
            canvas = null;
            container = null;
            loadedTransfer = null;
            lastViewport = null;
            zoomMode = VECTOR_ZOOM_MODES.FIT;
            manualZoom = 1;
            presentationPan = {x: 0, y: 0};
            workspaceContext = null;
            lastExportMetadata = null;
            editorOrigin = {x: 0, y: 0};
            contentOverflowSnapshot = null;
            requestedTool = 'select';
            listeners.clear();
            return true;
        },

        undo () {
            assertMounted();
            if (!loadedTransfer || typeof canvas.undo !== 'function') return false;
            const state = implementation.getHistoryState();
            if (!state.canUndo) return false;
            canvas.undo();
            dirty = true;
            emit('history:undo');
            return true;
        },

        redo () {
            assertMounted();
            if (!loadedTransfer || typeof canvas.redo !== 'function') return false;
            const state = implementation.getHistoryState();
            if (!state.canRedo) return false;
            canvas.redo();
            dirty = true;
            emit('history:redo');
            return true;
        },

        getHistoryState () {
            assertMounted();
            const undoManager = canvas && canvas.undoMgr;
            return {
                canUndo: Boolean(undoManager &&
                    typeof undoManager.getUndoStackSize === 'function' && undoManager.getUndoStackSize() > 0),
                canRedo: Boolean(undoManager &&
                    typeof undoManager.getRedoStackSize === 'function' && undoManager.getRedoStackSize() > 0),
                dirty
            };
        },

        subscribe (listener) {
            assertActive();
            if (typeof listener !== 'function') throw new TypeError('SVG-Edit backend listener must be a function.');
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    };

    return Object.freeze({implementation: Object.freeze(implementation), controls});
};

const createSvgEditVectorBackend = options => createSvgEditVectorBackendAdapter(options).implementation;

const SVG_EDIT_VECTOR_BACKEND_DESCRIPTOR = getPaintBackendCandidate(SVG_EDIT_BACKEND_ID);

export {
    SVG_EDIT_VECTOR_BACKEND_ADAPTER_ID,
    SVG_EDIT_VECTOR_BACKEND_PACKAGE,
    VECTOR_PAINT_BACKEND_CONTROLS_ID,
    VECTOR_PAINT_TOOLS,
    VECTOR_PAINT_COMMANDS,
    VECTOR_ZOOM_PRESETS,
    VECTOR_ZOOM_MODES,
    SVG_EDIT_VECTOR_BACKEND_DESCRIPTOR,
    createSvgEditVectorBackendAdapter,
    createSvgEditVectorBackend
};
