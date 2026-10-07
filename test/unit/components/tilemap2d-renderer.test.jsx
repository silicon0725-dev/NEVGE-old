import React from 'react';
import renderer, {act} from 'react-test-renderer';

import TileMap2DRenderer from '../../../src/components/stage/tilemap2d-renderer.jsx';
import {CAMERA2D_RUNTIME_CAPABILITY_ID} from '../../../src/lib/camera-system';
import {TILEMAP_LAYER2D_RUNTIME_CAPABILITY_ID, TILESET_RESOURCE_CAPABILITY_ID} from '../../../src/lib/tilemap-system';

const makeContext = () => ({
    beginPath: jest.fn(), clearRect: jest.fn(), closePath: jest.fn(), drawImage: jest.fn(), fill: jest.fn(),
    lineTo: jest.fn(), moveTo: jest.fn(), restore: jest.fn(), save: jest.fn(), setTransform: jest.fn()
});

const mounted = [];
afterEach(() => {
    while (mounted.length) act(() => mounted.pop().unmount());
});

const makeVM = () => {
    const tileListeners = new Set();
    const cameraListeners = new Set();
    const instances = Array.from({length: 200}, (_, index) => ({
        atlas: [0, 0],
        cell: {x: index, y: 0, tileId: 0},
        tileId: 0,
        worldCorners: [
            [index * 32 - 16, -16], [index * 32 + 16, -16],
            [index * 32 + 16, 16], [index * 32 - 16, 16]
        ]
    }));
    const layer = {
        active: true,
        config: {visible: true, ySortEnabled: false, zIndex: 0},
        instances,
        nodeId: 'tilemap',
        tileSet: {
            data: {
                atlas: {margin: [0, 0], separation: [0, 0]},
                textureResourceId: null,
                tileSize: [32, 32],
                tiles: []
            }
        }
    };
    const tileMapRuntime = {
        listLayers: jest.fn(() => [layer]),
        subscribe: listener => { tileListeners.add(listener); return () => tileListeners.delete(listener); }
    };
    const cameraRuntime = {
        screenToWorld: jest.fn(point => point),
        worldToScreen: jest.fn(point => point),
        subscribe: listener => { cameraListeners.add(listener); return () => cameraListeners.delete(listener); }
    };
    const capabilities = new Map([
        [TILEMAP_LAYER2D_RUNTIME_CAPABILITY_ID, tileMapRuntime],
        [TILESET_RESOURCE_CAPABILITY_ID, {subscribe: () => () => {}}],
        [CAMERA2D_RUNTIME_CAPABILITY_ID, cameraRuntime]
    ]);
    const runtime = {ngvgeFirstPartyModules: {getCapability: id => capabilities.get(id) || null}};
    return {
        cameraRuntime,
        tileMapRuntime,
        triggerCamera: () => cameraListeners.forEach(listener => listener({type: 'camera:refresh'})),
        vm: {renderer: {getNativeSize: () => [480, 360]}, runtime}
    };
};

describe('WS-10N8-HF2 TileMap passive renderer hot path', () => {
    test('camera refresh reuses materialized layers and samples the camera affine transform only three times', () => {
        const {cameraRuntime, tileMapRuntime, triggerCamera, vm} = makeVM();
        const context = makeContext();
        let component;
        act(() => {
                component = renderer.create(<TileMap2DRenderer stageDimensions={{width: 480, height: 360}} vm={vm} />, {
                    createNodeMock: element => element.type === 'canvas' ? {getContext: () => context} : null
                });
                mounted.push(component);
        });
        expect(tileMapRuntime.listLayers).toHaveBeenCalledTimes(1);
        tileMapRuntime.listLayers.mockClear();
        cameraRuntime.worldToScreen.mockClear();
        act(() => triggerCamera());
        expect(tileMapRuntime.listLayers).not.toHaveBeenCalled();
        expect(cameraRuntime.worldToScreen).toHaveBeenCalledTimes(3);
        // Viewport culling means 200 off-screen tiles are not all drawn.
        expect(context.fill.mock.calls.length).toBeLessThan(200);
    });
});
