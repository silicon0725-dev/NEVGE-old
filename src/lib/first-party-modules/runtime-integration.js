import {installCamera2DScratchBlocks} from '../camera-system';
import {installCharacterController2DScratchBlocks} from '../character-controller-system';
import {installCollider2DScratchBlocks} from '../collision-system';
import {extensionRegistry, sourceRegistry} from '../extension-hub';
import {getEditorCommandManager} from '../editor-commands/editor-command-manager';
import {getGlobalAssetDatabase} from '../project-assets/global-asset-database';
import {getInspectorRegistry} from '../project-inspector/inspector-registry';
import {getNodeTypeRegistry} from '../project-nodes/node-type-registry';
import {installProjectLifecycleHost} from '../project-lifecycle';
import {registerNgvgeModuleDefinitions} from '../extension-containment';
import {createVMProjectIOService} from './vm-project-io-service';
import {
    MODULE_FRAMEWORK_VERSION,
    MODULE_PERMISSIONS,
    createModuleManager,
    getBuiltInModuleDefinitions,
    registerBuiltInModules
} from './index';

const FRAMEWORK_PROPERTY = 'ngvgeFirstPartyModules';
const PERSISTENCE_SECTION_ID = 'ngvge-first-party-modules';
const LIFECYCLE_HOOK_ID = 'ngvge.project-lifecycle.first-party-modules@1';
const managersByRuntime = new WeakMap();

const createServices = vm => ({
    assets: {
        permission: MODULE_PERMISSIONS.ASSETS,
        value: getGlobalAssetDatabase(vm.runtime)
    },
    commands: {
        permission: MODULE_PERMISSIONS.COMMANDS,
        value: getEditorCommandManager(vm.runtime)
    },
    extensions: {
        permission: MODULE_PERMISSIONS.EXTENSIONS,
        value: {extensionRegistry, sourceRegistry}
    },
    inspector: {
        permission: MODULE_PERMISSIONS.INSPECTOR,
        value: getInspectorRegistry(vm.runtime)
    },
    nodes: {
        permission: MODULE_PERMISSIONS.NODES,
        value: getNodeTypeRegistry(vm.runtime)
    },
    runtime: {
        permission: MODULE_PERMISSIONS.RUNTIME,
        value: vm.runtime
    },
    vm: {
        permission: MODULE_PERMISSIONS.RUNTIME,
        value: vm
    },
    'vm-project-io': {
        permission: MODULE_PERMISSIONS.RUNTIME,
        value: createVMProjectIOService(vm)
    }
});

const installFirstPartyModuleFramework = vm => {
    if (!vm || !vm.runtime) return null;
    const runtime = vm.runtime;
    installCamera2DScratchBlocks(vm);
    installCharacterController2DScratchBlocks(vm);
    installCollider2DScratchBlocks(vm);
    const current = managersByRuntime.get(runtime);
    if (current && current.version === MODULE_FRAMEWORK_VERSION) return current.client;

    // Module definitions are resolved before Host construction so the supported
    // loader path never passes Host Manager authority into module factories.
    const builtInDefinitions = getBuiltInModuleDefinitions();
    registerNgvgeModuleDefinitions(vm, builtInDefinitions);
    const manager = createModuleManager({
        onProjectChanged: () => {
            if (runtime && typeof runtime.emitProjectChanged === 'function') runtime.emitProjectChanged();
        },
        services: createServices(vm)
    });

    registerBuiltInModules(manager, builtInDefinitions);
    manager.initializeAll();
    manager.enableDefaults({silent: true});
    managersByRuntime.set(runtime, manager);
    Object.defineProperty(runtime, FRAMEWORK_PROPERTY, {
        configurable: false,
        enumerable: false,
        value: manager.client,
        writable: false
    });

    const inspectorRegistry = getInspectorRegistry(runtime);
    inspectorRegistry.register({
        hidden: true,
        id: PERSISTENCE_SECTION_ID,
        label: 'NGVGE First-party Modules',
        order: -950,
        deserializeProject: data => manager.deserializeProject(data),
        getFields: () => [],
        serializeProject: () => manager.serializeProject(),
        setValue: () => {}
    });

    const lifecycle = installProjectLifecycleHost(vm);
    if (lifecycle) {
        lifecycle.registerHook({
            id: LIFECYCLE_HOOK_ID,
            priority: -600,
            beforeLoad: () => manager.resetProject({silent: true})
        });
    }


    return manager.client;
};

const getFirstPartyModuleClient = runtime => {
    const manager = runtime ? managersByRuntime.get(runtime) || null : null;
    return manager ? manager.client : null;
};

// Compatibility alias: runtime consumers receive the Client facade, never Host authority.
const getFirstPartyModuleManager = getFirstPartyModuleClient;

export {
    FRAMEWORK_PROPERTY,
    PERSISTENCE_SECTION_ID,
    getFirstPartyModuleClient,
    getFirstPartyModuleManager,
    installFirstPartyModuleFramework
};
