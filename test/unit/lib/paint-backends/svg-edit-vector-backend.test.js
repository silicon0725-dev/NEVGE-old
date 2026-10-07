import {createPaintBackendBinding} from '../../../../src/lib/paint-backends/paint-backend-contract';
import {
    SVG_EDIT_VECTOR_BACKEND_ADAPTER_ID,
    SVG_EDIT_VECTOR_BACKEND_DESCRIPTOR,
    SVG_EDIT_VECTOR_BACKEND_PACKAGE,
    VECTOR_PAINT_COMMANDS,
    VECTOR_PAINT_TOOLS,
    VECTOR_ZOOM_MODES,
    VECTOR_ZOOM_PRESETS,
    createSvgEditVectorBackendAdapter
} from '../../../../src/lib/paint-backends/svg-edit-vector-backend';
import {
    createSvgEditVectorTransferFromWorkingCopy,
    createWorkingCopyEditFromSvgEditTransfer,
    decodeSvgDataUri,
    deriveSvgViewport,
    normalizeSvgToArtworkBounds
} from '../../../../src/lib/paint-backends/svg-edit-vector-transfer';

const RESOURCE_ID = 'ngvge:resource:vector-test';

const makeFakeStyle = () => {
    const values = {};
    const priorities = {};
    return {
        setProperty: (name, value, priority = '') => {
            values[name] = String(value);
            priorities[name] = String(priority);
        },
        getPropertyValue: name => values[name] || '',
        getPropertyPriority: name => priorities[name] || '',
        removeProperty: name => {
            const previous = values[name] || '';
            delete values[name];
            delete priorities[name];
            return previous;
        },
        get overflow () { return values.overflow || ''; },
        set overflow (value) {
            if (value) values.overflow = String(value);
            else delete values.overflow;
        }
    };
};

const makeFakeSvgElement = name => {
    const attributes = {};
    const children = [];
    const matches = (element, selector) => {
        const idMatch = selector.match(/^#(.+)$/);
        if (idMatch) return element.getAttribute('id') === idMatch[1];
        const attrMatch = selector.match(/^\[([^=\]]+)="([^"]+)"\]$/);
        return Boolean(attrMatch && element.getAttribute(attrMatch[1]) === attrMatch[2]);
    };
    const element = {
        nodeName: name,
        localName: name,
        tagName: name,
        children,
        childNodes: children,
        parentNode: null,
        style: makeFakeStyle(),
        setAttribute: (key, value) => { attributes[key] = String(value); },
        getAttribute: key => Object.prototype.hasOwnProperty.call(attributes, key) ? attributes[key] : null,
        removeAttribute: key => { delete attributes[key]; },
        appendChild: child => {
            if (child.parentNode && child.parentNode !== element && typeof child.parentNode.removeChild === 'function') {
                child.parentNode.removeChild(child);
            }
            const existing = children.indexOf(child);
            if (existing >= 0) children.splice(existing, 1);
            children.push(child);
            child.parentNode = element;
            return child;
        },
        insertBefore: (child, before) => {
            if (child.parentNode && child.parentNode !== element && typeof child.parentNode.removeChild === 'function') {
                child.parentNode.removeChild(child);
            }
            const existing = children.indexOf(child);
            if (existing >= 0) children.splice(existing, 1);
            const index = children.indexOf(before);
            if (index >= 0) children.splice(index, 0, child);
            else children.push(child);
            child.parentNode = element;
            return child;
        },
        removeChild: child => {
            const index = children.indexOf(child);
            if (index >= 0) children.splice(index, 1);
            child.parentNode = null;
            return child;
        },
        querySelector: selector => {
            const visit = node => {
                if (matches(node, selector)) return node;
                for (const child of node.children || []) {
                    const found = visit(child);
                    if (found) return found;
                }
                return null;
            };
            for (const child of children) {
                const found = visit(child);
                if (found) return found;
            }
            return null;
        }
    };
    Object.defineProperty(element, 'nextSibling', {
        get: () => {
            if (!element.parentNode || !element.parentNode.children) return null;
            const index = element.parentNode.children.indexOf(element);
            return index >= 0 ? element.parentNode.children[index + 1] || null : null;
        }
    });
    return element;
};

class FakeSvgCanvas {
    constructor (container, config) {
        this.container = container;
        this.config = config;
        this.svg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"></svg>';
        this.mode = 'select';
        this.handlers = new Map();
        this.resolutions = [];
        this.zoom = 1;
        this.canvasUpdates = [];
        this.contentGeometry = null;
        this.selectorParentTranslation = null;
        this.selectorGeometry = null;
        this.artworkBounds = null;
        this.selectedElements = [];
        this.selectorResizeCount = 0;
        this.pathZoomChangeCount = 0;
        this.rootAttributes = {};
        this.contentAttributes = {};
        this.backgroundAttributes = {};
        this.ownerDocument = {createElementNS: (namespace, name) => {
            const element = makeFakeSvgElement(name);
            element.ownerDocument = this.ownerDocument;
            return element;
        }};
        this.content = makeFakeSvgElement('svg');
        this.content.ownerDocument = this.ownerDocument;
        const contentSetAttribute = this.content.setAttribute;
        this.content.setAttribute = (name, value) => {
            contentSetAttribute(name, value);
            this.contentAttributes[name] = String(value);
            if (this.contentGeometry && (name === 'x' || name === 'y')) this.contentGeometry[name] = Number(value);
        };
        const contentRemoveAttribute = this.content.removeAttribute;
        this.content.removeAttribute = name => {
            contentRemoveAttribute(name);
            delete this.contentAttributes[name];
        };
        this.background = {
            setAttribute: (name, value) => {
                this.backgroundAttributes[name] = String(value);
            }
        };
        this.selectorParent = {
            setAttribute: (name, value) => {
                if (name !== 'transform') return;
                const match = String(value).match(/translate\(([-0-9.]+),([-0-9.]+)\)/);
                if (match) this.selectorParentTranslation = {x: Number(match[1]), y: Number(match[2])};
            }
        };
        this.root = {
            style: {},
            ownerDocument: this.ownerDocument,
            setAttribute: (name, value) => {
                this.rootAttributes[name] = String(value);
            },
            removeAttribute: name => {
                delete this.rootAttributes[name];
            },
            querySelector: selector => ({
                '#canvasBackground': this.background,
                '#selectorParentGroup': this.selectorParent
            }[selector] || null)
        };
        Object.defineProperty(this, 'stageGuide', {
            get: () => this.content.querySelector('#ngvge-vector-stage-guide')
        });
        this.modelAuthoredDom = false;
        this.serializedOverflow = null;
        this.authoredTranslation = {x: 0, y: 0};
        this.commandCalls = [];
        this.pathActions = {
            zoomChange: () => {
                this.pathZoomChangeCount += 1;
            },
            toEditMode: element => {
                this.commandCalls.push(['path.toEditMode', element && element.id]);
                this.mode = 'pathedit';
            },
            clear: () => {
                this.commandCalls.push(['path.clear']);
                this.mode = 'select';
            },
            clonePathNode: () => { this.commandCalls.push(['path.clonePathNode']); this.triggerChanged(this.svg); },
            deletePathNode: () => { this.commandCalls.push(['path.deletePathNode']); this.triggerChanged(this.svg); },
            setSegType: type => { this.commandCalls.push(['path.setSegType', type]); this.triggerChanged(this.svg); },
            opencloseSubPath: () => { this.commandCalls.push(['path.opencloseSubPath']); this.triggerChanged(this.svg); },
            linkControlPoints: linked => this.commandCalls.push(['path.linkControlPoints', linked])
        };
        this.undoCount = 0;
        this.redoCount = 0;
        this.undoMgr = {
            getUndoStackSize: () => this.undoCount,
            getRedoStackSize: () => this.redoCount,
            resetUndoStack: () => {
                this.undoCount = 0;
                this.redoCount = 0;
            }
        };
    }

    setSvgString (svg) {
        this.svg = svg;
        const widthMatch = this.svg.match(/\bwidth=["']([0-9.]+)/i);
        const heightMatch = this.svg.match(/\bheight=["']([0-9.]+)/i);
        this.contentW = widthMatch ? Number(widthMatch[1]) : 64;
        this.contentH = heightMatch ? Number(heightMatch[1]) : 32;
        this.zoom = 1;
        this.authoredTranslation = {x: 0, y: 0};
        this.content.setAttribute('overflow', this.config.show_outside_canvas ? 'visible' : 'hidden');
        this.content.style.removeProperty('overflow');
        const styleMatch = this.svg.match(/\bstyle=["']([^"']*)["']/i);
        if (styleMatch) {
            const overflowMatch = styleMatch[1].match(/(?:^|;)\s*overflow\s*:\s*([^;!]+)\s*(!important)?/i);
            if (overflowMatch) {
                this.content.style.setProperty(
                    'overflow',
                    overflowMatch[1].trim(),
                    overflowMatch[2] ? 'important' : ''
                );
            }
        }
        if (this.modelAuthoredDom) {
            while (this.content.children.length) this.content.removeChild(this.content.children[0]);
            const layer = makeFakeSvgElement('g');
            layer.ownerDocument = this.ownerDocument;
            layer.isLayer = true;
            const rectMatch = this.svg.match(/<rect\b([^>]*)\/?\s*>/i);
            if (rectMatch) {
                const read = (name, fallback) => {
                    const match = rectMatch[1].match(new RegExp(`\\b${name}=["']([-0-9.]+)`, 'i'));
                    return match ? Number(match[1]) : fallback;
                };
                const rect = makeFakeSvgElement('rect');
                rect.ownerDocument = this.ownerDocument;
                rect.id = 'fake-authored-rect';
                rect.bbox = {x: read('x', 0), y: read('y', 0), width: read('width', 10), height: read('height', 10)};
                rect.getBBox = () => ({...rect.bbox});
                layer.appendChild(rect);
                this.artworkBounds = {...rect.bbox};
            }
            this.content.appendChild(layer);
        }
        return true;
    }

    getSvgString () {
        this.serializedOverflow = {
            value: this.content.style.getPropertyValue('overflow'),
            priority: this.content.style.getPropertyPriority('overflow')
        };
        if (this.authoredTranslation.x || this.authoredTranslation.y) {
            const opening = this.svg.match(/<svg\b[^>]*>/i);
            const closingIndex = this.svg.toLowerCase().lastIndexOf('</svg>');
            if (opening && closingIndex >= 0) {
                const bodyStart = opening.index + opening[0].length;
                const body = this.svg.slice(bodyStart, closingIndex);
                return `${this.svg.slice(0, bodyStart)}<g data-fake-editor-rebase="true" transform="translate(${this.authoredTranslation.x} ${this.authoredTranslation.y})">${body}</g>${this.svg.slice(closingIndex)}`;
            }
        }
        return this.svg;
    }

    getSvgRoot () {
        return this.root;
    }

    getSvgContent () {
        return this.content;
    }

    getResolution () {
        const widthMatch = this.svg.match(/\bwidth=["']([0-9.]+)/i);
        const heightMatch = this.svg.match(/\bheight=["']([0-9.]+)/i);
        return {
            w: widthMatch ? Number(widthMatch[1]) : 64,
            h: heightMatch ? Number(heightMatch[1]) : 32,
            zoom: this.zoom
        };
    }

    setZoom (zoom) {
        this.zoom = zoom;
    }

    getZoom () {
        return this.zoom;
    }

    updateCanvas (width, height) {
        const x = (width - this.contentW * this.zoom) / 2;
        const y = (height - this.contentH * this.zoom) / 2;
        this.contentGeometry = {
            x,
            y,
            width: this.contentW * this.zoom,
            height: this.contentH * this.zoom,
            viewBox: `0 0 ${this.contentW} ${this.contentH}`
        };
        this.contentAttributes.x = String(x);
        this.contentAttributes.y = String(y);
        this.selectorParentTranslation = {x, y};
        this.canvasUpdates.push({width, height, zoom: this.zoom, x, y});
        return {x, y};
    }

    getSelectedElements () {
        return this.selectedElements;
    }

    getStrokedBBox (items) {
        if (Array.isArray(items) && items.length && items.every(item => item && item.bbox)) {
            const left = Math.min(...items.map(item => item.bbox.x));
            const top = Math.min(...items.map(item => item.bbox.y));
            const right = Math.max(...items.map(item => item.bbox.x + item.bbox.width));
            const bottom = Math.max(...items.map(item => item.bbox.y + item.bbox.height));
            return {x: left, y: top, width: right - left, height: bottom - top};
        }
        return this.artworkBounds;
    }

    isLayer (element) {
        return Boolean(element && element.isLayer);
    }

    getVisibleElements (layer) {
        return Array.from(layer && layer.children || []).filter(item => typeof item.getBBox === 'function').reverse();
    }

    addToSelection (items) {
        this.commandCalls.push(['addToSelection', items.length]);
        this.selectedElements = items.slice();
    }

    gettingSelectorManager () {
        return {
            requestSelector: element => ({
                resize: () => {
                    this.selectorResizeCount += 1;
                    if (element && element.bbox && this.selectorParentTranslation) {
                        this.selectorGeometry = {
                            x: this.selectorParentTranslation.x + element.bbox.x * this.zoom,
                            y: this.selectorParentTranslation.y + element.bbox.y * this.zoom,
                            width: element.bbox.width * this.zoom,
                            height: element.bbox.height * this.zoom
                        };
                    }
                }
            })
        };
    }

    setResolution (width, height) {
        this.resolutions.push([width, height]);
        return true;
    }

    setMode (mode) {
        this.mode = mode;
    }

    getMode () {
        return this.mode;
    }

    clearSelection () {
        this.commandCalls.push(['clearSelection']);
        this.selectedElements = [];
    }

    copySelectedElements () { this.commandCalls.push(['copySelectedElements']); }
    cutSelectedElements () { this.commandCalls.push(['cutSelectedElements']); this.triggerChanged(this.svg); }
    pasteElements (mode) { this.commandCalls.push(['pasteElements', mode]); }
    deleteSelectedElements () { this.commandCalls.push(['deleteSelectedElements']); this.triggerChanged(this.svg); }
    cloneSelectedElements (dx, dy) { this.commandCalls.push(['cloneSelectedElements', dx, dy]); this.triggerChanged(this.svg); }
    groupSelectedElements () { this.commandCalls.push(['groupSelectedElements']); this.triggerChanged(this.svg); }
    ungroupSelectedElement () { this.commandCalls.push(['ungroupSelectedElement']); this.triggerChanged(this.svg); }
    moveUpDownSelected (direction) { this.commandCalls.push(['moveUpDownSelected', direction]); this.triggerChanged(this.svg); }
    moveToTopSelectedElement () { this.commandCalls.push(['moveToTopSelectedElement']); this.triggerChanged(this.svg); }
    moveToBottomSelectedElement () { this.commandCalls.push(['moveToBottomSelectedElement']); this.triggerChanged(this.svg); }
    moveSelectedElements (dx, dy, undoable) {
        this.commandCalls.push(['moveSelectedElements', dx, dy, undoable]);
        const arrayMove = Array.isArray(dx) && Array.isArray(dy);
        this.selectedElements.forEach((item, index) => {
            if (!item || !item.bbox) return;
            const moveX = arrayMove ? Number(dx[index]) : Number(dx) / this.zoom;
            const moveY = arrayMove ? Number(dy[index]) : Number(dy) / this.zoom;
            item.bbox.x += moveX;
            item.bbox.y += moveY;
        });
        if (arrayMove && dx.length) {
            this.authoredTranslation.x += Number(dx[0]) || 0;
            this.authoredTranslation.y += Number(dy[0]) || 0;
        }
        if (this.selectedElements.length && this.selectedElements.every(item => item && item.bbox)) {
            this.artworkBounds = this.getStrokedBBox(this.selectedElements);
        }
        this.triggerChanged(this.svg);
    }

    bind (event, handler) {
        this.handlers.set(event, handler);
    }

    unbind (event) {
        this.handlers.delete(event);
    }

    triggerChanged (svg) {
        this.svg = svg;
        this.undoCount += 1;
        const handler = this.handlers.get('changed');
        if (handler) handler();
    }

    undo () {
        if (this.undoCount > 0) {
            this.undoCount -= 1;
            this.redoCount += 1;
        }
    }

    redo () {
        if (this.redoCount > 0) {
            this.redoCount -= 1;
            this.undoCount += 1;
        }
    }
}

const makeContainer = ({width = 640, height = 420} = {}) => ({
    style: {},
    clientWidth: width,
    clientHeight: height,
    appendChild: jest.fn(),
    focus: jest.fn(),
    replaceChildren: jest.fn(),
    getBoundingClientRect: () => ({width, height})
});

const makeWorkingCopy = (svg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"></svg>') => ({
    workingCopyId: 'ngvge.workspace-paint-working-copy.vector',
    resourceId: RESOURCE_ID,
    sourceAuthorityRevision: 2,
    dataFormat: 'svg',
    bitmapResolution: 1,
    rotationCenterX: 32,
    rotationCenterY: 16,
    dirty: false,
    stale: false,
    content: {kind: 'svg-text', text: svg}
});

describe('WS-10F SVG-Edit vector backend adapter', () => {
    test('pins the replaceable adapter identity and package version', () => {
        expect(SVG_EDIT_VECTOR_BACKEND_ADAPTER_ID).toBe('ngvge.paint-backend-adapter.svg-edit@1');
        expect(SVG_EDIT_VECTOR_BACKEND_PACKAGE).toBe('@svgedit/svgcanvas@7.4.2');
        expect(SVG_EDIT_VECTOR_BACKEND_DESCRIPTOR.backendId).toBe('ngvge.paint-backend.svg-edit');
    });

    test('derives vector viewport from width/height or viewBox', () => {
        expect(deriveSvgViewport('<svg width="80" height="40"></svg>')).toEqual({width: 80, height: 40});
        expect(deriveSvgViewport('<svg viewBox="0 0 320 180"></svg>')).toEqual({width: 320, height: 180});
    });

    test('maps SVG working copy into stable NGVGE vector transfer', () => {
        const transfer = createSvgEditVectorTransferFromWorkingCopy(makeWorkingCopy());
        expect(transfer.document.resourceId).toBe(RESOURCE_ID);
        expect(transfer.document.documentId).toBe('ngvge:art-document:vector-test');
        expect(transfer.document.viewport).toEqual({width: 64, height: 32});
        expect(transfer.contentEntries[0].content.text).toContain('<svg');
    });


    test('bridges the production Resource Content data-uri shape into canonical SVG text', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="48"><rect width="96" height="48"/></svg>';
        const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
        const workingCopy = {
            ...makeWorkingCopy(svg),
            content: {kind: 'data-uri', dataUri}
        };
        const transfer = createSvgEditVectorTransferFromWorkingCopy(workingCopy);
        expect(transfer.document.viewport).toEqual({width: 96, height: 48});
        expect(transfer.contentEntries[0].content).toEqual({kind: 'svg-text', text: svg});
    });

    test('decodes percent-encoded SVG data URIs without changing authored SVG text', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M0 0h24v24H0z"/></svg>';
        const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        expect(decodeSvgDataUri(dataUri)).toBe(svg);
    });

    test('rejects non-SVG data URIs at the Vector transfer boundary', () => {
        const workingCopy = {
            ...makeWorkingCopy(),
            content: {kind: 'data-uri', dataUri: 'data:image/png;base64,AAAA'}
        };
        expect(() => createSvgEditVectorTransferFromWorkingCopy(workingCopy)).toThrow(/image\/svg\+xml/);
    });

    test('loads, edits and exports SVG without replacing NGVGE identity', () => {
        const adapter = createSvgEditVectorBackendAdapter({SvgCanvasClass: FakeSvgCanvas});
        const binding = createPaintBackendBinding({
            descriptor: SVG_EDIT_VECTOR_BACKEND_DESCRIPTOR,
            implementation: adapter.implementation
        });
        const container = makeContainer();
        binding.mount(container, {});
        const transfer = createSvgEditVectorTransferFromWorkingCopy(makeWorkingCopy());
        binding.load(transfer);
        binding.setActiveTarget({});
        expect(adapter.controls.setTool('freehand')).toBe('freehand');
        expect(adapter.controls.getTool()).toBe('freehand');

        const canvas = adapter.implementation;
        expect(Object.keys(canvas)).not.toContain('saveProject');
        // The fake instance is intentionally private; change notification is exercised through the public binding event.
        const events = [];
        const unsubscribe = binding.subscribe(event => events.push(event.type));
        expect(binding.exportTransfer().document.documentId).toBe(transfer.document.documentId);
        unsubscribe();
        binding.dispose();
        expect(container.replaceChildren).toHaveBeenCalled();
        expect(events).toEqual([]);
    });

    test('reflects SVG-Edit changed events into portable exports and history', () => {
        let createdCanvas = null;
        class CapturingCanvas extends FakeSvgCanvas {
            constructor (...args) {
                super(...args);
                createdCanvas = this;
            }
        }
        const adapter = createSvgEditVectorBackendAdapter({SvgCanvasClass: CapturingCanvas});
        const binding = createPaintBackendBinding({
            descriptor: SVG_EDIT_VECTOR_BACKEND_DESCRIPTOR,
            implementation: adapter.implementation
        });
        binding.mount(makeContainer(), {});
        binding.load(createSvgEditVectorTransferFromWorkingCopy(makeWorkingCopy()));
        const events = [];
        binding.subscribe(event => events.push(event.type));
        createdCanvas.triggerChanged('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>');
        const exported = binding.exportTransfer();
        expect(exported.contentEntries[0].content.text).toContain('<rect');
        expect(binding.getHistoryState()).toMatchObject({canUndo: true, dirty: true});
        expect(events).toContain('content:changed');
        expect(binding.undo()).toBe(true);
        expect(binding.getHistoryState().canRedo).toBe(true);
    });

    test('converts exported vector transfer back to Paint working-copy edit', () => {
        const transfer = createSvgEditVectorTransferFromWorkingCopy(makeWorkingCopy());
        const edit = createWorkingCopyEditFromSvgEditTransfer(transfer);
        expect(edit).toMatchObject({
            dataFormat: 'svg',
            bitmapResolution: 1,
            rotationCenterX: 32,
            rotationCenterY: 16
        });
        expect(edit.content.kind).toBe('svg-text');
    });

    test('normalizes off-canvas artwork into a tight zero-based SVG without exporting workspace guides', () => {
        const source = [
            '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32">',
            '<defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs>',
            '<rect id="shape" x="-20" y="10" width="100" height="40" fill="url(#g)"/>',
            '</svg>'
        ].join('');
        const result = normalizeSvgToArtworkBounds(source, {x: -20, y: 10, width: 100, height: 40});

        expect(result.normalized).toBe(true);
        expect(result.viewport).toEqual({width: 100, height: 40});
        expect(result.sourceOrigin).toEqual({x: -20, y: 10});
        expect(deriveSvgViewport(result.text)).toEqual({width: 100, height: 40});
        expect(result.text).toContain('viewBox="0 0 100 40"');
        expect(result.text).toContain('data-ngvge-export-normalized="true"');
        expect(result.text).toContain('transform="translate(20 -10)"');
        expect(result.text).toContain('id="shape"');
        expect(result.text).not.toContain('ngvge-vector-stage-guide');
    });

    test('preserves explicit normalized rotation center when converting export back to Working Copy edit', () => {
        const transfer = createSvgEditVectorTransferFromWorkingCopy(makeWorkingCopy());
        const edit = createWorkingCopyEditFromSvgEditTransfer(transfer, {
            rotationCenterX: 132,
            rotationCenterY: 6
        });
        expect(edit.rotationCenterX).toBe(132);
        expect(edit.rotationCenterY).toBe(6);
    });

    test('uses an unbounded SVG-Edit workspace with a Scratch-style stage guide instead of the SVG viewport as an edit boundary', () => {
        let createdCanvas = null;
        class CapturingCanvas extends FakeSvgCanvas {
            constructor (...args) {
                super(...args);
                createdCanvas = this;
            }
        }
        const adapter = createSvgEditVectorBackendAdapter({SvgCanvasClass: CapturingCanvas});
        const binding = createPaintBackendBinding({descriptor: SVG_EDIT_VECTOR_BACKEND_DESCRIPTOR, implementation: adapter.implementation});
        binding.mount(makeContainer({width: 1000, height: 600}), {show_outside_canvas: false});
        createdCanvas.modelAuthoredDom = true;
        adapter.controls.setWorkspaceContext({
            stageWidth: 480,
            stageHeight: 360,
            rotationCenterX: 32,
            rotationCenterY: 16
        });
        const source = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32" style="overflow:hidden"><rect x="8" y="4" width="24" height="12"/></svg>';
        binding.load(createSvgEditVectorTransferFromWorkingCopy(makeWorkingCopy(source)));

        expect(createdCanvas.config.show_outside_canvas).toBe(true);
        expect(createdCanvas.contentAttributes.overflow).toBe('visible');
        expect(createdCanvas.content.style.getPropertyValue('overflow')).toBe('visible');
        expect(createdCanvas.content.style.getPropertyPriority('overflow')).toBe('important');
        expect(createdCanvas.backgroundAttributes.visibility).toBe('hidden');
        expect(adapter.controls.getWorkspaceState()).toMatchObject({
            unbounded: true,
            stage: {stageWidth: 480, stageHeight: 360, rotationCenterX: 32, rotationCenterY: 16}
        });
        expect(createdCanvas.stageGuide).not.toBeNull();
        expect(createdCanvas.stageGuide.getAttribute('data-ngvge-presentation-only')).toBe('stage-size-guide');
        expect(createdCanvas.stageGuide.parentNode).toBe(createdCanvas.content);
        expect(createdCanvas.stageGuide.getAttribute('transform')).toBeNull();
        const inner = createdCanvas.stageGuide.querySelector('[data-ngvge-stage-guide="inner"]');
        expect(Number(inner.getAttribute('x'))).toBe(-240);
        expect(Number(inner.getAttribute('y'))).toBe(-180);
        expect(Number(inner.getAttribute('width'))).toBe(480);
        expect(Number(inner.getAttribute('height'))).toBe(360);
        expect(adapter.controls.getWorkspaceState().artworkBounds).toEqual({x: -24, y: -12, width: 24, height: 12});
        binding.exportTransfer();
        expect(createdCanvas.serializedOverflow).toEqual({value: 'hidden', priority: ''});
        expect(createdCanvas.content.style.getPropertyValue('overflow')).toBe('visible');
        expect(createdCanvas.content.style.getPropertyPriority('overflow')).toBe('important');
        expect(createdCanvas.stageGuide.parentNode).toBe(createdCanvas.content);
        expect(createdCanvas.resolutions).toEqual([]);
    });

    test('rebases the costume rotation center to one Scratch-style editor origin shared by art, guide and selection', () => {
        let createdCanvas = null;
        class CapturingCanvas extends FakeSvgCanvas {
            constructor (...args) {
                super(...args);
                createdCanvas = this;
            }
        }
        const adapter = createSvgEditVectorBackendAdapter({SvgCanvasClass: CapturingCanvas});
        const binding = createPaintBackendBinding({descriptor: SVG_EDIT_VECTOR_BACKEND_DESCRIPTOR, implementation: adapter.implementation});
        binding.mount(makeContainer({width: 900, height: 600}), {});
        createdCanvas.modelAuthoredDom = true;
        adapter.controls.setWorkspaceContext({
            stageWidth: 480,
            stageHeight: 360,
            rotationCenterX: 100,
            rotationCenterY: 70
        });
        const source = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="140"><rect x="80" y="50" width="60" height="40"/></svg>';
        binding.load(createSvgEditVectorTransferFromWorkingCopy(makeWorkingCopy(source)));

        const authored = createdCanvas.content.children[0].children[0];
        expect(authored.bbox).toEqual({x: -20, y: -20, width: 60, height: 40});
        expect(adapter.controls.getWorkspaceState().artworkBounds).toEqual({x: -20, y: -20, width: 60, height: 40});
        expect(createdCanvas.commandCalls).toEqual(expect.arrayContaining([
            ['addToSelection', 1],
            ['moveSelectedElements', [-100], [-70], false]
        ]));
        expect(binding.getHistoryState()).toMatchObject({canUndo: false, dirty: false});

        createdCanvas.selectedElements = [authored];
        const viewport = adapter.controls.setZoom(2);
        const inner = createdCanvas.stageGuide.querySelector('[data-ngvge-stage-guide="inner"]');
        expect(Number(inner.getAttribute('x'))).toBe(-240);
        expect(Number(inner.getAttribute('y'))).toBe(-180);
        expect(createdCanvas.selectorGeometry).toEqual({
            x: createdCanvas.contentGeometry.x - 40,
            y: createdCanvas.contentGeometry.y - 40,
            width: 120,
            height: 80
        });
        expect(viewport.stageGuide).toEqual({x: -240, y: -180, width: 480, height: 360});
    });

    test('fits stage plus artwork while preserving selection/content alignment outside the source SVG viewport', () => {
        let createdCanvas = null;
        class CapturingCanvas extends FakeSvgCanvas {
            constructor (...args) {
                super(...args);
                createdCanvas = this;
            }
        }
        const adapter = createSvgEditVectorBackendAdapter({SvgCanvasClass: CapturingCanvas});
        const binding = createPaintBackendBinding({descriptor: SVG_EDIT_VECTOR_BACKEND_DESCRIPTOR, implementation: adapter.implementation});
        binding.mount(makeContainer({width: 1000, height: 600}), {});
        createdCanvas.artworkBounds = {x: -280, y: -190, width: 600, height: 420};
        adapter.controls.setWorkspaceContext({
            stageWidth: 480,
            stageHeight: 360,
            rotationCenterX: 32,
            rotationCenterY: 16
        });
        binding.load(createSvgEditVectorTransferFromWorkingCopy(makeWorkingCopy()));
        const bbox = {x: -120, y: -80, width: 40, height: 30};
        createdCanvas.selectedElements = [{id: 'outside-source-viewport', tagName: 'rect', bbox}];

        const fitted = adapter.controls.fitToView();
        const expectedFit = Math.min(1000 / 600, 600 / 420) * 0.92;
        expect(fitted.zoom).toBeCloseTo(expectedFit, 6);
        expect(createdCanvas.selectorGeometry).toEqual({
            x: createdCanvas.contentGeometry.x + bbox.x * expectedFit,
            y: createdCanvas.contentGeometry.y + bbox.y * expectedFit,
            width: bbox.width * expectedFit,
            height: bbox.height * expectedFit
        });
        expect(createdCanvas.contentAttributes.overflow).toBe('visible');
        expect(createdCanvas.resolutions).toEqual([]);
    });

    test('exports off-viewport artwork tightly and shifts rotation center by the same source-origin translation', () => {
        let createdCanvas = null;
        class CapturingCanvas extends FakeSvgCanvas {
            constructor (...args) {
                super(...args);
                createdCanvas = this;
            }
        }
        const source = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><rect x="-20" y="10" width="100" height="40"/></svg>';
        const adapter = createSvgEditVectorBackendAdapter({SvgCanvasClass: CapturingCanvas});
        const binding = createPaintBackendBinding({descriptor: SVG_EDIT_VECTOR_BACKEND_DESCRIPTOR, implementation: adapter.implementation});
        binding.mount(makeContainer(), {});
        createdCanvas.modelAuthoredDom = true;
        adapter.controls.setWorkspaceContext({
            stageWidth: 480,
            stageHeight: 360,
            rotationCenterX: 32,
            rotationCenterY: 16
        });
        binding.load(createSvgEditVectorTransferFromWorkingCopy(makeWorkingCopy(source)));

        const exported = binding.exportTransfer();
        const metadata = adapter.controls.getExportMetadata();
        expect(exported.document.viewport).toEqual({width: 100, height: 40});
        expect(exported.contentEntries[0].content.text).toContain('translate(52 6)');
        expect(metadata).toMatchObject({
            rotationCenterX: 52,
            rotationCenterY: 6,
            sourceOriginX: -52,
            sourceOriginY: -6,
            normalizedArtwork: true
        });
        const edit = createWorkingCopyEditFromSvgEditTransfer(exported, metadata);
        expect(edit.rotationCenterX).toBe(52);
        expect(edit.rotationCenterY).toBe(6);
    });

    test('fits through SVG-Edit updateCanvas so document and selector layers share one coordinate system', () => {
        let createdCanvas = null;
        class CapturingCanvas extends FakeSvgCanvas {
            constructor (...args) {
                super(...args);
                createdCanvas = this;
            }
        }
        const source = '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="256"><path fill="currentColor" d="M0 0h64v64H0z"/></svg>';
        const adapter = createSvgEditVectorBackendAdapter({SvgCanvasClass: CapturingCanvas});
        const binding = createPaintBackendBinding({descriptor: SVG_EDIT_VECTOR_BACKEND_DESCRIPTOR, implementation: adapter.implementation});
        binding.mount(makeContainer({width: 1000, height: 600}), {});
        const transfer = createSvgEditVectorTransferFromWorkingCopy(makeWorkingCopy(source));
        binding.load(transfer);

        const update = createdCanvas.canvasUpdates[createdCanvas.canvasUpdates.length - 1];
        expect(update).toMatchObject({width: 1000, height: 600});
        expect(update.zoom).toBeCloseTo(Math.min(1000 / 512, 600 / 256) * 0.92, 6);
        expect(createdCanvas.rootAttributes.viewBox).toBeUndefined();
        expect(createdCanvas.rootAttributes.preserveAspectRatio).toBeUndefined();
        expect(createdCanvas.root.style).toMatchObject({
            color: '#000000',
            display: 'block',
            width: '100%',
            height: '100%',
            overflow: 'hidden'
        });
        expect(binding.exportTransfer().contentEntries[0].content.text).toBe(source);
    });

    test('refreshes selector geometry after fit zoom instead of scaling an independent overlay', () => {
        let createdCanvas = null;
        class CapturingCanvas extends FakeSvgCanvas {
            constructor (...args) {
                super(...args);
                createdCanvas = this;
            }
        }
        const adapter = createSvgEditVectorBackendAdapter({SvgCanvasClass: CapturingCanvas});
        const binding = createPaintBackendBinding({descriptor: SVG_EDIT_VECTOR_BACKEND_DESCRIPTOR, implementation: adapter.implementation});
        binding.mount(makeContainer({width: 640, height: 420}), {});
        binding.load(createSvgEditVectorTransferFromWorkingCopy(makeWorkingCopy()));
        createdCanvas.selectedElements = [{id: 'selected-shape'}];

        const result = binding.resize({width: 900, height: 600});
        expect(result).toMatchObject({width: 900, height: 600});
        expect(result.zoom).toBeCloseTo(Math.min(900 / 64, 600 / 32) * 0.92, 6);
        expect(createdCanvas.selectorResizeCount).toBe(1);
        expect(createdCanvas.pathZoomChangeCount).toBeGreaterThan(0);
        expect(createdCanvas.canvasUpdates[createdCanvas.canvasUpdates.length - 1]).toMatchObject({
            width: 900,
            height: 600,
            zoom: result.zoom
        });
    });

    test.each([
        ['25%', 0.25],
        ['50%', 0.5],
        ['100%', 1],
        ['200%', 2]
    ])('keeps selected object and selector aligned at manual zoom %s', (label, zoom) => {
        let createdCanvas = null;
        class CapturingCanvas extends FakeSvgCanvas {
            constructor (...args) {
                super(...args);
                createdCanvas = this;
            }
        }
        const adapter = createSvgEditVectorBackendAdapter({SvgCanvasClass: CapturingCanvas});
        const binding = createPaintBackendBinding({descriptor: SVG_EDIT_VECTOR_BACKEND_DESCRIPTOR, implementation: adapter.implementation});
        binding.mount(makeContainer({width: 800, height: 500}), {});
        binding.load(createSvgEditVectorTransferFromWorkingCopy(makeWorkingCopy()));
        const bbox = {x: 8, y: 4, width: 24, height: 12};
        createdCanvas.selectedElements = [{id: `selected-${label}`, bbox}];

        const viewport = adapter.controls.setZoom(zoom);
        const contentObjectGeometry = {
            x: createdCanvas.contentGeometry.x + bbox.x * zoom,
            y: createdCanvas.contentGeometry.y + bbox.y * zoom,
            width: bbox.width * zoom,
            height: bbox.height * zoom
        };

        expect(viewport).toMatchObject({width: 800, height: 500, zoom, zoomMode: VECTOR_ZOOM_MODES.MANUAL});
        expect(adapter.controls.getZoomState()).toMatchObject({mode: VECTOR_ZOOM_MODES.MANUAL, zoom});
        expect(createdCanvas.selectorGeometry).toEqual(contentObjectGeometry);
        expect(createdCanvas.rootAttributes.viewBox).toBeUndefined();
        expect(createdCanvas.rootAttributes.preserveAspectRatio).toBeUndefined();
    });

    test('Fit returns to shared SVG-Edit geometry after every permanent manual zoom preset', () => {
        let createdCanvas = null;
        class CapturingCanvas extends FakeSvgCanvas {
            constructor (...args) {
                super(...args);
                createdCanvas = this;
            }
        }
        const adapter = createSvgEditVectorBackendAdapter({SvgCanvasClass: CapturingCanvas});
        const binding = createPaintBackendBinding({descriptor: SVG_EDIT_VECTOR_BACKEND_DESCRIPTOR, implementation: adapter.implementation});
        binding.mount(makeContainer({width: 1000, height: 600}), {});
        binding.load(createSvgEditVectorTransferFromWorkingCopy(makeWorkingCopy()));
        createdCanvas.selectedElements = [{id: 'fit-selected', bbox: {x: 8, y: 4, width: 24, height: 12}}];

        VECTOR_ZOOM_PRESETS.forEach(zoom => adapter.controls.setZoom(zoom));
        const fitted = adapter.controls.fitToView();
        const expectedFit = Math.min(1000 / 64, 600 / 32) * 0.92;

        expect(VECTOR_ZOOM_PRESETS).toEqual([0.25, 0.5, 1, 2]);
        expect(fitted).toMatchObject({width: 1000, height: 600, zoomMode: VECTOR_ZOOM_MODES.FIT});
        expect(fitted.zoom).toBeCloseTo(expectedFit, 6);
        expect(adapter.controls.getZoomState()).toMatchObject({mode: VECTOR_ZOOM_MODES.FIT});
        expect(createdCanvas.selectorGeometry).toEqual({
            x: createdCanvas.contentGeometry.x + 8 * expectedFit,
            y: createdCanvas.contentGeometry.y + 4 * expectedFit,
            width: 24 * expectedFit,
            height: 12 * expectedFit
        });
    });

    test('host resize preserves manual zoom and only recomputes viewport centering', () => {
        let createdCanvas = null;
        class CapturingCanvas extends FakeSvgCanvas {
            constructor (...args) {
                super(...args);
                createdCanvas = this;
            }
        }
        const adapter = createSvgEditVectorBackendAdapter({SvgCanvasClass: CapturingCanvas});
        const binding = createPaintBackendBinding({descriptor: SVG_EDIT_VECTOR_BACKEND_DESCRIPTOR, implementation: adapter.implementation});
        binding.mount(makeContainer({width: 640, height: 420}), {});
        binding.load(createSvgEditVectorTransferFromWorkingCopy(makeWorkingCopy()));
        adapter.controls.setZoom(0.5);

        const resized = binding.resize({width: 960, height: 540});
        expect(resized).toMatchObject({width: 960, height: 540, zoom: 0.5, zoomMode: VECTOR_ZOOM_MODES.MANUAL});
        expect(createdCanvas.getResolution()).toMatchObject({w: 64, h: 32, zoom: 0.5});
        expect(createdCanvas.resolutions).toEqual([]);
    });

    test('resize remains presentation-only and never writes container size or document resolution', () => {
        let createdCanvas = null;
        class CapturingCanvas extends FakeSvgCanvas {
            constructor (...args) {
                super(...args);
                createdCanvas = this;
            }
        }
        const adapter = createSvgEditVectorBackendAdapter({SvgCanvasClass: CapturingCanvas});
        const binding = createPaintBackendBinding({descriptor: SVG_EDIT_VECTOR_BACKEND_DESCRIPTOR, implementation: adapter.implementation});
        const container = makeContainer();
        binding.mount(container, {});
        binding.load(createSvgEditVectorTransferFromWorkingCopy(makeWorkingCopy()));
        expect(createdCanvas.resolutions).toEqual([]);
        binding.resize({width: 900, height: 600});
        expect(createdCanvas.resolutions).toEqual([]);
        expect(container.style.width).toBeUndefined();
        expect(container.style.height).toBeUndefined();
        expect(createdCanvas.canvasUpdates[createdCanvas.canvasUpdates.length - 1]).toMatchObject({width: 900, height: 600});
    });

    test('Hand pan offsets svgcontent and selectorParentGroup together without changing document resolution', () => {
        let createdCanvas = null;
        class CapturingCanvas extends FakeSvgCanvas {
            constructor (...args) {
                super(...args);
                createdCanvas = this;
            }
        }
        const adapter = createSvgEditVectorBackendAdapter({SvgCanvasClass: CapturingCanvas});
        const binding = createPaintBackendBinding({descriptor: SVG_EDIT_VECTOR_BACKEND_DESCRIPTOR, implementation: adapter.implementation});
        binding.mount(makeContainer({width: 800, height: 500}), {});
        binding.load(createSvgEditVectorTransferFromWorkingCopy(makeWorkingCopy()));
        const bbox = {x: 8, y: 4, width: 24, height: 12};
        createdCanvas.selectedElements = [{id: 'pan-shape', tagName: 'rect', bbox}];
        adapter.controls.setZoom(1);

        const panned = adapter.controls.panBy(40, -20);
        const objectGeometry = {
            x: createdCanvas.contentGeometry.x + bbox.x,
            y: createdCanvas.contentGeometry.y + bbox.y,
            width: bbox.width,
            height: bbox.height
        };
        expect(panned.pan).toEqual({x: 40, y: -20});
        expect(adapter.controls.getZoomState()).toMatchObject({
            mode: VECTOR_ZOOM_MODES.MANUAL,
            zoom: 1,
            pan: {x: 40, y: -20}
        });
        expect(createdCanvas.selectorGeometry).toEqual(objectGeometry);
        expect(createdCanvas.resolutions).toEqual([]);

        const fitted = adapter.controls.fitToView();
        expect(fitted.pan).toEqual({x: 0, y: 0});
        expect(adapter.controls.getZoomState().mode).toBe(VECTOR_ZOOM_MODES.FIT);
    });

    test('exposes NGVGE-owned professional vector tools and commands without backend-private identities', () => {
        expect(VECTOR_PAINT_TOOLS).toEqual(expect.arrayContaining([
            'select', 'direct-select', 'path', 'text', 'zoom'
        ]));
        expect(VECTOR_PAINT_COMMANDS).toEqual(expect.arrayContaining([
            'delete', 'copy', 'paste', 'duplicate', 'group', 'ungroup',
            'bring-forward', 'send-backward', 'bring-front', 'send-back',
            'move-selection', 'path-delete-anchor', 'path-segment-line', 'path-segment-curve'
        ]));
        expect(VECTOR_PAINT_COMMANDS.some(command => /resource|project|frame|layer-id/i.test(command))).toBe(false);
    });

    test('routes object editing commands through SVG-Edit operations and guards no-selection mutations', () => {
        let createdCanvas = null;
        class CapturingCanvas extends FakeSvgCanvas {
            constructor (...args) {
                super(...args);
                createdCanvas = this;
            }
        }
        const adapter = createSvgEditVectorBackendAdapter({SvgCanvasClass: CapturingCanvas});
        const binding = createPaintBackendBinding({descriptor: SVG_EDIT_VECTOR_BACKEND_DESCRIPTOR, implementation: adapter.implementation});
        binding.mount(makeContainer(), {});
        binding.load(createSvgEditVectorTransferFromWorkingCopy(makeWorkingCopy()));

        adapter.controls.runCommand('delete');
        expect(createdCanvas.commandCalls).toEqual([]);
        expect(binding.getHistoryState().dirty).toBe(false);

        createdCanvas.selectedElements = [
            {id: 'a', tagName: 'rect'},
            {id: 'b', tagName: 'path'}
        ];
        adapter.controls.runCommand('copy');
        adapter.controls.runCommand('duplicate', {offset: 7});
        adapter.controls.runCommand('group');
        adapter.controls.runCommand('bring-forward');
        adapter.controls.runCommand('send-backward');
        adapter.controls.runCommand('bring-front');
        adapter.controls.runCommand('send-back');
        adapter.controls.runCommand('move-selection', {dx: 3, dy: -2});

        expect(createdCanvas.commandCalls).toEqual(expect.arrayContaining([
            ['copySelectedElements'],
            ['cloneSelectedElements', 7, 7],
            ['groupSelectedElements'],
            ['moveUpDownSelected', 'Up'],
            ['moveUpDownSelected', 'Down'],
            ['moveToTopSelectedElement'],
            ['moveToBottomSelectedElement'],
            ['moveSelectedElements', 3, -2, true]
        ]));
        expect(binding.getHistoryState().dirty).toBe(true);
    });

    test('enters Direct Selection only for paths and routes path-node operations through pathActions', () => {
        let createdCanvas = null;
        class CapturingCanvas extends FakeSvgCanvas {
            constructor (...args) {
                super(...args);
                createdCanvas = this;
            }
        }
        const adapter = createSvgEditVectorBackendAdapter({SvgCanvasClass: CapturingCanvas});
        const binding = createPaintBackendBinding({descriptor: SVG_EDIT_VECTOR_BACKEND_DESCRIPTOR, implementation: adapter.implementation});
        binding.mount(makeContainer(), {});
        binding.load(createSvgEditVectorTransferFromWorkingCopy(makeWorkingCopy()));

        createdCanvas.selectedElements = [{id: 'path-1', tagName: 'path'}];
        expect(adapter.controls.setTool('direct-select')).toBe('direct-select');
        expect(adapter.controls.getSelectionState()).toMatchObject({canDirectSelect: true, directEditing: true});

        adapter.controls.runCommand('path-duplicate-anchor');
        adapter.controls.runCommand('path-delete-anchor');
        adapter.controls.runCommand('path-segment-line');
        adapter.controls.runCommand('path-segment-curve');
        adapter.controls.runCommand('path-open-close');
        adapter.controls.runCommand('path-link-controls', {linked: false});

        expect(createdCanvas.commandCalls).toEqual(expect.arrayContaining([
            ['path.toEditMode', 'path-1'],
            ['path.clonePathNode'],
            ['path.deletePathNode'],
            ['path.setSegType', 4],
            ['path.setSegType', 6],
            ['path.opencloseSubPath'],
            ['path.linkControlPoints', false]
        ]));

        adapter.controls.runCommand('clear-selection');
        expect(adapter.controls.getTool()).toBe('select');
        expect(createdCanvas.getMode()).toBe('select');
    });

    test('guards path commands outside pathedit mode instead of calling SVG-Edit with an empty path', () => {
        let createdCanvas = null;
        class CapturingCanvas extends FakeSvgCanvas {
            constructor (...args) {
                super(...args);
                createdCanvas = this;
            }
        }
        const adapter = createSvgEditVectorBackendAdapter({SvgCanvasClass: CapturingCanvas});
        const binding = createPaintBackendBinding({descriptor: SVG_EDIT_VECTOR_BACKEND_DESCRIPTOR, implementation: adapter.implementation});
        binding.mount(makeContainer(), {});
        binding.load(createSvgEditVectorTransferFromWorkingCopy(makeWorkingCopy()));
        adapter.controls.runCommand('path-delete-anchor');
        expect(createdCanvas.commandCalls).toEqual([]);
        expect(binding.getHistoryState().dirty).toBe(false);
    });

    test('rejects backend-private vector tool names', () => {
        const adapter = createSvgEditVectorBackendAdapter({SvgCanvasClass: FakeSvgCanvas});
        const binding = createPaintBackendBinding({descriptor: SVG_EDIT_VECTOR_BACKEND_DESCRIPTOR, implementation: adapter.implementation});
        binding.mount(makeContainer(), {});
        binding.load(createSvgEditVectorTransferFromWorkingCopy(makeWorkingCopy()));
        expect(() => adapter.controls.setTool('piskel-frame-tool')).toThrow(/Unsupported NGVGE vector tool/);
    });
});
