const {
    CAMERA2D_PATCH_APPLIED_EVENT_TYPE,
    CAMERA2D_TYPE_ID,
    createCamera2DPatchComponentCommand
} = require('../../../../src/core/camera2d');
const {
    CAMERA2D_COMMAND_CAPABILITY_ID,
    createCamera2DCommandCapability,
    createCamera2DCommandExecutor,
    createCamera2DEditorClient
} = require('../../../../src/lib/camera-system');

const runtimeNodeModel = component => ({
    getNodeSnapshot: jest.fn(() => ({components: [component], id: 'camera-node'}))
});

describe('WS-10N4 Camera2D command capability', () => {
    test('routes an editor semantic patch through the Camera runtime service', () => {
        const component = {id: 'camera-component', typeId: CAMERA2D_TYPE_ID, data: {enabled: true, offset: [0, 0], priority: 0, zoom: [1, 1]}};
        const cameraRuntimeService = {
            patchPersistentCamera: jest.fn((nodeId, patch) => Object.assign({}, component.data, patch))
        };
        const capability = createCamera2DCommandCapability(createCamera2DCommandExecutor(
            runtimeNodeModel(component),
            cameraRuntimeService
        ));
        const result = createCamera2DEditorClient(capability).patchComponent({
            componentId: component.id,
            nodeId: 'camera-node',
            patch: {priority: 2}
        });
        expect(capability.capabilityId).toBe(CAMERA2D_COMMAND_CAPABILITY_ID);
        expect(result.kind).toBe('event');
        expect(result.type).toBe(CAMERA2D_PATCH_APPLIED_EVENT_TYPE);
        expect(cameraRuntimeService.patchPersistentCamera).toHaveBeenCalledWith(
            'camera-node',
            {priority: 2},
            expect.objectContaining({transactionId: expect.any(String)})
        );
    });

    test('fails closed when command component identity does not match the semantic node', () => {
        const component = {id: 'camera-component', typeId: CAMERA2D_TYPE_ID, data: {enabled: true, offset: [0, 0], priority: 0, zoom: [1, 1]}};
        const capability = createCamera2DCommandCapability(createCamera2DCommandExecutor(
            runtimeNodeModel(component),
            {patchPersistentCamera: jest.fn()}
        ));
        const result = capability.executeCommand(createCamera2DPatchComponentCommand({
            componentId: 'wrong-component',
            nodeId: 'camera-node',
            patch: {enabled: false}
        }));
        expect(result.kind).toBe('error');
        expect(result.code || (result.payload && result.payload.code)).toBeDefined();
    });
});
