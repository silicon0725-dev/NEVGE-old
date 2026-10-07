const {
    COLLABORATION_OPERATION_ORIGINS,
    COLLABORATION_OPERATION_SCHEMA,
    COLLABORATION_OPERATION_TYPES,
    createCollaborationOperation
} = require('../../../../src/lib/collaboration-semantic');

describe('COL-0 collaboration operation DTO', () => {
    test('creates a frozen portable NodeId-based operation', () => {
        const operation = createCollaborationOperation(
            COLLABORATION_OPERATION_TYPES.NODE_RENAME,
            {name: 'Remote Sprite', nodeId: 'node:sprite:1'},
            {operationId: 'op:1', origin: COLLABORATION_OPERATION_ORIGINS.REMOTE, senderId: 'peer:a'}
        );
        expect(operation).toMatchObject({
            operationId: 'op:1',
            origin: COLLABORATION_OPERATION_ORIGINS.REMOTE,
            schema: COLLABORATION_OPERATION_SCHEMA,
            senderId: 'peer:a',
            type: COLLABORATION_OPERATION_TYPES.NODE_RENAME
        });
        expect(operation.payload).toEqual({name: 'Remote Sprite', nodeId: 'node:sprite:1'});
        expect(Object.isFrozen(operation)).toBe(true);
        expect(Object.isFrozen(operation.payload)).toBe(true);
    });

    test('rejects volatile Scratch/backend identity from semantic DTOs', () => {
        expect(() => createCollaborationOperation(
            COLLABORATION_OPERATION_TYPES.NODE_DESTROY,
            {nodeId: 'node:sprite:1', targetId: 'scratch-target-volatile'}
        )).toThrow(expect.objectContaining({code: 'NGVGE_COLLABORATION_BACKEND_IDENTITY_FORBIDDEN'}));
        expect(() => createCollaborationOperation(
            COLLABORATION_OPERATION_TYPES.NODE_RENAME,
            {name: 'X', nodeId: 'node:sprite:1', nested: {renderer: {}}}
        )).toThrow(expect.objectContaining({code: 'NGVGE_COLLABORATION_BACKEND_IDENTITY_FORBIDDEN'}));
    });
});
