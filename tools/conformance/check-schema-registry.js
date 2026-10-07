#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    SCHEMA_DESCRIPTOR_SCHEMA,
    SCHEMA_PROPERTY_PERSISTENCE,
    SCHEMA_REGISTRY_DUPLICATE,
    createSchemaRegistry,
    validateSchemaDescriptor
} = require('../../src/core/schema');

const ROOT = path.resolve(__dirname, '../..');
const registryPath = path.join(ROOT, 'src/core/schema/schema-registry.js');
const contractPath = path.join(ROOT, 'src/core/schema/schema-contract.js');
const runtimeRegistryPath = path.join(ROOT, 'src/lib/runtime-nodes/runtime-component-type-registry.js');

assert.strictEqual(SCHEMA_DESCRIPTOR_SCHEMA, 'ngvge-schema-descriptor/v1');
assert.strictEqual(SCHEMA_PROPERTY_PERSISTENCE.PERSISTENT, 'persistent');
assert.strictEqual(SCHEMA_PROPERTY_PERSISTENCE.RUNTIME_ONLY, 'runtime-only');

const descriptor = {
    properties: {
        resource: {
            default: null,
            nullable: true,
            persistence: 'persistent',
            resourceType: 'texture2d',
            type: 'resource-ref'
        },
        runtimeCache: {
            persistence: 'runtime-only',
            type: 'opaque-cache-key'
        }
    },
    typeId: 'ngvge.test.schema',
    version: 1
};
assert.strictEqual(validateSchemaDescriptor(descriptor).valid, true);

const registry = createSchemaRegistry([descriptor]);
registry.register(Object.assign({}, descriptor, {version: 2}));
assert.strictEqual(registry.get('ngvge.test.schema').version, 2);
assert.deepStrictEqual(registry.getVersions('ngvge.test.schema'), [1, 2]);
assert.throws(() => registry.register(descriptor), error => error && error.code === SCHEMA_REGISTRY_DUPLICATE);
assert(Object.isFrozen(registry.get('ngvge.test.schema')));
assert(Object.isFrozen(registry.snapshot()));

const invalid = Object.assign({}, descriptor, {
    properties: {bad: {default: () => true, type: 'callable'}},
    typeId: 'bad id'
});
assert.strictEqual(validateSchemaDescriptor(invalid).valid, false);

const contractSource = fs.readFileSync(contractPath, 'utf8');
const registrySource = fs.readFileSync(registryPath, 'utf8');
const runtimeRegistrySource = fs.readFileSync(runtimeRegistryPath, 'utf8');
assert(contractSource.includes("require('../persistent')"), 'Core Schema descriptors must consume Core Persistent DTO authority.');
assert(!/runtime-nodes|Scratch|React|document|window/.test(contractSource), 'Core Schema contract must remain backend/runtime/editor independent.');
assert(!/runtime-nodes|Scratch|React|document|window/.test(registrySource), 'Core Schema Registry must remain backend/runtime/editor independent.');
assert(runtimeRegistrySource.includes('class RuntimeComponentTypeRegistry'), 'Runtime Component Registry must remain a distinct Runtime-specific registry.');

process.stdout.write('ARC-C001 Schema Registry Conformance PASS.\n');
