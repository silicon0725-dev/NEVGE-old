'use strict';

const {createEngineCommand} = require('../protocol');

const TILEMAP_LAYER2D_TYPE_ID = 'ngvge.tilemap-layer2d';
const TILEMAP_LAYER2D_SCHEMA_VERSION = 1;
const TILEMAP_LAYER2D_COMPONENT_OWNER = 'ngvge.scene-system';
const TILEMAP_LAYER2D_PATCH_COMMAND_TYPE = 'PatchTileMapLayer2D';
const TILEMAP_LAYER2D_PATCH_APPLIED_EVENT_TYPE = 'TileMapLayer2DPatchApplied';
const TILEMAP_LAYER2D_DEFAULT_CHUNK_SIZE = 16;
const TILEMAP_LAYER2D_MIN_CHUNK_SIZE = 4;
const TILEMAP_LAYER2D_MAX_CHUNK_SIZE = 64;
const TILEMAP_LAYER2D_MAX_CELLS_PER_CHUNK = 4096;

const TILEMAP_LAYER2D_DEFAULT_DATA = Object.freeze({
    chunkSize: TILEMAP_LAYER2D_DEFAULT_CHUNK_SIZE,
    collisionEnabled: true,
    collisionLayer: 1,
    collisionMask: 0xFFFFFFFF,
    navigationEnabled: false,
    tileSetResourceId: null,
    visible: true,
    ySortEnabled: false,
    zIndex: 0,
    chunks: Object.freeze([])
});

const TILEMAP_LAYER2D_CONTRACT = Object.freeze({
    componentOwner: TILEMAP_LAYER2D_COMPONENT_OWNER,
    contractId: 'ngvge.tilemap-layer2d-contract',
    contractVersion: '1',
    persistence: Object.freeze({
        authoringSource: 'sparse-chunks',
        nativeProject: '.ne',
        scratchListAuthoringSourceForbidden: true,
        scratchProjection: 'bake'
    }),
    resourceBinding: Object.freeze({
        field: 'tileSetResourceId',
        identity: 'ngvge:resource:*',
        resourceContentOwnedByNode: false
    }),
    schemaVersion: TILEMAP_LAYER2D_SCHEMA_VERSION,
    typeId: TILEMAP_LAYER2D_TYPE_ID
});

const isPlainObject = value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
};

const finiteInt = (value, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.trunc(number) : fallback;
};

const normalizeTileSetResourceId = value => (
    typeof value === 'string' && value.startsWith('ngvge:resource:') ? value : null
);

const floorDiv = (value, divisor) => Math.floor(value / divisor);
const cellKey = (x, y) => `${finiteInt(x, 0)},${finiteInt(y, 0)}`;
const chunkKey = (chunkX, chunkY) => `${finiteInt(chunkX, 0)},${finiteInt(chunkY, 0)}`;

const normalizeCell = value => {
    const source = isPlainObject(value) ? value : {};
    return {
        flipX: Boolean(source.flipX),
        flipY: Boolean(source.flipY),
        rotation: ((finiteInt(source.rotation, 0) % 4) + 4) % 4,
        tileId: Math.max(0, finiteInt(source.tileId, 0)),
        variant: Math.max(0, finiteInt(source.variant, 0)),
        x: finiteInt(source.x, 0),
        y: finiteInt(source.y, 0)
    };
};

const normalizeChunk = (value, chunkSize) => {
    const source = isPlainObject(value) ? value : {};
    const chunkX = finiteInt(source.chunkX, 0);
    const chunkY = finiteInt(source.chunkY, 0);
    const byCell = new Map();
    const sourceCells = Array.isArray(source.cells) ? source.cells : [];
    sourceCells.slice(0, TILEMAP_LAYER2D_MAX_CELLS_PER_CHUNK).forEach(rawCell => {
        const cell = normalizeCell(rawCell);
        if (floorDiv(cell.x, chunkSize) !== chunkX || floorDiv(cell.y, chunkSize) !== chunkY) return;
        byCell.set(cellKey(cell.x, cell.y), cell);
    });
    return {
        cells: Array.from(byCell.values()).sort((a, b) => a.y - b.y || a.x - b.x),
        chunkX,
        chunkY
    };
};

const normalizeTileMapLayer2D = value => {
    const source = isPlainObject(value) ? value : {};
    const chunkSize = Math.max(
        TILEMAP_LAYER2D_MIN_CHUNK_SIZE,
        Math.min(TILEMAP_LAYER2D_MAX_CHUNK_SIZE, finiteInt(source.chunkSize, TILEMAP_LAYER2D_DEFAULT_CHUNK_SIZE))
    );
    const chunks = Array.isArray(source.chunks) ? source.chunks : [];
    const byChunk = new Map();
    chunks.forEach(rawChunk => {
        const chunk = normalizeChunk(rawChunk, chunkSize);
        if (chunk.cells.length) byChunk.set(chunkKey(chunk.chunkX, chunk.chunkY), chunk);
    });
    return {
        chunkSize,
        collisionEnabled: source.collisionEnabled !== false,
        collisionLayer: Math.max(0, Math.min(0xFFFFFFFF, finiteInt(source.collisionLayer, 1))) >>> 0,
        collisionMask: Math.max(0, Math.min(0xFFFFFFFF, finiteInt(source.collisionMask, 0xFFFFFFFF))) >>> 0,
        navigationEnabled: Boolean(source.navigationEnabled),
        tileSetResourceId: normalizeTileSetResourceId(source.tileSetResourceId),
        visible: source.visible !== false,
        ySortEnabled: Boolean(source.ySortEnabled),
        zIndex: finiteInt(source.zIndex, 0),
        chunks: Array.from(byChunk.values()).sort((a, b) => a.chunkY - b.chunkY || a.chunkX - b.chunkX)
    };
};

const listTileMapCells = value => normalizeTileMapLayer2D(value).chunks.flatMap(chunk => chunk.cells.map(cell => Object.assign({}, cell)));

const normalizeCellBounds = boundsValue => {
    const source = isPlainObject(boundsValue) ? boundsValue : {};
    const values = [source.minX, source.maxX, source.minY, source.maxY].map(Number);
    if (!values.every(Number.isFinite)) return null;
    const minX = Math.trunc(values[0]);
    const maxX = Math.trunc(values[1]);
    const minY = Math.trunc(values[2]);
    const maxY = Math.trunc(values[3]);
    return {
        maxX: Math.max(minX, maxX),
        maxY: Math.max(minY, maxY),
        minX: Math.min(minX, maxX),
        minY: Math.min(minY, maxY)
    };
};

/**
 * Enumerate only cells whose sparse chunks intersect the requested cell bounds.
 * Unlike listTileMapCells(), this deliberately avoids normalizing/flattening every
 * chunk first so camera/editor queries remain proportional to visible chunks.
 */
const listTileMapCellsInBounds = (value, boundsValue) => {
    const source = isPlainObject(value) ? value : {};
    const chunkSize = Math.max(
        TILEMAP_LAYER2D_MIN_CHUNK_SIZE,
        Math.min(TILEMAP_LAYER2D_MAX_CHUNK_SIZE, finiteInt(source.chunkSize, TILEMAP_LAYER2D_DEFAULT_CHUNK_SIZE))
    );
    const bounds = normalizeCellBounds(boundsValue);
    if (!bounds) return listTileMapCells(value);
    const minChunkX = floorDiv(bounds.minX, chunkSize);
    const maxChunkX = floorDiv(bounds.maxX, chunkSize);
    const minChunkY = floorDiv(bounds.minY, chunkSize);
    const maxChunkY = floorDiv(bounds.maxY, chunkSize);
    const byCell = new Map();
    const chunks = Array.isArray(source.chunks) ? source.chunks : [];
    chunks.forEach(rawChunk => {
        if (!isPlainObject(rawChunk)) return;
        const chunkX = finiteInt(rawChunk.chunkX, 0);
        const chunkY = finiteInt(rawChunk.chunkY, 0);
        if (chunkX < minChunkX || chunkX > maxChunkX || chunkY < minChunkY || chunkY > maxChunkY) return;
        const cells = Array.isArray(rawChunk.cells) ? rawChunk.cells : [];
        cells.slice(0, TILEMAP_LAYER2D_MAX_CELLS_PER_CHUNK).forEach(rawCell => {
            const cell = normalizeCell(rawCell);
            if (floorDiv(cell.x, chunkSize) !== chunkX || floorDiv(cell.y, chunkSize) !== chunkY) return;
            if (cell.x < bounds.minX || cell.x > bounds.maxX || cell.y < bounds.minY || cell.y > bounds.maxY) return;
            byCell.set(cellKey(cell.x, cell.y), cell);
        });
    });
    return Array.from(byCell.values()).sort((a, b) => a.y - b.y || a.x - b.x);
};

const setTileMapCell = (value, x, y, cellValue) => {
    const current = normalizeTileMapLayer2D(value);
    const targetX = finiteInt(x, 0);
    const targetY = finiteInt(y, 0);
    const targetChunkX = floorDiv(targetX, current.chunkSize);
    const targetChunkY = floorDiv(targetY, current.chunkSize);
    const chunks = current.chunks.map(chunk => ({
        cells: chunk.cells.map(cell => Object.assign({}, cell)),
        chunkX: chunk.chunkX,
        chunkY: chunk.chunkY
    }));
    let chunk = chunks.find(item => item.chunkX === targetChunkX && item.chunkY === targetChunkY);
    if (!chunk) {
        chunk = {cells: [], chunkX: targetChunkX, chunkY: targetChunkY};
        chunks.push(chunk);
    }
    const key = cellKey(targetX, targetY);
    const byCell = new Map(chunk.cells.map(cell => [cellKey(cell.x, cell.y), cell]));
    if (cellValue === null || typeof cellValue === 'undefined') {
        byCell.delete(key);
    } else {
        byCell.set(key, normalizeCell(Object.assign({}, cellValue, {x: targetX, y: targetY})));
    }
    chunk.cells = Array.from(byCell.values());
    return normalizeTileMapLayer2D(Object.assign({}, current, {chunks}));
};

const applyTileMapLayer2DPatch = (current, patch) => {
    if (!isPlainObject(patch)) throw new TypeError('TileMapLayer2D patch must be a plain portable object.');
    const allowed = new Set([
        'chunkSize', 'chunks', 'collisionEnabled', 'collisionLayer', 'collisionMask', 'navigationEnabled', 'tileSetResourceId', 'visible', 'ySortEnabled', 'zIndex'
    ]);
    const unsupported = Object.keys(patch).filter(key => !allowed.has(key));
    if (unsupported.length) {
        const error = new TypeError(`TileMapLayer2D patch contains unsupported field(s): ${unsupported.join(', ')}`);
        error.code = 'NGVGE_TILEMAP_LAYER2D_PATCH_FIELD_UNSUPPORTED';
        throw error;
    }
    return normalizeTileMapLayer2D(Object.assign({}, normalizeTileMapLayer2D(current), patch));
};

const createTileMapLayer2DPatchComponentCommand = ({componentId, nodeId, patch}) => createEngineCommand(
    TILEMAP_LAYER2D_PATCH_COMMAND_TYPE,
    {componentId, nodeId, patch}
);

module.exports = {
    TILEMAP_LAYER2D_COMPONENT_OWNER,
    TILEMAP_LAYER2D_CONTRACT,
    TILEMAP_LAYER2D_DEFAULT_CHUNK_SIZE,
    TILEMAP_LAYER2D_DEFAULT_DATA,
    TILEMAP_LAYER2D_PATCH_APPLIED_EVENT_TYPE,
    TILEMAP_LAYER2D_PATCH_COMMAND_TYPE,
    TILEMAP_LAYER2D_SCHEMA_VERSION,
    TILEMAP_LAYER2D_TYPE_ID,
    applyTileMapLayer2DPatch,
    cellKey,
    chunkKey,
    createTileMapLayer2DPatchComponentCommand,
    floorDiv,
    listTileMapCells,
    listTileMapCellsInBounds,
    normalizeCell,
    normalizeTileMapLayer2D,
    setTileMapCell
};
