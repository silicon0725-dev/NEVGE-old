'use strict';

const {normalizeCollider2DShape} = require('../collider2d');

const TILESET_RESOURCE_TYPE_ID = 'ngvge.tileset-resource';
const TILESET_SCHEMA_VERSION = 1;
const TILESET_MAX_TILE_DEFINITIONS = 4096;
const TILESET_MAX_COLLISION_SHAPES_PER_TILE = 8;
const TILESET_MAX_CUSTOM_DATA_KEYS = 64;
const TILESET_MIN_TILE_SIZE = 1;
const TILESET_MAX_TILE_SIZE = 4096;

const TILESET_DEFAULT_DATA = Object.freeze({
    atlas: Object.freeze({
        columns: 1,
        margin: Object.freeze([0, 0]),
        rows: 1,
        separation: Object.freeze([0, 0])
    }),
    textureResourceId: null,
    tileSize: Object.freeze([32, 32]),
    tiles: Object.freeze([])
});

const TILESET_CONTRACT = Object.freeze({
    contractId: 'ngvge.tileset-resource-contract',
    contractVersion: '1',
    identity: Object.freeze({
        backendTextureHandlePersistent: false,
        contentHashIsResourceIdentity: false,
        resourceIdAuthority: 'ngvge:resource:*'
    }),
    persistence: Object.freeze({
        nativeProject: '.ne',
        scratchProjection: 'bake-or-partial'
    }),
    resourceTypeId: TILESET_RESOURCE_TYPE_ID,
    schemaVersion: TILESET_SCHEMA_VERSION,
    textureBinding: Object.freeze({
        authority: 'ResourceId',
        imageBytesEmbeddedInTileSet: false
    }),
    tileDefinition: Object.freeze({
        animation: 'metadata',
        atlasCoordinate: 'column-row',
        collisionShapes: `0..${TILESET_MAX_COLLISION_SHAPES_PER_TILE}`,
        customData: true,
        navigation: 'metadata',
        sceneStamp: 'metadata',
        terrain: 'metadata',
        variants: 'metadata'
    })
});

const isPlainObject = value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
};

const finiteNumber = (value, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};

const clampInt = (value, fallback, min, max) => Math.max(min, Math.min(max, Math.trunc(finiteNumber(value, fallback))));

const normalizeVec2Int = (value, fallback, min = -1000000, max = 1000000) => {
    const source = Array.isArray(value) && value.length === 2 ? value : fallback;
    return [
        clampInt(source[0], fallback[0], min, max),
        clampInt(source[1], fallback[1], min, max)
    ];
};

const normalizePortableMetadata = value => {
    if (!isPlainObject(value)) return {};
    const result = {};
    Object.keys(value).slice(0, TILESET_MAX_CUSTOM_DATA_KEYS).sort().forEach(key => {
        const item = value[key];
        if (item === null || ['string', 'number', 'boolean'].includes(typeof item)) result[key] = item;
    });
    return result;
};

const normalizeCollisionShapes = value => {
    if (!Array.isArray(value)) return [];
    return value.slice(0, TILESET_MAX_COLLISION_SHAPES_PER_TILE).map((entry, index) => {
        const source = isPlainObject(entry) ? entry : {};
        return {
            id: typeof source.id === 'string' && source.id.trim() ? source.id.trim() : `shape-${index}`,
            offset: normalizeVec2Int(source.offset, [0, 0], -TILESET_MAX_TILE_SIZE, TILESET_MAX_TILE_SIZE),
            rotation: finiteNumber(source.rotation, 0),
            shape: normalizeCollider2DShape(source.shape)
        };
    });
};

const normalizeTileDefinition = (value, fallbackId = 0) => {
    const source = isPlainObject(value) ? value : {};
    return {
        animation: isPlainObject(source.animation) ? normalizePortableMetadata(source.animation) : null,
        atlas: normalizeVec2Int(source.atlas, [fallbackId, 0], 0, 1000000),
        collision: normalizeCollisionShapes(source.collision),
        customData: normalizePortableMetadata(source.customData),
        id: clampInt(source.id, fallbackId, 0, 0x7FFFFFFF),
        navigation: isPlainObject(source.navigation) ? normalizePortableMetadata(source.navigation) : null,
        sceneStamp: typeof source.sceneStamp === 'string' && source.sceneStamp.trim() ? source.sceneStamp.trim() : null,
        terrain: isPlainObject(source.terrain) ? normalizePortableMetadata(source.terrain) : null,
        variantGroup: typeof source.variantGroup === 'string' && source.variantGroup.trim() ? source.variantGroup.trim() : null
    };
};

const normalizeTileSet = value => {
    const source = isPlainObject(value) ? value : {};
    const atlasSource = isPlainObject(source.atlas) ? source.atlas : {};
    const definitions = Array.isArray(source.tiles) ? source.tiles : [];
    const byId = new Map();
    definitions.slice(0, TILESET_MAX_TILE_DEFINITIONS).forEach((definition, index) => {
        const normalized = normalizeTileDefinition(definition, index);
        byId.set(normalized.id, normalized);
    });
    return {
        atlas: {
            columns: clampInt(atlasSource.columns, 1, 1, 4096),
            margin: normalizeVec2Int(atlasSource.margin, [0, 0], 0, TILESET_MAX_TILE_SIZE),
            rows: clampInt(atlasSource.rows, 1, 1, 4096),
            separation: normalizeVec2Int(atlasSource.separation, [0, 0], 0, TILESET_MAX_TILE_SIZE)
        },
        textureResourceId: typeof source.textureResourceId === 'string' && source.textureResourceId.startsWith('ngvge:resource:') ?
            source.textureResourceId : null,
        tileSize: normalizeVec2Int(
            source.tileSize,
            TILESET_DEFAULT_DATA.tileSize,
            TILESET_MIN_TILE_SIZE,
            TILESET_MAX_TILE_SIZE
        ),
        tiles: Array.from(byId.values()).sort((a, b) => a.id - b.id)
    };
};

const ensureTileDefinition = (tilesetValue, tileId) => {
    const tileset = normalizeTileSet(tilesetValue);
    const id = clampInt(tileId, 0, 0, 0x7FFFFFFF);
    const existing = tileset.tiles.find(tile => tile.id === id);
    if (existing) return existing;
    const column = id % tileset.atlas.columns;
    const row = Math.floor(id / tileset.atlas.columns);
    return normalizeTileDefinition({atlas: [column, row], id}, id);
};

const applyTileSetPatch = (current, patch) => {
    if (!isPlainObject(patch)) throw new TypeError('TileSet patch must be a plain portable object.');
    const allowed = new Set(['atlas', 'textureResourceId', 'tileSize', 'tiles']);
    const unsupported = Object.keys(patch).filter(key => !allowed.has(key));
    if (unsupported.length) {
        const error = new TypeError(`TileSet patch contains unsupported field(s): ${unsupported.join(', ')}`);
        error.code = 'NGVGE_TILESET_PATCH_FIELD_UNSUPPORTED';
        throw error;
    }
    return normalizeTileSet(Object.assign({}, normalizeTileSet(current), patch));
};

module.exports = {
    TILESET_CONTRACT,
    TILESET_DEFAULT_DATA,
    TILESET_MAX_COLLISION_SHAPES_PER_TILE,
    TILESET_MAX_TILE_DEFINITIONS,
    TILESET_RESOURCE_TYPE_ID,
    TILESET_SCHEMA_VERSION,
    applyTileSetPatch,
    ensureTileDefinition,
    normalizeTileDefinition,
    normalizeTileSet
};
