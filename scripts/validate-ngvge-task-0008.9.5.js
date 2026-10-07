#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {createModuleManager} = require('../src/lib/first-party-modules/module-manager');
const {
    RUNTIME_ERROR_CONTRACT_ID,
    RUNTIME_ERROR_LOCAL_DIAGNOSTIC_FIELDS,
    RUNTIME_ERROR_PUBLIC_FIELDS,
    getRuntimeErrorLocalDiagnostics,
    isRuntimeBoundaryError,
    toRuntimeErrorPublicRecord
} = require('../src/lib/runtime-errors');
const {
    MODULE_AVAILABILITY,
    MODULE_KINDS,
    MODULE_PERMISSIONS
} = require('../src/lib/first-party-modules/constants');

const manifest = id => ({
    apiVersion: '1',
    availability: MODULE_AVAILABILITY.AVAILABLE,
    capabilities: [],
    defaultEnabled: false,
    dependencies: [],
    description: `${id} validation module.`,
    id,
    kind: MODULE_KINDS.FIRST_PARTY,
    name: id,
    permissions: [MODULE_PERMISSIONS.RUNTIME],
    version: '1'
});

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

let boundaryError = null;
manager.registerModule({
    manifest: manifest('test.runtime-error-contract'),
    hooks: {
        initialize: context => {
            try {
                context.getService('secure').boom();
            } catch (error) {
                boundaryError = error;
            }
        }
    }
});
assert.strictEqual(manager.initializeModule('test.runtime-error-contract'), true);
assert.strictEqual(RUNTIME_ERROR_CONTRACT_ID, 'ngvge.runtime-error@1');
assert.strictEqual(isRuntimeBoundaryError(boundaryError), true);
assert.strictEqual(Object.isFrozen(boundaryError), true);
assert.strictEqual(boundaryError.cause, undefined);

const publicRecord = toRuntimeErrorPublicRecord(boundaryError);
assert.deepStrictEqual(Object.keys(publicRecord), Array.from(RUNTIME_ERROR_PUBLIC_FIELDS));
assert.strictEqual(publicRecord.name, 'ModuleBoundaryError');
assert.strictEqual(publicRecord.code, 'MODULE_SERVICE_HOST_OPERATION_FAILED');
assert.strictEqual(publicRecord.direction, 'host-to-module');
assert.strictEqual(publicRecord.operation, 'call:boom');
assert.strictEqual(publicRecord.serviceId, 'secure');
assert.strictEqual(publicRecord.stack, undefined);
assert.strictEqual(publicRecord.cause, undefined);
assert.strictEqual(publicRecord.portableDetails.remoteMessage, 'ORIGINAL_THROWN_MESSAGE');
assert.strictEqual(publicRecord.portableDetails.remoteCode, 'ORIGINAL_THROWN_CODE');
assert.strictEqual(publicRecord.portableDetails.secret, undefined);
assert.strictEqual(publicRecord.portableDetails.details.infinite, '[number:Infinity]');
assert.strictEqual(publicRecord.portableDetails.details.nan, '[number:NaN]');
assert.strictEqual(publicRecord.portableDetails.details.negativeZero, 0);
assert.deepStrictEqual(publicRecord.portableDetails.details.sparse, ['[hole]', 'value']);
assert.strictEqual(Object.isFrozen(publicRecord), true);
assert.strictEqual(Object.isFrozen(publicRecord.portableDetails), true);
const publicJson = JSON.stringify(publicRecord);
assert.strictEqual(JSON.stringify(JSON.parse(publicJson)), publicJson);
assert.strictEqual(publicJson.includes('"stack"'), false);
assert.strictEqual(publicJson.includes('"cause"'), false);
const publicRuntimeErrorApi = require('../src/lib/runtime-errors');
assert.strictEqual(publicRuntimeErrorApi.createRuntimeBoundaryError, undefined);
assert.strictEqual(publicRuntimeErrorApi.sanitizePortableDiagnostic, undefined);

const diagnostics = getRuntimeErrorLocalDiagnostics(boundaryError);
assert.deepStrictEqual(Object.keys(diagnostics), Array.from(RUNTIME_ERROR_LOCAL_DIAGNOSTIC_FIELDS));
assert.strictEqual(Object.isFrozen(diagnostics), true);
assert.ok(diagnostics.stack === null || typeof diagnostics.stack === 'string');
if (typeof diagnostics.stack === 'string') {
    assert.ok(diagnostics.stack.includes('ModuleBoundaryError'));
    assert.strictEqual(diagnostics.stack.includes('ORIGINAL_THROWN_MESSAGE'), false);
}

const ownKeys = Reflect.ownKeys(boundaryError);
if (ownKeys.includes('stack')) {
    assert.strictEqual(RUNTIME_ERROR_PUBLIC_FIELDS.includes('stack'), false);
    const descriptor = Reflect.getOwnPropertyDescriptor(boundaryError, 'stack');
    assert.ok(descriptor);
    assert.strictEqual(descriptor.enumerable, false);
}

assert.throws(
    () => toRuntimeErrorPublicRecord(new Error('arbitrary')),
    error => error && error.code === 'RUNTIME_ERROR_CONTRACT_INVALID_ERROR'
);
assert.throws(
    () => getRuntimeErrorLocalDiagnostics({code: 'fake'}),
    error => error && error.code === 'RUNTIME_ERROR_CONTRACT_INVALID_ERROR'
);

manager.dispose();
console.log('NGVGE TASK 0008.9.5 runtime error and diagnostic contract validation passed.');
