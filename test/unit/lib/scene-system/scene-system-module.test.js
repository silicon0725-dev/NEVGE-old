import {
    SB3_COMPATIBILITY_LEVELS,
    createModuleManager,
    registerBuiltInModules
} from '../../../../src/lib/first-party-modules';
import {
    RUNTIME_NODE_MODEL_CAPABILITY_ID,
    SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID,
    SCENE_DATA_MODEL_CAPABILITY_ID,
    SCENE_MANAGER_CAPABILITY_ID,
    SCENE_PERSISTENCE_REVIEW_CAPABILITY_ID,
    SCENE_RUNTIME_CAPABILITY_ID,
    SCENE_SNAPSHOT_CAPABILITY_ID,
    SCENE_SYSTEM_MODULE_ID
} from '../../../../src/lib/scene-system';
import {RUNTIME_NODE_COMMAND_CAPABILITY_ID} from '../../../../src/lib/runtime-nodes';
import {TRANSFORM2D_COMMAND_CAPABILITY_ID} from '../../../../src/lib/transform-system';
import {SCRATCH_ROLE_MANAGER_PARITY_CAPABILITY_ID} from '../../../../src/lib/scratch-sprite-adapter';

describe('NGVGE scene system data-model module', () => {
    const createEnabledManager = () => {
        const manager = createModuleManager();
        registerBuiltInModules(manager);
        manager.initializeAll();
        manager.enableDefaults({silent: true});
        manager.enableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});
        return manager;
    };

    test('is opt-in, initializes one scene and advertises partial SB3 compatibility when enabled', () => {
        const manager = createModuleManager();
        registerBuiltInModules(manager);
        manager.initializeAll();
        manager.enableDefaults({silent: true});

        expect(manager.getModuleState(SCENE_SYSTEM_MODULE_ID).enabled).toBe(false);
        manager.enableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});

        const service = manager.getCapability(SCENE_DATA_MODEL_CAPABILITY_ID);
        const serializer = manager.getCapability(SCENE_SNAPSHOT_CAPABILITY_ID);
        const runtimeNodeModel = manager.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID);
        const runtimeNodeCommand = manager.getCapability(RUNTIME_NODE_COMMAND_CAPABILITY_ID);
        const scratchSpriteAdapter = manager.getCapability(SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID);
        const scratchRoleManagerParity = manager.getCapability(SCRATCH_ROLE_MANAGER_PARITY_CAPABILITY_ID);
        const transformCommand = manager.getCapability(TRANSFORM2D_COMMAND_CAPABILITY_ID);
        const sceneManager = manager.getCapability(SCENE_MANAGER_CAPABILITY_ID);
        const persistenceReview = manager.getCapability(SCENE_PERSISTENCE_REVIEW_CAPABILITY_ID);
        const runtime = manager.getCapability(SCENE_RUNTIME_CAPABILITY_ID);
        const project = service.readProject();
        expect(manager.getCapability('variables.scope-metadata').scopes.SCENE).toBe('scene');
        expect(serializer).not.toBeNull();
        expect(runtimeNodeModel).not.toBeNull();
        expect(runtimeNodeCommand).toMatchObject({
            capabilityId: RUNTIME_NODE_COMMAND_CAPABILITY_ID,
            version: 1
        });
        expect(scratchSpriteAdapter).not.toBeNull();
        expect(scratchRoleManagerParity).toMatchObject({
            capabilityId: SCRATCH_ROLE_MANAGER_PARITY_CAPABILITY_ID,
            version: 1
        });
        expect(transformCommand).not.toBeNull();
        expect(transformCommand).toMatchObject({
            capabilityId: TRANSFORM2D_COMMAND_CAPABILITY_ID,
            version: 1
        });
        expect(sceneManager).not.toBeNull();
        expect(persistenceReview).not.toBeNull();
        expect(persistenceReview.audit()).toMatchObject({valid: true});
        expect(runtime).not.toBeNull();
        expect(serializer.getStatus()).toEqual({
            busy: false,
            error: null,
            lastRollback: null,
            operation: null
        });
        expect(project.scenes).toHaveLength(1);
        expect(project.activeSceneId).toBe(project.scenes[0].id);
        expect(manager.getSB3CompatibilityReport().overall).toBe(SB3_COMPATIBILITY_LEVELS.PARTIAL);
    });

    test('persists scene data and revokes the capability on disable', () => {
        const first = createModuleManager();
        registerBuiltInModules(first);
        first.initializeAll();
        first.enableDefaults({silent: true});
        first.enableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});

        const firstService = first.getCapability(SCENE_DATA_MODEL_CAPABILITY_ID);
        const project = firstService.readProject();
        project.extensionData.test = 'persisted';
        firstService.writeProject(project);
        const snapshot = first.serializeProject();

        const second = createModuleManager();
        registerBuiltInModules(second);
        second.initializeAll();
        second.enableDefaults({silent: true});
        second.deserializeProject(snapshot);

        const secondService = second.getCapability(SCENE_DATA_MODEL_CAPABILITY_ID);
        expect(secondService.readProject().extensionData.test).toBe('persisted');
        second.disableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});
        expect(second.getCapability(SCENE_DATA_MODEL_CAPABILITY_ID)).toBeNull();
        expect(second.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID)).toBeNull();
        expect(second.getCapability(RUNTIME_NODE_COMMAND_CAPABILITY_ID)).toBeNull();
        expect(second.getCapability(SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID)).toBeNull();
        expect(second.getCapability(SCRATCH_ROLE_MANAGER_PARITY_CAPABILITY_ID)).toBeNull();
        expect(second.getCapability(TRANSFORM2D_COMMAND_CAPABILITY_ID)).toBeNull();
        expect(second.getCapability(SCENE_SNAPSHOT_CAPABILITY_ID)).toBeNull();
        expect(second.getCapability(SCENE_MANAGER_CAPABILITY_ID)).toBeNull();
        expect(second.getCapability(SCENE_PERSISTENCE_REVIEW_CAPABILITY_ID)).toBeNull();
        expect(second.getCapability(SCENE_RUNTIME_CAPABILITY_ID)).toBeNull();
    });

    test('preserves future scene data in read-only mode', () => {
        const manager = createModuleManager();
        registerBuiltInModules(manager);
        manager.initializeAll();
        manager.enableDefaults({silent: true});
        manager.setModuleData(SCENE_SYSTEM_MODULE_ID, {
            schemaVersion: 99,
            futureField: true
        }, {silent: true});

        manager.enableModule(SCENE_SYSTEM_MODULE_ID, {silent: true});
        const service = manager.getCapability(SCENE_DATA_MODEL_CAPABILITY_ID);
        expect(service.getStatus()).toMatchObject({readOnly: true, schemaVersion: 99});
        expect(service.readRawProject()).toEqual({schemaVersion: 99, futureField: true});
        expect(() => service.writeProject({})).toThrow(/read-only/i);
    });

    test('rejects non-persistent scene data without changing the stored project', () => {
        const manager = createEnabledManager();
        const service = manager.getCapability(SCENE_DATA_MODEL_CAPABILITY_ID);
        const before = service.readProject();
        const invalid = service.readProject();
        invalid.extensionData.invalidCallback = () => true;

        let thrown = null;
        try {
            service.writeProject(invalid);
        } catch (error) {
            thrown = error;
        }

        expect(thrown).toMatchObject({code: 'SCENE_PERSISTENT_DATA_INVALID'});
        expect(service.readProject()).toEqual(before);
    });

});
