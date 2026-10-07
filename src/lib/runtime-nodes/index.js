const constants = require('./constants');
const componentContainer = require('./component-container');
const runtimeComponentContract = require('./runtime-component-contract');
const runtimeComponentTypeRegistry = require('./runtime-component-type-registry');
const {createRuntimeId} = require('./id');
const runtimeNode = require('./runtime-node');
const runtimeNodeApiContract = require('./runtime-node-api-contract');
const runtimeNodeCommandCapability = require('./runtime-node-command-capability');
const runtimeNodeCommandExecutor = require('./runtime-node-command-executor');
const runtimeNodeTypeRegistry = require('./runtime-node-type-registry');
const {RuntimeNodeGraph, normalizeSceneDescriptor} = require('./runtime-node-graph');
const runtimeNodeImport = require('./runtime-node-import');
const runtimeNodeErrorPresenter = require('./runtime-node-error-presenter');
const runtimeNodeLifecycle = require('./runtime-node-lifecycle');
const runtimeNodeLifecycleObservation = require('./runtime-node-lifecycle-observation');
const runtimeTreeIdentity = require('./runtime-tree-identity');
const spriteRuntimeNode = require('./sprite-runtime-node');
const runtimeNodeModelService = require('./runtime-node-model-service');
const runtimeNodeSnapshotContract = require('./runtime-node-snapshot-contract');
const portableData = require('./portable-data');

module.exports = {
    RuntimeNodeGraph,
    createRuntimeId,
    normalizeSceneDescriptor,
    ...componentContainer,
    ...runtimeComponentContract,
    ...runtimeComponentTypeRegistry,
    ...constants,
    ...runtimeNodeErrorPresenter,
    ...runtimeNodeImport,
    ...runtimeNodeLifecycle,
    ...runtimeNodeLifecycleObservation,
    ...runtimeNodeModelService,
    ...runtimeNodeSnapshotContract,
    ...runtimeNode,
    ...runtimeNodeApiContract,
    ...runtimeNodeCommandCapability,
    ...runtimeNodeCommandExecutor,
    ...runtimeNodeTypeRegistry,
    ...portableData,
    ...spriteRuntimeNode,
    ...runtimeTreeIdentity
};
