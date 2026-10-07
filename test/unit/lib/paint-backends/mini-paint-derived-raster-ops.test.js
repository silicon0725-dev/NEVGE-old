import {
    MINI_PAINT_DERIVED_RASTER_OPS_ID,
    floodFillRaster,
    sampleRasterPixel
} from '../../../../src/lib/paint-backends/mini-paint-derived-raster-ops';

const image = (width, height, pixels) => ({
    width,
    height,
    data: new Uint8ClampedArray(pixels.flat())
});

const rgba = (r, g, b, a = 255) => [r, g, b, a];

const at = (value, x, y) => Array.from(value.data.slice(((y * value.width) + x) * 4, ((y * value.width) + x + 1) * 4));

describe('WS-10G1 miniPaint-derived portable raster operations', () => {
    test('pins the controlled extraction identity', () => {
        expect(MINI_PAINT_DERIVED_RASTER_OPS_ID).toBe('ngvge.raster-ops.minipaint-derived@1');
    });

    test('contiguous flood fill does not cross a separator', () => {
        const value = image(3, 3, [
            rgba(10, 10, 10), rgba(0, 0, 0), rgba(10, 10, 10),
            rgba(10, 10, 10), rgba(0, 0, 0), rgba(10, 10, 10),
            rgba(10, 10, 10), rgba(0, 0, 0), rgba(10, 10, 10)
        ]);
        expect(floodFillRaster(value, {x: 0, y: 1, color: {r: 255, g: 0, b: 0, a: 255}, contiguous: true})).toBe(true);
        expect(at(value, 0, 0)).toEqual(rgba(255, 0, 0));
        expect(at(value, 2, 0)).toEqual(rgba(10, 10, 10));
        expect(at(value, 1, 1)).toEqual(rgba(0, 0, 0));
    });

    test('non-contiguous fill replaces matching pixels globally', () => {
        const value = image(3, 1, [rgba(20, 20, 20), rgba(1, 1, 1), rgba(20, 20, 20)]);
        floodFillRaster(value, {x: 0, y: 0, color: {r: 0, g: 255, b: 0, a: 255}, contiguous: false});
        expect(at(value, 0, 0)).toEqual(rgba(0, 255, 0));
        expect(at(value, 2, 0)).toEqual(rgba(0, 255, 0));
    });

    test('tolerance and eyedropper sampling are deterministic', () => {
        const value = image(2, 1, [rgba(100, 100, 100), rgba(104, 103, 102)]);
        floodFillRaster(value, {x: 0, y: 0, color: {r: 12, g: 34, b: 56, a: 255}, tolerance: 5, contiguous: true});
        expect(at(value, 1, 0)).toEqual(rgba(12, 34, 56));
        expect(sampleRasterPixel(value, 1, 0)).toEqual({r: 12, g: 34, b: 56, a: 255});
        expect(sampleRasterPixel(value, 9, 9)).toBeNull();
    });
});
