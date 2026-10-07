const {createModuleManager} = require('../../../../src/lib/first-party-modules/module-manager');
const {
    RUNTIME_ERROR_CONTRACT_ID,
    RUNTIME_ERROR_LOCAL_DIAGNOSTIC_FIELDS,
    RUNTIME_ERROR_PUBLIC_FIELDS,
    getRuntimeErrorLocalDiagnostics,
    isRuntimeBoundaryError,
    toRuntimeErrorPublicRecord
} = require('../../../../src/lib/runtime-errors');
const {
    MODULE_AVAILABILITY,
    MODULE_KINDS,
    MODULE_PERMISSIONS
} = require('../../../../src/lib/first-party-modules/constants');

const createManifest = id => ({
    apiVersion: '1',
    availability: MODULE_AVAILABILITY.AVAILABLE,
    capabilities: [],
    defaultEnabled: false,
    dependencies: [],
    description: `${id} test module.`,
    id,
    kind: MODULE_KINDS.FIRST_PARTY,
    name: id,
    permissions: [MODULE_PERMISSIONS.RUNTIME],
    version: '1'
});

const captureBoundaryError = () => {
    const original = new Error('ORIGINAL_THROWN_MESSAGE');
    original.code = 'ORIGINAL_THROWN_CODE';
    original.secret = {mutable: true};
original.portableDetails = {
    infinite: Infinity,
    nan: NaN,
    negativeZero: -0,
    sparse: [, 'value']
};
    const manager = createModuleManager({
        services: {
            secure: {
                permission: MODULE_PERMISSIONS.RUNTIME,
                value: {
                    boom () {
                        throw original;
                    }
                }
            }
        }
    });
    let captured = null;
    manager.registerModule({
        manifest: createManifest('runtime-error-consumer'),
        hooks: {
            initialize: context => {
                try {
                    context.getService('secure').boom();
                } catch (error) {
                    captured = error;
                }
            }
        }
    });
    manager.initializeModule('runtime-error-consumer');
    return {captured, manager, original};
};

describe('0008.9.5 Runtime Error and Diagnostic Contract', () => {
    test('normative public record excludes runtime-local stack and raw cause', () => {
        const {captured, manager, original} = captureBoundaryError();
        expect(RUNTIME_ERROR_CONTRACT_ID).toBe('ngvge.runtime-error@1');
        expect(isRuntimeBoundaryError(captured)).toBe(true);

        const record = toRuntimeErrorPublicRecord(captured);
        expect(Object.keys(record)).toEqual(RUNTIME_ERROR_PUBLIC_FIELDS);
        expect(record).toEqual({
            name: 'ModuleBoundaryError',
            message: expect.any(String),
            code: 'MODULE_SERVICE_HOST_OPERATION_FAILED',
            direction: 'host-to-module',
            operation: 'call:boom',
            serviceId: 'secure',
            portableDetails: expect.objectContaining({
                remoteCode: 'ORIGINAL_THROWN_CODE',
                remoteMessage: 'ORIGINAL_THROWN_MESSAGE',
                thrownType: 'object'
            })
        });
        expect(record.stack).toBeUndefined();
        expect(record.cause).toBeUndefined();
        expect(JSON.stringify(record)).not.toContain('stack');
        const serialized = JSON.stringify(record);
        expect(JSON.stringify(JSON.parse(serialized))).toBe(serialized);
        expect(Object.isFrozen(record)).toBe(true);
        expect(Object.isFrozen(record.portableDetails)).toBe(true);
        expect(record.portableDetails).not.toBe(original);
        expect(record.portableDetails.secret).toBeUndefined();
        expect(record.portableDetails.details).toEqual({
            infinite: '[number:Infinity]',
            nan: '[number:NaN]',
            negativeZero: 0,
            sparse: ['[hole]', 'value']
        });
        manager.dispose();
    });

    test('local diagnostics may expose the boundary error own stack without changing the portable contract', () => {
        const {captured, manager} = captureBoundaryError();
        const diagnostics = getRuntimeErrorLocalDiagnostics(captured);
        expect(Object.keys(diagnostics)).toEqual(RUNTIME_ERROR_LOCAL_DIAGNOSTIC_FIELDS);
        expect(Object.isFrozen(diagnostics)).toBe(true);
        expect(diagnostics.stack === null || typeof diagnostics.stack === 'string').toBe(true);
        if (typeof diagnostics.stack === 'string') {
            expect(diagnostics.stack).toContain('ModuleBoundaryError');
            expect(diagnostics.stack).not.toContain('ORIGINAL_THROWN_MESSAGE');
        }
        expect(toRuntimeErrorPublicRecord(captured).stack).toBeUndefined();
        manager.dispose();
    });

    test('only runtime-created boundary errors can be projected through the contract helpers', () => {
        const arbitrary = new Error('arbitrary');
        expect(isRuntimeBoundaryError(arbitrary)).toBe(false);
        expect(() => toRuntimeErrorPublicRecord(arbitrary)).toThrow(
            expect.objectContaining({code: 'RUNTIME_ERROR_CONTRACT_INVALID_ERROR'})
        );
        expect(() => getRuntimeErrorLocalDiagnostics(arbitrary)).toThrow(
            expect.objectContaining({code: 'RUNTIME_ERROR_CONTRACT_INVALID_ERROR'})
        );
    });
});
