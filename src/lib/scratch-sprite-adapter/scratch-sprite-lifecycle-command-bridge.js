'use strict';

const {assertRuntimeNodeMutationResult} = require('../runtime-nodes/runtime-node-model-service');
const {SPRITE_NODE_TYPE_ID} = require('./constants');

const SPRITE_LIFECYCLE_STATE_DOMAIN = 'SpriteLifecycle';
const SCRATCH_SPRITE_LIFECYCLE_AUTHORITY_ID = 'scratch.compat.sprite-lifecycle';
const SCRATCH_SPRITE_LIFECYCLE_COMMAND_BRIDGE_ID = 'scratch.compat.sprite-lifecycle-command-bridge';
const SCRATCH_SPRITE_LIFECYCLE_COMMAND_BRIDGE_VERSION = 1;

const normalizeString = value => (
    typeof value === 'string' && value.trim() ? value.trim() : null
);

const createLifecycleError = (code, message, details = {}) => Object.assign(new Error(message), {code, ...details});

const getContextVM = context => {
    if (!context) return null;
    if (typeof context.getService === 'function') return context.getService('vm');
    return context.vm || null;
};

const readScratchRuntimeTargets = vm => {
    if (!vm || !vm.runtime) return [];
    const targets = vm.runtime.targets;
    if (!targets || typeof targets !== 'object') return [];
    if (Array.isArray(targets)) return targets.slice();
    let length;
    try {
        length = targets.length;
    } catch {
        return [];
    }
    if (!Number.isSafeInteger(length) || length < 0) return [];
    const copied = [];
    for (let index = 0; index < length; index++) {
        try {
            copied.push(targets[index]);
        } catch {
            return [];
        }
    }
    return copied;
};

const getOriginalSpriteTargets = vm => readScratchRuntimeTargets(vm).filter(target => (
    target && !target.isStage && target.isOriginal !== false
));

const getTargetId = target => normalizeString(target && target.id);

// Scratch VM's single-sprite parser injects a default blank costume when `costumes` is
// empty, but a JSON-only addSprite() call has no accompanying ZIP asset bytes. That leaves
// `costume.asset` undefined and makes Scratch's own duplicateSprite() fail later when it
// reloads costume assets. Keep creation portable across the module boundary while carrying
// the canonical blank SVG bytes inline so Scratch Storage can materialize a real Asset in
// browser/runtime environments that provide storage + renderer.
const BLANK_SPRITE_COSTUME_ASSET_ID = 'cd21514d0531fdffb22204e0ec5ed84a';
const BLANK_SPRITE_COSTUME_FILE_NAME = `${BLANK_SPRITE_COSTUME_ASSET_ID}.svg`;
const BLANK_SPRITE_COSTUME_SVG = [
    '<svg version="1.1" width="2" height="2" viewBox="-1 -1 2 2"',
    ' xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">',
    '\n  <!-- Exported by Scratch - http://scratch.mit.edu/ -->\n</svg>'
].join('');
const BLANK_SPRITE_COSTUME_BYTES = Object.freeze(
    Array.from(BLANK_SPRITE_COSTUME_SVG, character => character.charCodeAt(0))
);
const BLANK_SPRITE_ASSET_TYPE = Object.freeze({
    contentType: 'image/svg+xml',
    immutable: true,
    name: 'ImageVector',
    runtimeFormat: 'svg'
});

const createBlankSpriteDescriptor = name => ({
    isStage: false,
    name: normalizeString(name) || 'Sprite',
    variables: {},
    lists: {},
    broadcasts: {},
    blocks: {},
    comments: {},
    currentCostume: 0,
    costumes: [{
        asset: {
            assetType: BLANK_SPRITE_ASSET_TYPE,
            data: BLANK_SPRITE_COSTUME_BYTES,
            dataFormat: 'svg'
        },
        assetId: BLANK_SPRITE_COSTUME_ASSET_ID,
        bitmapResolution: 1,
        dataFormat: 'svg',
        md5ext: BLANK_SPRITE_COSTUME_FILE_NAME,
        name: 'costume1',
        rotationCenterX: 0,
        rotationCenterY: 0
    }],
    sounds: [],
    volume: 100,
    visible: true,
    x: 0,
    y: 0,
    size: 100,
    direction: 90,
    draggable: false,
    rotationStyle: 'all around'
});

const assertRuntimeNodeModel = runtimeNodeModel => {
    const required = ['getChildren', 'getNodeSnapshot', 'getParent', 'setParent'];
    if (!runtimeNodeModel || required.some(method => typeof runtimeNodeModel[method] !== 'function')) {
        throw new TypeError('Scratch Sprite lifecycle command bridge requires the Runtime Node Model capability.');
    }
    return runtimeNodeModel;
};

const assertAdapter = adapter => {
    const required = [
        'destroyBindingByNodeId',
        'getBindingByNodeId',
        'getBindingByTargetRuntimeId',
        'reconcileActiveScene'
    ];
    if (!adapter || required.some(method => typeof adapter[method] !== 'function')) {
        throw new TypeError('Scratch Sprite lifecycle command bridge requires the Scratch Sprite Adapter capability.');
    }
    return adapter;
};

const assertSceneDataModel = sceneDataModel => {
    if (!sceneDataModel || typeof sceneDataModel.readProject !== 'function') {
        throw new TypeError('Scratch Sprite lifecycle command bridge requires the Scene Data Model capability.');
    }
    return sceneDataModel;
};

const createScratchSpriteLifecycleCommandBridge = (
    context,
    sceneDataModel,
    runtimeNodeModel,
    scratchSpriteAdapter,
    options = {}
) => {
    const model = assertRuntimeNodeModel(runtimeNodeModel);
    const adapter = assertAdapter(scratchSpriteAdapter);
    const scenes = assertSceneDataModel(sceneDataModel);
    const roleManagerParity = options.roleManagerParity || null;
    const getVM = () => getContextVM(context);

    let commandCount = 0;
    let failureCount = 0;
    let lastError = null;

    const getActiveSceneId = () => {
        const project = scenes.readProject();
        return normalizeString(project && project.activeSceneId);
    };

    const assertActiveScene = requestedSceneId => {
        const activeSceneId = getActiveSceneId();
        if (!activeSceneId) {
            throw createLifecycleError(
                'NGVGE_SPRITE_LIFECYCLE_ACTIVE_SCENE_REQUIRED',
                'Scratch Sprite lifecycle authority requires an active scene.'
            );
        }
        const normalizedRequestedSceneId = normalizeString(requestedSceneId);
        if (normalizedRequestedSceneId && normalizedRequestedSceneId !== activeSceneId) {
            throw createLifecycleError(
                'NGVGE_SPRITE_LIFECYCLE_INACTIVE_SCENE_UNSUPPORTED',
                'Scratch Sprite lifecycle authority can only mutate the active compatibility scene.',
                {activeSceneId, requestedSceneId: normalizedRequestedSceneId}
            );
        }
        return activeSceneId;
    };

    const getBinding = nodeId => adapter.getBindingByNodeId(nodeId) || null;

    const syncRoleManagerOrder = sceneId => {
        if (!roleManagerParity || typeof roleManagerParity.syncTargetOrderFromSceneTree !== 'function') return null;
        return roleManagerParity.syncTargetOrderFromSceneTree(sceneId);
    };

    const resolveTargetForBinding = binding => {
        if (!binding) return null;
        const targetRuntimeId = normalizeString(binding.targetRuntimeId);
        if (!targetRuntimeId) return null;
        const targets = readScratchRuntimeTargets(getVM());
        return targets.find(target => getTargetId(target) === targetRuntimeId) || null;
    };

    const findCreatedTarget = beforeIds => getOriginalSpriteTargets(getVM()).find(target => {
        const id = getTargetId(target);
        return id && !beforeIds.has(id);
    }) || null;

    const reconcileAndResolveBinding = (targetRuntimeId, sceneId, reason) => {
        adapter.reconcileActiveScene({reason});
        const binding = adapter.getBindingByTargetRuntimeId(targetRuntimeId, sceneId);
        if (!binding || !normalizeString(binding.nodeId)) {
            throw createLifecycleError(
                'NGVGE_SPRITE_LIFECYCLE_BINDING_MISSING',
                'Scratch Sprite lifecycle mutation completed but no stable semantic binding was established.',
                {sceneId}
            );
        }
        const node = model.getNodeSnapshot(binding.nodeId);
        if (!node) {
            throw createLifecycleError(
                'NGVGE_SPRITE_LIFECYCLE_NODE_MISSING',
                'Scratch Sprite lifecycle binding does not resolve to a Runtime Node.',
                {nodeId: binding.nodeId, sceneId}
            );
        }
        return {binding, node};
    };

    const applySemanticParent = (node, parentId) => {
        const normalizedParentId = normalizeString(parentId);
        if (!normalizedParentId || node.parentId === normalizedParentId) return node;
        assertRuntimeNodeMutationResult(model.setParent(node.id, normalizedParentId, {
            transactionId: `scratch-sprite-lifecycle:parent:${node.id}`
        }));
        return model.getNodeSnapshot(node.id);
    };

    const provisionSemanticComponents = (node, components) => {
        if (!Array.isArray(components) || components.length === 0) return node;
        if (typeof model.addComponent !== 'function') {
            throw createLifecycleError(
                'NGVGE_SPRITE_LIFECYCLE_COMPONENT_PROVISION_UNAVAILABLE',
                'Scratch Sprite lifecycle authority cannot provision semantic components on this Runtime Node Model.',
                {nodeId: node.id}
            );
        }
        let current = node;
        components.forEach(component => {
            if (!component || typeof component.typeId !== 'string' || !component.typeId) {
                throw createLifecycleError(
                    'NGVGE_SPRITE_LIFECYCLE_COMPONENT_INVALID',
                    'Scratch Sprite lifecycle component provisioning requires a stable component typeId.',
                    {nodeId: current.id}
                );
            }
            const existing = Array.isArray(current.components) ?
                current.components.find(entry => entry && entry.typeId === component.typeId) : null;
            if (!existing) {
                assertRuntimeNodeMutationResult(model.addComponent(current.id, component, {
                    transactionId: `scratch-sprite-lifecycle:component:${current.id}:${component.typeId}`
                }));
                current = model.getNodeSnapshot(current.id);
            }
        });
        return current;
    };

    const cleanupFailedCreatedSprite = async ({nodeId, targetRuntimeId}) => {
        if (nodeId) {
            try {
                await Promise.resolve(adapter.destroyBindingByNodeId(nodeId, {
                    reason: 'runtime-node-command-create-sprite-rollback'
                }));
                return;
            } catch {
                // Fall through to the direct target cleanup path if the binding rollback fails.
            }
        }
        const vm = getVM();
        if (targetRuntimeId && vm && typeof vm.deleteSprite === 'function') {
            await Promise.resolve(vm.deleteSprite(targetRuntimeId));
            try {
                adapter.reconcileActiveScene({reason: 'runtime-node-command-create-sprite-rollback'});
            } catch {
                // The original creation error remains authoritative.
            }
        }
    };

    const recordSuccess = value => {
        commandCount += 1;
        lastError = null;
        return value;
    };

    const recordFailure = error => {
        failureCount += 1;
        lastError = error && error.message ? error.message : String(error);
        throw error;
    };

    const createNode = ({options = {}, typeId}) => {
        if (typeId !== SPRITE_NODE_TYPE_ID) {
            throw createLifecycleError(
                'NGVGE_SPRITE_LIFECYCLE_TYPE_UNSUPPORTED',
                `Scratch Sprite lifecycle authority cannot create semantic node type: ${typeId || 'unknown'}`
            );
        }
        const sceneId = assertActiveScene(options.sceneId);
        const vm = getVM();
        const beforeIds = new Set(getOriginalSpriteTargets(vm).map(getTargetId).filter(Boolean));
        if (typeof vm.addSprite !== 'function') {
            throw createLifecycleError(
                'NGVGE_SPRITE_LIFECYCLE_CREATE_UNAVAILABLE',
                'Scratch VM does not expose addSprite for the active compatibility authority.'
            );
        }
        let createdTargetRuntimeId = null;
        let createdNodeId = null;
        // VM service boundaries accept portable plain data but intentionally reject raw
        // ArrayBuffer/Blob ownership transfer. Scratch VM addSprite() accepts a sprite JSON
        // object directly, so creation stays portable and lets Scratch provision its default
        // costume/storage representation internally.
        const run = Promise.resolve(vm.addSprite(createBlankSpriteDescriptor(options.name)))
            .then(() => {
                const target = findCreatedTarget(beforeIds);
                const targetRuntimeId = getTargetId(target);
                createdTargetRuntimeId = targetRuntimeId;
                if (!targetRuntimeId) {
                    throw createLifecycleError(
                        'NGVGE_SPRITE_LIFECYCLE_CREATE_TARGET_MISSING',
                        'Scratch VM completed Sprite creation without exposing a new original target.'
                    );
                }
                let {node} = reconcileAndResolveBinding(
                    targetRuntimeId,
                    sceneId,
                    'runtime-node-command-create-sprite'
                );
                createdNodeId = node.id;
                node = applySemanticParent(node, options.parentId);
                node = provisionSemanticComponents(node, options.components);
                return Promise.resolve(syncRoleManagerOrder(sceneId)).then(() => node);
            });
        return run.then(recordSuccess, error => (
            cleanupFailedCreatedSprite({
                nodeId: createdNodeId,
                targetRuntimeId: createdTargetRuntimeId
            }).catch(() => {}).then(() => recordFailure(error))
        ));
    };

    const patchNode = ({nodeId, patch = {}}) => {
        const binding = getBinding(nodeId);
        if (!binding) {
            throw createLifecycleError(
                'NGVGE_SPRITE_LIFECYCLE_BINDING_REQUIRED',
                `Runtime Node is not owned by the Scratch Sprite lifecycle authority: ${nodeId}`,
                {nodeId}
            );
        }
        const keys = Object.keys(patch);
        if (keys.length !== 1 || keys[0] !== 'name') {
            throw createLifecycleError(
                'NGVGE_SPRITE_LIFECYCLE_PATCH_UNSUPPORTED',
                'Scratch Sprite lifecycle authority currently accepts only semantic Sprite name patches.',
                {nodeId, patchFields: keys}
            );
        }
        const name = normalizeString(patch.name);
        if (!name) {
            throw createLifecycleError(
                'NGVGE_SPRITE_LIFECYCLE_NAME_REQUIRED',
                'Scratch Sprite rename requires a non-empty semantic name.',
                {nodeId}
            );
        }
        const vm = getVM();
        const target = resolveTargetForBinding(binding);
        const targetRuntimeId = getTargetId(target);
        if (!targetRuntimeId || !vm || typeof vm.renameSprite !== 'function') {
            throw createLifecycleError(
                'NGVGE_SPRITE_LIFECYCLE_RENAME_UNAVAILABLE',
                'Scratch Sprite rename requires a live bound target and VM renameSprite capability.',
                {nodeId}
            );
        }
        try {
            vm.renameSprite(targetRuntimeId, name);
            adapter.reconcileActiveScene({reason: 'runtime-node-command-rename-sprite'});
            const node = model.getNodeSnapshot(nodeId);
            if (!node) throw createLifecycleError('NGVGE_SPRITE_LIFECYCLE_NODE_MISSING', `Runtime node disappeared: ${nodeId}`);
            return recordSuccess(node);
        } catch (error) {
            return recordFailure(error);
        }
    };

    const duplicateNode = ({nodeId, options = {}}) => {
        const vm = getVM();
        const binding = getBinding(nodeId);
        const target = resolveTargetForBinding(binding);
        const targetRuntimeId = getTargetId(target);
        if (!binding || !targetRuntimeId || !vm || typeof vm.duplicateSprite !== 'function') {
            throw createLifecycleError(
                'NGVGE_SPRITE_LIFECYCLE_DUPLICATE_UNAVAILABLE',
                'Scratch Sprite duplication requires a live bound target and VM duplicateSprite capability.',
                {nodeId}
            );
        }
        const sceneId = assertActiveScene(binding.sceneId);
        const sourceParent = model.getParent(nodeId);
        const beforeIds = new Set(getOriginalSpriteTargets(vm).map(getTargetId).filter(Boolean));
        const run = Promise.resolve(vm.duplicateSprite(targetRuntimeId)).then(() => {
            const duplicatedTarget = findCreatedTarget(beforeIds);
            const duplicatedTargetId = getTargetId(duplicatedTarget);
            if (!duplicatedTargetId) {
                throw createLifecycleError(
                    'NGVGE_SPRITE_LIFECYCLE_DUPLICATE_TARGET_MISSING',
                    'Scratch VM completed Sprite duplication without exposing the duplicated original target.',
                    {nodeId}
                );
            }
            let {node} = reconcileAndResolveBinding(
                duplicatedTargetId,
                sceneId,
                'runtime-node-command-duplicate-sprite'
            );
            const requestedParentId = normalizeString(options.parentId);
            const parentId = requestedParentId || normalizeString(sourceParent && sourceParent.id);
            node = applySemanticParent(node, parentId);
            return Promise.resolve(syncRoleManagerOrder(sceneId)).then(() => node);
        });
        return run.then(recordSuccess, recordFailure);
    };

    const reparentNode = ({nodeId, parentId, options: reparentOptions = {}}) => {
        const binding = getBinding(nodeId);
        if (!binding) {
            throw createLifecycleError(
                'NGVGE_SPRITE_LIFECYCLE_BINDING_REQUIRED',
                `Runtime Node is not owned by the Scratch Sprite lifecycle authority: ${nodeId}`,
                {nodeId}
            );
        }
        const sceneId = assertActiveScene(binding.sceneId);
        const normalizedParentId = normalizeString(parentId);
        if (!normalizedParentId) {
            throw createLifecycleError(
                'NGVGE_SPRITE_LIFECYCLE_PARENT_REQUIRED',
                'Scratch-backed semantic Sprite reparent requires a stable parent NodeId.',
                {nodeId}
            );
        }
        try {
            const previousParent = model.getParent(nodeId);
            const previousSiblings = previousParent ? model.getChildren(previousParent.id) : [];
            const previousIndex = previousSiblings.findIndex(node => node.id === nodeId);
            const mutation = model.setParent(nodeId, normalizedParentId, reparentOptions || {});
            assertRuntimeNodeMutationResult(mutation);
            const run = Promise.resolve(syncRoleManagerOrder(sceneId)).then(() => {
                const node = model.getNodeSnapshot(nodeId);
                if (!node) {
                    throw createLifecycleError(
                        'NGVGE_SPRITE_LIFECYCLE_NODE_MISSING',
                        `Runtime node disappeared after reparent: ${nodeId}`,
                        {nodeId}
                    );
                }
                return node;
            }, async error => {
                if (previousParent) {
                    try {
                        assertRuntimeNodeMutationResult(model.setParent(nodeId, previousParent.id, {
                            index: previousIndex >= 0 ? previousIndex : undefined,
                            transactionId: `scratch-sprite-lifecycle:reparent-rollback:${nodeId}`
                        }));
                        await Promise.resolve(syncRoleManagerOrder(sceneId));
                    } catch {
                        // The original projection failure remains authoritative.
                    }
                }
                throw error;
            });
            return run.then(recordSuccess, recordFailure);
        } catch (error) {
            return recordFailure(error);
        }
    };

    const destroyNode = ({nodeId}) => {
        const binding = getBinding(nodeId);
        if (!binding) {
            throw createLifecycleError(
                'NGVGE_SPRITE_LIFECYCLE_BINDING_REQUIRED',
                `Runtime Node is not owned by the Scratch Sprite lifecycle authority: ${nodeId}`,
                {nodeId}
            );
        }
        const run = Promise.resolve(adapter.destroyBindingByNodeId(nodeId, {
            reason: 'runtime-node-command-destroy-sprite'
        })).then(() => ({destroyed: true, nodeId}));
        return run.then(recordSuccess, recordFailure);
    };

    return Object.freeze({
        authorityId: SCRATCH_SPRITE_LIFECYCLE_AUTHORITY_ID,
        bridgeId: SCRATCH_SPRITE_LIFECYCLE_COMMAND_BRIDGE_ID,
        stateDomain: SPRITE_LIFECYCLE_STATE_DOMAIN,
        version: SCRATCH_SPRITE_LIFECYCLE_COMMAND_BRIDGE_VERSION,
        createNode,
        destroyNode,
        duplicateNode,
        handlesCreateType: typeId => typeId === SPRITE_NODE_TYPE_ID,
        ownsNode: nodeId => Boolean(getBinding(nodeId)),
        patchNode,
        reparentNode,
        getStatus: () => Object.freeze({
            authorityId: SCRATCH_SPRITE_LIFECYCLE_AUTHORITY_ID,
            bridgeId: SCRATCH_SPRITE_LIFECYCLE_COMMAND_BRIDGE_ID,
            commandCount,
            failureCount,
            lastError,
            stateDomain: SPRITE_LIFECYCLE_STATE_DOMAIN,
            version: SCRATCH_SPRITE_LIFECYCLE_COMMAND_BRIDGE_VERSION
        })
    });
};

module.exports = {
    SCRATCH_SPRITE_LIFECYCLE_AUTHORITY_ID,
    SCRATCH_SPRITE_LIFECYCLE_COMMAND_BRIDGE_ID,
    SCRATCH_SPRITE_LIFECYCLE_COMMAND_BRIDGE_VERSION,
    SPRITE_LIFECYCLE_STATE_DOMAIN,
    createScratchSpriteLifecycleCommandBridge
};
