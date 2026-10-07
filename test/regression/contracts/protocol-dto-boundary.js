const assert = require('assert');
const fs = require('fs');
const path = require('path');

const loadBabelModule = require('../helpers/load-babel-module');

const assertProtocolDTOBoundaryContract = () => {
    const coreProtocolPath = path.resolve(__dirname, '../../../src/core/protocol/index.js');
    const dtoPath = path.resolve(__dirname, '../../../src/core/protocol/protocol-dto.js');
    const valuePath = path.resolve(__dirname, '../../../src/core/protocol/portable-value.js');
    const runtimeSnapshotPath = path.resolve(__dirname, '../../../src/lib/runtime-nodes/runtime-node-snapshot-contract.js');
    const core = loadBabelModule(coreProtocolPath);

    const command = core.createEngineCommand('PatchComponent', {
        nodeId: 'ngvge:node:abcdefgh',
        patch: [{op: 'replace', path: '/position/x', value: 10}]
    });
    const query = core.createEngineQuery('GetNodeSnapshot', {nodeId: 'ngvge:node:abcdefgh'});
    const event = core.createEngineEvent('NodeChanged', {nodeId: 'ngvge:node:abcdefgh'});
    const error = core.createProtocolError('NODE_NOT_FOUND', 'Missing', {nodeId: 'ngvge:node:abcdefgh'});

    assert.strictEqual(command.protocol, 'ngvge.engine-protocol');
    assert.strictEqual(command.protocolVersion, 1);
    assert.strictEqual(query.kind, 'query');
    assert.strictEqual(event.kind, 'event');
    assert.strictEqual(error.kind, 'error');
    assert(Object.isFrozen(command));
    assert(Object.isFrozen(command.payload));

    class BackendHandle {}
    assert.strictEqual(core.validateProtocolValue({handle: new BackendHandle()}).valid, false);
    assert.strictEqual(core.validateProtocolValue({handle: 1n}).valid, false);
    assert.strictEqual(core.validateProtocolValue({service: () => true}).valid, false);

    const live = {nodes: [{id: 'node-a'}]};
    const snapshot = core.createQuerySnapshot(live);
    live.nodes[0].id = 'node-b';
    assert.strictEqual(snapshot.nodes[0].id, 'node-a');
    assert(Object.isFrozen(snapshot));
    assert(Object.isFrozen(snapshot.nodes[0]));

    const dtoSource = fs.readFileSync(dtoPath, 'utf8');
    const valueSource = fs.readFileSync(valuePath, 'utf8');
    const runtimeSnapshotSource = fs.readFileSync(runtimeSnapshotPath, 'utf8');
    assert.doesNotMatch(dtoSource, /Scratch|React|runtime-nodes|scene-system|document\.|window\.|Dawn|Box2D|Jolt|SDL/);
    assert.doesNotMatch(valueSource, /Scratch|React|runtime-nodes|scene-system|document\.|window\.|Dawn|Box2D|Jolt|SDL/);
    assert.match(runtimeSnapshotSource, /RUNTIME_NODE_SNAPSHOT_CONTRACT/,
        'Subsystem snapshot protocol must remain distinct from the generic Core DTO vocabulary.');

    return {
        detachedFrozenQuerySnapshots: true,
        engineCommandQueryEventErrorDTOs: true,
        explicitProtocolVersion: true,
        runtimeNativeObjectsRejected: true
    };
};

module.exports = {
    assertProtocolDTOBoundaryContract
};
