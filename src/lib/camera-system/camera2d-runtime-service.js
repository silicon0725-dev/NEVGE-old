'use strict';

const {
    CAMERA2D_COMPONENT_OWNER,
    CAMERA2D_SCHEMA_VERSION,
    CAMERA2D_TYPE_ID,
    applyCamera2DPatch,
    normalizeCamera2D
} = require('../../core/camera2d');
const {TRANSFORM2D_TYPE_ID} = require('../../core/transform2d');
const {COMPONENT_CARDINALITIES} = require('../runtime-nodes/runtime-component-contract');

const CAMERA2D_RUNTIME_CAPABILITY_ID = 'ngvge.camera2d-runtime';
const CAMERA2D_RUNTIME_CAPABILITY_VERSION = 1;

const CAMERA2D_RUNTIME_COMPONENT_DESCRIPTOR = Object.freeze({
    cardinality: COMPONENT_CARDINALITIES.ONE,
    ownerModuleId: CAMERA2D_COMPONENT_OWNER,
    schemaVersion: CAMERA2D_SCHEMA_VERSION,
    typeId: CAMERA2D_TYPE_ID
});

const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return Object.freeze(value);
};

const clonePortable = value => JSON.parse(JSON.stringify(value));

const getCameraComponent = node => {
    const components = node && Array.isArray(node.components) ? node.components : [];
    return components.find(component => component && component.typeId === CAMERA2D_TYPE_ID) || null;
};

const getTransformComponent = node => {
    const components = node && Array.isArray(node.components) ? node.components : [];
    return components.find(component => component && component.typeId === TRANSFORM2D_TYPE_ID) || null;
};

const createCamera2DComponentOptions = (data, options = {}) => {
    const result = {
        data: normalizeCamera2D(data),
        enabled: options.enabled !== false,
        schemaVersion: CAMERA2D_SCHEMA_VERSION,
        typeId: CAMERA2D_TYPE_ID
    };
    if (options.componentId) result.id = String(options.componentId);
    return result;
};

const registerCamera2DComponent = typeRegistration => {
    if (!typeRegistration || typeof typeRegistration.getComponentTypeDescriptor !== 'function' ||
        typeof typeRegistration.registerComponentTypeDescriptor !== 'function') {
        throw new TypeError('Camera2D requires Runtime Node Type Registration capability.');
    }
    const existing = typeRegistration.getComponentTypeDescriptor(CAMERA2D_TYPE_ID);
    if (existing && existing.ownerModuleId === CAMERA2D_COMPONENT_OWNER &&
        existing.schemaVersion === CAMERA2D_SCHEMA_VERSION && existing.cardinality === COMPONENT_CARDINALITIES.ONE) {
        return existing;
    }
    return typeRegistration.registerComponentTypeDescriptor(CAMERA2D_RUNTIME_COMPONENT_DESCRIPTOR, {replace: Boolean(existing)});
};

const createCamera2DRuntimeService = options => {
    const runtimeNodeModel = options && options.runtimeNodeModel;
    const typeRegistration = options && options.typeRegistration;
    const transformRuntimeStore = options && options.transformRuntimeStore;
    const sceneRuntime = options && options.sceneRuntime;
    const renderAdapter = options && options.renderAdapter;
    const scratchRuntime = options && options.scratchRuntime;
    if (!runtimeNodeModel || typeof runtimeNodeModel.listNodes !== 'function' ||
        typeof runtimeNodeModel.getNodeSnapshot !== 'function' || typeof runtimeNodeModel.subscribe !== 'function' ||
        typeof runtimeNodeModel.setComponentData !== 'function') {
        throw new TypeError('Camera2D Runtime Service requires Runtime Node Model capability.');
    }
    if (!transformRuntimeStore || typeof transformRuntimeStore.getRuntimeTransform !== 'function' ||
        typeof transformRuntimeStore.subscribe !== 'function') {
        throw new TypeError('Camera2D Runtime Service requires Transform2D Runtime Store.');
    }
    if (!sceneRuntime || typeof sceneRuntime.getActiveSceneId !== 'function') {
        throw new TypeError('Camera2D Runtime Service requires Scene Runtime capability.');
    }
    if (!renderAdapter || typeof renderAdapter.applyViewport !== 'function') {
        throw new TypeError('Camera2D Runtime Service requires a viewport render adapter.');
    }

    registerCamera2DComponent(typeRegistration);
    const listeners = new Set();
    const runtimeConfigs = new Map();
    let disposed = false;
    let revision = 0;
    let viewportState = null;
    let unsubscribeNodes = () => {};
    let unsubscribeTransform = () => {};
    let unsubscribeScene = () => {};
    let detachRuntimeLifecycle = () => {};

    const emit = change => {
        revision += 1;
        const event = deepFreeze(Object.assign({revision}, clonePortable(change || {})));
        listeners.forEach(listener => {
            try { listener(event); } catch { /* advisory listener */ }
        });
    };

    const hydrateNode = nodeId => {
        const node = runtimeNodeModel.getNodeSnapshot(nodeId);
        const component = getCameraComponent(node);
        if (!node || !component) {
            runtimeConfigs.delete(nodeId);
            return null;
        }
        const normalized = normalizeCamera2D(component.data);
        runtimeConfigs.set(nodeId, normalized);
        return normalized;
    };

    const hydrateAll = () => {
        const present = new Set();
        runtimeNodeModel.listNodes({includeRoots: false}).forEach(node => {
            if (!getCameraComponent(node)) return;
            present.add(node.id);
            hydrateNode(node.id);
        });
        Array.from(runtimeConfigs.keys()).forEach(nodeId => {
            if (!present.has(nodeId)) runtimeConfigs.delete(nodeId);
        });
    };

    const getConfig = nodeId => {
        if (!runtimeConfigs.has(nodeId)) hydrateNode(nodeId);
        const config = runtimeConfigs.get(nodeId);
        return config ? normalizeCamera2D(config) : null;
    };

    const buildCameraView = node => {
        const component = getCameraComponent(node);
        if (!node || !component) return null;
        const transformComponent = getTransformComponent(node);
        const transform = transformRuntimeStore.getRuntimeTransform(node.id) ||
            (transformComponent ? transformComponent.data : null) ||
            {position: [0, 0], rotation: 0, scale: [1, 1]};
        return deepFreeze({
            componentEnabled: component.enabled !== false,
            componentId: component.id,
            config: getConfig(node.id) || normalizeCamera2D(component.data),
            name: node.name,
            nodeId: node.id,
            sceneId: node.sceneId,
            transform: clonePortable(transform)
        });
    };

    const listCameras = (sceneId = sceneRuntime.getActiveSceneId()) => runtimeNodeModel.listNodes({
        includeRoots: false,
        sceneId
    }).map(buildCameraView).filter(Boolean);

    const chooseActiveCamera = sceneId => listCameras(sceneId)
        .filter(camera => camera.componentEnabled && camera.config.enabled)
        .sort((a, b) => {
            if (a.config.priority !== b.config.priority) return b.config.priority - a.config.priority;
            return a.nodeId.localeCompare(b.nodeId);
        })[0] || null;

    const buildViewportState = activeCamera => {
        if (!activeCamera) {
            return deepFreeze({
                activeCameraNodeId: null,
                offset: [0, 0],
                position: [0, 0],
                rotation: 0,
                sceneId: sceneRuntime.getActiveSceneId(),
                zoom: [1, 1]
            });
        }
        return deepFreeze({
            activeCameraNodeId: activeCamera.nodeId,
            componentId: activeCamera.componentId,
            offset: activeCamera.config.offset.slice(),
            position: activeCamera.transform.position.slice(),
            priority: activeCamera.config.priority,
            rotation: activeCamera.transform.rotation,
            sceneId: activeCamera.sceneId,
            zoom: activeCamera.config.zoom.slice()
        });
    };

    const viewportEquals = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    const refreshViewport = reason => {
        if (disposed) return null;
        const next = buildViewportState(chooseActiveCamera(sceneRuntime.getActiveSceneId()));
        if (!viewportEquals(viewportState, next)) {
            viewportState = next;
            renderAdapter.applyViewport(viewportState);
            emit({activeCameraNodeId: viewportState.activeCameraNodeId, reason: reason || 'refresh', type: 'viewport'});
        }
        return viewportState;
    };

    const patchRuntimeCamera = (nodeId, patch) => {
        const node = runtimeNodeModel.getNodeSnapshot(nodeId);
        const component = getCameraComponent(node);
        if (!node || !component) {
            const error = new Error(`Camera2D component not found for node: ${nodeId}`);
            error.code = 'NGVGE_CAMERA2D_COMPONENT_NOT_FOUND';
            throw error;
        }
        const current = getConfig(nodeId) || normalizeCamera2D(component.data);
        const next = applyCamera2DPatch(current, patch);
        runtimeConfigs.set(nodeId, next);
        refreshViewport('runtime-camera-patch');
        emit({nodeId, type: 'runtime-camera-patch'});
        return deepFreeze(clonePortable(next));
    };

    const patchPersistentCamera = (nodeId, patch, mutationOptions = {}) => {
        const node = runtimeNodeModel.getNodeSnapshot(nodeId);
        const component = getCameraComponent(node);
        if (!node || !component) {
            const error = new Error(`Camera2D component not found for node: ${nodeId}`);
            error.code = 'NGVGE_CAMERA2D_COMPONENT_NOT_FOUND';
            throw error;
        }
        const next = applyCamera2DPatch(component.data, patch);
        runtimeNodeModel.setComponentData(nodeId, component.id, next, {
            transactionId: mutationOptions.transactionId || `camera2d:persistent-patch:${nodeId}`
        });
        runtimeConfigs.set(nodeId, next);
        refreshViewport('persistent-camera-patch');
        emit({componentId: component.id, nodeId, type: 'persistent-camera-patch'});
        return deepFreeze(clonePortable(next));
    };

    const patchRuntimeTransform = (nodeId, patch) => {
        const node = runtimeNodeModel.getNodeSnapshot(nodeId);
        if (!node || !getCameraComponent(node)) {
            const error = new Error(`Camera2D component not found for node: ${nodeId}`);
            error.code = 'NGVGE_CAMERA2D_COMPONENT_NOT_FOUND';
            throw error;
        }
        const snapshot = transformRuntimeStore.patchRuntimeTransform(nodeId, patch);
        refreshViewport('runtime-transform-patch');
        emit({nodeId, type: 'runtime-transform-patch'});
        return snapshot && snapshot.transform ? clonePortable(snapshot.transform) :
            clonePortable(transformRuntimeStore.getRuntimeTransform(nodeId));
    };

    const resetRuntimeState = nodeId => {
        if (nodeId) {
            hydrateNode(nodeId);
            if (typeof transformRuntimeStore.hydrateNodeFromPersistent === 'function') {
                try { transformRuntimeStore.hydrateNodeFromPersistent(nodeId); } catch { /* no transform */ }
            }
        } else {
            hydrateAll();
            listCameras().forEach(camera => {
                if (typeof transformRuntimeStore.hydrateNodeFromPersistent === 'function') {
                    try { transformRuntimeStore.hydrateNodeFromPersistent(camera.nodeId); } catch { /* no transform */ }
                }
            });
        }
        refreshViewport('runtime-reset');
    };

    const worldToScreen = point => {
        const state = viewportState || refreshViewport('coordinate-query');
        const x = Number(point && point[0]) || 0;
        const y = Number(point && point[1]) || 0;
        const cx = state.position[0] + state.offset[0];
        const cy = state.position[1] + state.offset[1];
        const dx = x - cx;
        const dy = y - cy;
        const radians = -state.rotation * Math.PI / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        return [
            (dx * cos - dy * sin) * state.zoom[0],
            (dx * sin + dy * cos) * state.zoom[1]
        ];
    };

    const screenToWorld = point => {
        const state = viewportState || refreshViewport('coordinate-query');
        const x = (Number(point && point[0]) || 0) / state.zoom[0];
        const y = (Number(point && point[1]) || 0) / state.zoom[1];
        const radians = state.rotation * Math.PI / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        const cx = state.position[0] + state.offset[0];
        const cy = state.position[1] + state.offset[1];
        return [
            x * cos - y * sin + cx,
            x * sin + y * cos + cy
        ];
    };

    hydrateAll();
    viewportState = buildViewportState(chooseActiveCamera(sceneRuntime.getActiveSceneId()));
    renderAdapter.applyViewport(viewportState);

    unsubscribeNodes = runtimeNodeModel.subscribe(change => {
        if (!change || typeof change !== 'object') return;
        if (change.type === 'runtime:replaced') hydrateAll();
        if (change.type === 'node:destroy' && change.nodeId) runtimeConfigs.delete(change.nodeId);
        if (change.componentTypeId === CAMERA2D_TYPE_ID && change.nodeId) {
            if (change.type === 'component:remove') runtimeConfigs.delete(change.nodeId);
            else hydrateNode(change.nodeId);
        }
        refreshViewport('runtime-node-change');
    });
    unsubscribeTransform = transformRuntimeStore.subscribe(change => {
        if (!change || !change.nodeId) return;
        if (!getCameraComponent(runtimeNodeModel.getNodeSnapshot(change.nodeId))) return;
        refreshViewport('transform-change');
    });
    if (typeof sceneRuntime.subscribe === 'function') {
        unsubscribeScene = sceneRuntime.subscribe(change => {
            if (!change || typeof change !== 'object') return;
            refreshViewport('scene-change');
        });
    }
    if (scratchRuntime && typeof scratchRuntime.on === 'function' && typeof scratchRuntime.removeListener === 'function') {
        const resetForRunBoundary = () => resetRuntimeState();
        scratchRuntime.on('PROJECT_START', resetForRunBoundary);
        scratchRuntime.on('PROJECT_STOP_ALL', resetForRunBoundary);
        detachRuntimeLifecycle = () => {
            scratchRuntime.removeListener('PROJECT_START', resetForRunBoundary);
            scratchRuntime.removeListener('PROJECT_STOP_ALL', resetForRunBoundary);
        };
    }

    return Object.freeze({
        capabilityId: CAMERA2D_RUNTIME_CAPABILITY_ID,
        version: CAMERA2D_RUNTIME_CAPABILITY_VERSION,
        dispose: () => {
            if (disposed) return;
            disposed = true;
            unsubscribeNodes();
            unsubscribeTransform();
            unsubscribeScene();
            detachRuntimeLifecycle();
            listeners.clear();
            runtimeConfigs.clear();
            renderAdapter.applyViewport(null);
        },
        getActiveCamera: () => chooseActiveCamera(sceneRuntime.getActiveSceneId()),
        getCamera: nodeId => buildCameraView(runtimeNodeModel.getNodeSnapshot(nodeId)),
        getPersistentCamera: nodeId => {
            const node = runtimeNodeModel.getNodeSnapshot(nodeId);
            const component = getCameraComponent(node);
            return component ? normalizeCamera2D(component.data) : null;
        },
        getStatus: () => deepFreeze({
            activeCameraNodeId: viewportState ? viewportState.activeCameraNodeId : null,
            cameraCount: runtimeConfigs.size,
            disposed,
            revision
        }),
        getViewportState: () => viewportState || refreshViewport('status-query'),
        listCameras,
        patchPersistentCamera,
        patchRuntimeCamera,
        patchRuntimeTransform,
        refreshViewport,
        resetRuntimeState,
        screenToWorld,
        subscribe: listener => {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        worldToScreen
    });
};

module.exports = {
    CAMERA2D_RUNTIME_CAPABILITY_ID,
    CAMERA2D_RUNTIME_CAPABILITY_VERSION,
    CAMERA2D_RUNTIME_COMPONENT_DESCRIPTOR,
    createCamera2DComponentOptions,
    createCamera2DRuntimeService,
    registerCamera2DComponent
};
