#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    ENGINE_PROTOCOL_ID,
    ENGINE_PROTOCOL_VERSION,
    createEngineCommand,
    createEngineEvent,
    createEngineQuery,
    createProtocolError,
    createQuerySnapshot,
    validateProtocolValue
} = require('../../src/core/protocol');

const ROOT = path.resolve(__dirname, '../..');
const dtoPath = path.join(ROOT, 'src/core/protocol/protocol-dto.js');
const valuePath = path.join(ROOT, 'src/core/protocol/portable-value.js');
const runtimeSnapshotPath = path.join(ROOT, 'src/lib/runtime-nodes/runtime-node-snapshot-contract.js');
const sceneControllerPath = path.join(ROOT, 'src/lib/scene-system/scene-controller.js');

assert.strictEqual(ENGINE_PROTOCOL_ID, 'ngvge.engine-protocol');
assert.strictEqual(ENGINE_PROTOCOL_VERSION, 1);

const command = createEngineCommand('PatchComponent', {
    componentTypeId: 'ngvge.transform2d',
    nodeId: 'ngvge:node:abcdefgh',
    patch: [{op: 'replace', path: '/position/x', value: 100}]
});
const query = createEngineQuery('GetNodeSnapshot', {nodeId: 'ngvge:node:abcdefgh'});
const event = createEngineEvent('NodeChanged', {nodeId: 'ngvge:node:abcdefgh'});
const protocolError = createProtocolError('NODE_NOT_FOUND', 'Node does not exist.', {nodeId: 'ngvge:node:abcdefgh'});

for (const dto of [command, query, event, protocolError]) {
    assert(Object.isFrozen(dto), 'Protocol DTOs must be immutable.');
    assert.strictEqual(dto.protocolVersion, 1, 'Protocol DTOs must carry explicit protocol version 1.');
}
assert(Object.isFrozen(command.payload), 'Protocol payloads must be immutable.');
assert(Object.isFrozen(protocolError.details), 'Protocol error details must be immutable.');

class NativeBackendHandle {}
assert.strictEqual(validateProtocolValue({native: new NativeBackendHandle()}).valid, false,
    'Native/backend class instances must fail closed.');
assert.strictEqual(validateProtocolValue({nativePointer: 1n}).valid, false,
    'BigInt/native integer handles must fail closed.');
assert.strictEqual(validateProtocolValue({service: () => true}).valid, false,
    'Internal service functions must fail closed.');

const mutable = {nodes: [{id: 'ngvge:node:abcdefgh'}]};
const snapshot = createQuerySnapshot(mutable);
mutable.nodes[0].id = 'mutated';
assert.strictEqual(snapshot.nodes[0].id, 'ngvge:node:abcdefgh', 'Query snapshots must be detached from live state.');
assert(Object.isFrozen(snapshot) && Object.isFrozen(snapshot.nodes) && Object.isFrozen(snapshot.nodes[0]),
    'Query snapshots must be deeply frozen.');

const dtoSource = fs.readFileSync(dtoPath, 'utf8');
const valueSource = fs.readFileSync(valuePath, 'utf8');
const runtimeSnapshotSource = fs.readFileSync(runtimeSnapshotPath, 'utf8');
const sceneControllerSource = fs.readFileSync(sceneControllerPath, 'utf8');

for (const [label, source] of [['DTO contract', dtoSource], ['portable value contract', valueSource]]) {
    assert.doesNotMatch(source, /Scratch|React|runtime-nodes|scene-system|document\.|window\.|WebGPU|Dawn|Box2D|Jolt|SDL/,
        `Core Protocol ${label} must remain backend/runtime/editor/compatibility independent.`);
}
assert.match(runtimeSnapshotSource, /RUNTIME_NODE_SNAPSHOT_CONTRACT/,
    'Runtime Node snapshot contract must remain a distinct subsystem protocol.');
assert.match(sceneControllerSource, /controller|command|snapshot/i,
    'Scene controller must remain a distinct subsystem protocol rather than being silently renamed into Core.');

process.stdout.write('ARC-C001 Protocol DTO Conformance PASS.\n');
