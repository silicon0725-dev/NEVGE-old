'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    AUTHORITY_MODES,
    AUTHORITY_REGISTRY_WRITER_CONFLICT,
    PROJECTION_DIRECTIONS,
    createAuthorityRegistry
} = require('../../../src/core/authority');

const ROOT = path.resolve(__dirname, '../../..');
const CORE_CONTRACT = path.join(ROOT, 'src/core/authority/authority-contract.js');
const CORE_REGISTRY = path.join(ROOT, 'src/core/authority/authority-registry.js');
const CAPABILITY_REGISTRY = path.join(ROOT, 'src/lib/first-party-modules/capability-registry.js');

const assertAuthorityRegistryBoundaryContract = () => {
    const contractSource = fs.readFileSync(CORE_CONTRACT, 'utf8');
    const registrySource = fs.readFileSync(CORE_REGISTRY, 'utf8');
    const capabilityRegistrySource = fs.readFileSync(CAPABILITY_REGISTRY, 'utf8');

    assert.match(contractSource, /ngvge-authority-registration\/v1/,
        'Core Authority registration contract must remain explicitly versioned');
    assert.match(contractSource, /writer.*projection.*observer|observer.*projection.*writer/s,
        'Core Authority roles must remain explicit');
    assert.doesNotMatch(contractSource, /Scratch|React|runtime-nodes|capability-registry|document\.|window\./,
        'Core Authority contract must remain backend/runtime/editor/capability independent');
    assert.doesNotMatch(registrySource, /Scratch|React|runtime-nodes|capability-registry|document\.|window\./,
        'Core Authority Registry must remain backend/runtime/editor/capability independent');
    assert.match(capabilityRegistrySource, /class ModuleCapabilityRegistry/,
        'Module Capability Registry must remain distinct from generic Core Authority');

    const registry = createAuthorityRegistry([
        {authorityId: 'scratch.compat.transform', domain: 'Transform2D', mode: AUTHORITY_MODES.WRITER},
        {
            authorityId: 'ngvge.semantic.transform',
            domain: 'Transform2D',
            mode: AUTHORITY_MODES.PROJECTION,
            projectionDirection: PROJECTION_DIRECTIONS.AUTHORITY_TO_PROJECTION
        },
        {authorityId: 'editor.inspector', domain: 'Transform2D', mode: AUTHORITY_MODES.OBSERVER}
    ]);

    assert.strictEqual(registry.getWriter('Transform2D').authorityId, 'scratch.compat.transform');
    assert.throws(
        () => registry.register({authorityId: 'ngvge.native.transform', domain: 'Transform2D', mode: 'writer'}),
        error => error && error.code === AUTHORITY_REGISTRY_WRITER_CONFLICT,
        'A second active writer must fail closed for the same State Domain'
    );
    assert.strictEqual(registry.list('Transform2D').length, 3,
        'Writer conflict must not partially mutate the existing domain registrations');
    assert(Object.isFrozen(registry.snapshot()), 'Authority Registry snapshots must remain immutable');

    return {
        capabilityRegistryRemainsSpecific: true,
        explicitRoles: true,
        immutableSnapshots: true,
        singleWriterPerDomain: true
    };
};

module.exports = {
    assertAuthorityRegistryBoundaryContract
};
