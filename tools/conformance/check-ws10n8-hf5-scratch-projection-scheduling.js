#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {EventEmitter} = require('events');
const {
    createScratchSpriteNodeAdapterService,
    createScratchTransformProjectionService
} = require('../../src/lib/scratch-sprite-adapter');
const {createRuntimeNodeModelService, getRuntimeNodeModelHost} = require('../../src/lib/runtime-nodes');
const {createTransform2DRuntimeStoreForModel} = require('../../src/lib/transform-system');
const {createRuntimePhaseScheduler} = require('../../src/lib/runtime-scheduler');

const clone = value => JSON.parse(JSON.stringify(value));
let project = {activeSceneId: 'scene-a', extensionData: {}, scenes: [{id: 'scene-a', name: 'Scene A'}]};
const sceneListeners = new Set();
const sceneDataModel = {
    getStatus: () => ({}),
    readProject: () => clone(project),
    subscribe: listener => { sceneListeners.add(listener); return () => sceneListeners.delete(listener); },
    writeProject: next => { project = clone(next); sceneListeners.forEach(listener => listener({type: 'data'})); }
};
const runtimeModel = createRuntimeNodeModelService(sceneDataModel);
const host = getRuntimeNodeModelHost(runtimeModel);
const runtime = new EventEmitter();
const vm = new EventEmitter();
const targets = Array.from({length: 100}, (_, index) => ({
    direction: 90,
    id: `target-${index}`,
    isOriginal: true,
    isStage: false,
    size: 100,
    sprite: {name: `Sprite ${index}`},
    x: index,
    y: -index
}));
runtime.targets = [{id: 'stage', isOriginal: true, isStage: true, sprite: {name: 'Stage'}}].concat(targets);
vm.runtime = runtime;
const context = {vm};
const scheduler = createRuntimePhaseScheduler(runtime);
const adapter = createScratchSpriteNodeAdapterService(context, sceneDataModel, host.publicCapability, {
    nodeTypeRegistration: host.typeRegistrationCapability,
    persistenceController: host.persistenceController,
    phaseScheduler: scheduler
});
const transformStore = createTransform2DRuntimeStoreForModel(host.publicCapability, host.typeRegistrationCapability);
const projection = createScratchTransformProjectionService(
    context,
    sceneDataModel,
    host.publicCapability,
    host.typeRegistrationCapability,
    adapter,
    {phaseScheduler: scheduler, transformRuntimeStore: transformStore}
);
projection.start();
const binding = adapter.getBindingByTargetRuntimeId('target-0');
assert.ok(binding);
const before = transformStore.getRuntimeTransform(binding.nodeId);
for (let index = 0; index < 1000; index++) {
    targets[0].x = 1000 + index;
    runtime.emit('TARGETS_UPDATE');
    vm.emit('targetsUpdate');
}
assert.deepStrictEqual(transformStore.getRuntimeTransform(binding.nodeId), before,
    'TARGETS_UPDATE listeners must not synchronously mutate NGVGE Transform runtime state.');
const projectionBeforeFlush = projection.getStatus();
const adapterBeforeFlush = adapter.getStatus();
assert.strictEqual(projectionBeforeFlush.scheduledProjectionCount, 1);
assert.ok(projectionBeforeFlush.coalescedProjectionSignalCount >= 1999);
assert.strictEqual(adapterBeforeFlush.topologyScheduledCheckCount, 1);
assert.ok(adapterBeforeFlush.topologyCoalescedSignalCount >= 1999);
scheduler.flushNow(100);
assert.strictEqual(transformStore.getRuntimeTransform(binding.nodeId).position[0], 1999);
assert.ok(projection.getStatus().topologyRebuildCount <= 1,
    'A burst must not rebuild projection topology once per target signal.');
assert.ok(adapter.getStatus().topologyNoopSignalCount >= 1,
    'Transform-only Scratch updates must be rejected by the lifecycle topology gate.');

projection.dispose();
transformStore.dispose();
adapter.dispose();
scheduler.dispose();
host.dispose();
console.log('WS-10N8-HF5 Scratch Projection Scheduling Behavioral PASS (100 sprites / 2000 update signals -> one scheduled projection).');
