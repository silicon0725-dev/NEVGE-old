#!/usr/bin/env node
'use strict';
const {performance} = require('perf_hooks');
const {EventEmitter} = require('events');
const {createScratchSpriteNodeAdapterService, createScratchTransformProjectionService} = require('../../src/lib/scratch-sprite-adapter');
const {createRuntimeNodeModelService, getRuntimeNodeModelHost} = require('../../src/lib/runtime-nodes');
const {createTransform2DRuntimeStoreForModel} = require('../../src/lib/transform-system');
const {createRuntimePhaseScheduler} = require('../../src/lib/runtime-scheduler');
const clone = value => JSON.parse(JSON.stringify(value));
const makeHarness = count => {
    let project = {activeSceneId: 'scene-a', extensionData: {}, scenes: [{id: 'scene-a', name: 'Scene A'}]};
    const listeners = new Set();
    const sceneDataModel = {
        getStatus: () => ({}),
        readProject: () => clone(project),
        subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
        writeProject: next => { project = clone(next); listeners.forEach(listener => listener({type: 'data'})); }
    };
    const model = createRuntimeNodeModelService(sceneDataModel);
    const host = getRuntimeNodeModelHost(model);
    const runtime = new EventEmitter();
    const vm = new EventEmitter();
    const targets = Array.from({length: count}, (_, index) => ({
        direction: 90, id: `target-${index}`, isOriginal: true, isStage: false, size: 100,
        sprite: {name: `Sprite ${index}`}, x: index, y: -index
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
    const store = createTransform2DRuntimeStoreForModel(host.publicCapability, host.typeRegistrationCapability);
    const projection = createScratchTransformProjectionService(context, sceneDataModel, host.publicCapability,
        host.typeRegistrationCapability, adapter, {phaseScheduler: scheduler, transformRuntimeStore: store});
    projection.start();
    return {adapter, host, projection, runtime, scheduler, store, targets, vm};
};
const dispose = h => { h.projection.dispose(); h.store.dispose(); h.adapter.dispose(); h.scheduler.dispose(); h.host.dispose(); };
const h = makeHarness(100);
const iterations = 300;
let started = performance.now();
for (let i = 0; i < iterations; i++) {
    h.targets[0].x = i;
    h.projection.projectActiveScene({reason: 'legacy-full-projection-benchmark'});
}
const directMs = performance.now() - started;
started = performance.now();
for (let i = 0; i < iterations; i++) {
    h.targets[0].x = 1000 + i;
    h.runtime.emit('TARGETS_UPDATE');
    h.vm.emit('targetsUpdate');
}
h.scheduler.flushNow(100);
const scheduledMs = performance.now() - started;
console.log(JSON.stringify({
    sprites: 100,
    updateCycles: iterations,
    legacyFullSceneProjectionMs: Math.round(directMs * 1000) / 1000,
    scheduledCoalescedMs: Math.round(scheduledMs * 1000) / 1000,
    projectionStatus: h.projection.getStatus(),
    adapterStatus: h.adapter.getStatus()
}, null, 2));
dispose(h);
