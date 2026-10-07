#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {EventEmitter} = require('events');
const {
    createRuntimeNodeModelService,
    getRuntimeNodeModelHost
} = require('../src/lib/runtime-nodes');
const {
    LEGACY_SCRATCH_SPRITE_NODE_TYPE_ID,
    SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY,
    SCRATCH_TARGET_BINDING_COMPONENT_TYPE_ID,
    SPRITE_NODE_TYPE_ID,
    createScratchSpriteNodeAdapterService,
    createScratchSpriteTreeProjection
} = require('../src/lib/scratch-sprite-adapter');

const clone = value => JSON.parse(JSON.stringify(value));
const flush = (milliseconds = 25) => new Promise(resolve => setTimeout(resolve, milliseconds));

const createTarget = (id, name, options = {}) => ({
    id,
    isOriginal: options.isOriginal !== false,
    isStage: Boolean(options.isStage),
    sprite: {name}
});

const createLegacyProject = () => ({
    activeSceneId: 'scene-a',
    extensionData: {
        runtimeNodeModel: {
            activeSceneId: 'scene-a',
            nodes: [{
                components: [{
                    data: {
                        bindingId: 'legacy-binding-a',
                        lastKnownName: 'Player',
                        role: 'sprite',
                        sceneId: 'scene-a',
                        schemaVersion: 1,
                        serializedTargetIndex: 1
                    },
                    enabled: true,
                    id: 'legacy-component-a',
                    typeId: SCRATCH_TARGET_BINDING_COMPONENT_TYPE_ID
                }],
                enabled: true,
                id: 'stable-node-a',
                metadata: {adapterManaged: true},
                name: 'Player',
                parentId: 'runtime-node:scene-root:scene-a',
                sceneId: 'scene-a',
                scope: 'scene',
                source: {
                    bindingId: 'legacy-binding-a',
                    kind: 'scratch-target',
                    role: 'sprite',
                    sceneId: 'scene-a'
                },
                typeId: LEGACY_SCRATCH_SPRITE_NODE_TYPE_ID
            }],
            scenes: [
                {id: 'scene-a', name: 'Scene A'},
                {id: 'scene-b', name: 'Scene B'}
            ],
            version: 1
        },
        [SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY]: {
            scenes: {
                'scene-a': {
                    items: [{
                        bindingId: 'legacy-binding-a',
                        lastKnownName: 'Player',
                        nodeId: 'stable-node-a',
                        role: 'sprite',
                        serializedTargetIndex: 1
                    }]
                }
            },
            schemaVersion: 1
        }
    },
    scenes: [
        {id: 'scene-a', name: 'Scene A'},
        {id: 'scene-b', name: 'Scene B'}
    ]
});

const createHarness = () => {
    let project = createLegacyProject();
    const dataListeners = new Set();
    const sceneRuntimeListeners = new Set();
    const sceneDataModel = {
        getStatus: () => ({}),
        readProject: () => clone(project),
        subscribe: listener => {
            dataListeners.add(listener);
            return () => dataListeners.delete(listener);
        },
        writeProject: nextProject => {
            project = clone(nextProject);
            dataListeners.forEach(listener => listener({type: 'data'}));
        }
    };
    const runtime = new EventEmitter();
    runtime.targets = [
        createTarget('stage-a', 'Stage', {isStage: true}),
        createTarget('shared-target', 'Player')
    ];
    const vm = new EventEmitter();
    vm.runtime = runtime;
    const deletedTargetIds = [];
    vm.deleteSprite = targetRuntimeId => {
        deletedTargetIds.push(targetRuntimeId);
        runtime.targets = runtime.targets.filter(target => target.id !== targetRuntimeId);
        vm.emit('targetsUpdate');
        return true;
    };
    const sceneRuntime = {
        subscribe: listener => {
            sceneRuntimeListeners.add(listener);
            return () => sceneRuntimeListeners.delete(listener);
        }
    };
    const runtimeNodeModel = createRuntimeNodeModelService(sceneDataModel);
    const runtimeNodeHost = getRuntimeNodeModelHost(runtimeNodeModel);
    let sequence = 0;
    const adapter = createScratchSpriteNodeAdapterService(
        {vm},
        sceneDataModel,
        runtimeNodeHost.publicCapability,
        {
            nodeTypeRegistration: runtimeNodeHost.typeRegistrationCapability,
            persistenceController: runtimeNodeHost.persistenceController,
            bindingIdFactory: () => `generated-binding-${++sequence}`,
            componentIdFactory: () => `generated-component-${sequence}`,
            nodeIdFactory: () => `generated-node-${sequence}`,
            sceneRuntime
        }
    );
    return {
        adapter,
        deletedTargetIds,
        emitSceneRuntime: change => sceneRuntimeListeners.forEach(listener => listener(change)),
        getProject: () => clone(project),
        runtime,
        runtimeNodeModel,
        setActiveScene: sceneId => {
            project.activeSceneId = sceneId;
            sceneDataModel.writeProject(project);
        },
        vm
    };
};

const assertNoVolatileTargetIdPersisted = project => {
    const serialized = JSON.stringify(project);
    assert.strictEqual(
        serialized.includes('targetRuntimeId'),
        false,
        'Persistent project data must not contain targetRuntimeId.'
    );
};

const main = async () => {
    const harness = createHarness();
    try {
        await flush();

        // Legacy v1 node and sidecar migrate in place to the semantic Sprite model.
        const migratedBinding = harness.adapter.getBinding('scene-a', 'legacy-binding-a');
        assert(migratedBinding, 'Legacy binding should be restored.');
        assert.strictEqual(migratedBinding.nodeId, 'stable-node-a');
        assert.strictEqual(migratedBinding.status, 'bound');
        assert.strictEqual(migratedBinding.targetRuntimeId, 'shared-target');

        const migratedNode = harness.runtimeNodeModel.getNodeSnapshot('stable-node-a');
        assert(migratedNode, 'Migrated semantic Sprite node should exist.');
        assert.strictEqual(migratedNode.typeId, SPRITE_NODE_TYPE_ID);
        assert.deepStrictEqual(migratedNode.source, {
            adapterType: 'scratch.sprite',
            bindingId: 'legacy-binding-a',
            kind: 'compatibility-adapter',
            sceneId: 'scene-a'
        });
        const migratedComponent = migratedNode.components.find(component => (
            component.typeId === SCRATCH_TARGET_BINDING_COMPONENT_TYPE_ID
        ));
        assert(migratedComponent, 'Migrated node should own a Scratch binding component.');
        assert.strictEqual(migratedComponent.data.schemaVersion, 2);
        assert.strictEqual(migratedComponent.data.destroyPolicy, 'delete-target');
        assert.strictEqual(
            harness.getProject().extensionData[SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY].schemaVersion,
            2
        );
        assertNoVolatileTargetIdPersisted(harness.getProject());

        // Scene transition with the same volatile target id proves scene-scoped indexing.
        harness.emitSceneRuntime({fromSceneId: 'scene-a', sceneId: 'scene-b', type: 'before-load'});
        harness.runtime.targets = [
            createTarget('stage-b', 'Stage', {isStage: true}),
            createTarget('shared-target', 'Enemy')
        ];
        harness.vm.emit('targetsUpdate');
        harness.runtime.emit('PROJECT_LOADED');
        await flush();
        harness.setActiveScene('scene-b');
        harness.emitSceneRuntime({fromSceneId: 'scene-a', sceneId: 'scene-b', type: 'loaded'});
        await flush();

        const sceneABinding = harness.adapter.getBinding('scene-a', 'legacy-binding-a');
        const sceneBBindings = harness.adapter.listBindings('scene-b');
        assert.strictEqual(sceneABinding.status, 'offline');
        assert.strictEqual(sceneABinding.targetRuntimeId, null);
        assert.strictEqual(sceneBBindings.length, 1);
        assert.strictEqual(sceneBBindings[0].status, 'bound');
        assert.strictEqual(sceneBBindings[0].targetRuntimeId, 'shared-target');
        assert.notStrictEqual(sceneBBindings[0].nodeId, sceneABinding.nodeId);
        assert.strictEqual(
            harness.adapter.getBindingByTargetRuntimeId('shared-target', 'scene-a'),
            null,
            'Inactive scene must not resolve the active scene target.'
        );
        assert.strictEqual(
            harness.adapter.getBindingByTargetRuntimeId('shared-target', 'scene-b').nodeId,
            sceneBBindings[0].nodeId
        );

        // Explorer projection exposes one semantic row per valid owner and ignores stale bindings.
        const runtimeNodes = harness.runtimeNodeModel.listNodes({includeRoots: false});
        const allBindings = harness.adapter.listBindings();
        const projection = createScratchSpriteTreeProjection({
            bindings: allBindings.concat([{
                bindingId: 'stale-binding',
                nodeId: 'missing-node',
                sceneId: 'scene-b',
                status: 'offline',
                targetRuntimeId: null
            }]),
            runtimeNodes
        });
        assert.strictEqual(projection.bindings.length, allBindings.length);
        assert.strictEqual(projection.bindingByNodeId.has('missing-node'), false);
        assert.strictEqual(projection.bindingByNodeId.has(sceneABinding.nodeId), true);
        assert.strictEqual(projection.bindingByNodeId.has(sceneBBindings[0].nodeId), true);
        assert.deepStrictEqual(projection.hiddenTargetRuntimeIds, ['shared-target']);

        // Explicit owner deletion removes Scratch Target, Sidecar and Runtime subtree atomically.
        const child = harness.runtimeNodeModel.createNode('ngvge.node2d', {
            name: 'Enemy Child',
            parentId: sceneBBindings[0].nodeId,
            sceneId: 'scene-b'
        });
        await harness.adapter.destroyBindingByNodeId(sceneBBindings[0].nodeId, {
            reason: '0008.7.3-validation'
        });
        await flush();
        assert.strictEqual(harness.runtimeNodeModel.getNodeSnapshot(sceneBBindings[0].nodeId), null);
        assert.strictEqual(harness.runtimeNodeModel.getNodeSnapshot(child.id), null);
        assert.strictEqual(harness.adapter.listBindings('scene-b').length, 0);
        assert.strictEqual(harness.runtime.targets.some(target => target.id === 'shared-target'), false);
        assert.deepStrictEqual(
            harness.getProject().extensionData[SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY].scenes['scene-b'].items,
            []
        );

        // Return to Scene A and delete through Runtime Node Model to test interception.
        harness.emitSceneRuntime({fromSceneId: 'scene-b', sceneId: 'scene-a', type: 'before-load'});
        harness.runtime.targets = [
            createTarget('stage-a-restored', 'Stage', {isStage: true}),
            createTarget('shared-target', 'Player')
        ];
        harness.setActiveScene('scene-a');
        harness.emitSceneRuntime({fromSceneId: 'scene-b', sceneId: 'scene-a', type: 'loaded'});
        await flush();
        const restoredA = harness.adapter.getBinding('scene-a', 'legacy-binding-a');
        assert.strictEqual(restoredA.nodeId, 'stable-node-a');
        assert.strictEqual(restoredA.status, 'bound');
        assert.strictEqual(restoredA.targetRuntimeId, 'shared-target');

        harness.runtimeNodeModel.destroyNode(restoredA.nodeId);
        await flush();
        assert.strictEqual(harness.adapter.listBindings('scene-a').length, 0);
        assert.strictEqual(harness.runtime.targets.some(target => target.id === 'shared-target'), false);
        assert.deepStrictEqual(
            harness.getProject().extensionData[SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY].scenes['scene-a'].items,
            []
        );
        assert.strictEqual(harness.deletedTargetIds.filter(id => id === 'shared-target').length, 2);
        assertNoVolatileTargetIdPersisted(harness.getProject());

        const status = harness.adapter.getStatus();
        assert.strictEqual(status.schemaVersion, 2);
        assert.strictEqual(status.bindingCount, 0);
        assert.strictEqual(status.error, null);

        process.stdout.write('NGVGE 0008.7.3 conformance smoke passed.\n');
    } finally {
        harness.adapter.dispose();
        harness.runtimeNodeModel.dispose();
    }
};

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
