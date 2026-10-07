'use strict';

const {
    applyPaintCells,
    deterministicVariantIndex,
    floodFillCells,
    lineCells,
    moveTileMapCells,
    rectangleCells
} = require('../../../../src/lib/tilemap-system');
const {listTileMapCells, setTileMapCell} = require('../../../../src/core/tilemap-layer2d');

describe('WS-10N7 TileMap editor authoring algorithms', () => {
    test('provides continuous line and rectangle paint coordinates across negative space', () => {
        expect(lineCells([-2, -1], [2, 1])).toEqual([[-2, -1], [-1, 0], [0, 0], [1, 1], [2, 1]]);
        expect(rectangleCells([-1, -1], [1, 0], true)).toHaveLength(6);
    });

    test('flood fill never expands into the infinite empty sparse plane', () => {
        let layer = {};
        layer = setTileMapCell(layer, 0, 0, {tileId: 1});
        layer = setTileMapCell(layer, 1, 0, {tileId: 1});
        layer = setTileMapCell(layer, 0, 1, {tileId: 2});
        expect(floodFillCells(layer, [0, 0], 9)).toEqual(expect.arrayContaining([[0, 0], [1, 0]]));
        expect(floodFillCells(layer, [500, 500], 9)).toEqual([]);
    });

    test('moves a selection transactionally while preserving tile metadata', () => {
        let layer = applyPaintCells({}, [[0, 0], [1, 0]], {flipX: true, tileId: 4, rotation: 2});
        layer = moveTileMapCells(layer, {minX: 0, maxX: 1, minY: 0, maxY: 0}, [3, -2]);
        const cells = listTileMapCells(layer);
        expect(cells.map(cell => [cell.x, cell.y])).toEqual([[3, -2], [4, -2]]);
        expect(cells.every(cell => cell.tileId === 4 && cell.flipX && cell.rotation === 2)).toBe(true);
    });

    test('random variant selection is deterministic per cell instead of depending on frame timing', () => {
        const a = deterministicVariantIndex(12, -7, 5, 3);
        expect(deterministicVariantIndex(12, -7, 5, 3)).toBe(a);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThan(5);
    });
});
