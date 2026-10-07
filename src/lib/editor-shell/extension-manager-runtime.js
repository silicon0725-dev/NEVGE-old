import {
    installExtensionContainmentHost,
    installScratchExtensionHost
} from '../extension-containment';
import {getFirstPartyModuleClient} from '../first-party-modules/runtime-integration';
import {createExtensionManagerDiscoveryProvider} from './extension-manager-discovery';
import {createLegacyAddonManagerAdapter} from './legacy-addon-manager-adapter';
import {WorkspaceExtensionManagerModel} from './extension-manager-model';

const WORKSPACE_EXTENSION_MANAGER_RUNTIME_ID = 'ngvge.workspace-extension-manager-runtime@1';

const createWorkspaceExtensionManagerModelForVM = (vm, options = {}) => {
    if (!vm || !vm.runtime) throw new TypeError('Workspace Extension Manager requires a VM runtime.');
    const scratchExtensionHost = options.scratchExtensionHost || installScratchExtensionHost(vm);
    const containmentClient = options.containmentClient || installExtensionContainmentHost(vm);
    const moduleClient = typeof options.moduleClient === 'undefined' ?
        getFirstPartyModuleClient(vm.runtime) : options.moduleClient;
    const discoveryProvider = options.discoveryProvider || createExtensionManagerDiscoveryProvider();
    const legacyAddonAdapter = options.legacyAddonAdapter || createLegacyAddonManagerAdapter(vm);
    return new WorkspaceExtensionManagerModel({
        containmentClient,
        discoveryProvider,
        legacyAddonAdapter,
        moduleClient,
        scratchExtensionHost
    });
};

export {
    WORKSPACE_EXTENSION_MANAGER_RUNTIME_ID,
    createWorkspaceExtensionManagerModelForVM
};
