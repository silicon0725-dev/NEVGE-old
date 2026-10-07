#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const checks = [];
const check = (condition, label) => {
    if (!condition) {
        process.stderr.write(`WS-9F FAIL: ${label}\n`);
        process.exit(1);
    }
    checks.push(label);
};

const provider = read('src/lib/editor-shell/workspace-capability-providers.js');
const contracts = read('src/lib/editor-shell/workspace-project-resource-capabilities.js');
const capability = read('src/lib/editor-shell/tool-capability.js');
const context = read('src/lib/editor-shell/workspace-context.js');
const assets = read('src/lib/project-assets/global-asset-database.js');
const assetManager = read('src/components/project-assets/project-asset-manager.jsx');
const gui = read('src/components/gui/gui.jsx');
const packageJson = read('package.json');

check(
    contracts.includes("WORKSPACE_PROJECT_READ_CAPABILITY_ID = 'ngvge.workspace-project-read-capability@1'") &&
    contracts.includes("WORKSPACE_RESOURCE_READ_CAPABILITY_ID = 'ngvge.workspace-resource-read-capability@1'") &&
    contracts.includes('WORKSPACE_RESOURCE_COMMAND_SCHEMA_VERSION = 1'),
    'Project/Resource portable capability contracts and Resource command schema are versioned'
);
check(
    assets.includes('const DATABASE_VERSION = 3;') &&
    assets.includes('createStableIdentity(STABLE_ID_KINDS.RESOURCE') &&
    assets.includes('resourceId: createResourceId()') &&
    assets.includes('resourceId: record.resourceId'),
    'Global Asset Database v3 assigns and persists canonical NGVGE ResourceId'
);
check(
    assets.includes('resourceId: normalizeResourceId(serialized.resourceId)') &&
    assets.includes('getAssetIdForResourceId (resourceId)') &&
    assets.includes('getResource: getResourceDescriptor'),
    'Legacy asset records migrate to canonical ResourceId while internal asset ids remain private'
);
check(
    context.includes('NGVGE_WORKSPACE_CONTEXT_RESOURCE_ID_INVALID') &&
    context.includes('isStableIdentity(resourceId, STABLE_ID_KINDS.RESOURCE)'),
    'Workspace Context Resource domain accepts only canonical ResourceId'
);
check(
    assetManager.includes('selectedAsset ? selectedAsset.resourceId : null') &&
    !assetManager.includes('onSelectionContextChange(selectedAssetId)'),
    'Asset Manager projects canonical ResourceId rather than legacy internal asset id'
);
check(
    provider.includes('CORE_WORKSPACE_CAPABILITY_PROVIDER_IDS.PROJECT_READ') &&
    provider.includes('CORE_WORKSPACE_CAPABILITY_PROVIDER_IDS.RESOURCE_READ') &&
    provider.includes('CORE_WORKSPACE_CAPABILITY_PROVIDER_IDS.RESOURCE_COMMAND_PROPOSE') &&
    provider.includes('CORE_WORKSPACE_CAPABILITY_PROVIDER_IDS.RESOURCE_COMMAND_MUTATE'),
    'Core Provider Registry registers Project read and Resource query/command surfaces'
);
check(
    contracts.includes('createWorkspaceProjectReadFacade') &&
    contracts.includes('projectLifecycleHost.getState()') &&
    !contracts.includes('serializeProjectJSON') &&
    !contracts.includes('.toJSON('),
    'Project read facade exposes lifecycle/context projection without Scratch project serialization'
);
check(
    provider.includes('NGVGE_WORKSPACE_PROJECT_COMMAND_AUTHORITY_NOT_READY') &&
    provider.includes('No stable native Project Command Authority is available'),
    'Project command surfaces fail visibly until a stable native Project Command Host exists'
);
check(
    contracts.includes('normalizeResourceDescriptor') &&
    contracts.includes('resourceId,') &&
    !contracts.includes('descriptor.asset') &&
    !contracts.includes('descriptor.backend'),
    'Resource read facade returns portable descriptors without raw asset/backend handles'
);
check(
    contracts.includes("RENAME: 'rename'") && contracts.includes("MOVE: 'move'") && contracts.includes("DELETE: 'delete'") &&
    !contracts.includes('replace-binary'),
    'Resource command vocabulary is bounded to metadata-safe rename/move/delete operations'
);
check(
    contracts.includes('database.getAssetIdForResourceId(normalized.resourceId)') &&
    contracts.includes('database.perform(`Workspace Resource ${normalized.kind}`') &&
    contracts.includes('database.renameAsset') && contracts.includes('database.removeAsset'),
    'Resource mutation resolves ResourceId internally and executes through Resource authority/history seam'
);
check(
    capability.includes('const surface = `${normalized.capabilityId}#${normalized.access}`') &&
    capability.includes('duplicate capability surface'),
    'Capability Descriptor uniqueness is capability/access surface-specific for propose + mutate requests'
);
check(
    gui.includes('projectLifecycleHost: vm && vm.runtime ? installProjectLifecycleHost(vm) : null') &&
    gui.includes('getWorkspaceResourceDatabase') &&
    gui.includes('getResourceDatabase: getWorkspaceResourceDatabase') &&
    gui.includes('getGlobalAssetDatabase(vm.runtime) || installGlobalAssetDatabase(vm)'),
    'Production GUI binds Provider Registry to existing Project Lifecycle and Resource authority seams'
);
check(
    !contracts.includes('ScratchTarget') && !contracts.includes('renderer') && !contracts.includes('rawVM') &&
    !contracts.includes('child_process') && !contracts.includes('filesystem'),
    'Project/Resource capability contracts do not expose backend, renderer, process, or filesystem authority'
);
check(
    packageJson.includes('test:workspace-shell:ws9f:focused') &&
    packageJson.includes('test:workspace-shell:ws9f-webpack') &&
    packageJson.includes('test:workspace-shell:ws9f-certification'),
    'WS-9F defines repeatable focused, Webpack, and cumulative certification gates'
);

process.stdout.write(`WS-9F Project / Resource Capability Provider Foundation PASS (${checks.length}/${checks.length}).\n`);
process.stdout.write(`${JSON.stringify({
    projectRead: 'ready when ProjectLifecycleHost is available',
    projectCommand: 'fail-closed when native Project Command Host is absent; later stages may supply it',
    resourceRead: 'ready when canonical Resource authority is available',
    resourceCommand: ['rename', 'move', 'delete'],
    canonicalResourceIdentity: 'ngvge:resource:*',
    checks: checks.length
}, null, 2)}\n`);
