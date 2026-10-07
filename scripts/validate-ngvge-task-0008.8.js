#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');
const {EventEmitter} = require('events');

class FakeZipFile {
    constructor (value) {
        this.value = value;
    }

    async (type) {
        if (type === 'string') return typeof this.value === 'string' ? this.value : Buffer.from(this.value).toString('utf8');
        return this.value;
    }
}

class FakeZip {
    constructor () {
        this.files = {};
    }

    file (name, value) {
        if (arguments.length === 1) {
            return Object.prototype.hasOwnProperty.call(this.files, name) ? new FakeZipFile(this.files[name]) : null;
        }
        this.files[name] = value;
        return this;
    }

    generateAsync () {
        FakeZip.lastGeneratedFiles = Object.assign({}, this.files);
        return Promise.resolve('ZmFrZS16aXA=');
    }

    static loadAsync () {
        const zip = new FakeZip();
        Object.keys(FakeZip.lastGeneratedFiles || {}).forEach(name => zip.file(name, FakeZip.lastGeneratedFiles[name]));
        return Promise.resolve(zip);
    }
}

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === '@turbowarp/jszip') return FakeZip;
    return originalLoad.call(this, request, parent, isMain);
};

const {
    PersistentDataValidationError,
    clonePersistentData,
    validatePersistentData
} = require('../src/lib/persistence');
const {
    createRuntimeNodeModelService,
    getRuntimeNodeModelHost
} = require('../src/lib/runtime-nodes/runtime-node-model-service');
const {createSceneDataModelService} = require('../src/lib/scene-system/scene-data-model-service');
const {createScenePersistenceReviewService} = require('../src/lib/scene-system/scene-persistence-review');
const {createSceneSnapshotSerializer} = require('../src/lib/scene-system/scene-snapshot-serializer');
const {
    SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY,
    SCRATCH_TARGET_BINDING_COMPONENT_TYPE_ID
} = require('../src/lib/scratch-sprite-adapter/constants');
const {
    createScratchSpriteNodeAdapterService
} = require('../src/lib/scratch-sprite-adapter/scratch-sprite-node-adapter-service');

const clone = value => clonePersistentData(value);
const flush = (milliseconds = 35) => new Promise(resolve => setTimeout(resolve, milliseconds));
const encode = value => new TextEncoder().encode(value);

const createContext = vm => {
    let storedData = null;
    const listeners = new Set();
    const context = {
        data: {
            get: fallback => storedData === null ? fallback : clone(storedData),
            set: value => {
                storedData = clone(value);
                listeners.forEach(listener => listener({moduleId: 'ngvge.scene-system'}));
            },
            subscribe: listener => {
                listeners.add(listener);
                return () => listeners.delete(listener);
            }
        },
        moduleId: 'ngvge.scene-system',
        vm
    };
    return {
        context,
        getStoredData: () => storedData === null ? null : clone(storedData)
    };
};

const createTarget = (id, name, options = {}) => ({
    id,
    isOriginal: options.isOriginal !== false,
    isStage: Boolean(options.isStage),
    sprite: {name}
});

const createVM = targetId => {
    const vm = new EventEmitter();
    vm.runtime = new EventEmitter();
    vm.runtime.targets = [
        createTarget(`stage-${targetId}`, 'Stage', {isStage: true}),
        createTarget(targetId, 'Player')
    ];
    vm.deleteSprite = id => {
        vm.runtime.targets = vm.runtime.targets.filter(target => target.id !== id);
        vm.emit('targetsUpdate');
        return true;
    };
    return vm;
};

const assertPersistentContract = () => {
    assert.deepStrictEqual(clonePersistentData({items: [1, {value: true}]}), {items: [1, {value: true}]});
    const invalidCases = [
        {value: () => true},
        {value: undefined},
        {value: Number.NaN},
        {value: new Date()},
        {value: Promise.resolve(true)}
    ];
    invalidCases.forEach(value => {
        assert.strictEqual(validatePersistentData(value).valid, false);
        assert.throws(() => clonePersistentData(value), PersistentDataValidationError);
    });
    const circular = {};
    circular.self = circular;
    assert(validatePersistentData(circular).issues.some(issue => issue.code === 'persistent.object.cycle'));
};

const assertFutureRuntimeStateProtection = () => {
    const futureState = {
        activeSceneId: 'scene-a',
        futureField: true,
        nodes: [],
        scenes: [{id: 'scene-a', name: 'Scene A'}],
        version: 99
    };
    let project = {
        activeSceneId: 'scene-a',
        extensionData: {runtimeNodeModel: futureState},
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
    const runtimeNodeHost = getRuntimeNodeModelHost(runtimeNodeModel);
    try {
        assert.deepStrictEqual(runtimeNodeModel.getImportStatus().persistenceReadOnly, true);
        assert.strictEqual(runtimeNodeModel.getImportStatus().storedStateVersion, 99);
        assert.throws(
            () => runtimeNodeModel.createNode('ngvge.node', {sceneId: 'scene-a'}),
            error => error && error.code === 'RUNTIME_NODE_STATE_READ_ONLY'
        );
        assert.strictEqual(runtimeNodeModel.persistState(), false);
        assert.deepStrictEqual(project.extensionData.runtimeNodeModel, futureState);
    } finally {
        runtimeNodeModel.dispose();
    }
};

const assertSceneGraphPersistence = async () => {
    const vm = createVM('target-runtime-a');
    const harness = createContext(vm);
    const sceneDataModel = createSceneDataModelService(harness.context);
    const initial = sceneDataModel.createProject({sceneIdFactory: () => 'scene-a'});
    initial.scenes.push(sceneDataModel.createScene({id: 'scene-b', name: 'Scene B'}));
    initial.extensionData[SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY] = {
        scenes: {
            'scene-b': {
                items: [{
                    bindingId: 'binding-scene-b',
                    destroyPolicy: 'detach-target',
                    lastKnownName: 'Offline NPC',
                    nodeId: 'node-scene-b',
                    role: 'sprite',
                    serializedTargetIndex: 1
                }]
            }
        },
        schemaVersion: 2
    };
    sceneDataModel.writeProject(initial);

    const beforeInvalidWrite = sceneDataModel.readProject();
    const invalidProject = sceneDataModel.readProject();
    invalidProject.extensionData.invalidCallback = () => true;
    assert.throws(
        () => sceneDataModel.writeProject(invalidProject),
        error => error && error.code === 'SCENE_PERSISTENT_DATA_INVALID'
    );
    assert.deepStrictEqual(sceneDataModel.readProject(), beforeInvalidWrite);

    let runtimeNodeModel = createRuntimeNodeModelService(sceneDataModel);
    let runtimeNodeHost = getRuntimeNodeModelHost(runtimeNodeModel);
    let adapter = createScratchSpriteNodeAdapterService(
        harness.context,
        sceneDataModel,
        runtimeNodeHost.publicCapability,
        {
            nodeTypeRegistration: runtimeNodeHost.typeRegistrationCapability,
            persistenceController: runtimeNodeHost.persistenceController,
            bindingIdFactory: () => 'binding-scene-a',
            componentIdFactory: () => 'component-scene-a',
            nodeIdFactory: () => 'node-scene-a'
        }
    );
    await flush();

    const firstA = adapter.listBindings('scene-a')[0];
    const firstB = adapter.listBindings('scene-b')[0];
    assert(firstA && firstB, 'Active and offline scene bindings must be available.');
    assert.strictEqual(firstA.targetRuntimeId, 'target-runtime-a');
    assert.strictEqual(firstB.status, 'offline');
    assert.strictEqual(firstB.targetRuntimeId, null);

    const firstStored = sceneDataModel.readProject();
    const storedNode = firstStored.extensionData.runtimeNodeModel.nodes.find(node => node.id === firstA.nodeId);
    const bindingComponent = storedNode.components.find(component => (
        component.typeId === SCRATCH_TARGET_BINDING_COMPONENT_TYPE_ID
    ));
    assert(bindingComponent, 'Scratch binding component must be persisted as semantic data.');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(bindingComponent.data, 'lifecycle'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(bindingComponent.data, 'targetRuntimeId'), false);
    assert.strictEqual(JSON.stringify(firstStored).includes('target-runtime-a'), false);

    const stableA = {bindingId: firstA.bindingId, nodeId: firstA.nodeId};
    const stableB = {bindingId: firstB.bindingId, nodeId: firstB.nodeId};
    adapter.dispose();
    runtimeNodeModel.dispose();

    vm.runtime.targets = [
        createTarget('stage-runtime-b', 'Stage', {isStage: true}),
        createTarget('target-runtime-b', 'Player')
    ];
    runtimeNodeModel = createRuntimeNodeModelService(sceneDataModel);
    runtimeNodeHost = getRuntimeNodeModelHost(runtimeNodeModel);
    adapter = createScratchSpriteNodeAdapterService(harness.context, sceneDataModel, runtimeNodeHost.publicCapability, {
        nodeTypeRegistration: runtimeNodeHost.typeRegistrationCapability,
        persistenceController: runtimeNodeHost.persistenceController,
        bindingIdFactory: () => 'must-not-replace-binding',
        componentIdFactory: () => 'must-not-replace-component',
        nodeIdFactory: () => 'must-not-replace-node'
    });
    await flush();

    const restoredA = adapter.getBindingByTargetRuntimeId('target-runtime-b', 'scene-a');
    const restoredB = adapter.listBindings('scene-b')[0];
    assert.deepStrictEqual(
        {bindingId: restoredA.bindingId, nodeId: restoredA.nodeId},
        stableA,
        'Active Scene identity must survive runtime reconstruction.'
    );
    assert.deepStrictEqual(
        {bindingId: restoredB.bindingId, nodeId: restoredB.nodeId},
        stableB,
        'Offline Scene identity must survive runtime reconstruction.'
    );
    assert.strictEqual(restoredA.targetRuntimeId, 'target-runtime-b');

    const review = createScenePersistenceReviewService(sceneDataModel, runtimeNodeModel, adapter);
    assert.deepStrictEqual(review.audit().valid, true);

    const withoutSceneB = sceneDataModel.readProject();
    withoutSceneB.scenes = withoutSceneB.scenes.filter(scene => scene.id !== 'scene-b');
    sceneDataModel.writeProject(withoutSceneB);
    await flush();
    const pruned = sceneDataModel.readProject();
    assert.strictEqual(
        Object.prototype.hasOwnProperty.call(
            pruned.extensionData[SCRATCH_SPRITE_BINDINGS_EXTENSION_DATA_KEY].scenes,
            'scene-b'
        ),
        false,
        'Deleting a Scene must prune its Scratch binding sidecar.'
    );
    assert.deepStrictEqual(review.audit().valid, true);

    adapter.dispose();
    runtimeNodeModel.dispose();
    sceneDataModel.dispose();
};


const assertPersistenceReviewDetectsLeakage = () => {
    const project = {
        activeSceneId: 'scene-a',
        extensionData: {
            runtimeNodeModel: {
                activeSceneId: 'scene-a',
                nodes: [{
                    activeInHierarchy: true,
                    components: [{
                        data: {
                            bindingId: 'binding-a',
                            lifecycle: 'attached',
                            sceneId: 'scene-a'
                        },
                        enabled: true,
                        id: 'component-a',
                        typeId: SCRATCH_TARGET_BINDING_COMPONENT_TYPE_ID
                    }],
                    enabled: true,
                    id: 'node-a',
                    name: 'Player',
                    parentId: 'runtime-node:scene-root:scene-a',
                    sceneId: 'scene-a',
                    scope: 'scene',
                    typeId: 'ngvge.sprite-node'
                }],
                scenes: [{id: 'scene-a', name: 'Scene A'}],
                version: 1
            }
        },
        scenes: [{id: 'scene-a', name: 'Scene A', snapshot: null}]
    };
    const review = createScenePersistenceReviewService(
        {
            readProject: () => clone(project),
            validateProject: () => ({errors: [], valid: true, warnings: []})
        },
        {validatePersistentState: () => ({valid: true})},
        {validatePersistentBindings: () => ({issues: [], valid: true})}
    );
    const report = review.audit();
    assert.strictEqual(report.valid, false);
    assert(report.issues.some(issue => issue.code === 'SCENE_PERSISTENCE_RUNTIME_NODE_FIELD'));
    assert(report.issues.some(issue => issue.code === 'SCENE_PERSISTENCE_SCRATCH_RUNTIME_FIELD'));
};

const assertRestoreRollback = async () => {
    let currentProject = {
        marker: 'snapshot-target',
        projectVersion: 3,
        targets: [{isStage: true, name: 'Stage'}]
    };
    const vm = {
        deserializeProjectCalls: [],
        runtime: {handleProjectLoadedCalls: 0},
        saveProjectSb3DontZip: () => ({
            'project.json': encode(JSON.stringify(currentProject))
        }),
        stopAllCalls: 0
    };
    vm.stopAll = () => {
        vm.stopAllCalls += 1;
    };
    vm.runtime.handleProjectLoaded = () => {
        vm.runtime.handleProjectLoadedCalls += 1;
    };
    vm.deserializeProject = async projectJSON => {
        vm.deserializeProjectCalls.push(clone(projectJSON));
        if (vm.deserializeProjectCalls.length === 1) throw new Error('target restore failed');
    };

    const harness = createContext(vm);
    const dataModel = createSceneDataModelService(harness.context);
    dataModel.ensureProject();
    const serializer = createSceneSnapshotSerializer(harness.context, dataModel, {
        ZipClass: FakeZip,
        navigatorObject: null,
        performanceObject: null,
        processObject: null
    });
    const snapshot = await serializer.captureActiveScene({capturedAt: '2026-08-05T00:00:00.000Z'});
    currentProject = {
        marker: 'project-before-restore',
        projectVersion: 3,
        targets: [{isStage: true, name: 'Stage'}]
    };

    let thrown = null;
    try {
        await serializer.restore(snapshot);
    } catch (error) {
        thrown = error;
    }
    assert(thrown, 'Restore failure must be propagated.');
    assert.deepStrictEqual(thrown.rollback, {attempted: true, error: null, succeeded: true});
    assert.strictEqual(vm.deserializeProjectCalls.length, 2);
    assert.strictEqual(vm.deserializeProjectCalls[0].marker, 'snapshot-target');
    assert.strictEqual(vm.deserializeProjectCalls[1].marker, 'project-before-restore');
    assert.strictEqual(vm.runtime.handleProjectLoadedCalls, 1);
    assert.deepStrictEqual(serializer.getStatus().lastRollback, {
        attempted: true,
        error: null,
        succeeded: true
    });

    serializer.dispose();
    dataModel.dispose();
};

const main = async () => {
    assertPersistentContract();
    assertFutureRuntimeStateProtection();
    assertPersistenceReviewDetectsLeakage();
    await assertSceneGraphPersistence();
    await assertRestoreRollback();
    process.stdout.write('NGVGE 0008.8 scene graph persistence smoke passed.\n');
};

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
