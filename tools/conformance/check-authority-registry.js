#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    AUTHORITY_MODES,
    AUTHORITY_REGISTRATION_SCHEMA,
    AUTHORITY_REGISTRY_WRITER_CONFLICT,
    PROJECTION_DIRECTIONS,
    createAuthorityRegistry,
    validateAuthorityRegistration
} = require('../../src/core/authority');

const ROOT = path.resolve(__dirname, '../..');
const contractPath = path.join(ROOT, 'src/core/authority/authority-contract.js');
const registryPath = path.join(ROOT, 'src/core/authority/authority-registry.js');
const capabilityRegistryPath = path.join(ROOT, 'src/lib/first-party-modules/capability-registry.js');

assert.strictEqual(AUTHORITY_REGISTRATION_SCHEMA, 'ngvge-authority-registration/v1');
assert.strictEqual(AUTHORITY_MODES.WRITER, 'writer');
assert.strictEqual(AUTHORITY_MODES.PROJECTION, 'projection');
assert.strictEqual(AUTHORITY_MODES.OBSERVER, 'observer');
assert.strictEqual(PROJECTION_DIRECTIONS.AUTHORITY_TO_PROJECTION, 'authority-to-projection');
assert.strictEqual(PROJECTION_DIRECTIONS.PROJECTION_TO_AUTHORITY, 'projection-to-authority');

const scratchWriter = {authorityId: 'scratch.compat.transform', domain: 'Transform2D', mode: 'writer'};
const projection = {
    authorityId: 'ngvge.semantic.transform',
    domain: 'Transform2D',
    mode: 'projection',
    projectionDirection: 'authority-to-projection'
};
assert.strictEqual(validateAuthorityRegistration(scratchWriter).valid, true);
assert.strictEqual(validateAuthorityRegistration(projection).valid, true);

const registry = createAuthorityRegistry([scratchWriter, projection]);
assert.strictEqual(registry.getWriter('Transform2D').authorityId, 'scratch.compat.transform');
assert.throws(
    () => registry.register({authorityId: 'ngvge.native.transform', domain: 'Transform2D', mode: 'writer'}),
    error => error && error.code === AUTHORITY_REGISTRY_WRITER_CONFLICT
);
assert(Object.isFrozen(registry.getWriter('Transform2D')));
assert(Object.isFrozen(registry.snapshot()));

const contractSource = fs.readFileSync(contractPath, 'utf8');
const registrySource = fs.readFileSync(registryPath, 'utf8');
const capabilityRegistrySource = fs.readFileSync(capabilityRegistryPath, 'utf8');
assert(!/Scratch|React|runtime-nodes|capability-registry|document\.|window\./.test(contractSource),
    'Core Authority contract must remain backend/runtime/editor/capability independent.');
assert(!/Scratch|React|runtime-nodes|capability-registry|document\.|window\./.test(registrySource),
    'Core Authority Registry must remain backend/runtime/editor/capability independent.');
assert(capabilityRegistrySource.includes('class ModuleCapabilityRegistry'),
    'Module Capability Registry must remain distinct from generic Core State Domain Authority.');

process.stdout.write('ARC-C001 Authority Registry Conformance PASS.\n');
