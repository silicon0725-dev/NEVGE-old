const {
    CAMERA2D_SCRATCH_EXTENSION_ID,
    Camera2DScratchExtension,
    installCamera2DScratchBlocks
} = require('../../../../src/lib/camera-system');

const makeVM = capability => {
    const extensionManager = {_registerInternalExtension: jest.fn(() => 'ngvge.camera2d.service')};
    return {
        extensionManager,
        runtime: {
            ioDevices: {mouse: {getScratchX: () => 12, getScratchY: () => -8}},
            ngvgeFirstPartyModules: {getCapability: () => capability}
        }
    };
};

describe('WS-10N4 Camera2D Scratch blocks projection', () => {
    test('registers once as an internal Scratch compatibility extension', () => {
        const vm = makeVM(null);
        const first = installCamera2DScratchBlocks(vm);
        const second = installCamera2DScratchBlocks(vm);
        expect(first.extensionId).toBe(CAMERA2D_SCRATCH_EXTENSION_ID);
        expect(second).toBe(first);
        expect(vm.extensionManager._registerInternalExtension).toHaveBeenCalledTimes(1);
    });

    test('projects runtime Camera operations without persisting backend identity', () => {
        const capability = {
            getCamera: jest.fn(() => ({
                config: {enabled: true, offset: [0, 0], priority: 0, zoom: [2, 3]},
                transform: {position: [4, 5], rotation: 6, scale: [1, 1]}
            })),
            listCameras: jest.fn(() => [{name: 'Main', nodeId: 'camera-node'}]),
            patchRuntimeCamera: jest.fn(),
            patchRuntimeTransform: jest.fn(),
            screenToWorld: jest.fn(() => [100, 200])
        };
        const vm = makeVM(capability);
        const extension = new Camera2DScratchExtension(vm);
        expect(extension.getInfo().id).toBe(CAMERA2D_SCRATCH_EXTENSION_ID);
        expect(extension._cameraMenu()).toEqual([{text: 'Main', value: 'camera-node'}]);

        extension.setPosition({CAMERA: 'camera-node', X: 10, Y: -20});
        extension.setRotation({CAMERA: 'camera-node', ROTATION: 45});
        extension.setZoom({CAMERA: 'camera-node', X: 4, Y: 5});
        extension.setEnabled({CAMERA: 'camera-node', ENABLED: 'false'});

        expect(capability.patchRuntimeTransform).toHaveBeenNthCalledWith(1, 'camera-node', {position: [10, -20]});
        expect(capability.patchRuntimeTransform).toHaveBeenNthCalledWith(2, 'camera-node', {rotation: 45});
        expect(capability.patchRuntimeCamera).toHaveBeenNthCalledWith(1, 'camera-node', {zoom: [4, 5]});
        expect(capability.patchRuntimeCamera).toHaveBeenNthCalledWith(2, 'camera-node', {enabled: false});
        expect(extension.cameraX({CAMERA: 'camera-node'})).toBe(4);
        expect(extension.cameraZoomY({CAMERA: 'camera-node'})).toBe(3);
        expect(extension.mouseWorldX()).toBe(100);
        expect(extension.mouseWorldY()).toBe(200);
        expect(capability.screenToWorld).toHaveBeenCalledWith([12, -8]);
    });
});
