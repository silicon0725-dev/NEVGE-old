#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
    ENGINE_PROTOCOL_ID,
    ENGINE_PROTOCOL_VERSION,
    PROTOCOL_DTO_VALIDATION_ERROR,
    PROTOCOL_VALUE_VALIDATION_ERROR,
    createEngineCommand,
    createEngineEvent,
    createEngineQuery,
    createProtocolError,
    createQuerySnapshot,
    validateProtocolDTO,
    validateProtocolValue
} = require('../../src/core/protocol');

const cases = [];
const run = (name, callback) => {
    callback();
    cases.push(name);
};

run('explicit-versioned-protocol', () => {
    const command = createEngineCommand('PatchComponent', {});
    assert.strictEqual(command.protocol, ENGINE_PROTOCOL_ID);
    assert.strictEqual(command.protocolVersion, ENGINE_PROTOCOL_VERSION);
});
run('command-dto', () => assert.strictEqual(createEngineCommand('PatchComponent', {}).kind, 'command'));
run('query-dto', () => assert.strictEqual(createEngineQuery('GetNodeSnapshot', {}).kind, 'query'));
run('event-dto', () => assert.strictEqual(createEngineEvent('NodeChanged', {}).kind, 'event'));
run('protocol-error-dto', () => assert.strictEqual(createProtocolError('NODE_NOT_FOUND', 'Missing').kind, 'error'));
run('unknown-field-rejected', () => {
    const value = createEngineCommand('PatchComponent', {});
    assert.strictEqual(validateProtocolDTO(Object.assign({}, value, {service: 'internal'})).valid, false);
});
run('wrong-version-rejected', () => {
    const value = createEngineCommand('PatchComponent', {});
    assert.strictEqual(validateProtocolDTO(Object.assign({}, value, {protocolVersion: 2})).valid, false);
});
run('function-rejected', () => assert.strictEqual(validateProtocolValue({call: () => true}).valid, false));
run('promise-rejected', () => assert.strictEqual(validateProtocolValue({promise: Promise.resolve()}).valid, false));
run('custom-class-rejected', () => {
    class BackendHandle {}
    assert.strictEqual(validateProtocolValue({handle: new BackendHandle()}).valid, false);
});
run('bigint-rejected', () => assert.strictEqual(validateProtocolValue({handle: 1n}).valid, false));
run('non-finite-rejected', () => assert.strictEqual(validateProtocolValue({x: Infinity}).valid, false));
run('cycle-rejected', () => {
    const value = {};
    value.self = value;
    assert.strictEqual(validateProtocolValue(value).valid, false);
});
run('query-snapshot-frozen-and-detached', () => {
    const source = {nodes: [{id: 'node-a'}]};
    const snapshot = createQuerySnapshot(source);
    source.nodes[0].id = 'mutated';
    assert.strictEqual(snapshot.nodes[0].id, 'node-a');
    assert(Object.isFrozen(snapshot));
    assert(Object.isFrozen(snapshot.nodes));
    assert(Object.isFrozen(snapshot.nodes[0]));
});
run('structured-validation-errors', () => {
    assert.throws(
        () => createEngineCommand('bad type', {}),
        error => error && error.code === PROTOCOL_DTO_VALIDATION_ERROR
    );
    const result = validateProtocolValue({handle: 1n});
    assert.strictEqual(result.valid, false);
    assert.strictEqual(PROTOCOL_VALUE_VALIDATION_ERROR, 'NGVGE_PROTOCOL_VALUE_INVALID');
});

process.stdout.write(`ARC-C001 Protocol DTO self-test PASS (${cases.length}/${cases.length}).\n`);
