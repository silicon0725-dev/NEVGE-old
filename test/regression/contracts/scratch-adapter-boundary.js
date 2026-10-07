const assert = require('assert');
const fs = require('fs');
const path = require('path');

const adapter = require('../../../src/lib/scratch-sprite-adapter');

const assertScratchAdapterBoundaryContract = () => {
    const runtimeBinding = {
        bindingId: 'binding-regression-a',
        destroyPolicy: 'delete-target',
        lastKnownName: 'Player',
        nodeId: 'ngvge:node:abcdefgh',
        role: 'sprite',
        sceneId: 'scene-a',
        serializedTargetIndex: 1,
        status: 'bound',
        targetRuntimeId: 'volatile-target-a',
        target: {id: 'volatile-target-a'}
    };

    const persistent = adapter.toPersistentBinding(runtimeBinding);
    assert.strictEqual(persistent.bindingId, runtimeBinding.bindingId);
    assert.strictEqual(persistent.nodeId, runtimeBinding.nodeId);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(persistent, 'targetRuntimeId'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(persistent, 'target'), false);

    const view = adapter.toBindingView(runtimeBinding);
    assert(Object.isFrozen(view));
    assert.strictEqual(view.targetRuntimeId, 'volatile-target-a');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(view, 'target'), false);

    const project = {
        scenes: [{id: 'scene-a'}],
        extensionData: {
            [adapter.SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY]: {
                schemaVersion: adapter.SCRATCH_SPRITE_BINDING_SCHEMA_VERSION,
                scenes: {
                    'scene-a': {
                        items: [Object.assign({}, persistent, {targetRuntimeId: 'volatile-target-a'})]
                    }
                }
            }
        }
    };
    const validation = adapter.validateBindingStorePersistence(
        project,
        project.extensionData[adapter.SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY]
    );
    assert.strictEqual(validation.valid, false);
    assert(validation.issues.some(issue => issue.code === 'SCRATCH_BINDING_VOLATILE_TARGET_ID_PERSISTED'));

    const projection = adapter.createScratchSpriteTreeProjection({
        bindings: [
            view,
            adapter.toBindingView(Object.assign({}, runtimeBinding, {
                bindingId: 'stale-binding',
                nodeId: 'missing-node',
                targetRuntimeId: 'stale-target'
            }))
        ],
        runtimeNodes: [{id: runtimeBinding.nodeId, typeId: adapter.SPRITE_NODE_TYPE_ID}]
    });
    assert.strictEqual(projection.bindings.length, 1);
    assert.strictEqual(projection.bindingByNodeId.has(runtimeBinding.nodeId), true);
    assert.strictEqual(projection.bindingByNodeId.has('missing-node'), false);
    assert.deepStrictEqual(projection.hiddenTargetRuntimeIds, ['volatile-target-a']);

    assert.notStrictEqual(adapter.SPRITE_NODE_TYPE_ID, adapter.LEGACY_SCRATCH_SPRITE_NODE_TYPE_ID);

    const sensitiveFiles = [
        '../../../src/core/protocol/protocol-dto.js',
        '../../../src/core/persistent/persistent-dto.js',
        '../../../src/lib/runtime-nodes/runtime-node-model-service.js'
    ];
    sensitiveFiles.forEach(relative => {
        const source = fs.readFileSync(path.resolve(__dirname, relative), 'utf8');
        assert.doesNotMatch(source, /scratch-sprite-adapter|targetRuntimeId|ngvge\.scratch-target-binding/,
            `${relative} must remain outside the Scratch compatibility representation.`);
    });

    return {
        semanticSpriteOwner: true,
        stableBindingAndNodeIdentity: true,
        volatileTargetIdentityRuntimeOnly: true,
        frozenTargetFreeAdapterViews: true,
        staleTreeProjectionRejected: true
    };
};

module.exports = {
    assertScratchAdapterBoundaryContract
};
