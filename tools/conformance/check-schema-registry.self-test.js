#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
    SCHEMA_REGISTRY_DUPLICATE,
    SchemaDescriptorValidationError,
    createSchemaRegistry,
    validateSchemaDescriptor
} = require('../../src/core/schema');

const cases = [];
const run = (name, callback) => {
    callback();
    cases.push(name);
};

run('valid-versioned-schema', () => {
    assert.strictEqual(validateSchemaDescriptor({properties: {}, typeId: 'test.schema', version: 1}).valid, true);
});
run('invalid-version', () => {
    assert.strictEqual(validateSchemaDescriptor({properties: {}, typeId: 'test.schema', version: 0}).valid, false);
});
run('invalid-type-id', () => {
    assert.strictEqual(validateSchemaDescriptor({properties: {}, typeId: 'bad id', version: 1}).valid, false);
});
run('unknown-schema-field', () => {
    assert.strictEqual(validateSchemaDescriptor({extra: true, properties: {}, typeId: 'test.schema', version: 1}).valid, false);
});
run('unsafe-property-name', () => {
    assert.strictEqual(validateSchemaDescriptor({
        properties: {constructor: {type: 'string'}},
        typeId: 'test.schema',
        version: 1
    }).valid, false);
});
run('invalid-range', () => {
    assert.strictEqual(validateSchemaDescriptor({
        properties: {value: {maximum: 1, minimum: 2, type: 'number'}},
        typeId: 'test.schema',
        version: 1
    }).valid, false);
});
run('runtime-default-rejected', () => {
    assert.strictEqual(validateSchemaDescriptor({
        properties: {value: {default: () => true, type: 'callable'}},
        typeId: 'test.schema',
        version: 1
    }).valid, false);
});
run('nullability-conflict', () => {
    assert.strictEqual(validateSchemaDescriptor({
        properties: {value: {default: null, type: 'resource'}},
        typeId: 'test.schema',
        version: 1
    }).valid, false);
});
run('duplicate-rejected', () => {
    const schema = {properties: {}, typeId: 'test.schema', version: 1};
    const registry = createSchemaRegistry([schema]);
    assert.throws(() => registry.register(schema), error => error && error.code === SCHEMA_REGISTRY_DUPLICATE);
});
run('batch-atomic-on-duplicate', () => {
    const registry = createSchemaRegistry([{properties: {}, typeId: 'test.schema', version: 1}]);
    assert.throws(() => registry.registerMany([
        {properties: {}, typeId: 'test.other', version: 1},
        {properties: {}, typeId: 'test.schema', version: 1}
    ]), error => error && error.code === SCHEMA_REGISTRY_DUPLICATE);
    assert.strictEqual(registry.has('test.other'), false);
});
run('batch-atomic-on-invalid', () => {
    const registry = createSchemaRegistry();
    assert.throws(() => registry.registerMany([
        {properties: {}, typeId: 'test.other', version: 1},
        {properties: {}, typeId: '', version: 1}
    ]), SchemaDescriptorValidationError);
    assert.strictEqual(registry.has('test.other'), false);
});
run('latest-version-resolution', () => {
    const registry = createSchemaRegistry([
        {properties: {}, typeId: 'test.schema', version: 1},
        {properties: {}, typeId: 'test.schema', version: 3},
        {properties: {}, typeId: 'test.schema', version: 2}
    ]);
    assert.strictEqual(registry.get('test.schema').version, 3);
    assert.deepStrictEqual(registry.getVersions('test.schema'), [1, 2, 3]);
});
run('immutable-snapshot', () => {
    const registry = createSchemaRegistry([{properties: {}, typeId: 'test.schema', version: 1}]);
    assert(Object.isFrozen(registry.get('test.schema')));
    assert(Object.isFrozen(registry.snapshot()));
    assert(Object.isFrozen(registry.snapshot().schemas));
});

process.stdout.write(`ARC-C001 Schema Registry self-test PASS (${cases.length}/${cases.length}).\n`);
