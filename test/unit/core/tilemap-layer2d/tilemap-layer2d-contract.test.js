'use strict';

const {
    TILEMAP_LAYER2D_CONTRACT,
    listTileMapCells,
    listTileMapCellsInBounds,
    normalizeTileMapLayer2D,
    setTileMapCell
} = require('../../../../src/core/tilemap-layer2d');

describe('WS-10N7 TileMapLayer2D sparse authoring contract', () => {
    test('freezes Sparse Chunk as native authoring and forbids Scratch List authority', () => {
        expect(TILEMAP_LAYER2D_CONTRACT.persistence.authoringSource).toBe('sparse-chunks');
        expect(TILEMAP_LAYER2D_CONTRACT.persistence.scratchListAuthoringSourceForbidden).toBe(true);
        expect(TILEMAP_LAYER2D_CONTRACT.resourceBinding.field).toBe('tileSetResourceId');
        expect(TILEMAP_LAYER2D_CONTRACT.resourceBinding.resourceContentOwnedByNode).toBe(false);
    });

    test('stores positive and negative coordinates in deterministic sparse chunks', () => {
        let layer = normalizeTileMapLayer2D({chunkSize: 16, tileSetResourceId: 'ngvge:resource:tileset-a'});
        layer = setTileMapCell(layer, -1, -1, {tileId: 1});
        layer = setTileMapCell(layer, 0, 0, {tileId: 2});
        layer = setTileMapCell(layer, 16, 0, {tileId: 3, flipX: true, rotation: 5});
        expect(layer.chunks.map(chunk => [chunk.chunkX, chunk.chunkY])).toEqual([[-1, -1], [0, 0], [1, 0]]);
        expect(listTileMapCells(layer)).toEqual(expect.arrayContaining([
            expect.objectContaining({x: -1, y: -1, tileId: 1}),
            expect.objectContaining({x: 0, y: 0, tileId: 2}),
            expect.objectContaining({x: 16, y: 0, tileId: 3, flipX: true, rotation: 1})
        ]));
    });

    test('enumerates only sparse chunks intersecting bounded editor queries', () => {
        let layer = normalizeTileMapLayer2D({chunkSize: 16});
        layer = setTileMapCell(layer, 0, 0, {tileId: 1});
        layer = setTileMapCell(layer, 15, 15, {tileId: 2});
        layer = setTileMapCell(layer, 16, 0, {tileId: 3});
        layer = setTileMapCell(layer, 1000, 1000, {tileId: 4});
        expect(listTileMapCellsInBounds(layer, {minX: -2, maxX: 20, minY: -2, maxY: 20})).toEqual([
            expect.objectContaining({x: 0, y: 0, tileId: 1}),
            expect.objectContaining({x: 16, y: 0, tileId: 3}),
            expect.objectContaining({x: 15, y: 15, tileId: 2})
        ]);
    });

    test('erasing the last cell removes an empty chunk rather than persisting dense empty storage', () => {
        let layer = setTileMapCell({}, -17, 32, {tileId: 8});
        expect(layer.chunks).toHaveLength(1);
        layer = setTileMapCell(layer, -17, 32, null);
        expect(layer.chunks).toEqual([]);
        expect(listTileMapCells(layer)).toEqual([]);
    });
});
