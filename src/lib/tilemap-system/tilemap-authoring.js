'use strict';

const {listTileMapCells, normalizeTileMapLayer2D, setTileMapCell} = require('../../core/tilemap-layer2d');

const TILEMAP_AUTHORING_TOOLS = Object.freeze({
    ERASER: 'eraser',
    FLOOD_FILL: 'flood-fill',
    LINE: 'line',
    PENCIL: 'pencil',
    PICKER: 'picker',
    PASTE: 'paste',
    RANDOM_VARIANT: 'random-variant',
    RECTANGLE: 'rectangle',
    SELECT: 'select',
    TERRAIN: 'terrain'
});

const lineCells = (from, to) => {
    let x0 = Math.trunc(from[0]);
    let y0 = Math.trunc(from[1]);
    const x1 = Math.trunc(to[0]);
    const y1 = Math.trunc(to[1]);
    const points = [];
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;
    while (true) {
        points.push([x0, y0]);
        if (x0 === x1 && y0 === y1) break;
        const doubled = 2 * error;
        if (doubled >= dy) {
            error += dy;
            x0 += sx;
        }
        if (doubled <= dx) {
            error += dx;
            y0 += sy;
        }
    }
    return points;
};

const rectangleCells = (from, to, filled = true) => {
    const minX = Math.min(Math.trunc(from[0]), Math.trunc(to[0]));
    const maxX = Math.max(Math.trunc(from[0]), Math.trunc(to[0]));
    const minY = Math.min(Math.trunc(from[1]), Math.trunc(to[1]));
    const maxY = Math.max(Math.trunc(from[1]), Math.trunc(to[1]));
    const points = [];
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            if (filled || x === minX || x === maxX || y === minY || y === maxY) points.push([x, y]);
        }
    }
    return points;
};

const getCellAt = (layerValue, x, y) => listTileMapCells(layerValue).find(cell => cell.x === x && cell.y === y) || null;

const floodFillCells = (layerValue, start, replacementTileId, maxCells = 4096) => {
    const layer = normalizeTileMapLayer2D(layerValue);
    const startX = Math.trunc(start[0]);
    const startY = Math.trunc(start[1]);
    const source = getCellAt(layer, startX, startY);
    const sourceTileId = source ? source.tileId : null;
    if (sourceTileId === replacementTileId) return [];
    const allCells = listTileMapCells(layer);
    const byKey = new Map(allCells.map(cell => [`${cell.x},${cell.y}`, cell]));
    // The TileMap is an infinite sparse plane. Filling an unbounded empty region would be
    // nonsensical, so empty-space fill is constrained to the authored cell bounds. Clicking
    // outside those bounds is a no-op; holes inside the authored rectangle can still be filled.
    let bounds = null;
    if (sourceTileId === null) {
        if (!allCells.length) return [];
        bounds = {
            maxX: Math.max(...allCells.map(cell => cell.x)),
            maxY: Math.max(...allCells.map(cell => cell.y)),
            minX: Math.min(...allCells.map(cell => cell.x)),
            minY: Math.min(...allCells.map(cell => cell.y))
        };
        if (startX < bounds.minX || startX > bounds.maxX || startY < bounds.minY || startY > bounds.maxY) return [];
    }
    const queue = [[startX, startY]];
    const visited = new Set();
    const output = [];
    while (queue.length && output.length < maxCells) {
        const [x, y] = queue.shift();
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        visited.add(key);
        if (bounds && (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY)) continue;
        const cell = byKey.get(key) || null;
        if ((cell ? cell.tileId : null) !== sourceTileId) continue;
        output.push([x, y]);
        queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return output;
};

const moveTileMapCells = (layerValue, bounds, delta) => {
    const layer = normalizeTileMapLayer2D(layerValue);
    if (!bounds || !delta) return layer;
    const dx = Math.trunc(Number(delta[0]) || 0);
    const dy = Math.trunc(Number(delta[1]) || 0);
    if (!dx && !dy) return layer;
    const selected = listTileMapCells(layer).filter(cell => (
        cell.x >= bounds.minX && cell.x <= bounds.maxX && cell.y >= bounds.minY && cell.y <= bounds.maxY
    ));
    let next = applyEraseCells(layer, selected.map(cell => [cell.x, cell.y]));
    selected.forEach(cell => {
        next = setTileMapCell(next, cell.x + dx, cell.y + dy, cell);
    });
    return next;
};

const deterministicVariantIndex = (x, y, count, seed = 0) => {
    if (!Number.isInteger(count) || count <= 1) return 0;
    let hash = (Math.imul(Math.trunc(x), 73856093) ^ Math.imul(Math.trunc(y), 19349663) ^ Math.imul(Math.trunc(seed), 83492791)) >>> 0;
    hash = (hash ^ (hash >>> 16)) >>> 0;
    return hash % count;
};

const applyPaintCells = (layerValue, points, cellTemplate) => points.reduce((state, point) => (
    setTileMapCell(state, point[0], point[1], cellTemplate)
), normalizeTileMapLayer2D(layerValue));

const applyEraseCells = (layerValue, points) => points.reduce((state, point) => (
    setTileMapCell(state, point[0], point[1], null)
), normalizeTileMapLayer2D(layerValue));

module.exports = {
    TILEMAP_AUTHORING_TOOLS,
    applyEraseCells,
    applyPaintCells,
    floodFillCells,
    deterministicVariantIndex,
    getCellAt,
    lineCells,
    moveTileMapCells,
    rectangleCells
};
