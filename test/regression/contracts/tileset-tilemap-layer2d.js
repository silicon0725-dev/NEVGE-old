'use strict';

const assert = require('assert');
const {TILESET_CONTRACT, normalizeTileSet} = require('../../../src/core/tileset');
const {
    TILEMAP_LAYER2D_CONTRACT,
    listTileMapCells,
    setTileMapCell
} = require('../../../src/core/tilemap-layer2d');
const {FUNCTIONAL_NODE_ARCHETYPE_IDS, listCreatableFunctionalNodeArchetypes} = require('../../../src/core/functional-node');

const assertTileSetTileMapLayer2DContract = () => {
    assert.strictEqual(TILESET_CONTRACT.identity.resourceIdAuthority, 'ngvge:resource:*');
    assert.strictEqual(TILESET_CONTRACT.textureBinding.authority, 'ResourceId');
    assert.strictEqual(TILESET_CONTRACT.identity.backendTextureHandlePersistent, false);
    assert.strictEqual(TILEMAP_LAYER2D_CONTRACT.persistence.authoringSource, 'sparse-chunks');
    assert.strictEqual(TILEMAP_LAYER2D_CONTRACT.persistence.scratchListAuthoringSourceForbidden, true);
    assert.strictEqual(TILEMAP_LAYER2D_CONTRACT.resourceBinding.resourceContentOwnedByNode, false);
    const ids = listCreatableFunctionalNodeArchetypes({scratchCompatibilityAvailable: true}).map(item => item.id);
    assert(ids.includes(FUNCTIONAL_NODE_ARCHETYPE_IDS.TILEMAP_LAYER_2D));
    assert(ids.includes(FUNCTIONAL_NODE_ARCHETYPE_IDS.RIGID_BODY_2D));
    let layer = setTileMapCell({tileSetResourceId: 'ngvge:resource:test'}, -1, -1, {tileId: 3});
    layer = setTileMapCell(layer, 32, 0, {tileId: 4});
    assert.strictEqual(listTileMapCells(layer).length, 2);
    assert(layer.chunks.some(chunk => chunk.chunkX < 0));
    assert.strictEqual(normalizeTileSet({textureResourceId: 'backend:handle'}).textureResourceId, null);
    return {
        globalTileSetResourceAuthority: true,
        sparseChunkAuthoring: true,
        scratchListAuthorityForbidden: true,
        tileMapFunctionalNodeGraduated: true
    };
};

module.exports = {assertTileSetTileMapLayer2DContract};
