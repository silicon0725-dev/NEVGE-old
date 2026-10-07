/**
 * Pure geometry helpers for NGVGE's unclamped Scratch Paint bitmap workspace.
 * These helpers intentionally contain no Paper.js or DOM state so the storage
 * expansion contract can be regression-tested independently from rendering.
 */

const toEdges = bounds => ({
    left: bounds.left,
    top: bounds.top,
    right: typeof bounds.right === 'number' ? bounds.right : bounds.left + bounds.width,
    bottom: typeof bounds.bottom === 'number' ? bounds.bottom : bounds.top + bounds.height
});

const expandRasterStorageBounds = (currentBounds, requestedBounds, padding = 0) => {
    const current = toEdges(currentBounds);
    const requested = toEdges(requestedBounds);
    const left = Math.floor(Math.min(current.left, requested.left - padding));
    const top = Math.floor(Math.min(current.top, requested.top - padding));
    const right = Math.ceil(Math.max(current.right, requested.right + padding));
    const bottom = Math.ceil(Math.max(current.bottom, requested.bottom + padding));

    return Object.freeze({
        left,
        top,
        right,
        bottom,
        width: Math.max(1, right - left),
        height: Math.max(1, bottom - top),
        oldPixelOffsetX: Math.round(current.left - left),
        oldPixelOffsetY: Math.round(current.top - top)
    });
};

const projectPointToRasterPixel = (point, rasterBounds) => ({
    x: point.x - rasterBounds.left,
    y: point.y - rasterBounds.top
});

const rasterPixelToProjectPoint = (point, rasterBounds) => ({
    x: point.x + rasterBounds.left,
    y: point.y + rasterBounds.top
});

export {
    expandRasterStorageBounds,
    projectPointToRasterPixel,
    rasterPixelToProjectPoint
};
