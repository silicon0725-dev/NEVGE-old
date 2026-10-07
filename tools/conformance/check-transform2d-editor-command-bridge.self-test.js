#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
    TRANSFORM2D_COMMAND_CAPABILITY_ID,
    TRANSFORM2D_COMMAND_CONTRACT,
    createTransform2DCommandCapability,
    createTransform2DEditorClient
} = require('../../src/lib/transform-system');
const {
    SCRATCH_TRANSFORM_COMMAND_BRIDGE_CONTRACT,
    transformRotationToScratchDirection,
    transformScaleToScratchSize
} = require('../../src/lib/scratch-sprite-adapter');

const cases = [];
const run = (name, callback) => {
    callback();
    cases.push(name);
};

run('semantic-capability-id', () => {
    assert.strictEqual(TRANSFORM2D_COMMAND_CAPABILITY_ID, 'ngvge.transform2d-command');
});
run('patchcomponent-protocol', () => {
    assert.strictEqual(TRANSFORM2D_COMMAND_CONTRACT.editorIntent.commandType, 'PatchComponent');
    assert.strictEqual(TRANSFORM2D_COMMAND_CONTRACT.editorIntent.protocolRequired, true);
});
run('editor-no-backend-write', () => {
    assert.strictEqual(TRANSFORM2D_COMMAND_CONTRACT.editorIntent.directBackendMutation, false);
});
run('scratch-authority-stays-writer', () => {
    assert.strictEqual(TRANSFORM2D_COMMAND_CONTRACT.currentAuthority.authorityId, 'scratch.compat.transform');
    assert.strictEqual(TRANSFORM2D_COMMAND_CONTRACT.currentAuthority.authorityReversalImplemented, false);
});
run('bridge-is-replaceable', () => {
    assert.strictEqual(TRANSFORM2D_COMMAND_CONTRACT.currentAuthority.bridgeImplementationReplaceable, true);
});
run('inverse-direction-mapping', () => {
    assert.strictEqual(transformRotationToScratchDirection(0), 90);
    assert.strictEqual(transformRotationToScratchDirection(90), 0);
});
run('uniform-scale-mapping', () => {
    assert.strictEqual(transformScaleToScratchSize([1.5, 1.5]), 150);
});
run('unrepresentable-scale-fails-closed', () => {
    assert.throws(() => transformScaleToScratchSize([2, 1]),
        error => error && error.code === 'SCRATCH_TRANSFORM_SCALE_UNREPRESENTABLE');
});
run('no-fake-generic-mutation-context', () => {
    assert.strictEqual(SCRATCH_TRANSFORM_COMMAND_BRIDGE_CONTRACT.mutationScope.genericMutationContextImplemented, false);
    assert.strictEqual(
        SCRATCH_TRANSFORM_COMMAND_BRIDGE_CONTRACT.mutationScope.genericProjectionLoopPreventionImplemented,
        false
    );
    assert.strictEqual(SCRATCH_TRANSFORM_COMMAND_BRIDGE_CONTRACT.mutationScope.genericTransactionImplemented, false);
});
run('protocol-result-boundary', () => {
    assert.strictEqual(
        SCRATCH_TRANSFORM_COMMAND_BRIDGE_CONTRACT.editorBoundary.output,
        'Engine Event DTO / Protocol Error DTO'
    );
});
run('editor-client-emits-command', () => {
    let received = null;
    const capability = createTransform2DCommandCapability({
        executeCommand: command => {
            received = command;
            return command;
        }
    });
    const editor = createTransform2DEditorClient(capability);
    editor.patchComponent({
        componentId: 'component:transform',
        nodeId: 'node:semantic',
        patch: {position: [1, 2]}
    });
    assert.strictEqual(received.kind, 'command');
    assert.strictEqual(received.type, 'PatchComponent');
});

process.stdout.write(`0009-D Transform2D Editor Command Bridge self-test PASS (${cases.length}/${cases.length}).\n`);
