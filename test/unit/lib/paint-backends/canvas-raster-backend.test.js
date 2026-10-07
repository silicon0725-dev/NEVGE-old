import {createPaintBackendBinding} from '../../../../src/lib/paint-backends/paint-backend-contract';
import {
    BITMAP_RASTER_BACKEND_DESCRIPTOR,
    BITMAP_RASTER_TOOLS,
    CANVAS_RASTER_BACKEND_ADAPTER_ID,
    RASTER_ZOOM_PRESETS,
    createCanvasRasterBackendAdapter
} from '../../../../src/lib/paint-backends/canvas-raster-backend';
import {createStaticBitmapTransferFromWorkingCopy} from '../../../../src/lib/paint-backends/canvas-raster-transfer';

const RESOURCE_ID = 'ngvge:resource:11111111-1111-4111-8111-111111111111';
const workingCopy = {
    workingCopyId: 'ngvge.workspace-paint-working-copy.bitmap',
    resourceId: RESOURCE_ID,
    dataFormat: 'png',
    content: {kind: 'data-uri', dataUri: 'data:image/png;base64,AAAA'}
};

class FakeElement {
    constructor (tag) {
        this.tagName = tag.toUpperCase();
        this.style = {};
        this.children = [];
        this.attributes = {};
        this.clientWidth = 640;
        this.clientHeight = 420;
        this.listeners = new Map();
        this.parentNode = null;
    }
    setAttribute (name, value) { this.attributes[name] = String(value); }
    getAttribute (name) { return this.attributes[name]; }
    appendChild (child) { child.parentNode = this; this.children.push(child); return child; }
    removeChild (child) { this.children = this.children.filter(item => item !== child); child.parentNode = null; }
    addEventListener (name, listener) { this.listeners.set(name, listener); }
    removeEventListener (name) { this.listeners.delete(name); }
    getBoundingClientRect () { return {left: 0, top: 0, width: this.clientWidth, height: this.clientHeight}; }
    focus () { this.focused = true; }
}

class FakeCanvasContext {
    constructor (canvas) {
        this.canvas = canvas;
        this._data = new Uint8ClampedArray(4);
        this.translateCalls = [];
        this.scaleCalls = [];
    }
    ensure () {
        const size = Math.max(1, this.canvas.width * this.canvas.height * 4);
        if (this._data.length !== size) this._data = new Uint8ClampedArray(size);
    }
    clearRect () { this.ensure(); this._data.fill(0); }
    drawImage () { this.ensure(); this._data.fill(17); }
    getImageData (x, y, width, height) {
        this.ensure();
        return {width, height, data: new Uint8ClampedArray(this._data)};
    }
    createImageData (width, height) { return {width, height, data: new Uint8ClampedArray(width * height * 4)}; }
    putImageData (image) { this._data = new Uint8ClampedArray(image.data); }
    save () {}
    restore () {}
    setTransform () {}
    translate (x, y) { this.translateCalls.push([x, y]); }
    scale (x, y) { this.scaleCalls.push([x, y]); }
    strokeRect () {}
    beginPath () {}
    arc () {}
    fill () {}
    moveTo () {}
    lineTo () {}
    stroke () {}
}

class FakeCanvas extends FakeElement {
    constructor () {
        super('canvas');
        this.width = 1;
        this.height = 1;
        this.context = new FakeCanvasContext(this);
    }
    getContext () { return this.context; }
    toDataURL () { return 'data:image/png;base64,EXPORTED'; }
    setPointerCapture () {}
}

class FakeDocument {
    createElement (tag) { return tag === 'canvas' ? new FakeCanvas() : new FakeElement(tag); }
}

class FakeImage {
    set src (value) { this._src = value; if (this.onload) this.onload(); }
}

describe('WS-10G1 Canvas Raster backend', () => {
    test('stays behind PaintBackendContract and preserves semantic identity', () => {
        const adapter = createCanvasRasterBackendAdapter({documentRef: new FakeDocument(), ImageClass: FakeImage});
        expect(adapter.adapterId).toBe(CANVAS_RASTER_BACKEND_ADAPTER_ID);
        expect(BITMAP_RASTER_BACKEND_DESCRIPTOR.kind).toBe('bitmap');
        expect(BITMAP_RASTER_TOOLS).toEqual(['brush', 'eraser', 'fill', 'eyedropper', 'hand', 'zoom']);
        expect(RASTER_ZOOM_PRESETS).toEqual([0.25, 0.5, 1, 2]);

        const binding = createPaintBackendBinding({
            descriptor: BITMAP_RASTER_BACKEND_DESCRIPTOR,
            implementation: adapter.implementation
        });
        const root = new FakeElement('div');
        root.clientWidth = 800;
        root.clientHeight = 600;
        binding.mount(root, {width: 800, height: 600});
        adapter.controls.setWorkspaceContext({
            stageWidth: 480,
            stageHeight: 360,
            rotationCenterX: 16,
            rotationCenterY: 8,
            bitmapResolution: 2
        });
        const transfer = createStaticBitmapTransferFromWorkingCopy(workingCopy, {width: 32, height: 16});
        binding.load(transfer);
        binding.setActiveTarget(transfer.activeTarget);

        expect(adapter.controls.getState().ready).toBe(true);
        expect(adapter.controls.setZoom(0.25)).toEqual(expect.objectContaining({mode: 'manual', zoom: 0.25}));
        expect(adapter.controls.setZoom(2)).toEqual(expect.objectContaining({mode: 'manual', zoom: 2}));
        expect(adapter.controls.fitToView().mode).toBe('fit');
        expect(adapter.controls.panBy(15, -10).pan).toEqual({x: 15, y: -10});
        expect(adapter.controls.setTool('fill')).toBe('fill');

        const exported = binding.exportTransfer();
        expect(exported.document.documentId).toBe(transfer.document.documentId);
        expect(exported.document.resourceId).toBe(RESOURCE_ID);
        expect(exported.contentEntries[0].content.dataUri).toBe('data:image/png;base64,EXPORTED');
        expect(root.children[0].getAttribute('data-ngvge-raster-viewport')).toBe('true');
        expect(root.children[0].getAttribute('data-ngvge-raster-camera-authority')).toBe('compositor');
        expect(root.children[0].children[0].getAttribute('data-ngvge-raster-canvas-role')).toBe('viewport-compositor');
        expect(adapter.controls.getWorkspaceState().viewport).toEqual({width: 800, height: 600});
        binding.dispose();
    });


    test('centers asymmetric artwork plus stage in Fit and keeps zoom/pan on one compositor camera', () => {
        const adapter = createCanvasRasterBackendAdapter({documentRef: new FakeDocument(), ImageClass: FakeImage});
        const binding = createPaintBackendBinding({
            descriptor: BITMAP_RASTER_BACKEND_DESCRIPTOR,
            implementation: adapter.implementation
        });
        const root = new FakeElement('div');
        root.clientWidth = 800;
        root.clientHeight = 600;
        binding.mount(root, {width: 800, height: 600});
        adapter.controls.setWorkspaceContext({
            stageWidth: 480,
            stageHeight: 360,
            rotationCenterX: 100,
            rotationCenterY: 100,
            bitmapResolution: 2
        });
        const transfer = createStaticBitmapTransferFromWorkingCopy(workingCopy, {width: 1200, height: 500});
        binding.load(transfer);
        binding.setActiveTarget(transfer.activeTarget);

        const fit = adapter.controls.getZoomState();
        const expectedFitZoom = (800 * 0.9) / 1580;
        expect(fit.mode).toBe('fit');
        expect(fit.zoom).toBeCloseTo(expectedFitZoom, 6);
        expect(fit.pan.x).toBeCloseTo(-310 * expectedFitZoom, 6);
        expect(fit.pan.y).toBeCloseTo(-20 * expectedFitZoom, 6);

        const displayCanvas = adapter.controls.getCanvas();
        const surfaceCanvas = adapter.controls.getSurfaceCanvas();
        expect(displayCanvas).not.toBe(surfaceCanvas);
        expect(displayCanvas.width).toBe(800);
        expect(displayCanvas.height).toBe(600);
        expect(surfaceCanvas.width).toBe(1200);
        expect(surfaceCanvas.height).toBe(500);

        const renderContext = displayCanvas.context;
        const lastTranslations = renderContext.translateCalls.slice(-2);
        const lastScales = renderContext.scaleCalls.slice(-2);
        expect(lastTranslations).toHaveLength(2);
        expect(lastTranslations[0]).toEqual(lastTranslations[1]);
        expect(lastScales).toHaveLength(2);
        expect(lastScales[0]).toEqual(lastScales[1]);

        adapter.controls.setTool('eyedropper');
        const originScreen = {
            clientX: 400 + fit.pan.x,
            clientY: 300 + fit.pan.y,
            preventDefault: jest.fn(),
            pointerId: 7
        };
        displayCanvas.listeners.get('pointerdown')(originScreen);
        expect(adapter.controls.getColor()).toEqual({r: 17, g: 17, b: 17, a: 17});

        for (const zoom of RASTER_ZOOM_PRESETS) {
            const manual = adapter.controls.setZoom(zoom);
            expect(manual.mode).toBe('manual');
            expect(manual.zoom).toBe(zoom);
            expect(manual.pan.x / zoom).toBeCloseTo(-310, 6);
            expect(manual.pan.y / zoom).toBeCloseTo(-20, 6);
        }

        adapter.controls.fitToView();
        root.clientWidth = 1000;
        root.clientHeight = 700;
        binding.resize({width: 1000, height: 700});
        expect(adapter.controls.getWorkspaceState().viewport).toEqual({width: 1000, height: 700});
        expect(adapter.controls.getCanvas().width).toBe(1000);
        expect(adapter.controls.getCanvas().height).toBe(700);
        binding.dispose();
    });

    test('expands authored raster storage beyond the imported PNG without moving the world camera', () => {
        const adapter = createCanvasRasterBackendAdapter({documentRef: new FakeDocument(), ImageClass: FakeImage});
        const binding = createPaintBackendBinding({
            descriptor: BITMAP_RASTER_BACKEND_DESCRIPTOR,
            implementation: adapter.implementation
        });
        const root = new FakeElement('div');
        root.clientWidth = 800;
        root.clientHeight = 600;
        binding.mount(root, {width: 800, height: 600});
        adapter.controls.setWorkspaceContext({
            stageWidth: 480,
            stageHeight: 360,
            rotationCenterX: 16,
            rotationCenterY: 8,
            bitmapResolution: 2
        });
        const transfer = createStaticBitmapTransferFromWorkingCopy(workingCopy, {width: 32, height: 16});
        binding.load(transfer);
        binding.setActiveTarget(transfer.activeTarget);
        adapter.controls.setZoom(1);

        const before = adapter.controls.getWorkspaceState();
        expect(before.surface.bounds).toEqual({left: -16, top: -8, right: 16, bottom: 8});
        expect(before.surface.rotationCenter).toEqual({x: 16, y: 8});
        const cameraBefore = adapter.controls.getZoomState();

        const displayCanvas = adapter.controls.getCanvas();
        displayCanvas.listeners.get('pointerdown')({
            clientX: 400 - 100,
            clientY: 300 - 60,
            pointerId: 12,
            preventDefault: jest.fn()
        });
        displayCanvas.listeners.get('pointerup')({preventDefault: jest.fn()});

        const expanded = adapter.controls.getWorkspaceState();
        expect(expanded.surface.width).toBeGreaterThan(32);
        expect(expanded.surface.height).toBeGreaterThan(16);
        expect(expanded.surface.bounds.left).toBeLessThanOrEqual(-104);
        expect(expanded.surface.bounds.top).toBeLessThanOrEqual(-64);
        expect(expanded.surface.rotationCenter.x).toBe(-expanded.surface.origin.x);
        expect(expanded.surface.rotationCenter.y).toBe(-expanded.surface.origin.y);
        expect(adapter.controls.getZoomState()).toEqual(cameraBefore);

        const exported = binding.exportTransfer();
        expect(exported.document.canvas.width).toBe(expanded.surface.width);
        expect(exported.document.canvas.height).toBe(expanded.surface.height);

        expect(binding.undo()).toBe(true);
        const restored = adapter.controls.getWorkspaceState();
        expect(restored.surface.width).toBe(32);
        expect(restored.surface.height).toBe(16);
        expect(restored.surface.origin).toEqual({x: -16, y: -8});
        expect(restored.surface.rotationCenter).toEqual({x: 16, y: 8});
        binding.dispose();
    });

    test('rejects tools outside the G1 Bitmap capability set', () => {
        const adapter = createCanvasRasterBackendAdapter({documentRef: new FakeDocument(), ImageClass: FakeImage});
        adapter.implementation.mount(new FakeElement('div'), {});
        expect(() => adapter.controls.setTool('path')).toThrow(/Unsupported Bitmap tool/);
    });
});
