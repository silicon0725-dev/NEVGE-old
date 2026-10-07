import {sanitizePayload, validatePayload} from '../../../../src/lib/collaboration/message-validator';

describe('COL-0 legacy wire semantic identity migration', () => {
    test('accepts NodeId as primary target-switch identity without requiring Scratch targetId', () => {
        expect(validatePayload('target-switch', {nodeId: 'node:sprite:1', userId: 'peer:a'})).toEqual({valid: true});
    });

    test('preserves NodeId and currentEditingNodeId through legacy wire sanitizer', () => {
        expect(sanitizePayload('target-switch', {
            currentEditingNodeId: 'node:sprite:1',
            nodeId: 'node:sprite:1',
            targetId: 'legacy-target',
            unknownBackendHandle: 'remove-me'
        })).toEqual({
            currentEditingNodeId: 'node:sprite:1',
            nodeId: 'node:sprite:1',
            targetId: 'legacy-target'
        });
    });
});
