'use strict';
const {
    PHYSICS2D_BACKEND_CONTRACT_ID,
    PHYSICS2D_CONTRACT,
    PHYSICS2D_DEFAULT_SETTINGS,
    normalizePhysics2DSettings
} = require('../../../../src/core/physics2d');

describe('WS-10N8 Physics2D contract', () => {
    test('owns semantics while backend handles stay private and replaceable', () => {
        expect(PHYSICS2D_CONTRACT.contractId).toBe('ngvge.physics2d-contract');
        expect(PHYSICS2D_CONTRACT.backend.contractId).toBe(PHYSICS2D_BACKEND_CONTRACT_ID);
        expect(PHYSICS2D_CONTRACT.backend.replaceable).toBe(true);
        expect(PHYSICS2D_CONTRACT.identity.backendRigidBodyHandlePersistent).toBe(false);
        expect(PHYSICS2D_CONTRACT.identity.backendColliderHandlePersistent).toBe(false);
        expect(PHYSICS2D_CONTRACT.transform.runtimeAuthority).toBe('Transform2DRuntimeStore');
        expect(PHYSICS2D_CONTRACT.transform.dynamicRuntimeWritesPersistentProject).toBe(false);
    });
    test('normalizes fixed-step settings without tying them to editor framerate', () => {
        expect(PHYSICS2D_DEFAULT_SETTINGS.fixedDeltaSeconds).toBeCloseTo(1 / 60);
        expect(normalizePhysics2DSettings({gravity: [1, -1200], maxCatchUpSteps: 4})).toEqual(expect.objectContaining({
            gravity: [1, -1200], maxCatchUpSteps: 4
        }));
    });
});
