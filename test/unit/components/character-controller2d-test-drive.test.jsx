import React from 'react';
import renderer, {act} from 'react-test-renderer';

import CharacterController2DTestDrive from '../../../src/components/stage/character-controller2d-test-drive.jsx';
import {CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_ID} from '../../../src/lib/character-controller-system';
import {getCharacterTestDrive} from '../../../src/lib/editor-visualization';

const mounted = [];
afterEach(() => {
    while (mounted.length) act(() => mounted.pop().unmount());
});

const makeVM = () => {
    const characterRuntime = {
        getController: jest.fn(() => ({
            active: true,
            config: {upDirection: [0, 1]},
            nodeId: 'player',
            state: {onFloor: false, velocity: [0, 0]}
        })),
        getVelocity: jest.fn(() => [0, 0]),
        moveUsingVelocity: jest.fn(),
        setVelocity: jest.fn()
    };
    const runtime = {
        ngvgeFirstPartyModules: {
            getCapability: id => id === CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_ID ? characterRuntime : null
        }
    };
    return {characterRuntime, runtime, vm: {runtime}};
};

describe('WS-10N6-HF4 CharacterBody2D editor test-drive stage host', () => {
    test('shows explicit editor-only test-drive feedback while a Character is active', () => {
        const {runtime, vm} = makeVM();
        getCharacterTestDrive(runtime).start('player');
        let component;
        act(() => {
            component = renderer.create(<CharacterController2DTestDrive vm={vm} />);
        });
        mounted.push(component);
        expect(component.root.findByProps({'data-ngvge-character-test-drive': 'true'}).children.join('')).toContain('Test Drive');
    });
});
