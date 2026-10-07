#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
    AUTHORITY_MODES,
    AUTHORITY_REGISTRY_DUPLICATE,
    AUTHORITY_REGISTRY_WRITER_CONFLICT,
    PROJECTION_DIRECTIONS,
    createAuthorityRegistry,
    validateAuthorityRegistration
} = require('../../src/core/authority');

const cases = [];
const run = (name, callback) => {
    callback();
    cases.push(name);
};

const writer = (authorityId = 'writer.a', domain = 'Transform2D') => ({authorityId, domain, mode: AUTHORITY_MODES.WRITER});

run('valid-writer', () => {
    assert.strictEqual(validateAuthorityRegistration(writer()).valid, true);
});
run('valid-observer', () => {
    assert.strictEqual(validateAuthorityRegistration({
        authorityId: 'observer.a',
        domain: 'Transform2D',
        mode: AUTHORITY_MODES.OBSERVER
    }).valid, true);
});
run('valid-projection', () => {
    assert.strictEqual(validateAuthorityRegistration({
        authorityId: 'projection.a',
        domain: 'Transform2D',
        mode: AUTHORITY_MODES.PROJECTION,
        projectionDirection: PROJECTION_DIRECTIONS.AUTHORITY_TO_PROJECTION
    }).valid, true);
});
run('invalid-domain', () => {
    assert.strictEqual(validateAuthorityRegistration(writer('writer.a', 'bad domain')).valid, false);
});
run('invalid-authority-id', () => {
    assert.strictEqual(validateAuthorityRegistration(writer('bad id')).valid, false);
});
run('projection-direction-required', () => {
    assert.strictEqual(validateAuthorityRegistration({
        authorityId: 'projection.a',
        domain: 'Transform2D',
        mode: AUTHORITY_MODES.PROJECTION
    }).valid, false);
});
run('writer-direction-rejected', () => {
    assert.strictEqual(validateAuthorityRegistration(Object.assign({}, writer(), {
        projectionDirection: PROJECTION_DIRECTIONS.AUTHORITY_TO_PROJECTION
    })).valid, false);
});
run('single-writer-conflict', () => {
    const registry = createAuthorityRegistry([writer('writer.a')]);
    assert.throws(
        () => registry.register(writer('writer.b')),
        error => error && error.code === AUTHORITY_REGISTRY_WRITER_CONFLICT
    );
});
run('different-domain-writers', () => {
    const registry = createAuthorityRegistry([writer('writer.a', 'Transform2D')]);
    registry.register(writer('writer.b', 'AudioState'));
    assert.strictEqual(registry.getWriter('AudioState').authorityId, 'writer.b');
});
run('batch-writer-conflict-atomic', () => {
    const registry = createAuthorityRegistry();
    assert.throws(() => registry.registerMany([
        writer('writer.a'),
        writer('writer.b')
    ]), error => error && error.code === AUTHORITY_REGISTRY_WRITER_CONFLICT);
    assert.deepStrictEqual(registry.list(), []);
});
run('duplicate-participant-rejected', () => {
    const registry = createAuthorityRegistry([{authorityId: 'observer.a', domain: 'Transform2D', mode: 'observer'}]);
    assert.throws(
        () => registry.register({authorityId: 'observer.a', domain: 'Transform2D', mode: 'observer'}),
        error => error && error.code === AUTHORITY_REGISTRY_DUPLICATE
    );
});
run('writer-release', () => {
    const registry = createAuthorityRegistry([writer('writer.a')]);
    assert.strictEqual(registry.unregister('Transform2D', 'writer.a').authorityId, 'writer.a');
    assert.strictEqual(registry.getWriter('Transform2D'), null);
    registry.register(writer('writer.b'));
    assert.strictEqual(registry.getWriter('Transform2D').authorityId, 'writer.b');
});
run('immutable-snapshot', () => {
    const registry = createAuthorityRegistry([writer('writer.a')]);
    const snapshot = registry.snapshot();
    assert(Object.isFrozen(snapshot));
    assert(Object.isFrozen(snapshot.registrations));
    assert(Object.isFrozen(snapshot.registrations[0]));
});

process.stdout.write(`ARC-C001 Authority Registry self-test PASS (${cases.length}/${cases.length}).\n`);
