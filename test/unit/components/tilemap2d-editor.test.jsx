import React from 'react';
import renderer, {act} from 'react-test-renderer';

import TileMap2DEditor from '../../../src/components/stage/tilemap2d-editor.jsx';
import {TILEMAP_LAYER2D_COMMAND_CAPABILITY_ID, TILEMAP_LAYER2D_RUNTIME_CAPABILITY_ID, TILESET_RESOURCE_CAPABILITY_ID} from '../../../src/lib/tilemap-system';
import {CAMERA2D_RUNTIME_CAPABILITY_ID} from '../../../src/lib/camera-system';

const makeContext = () => ({
    beginPath: jest.fn(), clearRect: jest.fn(), closePath: jest.fn(), drawImage: jest.fn(), fill: jest.fn(),
    fillText: jest.fn(), lineTo: jest.fn(), moveTo: jest.fn(), restore: jest.fn(), save: jest.fn(),
    setLineDash: jest.fn(), setTransform: jest.fn(), stroke: jest.fn()
});

const makeVM = () => {
    const patches = [];
    const listeners = new Set();
    const layer = {
        active: true,
        cells: [],
        componentId: 'tilemap-component',
        config: {chunkSize: 16, chunks: [], tileSetResourceId: 'ngvge:resource:tileset-a', visible: true},
        instances: [],
        nodeId: 'tilemap-node',
        tileSet: {resourceId: 'ngvge:resource:tileset-a', data: {atlas: {columns: 1, rows: 1, margin: [0, 0], separation: [0, 0]}, tileSize: [32, 32], tiles: []}}
    };
    const tileMapRuntime = {
        getLayer: () => layer,
        localPointToWorld: (nodeId, point) => point,
        worldPointToCell: (nodeId, point) => [Math.round(point[0] / 32), Math.round(point[1] / 32)],
        cellToWorld: (nodeId, cell) => [cell[0] * 32, cell[1] * 32],
        subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); }
    };
    const command = {
        capabilityId: TILEMAP_LAYER2D_COMMAND_CAPABILITY_ID,
        version: 1,
        executeCommand: cmd => {
            patches.push(cmd.payload.patch);
            layer.config = Object.assign({}, layer.config, cmd.payload.patch);
            return {kind: 'event', protocol: 'ngvge.engine-protocol', protocolVersion: 1, type: 'TileMapLayer2DPatchApplied', payload: {}};
        }
    };
    const capabilities = new Map([
        [TILEMAP_LAYER2D_RUNTIME_CAPABILITY_ID, tileMapRuntime],
        [TILEMAP_LAYER2D_COMMAND_CAPABILITY_ID, command],
        [TILESET_RESOURCE_CAPABILITY_ID, {subscribe: () => () => {}}],
        [CAMERA2D_RUNTIME_CAPABILITY_ID, {screenToWorld: point => point, worldToScreen: point => point, subscribe: () => () => {}}]
    ]);
    const runtime = {ngvgeFirstPartyModules: {getCapability: id => capabilities.get(id) || null}};
    return {patches, vm: {renderer: {getNativeSize: () => [480, 360]}, runtime}};
};

const mounted = [];
afterEach(() => { while (mounted.length) act(() => mounted.pop().unmount()); });

describe('WS-10N7 TileMap2D Stage authoring', () => {
    test('renders an interactive editor and commits one sparse-chunk patch on gesture release', () => {
        const {patches, vm} = makeVM();
        const context = makeContext();
        let component;
        act(() => {
            component = renderer.create(<TileMap2DEditor nodeId="tilemap-node" stageDimensions={{width: 480, height: 360}} vm={vm} />, {
                createNodeMock: element => element.type === 'canvas' ? {
                    getBoundingClientRect: () => ({left: 0, top: 0, width: 480, height: 360}),
                    getContext: () => context,
                    setPointerCapture: jest.fn()
                } : null
            });
            mounted.push(component);
        });
        const canvas = component.root.findByProps({'data-ngvge-tilemap-editor': 'true'});
        const event = {button: 0, clientX: 240, clientY: 180, pointerId: 1, preventDefault: jest.fn(), currentTarget: {setPointerCapture: jest.fn()}};
        act(() => canvas.props.onPointerDown(event));
        expect(patches).toHaveLength(0);
        act(() => canvas.props.onPointerMove({...event, clientX: 272}));
        expect(patches).toHaveLength(0);
        act(() => canvas.props.onPointerUp({...event, clientX: 272}));
        expect(patches).toHaveLength(1);
        expect(patches[0].chunks.length).toBeGreaterThan(0);
    });
});
