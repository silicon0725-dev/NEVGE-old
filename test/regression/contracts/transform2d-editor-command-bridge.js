const assert = require('assert');
const {EventEmitter} = require('events');

const assertTransform2DEditorCommandBridgeContract = () => {
    const {
        createScratchSpriteNodeAdapterService,
        createScratchTransformCommandBridge,
        createScratchTransformProjectionService
    } = require('../../../src/lib/scratch-sprite-adapter');
    const {
        createRuntimeNodeModelService,
        getRuntimeNodeModelHost
    } = require('../../../src/lib/runtime-nodes');
    const {
        createTransform2DCommandCapability,
        createTransform2DEditorClient,
        createTransform2DRuntimeStoreForModel
    } = require('../../../src/lib/transform-system');
    const {validateProtocolDTO} = require('../../../src/core/protocol');

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
        id: 'scratch-target:editor-regression',
        isOriginal: true,
        isStage: false,
        size: 100,
        sprite: {name: 'Player'},
        x: 0,
        y: 0,
        setXY (x, y) { this.x = x; this.y = y; },
        setDirection (direction) { this.direction = direction; },
        setSize (size) { this.size = size; }
    };
    runtime.targets = [target];
    runtime.getTargetById = id => runtime.targets.find(candidate => candidate && candidate.id === id) || null;
    vm.runtime = runtime;
    const context = {vm};
    const adapter = createScratchSpriteNodeAdapterService(
        context,
        sceneDataModel,
        host.publicCapability,
        {
            bindingIdFactory: () => 'scratch-binding:editor-regression',
            componentIdFactory: () => 'runtime-component:scratch-binding-editor-regression',
            nodeIdFactory: () => 'runtime-node:scratch-editor-regression',
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
    const bridge = createScratchTransformCommandBridge(
        context,
        sceneDataModel,
        host.publicCapability,
        adapter,
        projection
    );
    const editor = createTransform2DEditorClient(createTransform2DCommandCapability(bridge));
    const nodeId = 'runtime-node:scratch-editor-regression';
    const component = host.publicCapability.getNodeSnapshot(nodeId)
        .components.find(item => item.typeId === 'ngvge.transform2d');

    const result = editor.patchComponent({
        componentId: component.id,
        nodeId,
        patch: {position: [25, -15], rotation: 90, scale: [1.25, 1.25]}
    });

    assert.strictEqual(validateProtocolDTO(result).valid, true);
    assert.strictEqual(result.type, 'PatchComponentApplied');
    assert.strictEqual(result.payload.authorityId, 'scratch.compat.transform');
    assert.deepStrictEqual({x: target.x, y: target.y, direction: target.direction, size: target.size}, {
        x: 25,
        y: -15,
        direction: 0,
        size: 125
    });
    assert.deepStrictEqual(store.getRuntimeTransform(nodeId), clone(result.payload.transform));
    assert.deepStrictEqual(store.getPersistentTransform(nodeId), clone(result.payload.transform));
    assert.doesNotMatch(JSON.stringify(project.extensionData.runtimeNodeModel || {}), /scratch-target:editor-regression/);

    const before = {x: target.x, y: target.y, direction: target.direction, size: target.size};
    const rejectedScale = editor.patchComponent({
        componentId: component.id,
        nodeId,
        patch: {position: [999, 999], scale: [2, 1]}
    });
    assert.strictEqual(rejectedScale.kind, 'error');
    assert.strictEqual(rejectedScale.code, 'SCRATCH_TRANSFORM_SCALE_UNREPRESENTABLE');
    assert.strictEqual(validateProtocolDTO(rejectedScale).valid, true);
    assert.deepStrictEqual({x: target.x, y: target.y, direction: target.direction, size: target.size}, before);

    bridge.dispose();
    projection.dispose();
    store.dispose();
    adapter.dispose();
    host.dispose();

    return {
        editorUsesPatchComponent: true,
        scratchWriterAuthorityPreserved: true,
        acceptedAuthorityStatePersisted: true,
        unrepresentableScaleFailsClosed: true,
        targetIdentityNotPersisted: true
    };
};

module.exports = {
    assertTransform2DEditorCommandBridgeContract
};
