'use strict';

const {
    CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_ID,
    CHARACTER_CONTROLLER2D_SCRATCH_EXTENSION_ID,
    CharacterController2DScratchExtension,
    installCharacterController2DScratchBlocks
} = require('../../../../src/lib/character-controller-system');

const makeVM = capability => {
    const manager = {getCapability: jest.fn(id => id === CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_ID ? capability : null)};
    return {
        extensionManager: {_registerInternalExtension: jest.fn(() => 'ngvge-character-service')},
        runtime: {ngvgeFirstPartyModules: manager}
    };
};

describe('WS-10N6 CharacterController2D Scratch blocks', () => {
    test('exposes kinematic runtime movement/state without persistent config mutation', () => {
        const capability = {
            getController: jest.fn(() => ({
                state: {
                    collisions: [{nodeId: 'wall'}],
                    floorNodeId: 'floor',
                    floorNormal: [0, 1],
                    onFloor: true,
                    onWall: false,
                    velocity: [10, -20],
                    wallNormal: [0, 0]
                }
            })),
            listControllers: jest.fn(() => [{name: 'Player', nodeId: 'player'}]),
            moveAndCollide: jest.fn(),
            moveAndSlide: jest.fn(),
            moveUsingVelocity: jest.fn(),
            setVelocity: jest.fn()
        };
        const extension = new CharacterController2DScratchExtension(makeVM(capability));
        expect(extension.getInfo().id).toBe(CHARACTER_CONTROLLER2D_SCRATCH_EXTENSION_ID);
        extension.setVelocity({CHARACTER: 'player', X: 3, Y: 4});
        extension.moveAndCollide({CHARACTER: 'player', X: 5, Y: 0});
        extension.moveAndSlide({CHARACTER: 'player', X: 8, Y: -2});
        extension.moveUsingVelocity({CHARACTER: 'player', DELTA: 0.5});
        expect(capability.setVelocity).toHaveBeenCalledWith('player', [3, 4]);
        expect(capability.moveAndCollide).toHaveBeenCalledWith('player', [5, 0]);
        expect(capability.moveAndSlide).toHaveBeenCalledWith('player', [8, -2]);
        expect(capability.moveUsingVelocity).toHaveBeenCalledWith('player', 0.5);
        expect(extension.velocityX({CHARACTER: 'player'})).toBe(10);
        expect(extension.velocityY({CHARACTER: 'player'})).toBe(-20);
        expect(extension.isOnFloor({CHARACTER: 'player'})).toBe(true);
        expect(extension.floorNormalY({CHARACTER: 'player'})).toBe(1);
        expect(extension.lastCollisionNode({CHARACTER: 'player'})).toBe('wall');
        expect(extension.floorNode({CHARACTER: 'player'})).toBe('floor');
    });

    test('registers once per raw VM', () => {
        const vm = makeVM({listControllers: () => []});
        const first = installCharacterController2DScratchBlocks(vm);
        const second = installCharacterController2DScratchBlocks(vm);
        expect(first).toBe(second);
        expect(vm.extensionManager._registerInternalExtension).toHaveBeenCalledTimes(1);
    });
});
