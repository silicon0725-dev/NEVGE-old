#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    PERSISTENT_DTO_SCHEMA,
    PersistentDTOValidationError,
    clonePersistentDTO,
    validatePersistentDTO
} = require('../../src/core/persistent');

const repoRoot = path.resolve(__dirname, '../..');
const legacyPersistencePath = path.join(repoRoot, 'src/lib/persistence/persistent-data.js');
const projectPersistencePath = path.join(repoRoot, 'src/lib/project-inspector/project-persistence.js');

assert.strictEqual(PERSISTENT_DTO_SCHEMA, 'ngvge-persistent-dto/v1');
assert.strictEqual(validatePersistentDTO({value: [1, true, null, 'ok']}).valid, true);

const invalidCases = [
    {value: undefined},
    {value: () => true},
    {value: Symbol('runtime')},
    {value: BigInt(1)},
    {value: Number.POSITIVE_INFINITY},
    {value: Promise.resolve(true)},
    {value: new Date(0)},
    {value: new Map()},
    {value: new Uint8Array([1])}
];
invalidCases.forEach(value => {
    assert.strictEqual(validatePersistentDTO(value).valid, false);
    assert.throws(() => clonePersistentDTO(value), PersistentDTOValidationError);
});

const circular = {};
circular.self = circular;
assert.strictEqual(validatePersistentDTO(circular).valid, false);

const legacySource = fs.readFileSync(legacyPersistencePath, 'utf8');
assert(legacySource.includes("require('../../core/persistent')"), 'Legacy persistence facade must delegate to Core Persistent DTO authority.');

const projectSource = fs.readFileSync(projectPersistencePath, 'utf8');
assert(projectSource.includes("from '../../core/persistent'"), 'Project Persistence must consume Core Persistent DTO authority.');
assert(projectSource.includes('clonePersistentDTO(value)'), 'Project Persistence serialization clone must validate through clonePersistentDTO().');
assert(!projectSource.includes('JSON.parse(JSON.stringify(value))'), 'Project Persistence must not sanitize DTOs through JSON stringify/parse.');

process.stdout.write('ARC-C001 Persistent DTO Conformance PASS.\n');
