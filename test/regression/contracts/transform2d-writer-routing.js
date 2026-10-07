const assert = require('assert');

const assertTransform2DWriterRoutingContract = () => {
    const {
        TRANSFORM2D_NATIVE_AUTHORITY_ID,
        TRANSFORM2D_SCRATCH_AUTHORITY_ID,
        createTransform2DPatchComponentCommand
    } = require('../../../src/core/transform2d');
    const {createTransform2DWriterRouter} = require('../../../src/lib/transform-system');
    const {createTransform2DSceneWriterRouteResolver} = require('../../../src/lib/scene-system/transform2d-writer-route-resolver');

    const nativeCommands = [];
    const scratchCommands = [];
    const nativeWriter = {
        executeCommand: command => {
            nativeCommands.push(command);
            return {kind: 'event', type: 'PatchComponentApplied', payload: {authorityId: TRANSFORM2D_NATIVE_AUTHORITY_ID}};
        }
    };
    const scratchWriter = {
        executeCommand: command => {
            scratchCommands.push(command);
            return {kind: 'event', type: 'PatchComponentApplied', payload: {authorityId: TRANSFORM2D_SCRATCH_AUTHORITY_ID}};
        }
    };
    let binding = null;
    const adapter = {getBindingByNodeId: nodeId => binding && binding.nodeId === nodeId ? binding : null};
    const router = createTransform2DWriterRouter({
        resolveRoute: createTransform2DSceneWriterRouteResolver(adapter),
        writers: {
            [TRANSFORM2D_NATIVE_AUTHORITY_ID]: nativeWriter,
            [TRANSFORM2D_SCRATCH_AUTHORITY_ID]: scratchWriter
        }
    });
    const command = createTransform2DPatchComponentCommand({
        componentId: 'component',
        nodeId: 'node',
        patch: {scale: [2, 0.5]}
    });

    assert.strictEqual(router.executeCommand(command).payload.authorityId, TRANSFORM2D_NATIVE_AUTHORITY_ID);
    binding = {bindingId: 'binding', nodeId: 'node', status: 'offline', targetRuntimeId: null};
    assert.strictEqual(router.executeCommand(command).payload.authorityId, TRANSFORM2D_SCRATCH_AUTHORITY_ID);
    binding = {bindingId: 'binding', nodeId: 'node', status: 'bound', targetRuntimeId: 'volatile-recreated-target'};
    assert.strictEqual(router.executeCommand(command).payload.authorityId, TRANSFORM2D_SCRATCH_AUTHORITY_ID);
    assert.strictEqual(nativeCommands.length, 1);
    assert.strictEqual(scratchCommands.length, 2);
    assert.strictEqual(router.getRouteForNode('node').targetRuntimeId, undefined);
    router.dispose();

    return {
        nativeUnboundRouting: true,
        scratchBindingOwnershipStable: true,
        volatileTargetIdentityExcluded: true
    };
};

module.exports = {assertTransform2DWriterRoutingContract};
