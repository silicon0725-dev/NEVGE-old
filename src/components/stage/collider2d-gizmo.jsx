import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';

import {PROTOCOL_DTO_KINDS} from '../../core/protocol';
import {materializePortableCapabilityValue} from '../../lib/first-party-modules/materialize-portable-capability-value';
import {CAMERA2D_RUNTIME_CAPABILITY_ID} from '../../lib/camera-system';
import {
    COLLIDER2D_COMMAND_CAPABILITY_ID,
    COLLIDER2D_RUNTIME_CAPABILITY_ID,
    collisionFiltersMatch,
    convexPolygonsOverlap,
    createCollider2DEditorClient,
    transformColliderPoints
} from '../../lib/collision-system';
import {
    applyColliderShapeHandleDrag,
    getColliderGizmoPreferences,
    getEditorTransformPreview,
    getColliderShapeAuthoringHandles,
    getShapeBounds
} from '../../lib/editor-visualization';
import {createQualityFrameScheduler, getPerformanceQualityPreferences} from '../../lib/performance-quality';
import {FRAME_PROFILER_CATEGORY, getFrameTimeProfiler} from '../../lib/frame-profiler';
import {getTileMapEditorState} from '../../lib/tilemap-system';
import {createCameraWorldToStageProjector} from './stage-affine-projection';
import styles from './stage.css';

const getCapability = (vm, capabilityId) => {
    const manager = vm && vm.runtime && vm.runtime.ngvgeFirstPartyModules;
    if (!manager || typeof manager.getCapability !== 'function') return null;
    try {
        return manager.getCapability(capabilityId);
    } catch {
        return null;
    }
};

const RUNTIME_NODE_MODEL_CAPABILITY_ID = 'ngvge.runtime-node-model';

const requestPresentationFrame = callback => (
    typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function' ?
        window.requestAnimationFrame(callback) : setTimeout(callback, 0)
);
const cancelPresentationFrame = handle => {
    if (handle === null || typeof handle === 'undefined') return;
    if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(handle);
        return;
    }
    clearTimeout(handle);
};

const PASSIVE_DYNAMIC_DEBUG_MAX_HZ = 20;
const PASSIVE_DYNAMIC_DEBUG_MAX_AFFECTED = 8;

const isNodeDescendantOrSelf = (runtimeNodeModel, nodeId, ancestorNodeId) => {
    if (!runtimeNodeModel || !nodeId || !ancestorNodeId) return false;
    let currentId = nodeId;
    const visited = new Set();
    for (let depth = 0; depth < 64 && currentId; depth++) {
        if (currentId === ancestorNodeId) return true;
        if (visited.has(currentId)) return false;
        visited.add(currentId);
        try {
            const parent = typeof runtimeNodeModel.getParent === 'function' ?
                materializePortableCapabilityValue(runtimeNodeModel.getParent(currentId)) : null;
            currentId = parent && parent.id ? parent.id : null;
        } catch {
            return false;
        }
    }
    return false;
};

const translateWorldPoints = (points, delta) => (
    !Array.isArray(points) || !Array.isArray(delta) ? points :
        points.map(point => [point[0] + delta[0], point[1] + delta[1]])
);

const translateAABB = (aabb, delta) => (
    !aabb || !Array.isArray(delta) ? aabb : {
        maxX: aabb.maxX + delta[0],
        maxY: aabb.maxY + delta[1],
        minX: aabb.minX + delta[0],
        minY: aabb.minY + delta[1]
    }
);

const unionAABB = (first, second) => ({
    maxX: Math.max(first.maxX, second.maxX),
    maxY: Math.max(first.maxY, second.maxY),
    minX: Math.min(first.minX, second.minX),
    minY: Math.min(first.minY, second.minY)
});

const aabbFromPoints = points => points.reduce((bounds, point) => ({
    maxX: Math.max(bounds.maxX, point[0]),
    maxY: Math.max(bounds.maxY, point[1]),
    minX: Math.min(bounds.minX, point[0]),
    minY: Math.min(bounds.minY, point[1])
}), {maxX: -Infinity, maxY: -Infinity, minX: Infinity, minY: Infinity});

const aabbIntersects = (a, b) => Boolean(a && b && !(
    a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY
));

const AUTHORING_IDENTITY_TRANSFORM = Object.freeze({
    position: Object.freeze([0, 0]),
    rotation: 0,
    scale: Object.freeze([1, 1])
});

const createFastAuthoringGizmo = (drag, config) => {
    if (!drag || !drag.baseGizmo || !config || typeof drag.nodeToWorld !== 'function') return null;
    const nodePoints = transformColliderPoints(config, AUTHORING_IDENTITY_TRANSFORM);
    const worldPoints = nodePoints.map(drag.nodeToWorld);
    if (!worldPoints.length) return null;
    return Object.assign({}, drag.baseGizmo, {
        config,
        worldAABB: aabbFromPoints(worldPoints),
        worldOrigin: drag.nodeToWorld([0, 0]),
        worldPoints
    });
};

const setSvgNumber = (element, name, value) => {
    if (!element || typeof element.setAttribute !== 'function') return;
    element.setAttribute(name, String(Number(value) || 0));
};

const applyFastAuthoringPresentation = (group, gizmo, toStagePoint, nodeToWorld, transformPreview) => {
    if (!group || typeof group.querySelector !== 'function' || !gizmo || !gizmo.config ||
        !Array.isArray(gizmo.worldPoints) || typeof toStagePoint !== 'function' || typeof nodeToWorld !== 'function') {
        return false;
    }
    const stagePoints = gizmo.worldPoints.map(toStagePoint);
    if (!stagePoints.length) return false;
    const center = centroid(stagePoints);
    const polygon = group.querySelector('[data-ngvge-collider-selected="true"]');
    if (!polygon || typeof polygon.setAttribute !== 'function') return false;
    polygon.setAttribute('points', stagePoints.map(point => `${point[0]},${point[1]}`).join(' '));

    const handles = getColliderShapeAuthoringHandles(gizmo.config).map(handle => {
        const rotated = rotatePointDegrees(handle.point, gizmo.config.rotation);
        const offset = Array.isArray(gizmo.config.offset) ? gizmo.config.offset : [0, 0];
        const nodePoint = [rotated[0] + offset[0], rotated[1] + offset[1]];
        let worldPoint = nodeToWorld(nodePoint);
        if (worldPoint && gizmo.previewed && transformPreview) {
            const previewSnapshot = transformPreview.getSnapshot();
            if (previewSnapshot && Array.isArray(previewSnapshot.delta)) {
                worldPoint = [
                    worldPoint[0] + previewSnapshot.delta[0],
                    worldPoint[1] + previewSnapshot.delta[1]
                ];
            }
        }
        return worldPoint ? Object.assign({}, handle, {stagePoint: toStagePoint(worldPoint)}) : null;
    }).filter(Boolean);
    const rotationHandle = handles.find(handle => handle.kind === 'rotation');
    const offsetHandle = handles.find(handle => handle.kind === 'offset');
    const authoringCenter = offsetHandle ? offsetHandle.stagePoint : center;

    handles.forEach(handle => {
        const element = group.querySelector(`[data-ngvge-collider-handle="${handle.id}"]`);
        if (!element) return;
        setSvgNumber(element, 'cx', handle.stagePoint[0]);
        setSvgNumber(element, 'cy', handle.stagePoint[1]);
    });

    const rotationArm = group.querySelector('[data-ngvge-collider-rotation-arm="true"]');
    if (rotationArm && rotationHandle) {
        setSvgNumber(rotationArm, 'x1', authoringCenter[0]);
        setSvgNumber(rotationArm, 'x2', rotationHandle.stagePoint[0]);
        setSvgNumber(rotationArm, 'y1', authoringCenter[1]);
        setSvgNumber(rotationArm, 'y2', rotationHandle.stagePoint[1]);
    }

    const centerHorizontal = group.querySelector('[data-ngvge-collider-center-axis="horizontal"]');
    if (centerHorizontal) {
        setSvgNumber(centerHorizontal, 'x1', authoringCenter[0] - 5);
        setSvgNumber(centerHorizontal, 'x2', authoringCenter[0] + 5);
        setSvgNumber(centerHorizontal, 'y1', authoringCenter[1]);
        setSvgNumber(centerHorizontal, 'y2', authoringCenter[1]);
    }
    const centerVertical = group.querySelector('[data-ngvge-collider-center-axis="vertical"]');
    if (centerVertical) {
        setSvgNumber(centerVertical, 'x1', authoringCenter[0]);
        setSvgNumber(centerVertical, 'x2', authoringCenter[0]);
        setSvgNumber(centerVertical, 'y1', authoringCenter[1] - 5);
        setSvgNumber(centerVertical, 'y2', authoringCenter[1] + 5);
    }

    const label = group.querySelector(`[data-ngvge-collider-label="${gizmo.nodeId}"]`);
    if (label) {
        setSvgNumber(label, 'x', center[0] + 7);
        setSvgNumber(label, 'y', center[1] - 7);
        label.textContent = gizmo.overlapping ?
            `${gizmo.name || gizmo.nodeId} · COLLISION` :
            `${gizmo.name || gizmo.nodeId} · ${shapeSummary(gizmo.config)}`;
    }
    return true;
};

const centroid = points => {
    if (!Array.isArray(points) || !points.length) return [0, 0];
    const total = points.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0]);
    return [total[0] / points.length, total[1] / points.length];
};

const getSensorState = collider => (
    typeof collider.sensor === 'boolean' ? collider.sensor : Boolean(collider.config && collider.config.sensor)
);

const gizmoKey = collider => collider && (collider.projectionId || collider.componentId || collider.nodeId);

const isTransientColliderAuthoringEvent = change => Boolean(change && (
    change.type === 'authoring-preview-begin' ||
    change.type === 'authoring-preview-patch' ||
    change.type === 'authoring-preview-cancel'
));

const shapeSummary = config => {
    if (!config || !config.shape) return '';
    const bounds = getShapeBounds(config.shape);
    return `${config.shape.type} · ${Number(bounds.width.toFixed(2))} × ${Number(bounds.height.toFixed(2))}`;
};

const rotatePointDegrees = (point, degrees) => {
    const radians = Number(degrees || 0) * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return [point[0] * cos - point[1] * sin, point[0] * sin + point[1] * cos];
};

const nodePointToShapeLocal = (nodePoint, config) => {
    if (!Array.isArray(nodePoint) || !config) return null;
    const offset = Array.isArray(config.offset) ? config.offset : [0, 0];
    return rotatePointDegrees([nodePoint[0] - offset[0], nodePoint[1] - offset[1]], -Number(config.rotation || 0));
};

const createWorldToNodeProjector = (colliderRuntime, nodeId) => {
    if (!colliderRuntime || typeof colliderRuntime.worldPointToNodeLocal !== 'function') return null;
    const sample = point => materializePortableCapabilityValue(colliderRuntime.worldPointToNodeLocal(nodeId, point));
    const origin = sample([0, 0]);
    const basisX = sample([1, 0]);
    const basisY = sample([0, 1]);
    if (![origin, basisX, basisY].every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))) {
        return null;
    }
    const dx = [basisX[0] - origin[0], basisX[1] - origin[1]];
    const dy = [basisY[0] - origin[0], basisY[1] - origin[1]];
    return point => [origin[0] + dx[0] * point[0] + dy[0] * point[1], origin[1] + dx[1] * point[0] + dy[1] * point[1]];
};

const createNodeToWorldProjector = (colliderRuntime, nodeId) => {
    if (!colliderRuntime || typeof colliderRuntime.nodeLocalPointToWorld !== 'function') return null;
    const sample = point => materializePortableCapabilityValue(colliderRuntime.nodeLocalPointToWorld(nodeId, point));
    const origin = sample([0, 0]);
    const basisX = sample([1, 0]);
    const basisY = sample([0, 1]);
    if (![origin, basisX, basisY].every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))) {
        return null;
    }
    const dx = [basisX[0] - origin[0], basisX[1] - origin[1]];
    const dy = [basisY[0] - origin[0], basisY[1] - origin[1]];
    return point => [origin[0] + dx[0] * point[0] + dy[0] * point[1], origin[1] + dx[1] * point[0] + dy[1] * point[1]];
};

const drawColliderCanvas = (canvas, gizmos, toStagePoint, width, height, canvasScale = 1) => {
    if (!canvas || typeof canvas.getContext !== 'function') return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const deviceDpr = typeof window !== 'undefined' ? Math.max(1, window.devicePixelRatio || 1) : 1;
    const dpr = Math.max(0.25, deviceDpr * Math.max(0.25, Math.min(1, Number(canvasScale) || 1)));
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    const groups = new Map();
    gizmos.forEach(gizmo => {
        const key = `${gizmo.overlapping ? 'overlap' : 'normal'}:${getSensorState(gizmo) ? 'sensor' : 'solid'}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(gizmo);
    });

    groups.forEach((group, key) => {
        const overlapping = key.startsWith('overlap:');
        const sensor = key.endsWith(':sensor');
        context.beginPath();
        group.forEach(gizmo => {
            const points = gizmo.worldPoints.map(toStagePoint);
            if (!points.length) return;
            context.moveTo(points[0][0], points[0][1]);
            for (let index = 1; index < points.length; index++) context.lineTo(points[index][0], points[index][1]);
            context.closePath();
        });
        context.fillStyle = overlapping ? 'rgba(255,82,82,0.20)' : 'rgba(38,198,218,0.12)';
        context.strokeStyle = overlapping ? 'rgba(255,82,82,1)' : 'rgba(0,229,255,0.96)';
        context.lineWidth = 2.25;
        context.globalAlpha = 0.92;
        context.setLineDash(sensor ? [6, 4] : []);
        context.fill();
        context.stroke();
    });
    context.globalAlpha = 1;
    context.setLineDash([]);
};

const Collider2DGizmo = ({nodeId, stageDimensions, vm}) => {
    const [colliderRevision, setColliderRevision] = React.useState(0);
    const [cameraRevision, setCameraRevision] = React.useState(0);
    const [presentationRevision, setPresentationRevision] = React.useState(0);
    const [authoringError, setAuthoringError] = React.useState(null);
    const [authoringPreviewGizmo, setAuthoringPreviewGizmo] = React.useState(null);
    const dragState = React.useRef(null);
    const pendingPointerMove = React.useRef(null);
    const pointerMoveFrame = React.useRef(null);
    const selectedGroupRefs = React.useRef(new Map());
    const selectedNodeGroupRef = React.useRef(null);
    const passiveSelectedFrame = React.useRef(null);
    const passiveSelectedRefreshHandler = React.useRef(null);
    const passiveDynamicRefreshHandler = React.useRef(null);
    const renderedDebugGizmosRef = React.useRef([]);
    const canvasRef = React.useRef(null);
    const colliderRuntime = getCapability(vm, COLLIDER2D_RUNTIME_CAPABILITY_ID);
    const colliderCommand = getCapability(vm, COLLIDER2D_COMMAND_CAPABILITY_ID);
    const cameraRuntime = getCapability(vm, CAMERA2D_RUNTIME_CAPABILITY_ID);
    const runtimeNodeModel = getCapability(vm, RUNTIME_NODE_MODEL_CAPABILITY_ID);
    const colliderEditorClient = React.useMemo(() => {
        if (!colliderCommand) return null;
        try { return createCollider2DEditorClient(colliderCommand); } catch { return null; }
    }, [colliderCommand]);
    const runtime = vm && vm.runtime;
    const gizmoPreferences = React.useMemo(() => (
        runtime ? getColliderGizmoPreferences(runtime) : null
    ), [runtime]);
    const performancePreferences = React.useMemo(() => (
        runtime ? getPerformanceQualityPreferences(runtime) : null
    ), [runtime]);
    const frameProfiler = React.useMemo(() => runtime ? getFrameTimeProfiler(runtime) : null, [runtime]);
    const transformPreview = React.useMemo(() => (
        runtime ? getEditorTransformPreview(runtime) : null
    ), [runtime]);
    const tileMapEditorState = React.useMemo(() => (runtime ? getTileMapEditorState(runtime) : null), [runtime]);

    React.useEffect(() => {
        const unsubscribers = [];
        let colliderDirty = false;
        let cameraDirty = false;
        let presentationDirty = false;
        const flushRefresh = () => {
            if (colliderDirty) setColliderRevision(value => value + 1);
            if (cameraDirty) setCameraRevision(value => value + 1);
            if (presentationDirty) setPresentationRevision(value => value + 1);
            colliderDirty = false;
            cameraDirty = false;
            presentationDirty = false;
        };
        const frameScheduler = createQualityFrameScheduler({
            getHz: () => performancePreferences ? performancePreferences.getRenderSettings().maxRefreshHz : 60,
            onFlush: flushRefresh
        });
        const schedule = kind => {
            if (kind === 'camera') cameraDirty = true;
            else if (kind === 'collider') colliderDirty = true;
            else {
                presentationDirty = true;
                flushRefresh();
                return;
            }
            frameScheduler.schedule();
        };
        if (colliderRuntime && typeof colliderRuntime.subscribe === 'function') {
            unsubscribers.push(colliderRuntime.subscribe(change => {
                // Selected Collider2D authoring preview is rendered from the local fast-path snapshot below.
                // Do not invalidate/rebuild the full world Collider debug snapshot for every drag frame.
                if (isTransientColliderAuthoringEvent(change)) return;
                // HF14.4: a physics-driven transform refresh that affects only the selected collider can
                // update the existing SVG group directly. This keeps passive selection out of the parent
                // React/debug-snapshot reconciliation path while preserving full refresh for topology,
                // overlap-state, multi-node, camera and preference changes.
                // HF14.10: one transform refresh can affect both the selected Collider and additional
                // non-selected Colliders. Route the selected member to the direct DOM path and the remaining
                // members to the sampled Canvas path. Only fall back when one required branch cannot safely
                // consume its share of the affected set.
                const affectedColliderNodeIds = change && Array.isArray(change.affectedColliderNodeIds) ?
                    Array.from(new Set(change.affectedColliderNodeIds.filter(Boolean))) : [];
                const selectedAffected = Boolean(nodeId && affectedColliderNodeIds.includes(nodeId));
                const dynamicAffected = affectedColliderNodeIds.filter(affectedNodeId => affectedNodeId !== nodeId);
                const selectedHandled = passiveSelectedRefreshHandler.current ?
                    passiveSelectedRefreshHandler.current(change) : false;
                const dynamicHandled = passiveDynamicRefreshHandler.current ?
                    passiveDynamicRefreshHandler.current(change) : false;
                if (affectedColliderNodeIds.length) {
                    const selectedBranchHandled = !selectedAffected || selectedHandled;
                    const dynamicBranchHandled = !dynamicAffected.length || dynamicHandled;
                    if (selectedBranchHandled && dynamicBranchHandled) {
                        if (frameProfiler && frameProfiler.isEnabled() && selectedAffected && dynamicAffected.length) {
                            frameProfiler.count('colliderMixedAffectedSetFastPath', 1);
                        }
                        return;
                    }
                } else if (selectedHandled || dynamicHandled) {
                    return;
                }
                if (frameProfiler && frameProfiler.isEnabled() && change && change.type === 'collision:refresh') {
                    if (nodeId) frameProfiler.count('colliderSelectedAffectedSetMiss', 1);
                    frameProfiler.count('colliderDebugReactFallback', 1);
                }
                schedule('collider');
            }));
        }
        if (cameraRuntime && typeof cameraRuntime.subscribe === 'function') {
            unsubscribers.push(cameraRuntime.subscribe(() => schedule('camera')));
        }
        [gizmoPreferences, performancePreferences, transformPreview, tileMapEditorState].forEach(source => {
            if (source && typeof source.subscribe === 'function') unsubscribers.push(source.subscribe(() => schedule('presentation')));
        });
        return () => {
            unsubscribers.forEach(unsubscribe => typeof unsubscribe === 'function' && unsubscribe());
            frameScheduler.dispose();
        };
    }, [cameraRuntime, colliderRuntime, frameProfiler, gizmoPreferences, nodeId, performancePreferences,
        tileMapEditorState, transformPreview]);

    React.useEffect(() => {
        dragState.current = null;
        setAuthoringError(null);
        setAuthoringPreviewGizmo(null);
    }, [nodeId]);

    const renderer = vm && vm.renderer;
    const nativeSize = renderer && typeof renderer.getNativeSize === 'function' ? renderer.getNativeSize() : [480, 360];
    const nativeWidth = Number(nativeSize && nativeSize[0]) || 480;
    const nativeHeight = Number(nativeSize && nativeSize[1]) || 360;
    const width = Number(stageDimensions && stageDimensions.width) || nativeWidth;
    const height = Number(stageDimensions && stageDimensions.height) || nativeHeight;

    const toStagePoint = React.useMemo(() => createCameraWorldToStageProjector({
        cameraRuntime,
        height,
        materialize: materializePortableCapabilityValue,
        nativeHeight,
        nativeWidth,
        width
    }), [cameraRevision, cameraRuntime, height, nativeHeight, nativeWidth, width]);

    React.useEffect(() => {
        const cancelPending = () => {
            if (passiveSelectedFrame.current !== null) {
                cancelPresentationFrame(passiveSelectedFrame.current);
                passiveSelectedFrame.current = null;
            }
        };
        const schedulePassiveSelectedRefresh = change => {
            if (!nodeId || !colliderRuntime || dragState.current || !change || change.type !== 'collision:refresh') {
                return false;
            }
            const changedNodeIds = Array.isArray(change.changedNodeIds) ? change.changedNodeIds.filter(Boolean) : [];
            const affectedColliderNodeIds = Array.isArray(change.affectedColliderNodeIds) ?
                change.affectedColliderNodeIds.filter(Boolean) : [];
            // HF14.5: Collider Runtime now resolves transform ancestry into actual affected Collider nodes.
            // This makes the fast path work when a selected collider is moved through a parent RigidBody/
            // Transform2D rather than by a direct transform patch on the collider node itself.
            const selectedAffected = affectedColliderNodeIds.includes(nodeId);
            const legacySelectedOnly = !affectedColliderNodeIds.length &&
                changedNodeIds.length === 1 && changedNodeIds[0] === nodeId;
            if (!selectedAffected && !legacySelectedOnly) return false;
            if (frameProfiler && frameProfiler.isEnabled()) frameProfiler.count('colliderSelectedFastPathEligible', 1);
            if (gizmoPreferences && typeof gizmoPreferences.getShowOverlapState === 'function' &&
                gizmoPreferences.getShowOverlapState()) return false;
            if (passiveSelectedFrame.current !== null) {
                if (frameProfiler && frameProfiler.isEnabled()) frameProfiler.count('colliderSelectedPassiveCoalesced', 1);
                return true;
            }
            passiveSelectedFrame.current = requestPresentationFrame(() => {
                passiveSelectedFrame.current = null;
                if (dragState.current) return;
                const group = selectedNodeGroupRef.current;
                if (!group || !colliderRuntime || typeof colliderRuntime.getCollider !== 'function') {
                    if (frameProfiler && frameProfiler.isEnabled()) frameProfiler.count('colliderSelectedReactFallback', 1);
                    setColliderRevision(value => value + 1);
                    return;
                }
                const present = () => {
                    const gizmo = materializePortableCapabilityValue(colliderRuntime.getCollider(nodeId));
                    if (!gizmo || !gizmo.config || !Array.isArray(gizmo.worldPoints)) return false;
                    const nodeToWorld = createNodeToWorldProjector(colliderRuntime, nodeId);
                    if (!nodeToWorld) return false;
                    return applyFastAuthoringPresentation(group, gizmo, toStagePoint, nodeToWorld, transformPreview);
                };
                let applied = false;
                try {
                    applied = frameProfiler ? frameProfiler.measure(
                        FRAME_PROFILER_CATEGORY.COLLIDER_SELECTED_PRESENTATION,
                        present
                    ) : present();
                } catch {
                    applied = false;
                }
                if (applied) {
                    if (frameProfiler && frameProfiler.isEnabled()) frameProfiler.count('colliderSelectedDirectDom', 1);
                    return;
                }
                if (frameProfiler && frameProfiler.isEnabled()) frameProfiler.count('colliderSelectedReactFallback', 1);
                setColliderRevision(value => value + 1);
            });
            return true;
        };
        passiveSelectedRefreshHandler.current = schedulePassiveSelectedRefresh;
        return () => {
            passiveSelectedRefreshHandler.current = null;
            cancelPending();
        };
    }, [colliderRuntime, frameProfiler, gizmoPreferences, nodeId, toStagePoint, transformPreview]);

    const screenToWorld = React.useCallback(point => {
        if (cameraRuntime && typeof cameraRuntime.screenToWorld === 'function') {
            try { return materializePortableCapabilityValue(cameraRuntime.screenToWorld(point)); } catch { /* baseline below */ }
        }
        return point;
    }, [cameraRuntime]);

    const viewportWorldAABB = React.useMemo(() => aabbFromPoints([
        [-nativeWidth / 2, -nativeHeight / 2],
        [nativeWidth / 2, -nativeHeight / 2],
        [nativeWidth / 2, nativeHeight / 2],
        [-nativeWidth / 2, nativeHeight / 2]
    ].map(screenToWorld)), [cameraRevision, nativeHeight, nativeWidth, screenToWorld]);

    const gizmos = React.useMemo(() => {
        const computeGizmos = () => {
            if (!colliderRuntime) return [];
        const previewSnapshot = transformPreview ? transformPreview.getSnapshot() : null;
        const previewActive = Boolean(
            previewSnapshot && previewSnapshot.active && previewSnapshot.nodeId && Array.isArray(previewSnapshot.delta)
        );
        const showOverlapState = Boolean(gizmoPreferences && gizmoPreferences.getShowOverlapState &&
            gizmoPreferences.getShowOverlapState());
        const applyTransformPreview = collider => {
            if (!previewActive || !runtimeNodeModel || !collider) return Object.assign({}, collider, {previewed: false});
            const affected = isNodeDescendantOrSelf(runtimeNodeModel, collider.nodeId, previewSnapshot.nodeId);
            return affected ? Object.assign({}, collider, {
                previewed: true,
                worldAABB: translateAABB(collider.worldAABB, previewSnapshot.delta),
                worldOrigin: Array.isArray(collider.worldOrigin) ? [
                    collider.worldOrigin[0] + previewSnapshot.delta[0],
                    collider.worldOrigin[1] + previewSnapshot.delta[1]
                ] : collider.worldOrigin,
                worldPoints: translateWorldPoints(collider.worldPoints, previewSnapshot.delta)
            }) : Object.assign({}, collider, {previewed: false});
        };
        try {
            let queryAABB = viewportWorldAABB;
            if (previewActive) queryAABB = unionAABB(queryAABB, translateAABB(queryAABB, [
                -previewSnapshot.delta[0], -previewSnapshot.delta[1]
            ]));
            let listed = null;
            let snapshotHasOverlapState = false;
            if (typeof colliderRuntime.getDebugViewportSnapshot === 'function') {
                const debugSettings = performancePreferences ? performancePreferences.getDebugSettings() : {maxCollisionDebugShapes: 5000};
                const snapshot = materializePortableCapabilityValue(colliderRuntime.getDebugViewportSnapshot(queryAABB, {
                    includeOverlapState: showOverlapState,
                    maxColliders: debugSettings.maxCollisionDebugShapes
                }));
                if (snapshot && Array.isArray(snapshot.colliders)) {
                    listed = snapshot.colliders;
                    snapshotHasOverlapState = showOverlapState;
                }
            }
            if (!listed && typeof colliderRuntime.getDebugSnapshot === 'function') {
                const snapshot = materializePortableCapabilityValue(colliderRuntime.getDebugSnapshot(undefined, {
                    includeOverlapState: showOverlapState
                }));
                if (snapshot && Array.isArray(snapshot.colliders)) {
                    listed = snapshot.colliders;
                    snapshotHasOverlapState = showOverlapState;
                }
            }
            if (!listed && typeof colliderRuntime.listColliders === 'function') {
                listed = materializePortableCapabilityValue(colliderRuntime.listColliders());
            }
            if (!Array.isArray(listed)) return [];
            const projected = listed.filter(collider => (
                collider && Array.isArray(collider.worldPoints) && collider.worldPoints.length >= 3
            )).map(applyTransformPreview).filter(collider => {
                const bounds = collider.worldAABB || aabbFromPoints(collider.worldPoints);
                return aabbIntersects(bounds, viewportWorldAABB);
            });
            const tileMapCollisionVisible = !tileMapEditorState || tileMapEditorState.getState().collisionDebug !== false;
            const visible = projected.filter(collider => (
                (collider.sourceKind !== 'tilemap' || tileMapCollisionVisible) &&
                (!gizmoPreferences || gizmoPreferences.shouldShow(collider.nodeId, nodeId || null))
            ));
            if (previewActive && showOverlapState) {
                const overlapState = new Map(projected.map(collider => [gizmoKey(collider), false]));
                for (let leftIndex = 0; leftIndex < projected.length; leftIndex++) {
                    for (let rightIndex = leftIndex + 1; rightIndex < projected.length; rightIndex++) {
                        const left = projected[leftIndex];
                        const right = projected[rightIndex];
                        if (left.nodeId === right.nodeId || !collisionFiltersMatch(left.config, right.config)) continue;
                        if (!aabbIntersects(left.worldAABB, right.worldAABB)) continue;
                        if (!convexPolygonsOverlap(left.worldPoints, right.worldPoints)) continue;
                        overlapState.set(gizmoKey(left), true);
                        overlapState.set(gizmoKey(right), true);
                    }
                }
                return visible.map(collider => Object.assign({}, collider, {
                    overlapping: overlapState.get(gizmoKey(collider)) || false
                }));
            }
            if (snapshotHasOverlapState) return visible.map(collider => Object.assign({}, collider, {
                overlapping: Boolean(collider.overlapping)
            }));
            return visible.map(collider => Object.assign({}, collider, {overlapping: false}));
        } catch {
            return [];
        }
        };
        return frameProfiler ? frameProfiler.measure(FRAME_PROFILER_CATEGORY.COLLIDER_PREPARE, computeGizmos) : computeGizmos();
    }, [colliderRevision, colliderRuntime, frameProfiler, gizmoPreferences, nodeId, performancePreferences, presentationRevision,
        runtimeNodeModel, tileMapEditorState, transformPreview, viewportWorldAABB]);

    const renderQualitySettings = performancePreferences ? performancePreferences.getRenderSettings() : {canvasScale: 1};
    const debugQualitySettings = performancePreferences ? performancePreferences.getDebugSettings() : {maxCollisionDebugShapes: 5000};

    const isAuthoringSelected = React.useCallback(gizmo => Boolean(
        nodeId && gizmo.nodeId === nodeId && gizmo.authoring !== false && gizmo.sourceKind !== 'tilemap'
    ), [nodeId]);
    const selectedGizmos = React.useMemo(() => gizmos.filter(isAuthoringSelected).map(gizmo => (
        authoringPreviewGizmo && gizmo.nodeId === authoringPreviewGizmo.nodeId ? authoringPreviewGizmo : gizmo
    )), [authoringPreviewGizmo, gizmos, isAuthoringSelected]);
    const debugGizmos = React.useMemo(() => gizmos.filter(gizmo => !isAuthoringSelected(gizmo)), [gizmos, isAuthoringSelected]);
    const renderedDebugGizmos = React.useMemo(() => debugGizmos.slice(0, Math.max(0,
        Number(debugQualitySettings.maxCollisionDebugShapes) || 0
    )), [debugGizmos, debugQualitySettings.maxCollisionDebugShapes]);

    React.useEffect(() => {
        renderedDebugGizmosRef.current = renderedDebugGizmos;
    }, [renderedDebugGizmos]);

    React.useEffect(() => {
        const pendingAffected = new Set();
        const flushDynamicPresentation = () => {
            const affectedNodeIds = Array.from(pendingAffected);
            pendingAffected.clear();
            if (!affectedNodeIds.length || !colliderRuntime || typeof colliderRuntime.getCollider !== 'function') return;
            const present = () => {
                const affected = new Set(affectedNodeIds);
                let next = (renderedDebugGizmosRef.current || []).filter(gizmo => !affected.has(gizmo && gizmo.nodeId));
                affectedNodeIds.forEach(affectedNodeId => {
                    let collider = null;
                    try { collider = materializePortableCapabilityValue(colliderRuntime.getCollider(affectedNodeId)); }
                    catch { collider = null; }
                    if (!collider || collider.active === false || !Array.isArray(collider.worldPoints) || collider.worldPoints.length < 3) return;
                    if (nodeId && collider.nodeId === nodeId) return;
                    const bounds = collider.worldAABB || aabbFromPoints(collider.worldPoints);
                    if (!aabbIntersects(bounds, viewportWorldAABB)) return;
                    if (gizmoPreferences && typeof gizmoPreferences.shouldShow === 'function' &&
                        !gizmoPreferences.shouldShow(collider.nodeId, nodeId || null)) return;
                    next.push(Object.assign({}, collider, {overlapping: false}));
                });
                next = next.slice(0, Math.max(0, Number(debugQualitySettings.maxCollisionDebugShapes) || 0));
                renderedDebugGizmosRef.current = next;
                drawColliderCanvas(
                    canvasRef.current, next, toStagePoint, width, height, renderQualitySettings.canvasScale
                );
                return next.length;
            };
            if (frameProfiler) {
                frameProfiler.measure(FRAME_PROFILER_CATEGORY.COLLIDER_DYNAMIC_PRESENTATION, present);
                if (frameProfiler.isEnabled()) {
                    frameProfiler.count('colliderDynamicDebugFlushes', 1);
                    frameProfiler.count('colliderDynamicDebugAffectedColliders', affectedNodeIds.length);
                    frameProfiler.count('debugCollidersDynamic', renderedDebugGizmosRef.current.length);
                }
            } else {
                present();
            }
        };
        const scheduler = createQualityFrameScheduler({
            getHz: () => Math.min(
                PASSIVE_DYNAMIC_DEBUG_MAX_HZ,
                performancePreferences ? performancePreferences.getRenderSettings().maxRefreshHz : PASSIVE_DYNAMIC_DEBUG_MAX_HZ
            ),
            onFlush: flushDynamicPresentation
        });
        const scheduleDynamicRefresh = change => {
            if (!change || change.type !== 'collision:refresh' || change.reason !== 'transform-hierarchy-change') return false;
            if (dragState.current || !colliderRuntime || typeof colliderRuntime.getCollider !== 'function') return false;
            const allAffectedColliderNodeIds = Array.isArray(change.affectedColliderNodeIds) ?
                Array.from(new Set(change.affectedColliderNodeIds.filter(Boolean))) : [];
            const affectedColliderNodeIds = nodeId ?
                allAffectedColliderNodeIds.filter(affectedNodeId => affectedNodeId !== nodeId) : allAffectedColliderNodeIds;
            if (!affectedColliderNodeIds.length || affectedColliderNodeIds.length > PASSIVE_DYNAMIC_DEBUG_MAX_AFFECTED) return false;
            if (gizmoPreferences && typeof gizmoPreferences.getShowOverlapState === 'function' &&
                gizmoPreferences.getShowOverlapState()) return false;
            const previewSnapshot = transformPreview && typeof transformPreview.getSnapshot === 'function' ?
                transformPreview.getSnapshot() : null;
            if (previewSnapshot && previewSnapshot.active) return false;
            affectedColliderNodeIds.forEach(affectedNodeId => pendingAffected.add(affectedNodeId));
            if (frameProfiler && frameProfiler.isEnabled()) {
                frameProfiler.count('colliderDynamicDebugSignals', 1);
                frameProfiler.count('colliderDynamicDebugSignalAffectedColliders', affectedColliderNodeIds.length);
            }
            const scheduled = scheduler.schedule();
            if (!scheduled && frameProfiler && frameProfiler.isEnabled()) {
                frameProfiler.count('colliderDynamicDebugCoalescedSignals', 1);
            }
            return true;
        };
        passiveDynamicRefreshHandler.current = scheduleDynamicRefresh;
        return () => {
            passiveDynamicRefreshHandler.current = null;
            pendingAffected.clear();
            scheduler.dispose();
        };
    }, [colliderRuntime, debugQualitySettings.maxCollisionDebugShapes, frameProfiler, gizmoPreferences, height, nodeId,
        performancePreferences, renderQualitySettings.canvasScale, toStagePoint, transformPreview, viewportWorldAABB, width]);

    React.useEffect(() => {
        const draw = () => drawColliderCanvas(
            canvasRef.current, renderedDebugGizmos, toStagePoint, width, height, renderQualitySettings.canvasScale
        );
        if (frameProfiler) {
            frameProfiler.measure(FRAME_PROFILER_CATEGORY.COLLIDER_CANVAS, draw);
            if (frameProfiler.isEnabled()) frameProfiler.count('debugColliders', renderedDebugGizmos.length);
        } else {
            draw();
        }
    }, [frameProfiler, height, renderQualitySettings.canvasScale, renderedDebugGizmos, toStagePoint, width]);

    const pointerToWorld = (event, svg) => {
        if (!svg || typeof svg.getBoundingClientRect !== 'function') return null;
        const readLayout = () => svg.getBoundingClientRect();
        const rect = frameProfiler ?
            frameProfiler.measure(FRAME_PROFILER_CATEGORY.COLLIDER_POINTER_LAYOUT, readLayout) : readLayout();
        const rectWidth = Number(rect.width) || width;
        const rectHeight = Number(rect.height) || height;
        const stageX = ((Number(event.clientX) - Number(rect.left || 0)) / rectWidth) * width;
        const stageY = ((Number(event.clientY) - Number(rect.top || 0)) / rectHeight) * height;
        return screenToWorld([
            ((stageX - width / 2) / width) * nativeWidth,
            ((height / 2 - stageY) / height) * nativeHeight
        ]);
    };

    const commitAuthoringPatch = (drag, patch) => {
        if (!colliderEditorClient || !drag || !patch) return false;
        const execute = () => colliderEditorClient.patchComponent({
            componentId: drag.componentId,
            nodeId: drag.nodeId,
            patch
        });
        const result = frameProfiler ?
            frameProfiler.measure(FRAME_PROFILER_CATEGORY.COLLIDER_AUTHORING_COMMIT, execute) : execute();
        if (result && result.kind === PROTOCOL_DTO_KINDS.ERROR) {
            setAuthoringError(result.message || result.code || 'Collider2D edit was rejected.');
            return false;
        }
        setAuthoringError(null);
        return true;
    };

    const cancelQueuedHandleDrag = () => {
        if (pointerMoveFrame.current !== null && typeof window !== 'undefined' &&
            typeof window.cancelAnimationFrame === 'function') {
            window.cancelAnimationFrame(pointerMoveFrame.current);
        }
        pointerMoveFrame.current = null;
        pendingPointerMove.current = null;
    };

    const beginHandleDrag = (event, gizmo, handle) => {
        if (!colliderEditorClient || !colliderRuntime || !gizmo || !handle || !gizmo.config) return;
        event.preventDefault();
        event.stopPropagation();
        let currentConfig = materializePortableCapabilityValue(gizmo.config);
        try {
            if (typeof colliderRuntime.beginAuthoringPreview === 'function') {
                currentConfig = materializePortableCapabilityValue(colliderRuntime.beginAuthoringPreview(gizmo.nodeId)) || currentConfig;
            }
        } catch (error) {
            setAuthoringError(error && error.message ? error.message : String(error));
            return;
        }
        cancelQueuedHandleDrag();
        dragState.current = {
            baseGizmo: gizmo,
            componentId: gizmo.componentId,
            currentConfig,
            groupElement: selectedGroupRefs.current.get(gizmoKey(gizmo)) || null,
            handle,
            nodeId: gizmo.nodeId,
            nodeToWorld: createNodeToWorldProjector(colliderRuntime, gizmo.nodeId),
            pointerId: event.pointerId,
            worldToNode: createWorldToNodeProjector(colliderRuntime, gizmo.nodeId)
        };
        if (event.currentTarget && typeof event.currentTarget.setPointerCapture === 'function' &&
            typeof event.pointerId !== 'undefined') {
            try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* browser may already capture */ }
        }
    };

    const applyHandleDragSample = sample => {
        const drag = dragState.current;
        if (!drag || !colliderRuntime || !drag.currentConfig || !sample) return;
        if (typeof drag.pointerId !== 'undefined' && typeof sample.pointerId !== 'undefined' &&
            drag.pointerId !== sample.pointerId) return;
        const worldPoint = pointerToWorld(sample, sample.currentTarget);
        if (!worldPoint) return;
        try {
            const nodeLocal = drag.worldToNode ? drag.worldToNode(worldPoint) :
                (typeof colliderRuntime.worldPointToNodeLocal === 'function' ?
                    materializePortableCapabilityValue(colliderRuntime.worldPointToNodeLocal(drag.nodeId, worldPoint)) : null);
            const shapeLocal = nodePointToShapeLocal(nodeLocal, drag.currentConfig);
            if (!nodeLocal || !shapeLocal) return;
            const update = applyColliderShapeHandleDrag(drag.currentConfig, drag.handle, {nodeLocal, shapeLocal});
            if (!update.valid) {
                setAuthoringError(update.error || 'Collider2D handle edit is invalid.');
                return;
            }
            if (typeof colliderRuntime.patchAuthoringPreview === 'function') {
                const preview = () => materializePortableCapabilityValue(
                    colliderRuntime.patchAuthoringPreview(drag.nodeId, update.patch)
                );
                const next = frameProfiler ?
                    frameProfiler.measure(FRAME_PROFILER_CATEGORY.COLLIDER_AUTHORING_PREVIEW, preview) : preview();
                if (next) drag.currentConfig = next;
                const present = () => {
                    const presentation = createFastAuthoringGizmo(drag, drag.currentConfig);
                    if (!presentation) return;
                    const applied = applyFastAuthoringPresentation(
                        drag.groupElement,
                        presentation,
                        toStagePoint,
                        drag.nodeToWorld,
                        transformPreview
                    );
                    if (frameProfiler && frameProfiler.isEnabled()) {
                        frameProfiler.count(applied ?
                            'colliderPresentationDirectDom' : 'colliderPresentationReactFallback', 1);
                    }
                    // Non-DOM renderers (including unit tests) retain the React fallback. Real browser
                    // authoring stays out of the parent reconciliation path once the selected SVG group exists.
                    if (!applied) setAuthoringPreviewGizmo(presentation);
                };
                if (frameProfiler) {
                    frameProfiler.measure(FRAME_PROFILER_CATEGORY.COLLIDER_AUTHORING_PRESENTATION, present);
                } else {
                    present();
                }
            } else {
                drag.currentConfig = Object.assign({}, drag.currentConfig, update.patch);
            }
            if (frameProfiler && frameProfiler.isEnabled()) frameProfiler.count('colliderPointerFlushes', 1);
            setAuthoringError(null);
        } catch (error) {
            setAuthoringError(error && error.message ? error.message : String(error));
        }
    };

    const flushQueuedHandleDrag = () => {
        pointerMoveFrame.current = null;
        const sample = pendingPointerMove.current;
        pendingPointerMove.current = null;
        if (sample) applyHandleDragSample(sample);
    };

    const updateHandleDrag = event => {
        const drag = dragState.current;
        if (!drag || !colliderRuntime || !drag.currentConfig) return;
        if (typeof drag.pointerId !== 'undefined' && typeof event.pointerId !== 'undefined' &&
            drag.pointerId !== event.pointerId) return;
        pendingPointerMove.current = {
            clientX: Number(event.clientX),
            clientY: Number(event.clientY),
            currentTarget: event.currentTarget,
            pointerId: event.pointerId
        };
        if (frameProfiler && frameProfiler.isEnabled()) frameProfiler.count('colliderPointerSamples', 1);
        if (pointerMoveFrame.current !== null) return;
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            pointerMoveFrame.current = window.requestAnimationFrame(flushQueuedHandleDrag);
            return;
        }
        flushQueuedHandleDrag();
    };

    const finishHandleDrag = (event, commit) => {
        const drag = dragState.current;
        if (!drag) return;
        if (typeof drag.pointerId !== 'undefined' && typeof event.pointerId !== 'undefined' &&
            drag.pointerId !== event.pointerId) return;
        if (commit && pendingPointerMove.current) {
            if (pointerMoveFrame.current !== null && typeof window !== 'undefined' &&
                typeof window.cancelAnimationFrame === 'function') {
                window.cancelAnimationFrame(pointerMoveFrame.current);
            }
            pointerMoveFrame.current = null;
            const sample = pendingPointerMove.current;
            pendingPointerMove.current = null;
            applyHandleDragSample(sample);
        } else {
            cancelQueuedHandleDrag();
        }
        dragState.current = null;
        setAuthoringPreviewGizmo(null);
        if (!commit) {
            if (colliderRuntime && typeof colliderRuntime.cancelAuthoringPreview === 'function') {
                try { colliderRuntime.cancelAuthoringPreview(drag.nodeId); } catch { /* transient preview cancel is best effort */ }
            }
            if (drag.groupElement && drag.baseGizmo && drag.nodeToWorld) {
                applyFastAuthoringPresentation(
                    drag.groupElement,
                    drag.baseGizmo,
                    toStagePoint,
                    drag.nodeToWorld,
                    transformPreview
                );
            }
            return;
        }
        if (!commitAuthoringPatch(drag, drag.currentConfig) && colliderRuntime &&
            typeof colliderRuntime.cancelAuthoringPreview === 'function') {
            try { colliderRuntime.cancelAuthoringPreview(drag.nodeId); } catch { /* failed commit restores persistent geometry best effort */ }
        }
    };

    const endHandleDrag = event => finishHandleDrag(event, true);
    const cancelHandleDrag = event => finishHandleDrag(event, false);

    React.useEffect(() => () => cancelQueuedHandleDrag(), []);

    if (!gizmos.length && !authoringError) return null;

    return (
        <React.Fragment>
            {renderedDebugGizmos.length ? (
                <canvas
                    className={styles.colliderDebugCanvas}
                    data-ngvge-collider-debug-canvas="true"
                    data-ngvge-collider-debug-count={renderedDebugGizmos.length}
                    data-ngvge-collider-debug-total={debugGizmos.length}
                    data-ngvge-collider-debug-overlap-count={renderedDebugGizmos.filter(gizmo => gizmo.overlapping).length}
                    data-ngvge-collider-debug-overlap-state={gizmoPreferences && gizmoPreferences.getShowOverlapState &&
                        gizmoPreferences.getShowOverlapState() ? 'true' : 'false'}
                    data-ngvge-collider-debug-preview-count={renderedDebugGizmos.filter(gizmo => gizmo.previewed).length}
                    ref={canvasRef}
                />
            ) : null}
            {(selectedGizmos.length || authoringError) ? (
                <svg
                    className={styles.colliderGizmoOverlay}
                    data-ngvge-collider-overlay="true"
                    height={height}
                    role="presentation"
                    viewBox={`0 0 ${width} ${height}`}
                    width={width}
                    onPointerCancel={cancelHandleDrag}
                    onPointerMove={updateHandleDrag}
                    onPointerUp={endHandleDrag}
                >
                    {selectedGizmos.map(gizmo => {
                        const stagePoints = gizmo.worldPoints.map(toStagePoint);
                        const center = centroid(stagePoints);
                        const shapeLabel = gizmo.name || gizmo.nodeId;
                        const canAuthor = colliderEditorClient && colliderRuntime && gizmo.config &&
                            (typeof colliderRuntime.nodeLocalPointToWorld === 'function' ||
                                typeof colliderRuntime.shapeLocalPointToWorld === 'function');
                        const nodeToWorld = canAuthor ? createNodeToWorldProjector(colliderRuntime, gizmo.nodeId) : null;
                        const handles = canAuthor ? getColliderShapeAuthoringHandles(gizmo.config).map(handle => {
                            const rotated = rotatePointDegrees(handle.point, gizmo.config.rotation);
                            const offset = Array.isArray(gizmo.config.offset) ? gizmo.config.offset : [0, 0];
                            const nodePoint = [rotated[0] + offset[0], rotated[1] + offset[1]];
                            let worldPoint = nodeToWorld ? nodeToWorld(nodePoint) : materializePortableCapabilityValue(
                                colliderRuntime.shapeLocalPointToWorld(gizmo.nodeId, handle.point)
                            );
                            if (worldPoint && gizmo.previewed && transformPreview) {
                                const previewSnapshot = transformPreview.getSnapshot();
                                if (previewSnapshot && Array.isArray(previewSnapshot.delta)) {
                                    worldPoint = [
                                        worldPoint[0] + previewSnapshot.delta[0],
                                        worldPoint[1] + previewSnapshot.delta[1]
                                    ];
                                }
                            }
                            return worldPoint ? Object.assign({}, handle, {stagePoint: toStagePoint(worldPoint)}) : null;
                        }).filter(Boolean) : [];
                        const rotationHandle = handles.find(handle => handle.kind === 'rotation');
                        const offsetHandle = handles.find(handle => handle.kind === 'offset');
                        const authoringCenter = offsetHandle ? offsetHandle.stagePoint : center;
                        return (
                            <g
                                data-ngvge-collider-group={gizmo.nodeId}
                                data-ngvge-collider-overlapping={gizmo.overlapping ? 'true' : 'false'}
                                key={gizmoKey(gizmo)}
                                ref={element => {
                                    const key = gizmoKey(gizmo);
                                    if (element) selectedGroupRefs.current.set(key, element);
                                    else selectedGroupRefs.current.delete(key);
                                    if (gizmo.nodeId === nodeId) selectedNodeGroupRef.current = element || null;
                                }}
                            >
                                <polygon
                                    className={classNames(styles.colliderGizmoShape, {
                                        [styles.colliderGizmoOverlapping]: gizmo.overlapping,
                                        [styles.colliderGizmoSelected]: true,
                                        [styles.colliderGizmoSensor]: getSensorState(gizmo)
                                    })}
                                    data-ngvge-collider-node-id={gizmo.nodeId}
                                    data-ngvge-collider-selected="true"
                                    data-ngvge-collider-transform-preview={gizmo.previewed ? 'true' : 'false'}
                                    points={stagePoints.map(point => `${point[0]},${point[1]}`).join(' ')}
                                />
                                {rotationHandle ? (
                                    <line
                                        className={styles.colliderGizmoRotationArm}
                                        data-ngvge-collider-rotation-arm="true"
                                        x1={authoringCenter[0]}
                                        x2={rotationHandle.stagePoint[0]}
                                        y1={authoringCenter[1]}
                                        y2={rotationHandle.stagePoint[1]}
                                    />
                                ) : null}
                                {handles.map(handle => (
                                    <circle
                                        className={classNames(styles.colliderGizmoHandle, {
                                            [styles.colliderGizmoOffsetHandle]: handle.kind === 'offset',
                                            [styles.colliderGizmoRotationHandle]: handle.kind === 'rotation',
                                            [styles.colliderGizmoVertexHandle]: handle.kind === 'polygon-vertex'
                                        })}
                                        cx={handle.stagePoint[0]}
                                        cy={handle.stagePoint[1]}
                                        data-ngvge-collider-handle={handle.id}
                                        data-ngvge-collider-handle-kind={handle.kind}
                                        key={`${gizmo.nodeId}:handle:${handle.id}`}
                                        r={handle.kind === 'offset' ? 5 : 4}
                                        style={{cursor: handle.cursor}}
                                        onPointerDown={event => beginHandleDrag(event, gizmo, handle)}
                                    />
                                ))}
                                <line
                                    className={styles.colliderGizmoCenterMark}
                                    data-ngvge-collider-center-axis="horizontal"
                                    x1={authoringCenter[0] - 5}
                                    x2={authoringCenter[0] + 5}
                                    y1={authoringCenter[1]}
                                    y2={authoringCenter[1]}
                                />
                                <line
                                    className={styles.colliderGizmoCenterMark}
                                    data-ngvge-collider-center-axis="vertical"
                                    x1={authoringCenter[0]}
                                    x2={authoringCenter[0]}
                                    y1={authoringCenter[1] - 5}
                                    y2={authoringCenter[1] + 5}
                                />
                                <text
                                    className={classNames(styles.colliderGizmoLabel, {
                                        [styles.colliderGizmoLabelOverlapping]: gizmo.overlapping
                                    })}
                                    data-ngvge-collider-label={gizmo.nodeId}
                                    x={center[0] + 7}
                                    y={center[1] - 7}
                                >
                                    {gizmo.overlapping ? `${shapeLabel} · COLLISION` : `${shapeLabel} · ${shapeSummary(gizmo.config)}`}
                                </text>
                            </g>
                        );
                    })}
                    {authoringError ? (
                        <text
                            className={styles.colliderGizmoAuthoringError}
                            data-ngvge-collider-authoring-error="true"
                            x="8"
                            y={height - 10}
                        >
                            {authoringError}
                        </text>
                    ) : null}
                </svg>
            ) : null}
        </React.Fragment>
    );
};

Collider2DGizmo.propTypes = {
    nodeId: PropTypes.string,
    stageDimensions: PropTypes.shape({
        height: PropTypes.number,
        width: PropTypes.number
    }),
    vm: PropTypes.object
};

export default Collider2DGizmo;
