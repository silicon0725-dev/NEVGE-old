'use strict';

const {
    COLLIDER2D_RUNTIME_CAPABILITY_ID,
    COLLIDER2D_SCRATCH_EXTENSION_ID,
    Collider2DScratchExtension,
    installCollider2DScratchBlocks
} = require('../../../../src/lib/collision-system');

const makeVM = capability => {
    const registered = [];
    const manager = {getCapability: jest.fn(id => id === COLLIDER2D_RUNTIME_CAPABILITY_ID ? capability : null)};
    return {
        extensionManager: {
            _registerInternalExtension: jest.fn(extension => {
                registered.push(extension);
                return 'ngvge-collider-service';
            })
        },
        runtime: {ngvgeFirstPartyModules: manager},
        registered
    };
};

describe('WS-10N5 Collider2D Scratch blocks', () => {
    test('exposes overlap, point and ray queries without persistent mutation authority', () => {
        const capability = {
            getCollider: jest.fn(id => ({config: {sensor: id === 'area'}})),
            getOverlaps: jest.fn(() => ['other']),
            listColliders: jest.fn(() => [
                {config: {sensor: true}, name: 'Area', nodeId: 'area'},
                {config: {sensor: false}, name: 'Solid', nodeId: 'solid'}
            ]),
            overlaps: jest.fn(() => true),
            queryPoint: jest.fn(() => [{nodeId: 'area'}]),
            raycast: jest.fn(() => ({nodeId: 'solid', point: [4, 5]}))
        };
        const vm = makeVM(capability);
        const extension = new Collider2DScratchExtension(vm);
        expect(extension.getInfo().id).toBe(COLLIDER2D_SCRATCH_EXTENSION_ID);
        expect(extension.collidersOverlap({A: 'area', B: 'solid'})).toBe(true);
        expect(extension.pointInside({X: 0, Y: 0, COLLIDER: 'area'})).toBe(true);
        expect(extension.overlapCount({COLLIDER: 'area'})).toBe(1);
        expect(extension.rayHitNode({X1: 0, Y1: 0, X2: 10, Y2: 0})).toBe('solid');
        expect(extension.rayHitX({X1: 0, Y1: 0, X2: 10, Y2: 0})).toBe(4);
    });

    test('registers once per raw VM', () => {
        const vm = makeVM({listColliders: () => []});
        const first = installCollider2DScratchBlocks(vm);
        const second = installCollider2DScratchBlocks(vm);
        expect(first).toBe(second);
        expect(vm.extensionManager._registerInternalExtension).toHaveBeenCalledTimes(1);
    });
});
