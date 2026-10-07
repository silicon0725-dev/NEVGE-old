#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
    PersistentDTOValidationError,
    clonePersistentDTO,
    validatePersistentDTO
} = require('../../src/core/persistent');

const expectRejected = (value, code) => {
    const result = validatePersistentDTO(value);
    assert.strictEqual(result.valid, false);
    assert(result.issues.some(issue => issue.code === code), JSON.stringify(result.issues));
    assert.throws(() => clonePersistentDTO(value), PersistentDTOValidationError);
};

assert.strictEqual(validatePersistentDTO({plain: [1, true, null, 'x']}).valid, true);
expectRejected({value: undefined}, 'persistent.value.undefined');
expectRejected({value: () => true}, 'persistent.value.function');
expectRejected({value: Symbol('x')}, 'persistent.value.symbol');
expectRejected({value: BigInt(1)}, 'persistent.value.bigint');
expectRejected({value: Number.NaN}, 'persistent.number.non-finite');
expectRejected({value: new Date(0)}, 'persistent.object.non-plain');
expectRejected({value: Promise.resolve(true)}, 'persistent.object.non-plain');
expectRejected({value: new Uint8Array([1])}, 'persistent.object.non-plain');

const circular = {};
circular.self = circular;
expectRejected(circular, 'persistent.object.cycle');

const sparse = [];
sparse.length = 2;
sparse[1] = 'x';
expectRejected(sparse, 'persistent.array.sparse');

const accessor = {};
Object.defineProperty(accessor, 'value', {enumerable: true, get: () => 1});
expectRejected(accessor, 'persistent.object.accessor');

const customArray = [];
customArray.extra = true;
expectRejected(customArray, 'persistent.array.custom-property');

const result = validatePersistentDTO({a: undefined, b: undefined}, {maxIssues: 1});
assert.strictEqual(result.issues.length, 1);
assert.strictEqual(Object.isFrozen(result), true);
assert.strictEqual(Object.isFrozen(result.issues), true);
assert.strictEqual(Object.isFrozen(result.issues[0]), true);

process.stdout.write('ARC-C001 Persistent DTO self-test PASS: 14 contract cases.\n');
