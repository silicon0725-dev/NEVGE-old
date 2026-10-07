'use strict';

const {
    CHARACTER_CONTROLLER2D_COMMAND_CAPABILITY_ID,
    createCharacterController2DCommandCapability,
    createCharacterController2DCommandExecutor,
    createCharacterController2DEditorClient
} = require('../../../../src/lib/character-controller-system');
const {PROTOCOL_DTO_KINDS} = require('../../../../src/core/protocol');

describe('WS-10N6 CharacterController2D command capability', () => {
    test('routes semantic editor config patches without runtime velocity persistence', () => {
        const component = {id: 'component:character', typeId: 'ngvge.character-controller2d'};
        const runtimeNodeModel = {getNodeSnapshot: () => ({components: [component], id: 'node:player'})};
        const runtimeService = {patchPersistentController: jest.fn(() => ({maxSlopeDegrees: 55}))};
        const capability = createCharacterController2DCommandCapability(
            createCharacterController2DCommandExecutor(runtimeNodeModel, runtimeService)
        );
        const result = createCharacterController2DEditorClient(capability).patchComponent({
            componentId: component.id,
            nodeId: 'node:player',
            patch: {maxSlopeDegrees: 55}
        });
        expect(capability.capabilityId).toBe(CHARACTER_CONTROLLER2D_COMMAND_CAPABILITY_ID);
        expect(result.kind).toBe(PROTOCOL_DTO_KINDS.EVENT);
        expect(result.type).toBe('CharacterController2DPatchApplied');
        expect(runtimeService.patchPersistentController).toHaveBeenCalledWith(
            'node:player', {maxSlopeDegrees: 55}, expect.any(Object)
        );
    });

    test('fails closed on component identity mismatch', () => {
        const capability = createCharacterController2DCommandCapability(createCharacterController2DCommandExecutor(
            {getNodeSnapshot: () => ({components: [], id: 'node:player'})},
            {patchPersistentController: jest.fn()}
        ));
        const result = createCharacterController2DEditorClient(capability).patchComponent({
            componentId: 'wrong',
            nodeId: 'node:player',
            patch: {floorSnapLength: 8}
        });
        expect(result.kind).toBe(PROTOCOL_DTO_KINDS.ERROR);
        expect(result.code).toBe('NGVGE_CHARACTER_CONTROLLER2D_COMMAND_TARGET_INVALID');
    });
});
