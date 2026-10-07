'use strict';

const {
    COLLIDER2D_COMMAND_CAPABILITY_ID,
    createCollider2DCommandCapability,
    createCollider2DCommandExecutor,
    createCollider2DEditorClient
} = require('../../../../src/lib/collision-system');
const {PROTOCOL_DTO_KINDS} = require('../../../../src/core/protocol');

describe('WS-10N5 Collider2D command capability', () => {
    test('routes semantic editor patches to Collider2D runtime persistence authority', () => {
        const component = {id: 'component:collider', typeId: 'ngvge.collider2d'};
        const runtimeNodeModel = {
            getNodeSnapshot: () => ({components: [component], id: 'node:area'})
        };
        const colliderRuntimeService = {
            patchPersistentCollider: jest.fn(() => ({sensor: false}))
        };
        const capability = createCollider2DCommandCapability(
            createCollider2DCommandExecutor(runtimeNodeModel, colliderRuntimeService)
        );
        const client = createCollider2DEditorClient(capability);
        const result = client.patchComponent({
            componentId: component.id,
            nodeId: 'node:area',
            patch: {sensor: false}
        });
        expect(capability.capabilityId).toBe(COLLIDER2D_COMMAND_CAPABILITY_ID);
        expect(result.kind).toBe(PROTOCOL_DTO_KINDS.EVENT);
        expect(result.type).toBe('Collider2DPatchApplied');
        expect(colliderRuntimeService.patchPersistentCollider).toHaveBeenCalledWith(
            'node:area', {sensor: false}, expect.any(Object)
        );
    });

    test('fails closed when component identity does not match the Node', () => {
        const runtimeNodeModel = {getNodeSnapshot: () => ({components: [], id: 'node:area'})};
        const capability = createCollider2DCommandCapability(createCollider2DCommandExecutor(runtimeNodeModel, {
            patchPersistentCollider: jest.fn()
        }));
        const result = createCollider2DEditorClient(capability).patchComponent({
            componentId: 'wrong',
            nodeId: 'node:area',
            patch: {sensor: false}
        });
        expect(result.kind).toBe(PROTOCOL_DTO_KINDS.ERROR);
        expect(result.code).toBe('NGVGE_COLLIDER2D_COMMAND_TARGET_INVALID');
    });
});
