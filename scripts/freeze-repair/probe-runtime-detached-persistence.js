#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
    BUILTIN_RUNTIME_NODE_TYPE_IDS,
    createRuntimeNodeModelHost
} = require('../../src/lib/runtime-nodes');

const clone = value => JSON.parse(JSON.stringify(value));

const createSceneDataModel = () => {
    let project = {
        activeSceneId: 'scene-a',
        extensionData: {},
        scenes: [{id: 'scene-a', name: 'Scene A'}]
    };

    return {
        getProject: () => clone(project),
        service: {
            getStatus: () => ({}),
            readProject: () => clone(project),
            subscribe: () => () => {},
            writeProject: nextProject => {
                project = clone(nextProject);
            }
        }
    };
};

const data = createSceneDataModel();
const host = createRuntimeNodeModelHost(data.service);
const model = host.publicCapability;

try {
    assert.strictEqual(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'parent',
        sceneId: 'scene-a'
    }).applied, true);
    assert.strictEqual(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'child-a',
        parentId: 'parent',
        sceneId: 'scene-a'
    }).applied, true);
    assert.strictEqual(model.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
        id: 'child-b',
        parentId: 'parent',
        sceneId: 'scene-a'
    }).applied, true);

    const firstDetach = model.detachNode('child-a');
    assert.strictEqual(firstDetach.applied, true, 'First detached node must persist.');

    const secondDetach = model.detachNode('child-b');
    if (!secondDetach.applied) {
        const error = new Error(secondDetach.error && secondDetach.error.message || 'Second detach failed.');
        error.code = secondDetach.error && secondDetach.error.code;
        throw error;
    }

    const persisted = data.getProject().extensionData.runtimeNodeModel;
    const detachedIds = persisted.nodes
        .filter(node => node.parentId === null)
        .map(node => node.id)
        .sort();

    assert.deepStrictEqual(detachedIds, ['child-a', 'child-b']);
    console.log('PASS: multiple detached Runtime Nodes persist deterministically.');
} finally {
    host.dispose();
}
