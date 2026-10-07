import {
    expandRasterStorageBounds,
    projectPointToRasterPixel,
    rasterPixelToProjectPoint
} from '../../../../src/lib/vendor/scratch-paint/src/helper/raster-workspace';

describe('WS-10P0M-HF1 Scratch Paint bitmap unclamp geometry', () => {
    test('large bitmap may expand beyond every side of the 960x720 stage backing area', () => {
        const expanded = expandRasterStorageBounds(
            {left: 0, top: 0, width: 960, height: 720},
            {left: -520, top: -240, width: 2000, height: 1200}
        );
        expect(expanded).toEqual({
            left: -520,
            top: -240,
            right: 1480,
            bottom: 960,
            width: 2000,
            height: 1200,
            oldPixelOffsetX: 520,
            oldPixelOffsetY: 240
        });
    });

    test('content already inside the backing raster does not resize storage', () => {
        const expanded = expandRasterStorageBounds(
            {left: -20, top: -10, width: 1000, height: 750},
            {left: 10, top: 10, width: 100, height: 100}
        );
        expect(expanded.left).toBe(-20);
        expect(expanded.top).toBe(-10);
        expect(expanded.width).toBe(1000);
        expect(expanded.height).toBe(750);
        expect(expanded.oldPixelOffsetX).toBe(0);
        expect(expanded.oldPixelOffsetY).toBe(0);
    });

    test('project/raster coordinate conversion remains reversible for negative storage origin', () => {
        const bounds = {left: -520, top: -240};
        const projectPoint = {x: -123, y: 451};
        const pixel = projectPointToRasterPixel(projectPoint, bounds);
        expect(pixel).toEqual({x: 397, y: 691});
        expect(rasterPixelToProjectPoint(pixel, bounds)).toEqual(projectPoint);
    });

    test('padding reserves room for brush radius without moving existing pixels', () => {
        const expanded = expandRasterStorageBounds(
            {left: 0, top: 0, width: 960, height: 720},
            {left: -2, top: 100, width: 1, height: 1},
            8
        );
        expect(expanded.left).toBe(-10);
        expect(expanded.oldPixelOffsetX).toBe(10);
        expect(expanded.right).toBe(960);
    });
});
