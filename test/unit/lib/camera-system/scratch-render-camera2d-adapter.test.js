const {EventEmitter} = require('events');
const twgl = require('twgl.js');
const {
    CAMERA2D_RENDER_ADAPTER_ID,
    createScratchRenderCamera2DAdapter
} = require('../../../../src/lib/camera-system');

const makeRenderer = () => {
    const renderer = new EventEmitter();
    renderer.exports = {twgl};
    renderer._nativeSize = [480, 360];
    renderer._xLeft = -240;
    renderer._xRight = 240;
    renderer._yBottom = -180;
    renderer._yTop = 180;
    renderer._projection = twgl.m4.ortho(-240, 240, -180, 180, -1, 1);
    renderer.offscreenDrawableCulling = true;
    renderer.requestRedraw = jest.fn();
    renderer.dirty = false;
    return renderer;
};

describe('WS-10N4 Scratch render Camera2D adapter', () => {
    test('changes the renderer projection instead of mutating drawables and disables native stage culling', () => {
        const renderer = makeRenderer();
        const adapter = createScratchRenderCamera2DAdapter(renderer);
        const baseline = Array.from(renderer._projection);
        expect(adapter.adapterId).toBe(CAMERA2D_RENDER_ADAPTER_ID);
        adapter.applyViewport({
            activeCameraNodeId: 'camera-a',
            offset: [0, 0],
            position: [120, 0],
            rotation: 0,
            zoom: [2, 2]
        });
        expect(Array.from(renderer._projection)).not.toEqual(baseline);
        expect(renderer.offscreenDrawableCulling).toBe(false);
        expect(renderer.dirty).toBe(true);
        expect(renderer.requestRedraw).toHaveBeenCalled();
        expect(renderer.updateDrawablePosition).toBeUndefined();
        adapter.dispose();
    });

    test('maps camera center to clip-space origin through the projection', () => {
        const renderer = makeRenderer();
        const adapter = createScratchRenderCamera2DAdapter(renderer);
        adapter.applyViewport({
            activeCameraNodeId: 'camera-a',
            offset: [5, -10],
            position: [35, 20],
            rotation: 0,
            zoom: [1, 1]
        });
        const clip = twgl.m4.transformPoint(renderer._projection, [40, 10, 0]);
        expect(clip[0]).toBeCloseTo(0, 8);
        expect(clip[1]).toBeCloseTo(0, 8);
        adapter.dispose();
    });

    test('restores Scratch baseline projection and culling when no Camera2D is active', () => {
        const renderer = makeRenderer();
        const adapter = createScratchRenderCamera2DAdapter(renderer);
        const baseline = Array.from(renderer._projection);
        adapter.applyViewport({activeCameraNodeId: 'camera-a', offset: [0, 0], position: [0, 0], rotation: 20, zoom: [3, 2]});
        adapter.applyViewport({activeCameraNodeId: null, offset: [0, 0], position: [0, 0], rotation: 0, zoom: [1, 1]});
        expect(Array.from(renderer._projection)).toEqual(baseline);
        expect(renderer.offscreenDrawableCulling).toBe(true);
        adapter.dispose();
    });

    test('reapplies an active camera after Scratch native-size changes and disposes cleanly', () => {
        const renderer = makeRenderer();
        const adapter = createScratchRenderCamera2DAdapter(renderer);
        adapter.applyViewport({activeCameraNodeId: 'camera-a', offset: [0, 0], position: [0, 0], rotation: 0, zoom: [2, 2]});
        const before = adapter.getStatus().applyCount;
        renderer._nativeSize = [640, 480];
        renderer._xLeft = -320;
        renderer._xRight = 320;
        renderer._yBottom = -240;
        renderer._yTop = 240;
        renderer.emit('NativeSizeChanged');
        expect(adapter.getStatus().applyCount).toBe(before + 1);
        adapter.dispose();
        expect(adapter.getStatus().disposed).toBe(true);
        expect(renderer.offscreenDrawableCulling).toBe(true);
    });
});
