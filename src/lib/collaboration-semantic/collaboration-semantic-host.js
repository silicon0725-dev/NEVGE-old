/* eslint-disable import/no-commonjs, strict */
'use strict';

const {TRANSFORM2D_TYPE_ID} = require('../../core/transform2d');
const {
    RUNTIME_NODE_COMMAND_CAPABILITY_ID,
    createRuntimeNodeEditorClient
} = require('../runtime-nodes');
const {
    TRANSFORM2D_COMMAND_CAPABILITY_ID,
    createTransform2DEditorClient
} = require('../transform-system');
const {
    RUNTIME_NODE_MODEL_CAPABILITY_ID,
    SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID
} = require('../scene-system/constants');
const {installScratchExtensionHost} = require('../extension-containment');
const {
    COLLABORATION_SEMANTIC_DOMAIN_ID,
    createCollaborationSemanticAuthorityRegistry
} = require('./collaboration-semantic-authority');
const {
    COLLABORATION_OPERATION_TYPES,
    COLLABORATION_SEMANTIC_CLIENT_ID,
    COLLABORATION_SEMANTIC_HOST_ID,
    COLLABORATION_SEMANTIC_RUNTIME_PROPERTY,
    COLLABORATION_SEMANTIC_VERSION
} = require('./constants');
const {assertCollaborationOperation, createCollaborationOperation} = require('./collaboration-operation');

const controllersByVM = new WeakMap();
const cloneRecord = record => Object.freeze(Object.assign({}, record));
const getModuleClient = vm => vm && vm.runtime && vm.runtime.ngvgeFirstPartyModules;
const getCapability = (vm, capabilityId) => {
    const client = getModuleClient(vm);
    if (!client || typeof client.getCapability !== 'function') return null;
    try {
        return client.getCapability(capabilityId) || null;
    } catch {
        return null;
    }
};

const createCollaborationSemanticHost = vm => {
    if (!vm || typeof vm !== 'object') throw new TypeError('Collaboration Semantic Host requires a VM object.');
    const authorityRegistry = createCollaborationSemanticAuthorityRegistry();
    const diagnostics = [];
    let revision = 0;

    const recordDiagnostic = diagnostic => {
        const entry = Object.freeze({
            code: diagnostic.code,
            detail: diagnostic.detail || '',
            severity: diagnostic.severity || 'warning',
            timestamp: Date.now()
        });
        diagnostics.push(entry);
        if (diagnostics.length > 200) diagnostics.shift();
        revision += 1;
        return entry;
    };

    const getScratchAdapter = () => getCapability(vm, SCRATCH_SPRITE_ADAPTER_CAPABILITY_ID);
    const getRuntimeNodeModel = () => getCapability(vm, RUNTIME_NODE_MODEL_CAPABILITY_ID);
    const getRuntimeNodeCommand = () => getCapability(vm, RUNTIME_NODE_COMMAND_CAPABILITY_ID);
    const getTransformCommand = () => getCapability(vm, TRANSFORM2D_COMMAND_CAPABILITY_ID);

    const getNodeIdForTargetRuntimeId = targetRuntimeId => {
        const adapter = getScratchAdapter();
        if (!adapter || typeof adapter.getBindingByTargetRuntimeId !== 'function') return null;
        const binding = adapter.getBindingByTargetRuntimeId(String(targetRuntimeId));
        return binding && typeof binding.nodeId === 'string' ? binding.nodeId : null;
    };

    const resolveTargetByNodeId = nodeId => {
        const adapter = getScratchAdapter();
        if (!adapter || typeof adapter.getBindingByNodeId !== 'function') return null;
        const binding = adapter.getBindingByNodeId(String(nodeId));
        if (!binding || typeof binding.targetRuntimeId !== 'string') return null;
        const target = vm.runtime && typeof vm.runtime.getTargetById === 'function' ?
            vm.runtime.getTargetById(binding.targetRuntimeId) : null;
        return target || null;
    };

    const executeOperation = operationInput => {
        const operation = assertCollaborationOperation(operationInput);
        const payload = operation.payload;
        let result;
        if (operation.type === COLLABORATION_OPERATION_TYPES.NODE_DESTROY ||
            operation.type === COLLABORATION_OPERATION_TYPES.NODE_RENAME) {
            const capability = getRuntimeNodeCommand();
            if (!capability) {
                const error = new Error('Runtime Node Command capability is unavailable for collaboration mutation.');
                error.code = 'NGVGE_COLLABORATION_RUNTIME_NODE_COMMAND_UNAVAILABLE';
                throw error;
            }
            const client = createRuntimeNodeEditorClient(capability);
            result = operation.type === COLLABORATION_OPERATION_TYPES.NODE_DESTROY ?
                client.destroyNode({nodeId: payload.nodeId}) :
                client.patchNode({nodeId: payload.nodeId, patch: {name: payload.name}});
        } else if (operation.type === COLLABORATION_OPERATION_TYPES.NODE_TRANSFORM_PATCH) {
            const transformCapability = getTransformCommand();
            const model = getRuntimeNodeModel();
            if (!transformCapability || !model || typeof model.getNodeSnapshot !== 'function') {
                const error = new Error('Transform semantic capabilities are unavailable for collaboration mutation.');
                error.code = 'NGVGE_COLLABORATION_TRANSFORM_CAPABILITY_UNAVAILABLE';
                throw error;
            }
            const node = model.getNodeSnapshot(payload.nodeId);
            const components = node && Array.isArray(node.components) ? node.components : [];
            const component = components.find(item => item && item.typeId === TRANSFORM2D_TYPE_ID) || null;
            if (!component) {
                const error = new Error(`Node ${payload.nodeId} has no Transform2D component.`);
                error.code = 'NGVGE_COLLABORATION_TRANSFORM_COMPONENT_UNAVAILABLE';
                throw error;
            }
            result = createTransform2DEditorClient(transformCapability).patchComponent({
                componentId: component.id,
                nodeId: payload.nodeId,
                patch: payload.patch
            });
        } else if (operation.type === COLLABORATION_OPERATION_TYPES.EXTENSION_LOAD ||
            operation.type === COLLABORATION_OPERATION_TYPES.EXTENSION_UNLOAD ||
            operation.type === COLLABORATION_OPERATION_TYPES.EXTENSION_REORDER) {
            const extensionHost = installScratchExtensionHost(vm);
            if (operation.type === COLLABORATION_OPERATION_TYPES.EXTENSION_UNLOAD) {
                result = extensionHost.unloadExtension(payload.extensionId);
            } else if (operation.type === COLLABORATION_OPERATION_TYPES.EXTENSION_REORDER) {
                result = extensionHost.reorderExtension(payload.extensionId, payload.index);
            } else if (payload.url) {
                result = extensionHost.loadExtensionURL(payload.url, {
                    extensionId: payload.extensionId,
                    sourceKind: 'collaboration-remote-url'
                });
            } else {
                result = extensionHost.loadBuiltInExtension(payload.extensionId, {
                    sourceKind: 'collaboration-remote-id'
                });
            }
        }
        revision += 1;
        return Promise.resolve(result);
    };

    const getStatus = () => Object.freeze({
        authority: authorityRegistry.getWriter(COLLABORATION_SEMANTIC_DOMAIN_ID),
        clientId: COLLABORATION_SEMANTIC_CLIENT_ID,
        hostId: COLLABORATION_SEMANTIC_HOST_ID,
        nodeIdentityAvailable: Boolean(getScratchAdapter()),
        revision,
        version: COLLABORATION_SEMANTIC_VERSION
    });

    const client = Object.freeze({
        clientId: COLLABORATION_SEMANTIC_CLIENT_ID,
        getStatus,
        listDiagnostics: () => Object.freeze(diagnostics.map(cloneRecord)),
        version: COLLABORATION_SEMANTIC_VERSION
    });

    return Object.freeze({
        client,
        createOperation: createCollaborationOperation,
        executeOperation,
        getAuthority: () => authorityRegistry.getWriter(COLLABORATION_SEMANTIC_DOMAIN_ID),
        getNodeIdForTargetRuntimeId,
        getStatus,
        listDiagnostics: client.listDiagnostics,
        recordDiagnostic,
        resolveTargetByNodeId
    });
};

const installCollaborationSemanticHost = vm => {
    let controller = controllersByVM.get(vm);
    if (!controller) {
        controller = createCollaborationSemanticHost(vm);
        controllersByVM.set(vm, controller);
        if (vm.runtime && !Object.prototype.hasOwnProperty.call(vm.runtime, COLLABORATION_SEMANTIC_RUNTIME_PROPERTY)) {
            Object.defineProperty(vm.runtime, COLLABORATION_SEMANTIC_RUNTIME_PROPERTY, {
                configurable: false,
                enumerable: false,
                value: controller.client,
                writable: false
            });
        }
    }
    return controller.client;
};

const getCollaborationSemanticController = vm => {
    installCollaborationSemanticHost(vm);
    return controllersByVM.get(vm);
};

module.exports = {
    createCollaborationSemanticHost,
    getCollaborationSemanticController,
    installCollaborationSemanticHost
};
