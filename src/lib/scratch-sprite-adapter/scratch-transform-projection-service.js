'use strict';

const {
    TRANSFORM2D_SCRATCH_AUTHORITY_ID,
    TRANSFORM2D_SEMANTIC_PROJECTION_ID,
    TRANSFORM2D_STATE_DOMAIN,
    TRANSFORM2D_TYPE_ID,
    normalizeTransform2D
} = require('../../core/transform2d');
const {
    createTransform2DRuntimeStoreForModel
} = require('../transform-system');
const {
    SCRATCH_BINDING_STATUSES
} = require('./constants');
const {FRAME_PROFILER_CATEGORY, getFrameTimeProfiler} = require('../frame-profiler');
const {
    RUNTIME_PHASE_IDS,
    RUNTIME_PHASE_PRIORITIES,
    getRuntimePhaseScheduler
} = require('../runtime-scheduler');

const SCRATCH_TRANSFORM_PROJECTION_CAPABILITY_ID = 'ngvge.scratch-transform-projection';
const SCRATCH_TRANSFORM_PROJECTION_VERSION = 1;

const SCRATCH_TRANSFORM_PROJECTION_CONTRACT = Object.freeze({
    authority: Object.freeze({
        projectionId: TRANSFORM2D_SEMANTIC_PROJECTION_ID,
        sourceAuthorityId: TRANSFORM2D_SCRATCH_AUTHORITY_ID,
        stateDomain: TRANSFORM2D_STATE_DOMAIN
    }),
    capabilityId: SCRATCH_TRANSFORM_PROJECTION_CAPABILITY_ID,
    contractId: 'ngvge.scratch-transform-projection',
    contractVersion: '1',
    direction: 'Scratch -> NGVGE',
    highFrequency: Object.freeze({
        persistentWrite: false,
        runtimeWrite: true
    }),
    mapping: Object.freeze({
        position: 'Scratch target x/y -> NGVGE world position x/y',
        rotation: 'wrap180(90 - Scratch direction) -> Cartesian degrees (+X zero, CCW positive)',
        scale: 'Scratch size percent / 100 -> uniform NGVGE scale'
    }),
    persistence: Object.freeze({
        bootstrapPersistentComponent: 'explicit-bootstrap-only',
        runtimeToPersistentCommit: 'explicit-commit-only'
    }),
    representationBoundary: Object.freeze({
        scratchTargetStoredInTransform: false,
        targetRuntimeIdStoredInTransform: false,
        rendererPrivateStateRequired: false
    })
});

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return Object.freeze(value);
};

const getContextVM = context => {
    if (!context) return null;
    if (typeof context.getService === 'function') return context.getService('vm');
    return context.vm || null;
};

const normalizeString = value => (
    typeof value === 'string' && value.trim() ? value.trim() : null
);

const wrapDegrees180 = value => {
    const number = Number(value);
    if (!Number.isFinite(number)) return NaN;
    return ((((number + 180) % 360) + 360) % 360) - 180;
};

const scratchDirectionToTransformRotation = direction => wrapDegrees180(90 - Number(direction));

const readScratchTargetTransform = target => {
    if (!target || typeof target !== 'object' || target.isStage) {
        const error = new TypeError('Scratch Transform projection requires a non-stage Scratch Target.');
        error.code = 'SCRATCH_TRANSFORM_TARGET_INVALID';
        throw error;
    }
    const x = Number(target.x);
    const y = Number(target.y);
    const direction = Number(target.direction);
    const size = Number(target.size);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(direction) || !Number.isFinite(size)) {
        const error = new TypeError('Scratch Target transform fields must be finite numbers.');
        error.code = 'SCRATCH_TRANSFORM_TARGET_NON_FINITE';
        throw error;
    }
    const scale = size / 100;
    return normalizeTransform2D({
        position: [x, y],
        rotation: scratchDirectionToTransformRotation(direction),
        scale: [scale, scale]
    });
};

const transformsEqual = (left, right) => Boolean(left && right &&
    left.position[0] === right.position[0] && left.position[1] === right.position[1] &&
    left.rotation === right.rotation &&
    left.scale[0] === right.scale[0] && left.scale[1] === right.scale[1]);

// Scratch VM is obtained through the NGVGE Module Service Facade in a real browser. Arrays crossing
// that boundary keep length/index access but intentionally do not preserve native Array identity.
// Copy the array-like target collection locally instead of depending on Array.isArray().
const readScratchRuntimeTargets = vm => {
    if (!vm || !vm.runtime) return [];
    const targets = vm.runtime.targets;
    if (!targets || typeof targets !== 'object') return [];
    if (Array.isArray(targets)) return targets;

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

const createTargetIndex = vm => {
    const targets = readScratchRuntimeTargets(vm);
    const byId = new Map();
    targets.forEach(target => {
        if (!target || target.isStage || target.isOriginal === false) return;
        const targetRuntimeId = normalizeString(target.id);
        if (targetRuntimeId) byId.set(targetRuntimeId, target);
    });
    return byId;
};

const getTransformComponentView = (runtimeNodeModel, nodeId) => {
    const node = runtimeNodeModel.getNodeSnapshot(nodeId);
    if (!node || !Array.isArray(node.components)) return null;
    return node.components.find(component => component && component.typeId === TRANSFORM2D_TYPE_ID) || null;
};

const assertDependencies = (
    sceneDataModel,
    runtimeNodeModel,
    runtimeNodeTypeRegistration,
    scratchSpriteAdapter
) => {
    if (!sceneDataModel || typeof sceneDataModel.readProject !== 'function') {
        throw new TypeError('Scratch Transform projection requires the Scene Data Model capability.');
    }
    if (!runtimeNodeModel || typeof runtimeNodeModel.getNodeSnapshot !== 'function' ||
        typeof runtimeNodeModel.listNodes !== 'function') {
        throw new TypeError('Scratch Transform projection requires the Runtime Node Model capability.');
    }
    if (!runtimeNodeTypeRegistration ||
        typeof runtimeNodeTypeRegistration.registerComponentTypeDescriptor !== 'function') {
        throw new TypeError('Scratch Transform projection requires Runtime Node Type Registration capability.');
    }
    if (!scratchSpriteAdapter || typeof scratchSpriteAdapter.listBindings !== 'function' ||
        typeof scratchSpriteAdapter.getBindingByNodeId !== 'function' ||
        typeof scratchSpriteAdapter.subscribe !== 'function') {
        throw new TypeError('Scratch Transform projection requires the Scratch Sprite Adapter capability.');
    }
};

const createScratchTransformProjectionService = (
    context,
    sceneDataModel,
    runtimeNodeModel,
    runtimeNodeTypeRegistration,
    scratchSpriteAdapter,
    options = {}
) => {
    assertDependencies(sceneDataModel, runtimeNodeModel, runtimeNodeTypeRegistration, scratchSpriteAdapter);
    const transformRuntimeStore = options.transformRuntimeStore || createTransform2DRuntimeStoreForModel(
        runtimeNodeModel,
        runtimeNodeTypeRegistration
    );
    const ownsTransformRuntimeStore = !options.transformRuntimeStore;
    const listeners = new Set();
    const unsubscribers = [];
    let bootstrapTimer = null;
    let disposed = false;
    let tracking = false;
    let revision = 0;
    let projectionCount = 0;
    let bootstrapCount = 0;
    let commitCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let lastError = null;
    let lastReason = null;
    const vmAtCreation = getContextVM(context);
    const runtimeAtCreation = vmAtCreation && vmAtCreation.runtime;
    const phaseScheduler = options.phaseScheduler || (runtimeAtCreation ? getRuntimePhaseScheduler(runtimeAtCreation) : null);
    const frameProfiler = runtimeAtCreation ? getFrameTimeProfiler(runtimeAtCreation) : null;
    let topologyCache = null;
    let topologySceneId = null;
    let topologyDirty = true;
    let topologyRebuildCount = 0;
    let shadowSkipCount = 0;
    let scheduledProjectionCount = 0;
    let coalescedProjectionSignalCount = 0;
    let projectionPending = false;

    const assertAvailable = () => {
        if (!disposed) return;
        const error = new Error('Scratch Transform projection service has been disposed.');
        error.code = 'SCRATCH_TRANSFORM_PROJECTION_DISPOSED';
        throw error;
    };

    const emit = change => {
        revision += 1;
        const payload = deepFreeze(Object.assign({revision}, change));
        listeners.forEach(listener => {
            try { listener(payload); } catch { /* observer isolation */ }
        });
        return payload;
    };

    const recordError = (error, reason) => {
        errorCount += 1;
        lastError = error && error.message ? error.message : String(error);
        lastReason = reason || lastReason;
        emit({
            code: error && error.code ? error.code : 'SCRATCH_TRANSFORM_PROJECTION_FAILED',
            error: lastError,
            reason: lastReason,
            type: 'transform-projection:error'
        });
        return null;
    };

    const getActiveSceneId = () => {
        const project = sceneDataModel.readProject();
        return normalizeString(project && project.activeSceneId);
    };

    const findTargetForBinding = (binding, targetIndex) => {
        if (!binding || binding.status !== SCRATCH_BINDING_STATUSES.BOUND) return null;
        const targetRuntimeId = normalizeString(binding.targetRuntimeId);
        return targetRuntimeId ? targetIndex.get(targetRuntimeId) || null : null;
    };

    const projectBindingInternal = (binding, target, projectionOptions = {}) => {
        const nodeId = normalizeString(binding && binding.nodeId);
        if (!nodeId || !target) {
            skippedCount += 1;
            return null;
        }
        const transform = readScratchTargetTransform(target);
        const cacheEntry = projectionOptions.cacheEntry || null;
        if (cacheEntry && transformsEqual(cacheEntry.lastTransform, transform)) {
            skippedCount += 1;
            shadowSkipCount += 1;
            return null;
        }
        let component = cacheEntry && cacheEntry.transformComponentPresent ? {typeId: TRANSFORM2D_TYPE_ID} :
            getTransformComponentView(runtimeNodeModel, nodeId);
        if (!component) {
            if (projectionOptions.allowPersistentBootstrap !== true) {
                skippedCount += 1;
                return null;
            }
            component = transformRuntimeStore.ensureTransformComponent(nodeId, {data: transform});
            bootstrapCount += 1;
            if (cacheEntry) cacheEntry.transformComponentPresent = true;
        }
        const before = transformRuntimeStore.getRuntimeSnapshot(nodeId);
        const after = transformRuntimeStore.replaceRuntimeTransform(nodeId, transform);
        if (cacheEntry) cacheEntry.lastTransform = transform;
        if (!before || before.revision !== after.revision) projectionCount += 1;
        return deepFreeze({
            bindingId: binding.bindingId,
            nodeId,
            runtimeRevision: after.revision,
            transform: after.transform
        });
    };

    const invalidateTopology = () => {
        topologyDirty = true;
    };

    const rebuildTopologyCache = sceneId => {
        const vm = getContextVM(context);
        const targetIndex = createTargetIndex(vm);
        const bindings = scratchSpriteAdapter.listBindings(sceneId);
        topologyCache = bindings.map(binding => {
            const target = findTargetForBinding(binding, targetIndex);
            const nodeId = normalizeString(binding && binding.nodeId);
            return {
                binding,
                lastTransform: nodeId ? transformRuntimeStore.getRuntimeTransform(nodeId) : null,
                nodeId,
                target,
                transformComponentPresent: Boolean(nodeId && getTransformComponentView(runtimeNodeModel, nodeId))
            };
        }).filter(entry => entry.nodeId && entry.target);
        topologySceneId = sceneId;
        topologyDirty = false;
        topologyRebuildCount += 1;
        return topologyCache;
    };

    const getTopologyCache = sceneId => {
        if (topologyDirty || topologySceneId !== sceneId || !topologyCache) return rebuildTopologyCache(sceneId);
        return topologyCache;
    };

    const projectCachedSceneInternal = (sceneId, projectionOptions = {}) => {
        const projected = [];
        const entries = getTopologyCache(sceneId);
        entries.forEach(entry => {
            try {
                const result = projectBindingInternal(entry.binding, entry.target, Object.assign({}, projectionOptions, {
                    cacheEntry: entry
                }));
                if (result) projected.push(result);
            } catch (error) {
                invalidateTopology();
                recordError(error, projectionOptions.reason || 'project-cached-scene');
            }
        });
        lastReason = projectionOptions.reason || 'project-cached-scene';
        if (projected.length || projectionOptions.emitEmpty === true) {
            emit({
                bootstrap: false,
                projectedNodeIds: projected.map(item => item.nodeId),
                reason: lastReason,
                sceneId,
                type: 'transform-projection:project'
            });
        }
        return Object.freeze(projected);
    };

    const projectSceneInternal = (sceneId, projectionOptions = {}) => {
        const vm = getContextVM(context);
        const targetIndex = createTargetIndex(vm);
        const bindings = scratchSpriteAdapter.listBindings(sceneId);
        const projected = [];
        bindings.forEach(binding => {
            try {
                const target = findTargetForBinding(binding, targetIndex);
                if (!target) {
                    skippedCount += 1;
                    return;
                }
                const result = projectBindingInternal(binding, target, projectionOptions);
                if (result) projected.push(result);
            } catch (error) {
                recordError(error, projectionOptions.reason || 'project-scene');
            }
        });
        lastReason = projectionOptions.reason || 'project-scene';
        if (projected.length || projectionOptions.emitEmpty === true) {
            emit({
                bootstrap: projectionOptions.allowPersistentBootstrap === true,
                projectedNodeIds: projected.map(item => item.nodeId),
                reason: lastReason,
                sceneId,
                type: 'transform-projection:project'
            });
        }
        invalidateTopology();
        return Object.freeze(projected);
    };

    const bootstrapScene = (sceneId = null, bootstrapOptions = {}) => {
        assertAvailable();
        const resolvedSceneId = normalizeString(sceneId) || getActiveSceneId();
        if (!resolvedSceneId) return Object.freeze([]);
        return projectSceneInternal(resolvedSceneId, {
            allowPersistentBootstrap: true,
            emitEmpty: bootstrapOptions.emitEmpty === true,
            reason: bootstrapOptions.reason || 'bootstrap'
        });
    };

    const projectScene = (sceneId = null, projectionOptions = {}) => {
        assertAvailable();
        const resolvedSceneId = normalizeString(sceneId) || getActiveSceneId();
        if (!resolvedSceneId) return Object.freeze([]);
        return projectSceneInternal(resolvedSceneId, {
            allowPersistentBootstrap: false,
            emitEmpty: projectionOptions.emitEmpty === true,
            reason: projectionOptions.reason || 'runtime-projection'
        });
    };

    const projectNode = (nodeId, projectionOptions = {}) => {
        assertAvailable();
        const normalizedNodeId = normalizeString(nodeId);
        if (!normalizedNodeId) return null;
        const resolvedSceneId = normalizeString(projectionOptions.sceneId) || getActiveSceneId();
        if (!resolvedSceneId) return null;
        const binding = scratchSpriteAdapter.getBindingByNodeId(normalizedNodeId, resolvedSceneId);
        if (!binding) {
            skippedCount += 1;
            return null;
        }
        const target = findTargetForBinding(binding, createTargetIndex(getContextVM(context)));
        if (!target) {
            skippedCount += 1;
            return null;
        }
        try {
            const projected = projectBindingInternal(binding, target, {
                allowPersistentBootstrap: projectionOptions.allowPersistentBootstrap === true,
                reason: projectionOptions.reason || 'runtime-node-projection'
            });
            lastReason = projectionOptions.reason || 'runtime-node-projection';
            if (projected) {
                emit({
                    bootstrap: projectionOptions.allowPersistentBootstrap === true,
                    projectedNodeIds: [normalizedNodeId],
                    reason: lastReason,
                    sceneId: resolvedSceneId,
                    type: 'transform-projection:project-node'
                });
            }
            return projected;
        } catch (error) {
            return recordError(error, projectionOptions.reason || 'runtime-node-projection');
        }
    };

    const commitNodeToPersistent = (nodeId, commitOptions = {}) => {
        assertAvailable();
        const normalizedNodeId = normalizeString(nodeId);
        if (!normalizedNodeId) return null;
        const resolvedSceneId = normalizeString(commitOptions.sceneId) || getActiveSceneId();
        if (!resolvedSceneId) return null;
        const binding = scratchSpriteAdapter.getBindingByNodeId(normalizedNodeId, resolvedSceneId);
        if (!binding || binding.status !== SCRATCH_BINDING_STATUSES.BOUND) return null;
        if (commitOptions.projectBeforeCommit !== false) {
            const projected = projectNode(normalizedNodeId, {
                reason: commitOptions.reason || 'pre-node-commit-projection',
                sceneId: resolvedSceneId
            });
            if (!projected) return null;
        }
        const component = getTransformComponentView(runtimeNodeModel, normalizedNodeId);
        if (!component || !transformRuntimeStore.getRuntimeTransform(normalizedNodeId)) return null;
        try {
            const record = transformRuntimeStore.commitRuntimeToPersistent(normalizedNodeId, {
                transactionId: `scratch-transform:commit:${normalizedNodeId}`
            });
            commitCount += 1;
            lastReason = commitOptions.reason || 'node-commit';
            const committed = deepFreeze({
                componentId: record.id,
                nodeId: normalizedNodeId,
                transform: normalizeTransform2D(record.data)
            });
            emit({
                committedNodeIds: [normalizedNodeId],
                reason: lastReason,
                sceneId: resolvedSceneId,
                type: 'transform-projection:commit-node'
            });
            return committed;
        } catch (error) {
            return recordError(error, commitOptions.reason || 'node-commit');
        }
    };

    const commitSceneToPersistent = (sceneId = null, commitOptions = {}) => {
        assertAvailable();
        const resolvedSceneId = normalizeString(sceneId) || getActiveSceneId();
        if (!resolvedSceneId) return Object.freeze([]);
        projectScene(resolvedSceneId, {reason: commitOptions.reason || 'pre-commit-projection'});
        const committed = [];
        scratchSpriteAdapter.listBindings(resolvedSceneId).forEach(binding => {
            if (!binding || binding.status !== SCRATCH_BINDING_STATUSES.BOUND) return;
            const component = getTransformComponentView(runtimeNodeModel, binding.nodeId);
            if (!component || !transformRuntimeStore.getRuntimeTransform(binding.nodeId)) return;
            try {
                const record = transformRuntimeStore.commitRuntimeToPersistent(binding.nodeId, {
                    transactionId: `scratch-transform:commit:${binding.nodeId}`
                });
                commitCount += 1;
                committed.push(deepFreeze({
                    componentId: record.id,
                    nodeId: binding.nodeId,
                    transform: normalizeTransform2D(record.data)
                }));
            } catch (error) {
                recordError(error, commitOptions.reason || 'commit');
            }
        });
        lastReason = commitOptions.reason || 'commit';
        emit({
            committedNodeIds: committed.map(item => item.nodeId),
            reason: lastReason,
            sceneId: resolvedSceneId,
            type: 'transform-projection:commit'
        });
        return Object.freeze(committed);
    };

    const scheduleBootstrap = (reason, sceneId = null) => {
        if (disposed || bootstrapTimer !== null) return;
        bootstrapTimer = setTimeout(() => {
            bootstrapTimer = null;
            if (disposed) return;
            try {
                invalidateTopology();
                bootstrapScene(sceneId, {reason});
            } catch (error) {
                recordError(error, reason);
            }
        }, 0);
    };

    const addEmitterListener = (emitter, eventName, handler) => {
        if (!emitter || typeof emitter.on !== 'function') return;
        emitter.on(eventName, handler);
        unsubscribers.push(() => {
            if (typeof emitter.off === 'function') emitter.off(eventName, handler);
            else if (typeof emitter.removeListener === 'function') emitter.removeListener(eventName, handler);
        });
    };

    const flushScheduledProjection = reason => {
        if (disposed || !tracking) return Object.freeze([]);
        projectionPending = false;
        const resolvedSceneId = getActiveSceneId();
        if (!resolvedSceneId) return Object.freeze([]);
        const run = () => projectCachedSceneInternal(resolvedSceneId, {
            allowPersistentBootstrap: false,
            reason: reason || 'scratch-targets-update-coalesced'
        });
        return frameProfiler ? frameProfiler.measure(FRAME_PROFILER_CATEGORY.SCRATCH_PROJECTION, run) : run();
    };

    const scheduleProjection = reason => {
        if (disposed || !tracking) return false;
        if (projectionPending) coalescedProjectionSignalCount += 1;
        else scheduledProjectionCount += 1;
        projectionPending = true;
        if (phaseScheduler) {
            return phaseScheduler.schedule(
                RUNTIME_PHASE_IDS.SCRATCH_TRANSFORM_PROJECTION,
                () => flushScheduledProjection(reason),
                {priority: RUNTIME_PHASE_PRIORITIES.SCRATCH_TRANSFORM_PROJECTION}
            );
        }
        setTimeout(() => flushScheduledProjection(reason), 0);
        return true;
    };

    const start = () => {
        assertAvailable();
        if (tracking) return false;
        tracking = true;
        const vm = getContextVM(context);
        const runtime = vm && vm.runtime;
        const projectTargetsUpdate = () => scheduleProjection('scratch-targets-update-coalesced');
        // AFTER_EXECUTE is intentionally not observed. Scratch target-change signals are the dirty source;
        // both runtime TARGETS_UPDATE and public vm targetsUpdate are coalesced by the Runtime Phase Scheduler.
        addEmitterListener(runtime, 'TARGETS_UPDATE', projectTargetsUpdate);
        addEmitterListener(vm, 'targetsUpdate', projectTargetsUpdate);
        unsubscribers.push(scratchSpriteAdapter.subscribe(change => {
            if (!change) return;
            if (change.type === 'adapter:reconcile') {
                invalidateTopology();
                scheduleBootstrap('scratch-binding-reconcile', change.sceneId || null);
            }
        }));
        bootstrapScene(null, {reason: 'tracking-start'});
        invalidateTopology();
        emit({type: 'transform-projection:tracking-start'});
        return true;
    };

    const stop = () => {
        if (!tracking) return false;
        tracking = false;
        projectionPending = false;
        unsubscribers.splice(0).forEach(unsubscribe => {
            try { unsubscribe(); } catch { /* noop */ }
        });
        if (bootstrapTimer !== null) {
            clearTimeout(bootstrapTimer);
            bootstrapTimer = null;
        }
        emit({type: 'transform-projection:tracking-stop'});
        return true;
    };

    return Object.freeze({
        capabilityId: SCRATCH_TRANSFORM_PROJECTION_CAPABILITY_ID,
        version: SCRATCH_TRANSFORM_PROJECTION_VERSION,
        bootstrapActiveScene: options => bootstrapScene(null, options),
        bootstrapScene,
        commitActiveSceneToPersistent: options => commitSceneToPersistent(null, options),
        commitNodeToPersistent,
        commitSceneToPersistent,
        dispose: () => {
            if (disposed) return;
            stop();
            disposed = true;
            listeners.clear();
            if (ownsTransformRuntimeStore) transformRuntimeStore.dispose();
        },
        getStatus: () => {
            assertAvailable();
            return deepFreeze({
                bootstrapCount,
                commitCount,
                errorCount,
                lastError,
                lastReason,
                coalescedProjectionSignalCount,
                projectionCount,
                projectionPending,
                revision,
                scheduledProjectionCount,
                shadowSkipCount,
                skippedCount,
                topologyRebuildCount,
                tracking
            });
        },
        flushScheduledProjection: reason => flushScheduledProjection(reason || 'manual-flush'),
        projectActiveScene: options => projectScene(null, options),
        projectNode,
        projectScene,
        start,
        stop,
        subscribe: listener => {
            assertAvailable();
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    });
};

module.exports = {
    SCRATCH_TRANSFORM_PROJECTION_CAPABILITY_ID,
    SCRATCH_TRANSFORM_PROJECTION_CONTRACT,
    SCRATCH_TRANSFORM_PROJECTION_VERSION,
    createScratchTransformProjectionService,
    readScratchTargetTransform,
    scratchDirectionToTransformRotation,
    wrapDegrees180
};
