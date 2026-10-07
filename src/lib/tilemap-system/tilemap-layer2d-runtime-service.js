'use strict';

const {
    TILEMAP_LAYER2D_COMPONENT_OWNER,
    TILEMAP_LAYER2D_SCHEMA_VERSION,
    TILEMAP_LAYER2D_TYPE_ID,
    applyTileMapLayer2DPatch,
    listTileMapCells,
    listTileMapCellsInBounds,
    normalizeTileMapLayer2D,
    setTileMapCell
} = require('../../core/tilemap-layer2d');
const {ensureTileDefinition} = require('../../core/tileset');
const {normalizeCollider2D} = require('../../core/collider2d');
const {transformColliderPoints} = require('../collision-system/collider2d-runtime-service');
const {TRANSFORM2D_TYPE_ID, normalizeTransform2D} = require('../../core/transform2d');
const {
    getTransformHierarchy,
    projectPointThroughHierarchy,
    projectPointsThroughHierarchy,
    unprojectPointThroughHierarchy
} = require('../transform-system/transform2d-hierarchy-projection');
const {COMPONENT_CARDINALITIES} = require('../runtime-nodes/runtime-component-contract');

const TILEMAP_LAYER2D_RUNTIME_CAPABILITY_ID = 'ngvge.tilemap-layer2d-runtime';
const TILEMAP_LAYER2D_RUNTIME_CAPABILITY_VERSION = 1;

const TILEMAP_LAYER2D_RUNTIME_COMPONENT_DESCRIPTOR = Object.freeze({
    cardinality: COMPONENT_CARDINALITIES.ONE,
    ownerModuleId: TILEMAP_LAYER2D_COMPONENT_OWNER,
    schemaVersion: TILEMAP_LAYER2D_SCHEMA_VERSION,
    typeId: TILEMAP_LAYER2D_TYPE_ID
});

const clonePortable = value => JSON.parse(JSON.stringify(value));
const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return Object.freeze(value);
};

const getTileMapComponent = node => {
    const components = node && Array.isArray(node.components) ? node.components : [];
    return components.find(component => component && component.typeId === TILEMAP_LAYER2D_TYPE_ID) || null;
};
const getTransformComponent = node => {
    const components = node && Array.isArray(node.components) ? node.components : [];
    return components.find(component => component && component.typeId === TRANSFORM2D_TYPE_ID) || null;
};

const createTileMapLayer2DComponentOptions = (data, options = {}) => {
    const result = {
        data: normalizeTileMapLayer2D(data),
        enabled: options.enabled !== false,
        schemaVersion: TILEMAP_LAYER2D_SCHEMA_VERSION,
        typeId: TILEMAP_LAYER2D_TYPE_ID
    };
    if (options.componentId) result.id = String(options.componentId);
    return result;
};

const registerTileMapLayer2DComponent = typeRegistration => {
    if (!typeRegistration || typeof typeRegistration.getComponentTypeDescriptor !== 'function' ||
        typeof typeRegistration.registerComponentTypeDescriptor !== 'function') {
        throw new TypeError('TileMapLayer2D requires Runtime Node Type Registration capability.');
    }
    const existing = typeRegistration.getComponentTypeDescriptor(TILEMAP_LAYER2D_TYPE_ID);
    if (existing && existing.ownerModuleId === TILEMAP_LAYER2D_COMPONENT_OWNER &&
        existing.schemaVersion === TILEMAP_LAYER2D_SCHEMA_VERSION && existing.cardinality === COMPONENT_CARDINALITIES.ONE) {
        return existing;
    }
    return typeRegistration.registerComponentTypeDescriptor(
        TILEMAP_LAYER2D_RUNTIME_COMPONENT_DESCRIPTOR,
        {replace: Boolean(existing)}
    );
};

const rotateQuarter = (point, turns) => {
    const normalized = ((turns % 4) + 4) % 4;
    if (normalized === 1) return [-point[1], point[0]];
    if (normalized === 2) return [-point[0], -point[1]];
    if (normalized === 3) return [point[1], -point[0]];
    return point.slice();
};

const transformCellPoint = (point, cell, tileSize) => {
    const flipped = [cell.flipX ? -point[0] : point[0], cell.flipY ? -point[1] : point[1]];
    const rotated = rotateQuarter(flipped, cell.rotation);
    return [rotated[0] + cell.x * tileSize[0], rotated[1] + cell.y * tileSize[1]];
};

const createTileLocalCorners = (cell, tileSize) => {
    const halfX = tileSize[0] / 2;
    const halfY = tileSize[1] / 2;
    return [
        [-halfX, -halfY], [halfX, -halfY], [halfX, halfY], [-halfX, halfY]
    ].map(point => transformCellPoint(point, cell, tileSize));
};

const polygonAABB = points => points.reduce((bounds, point) => ({
    maxX: Math.max(bounds.maxX, point[0]),
    maxY: Math.max(bounds.maxY, point[1]),
    minX: Math.min(bounds.minX, point[0]),
    minY: Math.min(bounds.minY, point[1])
}), {maxX: -Infinity, maxY: -Infinity, minX: Infinity, minY: Infinity});

const createTileCollisionLocalPoints = (definition, cell, tileSize) => {
    const shapes = Array.isArray(definition.collision) ? definition.collision : [];
    return shapes.map((entry, shapeIndex) => {
        const config = normalizeCollider2D({
            collisionLayer: 1,
            collisionMask: 0xFFFFFFFF,
            offset: entry.offset || [0, 0],
            rotation: entry.rotation || 0,
            sensor: false,
            shape: entry.shape
        });
        const localPoints = transformColliderPoints(config, {
            position: [0, 0],
            rotation: 0,
            scale: [1, 1]
        }).map(point => transformCellPoint(point, cell, tileSize));
        return {localPoints, shapeIndex};
    });
};

const gridCellFromLocalPoint = (point, tileSize) => [
    Math.floor((point[0] + tileSize[0] / 2) / tileSize[0]),
    Math.floor((point[1] + tileSize[1] / 2) / tileSize[1])
];

const createTileMapLayer2DRuntimeService = options => {
    const runtimeNodeModel = options && options.runtimeNodeModel;
    const sceneRuntime = options && options.sceneRuntime;
    const transformRuntimeStore = options && options.transformRuntimeStore;
    const typeRegistration = options && options.typeRegistration;
    const tileSetResources = options && options.tileSetResources;
    const colliderRuntimeService = options && options.colliderRuntimeService;
    if (!runtimeNodeModel || typeof runtimeNodeModel.listNodes !== 'function' ||
        typeof runtimeNodeModel.getNodeSnapshot !== 'function' || typeof runtimeNodeModel.setComponentData !== 'function') {
        throw new TypeError('TileMapLayer2D Runtime Service requires Runtime Node Model capability.');
    }
    if (!sceneRuntime || typeof sceneRuntime.getActiveSceneId !== 'function') {
        throw new TypeError('TileMapLayer2D Runtime Service requires Scene Runtime capability.');
    }
    if (!transformRuntimeStore || typeof transformRuntimeStore.getRuntimeTransform !== 'function') {
        throw new TypeError('TileMapLayer2D Runtime Service requires Transform2D Runtime Store.');
    }
    if (!tileSetResources || typeof tileSetResources.getTileSet !== 'function') {
        throw new TypeError('TileMapLayer2D Runtime Service requires TileSet Resource authority.');
    }

    registerTileMapLayer2DComponent(typeRegistration);
    const listeners = new Set();
    let revision = 0;
    let projectionRevision = 0;
    const layerViewCache = new Map();
    const collisionProjectionCache = new Map();
    const collisionCountCache = new Map();
    const tileSetSnapshotCache = new Map();
    const preparedTileCollisionCache = new Map();
    const viewportCollisionProjectionCache = new Map();
    const MAX_VIEWPORT_COLLISION_CACHE_ENTRIES = 32;
    let transformDependencyRevision = -1;
    let transformDependencyNodeIds = new Set();
    let disposed = false;
    let unsubscribeNodes = () => {};
    let unsubscribeTransform = () => {};
    let unsubscribeTileSets = () => {};
    let unregisterColliderProvider = () => {};

    const emit = change => {
        revision += 1;
        const event = deepFreeze(Object.assign({revision}, clonePortable(change || {})));
        listeners.forEach(listener => {
            try { listener(event); } catch { /* advisory */ }
        });
        return event;
    };
    const invalidateProjectionCaches = () => {
        projectionRevision += 1;
        layerViewCache.clear();
        collisionProjectionCache.clear();
        collisionCountCache.clear();
        tileSetSnapshotCache.clear();
        preparedTileCollisionCache.clear();
        viewportCollisionProjectionCache.clear();
        transformDependencyRevision = -1;
    };
    const layerCacheKey = (sceneId, listOptions = {}) => `${sceneId || ''}|${listOptions.includeInactive === true ? 'all' : 'active'}`;
    const getCachedTileSet = resourceId => {
        if (!resourceId) return null;
        if (tileSetSnapshotCache.has(resourceId)) return tileSetSnapshotCache.get(resourceId);
        const tileSet = tileSetResources.getTileSet(resourceId);
        tileSetSnapshotCache.set(resourceId, tileSet || null);
        return tileSet || null;
    };
    const getPreparedTileCollisionData = (resourceId, tileSet) => {
        if (!resourceId || !tileSet || !tileSet.data) return null;
        const cached = preparedTileCollisionCache.get(resourceId);
        if (cached) return cached;
        const definitions = new Map();
        (Array.isArray(tileSet.data.tiles) ? tileSet.data.tiles : []).forEach(definition => {
            if (definition && Number.isInteger(Number(definition.id))) definitions.set(Number(definition.id), definition);
        });
        const entryCache = new Map();
        const getDefinition = tileId => {
            const id = Math.max(0, Math.trunc(Number(tileId) || 0));
            if (definitions.has(id)) return definitions.get(id);
            const definition = ensureTileDefinition(tileSet.data, id);
            definitions.set(id, definition);
            return definition;
        };
        const getCollisionEntries = tileId => {
            const id = Math.max(0, Math.trunc(Number(tileId) || 0));
            if (entryCache.has(id)) return entryCache.get(id);
            const definition = getDefinition(id);
            const entries = Object.freeze((Array.isArray(definition.collision) ? definition.collision : []).map((entry, shapeIndex) => {
                const config = normalizeCollider2D({
                    collisionLayer: 1,
                    collisionMask: 0xFFFFFFFF,
                    offset: entry.offset || [0, 0],
                    rotation: entry.rotation || 0,
                    sensor: false,
                    shape: entry.shape
                });
                return Object.freeze({
                    basePoints: Object.freeze(transformColliderPoints(config, {
                        position: [0, 0], rotation: 0, scale: [1, 1]
                    }).map(point => Object.freeze(point.slice()))),
                    shape: deepFreeze(clonePortable(entry.shape)),
                    shapeIndex
                });
            }));
            entryCache.set(id, entries);
            return entries;
        };
        const prepared = {definitions, getCollisionEntries, getDefinition, tileSize: tileSet.data.tileSize.slice()};
        preparedTileCollisionCache.set(resourceId, prepared);
        return prepared;
    };
    const viewportCollisionCacheKey = (sceneId, worldAABB, queryOptions = {}) => [
        projectionRevision,
        sceneId || '',
        Number(worldAABB && worldAABB.minX), Number(worldAABB && worldAABB.minY),
        Number(worldAABB && worldAABB.maxX), Number(worldAABB && worldAABB.maxY),
        queryOptions.includeInactive === true ? 1 : 0,
        Number.isFinite(Number(queryOptions.maxResults)) ? Math.max(0, Math.trunc(Number(queryOptions.maxResults))) : 'all'
    ].join('|');
    const rememberViewportCollisionProjection = (key, value) => {
        viewportCollisionProjectionCache.delete(key);
        viewportCollisionProjectionCache.set(key, value);
        while (viewportCollisionProjectionCache.size > MAX_VIEWPORT_COLLISION_CACHE_ENTRIES) {
            viewportCollisionProjectionCache.delete(viewportCollisionProjectionCache.keys().next().value);
        }
        return value;
    };

    const buildLayerView = node => {
        const component = getTileMapComponent(node);
        if (!node || !component) return null;
        const config = normalizeTileMapLayer2D(component.data);
        const tileSet = config.tileSetResourceId ? getCachedTileSet(config.tileSetResourceId) : null;
        const transformComponent = getTransformComponent(node);
        const transform = transformRuntimeStore.getRuntimeTransform(node.id) ||
            (transformComponent ? normalizeTransform2D(transformComponent.data) : normalizeTransform2D());
        const cells = listTileMapCells(config);
        const tileSize = tileSet && tileSet.data ? tileSet.data.tileSize : [32, 32];
        const instances = cells.map(cell => {
            const definition = tileSet && tileSet.data ? ensureTileDefinition(tileSet.data, cell.tileId) : null;
            return {
                atlas: definition ? definition.atlas : [cell.tileId, 0],
                cell: clonePortable(cell),
                localCorners: createTileLocalCorners(cell, tileSize),
                tileId: cell.tileId,
                worldCorners: projectPointsThroughHierarchy(
                    createTileLocalCorners(cell, tileSize),
                    node.id,
                    runtimeNodeModel,
                    transformRuntimeStore
                )
            };
        });
        return deepFreeze({
            active: node.activeInHierarchy !== false && component.activeInHierarchy !== false && component.enabled !== false,
            cells,
            componentId: component.id,
            config,
            instances,
            name: node.name,
            nodeId: node.id,
            sceneId: node.sceneId,
            tileSet,
            tileSize: tileSize.slice(),
            transform: clonePortable(transform),
            transformHierarchyNodeIds: getTransformHierarchy(node.id, runtimeNodeModel, transformRuntimeStore)
                .map(entry => entry.nodeId)
        });
    };

    const listLayers = (sceneId = sceneRuntime.getActiveSceneId(), listOptions = {}) => {
        const key = layerCacheKey(sceneId, listOptions);
        const cached = layerViewCache.get(key);
        if (cached && cached.projectionRevision === projectionRevision) return cached.layers;
        const layers = Object.freeze(runtimeNodeModel.listNodes({
            includeRoots: false,
            sceneId
        }).map(buildLayerView).filter(Boolean).filter(layer => listOptions.includeInactive === true || layer.active));
        layerViewCache.set(key, {layers, projectionRevision});
        return layers;
    };

    const getLayer = nodeId => buildLayerView(runtimeNodeModel.getNodeSnapshot(nodeId));

    const patchPersistentLayer = (nodeId, patch, mutationOptions = {}) => {
        const node = runtimeNodeModel.getNodeSnapshot(nodeId);
        const component = getTileMapComponent(node);
        if (!node || !component) throw Object.assign(new Error(`TileMapLayer2D component not found for node: ${nodeId}`), {
            code: 'NGVGE_TILEMAP_LAYER2D_COMPONENT_NOT_FOUND'
        });
        const next = applyTileMapLayer2DPatch(component.data, patch);
        invalidateProjectionCaches();
        runtimeNodeModel.setComponentData(nodeId, component.id, next, {
            transactionId: mutationOptions.transactionId || `tilemap-layer2d:persistent-patch:${nodeId}`
        });
        emit({componentId: component.id, nodeId, type: 'tilemap:patch'});
        if (colliderRuntimeService && typeof colliderRuntimeService.refresh === 'function') {
            colliderRuntimeService.refresh('tilemap-patch');
        }
        return deepFreeze(clonePortable(next));
    };

    const setCell = (nodeId, x, y, cellValue, mutationOptions = {}) => {
        const layer = getLayer(nodeId);
        if (!layer) throw Object.assign(new Error(`TileMapLayer2D component not found for node: ${nodeId}`), {
            code: 'NGVGE_TILEMAP_LAYER2D_COMPONENT_NOT_FOUND'
        });
        return patchPersistentLayer(nodeId, {
            chunks: setTileMapCell(layer.config, x, y, cellValue).chunks
        }, mutationOptions);
    };

    const eraseCell = (nodeId, x, y, mutationOptions = {}) => setCell(nodeId, x, y, null, mutationOptions);

    const localPointToCell = (nodeId, localPoint) => {
        const layer = getLayer(nodeId);
        if (!layer) return null;
        const point = Array.isArray(localPoint) && localPoint.length === 2 ? localPoint.map(Number) : [0, 0];
        return gridCellFromLocalPoint(point, layer.tileSize);
    };
    const worldPointToLocal = (nodeId, worldPoint) => {
        const point = Array.isArray(worldPoint) && worldPoint.length === 2 ? worldPoint.map(Number) : [0, 0];
        return unprojectPointThroughHierarchy(point, nodeId, runtimeNodeModel, transformRuntimeStore);
    };
    const localPointToWorld = (nodeId, localPoint) => {
        const point = Array.isArray(localPoint) && localPoint.length === 2 ? localPoint.map(Number) : [0, 0];
        return projectPointThroughHierarchy(point, nodeId, runtimeNodeModel, transformRuntimeStore);
    };
    const worldPointToCell = (nodeId, worldPoint) => {
        const local = worldPointToLocal(nodeId, worldPoint);
        return local ? localPointToCell(nodeId, local) : null;
    };
    const cellToWorld = (nodeId, cellValue) => {
        const layer = getLayer(nodeId);
        if (!layer) return null;
        const cell = Array.isArray(cellValue) && cellValue.length === 2 ? cellValue.map(Number) : [0, 0];
        return projectPointThroughHierarchy(
            [cell[0] * layer.tileSize[0], cell[1] * layer.tileSize[1]],
            nodeId,
            runtimeNodeModel,
            transformRuntimeStore
        );
    };

    const listNavigationProjections = (sceneId = sceneRuntime.getActiveSceneId()) => {
        const projections = [];
        listLayers(sceneId).forEach(layer => {
            if (!layer.config.navigationEnabled || !layer.tileSet || !layer.tileSet.data) return;
            layer.cells.forEach(cell => {
                const definition = ensureTileDefinition(layer.tileSet.data, cell.tileId);
                if (!definition.navigation || definition.navigation.enabled !== true) return;
                const instance = layer.instances.find(item => item.cell.x === cell.x && item.cell.y === cell.y);
                if (!instance) return;
                projections.push(deepFreeze({
                    navigation: clonePortable(definition.navigation),
                    nodeId: layer.nodeId,
                    projectionId: `${layer.componentId}:nav:${cell.x},${cell.y}`,
                    sceneId: layer.sceneId,
                    sourceKey: `${cell.x},${cell.y}`,
                    worldPoints: clonePortable(instance.worldCorners)
                }));
            });
        });
        return Object.freeze(projections);
    };

    const buildTileCollisionProjections = (node, component, config, tileSet, cells) => {
        const prepared = getPreparedTileCollisionData(config.tileSetResourceId, tileSet);
        if (!prepared) return [];
        const tileSize = prepared.tileSize;
        const hierarchyNodeIds = getTransformHierarchy(node.id, runtimeNodeModel, transformRuntimeStore)
            .map(entry => entry.nodeId);
        const records = [];
        const allLocalPoints = [];
        cells.forEach(cell => {
            prepared.getCollisionEntries(cell.tileId).forEach(entry => {
                const localPoints = entry.basePoints.map(point => transformCellPoint(point, cell, tileSize));
                const pointOffset = allLocalPoints.length;
                localPoints.forEach(point => allLocalPoints.push(point));
                records.push({cell, entry, pointCount: localPoints.length, pointOffset});
            });
        });
        // Resolve the TileMap Transform hierarchy once for the complete viewport batch instead of once per tile shape.
        const allWorldPoints = projectPointsThroughHierarchy(
            allLocalPoints,
            node.id,
            runtimeNodeModel,
            transformRuntimeStore
        );
        const projections = [];
        records.forEach(record => {
            const worldPoints = allWorldPoints.slice(record.pointOffset, record.pointOffset + record.pointCount);
            if (!Array.isArray(worldPoints) || worldPoints.length < 3) return;
            const worldAABB = polygonAABB(worldPoints);
            projections.push(deepFreeze({
                active: true,
                authoring: false,
                componentId: component.id,
                config: normalizeCollider2D({
                    collisionLayer: config.collisionLayer,
                    collisionMask: config.collisionMask,
                    sensor: false,
                    shape: record.entry.shape
                }),
                name: `${node.name} [${record.cell.x},${record.cell.y}]`,
                nodeId: node.id,
                projectionId: `${component.id}:tile:${record.cell.x},${record.cell.y}:shape:${record.entry.shapeIndex}`,
                sceneId: node.sceneId,
                sourceKind: 'tilemap',
                sourceKey: `${record.cell.x},${record.cell.y}:${record.entry.shapeIndex}`,
                transformHierarchyNodeIds: hierarchyNodeIds,
                worldAABB,
                worldOrigin: [
                    (worldAABB.minX + worldAABB.maxX) / 2,
                    (worldAABB.minY + worldAABB.maxY) / 2
                ],
                worldPoints
            }));
        });
        return projections;
    };

    const collisionCellMargin = (tileSetData, tileSize, prepared = null) => {
        let maxX = tileSize[0] / 2;
        let maxY = tileSize[1] / 2;
        const tiles = tileSetData && Array.isArray(tileSetData.tiles) ? tileSetData.tiles : [];
        tiles.forEach(definition => {
            const entries = prepared ? prepared.getCollisionEntries(definition.id) : null;
            if (entries) {
                entries.forEach(entry => entry.basePoints.forEach(point => {
                    maxX = Math.max(maxX, Math.abs(point[0]));
                    maxY = Math.max(maxY, Math.abs(point[1]));
                }));
                return;
            }
            const collision = definition && Array.isArray(definition.collision) ? definition.collision : [];
            collision.forEach(entry => {
                const colliderConfig = normalizeCollider2D({
                    offset: entry.offset || [0, 0], rotation: entry.rotation || 0, sensor: false, shape: entry.shape
                });
                transformColliderPoints(colliderConfig, {position: [0, 0], rotation: 0, scale: [1, 1]}).forEach(point => {
                    maxX = Math.max(maxX, Math.abs(point[0]));
                    maxY = Math.max(maxY, Math.abs(point[1]));
                });
            });
        });
        return [
            Math.max(1, Math.ceil(maxX / Math.max(1, tileSize[0])) + 1),
            Math.max(1, Math.ceil(maxY / Math.max(1, tileSize[1])) + 1)
        ];
    };

    const worldAABBToCellBounds = (nodeId, worldAABB, tileSetData, prepared = null) => {
        if (!worldAABB || !Object.values(worldAABB).every(Number.isFinite)) return null;
        const tileSize = tileSetData.tileSize || [32, 32];
        const localCorners = [
            [worldAABB.minX, worldAABB.minY], [worldAABB.maxX, worldAABB.minY],
            [worldAABB.maxX, worldAABB.maxY], [worldAABB.minX, worldAABB.maxY]
        ].map(point => unprojectPointThroughHierarchy(point, nodeId, runtimeNodeModel, transformRuntimeStore)).filter(Boolean);
        if (!localCorners.length) return null;
        const cellCorners = localCorners.map(point => gridCellFromLocalPoint(point, tileSize));
        const margin = collisionCellMargin(tileSetData, tileSize, prepared);
        return {
            maxX: Math.max(...cellCorners.map(point => point[0])) + margin[0],
            maxY: Math.max(...cellCorners.map(point => point[1])) + margin[1],
            minX: Math.min(...cellCorners.map(point => point[0])) - margin[0],
            minY: Math.min(...cellCorners.map(point => point[1])) - margin[1]
        };
    };

    const queryCollisionProjectionsInAABB = (sceneId = sceneRuntime.getActiveSceneId(), worldAABB, queryOptions = {}) => {
        if (!worldAABB || !Object.values(worldAABB).every(Number.isFinite)) return Object.freeze([]);
        const cacheKey = viewportCollisionCacheKey(sceneId, worldAABB, queryOptions);
        const cachedProjection = viewportCollisionProjectionCache.get(cacheKey);
        if (cachedProjection) {
            // LRU touch. Static TileMap projections must survive unrelated dynamic-body refreshes.
            viewportCollisionProjectionCache.delete(cacheKey);
            viewportCollisionProjectionCache.set(cacheKey, cachedProjection);
            return cachedProjection;
        }
        const projections = [];
        const maxResults = Number.isFinite(Number(queryOptions.maxResults)) ?
            Math.max(0, Math.trunc(Number(queryOptions.maxResults))) : Infinity;
        const nodes = runtimeNodeModel.listNodes({includeRoots: false, sceneId});
        for (const node of nodes) {
            if (projections.length >= maxResults) break;
            const component = getTileMapComponent(node);
            if (!component || node.activeInHierarchy === false || component.activeInHierarchy === false || component.enabled === false) continue;
            const config = normalizeTileMapLayer2D(component.data);
            if (!config.collisionEnabled || !config.tileSetResourceId) continue;
            const tileSet = getCachedTileSet(config.tileSetResourceId);
            if (!tileSet || !tileSet.data) continue;
            const prepared = getPreparedTileCollisionData(config.tileSetResourceId, tileSet);
            const cellBounds = worldAABBToCellBounds(node.id, worldAABB, tileSet.data, prepared);
            if (!cellBounds) continue;
            const cells = listTileMapCellsInBounds(config, cellBounds);
            const built = buildTileCollisionProjections(node, component, config, tileSet, cells);
            for (const projection of built) {
                if (projections.length >= maxResults) break;
                if (!projection.worldAABB || projection.worldAABB.maxX < worldAABB.minX || projection.worldAABB.minX > worldAABB.maxX ||
                    projection.worldAABB.maxY < worldAABB.minY || projection.worldAABB.minY > worldAABB.maxY) continue;
                projections.push(projection);
            }
        }
        return rememberViewportCollisionProjection(cacheKey, Object.freeze(projections));
    };

    const countCollisionProjections = (sceneId = sceneRuntime.getActiveSceneId()) => {
        const cached = collisionCountCache.get(sceneId);
        if (cached && cached.projectionRevision === projectionRevision) return cached.count;
        let count = 0;
        runtimeNodeModel.listNodes({includeRoots: false, sceneId}).forEach(node => {
            const component = getTileMapComponent(node);
            if (!component || node.activeInHierarchy === false || component.activeInHierarchy === false || component.enabled === false) return;
            const config = normalizeTileMapLayer2D(component.data);
            if (!config.collisionEnabled || !config.tileSetResourceId) return;
            const tileSet = getCachedTileSet(config.tileSetResourceId);
            if (!tileSet || !tileSet.data) return;
            const prepared = getPreparedTileCollisionData(config.tileSetResourceId, tileSet);
            listTileMapCells(config).forEach(cell => {
                count += prepared ? prepared.getCollisionEntries(cell.tileId).length : 0;
            });
        });
        collisionCountCache.set(sceneId, {count, projectionRevision});
        return count;
    };

    const listCollisionProjections = (sceneId = sceneRuntime.getActiveSceneId()) => {
        const cached = collisionProjectionCache.get(sceneId);
        if (cached && cached.projectionRevision === projectionRevision) return cached.projections;
        const projections = [];
        runtimeNodeModel.listNodes({includeRoots: false, sceneId}).forEach(node => {
            const component = getTileMapComponent(node);
            if (!component || node.activeInHierarchy === false || component.activeInHierarchy === false || component.enabled === false) return;
            const config = normalizeTileMapLayer2D(component.data);
            if (!config.collisionEnabled || !config.tileSetResourceId) return;
            const tileSet = getCachedTileSet(config.tileSetResourceId);
            if (!tileSet || !tileSet.data) return;
            const cells = listTileMapCells(config);
            buildTileCollisionProjections(node, component, config, tileSet, cells).forEach(projection => projections.push(projection));
        });
        const frozen = Object.freeze(projections);
        collisionProjectionCache.set(sceneId, {projectionRevision, projections: frozen});
        return frozen;
    };


    if (colliderRuntimeService && typeof colliderRuntimeService.registerExternalColliderProvider === 'function') {
        unregisterColliderProvider = colliderRuntimeService.registerExternalColliderProvider({
            containsSensors: false,
            getColliderCount: sceneId => countCollisionProjections(sceneId),
            id: 'ngvge.tilemap-layer2d.collider-projection',
            listColliders: sceneId => listCollisionProjections(sceneId),
            queryCollidersInAABB: (sceneId, worldAABB, queryOptions) => queryCollisionProjectionsInAABB(sceneId, worldAABB, queryOptions),
            stableSnapshots: true
        });
    }

    unsubscribeNodes = runtimeNodeModel.subscribe(change => {
        if (!change || typeof change !== 'object') return;
        if (change.type === 'runtime:replaced' || change.type === 'node:destroy' || change.type === 'node:active' ||
            change.type === 'node:enabled' || change.componentTypeId === TILEMAP_LAYER2D_TYPE_ID) {
            invalidateProjectionCaches();
            emit({reason: change.type, type: 'tilemap:refresh'});
            if (colliderRuntimeService && typeof colliderRuntimeService.refresh === 'function') colliderRuntimeService.refresh('tilemap-node-change');
        }
    });
    const getTransformDependencyNodeIds = () => {
        if (transformDependencyRevision === projectionRevision) return transformDependencyNodeIds;
        const next = new Set();
        runtimeNodeModel.listNodes({
            includeRoots: false,
            sceneId: sceneRuntime.getActiveSceneId()
        }).forEach(node => {
            if (!getTileMapComponent(node)) return;
            getTransformHierarchy(node.id, runtimeNodeModel, transformRuntimeStore).forEach(entry => next.add(entry.nodeId));
        });
        transformDependencyNodeIds = next;
        transformDependencyRevision = projectionRevision;
        return transformDependencyNodeIds;
    };
    const transformAffectsTileMap = changedNodeId => getTransformDependencyNodeIds().has(changedNodeId);
    unsubscribeTransform = transformRuntimeStore.subscribe(change => {
        if (!change || !change.nodeId || !transformAffectsTileMap(change.nodeId)) return;
        invalidateProjectionCaches();
        emit({nodeId: change.nodeId, type: 'tilemap:transform-refresh'});
        if (colliderRuntimeService && typeof colliderRuntimeService.refresh === 'function') colliderRuntimeService.refresh('tilemap-transform-change');
    });
    unsubscribeTileSets = tileSetResources.subscribe(change => {
        invalidateProjectionCaches();
        emit({resourceId: change && change.resourceId, type: 'tilemap:tileset-refresh'});
        if (colliderRuntimeService && typeof colliderRuntimeService.refresh === 'function') colliderRuntimeService.refresh('tileset-change');
    });

    return Object.freeze({
        capabilityId: TILEMAP_LAYER2D_RUNTIME_CAPABILITY_ID,
        version: TILEMAP_LAYER2D_RUNTIME_CAPABILITY_VERSION,
        cellToWorld,
        dispose: () => {
            if (disposed) return;
            disposed = true;
            unsubscribeNodes();
            unsubscribeTransform();
            unsubscribeTileSets();
            unregisterColliderProvider();
            listeners.clear();
            layerViewCache.clear();
            collisionProjectionCache.clear();
            collisionCountCache.clear();
            tileSetSnapshotCache.clear();
            preparedTileCollisionCache.clear();
            viewportCollisionProjectionCache.clear();
        },
        eraseCell,
        getLayer,
        getPersistentLayer: nodeId => {
            const node = runtimeNodeModel.getNodeSnapshot(nodeId);
            const component = getTileMapComponent(node);
            return component ? normalizeTileMapLayer2D(component.data) : null;
        },
        getStatus: () => deepFreeze({
            activeLayerCount: listLayers().length,
            cellCount: listLayers().reduce((total, layer) => total + layer.cells.length, 0),
            disposed,
            revision
        }),
        listCollisionProjections,
        queryCollisionProjectionsInAABB,
        listLayers,
        listNavigationProjections,
        localPointToCell,
        localPointToWorld,
        patchPersistentLayer,
        setCell,
        worldPointToLocal,
        subscribe: listener => {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        worldPointToCell
    });
};

module.exports = {
    TILEMAP_LAYER2D_RUNTIME_CAPABILITY_ID,
    TILEMAP_LAYER2D_RUNTIME_CAPABILITY_VERSION,
    TILEMAP_LAYER2D_RUNTIME_COMPONENT_DESCRIPTOR,
    createTileMapLayer2DComponentOptions,
    createTileMapLayer2DRuntimeService,
    gridCellFromLocalPoint,
    registerTileMapLayer2DComponent
};
