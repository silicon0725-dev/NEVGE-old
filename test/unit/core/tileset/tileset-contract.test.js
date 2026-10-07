'use strict';

const {
    TILESET_CONTRACT,
    TILESET_RESOURCE_TYPE_ID,
    applyTileSetPatch,
    ensureTileDefinition,
    normalizeTileSet
} = require('../../../../src/core/tileset');

describe('WS-10N7 TileSet Resource contract', () => {
    test('keeps ResourceId as authority and texture bytes/backend handles outside the TileSet', () => {
        expect(TILESET_RESOURCE_TYPE_ID).toBe('ngvge.tileset-resource');
        expect(TILESET_CONTRACT.identity.resourceIdAuthority).toBe('ngvge:resource:*');
        expect(TILESET_CONTRACT.identity.backendTextureHandlePersistent).toBe(false);
        expect(TILESET_CONTRACT.textureBinding.authority).toBe('ResourceId');
        expect(TILESET_CONTRACT.textureBinding.imageBytesEmbeddedInTileSet).toBe(false);
        expect(TILESET_CONTRACT.persistence.nativeProject).toBe('.ne');
    });

    test('normalizes atlas, tile definitions, metadata and reusable Collider2D shapes', () => {
        const data = normalizeTileSet({
            atlas: {columns: 4, rows: 3, margin: [2, 3], separation: [1, 1]},
            textureResourceId: 'ngvge:resource:image-atlas',
            tileSize: [16, 24],
            tiles: [{
                atlas: [2, 1],
                collision: [{shape: {type: 'rectangle', size: [16, 8]}, offset: [0, -8]}],
                customData: {damage: 4, solid: true, nested: {ignored: true}},
                id: 7,
                navigation: {enabled: true},
                terrain: {terrainId: 'grass', mask: 3},
                variantGroup: 'grass-a'
            }]
        });
        expect(data.tileSize).toEqual([16, 24]);
        expect(data.textureResourceId).toBe('ngvge:resource:image-atlas');
        expect(data.tiles[0]).toMatchObject({atlas: [2, 1], id: 7, variantGroup: 'grass-a'});
        expect(data.tiles[0].collision[0].shape).toEqual({type: 'rectangle', size: [16, 8]});
        expect(data.tiles[0].customData).toEqual({damage: 4, solid: true});
        expect(data.tiles[0].terrain).toEqual({mask: 3, terrainId: 'grass'});
        expect(data.tiles[0].navigation).toEqual({enabled: true});
    });

    test('derives default atlas coordinates without mutating the resource and rejects unsupported patches', () => {
        const data = normalizeTileSet({atlas: {columns: 8}, tiles: []});
        expect(ensureTileDefinition(data, 10)).toMatchObject({atlas: [2, 1], id: 10});
        expect(data.tiles).toEqual([]);
        expect(() => applyTileSetPatch(data, {rendererHandle: 42})).toThrow(/unsupported field/i);
    });
});
