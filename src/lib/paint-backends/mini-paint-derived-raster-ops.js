/*
 * WS-10G1 controlled extraction/adaptation from miniPaint flood-fill behavior.
 * Upstream: viliusle/miniPaint @ a79733eb803fc97084ef0ee4faa96b031e69e1c0
 * Reference: src/js/tools/fill.js
 * License: MIT. See docs/third-party/WS-10G1-MINIPAINT-NOTICE.md.
 *
 * The upstream App/State/Layer authority is intentionally not copied. Only the
 * portable pixel operation is retained behind NGVGE's Raster backend adapter.
 */

const MINI_PAINT_DERIVED_RASTER_OPS_ID = 'ngvge.raster-ops.minipaint-derived@1';

const clampByte = value => Math.max(0, Math.min(255, Math.round(Number(value) || 0)));

const normalizeRgba = color => Object.freeze({
    r: clampByte(color && color.r),
    g: clampByte(color && color.g),
    b: clampByte(color && color.b),
    a: typeof (color && color.a) === 'undefined' ? 255 : clampByte(color.a)
});

const assertImageDataLike = imageData => {
    if (!imageData || !Number.isInteger(imageData.width) || imageData.width < 1 ||
        !Number.isInteger(imageData.height) || imageData.height < 1 ||
        !imageData.data || typeof imageData.data.length !== 'number' ||
        imageData.data.length !== imageData.width * imageData.height * 4) {
        throw new TypeError('Raster pixel operation requires ImageData-like RGBA bytes.');
    }
    return imageData;
};

const colorAt = (bytes, index) => ({
    r: bytes[index],
    g: bytes[index + 1],
    b: bytes[index + 2],
    a: bytes[index + 3]
});

const withinTolerance = (bytes, index, source, tolerance) => (
    Math.abs(bytes[index] - source.r) <= tolerance &&
    Math.abs(bytes[index + 1] - source.g) <= tolerance &&
    Math.abs(bytes[index + 2] - source.b) <= tolerance &&
    Math.abs(bytes[index + 3] - source.a) <= tolerance
);

const writeColor = (bytes, index, color) => {
    bytes[index] = color.r;
    bytes[index + 1] = color.g;
    bytes[index + 2] = color.b;
    bytes[index + 3] = color.a;
};

const sampleRasterPixel = (imageData, x, y) => {
    const image = assertImageDataLike(imageData);
    const px = Math.floor(Number(x));
    const py = Math.floor(Number(y));
    if (!Number.isFinite(px) || !Number.isFinite(py) || px < 0 || py < 0 ||
        px >= image.width || py >= image.height) return null;
    return Object.freeze(colorAt(image.data, ((py * image.width) + px) * 4));
};

/**
 * miniPaint-derived stack flood fill with NGVGE-owned inputs/outputs.
 * Mutates only the supplied ImageData-like byte buffer and returns whether bytes changed.
 */
const floodFillRaster = (imageData, {
    x,
    y,
    color,
    tolerance = 0,
    contiguous = true
}) => {
    const image = assertImageDataLike(imageData);
    const px = Math.floor(Number(x));
    const py = Math.floor(Number(y));
    if (!Number.isFinite(px) || !Number.isFinite(py) || px < 0 || py < 0 ||
        px >= image.width || py >= image.height) return false;

    const target = normalizeRgba(color);
    const threshold = Math.max(0, Math.min(255, Math.round(Number(tolerance) || 0)));
    const start = ((py * image.width) + px) * 4;
    const source = colorAt(image.data, start);
    if (source.r === target.r && source.g === target.g && source.b === target.b && source.a === target.a) {
        return false;
    }

    const bytes = image.data;
    if (!contiguous) {
        let changed = false;
        for (let index = 0; index < bytes.length; index += 4) {
            if (withinTolerance(bytes, index, source, threshold)) {
                writeColor(bytes, index, target);
                changed = true;
            }
        }
        return changed;
    }

    // Mark visitation separately so transparent pixels and RGBA 0 values are unambiguous.
    const visited = new Uint8Array(image.width * image.height);
    const stack = [[px, py]];
    let changed = false;
    while (stack.length) {
        const point = stack.pop();
        const cx = point[0];
        const cy = point[1];
        if (cx < 0 || cy < 0 || cx >= image.width || cy >= image.height) continue;
        const pixelIndex = (cy * image.width) + cx;
        if (visited[pixelIndex]) continue;
        visited[pixelIndex] = 1;
        const byteIndex = pixelIndex * 4;
        if (!withinTolerance(bytes, byteIndex, source, threshold)) continue;
        writeColor(bytes, byteIndex, target);
        changed = true;
        stack.push([cx, cy - 1], [cx - 1, cy], [cx + 1, cy], [cx, cy + 1]);
    }
    return changed;
};

export {
    MINI_PAINT_DERIVED_RASTER_OPS_ID,
    normalizeRgba,
    sampleRasterPixel,
    floodFillRaster
};
