'use strict';

const {
    CHARACTER_CONTROLLER2D_CONTRACT,
    CHARACTER_CONTROLLER2D_TYPE_ID,
    applyCharacterController2DPatch,
    createCharacterController2DPatchComponentCommand,
    normalizeCharacterController2D,
    normalizeCharacterController2DPatch
} = require('../../../../src/core/character-controller2d');
const {PROTOCOL_DTO_KINDS} = require('../../../../src/core/protocol');

describe('WS-10N6 CharacterController2D core contract', () => {
    test('owns kinematic semantics without Rigidbody/backend identity', () => {
        expect(CHARACTER_CONTROLLER2D_CONTRACT.typeId).toBe(CHARACTER_CONTROLLER2D_TYPE_ID);
        expect(CHARACTER_CONTROLLER2D_CONTRACT.persistence).toEqual({
            nativeProject: '.ne',
            scratchProjection: 'native-only'
        });
        expect(CHARACTER_CONTROLLER2D_CONTRACT.identity.backendHandlePersistent).toBe(false);
        expect(CHARACTER_CONTROLLER2D_CONTRACT.movement.fullRigidBodyRequired).toBe(false);
        expect(CHARACTER_CONTROLLER2D_CONTRACT.movement.runtimeTransformWriter).toBe('Transform2DRuntimeStore');
        expect(CHARACTER_CONTROLLER2D_CONTRACT.movement.stableSurfaceSelection)
            .toBe('alignment + previous-contact stability');
        expect(CHARACTER_CONTROLLER2D_CONTRACT.runtimeState.lastSafeTransformPersistent).toBe(false);
        expect(CHARACTER_CONTROLLER2D_CONTRACT.runtimeState.recoveryPersistent).toBe(false);
        expect(CHARACTER_CONTROLLER2D_CONTRACT.runtimeState.velocityPersistent).toBe(false);
    });

    test('normalizes deterministic P0 movement defaults', () => {
        expect(normalizeCharacterController2D()).toEqual({
            floorSnapLength: 6,
            maxSlides: 4,
            maxSlopeDegrees: 45,
            safeMargin: 0.01,
            stepHeight: 0,
            upDirection: [0, 1]
        });
    });

    test('normalizes up direction and rejects unsupported persistent runtime state', () => {
        expect(normalizeCharacterController2DPatch({upDirection: [0, 4]}).upDirection).toEqual([0, 1]);
        expect(() => normalizeCharacterController2DPatch({velocity: [1, 2]})).toThrow(expect.objectContaining({
            code: 'NGVGE_CHARACTER_CONTROLLER2D_PATCH_FIELD_UNSUPPORTED'
        }));
        expect(() => normalizeCharacterController2DPatch({upDirection: [0, 0]})).toThrow(expect.objectContaining({
            code: 'NGVGE_CHARACTER_CONTROLLER2D_UP_DIRECTION_ZERO'
        }));
    });

    test('applies slope/snap/step patches within the frozen ranges', () => {
        expect(applyCharacterController2DPatch(normalizeCharacterController2D(), {
            floorSnapLength: 12,
            maxSlides: 6,
            maxSlopeDegrees: 55,
            safeMargin: 0.2,
            stepHeight: 8
        })).toEqual(expect.objectContaining({
            floorSnapLength: 12,
            maxSlides: 6,
            maxSlopeDegrees: 55,
            safeMargin: 0.2,
            stepHeight: 8
        }));
    });

    test('creates semantic PatchCharacterController2D protocol commands', () => {
        const command = createCharacterController2DPatchComponentCommand({
            componentId: 'component:character',
            nodeId: 'node:player',
            patch: {maxSlopeDegrees: 50}
        });
        expect(command.kind).toBe(PROTOCOL_DTO_KINDS.COMMAND);
        expect(command.type).toBe('PatchCharacterController2D');
        expect(command.payload).toEqual(expect.objectContaining({
            componentId: 'component:character',
            nodeId: 'node:player',
            patch: {maxSlopeDegrees: 50}
        }));
    });
});
