import React from 'react';
import renderer, {act} from 'react-test-renderer';

import CharacterController2DDebug from '../../../src/components/stage/character-controller2d-debug.jsx';
import {CAMERA2D_RUNTIME_CAPABILITY_ID} from '../../../src/lib/camera-system';
import {CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_ID} from '../../../src/lib/character-controller-system';
import {createServiceFacadeFactory} from '../../../src/lib/first-party-modules/service-facade';

const makeVM = ({useCapabilityFacades = false} = {}) => {
    const characterListeners = new Set();
    const cameraListeners = new Set();
    const controller = {
        nodeId: 'player',
        state: {
            floorNormal: [0, 1],
            lastSafeWorldOrigin: [10, 18],
            onFloor: true,
            onWall: true,
            velocity: [100, -20],
            wallNormal: [-1, 0]
        },
        worldOrigin: [10, 20]
    };
    const characterRuntime = {
        getController: jest.fn(() => controller),
        subscribe: jest.fn(listener => {
            characterListeners.add(listener);
            return () => characterListeners.delete(listener);
        })
    };
    const cameraRuntime = {
        subscribe: jest.fn(listener => {
            cameraListeners.add(listener);
            return () => cameraListeners.delete(listener);
        }),
        worldToScreen: jest.fn(point => point)
    };
    const rawCapabilities = new Map([
        [CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_ID, characterRuntime],
        [CAMERA2D_RUNTIME_CAPABILITY_ID, cameraRuntime]
    ]);
    const capabilities = new Map(Array.from(rawCapabilities, ([capabilityId, capability]) => [
        capabilityId,
        useCapabilityFacades ? createServiceFacadeFactory({
            assertActive: () => {},
            boundaryKind: 'capability',
            serviceId: `capability:${capabilityId}`
        }).wrap(capability) : capability
    ]));
    return {
        cameraListeners,
        characterListeners,
        controller,
        vm: {
            renderer: {getNativeSize: () => [480, 360]},
            runtime: {
                ngvgeFirstPartyModules: {
                    getCapability: id => capabilities.get(id) || null
                }
            }
        }
    };
};

const mounted = [];

afterEach(() => {
    while (mounted.length) act(() => mounted.pop().unmount());
});

describe('WS-10N6-HF3 CharacterController2D stage diagnostics', () => {
    test('renders selected character velocity, contact normals and last-safe anchor', () => {
        const {vm} = makeVM();
        let component;
        act(() => {
            component = renderer.create(
                <CharacterController2DDebug
                    nodeId="player"
                    stageDimensions={{height: 360, width: 480}}
                    vm={vm}
                />
            );
        });
        mounted.push(component);
        const svg = component.root.findByProps({'data-ngvge-character-debug-overlay': 'true'});
        expect(svg.props['data-ngvge-character-node-id']).toBe('player');
        expect(component.root.findAllByProps({'data-ngvge-character-debug-vector': 'velocity'})).toHaveLength(1);
        expect(component.root.findAllByProps({'data-ngvge-character-debug-vector': 'floor-normal'})).toHaveLength(1);
        expect(component.root.findAllByProps({'data-ngvge-character-debug-vector': 'wall-normal'})).toHaveLength(1);
        expect(component.root.findAllByProps({'data-ngvge-character-debug-anchor': 'last-safe'})).toHaveLength(1);
    });

    test('refreshes after CharacterController2D runtime events', () => {
        const {characterListeners, controller, vm} = makeVM();
        let component;
        act(() => {
            component = renderer.create(
                <CharacterController2DDebug
                    nodeId="player"
                    stageDimensions={{height: 360, width: 480}}
                    vm={vm}
                />
            );
        });
        mounted.push(component);
        const before = component.root.findByProps({'data-ngvge-character-debug-vector': 'velocity'}).props.x2;
        controller.state.velocity = [200, -20];
        act(() => characterListeners.forEach(listener => listener({type: 'character:velocity'})));
        const after = component.root.findByProps({'data-ngvge-character-debug-vector': 'velocity'}).props.x2;
        expect(after).not.toBe(before);
    });

    test('renders nested vector arrays returned through real Module capability facades', () => {
        const {vm} = makeVM({useCapabilityFacades: true});
        let component;
        act(() => {
            component = renderer.create(
                <CharacterController2DDebug
                    nodeId="player"
                    stageDimensions={{height: 360, width: 480}}
                    vm={vm}
                />
            );
        });
        mounted.push(component);
        expect(component.root.findAllByProps({'data-ngvge-character-debug-vector': 'velocity'})).toHaveLength(1);
        expect(component.root.findAllByProps({'data-ngvge-character-debug-vector': 'floor-normal'})).toHaveLength(1);
        expect(component.root.findAllByProps({'data-ngvge-character-debug-vector': 'wall-normal'})).toHaveLength(1);
        expect(component.root.findAllByProps({'data-ngvge-character-debug-anchor': 'last-safe'})).toHaveLength(1);
    });

});
