const {
    MODULE_AVAILABILITY,
    MODULE_KINDS,
    MODULE_PERMISSIONS,
    SB3_COMPATIBILITY_LEVELS,
    CORE_MODULE_ID
} = require('../first-party-modules/constants');
const {
    SCENE_CONTROLLER_CAPABILITY_ID,
    SCENE_DATA_MODEL_CAPABILITY_ID,
    RUNTIME_NODE_MODEL_CAPABILITY_ID,
    RUNTIME_NODE_SNAPSHOT_CAPABILITY_ID,
    RUNTIME_NODE_TYPE_REGISTRATION_CAPABILITY_ID,
    SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID,
    SCENE_MANAGER_CAPABILITY_ID,
    SCENE_PERSISTENCE_REVIEW_CAPABILITY_ID,
    SCENE_RUNTIME_CAPABILITY_ID,
    SCENE_SNAPSHOT_CAPABILITY_ID,
    SCENE_SYSTEM_MODULE_ID,
    VARIABLE_SCOPES
} = require('./constants');
const {createSceneDataModelService} = require('./scene-data-model-service');
const {createSceneSnapshotSerializer} = require('./scene-snapshot-serializer');
const {createRuntimeNodeModelHost} = require('../runtime-nodes/runtime-node-model-service');
const {
    RUNTIME_NODE_COMMAND_CAPABILITY_ID,
    createRuntimeNodeCommandCapability,
    createRuntimeNodeCommandExecutor
} = require('../runtime-nodes');
const {createScratchSpriteNodeAdapterService} = require('../scratch-sprite-adapter/scratch-sprite-node-adapter-service');
const {createScratchTransformProjectionService} = require('../scratch-sprite-adapter/scratch-transform-projection-service');
const {createScratchTransformCommandBridge} = require('../scratch-sprite-adapter/scratch-transform-command-bridge');
const {createScratchSpriteLifecycleCommandBridge} = require('../scratch-sprite-adapter/scratch-sprite-lifecycle-command-bridge');
const {
    SCRATCH_ROLE_MANAGER_PARITY_CAPABILITY_ID,
    createScratchRoleManagerParityService
} = require('../scratch-sprite-adapter/scratch-role-manager-parity');
const {createTransform2DSceneWriterRouteResolver} = require('./transform2d-writer-route-resolver');
const {
    TRANSFORM2D_COMMAND_CAPABILITY_ID,
    TRANSFORM2D_RUNTIME_CAPABILITY_ID,
    createNativeTransformCommandBridge,
    createTransform2DCommandCapability,
    createTransform2DRuntimeCapability,
    createTransform2DRuntimeStoreForModel,
    createTransform2DWriterRouter
} = require('../transform-system');
const {createScenePersistenceReviewService} = require('./scene-persistence-review');
const {
    FUNCTIONAL_NODE_CREATION_CAPABILITY_ID,
    createFunctionalNodeCreationService
} = require('../functional-node');
const {
    CAMERA2D_COMMAND_CAPABILITY_ID,
    CAMERA2D_RUNTIME_CAPABILITY_ID,
    createCamera2DCommandCapability,
    createCamera2DCommandExecutor,
    createCamera2DRuntimeService,
    createScratchRenderCamera2DAdapter
} = require('../camera-system');
const {
    COLLIDER2D_COMMAND_CAPABILITY_ID,
    COLLIDER2D_RUNTIME_CAPABILITY_ID,
    createCollider2DCommandCapability,
    createCollider2DCommandExecutor,
    createCollider2DRuntimeService
} = require('../collision-system');
const {
    CHARACTER_CONTROLLER2D_COMMAND_CAPABILITY_ID,
    CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_ID,
    createCharacterController2DCommandCapability,
    createCharacterController2DCommandExecutor,
    createCharacterController2DRuntimeService
} = require('../character-controller-system');
const {
    PHYSICS2D_RUNTIME_CAPABILITY_ID,
    PHYSICS_MATERIAL2D_RESOURCE_CAPABILITY_ID,
    RIGIDBODY2D_COMMAND_CAPABILITY_ID,
    createPhysics2DRuntimeService,
    createPhysicsMaterial2DResourceService,
    createRigidBody2DCommandCapability,
    createRigidBody2DCommandExecutor,
    installPhysicsMaterial2DResourceService
} = require('../physics-system');
const {loadRapier2DCompat} = require('../physics-system/rapier2d-package-loader');
const {
    TILESET_RESOURCE_CAPABILITY_ID,
    TILEMAP_LAYER2D_COMMAND_CAPABILITY_ID,
    TILEMAP_LAYER2D_RUNTIME_CAPABILITY_ID,
    createTileMapLayer2DCommandCapability,
    createTileMapLayer2DCommandExecutor,
    createTileMapLayer2DRuntimeService,
    createTileSetResourceService,
    installTileSetResourceService
} = require('../tilemap-system');
const {
    createSceneController,
    createSceneControllerCapability,
    createSceneManagerAdapter,
    createSceneRuntimeAdapter
} = require('./scene-controller');

const getSceneSystemModuleDefinition = () => {
    let dataModelService = null;
    let snapshotSerializer = null;
    let runtimeNodeHost = null;
    let runtimeNodeModel = null;
    let runtimeNodeTypeRegistration = null;
    let runtimeNodePersistenceController = null;
    let runtimeNodeCommandCapability = null;
    let runtimeNodeCommandExecutor = null;
    let scratchSpriteAdapter = null;
    let scratchSpriteLifecycleCommandBridge = null;
    let scratchRoleManagerParity = null;
    let scratchTransformProjection = null;
    let scratchTransformCommandBridge = null;
    let nativeTransformCommandBridge = null;
    let transformWriterRouter = null;
    let transformCommandCapability = null;
    let transformRuntimeStore = null;
    let transformRuntimeCapability = null;
    let sceneController = null;
    let sceneControllerCapability = null;
    let runtimeManager = null;
    let sceneManager = null;
    let persistenceReview = null;
    let functionalNodeCreation = null;
    let cameraRenderAdapter = null;
    let cameraRuntimeService = null;
    let cameraCommandCapability = null;
    let cameraCommandExecutor = null;
    let colliderRuntimeService = null;
    let colliderCommandCapability = null;
    let colliderCommandExecutor = null;
    let characterRuntimeService = null;
    let characterCommandCapability = null;
    let characterCommandExecutor = null;
    let tileSetResources = null;
    let tileMapRuntimeService = null;
    let tileMapCommandCapability = null;
    let tileMapCommandExecutor = null;
    let physicsRuntimeService = null;
    let physicsMaterialResources = null;
    let rigidBodyCommandCapability = null;
    let rigidBodyCommandExecutor = null;

    const disposeServices = () => {
        if (persistenceReview && typeof persistenceReview.dispose === 'function') persistenceReview.dispose();
        if (physicsRuntimeService && typeof physicsRuntimeService.dispose === 'function') physicsRuntimeService.dispose();
        if (tileMapRuntimeService && typeof tileMapRuntimeService.dispose === 'function') tileMapRuntimeService.dispose();
        if (characterRuntimeService && typeof characterRuntimeService.dispose === 'function') characterRuntimeService.dispose();
        if (colliderRuntimeService && typeof colliderRuntimeService.dispose === 'function') colliderRuntimeService.dispose();
        if (cameraRuntimeService && typeof cameraRuntimeService.dispose === 'function') cameraRuntimeService.dispose();
        if (cameraRenderAdapter && typeof cameraRenderAdapter.dispose === 'function') cameraRenderAdapter.dispose();
        if (sceneController) sceneController.dispose();
        if (transformWriterRouter) transformWriterRouter.dispose();
        if (nativeTransformCommandBridge) nativeTransformCommandBridge.dispose();
        if (scratchTransformCommandBridge) scratchTransformCommandBridge.dispose();
        if (scratchTransformProjection) scratchTransformProjection.dispose();
        if (transformRuntimeStore) transformRuntimeStore.dispose();
        if (scratchSpriteAdapter) scratchSpriteAdapter.dispose();
        if (runtimeManager) runtimeManager.dispose();
        if (snapshotSerializer) snapshotSerializer.dispose();
        if (runtimeNodeHost) runtimeNodeHost.dispose();
        if (dataModelService) dataModelService.dispose();
        functionalNodeCreation = null;
        cameraCommandCapability = null;
        cameraCommandExecutor = null;
        tileMapCommandCapability = null;
        tileMapCommandExecutor = null;
        tileMapRuntimeService = null;
        tileSetResources = null;
        rigidBodyCommandCapability = null;
        rigidBodyCommandExecutor = null;
        physicsRuntimeService = null;
        physicsMaterialResources = null;
        characterCommandCapability = null;
        characterCommandExecutor = null;
        characterRuntimeService = null;
        colliderCommandCapability = null;
        colliderCommandExecutor = null;
        colliderRuntimeService = null;
        cameraRuntimeService = null;
        cameraRenderAdapter = null;
        sceneManager = null;
        sceneControllerCapability = null;
        sceneController = null;
        persistenceReview = null;
        runtimeManager = null;
        snapshotSerializer = null;
        scratchSpriteAdapter = null;
        scratchSpriteLifecycleCommandBridge = null;
        scratchRoleManagerParity = null;
        scratchTransformCommandBridge = null;
        nativeTransformCommandBridge = null;
        transformWriterRouter = null;
        scratchTransformProjection = null;
        transformCommandCapability = null;
        transformRuntimeCapability = null;
        transformRuntimeStore = null;
        runtimeNodePersistenceController = null;
        runtimeNodeCommandCapability = null;
        runtimeNodeCommandExecutor = null;
        runtimeNodeTypeRegistration = null;
        runtimeNodeModel = null;
        runtimeNodeHost = null;
        dataModelService = null;
    };

    return {
        manifest: {
            apiVersion: '1',
            author: 'NGVGE Team',
            availability: MODULE_AVAILABILITY.EXPERIMENTAL,
            capabilities: [
                SCENE_CONTROLLER_CAPABILITY_ID,
                SCENE_DATA_MODEL_CAPABILITY_ID,
                RUNTIME_NODE_MODEL_CAPABILITY_ID,
                RUNTIME_NODE_COMMAND_CAPABILITY_ID,
                RUNTIME_NODE_SNAPSHOT_CAPABILITY_ID,
                RUNTIME_NODE_TYPE_REGISTRATION_CAPABILITY_ID,
                SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID,
                SCRATCH_ROLE_MANAGER_PARITY_CAPABILITY_ID,
                FUNCTIONAL_NODE_CREATION_CAPABILITY_ID,
                CAMERA2D_COMMAND_CAPABILITY_ID,
                CAMERA2D_RUNTIME_CAPABILITY_ID,
                COLLIDER2D_COMMAND_CAPABILITY_ID,
                COLLIDER2D_RUNTIME_CAPABILITY_ID,
                CHARACTER_CONTROLLER2D_COMMAND_CAPABILITY_ID,
                CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_ID,
                TILESET_RESOURCE_CAPABILITY_ID,
                TILEMAP_LAYER2D_COMMAND_CAPABILITY_ID,
                TILEMAP_LAYER2D_RUNTIME_CAPABILITY_ID,
                PHYSICS2D_RUNTIME_CAPABILITY_ID,
                PHYSICS_MATERIAL2D_RESOURCE_CAPABILITY_ID,
                RIGIDBODY2D_COMMAND_CAPABILITY_ID,
                TRANSFORM2D_COMMAND_CAPABILITY_ID,
                TRANSFORM2D_RUNTIME_CAPABILITY_ID,
                SCENE_MANAGER_CAPABILITY_ID,
                SCENE_PERSISTENCE_REVIEW_CAPABILITY_ID,
                SCENE_RUNTIME_CAPABILITY_ID,
                SCENE_SNAPSHOT_CAPABILITY_ID,
                'variables.scope-metadata'
            ],
            compatibility: {
                sb3: {
                    description: 'Only one selected scene can be flattened to a standard SB3 project.',
                    level: SB3_COMPATIBILITY_LEVELS.PARTIAL,
                    strategy: 'export-selected-scene'
                }
            },
            defaultEnabled: false,
            dependencies: [CORE_MODULE_ID],
            description: 'Scene V2 controller, portable project snapshots, runtime node ownership and editor integration.',
            id: SCENE_SYSTEM_MODULE_ID,
            kind: MODULE_KINDS.FIRST_PARTY,
            name: 'Scene System',
            permissions: [
                MODULE_PERMISSIONS.COMMANDS,
                MODULE_PERMISSIONS.EDITOR,
                MODULE_PERMISSIONS.NODES,
                MODULE_PERMISSIONS.RUNTIME,
                MODULE_PERMISSIONS.SERIALIZATION
            ],
            version: '0.8.9.7'
        },
        hooks: {
            completeEnable: context => {
                if (!dataModelService) {
                    const error = new Error('Scene System registration phase has not been initialized.');
                    error.code = 'RUNTIME_NODE_REGISTRATION_PHASE_UNAVAILABLE';
                    throw error;
                }
                if (dataModelService.getStatus().readOnly) return;
                if (!runtimeNodeHost) {
                    const error = new Error('Scene System Runtime Node registration phase is unavailable.');
                    error.code = 'RUNTIME_NODE_REGISTRATION_PHASE_UNAVAILABLE';
                    throw error;
                }
                if (snapshotSerializer) return;
                try {
                    runtimeNodeHost.restoreInitialState();
                    context.capabilities.provide(
                        RUNTIME_NODE_MODEL_CAPABILITY_ID,
                        runtimeNodeModel,
                        {version: runtimeNodeModel.apiVersion}
                    );
                    context.capabilities.provide(
                        RUNTIME_NODE_SNAPSHOT_CAPABILITY_ID,
                        runtimeNodeHost.snapshotCapability,
                        {version: runtimeNodeHost.snapshotCapability.version}
                    );

                    snapshotSerializer = createSceneSnapshotSerializer(context, dataModelService);
                    context.capabilities.provide(SCENE_SNAPSHOT_CAPABILITY_ID, snapshotSerializer, {version: '2'});

                    sceneController = createSceneController(context, dataModelService, snapshotSerializer);
                    sceneControllerCapability = createSceneControllerCapability(sceneController);
                    sceneManager = createSceneManagerAdapter(sceneController);
                    runtimeManager = createSceneRuntimeAdapter(sceneController);

                    context.capabilities.provide(
                        SCENE_CONTROLLER_CAPABILITY_ID,
                        sceneControllerCapability,
                        {version: '2'}
                    );
                    context.capabilities.provide(SCENE_RUNTIME_CAPABILITY_ID, runtimeManager, {version: '2'});

                    scratchSpriteAdapter = createScratchSpriteNodeAdapterService(
                        context,
                        dataModelService,
                        runtimeNodeModel,
                        {
                            nodeTypeRegistration: runtimeNodeTypeRegistration,
                            persistenceController: runtimeNodePersistenceController,
                            sceneRuntime: runtimeManager
                        }
                    );
                    context.capabilities.provide(
                        SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID,
                        scratchSpriteAdapter,
                        {version: '2'}
                    );

                    scratchRoleManagerParity = createScratchRoleManagerParityService({
                        vm: context.getService('vm'),
                        runtimeNodeModel,
                        scratchSpriteAdapter
                    });
                    context.capabilities.provide(
                        SCRATCH_ROLE_MANAGER_PARITY_CAPABILITY_ID,
                        scratchRoleManagerParity,
                        {version: scratchRoleManagerParity.version}
                    );

                    scratchSpriteLifecycleCommandBridge = createScratchSpriteLifecycleCommandBridge(
                        context,
                        dataModelService,
                        runtimeNodeModel,
                        scratchSpriteAdapter,
                        {roleManagerParity: scratchRoleManagerParity}
                    );
                    runtimeNodeCommandExecutor = createRuntimeNodeCommandExecutor(runtimeNodeModel, {
                        compatibilityLifecycleAuthority: scratchSpriteLifecycleCommandBridge
                    });
                    runtimeNodeCommandCapability = createRuntimeNodeCommandCapability(runtimeNodeCommandExecutor);
                    context.capabilities.provide(
                        RUNTIME_NODE_COMMAND_CAPABILITY_ID,
                        runtimeNodeCommandCapability,
                        {version: runtimeNodeCommandCapability.version}
                    );

                    transformRuntimeStore = createTransform2DRuntimeStoreForModel(
                        runtimeNodeModel,
                        runtimeNodeTypeRegistration
                    );
                    transformRuntimeCapability = createTransform2DRuntimeCapability(transformRuntimeStore);
                    context.capabilities.provide(
                        TRANSFORM2D_RUNTIME_CAPABILITY_ID,
                        transformRuntimeCapability,
                        {version: transformRuntimeCapability.version}
                    );

                    const vm = context.getService('vm');
                    colliderRuntimeService = createCollider2DRuntimeService({
                        runtimeNodeModel,
                        sceneRuntime: runtimeManager,
                        scratchRuntime: vm && vm.runtime,
                        transformRuntimeStore,
                        typeRegistration: runtimeNodeTypeRegistration
                    });
                    context.capabilities.provide(
                        COLLIDER2D_RUNTIME_CAPABILITY_ID,
                        colliderRuntimeService,
                        {version: colliderRuntimeService.version}
                    );
                    colliderCommandExecutor = createCollider2DCommandExecutor(runtimeNodeModel, colliderRuntimeService);
                    colliderCommandCapability = createCollider2DCommandCapability(colliderCommandExecutor);
                    context.capabilities.provide(
                        COLLIDER2D_COMMAND_CAPABILITY_ID,
                        colliderCommandCapability,
                        {version: colliderCommandCapability.version}
                    );

                    characterRuntimeService = createCharacterController2DRuntimeService({
                        colliderRuntimeService,
                        runtimeNodeModel,
                        sceneRuntime: runtimeManager,
                        scratchRuntime: vm && vm.runtime,
                        shapeQueryBackendLoader: loadRapier2DCompat,
                        transformRuntimeStore,
                        typeRegistration: runtimeNodeTypeRegistration
                    });
                    context.capabilities.provide(
                        CHARACTER_CONTROLLER2D_RUNTIME_CAPABILITY_ID,
                        characterRuntimeService,
                        {version: characterRuntimeService.version}
                    );
                    characterCommandExecutor = createCharacterController2DCommandExecutor(
                        runtimeNodeModel,
                        characterRuntimeService
                    );
                    characterCommandCapability = createCharacterController2DCommandCapability(characterCommandExecutor);
                    context.capabilities.provide(
                        CHARACTER_CONTROLLER2D_COMMAND_CAPABILITY_ID,
                        characterCommandCapability,
                        {version: characterCommandCapability.version}
                    );

                    tileSetResources = installTileSetResourceService(vm);
                    if (!tileSetResources) {
                        tileSetResources = createTileSetResourceService({runtime: {emitProjectChanged: () => {}}});
                    }
                    context.capabilities.provide(
                        TILESET_RESOURCE_CAPABILITY_ID,
                        tileSetResources,
                        {version: tileSetResources.version}
                    );
                    tileMapRuntimeService = createTileMapLayer2DRuntimeService({
                        colliderRuntimeService,
                        runtimeNodeModel,
                        sceneRuntime: runtimeManager,
                        tileSetResources,
                        transformRuntimeStore,
                        typeRegistration: runtimeNodeTypeRegistration
                    });
                    context.capabilities.provide(
                        TILEMAP_LAYER2D_RUNTIME_CAPABILITY_ID,
                        tileMapRuntimeService,
                        {version: tileMapRuntimeService.version}
                    );
                    tileMapCommandExecutor = createTileMapLayer2DCommandExecutor(runtimeNodeModel, tileMapRuntimeService);
                    tileMapCommandCapability = createTileMapLayer2DCommandCapability(tileMapCommandExecutor);
                    context.capabilities.provide(
                        TILEMAP_LAYER2D_COMMAND_CAPABILITY_ID,
                        tileMapCommandCapability,
                        {version: tileMapCommandCapability.version}
                    );

                    physicsMaterialResources = installPhysicsMaterial2DResourceService(vm);
                    if (!physicsMaterialResources) {
                        physicsMaterialResources = createPhysicsMaterial2DResourceService({runtime: {emitProjectChanged: () => {}}});
                    }
                    context.capabilities.provide(
                        PHYSICS_MATERIAL2D_RESOURCE_CAPABILITY_ID,
                        physicsMaterialResources,
                        {version: physicsMaterialResources.version}
                    );
                    let injectedPhysicsBackendAdapter = null;
                    try {
                        injectedPhysicsBackendAdapter = context.getService('physics2d-backend-adapter');
                    } catch { /* optional provider */ }
                    physicsRuntimeService = createPhysics2DRuntimeService({
                        backendAdapterLoader: injectedPhysicsBackendAdapter ? async () => injectedPhysicsBackendAdapter : null,
                        backendLoader: injectedPhysicsBackendAdapter ? null : (typeof window !== 'undefined' ? loadRapier2DCompat : null),
                        colliderRuntimeService,
                        physicsMaterialResources,
                        runtimeNodeModel,
                        sceneRuntime: runtimeManager,
                        scratchRuntime: vm && vm.runtime,
                        transformRuntimeStore,
                        typeRegistration: runtimeNodeTypeRegistration
                    });
                    context.capabilities.provide(
                        PHYSICS2D_RUNTIME_CAPABILITY_ID,
                        physicsRuntimeService,
                        {version: physicsRuntimeService.version}
                    );
                    rigidBodyCommandExecutor = createRigidBody2DCommandExecutor(runtimeNodeModel, physicsRuntimeService);
                    rigidBodyCommandCapability = createRigidBody2DCommandCapability(rigidBodyCommandExecutor);
                    context.capabilities.provide(
                        RIGIDBODY2D_COMMAND_CAPABILITY_ID,
                        rigidBodyCommandCapability,
                        {version: rigidBodyCommandCapability.version}
                    );
                    if (vm && vm.renderer && vm.renderer.exports && vm.renderer.exports.twgl && vm.renderer.exports.twgl.m4) {
                        cameraRenderAdapter = createScratchRenderCamera2DAdapter(vm.renderer);
                        cameraRuntimeService = createCamera2DRuntimeService({
                            renderAdapter: cameraRenderAdapter,
                            runtimeNodeModel,
                            sceneRuntime: runtimeManager,
                            scratchRuntime: vm.runtime,
                            transformRuntimeStore,
                            typeRegistration: runtimeNodeTypeRegistration
                        });
                        context.capabilities.provide(
                            CAMERA2D_RUNTIME_CAPABILITY_ID,
                            cameraRuntimeService,
                            {version: cameraRuntimeService.version}
                        );
                        cameraCommandExecutor = createCamera2DCommandExecutor(runtimeNodeModel, cameraRuntimeService);
                        cameraCommandCapability = createCamera2DCommandCapability(cameraCommandExecutor);
                        context.capabilities.provide(
                            CAMERA2D_COMMAND_CAPABILITY_ID,
                            cameraCommandCapability,
                            {version: cameraCommandCapability.version}
                        );
                    }

                    functionalNodeCreation = createFunctionalNodeCreationService({
                        camera2DAvailable: Boolean(cameraRuntimeService),
                        characterController2DAvailable: Boolean(characterRuntimeService),
                        collider2DAvailable: Boolean(colliderRuntimeService),
                        tileMapLayer2DAvailable: Boolean(tileMapRuntimeService),
                        tileSetResources,
                        physics2DRuntime: physicsRuntimeService,
                        runtimeNodeModel,
                        scratchSpriteAdapter
                    });
                    context.capabilities.provide(
                        FUNCTIONAL_NODE_CREATION_CAPABILITY_ID,
                        functionalNodeCreation,
                        {version: functionalNodeCreation.version}
                    );
                    scratchTransformProjection = createScratchTransformProjectionService(
                        context,
                        dataModelService,
                        runtimeNodeModel,
                        runtimeNodeTypeRegistration,
                        scratchSpriteAdapter,
                        {transformRuntimeStore}
                    );
                    scratchTransformProjection.start();

                    scratchTransformCommandBridge = createScratchTransformCommandBridge(
                        context,
                        dataModelService,
                        runtimeNodeModel,
                        scratchSpriteAdapter,
                        scratchTransformProjection
                    );
                    nativeTransformCommandBridge = createNativeTransformCommandBridge(
                        runtimeNodeModel,
                        transformRuntimeStore
                    );
                    transformWriterRouter = createTransform2DWriterRouter({
                        resolveRoute: createTransform2DSceneWriterRouteResolver(scratchSpriteAdapter),
                        writers: {
                            'ngvge.native.transform': nativeTransformCommandBridge,
                            'scratch.compat.transform': scratchTransformCommandBridge
                        }
                    });
                    transformCommandCapability = createTransform2DCommandCapability(transformWriterRouter);
                    context.capabilities.provide(
                        TRANSFORM2D_COMMAND_CAPABILITY_ID,
                        transformCommandCapability,
                        {version: transformCommandCapability.version}
                    );

                    context.capabilities.provide(SCENE_MANAGER_CAPABILITY_ID, sceneManager, {version: '2'});

                    persistenceReview = createScenePersistenceReviewService(
                        dataModelService,
                        runtimeNodeModel,
                        scratchSpriteAdapter
                    );
                    context.capabilities.provide(
                        SCENE_PERSISTENCE_REVIEW_CAPABILITY_ID,
                        persistenceReview,
                        {version: '1'}
                    );
                } catch (error) {
                    disposeServices();
                    throw error;
                }
            },
            disable: disposeServices,
            dispose: disposeServices,
            enable: context => {
                disposeServices();
                try {
                    dataModelService = createSceneDataModelService(context);
                    dataModelService.ensureProject();
                    context.capabilities.provide(SCENE_DATA_MODEL_CAPABILITY_ID, dataModelService, {version: '1'});
                    context.capabilities.provide('variables.scope-metadata', Object.freeze({
                        scopes: VARIABLE_SCOPES
                    }), {version: '1'});
                    if (dataModelService.getStatus().readOnly) return;

                    runtimeNodeHost = createRuntimeNodeModelHost(dataModelService, {deferInitialRestore: true});
                    runtimeNodeModel = runtimeNodeHost.publicCapability;
                    runtimeNodeTypeRegistration = runtimeNodeHost.typeRegistrationCapability;
                    runtimeNodePersistenceController = runtimeNodeHost.persistenceController;
                    context.capabilities.provide(
                        RUNTIME_NODE_TYPE_REGISTRATION_CAPABILITY_ID,
                        runtimeNodeTypeRegistration,
                        {version: runtimeNodeTypeRegistration.version}
                    );
                } catch (error) {
                    disposeServices();
                    throw error;
                }
            }
        }
    };
};

module.exports = {
    getSceneSystemModuleDefinition
};
