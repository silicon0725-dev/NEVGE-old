import {
    formatRuntimeNodeError,
    presentRuntimeNodeError
} from '../../../../src/lib/runtime-nodes';

describe('Runtime node error presenter', () => {
    test('turns structured runtime errors into actionable editor messages', () => {
        const error = Object.assign(new Error('Duplicate type'), {
            code: 'RUNTIME_NODE_TYPE_ALREADY_EXISTS'
        });
        const presented = presentRuntimeNodeError(error, {
            action: 'register',
            typeId: 'plugin.enemy'
        });

        expect(presented).toMatchObject({
            code: 'RUNTIME_NODE_TYPE_ALREADY_EXISTS',
            title: 'Unable to register runtime node type'
        });
        expect(presented.message).toContain('plugin.enemy');
        expect(presented.suggestion).toMatch(/unique type ID/i);
        expect(formatRuntimeNodeError(error, {action: 'register'})).toContain('Duplicate type');
    });
});
