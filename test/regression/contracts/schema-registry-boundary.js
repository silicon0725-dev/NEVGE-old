'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    SCHEMA_REGISTRY_DUPLICATE,
    createSchemaRegistry,
    validateSchemaDescriptor
} = require('../../../src/core/schema');

const ROOT = path.resolve(__dirname, '../../..');
const CORE_CONTRACT = path.join(ROOT, 'src/core/schema/schema-contract.js');
const CORE_REGISTRY = path.join(ROOT, 'src/core/schema/schema-registry.js');
const RUNTIME_REGISTRY = path.join(ROOT, 'src/lib/runtime-nodes/runtime-component-type-registry.js');

const assertSchemaRegistryBoundaryContract = () => {
    const contractSource = fs.readFileSync(CORE_CONTRACT, 'utf8');
    const registrySource = fs.readFileSync(CORE_REGISTRY, 'utf8');
    const runtimeRegistrySource = fs.readFileSync(RUNTIME_REGISTRY, 'utf8');

    assert.match(contractSource, /ngvge-schema-descriptor\/v1/, 'Core Schema descriptor contract must remain explicitly versioned');
    assert.match(contractSource, /require\('\.\.\/persistent'\)/, 'Schema metadata/defaults must remain constrained by Core Persistent DTO authority');
    assert.doesNotMatch(contractSource, /Scratch|React|runtime-nodes|document\.|window\./, 'Core Schema contract must remain backend/runtime/editor independent');
    assert.doesNotMatch(registrySource, /Scratch|React|runtime-nodes|document\.|window\./, 'Core Schema Registry must remain backend/runtime/editor independent');
    assert.match(runtimeRegistrySource, /class RuntimeComponentTypeRegistry/, 'Runtime-specific component Registry must remain distinct from generic Core Schema authority');

    const schemaV1 = {
        properties: {value: {default: 0, persistence: 'persistent', type: 'number'}},
        typeId: 'ngvge.regression.schema',
        version: 1
    };
    assert.strictEqual(validateSchemaDescriptor(schemaV1).valid, true);
    const registry = createSchemaRegistry([schemaV1]);
    registry.register(Object.assign({}, schemaV1, {version: 2}));
    assert.strictEqual(registry.get(schemaV1.typeId).version, 2, 'latest registered schema version must be current');
    assert.throws(
        () => registry.register(schemaV1),
        error => error && error.code === SCHEMA_REGISTRY_DUPLICATE,
        'registered schema versions must never be silently replaced'
    );
    assert(Object.isFrozen(registry.get(schemaV1.typeId)), 'Registry queries must return immutable schema authority snapshots');

    return {
        appendOnlyVersionAuthority: true,
        backendIndependentCore: true,
        persistentMetadataAuthority: true,
        runtimeRegistryRemainsSpecific: true
    };
};

module.exports = {
    assertSchemaRegistryBoundaryContract
};
