const assert = require('assert');
const {EventEmitter} = require('events');

const assertScratchTransformProjectionContract = () => {
    const {
        createScratchSpriteNodeAdapterService,
        createScratchTransformProjectionService,
        readScratchTargetTransform
    } = require('../../../src/lib/scratch-sprite-adapter');
    const {
        createRuntimeNodeModelService,
        getRuntimeNodeModelHost
    } = require('../../../src/lib/runtime-nodes');
    const {
        createTransform2DRuntimeStoreForModel
    } = require('../../../src/lib/transform-system');

    const clone = value => JSON.parse(JSON.stringify(value));
    let project = {
        activeSceneId: 'scene-a',
        extensionData: {},
        scenes: [{id: 'scene-a', name: 'Scene A'}]
    };
    const listeners = new Set();
    const sceneDataModel = {
        getStatus: () => ({}),
        readProject: () => clone(project),
        subscribe: listener => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        writeProject: nextProject => {
            project = clone(nextProject);
            listeners.forEach(listener => listener({type: 'data'}));
        }
    };
    const runtimeNodeModel = createRuntimeNodeModelService(sceneDataModel);
    const host = getRuntimeNodeModelHost(runtimeNodeModel);
    const runtime = new EventEmitter();
    const vm = new EventEmitter();
    const target = {
        direction: 90,
        id: 'scratch-target:regression',
        isOriginal: true,
        isStage: false,
        size: 100,
        sprite: {name: 'Player'},
        x: 0,
        y: 0
    };
    runtime.targets = [target];
    vm.runtime = runtime;
    const context = {vm};
    const adapter = createScratchSpriteNodeAdapterService(
        context,
        sceneDataModel,
        host.publicCapability,
        {
            bindingIdFactory: () => 'scratch-binding:regression',
            componentIdFactory: () => 'runtime-component:scratch-binding-regression',
            nodeIdFactory: () => 'runtime-node:scratch-regression',
            nodeTypeRegistration: host.typeRegistrationCapability,
            persistenceController: host.persistenceController
        }
    );
    const store = createTransform2DRuntimeStoreForModel(
        host.publicCapability,
        host.typeRegistrationCapability
    );
    const projection = createScratchTransformProjectionService(
        context,
        sceneDataModel,
        host.publicCapability,
        host.typeRegistrationCapability,
        adapter,
        {transformRuntimeStore: store}
    );

    projection.bootstrapActiveScene();
    const projectBeforeRuntimeProjection = clone(project);
    const persistentBeforeRuntimeProjection = host.publicCapability.exportState();
    target.x = 64;
    target.y = -32;
    target.direction = 0;
    target.size = 150;
    projection.projectActiveScene();

    assert.deepStrictEqual(project, projectBeforeRuntimeProjection);
    assert.deepStrictEqual(host.publicCapability.exportState(), persistentBeforeRuntimeProjection);
    assert.deepStrictEqual(store.getRuntimeTransform('runtime-node:scratch-regression'), readScratchTargetTransform(target));
    assert.strictEqual(store.isRuntimeDivergedFromPersistent('runtime-node:scratch-regression'), true);

    projection.commitActiveSceneToPersistent();
    assert.deepStrictEqual(store.getPersistentTransform('runtime-node:scratch-regression'), readScratchTargetTransform(target));
    assert.doesNotMatch(JSON.stringify(project.extensionData.runtimeNodeModel || {}), /scratch-target:regression/);

    projection.dispose();
    store.dispose();
    adapter.dispose();
    host.dispose();

    return {
        explicitPersistenceCommit: true,
        highFrequencyRuntimeOnly: true,
        projectionDirection: 'Scratch -> NGVGE',
        rendererPrivateStateRequired: false,
        stableNodeOwnership: true
    };
};

module.exports = {
    assertScratchTransformProjectionContract
};
