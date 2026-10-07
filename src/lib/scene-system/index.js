const constants = require('./constants');
const {createId, createIdFactory} = require('./id');
const {getSceneSystemModuleDefinition} = require('./module-definition');
const sceneDataModel = require('./scene-data-model');
const {createSceneDataModelService} = require('./scene-data-model-service');
const sceneSnapshot = require('./scene-snapshot');
const {createSceneSnapshotSerializer} = require('./scene-snapshot-serializer');
const sceneCacheBudget = require('./scene-cache-budget');
const sceneCacheManager = require('./scene-cache-manager');
const {createSceneRuntimeManager} = require('./scene-runtime-manager');
const {createSceneManager} = require('./scene-manager');
const sceneController = require('./scene-controller');
const scenePersistenceReview = require('./scene-persistence-review');
const blankSceneProject = require('./blank-scene-project');
const runtimeNodes = require('../runtime-nodes');
const scratchSpriteAdapter = require('../scratch-sprite-adapter');

module.exports = {
    createId,
    createIdFactory,
    createSceneDataModelService,
    createSceneManager,
    createSceneRuntimeManager,
    createSceneSnapshotSerializer,
    getSceneSystemModuleDefinition,
    ...blankSceneProject,
    ...runtimeNodes,
    ...scratchSpriteAdapter,
    ...sceneCacheBudget,
    ...sceneCacheManager,
    ...sceneController,
    ...scenePersistenceReview,
    ...constants,
    ...sceneDataModel,
    ...sceneSnapshot
};
