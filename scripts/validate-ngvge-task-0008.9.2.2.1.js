#!/usr/bin/env node
'use strict';
const assert = require('assert');
const {BUILTIN_RUNTIME_NODE_TYPE_IDS, createRuntimeNodeModelHost} = require('../src/lib/runtime-nodes');
const clone = value => JSON.parse(JSON.stringify(value));
const createSceneDataModel = () => {
    let project = {activeSceneId: 'scene-a', extensionData: {}, scenes: [{id: 'scene-a', name: 'Scene A'}]};
    const listeners = new Set();
    return {
        getProject: () => clone(project),
        getStatus: () => ({readOnly: false}),
        readProject: () => clone(project),
        subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
        writeProject: next => { project = clone(next); listeners.forEach(listener => listener({type: 'data'})); }
    };
};
const host = createRuntimeNodeModelHost(createSceneDataModel());
const model = host.publicCapability;
let nested = null;
const unsubscribe = model.subscribe(event => {
    if (event.type === 'lifecycle' && event.phase === 'attach' && event.nodeId === 'dispose-victim') {
        try { host.localHostCapability.dispose(); } catch (error) { nested = error; }
    }
});
const result = model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
    id: 'dispose-victim', sceneId: 'scene-a'
});
assert.strictEqual(result.applied, true);
assert.strictEqual(result.persisted, true);
assert(nested);
assert.strictEqual(nested.code, 'RUNTIME_LIFECYCLE_REENTRANT_MUTATION');
assert(model.getNodeSnapshot('dispose-victim'));
assert.strictEqual(model.getStatus().persistent, true);
unsubscribe();
host.localHostCapability.dispose();
host.localHostCapability.dispose();
assert.throws(() => model.getStatus(), error => error && error.code === 'RUNTIME_NODE_MODEL_DISPOSED');
console.log('NGVGE 0008.9.2.2.1 Local Host Dispose Preflight Hotfix smoke passed.');
