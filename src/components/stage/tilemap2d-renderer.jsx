import PropTypes from 'prop-types';
import React from 'react';

import {ensureTileDefinition} from '../../core/tileset';
import {CAMERA2D_RUNTIME_CAPABILITY_ID} from '../../lib/camera-system';
import {materializePortableCapabilityValue} from '../../lib/first-party-modules/materialize-portable-capability-value';
import {createQualityFrameScheduler, getPerformanceQualityPreferences} from '../../lib/performance-quality';
import {FRAME_PROFILER_CATEGORY, getFrameTimeProfiler} from '../../lib/frame-profiler';
import {TILEMAP_LAYER2D_RUNTIME_CAPABILITY_ID, TILESET_RESOURCE_CAPABILITY_ID} from '../../lib/tilemap-system';
import {createCameraWorldToStageProjector} from './stage-affine-projection';
import styles from './stage.css';

const getCapability = (vm, id) => {
    const manager = vm && vm.runtime && vm.runtime.ngvgeFirstPartyModules;
    if (!manager || typeof manager.getCapability !== 'function') return null;
    try { return manager.getCapability(id); } catch { return null; }
};

const aabbFromPoints = points => points.reduce((bounds, point) => ({
    maxX: Math.max(bounds.maxX, point[0]),
    maxY: Math.max(bounds.maxY, point[1]),
    minX: Math.min(bounds.minX, point[0]),
    minY: Math.min(bounds.minY, point[1])
}), {maxX: -Infinity, maxY: -Infinity, minX: Infinity, minY: Infinity});

const aabbIntersects = (a, b) => Boolean(a && b && !(
    a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY
));

const TileMap2DRenderer = ({excludeNodeId, stageDimensions, vm}) => {
    const canvasRef = React.useRef(null);
    const imagesRef = React.useRef(new Map());
    const [layerRevision, setLayerRevision] = React.useState(0);
    const [cameraRevision, setCameraRevision] = React.useState(0);
    const [imageRevision, setImageRevision] = React.useState(0);
    const tileMapRuntime = getCapability(vm, TILEMAP_LAYER2D_RUNTIME_CAPABILITY_ID);
    const tileSetResources = getCapability(vm, TILESET_RESOURCE_CAPABILITY_ID);
    const cameraRuntime = getCapability(vm, CAMERA2D_RUNTIME_CAPABILITY_ID);
    const runtime = vm && vm.runtime;
    const performancePreferences = React.useMemo(() => (
        runtime ? getPerformanceQualityPreferences(runtime) : null
    ), [runtime]);
    const frameProfiler = React.useMemo(() => runtime ? getFrameTimeProfiler(runtime) : null, [runtime]);
    const [qualityRevision, setQualityRevision] = React.useState(0);
    const renderer = vm && vm.renderer;
    const nativeSize = renderer && typeof renderer.getNativeSize === 'function' ? renderer.getNativeSize() : [480, 360];
    const nativeWidth = Number(nativeSize && nativeSize[0]) || 480;
    const nativeHeight = Number(nativeSize && nativeSize[1]) || 360;
    const width = Number(stageDimensions && stageDimensions.width) || nativeWidth;
    const height = Number(stageDimensions && stageDimensions.height) || nativeHeight;

    React.useEffect(() => {
        const subscriptions = [];
        let layerDirty = false;
        let cameraDirty = false;
        const flush = () => {
            if (layerDirty) setLayerRevision(value => value + 1);
            if (cameraDirty) setCameraRevision(value => value + 1);
            layerDirty = false;
            cameraDirty = false;
        };
        const frameScheduler = createQualityFrameScheduler({
            getHz: () => performancePreferences ? performancePreferences.getRenderSettings().tileMapRefreshHz : 60,
            onFlush: flush
        });
        const schedule = kind => {
            if (kind === 'camera') cameraDirty = true;
            else layerDirty = true;
            frameScheduler.schedule();
        };
        [tileMapRuntime, tileSetResources].forEach(capability => {
            if (capability && typeof capability.subscribe === 'function') subscriptions.push(capability.subscribe(() => schedule('layer')));
        });
        if (cameraRuntime && typeof cameraRuntime.subscribe === 'function') {
            subscriptions.push(cameraRuntime.subscribe(() => schedule('camera')));
        }
        if (performancePreferences && typeof performancePreferences.subscribe === 'function') {
            subscriptions.push(performancePreferences.subscribe(() => {
                setQualityRevision(value => value + 1);
                schedule('camera');
            }));
        }
        return () => {
            subscriptions.forEach(unsubscribe => typeof unsubscribe === 'function' && unsubscribe());
            frameScheduler.dispose();
        };
    }, [cameraRuntime, performancePreferences, tileMapRuntime, tileSetResources]);

    const layers = React.useMemo(() => {
        if (!tileMapRuntime || typeof tileMapRuntime.listLayers !== 'function') return [];
        try {
            const materialized = materializePortableCapabilityValue(tileMapRuntime.listLayers());
            return Array.isArray(materialized) ? materialized.filter(layer => (
                layer && layer.nodeId !== excludeNodeId && layer.config && layer.config.visible !== false
            )).sort((a, b) => (
                (a.config.zIndex || 0) - (b.config.zIndex || 0) || String(a.nodeId).localeCompare(String(b.nodeId))
            )) : [];
        } catch { return []; }
    }, [excludeNodeId, layerRevision, tileMapRuntime]);

    React.useEffect(() => {
        const database = runtime && runtime.ngvgeGlobalAssetDatabase;
        if (!database || typeof Image === 'undefined') return;
        const required = new Map();
        layers.forEach(layer => {
            const resourceId = layer.tileSet && layer.tileSet.data && layer.tileSet.data.textureResourceId;
            if (!resourceId || imagesRef.current.has(resourceId) || required.has(resourceId)) return;
            if (typeof database.getAssetIdForResourceId !== 'function' || typeof database.getDataURL !== 'function') return;
            const assetId = database.getAssetIdForResourceId(resourceId);
            const uri = assetId ? database.getDataURL(assetId) : null;
            if (uri) required.set(resourceId, uri);
        });
        let cancelled = false;
        required.forEach((uri, resourceId) => {
            const image = new Image();
            image.onload = () => {
                if (cancelled) return;
                imagesRef.current.set(resourceId, image);
                setImageRevision(value => value + 1);
            };
            image.onerror = () => {
                if (cancelled) return;
                imagesRef.current.set(resourceId, null);
                setImageRevision(value => value + 1);
            };
            image.src = uri;
        });
        return () => { cancelled = true; };
    }, [layers, runtime]);

    const worldToStage = React.useMemo(() => createCameraWorldToStageProjector({
        cameraRuntime,
        height,
        materialize: materializePortableCapabilityValue,
        nativeHeight,
        nativeWidth,
        width
    }), [cameraRevision, cameraRuntime, height, nativeHeight, nativeWidth, width]);

    const viewportWorldAABB = React.useMemo(() => {
        const screenToWorld = point => {
            if (cameraRuntime && typeof cameraRuntime.screenToWorld === 'function') {
                try { return materializePortableCapabilityValue(cameraRuntime.screenToWorld(point)); } catch { /* baseline */ }
            }
            return point;
        };
        return aabbFromPoints([
            [-nativeWidth / 2, -nativeHeight / 2],
            [nativeWidth / 2, -nativeHeight / 2],
            [nativeWidth / 2, nativeHeight / 2],
            [-nativeWidth / 2, nativeHeight / 2]
        ].map(screenToWorld));
    }, [cameraRevision, cameraRuntime, nativeHeight, nativeWidth]);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;
        const profiling = frameProfiler && frameProfiler.isEnabled();
        const profileStartedAt = profiling && typeof performance !== 'undefined' ? performance.now() : 0;
        let visibleTileCount = 0;
        const deviceDpr = typeof window !== 'undefined' ? Math.max(1, window.devicePixelRatio || 1) : 1;
        const renderSettings = performancePreferences ? performancePreferences.getRenderSettings() : {canvasScale: 1};
        const dpr = Math.max(0.25, deviceDpr * Math.max(0.25, Math.min(1, Number(renderSettings.canvasScale) || 1)));
        const pixelWidth = Math.max(1, Math.round(width * dpr));
        const pixelHeight = Math.max(1, Math.round(height * dpr));
        if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
        if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, width, height);

        layers.forEach(layer => {
            const tileSet = layer.tileSet && layer.tileSet.data;
            if (!tileSet) return;
            const tileSize = tileSet.tileSize || [32, 32];
            const atlas = tileSet.atlas || {margin: [0, 0], separation: [0, 0]};
            const textureId = tileSet.textureResourceId;
            const image = textureId ? imagesRef.current.get(textureId) : null;
            let instances = Array.isArray(layer.instances) ? layer.instances.filter(instance => (
                instance && Array.isArray(instance.worldCorners) && instance.worldCorners.length >= 4 &&
                aabbIntersects(aabbFromPoints(instance.worldCorners), viewportWorldAABB)
            )) : [];
            if (layer.config.ySortEnabled) {
                instances = instances.slice().sort((a, b) => a.cell.y - b.cell.y || a.cell.x - b.cell.x);
            }
            visibleTileCount += instances.length;
            instances.forEach(instance => {
                const cell = instance.cell;
                const corners = instance.worldCorners.map(worldToStage);
                const p0 = corners[0];
                const p1 = corners[1];
                const p3 = corners[3];
                if (image) {
                    const definition = ensureTileDefinition(tileSet, instance.tileId);
                    const sourceX = (atlas.margin[0] || 0) + definition.atlas[0] * (tileSize[0] + (atlas.separation[0] || 0));
                    const sourceY = (atlas.margin[1] || 0) + definition.atlas[1] * (tileSize[1] + (atlas.separation[1] || 0));
                    context.save();
                    context.setTransform(
                        dpr * ((p1[0] - p0[0]) / tileSize[0]), dpr * ((p1[1] - p0[1]) / tileSize[0]),
                        dpr * ((p3[0] - p0[0]) / tileSize[1]), dpr * ((p3[1] - p0[1]) / tileSize[1]),
                        dpr * p0[0], dpr * p0[1]
                    );
                    context.drawImage(image, sourceX, sourceY, tileSize[0], tileSize[1], 0, 0, tileSize[0], tileSize[1]);
                    context.restore();
                } else {
                    context.beginPath();
                    corners.forEach((point, index) => index ? context.lineTo(point[0], point[1]) : context.moveTo(point[0], point[1]));
                    context.closePath();
                    context.fillStyle = 'rgba(76,151,255,0.34)';
                    context.fill();
                }
                void cell;
            });
        });
        if (profiling && typeof performance !== 'undefined') {
            frameProfiler.recordDuration(FRAME_PROFILER_CATEGORY.TILEMAP_RENDER, performance.now() - profileStartedAt, 1);
            frameProfiler.count('visibleTiles', visibleTileCount);
        }
    }, [cameraRevision, frameProfiler, height, imageRevision, layers, performancePreferences, qualityRevision, viewportWorldAABB, width, worldToStage]);

    if (!tileMapRuntime) return null;
    return <canvas className={styles.tileMapRuntimeOverlay} data-ngvge-tilemap-runtime-renderer="true" ref={canvasRef} />;
};

TileMap2DRenderer.propTypes = {
    excludeNodeId: PropTypes.string,
    stageDimensions: PropTypes.shape({height: PropTypes.number, width: PropTypes.number}),
    vm: PropTypes.object
};
TileMap2DRenderer.defaultProps = {excludeNodeId: null, stageDimensions: null, vm: null};

export default TileMap2DRenderer;
