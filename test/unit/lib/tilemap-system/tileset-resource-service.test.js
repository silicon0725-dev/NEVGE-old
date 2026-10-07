'use strict';

const {createTileSetResourceService} = require('../../../../src/lib/tilemap-system');

describe('WS-10N7 TileSet Resource service', () => {
    test('creates stable global resources, persists them independently from texture/backend identity and restores them', () => {
        const runtime = {emitProjectChanged: jest.fn()};
        const service = createTileSetResourceService({runtime});
        const first = service.createTileSet({name: 'World', data: {tileSize: [16, 16]}});
        const second = service.createTileSet({name: 'World Copy', data: {tileSize: [16, 16]}});
        expect(first.resourceId).toMatch(/^ngvge:resource:/);
        expect(second.resourceId).toMatch(/^ngvge:resource:/);
        expect(second.resourceId).not.toBe(first.resourceId);
        service.patchTileSet(first.resourceId, {textureResourceId: 'ngvge:resource:image-1'});
        service.setTileDefinition(first.resourceId, 2, {atlas: [2, 0], customData: {kind: 'grass'}});
        const snapshot = service.serializeProject();
        const restored = createTileSetResourceService({runtime: {emitProjectChanged: jest.fn()}});
        restored.deserializeProject(snapshot);
        expect(restored.getTileSet(first.resourceId)).toMatchObject({
            name: 'World',
            resourceId: first.resourceId,
            data: {textureResourceId: 'ngvge:resource:image-1', tileSize: [16, 16]}
        });
        expect(restored.getTileSet(first.resourceId).data.tiles[0]).toMatchObject({id: 2, atlas: [2, 0]});
        expect(runtime.emitProjectChanged).toHaveBeenCalled();
    });
});
