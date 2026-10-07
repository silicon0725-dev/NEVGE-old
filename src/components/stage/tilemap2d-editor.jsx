import PropTypes from 'prop-types';
import React from 'react';

import {PROTOCOL_DTO_KINDS} from '../../core/protocol';
import {ensureTileDefinition} from '../../core/tileset';
import {listTileMapCells, listTileMapCellsInBounds, setTileMapCell} from '../../core/tilemap-layer2d';
import {CAMERA2D_RUNTIME_CAPABILITY_ID} from '../../lib/camera-system';
import {materializePortableCapabilityValue} from '../../lib/first-party-modules/materialize-portable-capability-value';
import {
    TILEMAP_AUTHORING_TOOLS,
    TILEMAP_LAYER2D_COMMAND_CAPABILITY_ID,
    TILEMAP_LAYER2D_RUNTIME_CAPABILITY_ID,
    TILESET_RESOURCE_CAPABILITY_ID,
    applyEraseCells,
    applyPaintCells,
    createTileMapLayer2DEditorClient,
    deterministicVariantIndex,
    floodFillCells,
    getCellAt,
    getTileMapEditorState,
    lineCells,
    moveTileMapCells,
    rectangleCells
} from '../../lib/tilemap-system';
import TileMap2DToolbar from './tilemap2d-toolbar.jsx';
import {createCameraWorldToStageProjector, createNodeLocalToWorldProjector} from './stage-affine-projection';
import {createQualityFrameScheduler, getPerformanceQualityPreferences} from '../../lib/performance-quality';
import {FRAME_PROFILER_CATEGORY, getFrameTimeProfiler} from '../../lib/frame-profiler';
import styles from './stage.css';

const getCapability = (vm, capabilityId) => {
    const manager = vm && vm.runtime && vm.runtime.ngvgeFirstPartyModules;
    if (!manager || typeof manager.getCapability !== 'function') return null;
    try { return manager.getCapability(capabilityId); } catch { return null; }
};

const cellTemplateFromState = state => ({
    flipX: Boolean(state.flipX),
    flipY: Boolean(state.flipY),
    rotation: state.rotation || 0,
    tileId: state.activeTileId || 0,
    variant: 0
});

const selectionBounds = selection => {
    if (!selection || !Array.isArray(selection.from) || !Array.isArray(selection.to)) return null;
    return {
        maxX: Math.max(selection.from[0], selection.to[0]),
        maxY: Math.max(selection.from[1], selection.to[1]),
        minX: Math.min(selection.from[0], selection.to[0]),
        minY: Math.min(selection.from[1], selection.to[1])
    };
};

const cellInBounds = (cell, bounds) => Boolean(bounds && cell &&
    cell[0] >= bounds.minX && cell[0] <= bounds.maxX && cell[1] >= bounds.minY && cell[1] <= bounds.maxY);

const tileTerrainId = definition => definition && definition.terrain && typeof definition.terrain.terrainId === 'string' ?
    definition.terrain.terrainId : '';
const tileTerrainMask = definition => definition && definition.terrain ? Math.max(0, Math.min(15, Math.trunc(Number(definition.terrain.mask) || 0))) : 0;
const terrainMaskForCell = (layerValue, x, y, terrainId, definitionsById) => {
    const directions = [[0, 1, 1], [1, 0, 2], [0, -1, 4], [-1, 0, 8]];
    return directions.reduce((mask, [dx, dy, bit]) => {
        const neighbor = getCellAt(layerValue, x + dx, y + dy);
        const definition = neighbor ? definitionsById.get(neighbor.tileId) : null;
        return tileTerrainId(definition) === terrainId ? mask | bit : mask;
    }, 0);
};
const applyTerrainAutoconnect = (layerValue, changedCell, activeTileId, tileSetData, template) => {
    const activeDefinition = ensureTileDefinition(tileSetData, activeTileId);
    const terrainId = tileTerrainId(activeDefinition);
    if (!terrainId) return setTileMapCell(layerValue, changedCell[0], changedCell[1], template);
    const definitions = (tileSetData.tiles || []).filter(definition => tileTerrainId(definition) === terrainId);
    const definitionsById = new Map((tileSetData.tiles || []).map(definition => [definition.id, definition]));
    if (!definitions.length) definitions.push(activeDefinition);
    let next = setTileMapCell(layerValue, changedCell[0], changedCell[1], template);
    const candidates = [changedCell, [changedCell[0] + 1, changedCell[1]], [changedCell[0] - 1, changedCell[1]],
        [changedCell[0], changedCell[1] + 1], [changedCell[0], changedCell[1] - 1]];
    candidates.forEach(([x, y]) => {
        const existing = getCellAt(next, x, y);
        if (!existing) return;
        const existingDefinition = definitionsById.get(existing.tileId) || ensureTileDefinition(tileSetData, existing.tileId);
        if (tileTerrainId(existingDefinition) !== terrainId) return;
        const mask = terrainMaskForCell(next, x, y, terrainId, definitionsById);
        const match = definitions.find(definition => tileTerrainMask(definition) === mask) || existingDefinition;
        next = setTileMapCell(next, x, y, Object.assign({}, existing, {tileId: match.id}));
    });
    return next;
};

const TileMap2DEditor = ({nodeId, stageDimensions, vm}) => {
    const canvasRef = React.useRef(null);
    const gestureRef = React.useRef(null);
    const [layerRevision, setLayerRevision] = React.useState(0);
    const [cameraRevision, setCameraRevision] = React.useState(0);
    const [previewConfig, setPreviewConfig] = React.useState(null);
    const [image, setImage] = React.useState(null);
    const tileMapRuntime = getCapability(vm, TILEMAP_LAYER2D_RUNTIME_CAPABILITY_ID);
    const tileMapCommand = getCapability(vm, TILEMAP_LAYER2D_COMMAND_CAPABILITY_ID);
    const tileSetResources = getCapability(vm, TILESET_RESOURCE_CAPABILITY_ID);
    const cameraRuntime = getCapability(vm, CAMERA2D_RUNTIME_CAPABILITY_ID);
    const runtime = vm && vm.runtime;
    const performancePreferences = React.useMemo(() => (
        runtime ? getPerformanceQualityPreferences(runtime) : null
    ), [runtime]);
    const frameProfiler = React.useMemo(() => runtime ? getFrameTimeProfiler(runtime) : null, [runtime]);
    const [qualityRevision, setQualityRevision] = React.useState(0);
    const editorState = React.useMemo(() => (runtime ? getTileMapEditorState(runtime) : null), [runtime]);
    const [editorSnapshot, setEditorSnapshot] = React.useState(() => editorState ? editorState.getState() : null);
    const editorClient = React.useMemo(() => {
        if (!tileMapCommand) return null;
        try { return createTileMapLayer2DEditorClient(tileMapCommand); } catch { return null; }
    }, [tileMapCommand]);

    React.useEffect(() => {
        const unsubscribers = [];
        let layerDirty = false;
        let cameraDirty = false;
        const flush = () => {
            if (layerDirty) setLayerRevision(value => value + 1);
            if (cameraDirty) setCameraRevision(value => value + 1);
            layerDirty = false;
            cameraDirty = false;
        };
        const frameScheduler = createQualityFrameScheduler({
            getHz: () => performancePreferences ? performancePreferences.getRenderSettings().maxRefreshHz : 60,
            onFlush: flush
        });
        const schedule = kind => {
            if (kind === 'camera') cameraDirty = true;
            else layerDirty = true;
            frameScheduler.schedule();
        };
        [tileMapRuntime, tileSetResources].forEach(capability => {
            if (capability && typeof capability.subscribe === 'function') unsubscribers.push(capability.subscribe(() => schedule('layer')));
        });
        if (cameraRuntime && typeof cameraRuntime.subscribe === 'function') {
            unsubscribers.push(cameraRuntime.subscribe(() => schedule('camera')));
        }
        if (performancePreferences && typeof performancePreferences.subscribe === 'function') {
            unsubscribers.push(performancePreferences.subscribe(() => {
                setQualityRevision(value => value + 1);
                schedule('camera');
            }));
        }
        if (editorState) unsubscribers.push(editorState.subscribe(next => setEditorSnapshot(next)));
        return () => {
            unsubscribers.forEach(unsubscribe => typeof unsubscribe === 'function' && unsubscribe());
            frameScheduler.dispose();
        };
    }, [cameraRuntime, editorState, performancePreferences, tileMapRuntime, tileSetResources]);

    React.useEffect(() => {
        gestureRef.current = null;
        setPreviewConfig(null);
    }, [nodeId]);

    const layer = React.useMemo(() => {
        if (!tileMapRuntime || !nodeId || typeof tileMapRuntime.getLayer !== 'function') return null;
        try { return materializePortableCapabilityValue(tileMapRuntime.getLayer(nodeId)); } catch { return null; }
    }, [layerRevision, nodeId, tileMapRuntime]);

    const tileSet = layer && layer.tileSet ? layer.tileSet : null;
    const imageUri = React.useMemo(() => {
        const resourceId = tileSet && tileSet.data && tileSet.data.textureResourceId;
        const database = runtime && runtime.ngvgeGlobalAssetDatabase;
        if (!resourceId || !database || typeof database.getAssetIdForResourceId !== 'function' ||
            typeof database.getDataURL !== 'function') return null;
        const assetId = database.getAssetIdForResourceId(resourceId);
        return assetId ? database.getDataURL(assetId) : null;
    }, [runtime, tileSet]);

    React.useEffect(() => {
        if (!imageUri || typeof Image === 'undefined') {
            setImage(null);
            return () => {};
        }
        let cancelled = false;
        const nextImage = new Image();
        nextImage.onload = () => { if (!cancelled) setImage(nextImage); };
        nextImage.onerror = () => { if (!cancelled) setImage(null); };
        nextImage.src = imageUri;
        return () => { cancelled = true; };
    }, [imageUri]);

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
    const localToWorld = React.useMemo(() => createNodeLocalToWorldProjector({
        materialize: materializePortableCapabilityValue,
        nodeId,
        runtime: tileMapRuntime
    }), [layerRevision, nodeId, tileMapRuntime]);
    const screenToWorld = React.useCallback(point => {
        if (cameraRuntime && typeof cameraRuntime.screenToWorld === 'function') {
            try { return materializePortableCapabilityValue(cameraRuntime.screenToWorld(point)); } catch { /* baseline */ }
        }
        return point;
    }, [cameraRuntime]);
    const pointerToWorld = React.useCallback(event => {
        const canvas = canvasRef.current;
        if (!canvas || typeof canvas.getBoundingClientRect !== 'function') return null;
        const rect = canvas.getBoundingClientRect();
        const stageX = ((event.clientX - rect.left) / (rect.width || width)) * width;
        const stageY = ((event.clientY - rect.top) / (rect.height || height)) * height;
        return screenToWorld([
            ((stageX - width / 2) / width) * nativeWidth,
            ((height / 2 - stageY) / height) * nativeHeight
        ]);
    }, [height, nativeHeight, nativeWidth, screenToWorld, width]);

    const configForDisplay = previewConfig || (layer && layer.config);

    React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !layer || !configForDisplay || !tileMapRuntime || !tileSet || !tileSet.data) return;
        const context = canvas.getContext('2d');
        if (!context) return;
        const profiling = frameProfiler && frameProfiler.isEnabled();
        const profileStartedAt = profiling && typeof performance !== 'undefined' ? performance.now() : 0;
        const deviceDpr = typeof window !== 'undefined' ? Math.max(1, window.devicePixelRatio || 1) : 1;
        const renderSettings = performancePreferences ? performancePreferences.getRenderSettings() : {canvasScale: 1};
        const dpr = Math.max(0.25, deviceDpr * Math.max(0.25, Math.min(1, Number(renderSettings.canvasScale) || 1)));
        const pixelWidth = Math.max(1, Math.round(width * dpr));
        const pixelHeight = Math.max(1, Math.round(height * dpr));
        if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
        if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, width, height);
        const tileSize = tileSet.data.tileSize || [32, 32];
        const atlas = tileSet.data.atlas || {columns: 1, rows: 1, margin: [0, 0], separation: [0, 0]};
        const viewportWorldCorners = [
            [-nativeWidth / 2, -nativeHeight / 2],
            [nativeWidth / 2, -nativeHeight / 2],
            [nativeWidth / 2, nativeHeight / 2],
            [-nativeWidth / 2, nativeHeight / 2]
        ].map(screenToWorld);
        const visibleCellCorners = viewportWorldCorners.map(point => {
            try { return materializePortableCapabilityValue(tileMapRuntime.worldPointToCell(nodeId, point)); } catch { return null; }
        }).filter(Boolean);
        let visibleMinX = -Infinity; let visibleMaxX = Infinity; let visibleMinY = -Infinity; let visibleMaxY = Infinity;
        if (visibleCellCorners.length) {
            visibleMinX = Math.min(...visibleCellCorners.map(point => point[0])) - 2;
            visibleMaxX = Math.max(...visibleCellCorners.map(point => point[0])) + 2;
            visibleMinY = Math.min(...visibleCellCorners.map(point => point[1])) - 2;
            visibleMaxY = Math.max(...visibleCellCorners.map(point => point[1])) + 2;
        }
        const cells = listTileMapCellsInBounds(configForDisplay, {
            maxX: visibleMaxX, maxY: visibleMaxY, minX: visibleMinX, minY: visibleMinY
        });

        const getWorldCorners = cell => {
            const hx = tileSize[0] / 2;
            const hy = tileSize[1] / 2;
            const rotate = point => {
                let [x, y] = point;
                if (cell.flipX) x = -x;
                if (cell.flipY) y = -y;
                const turns = ((cell.rotation || 0) % 4 + 4) % 4;
                if (turns === 1) [x, y] = [-y, x];
                else if (turns === 2) [x, y] = [-x, -y];
                else if (turns === 3) [x, y] = [y, -x];
                return [x + cell.x * tileSize[0], y + cell.y * tileSize[1]];
            };
            return [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]].map(local => (
                toStagePoint(localToWorld(rotate(local)))
            ));
        };

        cells.forEach(cell => {
            const corners = getWorldCorners(cell);
            const p0 = corners[0];
            const p1 = corners[1];
            const p3 = corners[3];
            if (image) {
                const definition = ensureTileDefinition(tileSet.data, cell.tileId);
                const sourceX = (atlas.margin[0] || 0) + definition.atlas[0] * (tileSize[0] + (atlas.separation[0] || 0));
                const sourceY = (atlas.margin[1] || 0) + definition.atlas[1] * (tileSize[1] + (atlas.separation[1] || 0));
                context.save();
                context.setTransform(
                    dpr * ((p1[0] - p0[0]) / tileSize[0]),
                    dpr * ((p1[1] - p0[1]) / tileSize[0]),
                    dpr * ((p3[0] - p0[0]) / tileSize[1]),
                    dpr * ((p3[1] - p0[1]) / tileSize[1]),
                    dpr * p0[0],
                    dpr * p0[1]
                );
                context.drawImage(
                    image,
                    sourceX,
                    sourceY,
                    tileSize[0],
                    tileSize[1],
                    0,
                    0,
                    tileSize[0],
                    tileSize[1]
                );
                context.restore();
            } else {
                context.beginPath();
                corners.forEach((point, index) => index ? context.lineTo(point[0], point[1]) : context.moveTo(point[0], point[1]));
                context.closePath();
                context.fillStyle = 'rgba(76,151,255,0.28)';
                context.fill();
                context.fillStyle = 'rgba(0,0,0,0.7)';
                const center = toStagePoint(localToWorld([cell.x * tileSize[0], cell.y * tileSize[1]]));
                context.fillText(String(cell.tileId), center[0] + 2, center[1] - 2);
            }
        });

        if (editorSnapshot && editorSnapshot.navigationDebug) {
            cells.forEach(cell => {
                const definition = ensureTileDefinition(tileSet.data, cell.tileId);
                if (!definition.navigation || definition.navigation.enabled !== true) return;
                const corners = getWorldCorners(cell);
                context.beginPath();
                corners.forEach((point, index) => index ? context.lineTo(point[0], point[1]) : context.moveTo(point[0], point[1]));
                context.closePath();
                context.setLineDash([3, 3]);
                context.strokeStyle = 'rgba(156,39,176,0.92)';
                context.lineWidth = 2;
                context.stroke();
                context.setLineDash([]);
                context.beginPath();
                context.moveTo(corners[0][0], corners[0][1]);
                context.lineTo(corners[2][0], corners[2][1]);
                context.moveTo(corners[1][0], corners[1][1]);
                context.lineTo(corners[3][0], corners[3][1]);
                context.stroke();
            });
        }

        if (editorSnapshot && editorSnapshot.gridVisible) {
            const visibleCells = visibleCellCorners;
            let minX = -8; let maxX = 8; let minY = -6; let maxY = 6;
            if (visibleCells.length) {
                minX = Math.max(-512, Math.min(...visibleCells.map(point => point[0])) - 2);
                maxX = Math.min(512, Math.max(...visibleCells.map(point => point[0])) + 2);
                minY = Math.max(-512, Math.min(...visibleCells.map(point => point[1])) - 2);
                maxY = Math.min(512, Math.max(...visibleCells.map(point => point[1])) + 2);
            }
            if ((maxX - minX) * (maxY - minY) < 30000) {
                context.strokeStyle = 'rgba(76,151,255,0.32)';
                context.lineWidth = 1;
                for (let x = minX; x <= maxX + 1; x++) {
                    const a = localToWorld([(x - 0.5) * tileSize[0], (minY - 0.5) * tileSize[1]]);
                    const b = localToWorld([(x - 0.5) * tileSize[0], (maxY + 0.5) * tileSize[1]]);
                    const pa = toStagePoint(a); const pb = toStagePoint(b);
                    context.beginPath(); context.moveTo(pa[0], pa[1]); context.lineTo(pb[0], pb[1]); context.stroke();
                }
                for (let y = minY; y <= maxY + 1; y++) {
                    const a = localToWorld([(minX - 0.5) * tileSize[0], (y - 0.5) * tileSize[1]]);
                    const b = localToWorld([(maxX + 0.5) * tileSize[0], (y - 0.5) * tileSize[1]]);
                    const pa = toStagePoint(a); const pb = toStagePoint(b);
                    context.beginPath(); context.moveTo(pa[0], pa[1]); context.lineTo(pb[0], pb[1]); context.stroke();
                }
            }
        }

        const bounds = editorSnapshot ? selectionBounds(editorSnapshot.selection) : null;
        if (bounds) {
            const localCorners = [
                [(bounds.minX - 0.5) * tileSize[0], (bounds.minY - 0.5) * tileSize[1]],
                [(bounds.maxX + 0.5) * tileSize[0], (bounds.minY - 0.5) * tileSize[1]],
                [(bounds.maxX + 0.5) * tileSize[0], (bounds.maxY + 0.5) * tileSize[1]],
                [(bounds.minX - 0.5) * tileSize[0], (bounds.maxY + 0.5) * tileSize[1]]
            ];
            const corners = localCorners.map(point => toStagePoint(localToWorld(point)));
            context.beginPath();
            corners.forEach((point, index) => index ? context.lineTo(point[0], point[1]) : context.moveTo(point[0], point[1]));
            context.closePath();
            context.setLineDash([5, 3]);
            context.lineWidth = 2;
            context.strokeStyle = 'rgba(255,193,7,0.95)';
            context.stroke();
            context.setLineDash([]);
        }
        if (profiling && typeof performance !== 'undefined') {
            frameProfiler.recordDuration(FRAME_PROFILER_CATEGORY.TILEMAP_EDITOR, performance.now() - profileStartedAt, 1);
            frameProfiler.count('editorTiles', cells.length);
        }
    }, [cameraRevision, configForDisplay, editorSnapshot, frameProfiler, height, image, layer, localToWorld, nativeHeight, nativeWidth,
        nodeId, performancePreferences, qualityRevision, screenToWorld, tileMapRuntime, tileSet, toStagePoint, width]);

    const commitConfig = React.useCallback(nextConfig => {
        if (!editorClient || !layer || !nextConfig) return false;
        const result = editorClient.patchComponent({
            componentId: layer.componentId,
            nodeId: layer.nodeId,
            patch: {chunks: nextConfig.chunks}
        });
        return !(result && result.kind === PROTOCOL_DTO_KINDS.ERROR);
    }, [editorClient, layer]);

    const buildGesturePreview = React.useCallback((gesture, currentCell) => {
        if (!gesture || !editorSnapshot) return null;
        const base = gesture.baseConfig;
        const template = cellTemplateFromState(editorSnapshot);
        if (gesture.tool === TILEMAP_AUTHORING_TOOLS.PENCIL || gesture.tool === TILEMAP_AUTHORING_TOOLS.ERASER ||
            gesture.tool === TILEMAP_AUTHORING_TOOLS.RANDOM_VARIANT || gesture.tool === TILEMAP_AUTHORING_TOOLS.TERRAIN) {
            const segment = lineCells(gesture.lastCell || currentCell, currentCell);
            segment.forEach(point => gesture.points.add(`${point[0]},${point[1]}`));
            gesture.lastCell = currentCell;
            const points = Array.from(gesture.points).map(key => key.split(',').map(Number));
            if (gesture.tool === TILEMAP_AUTHORING_TOOLS.ERASER) return applyEraseCells(base, points);
            if (gesture.tool === TILEMAP_AUTHORING_TOOLS.RANDOM_VARIANT && tileSet && tileSet.data) {
                const activeDefinition = ensureTileDefinition(tileSet.data, template.tileId);
                const group = activeDefinition.variantGroup;
                const variants = group ? (tileSet.data.tiles || []).filter(definition => definition.variantGroup === group) : [];
                let next = base;
                points.forEach(point => {
                    const definition = variants.length ? variants[deterministicVariantIndex(point[0], point[1], variants.length, template.tileId)] : activeDefinition;
                    next = setTileMapCell(next, point[0], point[1], Object.assign({}, template, {tileId: definition.id}));
                });
                return next;
            }
            if (gesture.tool === TILEMAP_AUTHORING_TOOLS.TERRAIN && tileSet && tileSet.data) {
                return points.reduce((next, point) => applyTerrainAutoconnect(next, point, template.tileId, tileSet.data, template), base);
            }
            return applyPaintCells(base, points, template);
        }
        if (gesture.tool === TILEMAP_AUTHORING_TOOLS.RECTANGLE) {
            return applyPaintCells(base, rectangleCells(gesture.startCell, currentCell, true), template);
        }
        if (gesture.tool === TILEMAP_AUTHORING_TOOLS.LINE) {
            return applyPaintCells(base, lineCells(gesture.startCell, currentCell), template);
        }
        if (gesture.tool === TILEMAP_AUTHORING_TOOLS.FLOOD_FILL) {
            return applyPaintCells(base, floodFillCells(base, gesture.startCell, template.tileId), template);
        }
        if (gesture.tool === 'move-selection' && gesture.bounds) {
            return moveTileMapCells(base, gesture.bounds, [currentCell[0] - gesture.startCell[0], currentCell[1] - gesture.startCell[1]]);
        }
        if (gesture.tool === TILEMAP_AUTHORING_TOOLS.PASTE && editorSnapshot.clipboard) {
            let next = base;
            editorSnapshot.clipboard.cells.forEach(cell => {
                next = setTileMapCell(next, currentCell[0] + cell.dx, currentCell[1] + cell.dy, cell);
            });
            return next;
        }
        return base;
    }, [editorSnapshot, tileSet]);

    const getPointerCell = event => {
        const world = pointerToWorld(event);
        if (!world || !tileMapRuntime || !nodeId) return null;
        try { return materializePortableCapabilityValue(tileMapRuntime.worldPointToCell(nodeId, world)); } catch { return null; }
    };

    const onPointerDown = event => {
        if (!layer || !editorSnapshot || !editorClient || event.button !== 0) return;
        const cell = getPointerCell(event);
        if (!cell) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        if (editorSnapshot.tool === TILEMAP_AUTHORING_TOOLS.PICKER) {
            const existing = getCellAt(layer.config, cell[0], cell[1]);
            if (existing) editorState.patch({
                activeTileId: existing.tileId,
                flipX: existing.flipX,
                flipY: existing.flipY,
                rotation: existing.rotation
            });
            return;
        }
        if (editorSnapshot.tool === TILEMAP_AUTHORING_TOOLS.SELECT) {
            const bounds = selectionBounds(editorSnapshot.selection);
            if (cellInBounds(cell, bounds)) {
                gestureRef.current = {
                    baseConfig: layer.config,
                    bounds,
                    initialSelection: editorSnapshot.selection,
                    pointerId: event.pointerId,
                    startCell: cell,
                    tool: 'move-selection'
                };
                setPreviewConfig(layer.config);
            } else {
                gestureRef.current = {pointerId: event.pointerId, startCell: cell, tool: editorSnapshot.tool};
                editorState.patch({selection: {from: cell, to: cell}});
            }
            return;
        }
        const gesture = {
            baseConfig: layer.config,
            pointerId: event.pointerId,
            points: new Set(),
            startCell: cell,
            tool: editorSnapshot.tool
        };
        gestureRef.current = gesture;
        setPreviewConfig(buildGesturePreview(gesture, cell));
    };

    const onPointerMove = event => {
        const gesture = gestureRef.current;
        if (!gesture || gesture.pointerId !== event.pointerId) return;
        const cell = getPointerCell(event);
        if (!cell) return;
        if (gesture.tool === TILEMAP_AUTHORING_TOOLS.SELECT) {
            editorState.patch({selection: {from: gesture.startCell, to: cell}});
            return;
        }
        if (gesture.tool === 'move-selection') {
            const dx = cell[0] - gesture.startCell[0];
            const dy = cell[1] - gesture.startCell[1];
            editorState.patch({selection: {
                from: [gesture.bounds.minX + dx, gesture.bounds.minY + dy],
                to: [gesture.bounds.maxX + dx, gesture.bounds.maxY + dy]
            }});
        }
        setPreviewConfig(buildGesturePreview(gesture, cell));
    };

    const finishGesture = event => {
        const gesture = gestureRef.current;
        if (!gesture || (typeof event.pointerId !== 'undefined' && gesture.pointerId !== event.pointerId)) return;
        if (gesture.tool !== TILEMAP_AUTHORING_TOOLS.SELECT) {
            const finalCell = typeof event.clientX === 'number' ? getPointerCell(event) : null;
            const finalPreview = finalCell ? buildGesturePreview(gesture, finalCell) : previewConfig;
            if (finalPreview) commitConfig(finalPreview);
        }
        gestureRef.current = null;
        setPreviewConfig(null);
    };

    const cancelGesture = event => {
        const gesture = gestureRef.current;
        if (!gesture || (typeof event.pointerId !== 'undefined' && gesture.pointerId !== event.pointerId)) return;
        if (gesture.tool === 'move-selection' && gesture.initialSelection) {
            editorState.patch({selection: gesture.initialSelection});
        }
        gestureRef.current = null;
        setPreviewConfig(null);
    };

    const copySelection = React.useCallback(() => {
        if (!layer || !editorState || !editorSnapshot) return;
        const bounds = selectionBounds(editorSnapshot.selection);
        if (!bounds) return;
        const cells = listTileMapCells(layer.config).filter(cell => (
            cell.x >= bounds.minX && cell.x <= bounds.maxX && cell.y >= bounds.minY && cell.y <= bounds.maxY
        )).map(cell => Object.assign({}, cell, {dx: cell.x - bounds.minX, dy: cell.y - bounds.minY}));
        editorState.patch({clipboard: {cells, width: bounds.maxX - bounds.minX + 1, height: bounds.maxY - bounds.minY + 1}});
    }, [editorSnapshot, editorState, layer]);

    React.useEffect(() => {
        if (!layer || !editorState || typeof window === 'undefined') return () => {};
        const onKeyDown = event => {
            const modifier = event.ctrlKey || event.metaKey;
            if (modifier && event.key.toLowerCase() === 'c') {
                event.preventDefault();
                copySelection();
            } else if (modifier && event.key.toLowerCase() === 'v') {
                const current = editorState.getState();
                if (current.clipboard && current.clipboard.cells && current.clipboard.cells.length) {
                    event.preventDefault();
                    editorState.patch({tool: TILEMAP_AUTHORING_TOOLS.PASTE});
                }
            } else if (event.key === 'Escape') {
                cancelGesture({pointerId: gestureRef.current && gestureRef.current.pointerId});
                editorState.patch({selection: null});
            }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [copySelection, editorState, layer]);

    if (!layer || !tileSet || !editorSnapshot) return null;
    return (
        <React.Fragment>
            <canvas
                className={styles.tileMapEditorOverlay}
                data-ngvge-tilemap-editor="true"
                height={height}
                ref={canvasRef}
                width={width}
                onPointerCancel={cancelGesture}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={finishGesture}
            />
            <TileMap2DToolbar active onCopy={copySelection} vm={vm} />
        </React.Fragment>
    );
};

TileMap2DEditor.propTypes = {
    nodeId: PropTypes.string,
    stageDimensions: PropTypes.shape({height: PropTypes.number, width: PropTypes.number}),
    vm: PropTypes.object
};
TileMap2DEditor.defaultProps = {nodeId: null, stageDimensions: null, vm: null};

export default TileMap2DEditor;
