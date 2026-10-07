'use strict';

const {
    createRigidBody2DCommandCapability,
    createRigidBody2DCommandExecutor,
    createRigidBody2DEditorClient
} = require('../../../../src/lib/physics-system');

describe('WS-10N8 RigidBody2D command capability', () => {
    test('routes editor patches to the semantic component id and rejects target mismatches', () => {
        const node = {components: [{id: 'rigid-1', typeId: 'ngvge.rigidbody2d'}], id: 'body'};
        const runtimeNodeModel = {getNodeSnapshot: id => id === 'body' ? node : null};
        const physicsRuntime = {patchPersistentRigidBody: jest.fn(() => ({mass: 2}))};
        const capability = createRigidBody2DCommandCapability(createRigidBody2DCommandExecutor(runtimeNodeModel, physicsRuntime));
        const client = createRigidBody2DEditorClient(capability);
        const result = client.patchComponent({componentId: 'rigid-1', nodeId: 'body', patch: {mass: 2}});
        expect(result.kind).toBe('event');
        expect(physicsRuntime.patchPersistentRigidBody).toHaveBeenCalledWith('body', {mass: 2}, expect.any(Object));

        const invalid = client.patchComponent({componentId: 'wrong', nodeId: 'body', patch: {mass: 3}});
        expect(invalid.kind).toBe('error');
        expect(invalid.code).toBe('NGVGE_RIGIDBODY2D_COMMAND_TARGET_INVALID');
    });
});
