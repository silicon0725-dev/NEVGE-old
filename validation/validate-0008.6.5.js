'use strict';
const assert = require('assert');
const path = require('path');
const PROJECT_ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..');
const ROOT = path.join(PROJECT_ROOT, 'src', 'lib', 'runtime-nodes');
const runtime = require(ROOT);
const {
  BUILTIN_RUNTIME_NODE_TYPE_IDS,
  GLOBAL_ROOT_NODE_ID,
  GLOBAL_SCOPE_TREE_NODE_ID,
  NODE_SCOPES,
  RuntimeNode,
  createRuntimeNodeModelService,
  createRuntimeNodeTypeRegistry,
  getRuntimeRootIdFromTreeId,
  getRuntimeRootTreeId,
  getSceneRootNodeId,
  getSceneTreeNodeId,
  presentRuntimeNodeError
} = runtime;

const clone = x => JSON.parse(JSON.stringify(x));
const createSceneDataModel = initial => {
  let project = clone(initial);
  const listeners = new Set();
  return {
    getStatus: () => ({readOnly: false}),
    getProject: () => clone(project),
    readProject: () => clone(project),
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    writeProject: next => {
      project = clone(next);
      listeners.forEach(fn => fn({type: 'data'}));
    }
  };
};

// Root identity mapping.
assert.equal(getRuntimeRootTreeId({id: GLOBAL_ROOT_NODE_ID, scope: NODE_SCOPES.GLOBAL}), GLOBAL_SCOPE_TREE_NODE_ID);
assert.equal(getRuntimeRootIdFromTreeId(getSceneTreeNodeId('scene-a')), getSceneRootNodeId('scene-a'));
assert.equal(getRuntimeRootTreeId({scope: NODE_SCOPES.SCENE, sceneId: 'scene-a'}), 'scene:scene-a');

// Registry ownership, conflicts and revision.
const registry = createRuntimeNodeTypeRegistry();
const initialRevision = registry.getRevision();
const registryChanges = [];
registry.subscribe(change => registryChanges.push(change));
class PluginNode extends RuntimeNode {}
registry.register({
  allowedScopes: [NODE_SCOPES.SCENE],
  ctor: PluginNode,
  id: 'plugin.node',
  label: 'Plugin Node',
  owner: 'plugin.owner',
  version: '1'
});
assert.equal(registry.getRevision(), initialRevision + 1);
assert.equal(registryChanges.at(-1).type, 'register');
let duplicateError = null;
try {
  registry.register({
    allowedScopes: [NODE_SCOPES.SCENE],
    ctor: PluginNode,
    id: 'plugin.node',
    label: 'Duplicate',
    owner: 'plugin.owner'
  });
} catch (error) { duplicateError = error; }
assert.equal(duplicateError.code, 'RUNTIME_NODE_TYPE_ALREADY_EXISTS');
let mismatchError = null;
try {
  registry.register({
    allowedScopes: [NODE_SCOPES.SCENE],
    ctor: PluginNode,
    id: 'plugin.node',
    label: 'Hijack',
    owner: 'other.owner',
    replace: true
  });
} catch (error) { mismatchError = error; }
assert.equal(mismatchError.code, 'RUNTIME_NODE_TYPE_OWNER_MISMATCH');
registry.register({
  allowedScopes: [NODE_SCOPES.SCENE],
  ctor: PluginNode,
  id: 'plugin.node',
  label: 'Plugin Node v2',
  owner: 'plugin.owner',
  replace: true,
  version: '2'
});
assert.equal(registry.get('plugin.node').version, '2');

const anonymous = createRuntimeNodeTypeRegistry();
anonymous.register({
  allowedScopes: [NODE_SCOPES.SCENE],
  ctor: PluginNode,
  id: 'anonymous.node',
  label: 'Anonymous'
});
let missingOwnerError = null;
try {
  anonymous.register({
    allowedScopes: [NODE_SCOPES.SCENE],
    ctor: PluginNode,
    id: 'anonymous.node',
    label: 'Anonymous v2',
    replace: true
  });
} catch (error) { missingOwnerError = error; }
assert.equal(missingOwnerError.code, 'RUNTIME_NODE_TYPE_REPLACE_OWNER_REQUIRED');

// Service mutation contexts, registry forwarding and persistent/debug DTO split.
const sceneData = createSceneDataModel({
  activeSceneId: 'scene-a',
  extensionData: {},
  scenes: [{id: 'scene-a', name: 'Scene A'}, {id: 'scene-b', name: 'Scene B'}]
});
const serviceRegistry = createRuntimeNodeTypeRegistry();
const service = createRuntimeNodeModelService(sceneData, {typeRegistry: serviceRegistry});
const serviceChanges = [];
service.subscribe(change => serviceChanges.push(change));
const node = service.createNode(BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, {
  name: 'Player',
  sceneId: 'scene-a',
  transactionId: 'tx-create'
});
const component = service.addComponent(node.id, {
  typeId: 'game.motion',
  data: {speed: 2}
}, {transactionId: 'tx-component'});
service.patchComponentData(node.id, component.id, {speed: 10}, {transactionId: 'tx-transform'});
assert(serviceChanges.some(change => change.transactionId === 'tx-create'));
assert(serviceChanges.some(change => change.transactionId === 'tx-component'));
assert(serviceChanges.some(change => change.transactionId === 'tx-transform'));
const persistent = service.exportState().nodes.find(record => record.id === node.id);
assert(!Object.hasOwn(persistent, 'activeInHierarchy'));
assert(!Object.hasOwn(persistent, 'state'));
assert(!Object.hasOwn(persistent, 'childIds'));
assert(!Object.hasOwn(persistent, 'transactionId'));
assert(!Object.hasOwn(persistent.components[0], 'state'));
const debug = service.getDebugSnapshot().nodes.find(record => record.id === node.id);
assert(Object.hasOwn(debug, 'activeInHierarchy'));
assert(Object.hasOwn(debug, 'state'));
assert(Object.hasOwn(debug.components[0], 'state'));

serviceRegistry.register({
  allowedScopes: [NODE_SCOPES.SCENE],
  ctor: PluginNode,
  id: 'dynamic.node',
  label: 'Dynamic Node',
  owner: 'dynamic.plugin'
});
assert(serviceChanges.some(change => change.type === 'registry:change' && change.typeId === 'dynamic.node'));
assert.equal(service.getNodeTypeRegistryRevision(), serviceRegistry.getRevision());

// Import mutation context and atomic current graph preservation on invalid import.
const importState = service.exportState();
service.importState(importState, {transactionId: 'tx-import'});
assert(serviceChanges.some(change => change.type === 'state:import' && change.transactionId === 'tx-import'));
const beforeInvalid = service.getNode(node.id);
let importError = null;
try {
  service.importState({
    activeSceneId: 'scene-a',
    nodes: [
      {id: 'a', typeId: BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, scope: 'scene', sceneId: 'scene-a', parentId: 'b', components: []},
      {id: 'b', typeId: BUILTIN_RUNTIME_NODE_TYPE_IDS.NODE, scope: 'scene', sceneId: 'scene-a', parentId: 'a', components: []}
    ],
    scenes: [{id: 'scene-a', name: 'Scene A'}],
    version: 1
  }, {transactionId: 'tx-invalid-import'});
} catch (error) { importError = error; }
assert(importError);
assert.equal(service.getNode(beforeInvalid.id).name, beforeInvalid.name);

// Opaque placeholder strips old derived fields while preserving provider payload.
const unknownState = {
  activeSceneId: 'scene-a',
  nodes: [{
    activeInHierarchy: true,
    childIds: ['derived-child'],
    components: [{
      activeInHierarchy: true,
      data: {value: 1},
      id: 'missing-component',
      ownerId: 'opaque',
      state: 'ready',
      typeId: 'plugin.component'
    }],
    id: 'opaque',
    name: 'Opaque',
    parentId: getSceneRootNodeId('scene-a'),
    sceneId: 'scene-a',
    scope: 'scene',
    state: 'ready',
    typeId: 'missing.provider-node',
    vendorPayload: {preserved: true}
  }],
  scenes: [{id: 'scene-a', name: 'Scene A'}],
  version: 1
};
service.importState(unknownState);
const opaque = service.getNode('opaque');
assert.equal(opaque.originalTypeId, 'missing.provider-node');
const opaquePersistent = service.exportState().nodes.find(record => record.id === 'opaque');
assert.deepEqual(opaquePersistent.vendorPayload, {preserved: true});
assert(!Object.hasOwn(opaquePersistent, 'activeInHierarchy'));
assert(!Object.hasOwn(opaquePersistent, 'childIds'));
assert(!Object.hasOwn(opaquePersistent, 'state'));
assert(!Object.hasOwn(opaquePersistent.components[0], 'activeInHierarchy'));
assert(!Object.hasOwn(opaquePersistent.components[0], 'ownerId'));
assert(!Object.hasOwn(opaquePersistent.components[0], 'state'));

const presented = presentRuntimeNodeError(duplicateError, {action: 'register', typeId: 'plugin.node'});
assert.equal(presented.title, 'Unable to register runtime node type');
assert(presented.suggestion.length > 0);

service.dispose();
console.log('0008.6.5 runtime/editor contract smoke tests passed');
