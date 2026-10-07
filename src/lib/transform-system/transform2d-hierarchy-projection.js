'use strict';

const {normalizeTransform2D} = require('../../core/transform2d');

const EPSILON = 1e-12;
const MAX_HIERARCHY_DEPTH = 1024;

const rotatePoint = (point, degrees) => {
    const radians = Number(degrees || 0) * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return [point[0] * cos - point[1] * sin, point[0] * sin + point[1] * cos];
};

const assertProjectionSources = (runtimeNodeModel, transformRuntimeStore) => {
    if (!runtimeNodeModel || typeof runtimeNodeModel.getNodeSnapshot !== 'function') {
        throw new TypeError('Transform2D hierarchy projection requires Runtime Node Model capability.');
    }
    if (!transformRuntimeStore || typeof transformRuntimeStore.getRuntimeTransform !== 'function') {
        throw new TypeError('Transform2D hierarchy projection requires Transform2D Runtime Store.');
    }
};

const getLocalTransform = (node, transformRuntimeStore) => {
    if (!node) return null;
    const runtime = transformRuntimeStore.getRuntimeTransform(node.id);
    if (runtime) return normalizeTransform2D(runtime);
    const components = Array.isArray(node.components) ? node.components : [];
    const component = components.find(item => item && item.typeId === 'ngvge.transform2d');
    return component ? normalizeTransform2D(component.data) : null;
};

/**
 * Returns transform-bearing nodes from the owner outward: [owner, parent, grandparent, ...].
 * Node hierarchy owns parentage; this helper only derives runtime world projection and never mutates authority.
 */
const getTransformHierarchy = (nodeId, runtimeNodeModel, transformRuntimeStore, options = {}) => {
    assertProjectionSources(runtimeNodeModel, transformRuntimeStore);
    const result = [];
    const visited = new Set();
    let node = runtimeNodeModel.getNodeSnapshot(nodeId);
    let depth = 0;
    while (node && depth < MAX_HIERARCHY_DEPTH) {
        if (visited.has(node.id)) {
            const error = new Error(`Transform2D hierarchy cycle detected at node: ${node.id}`);
            error.code = 'NGVGE_TRANSFORM2D_HIERARCHY_CYCLE';
            throw error;
        }
        visited.add(node.id);
        const transform = getLocalTransform(node, transformRuntimeStore);
        if (transform) result.push({nodeId: node.id, transform});
        if (options.stopBeforeNodeId && node.parentId === options.stopBeforeNodeId) break;
        node = node.parentId ? runtimeNodeModel.getNodeSnapshot(node.parentId) : null;
        depth += 1;
    }
    if (node && depth >= MAX_HIERARCHY_DEPTH) {
        const error = new Error(`Transform2D hierarchy depth exceeded ${MAX_HIERARCHY_DEPTH}.`);
        error.code = 'NGVGE_TRANSFORM2D_HIERARCHY_DEPTH_EXCEEDED';
        throw error;
    }
    return result;
};

const applyLocalTransformToPoint = (pointValue, transformValue, options = {}) => {
    const point = [Number(pointValue[0]) || 0, Number(pointValue[1]) || 0];
    const transform = normalizeTransform2D(transformValue);
    const scale = options.ignoreScale === true ? [1, 1] : transform.scale;
    const scaled = [point[0] * scale[0], point[1] * scale[1]];
    const rotated = rotatePoint(scaled, transform.rotation);
    return [rotated[0] + transform.position[0], rotated[1] + transform.position[1]];
};

const applyInverseLocalTransformToPoint = (pointValue, transformValue, options = {}) => {
    const point = [Number(pointValue[0]) || 0, Number(pointValue[1]) || 0];
    const transform = normalizeTransform2D(transformValue);
    const translated = [point[0] - transform.position[0], point[1] - transform.position[1]];
    const rotated = rotatePoint(translated, -transform.rotation);
    if (options.ignoreScale === true) return rotated;
    const scaleX = Number(transform.scale[0]);
    const scaleY = Number(transform.scale[1]);
    if (Math.abs(scaleX) <= EPSILON || Math.abs(scaleY) <= EPSILON) {
        const error = new Error('Cannot invert a singular Transform2D scale.');
        error.code = 'NGVGE_TRANSFORM2D_INVERSE_SINGULAR';
        throw error;
    }
    return [rotated[0] / scaleX, rotated[1] / scaleY];
};

const projectPointThroughHierarchy = (pointValue, nodeId, runtimeNodeModel, transformRuntimeStore, options = {}) => {
    const hierarchy = getTransformHierarchy(nodeId, runtimeNodeModel, transformRuntimeStore);
    let projected = [Number(pointValue[0]) || 0, Number(pointValue[1]) || 0];
    hierarchy.forEach((entry, index) => {
        projected = applyLocalTransformToPoint(projected, entry.transform, {
            ignoreScale: index === 0 && options.ignoreOwnerScale === true
        });
    });
    return projected;
};

const projectPointsThroughHierarchy = (points, nodeId, runtimeNodeModel, transformRuntimeStore, options = {}) => {
    // Resolve the hierarchy once for the whole point batch. The previous implementation
    // called projectPointThroughHierarchy() per point, which rebuilt the same parent chain
    // for every Circle/Capsule vertex and amplified editor/debug costs by shape tessellation.
    const hierarchy = getTransformHierarchy(nodeId, runtimeNodeModel, transformRuntimeStore);
    return (Array.isArray(points) ? points : []).map(point => {
        let projected = [Number(point[0]) || 0, Number(point[1]) || 0];
        hierarchy.forEach((entry, index) => {
            projected = applyLocalTransformToPoint(projected, entry.transform, {
                ignoreScale: index === 0 && options.ignoreOwnerScale === true
            });
        });
        return projected;
    });
};

/**
 * Converts a world-space point back into the selected node's local space.
 * This is the inverse of projectPointThroughHierarchy and is intentionally kept
 * in the Transform2D projection layer so editor gizmos never become transform writers.
 */
const unprojectPointThroughHierarchy = (pointValue, nodeId, runtimeNodeModel, transformRuntimeStore, options = {}) => {
    const hierarchy = getTransformHierarchy(nodeId, runtimeNodeModel, transformRuntimeStore);
    let projected = [Number(pointValue[0]) || 0, Number(pointValue[1]) || 0];
    for (let index = hierarchy.length - 1; index >= 0; index--) {
        const entry = hierarchy[index];
        projected = applyInverseLocalTransformToPoint(projected, entry.transform, {
            ignoreScale: index === 0 && options.ignoreOwnerScale === true
        });
    }
    return projected;
};

const getHierarchyWorldOrigin = (nodeId, runtimeNodeModel, transformRuntimeStore) => (
    projectPointThroughHierarchy([0, 0], nodeId, runtimeNodeModel, transformRuntimeStore)
);

const applyLinearTransform = (vector, transformValue) => {
    const transform = normalizeTransform2D(transformValue);
    return rotatePoint([
        vector[0] * transform.scale[0],
        vector[1] * transform.scale[1]
    ], transform.rotation);
};

/**
 * Converts a world-space motion delta into the owning node's parent-local translation delta.
 * The owner's own rotation/scale do not affect its position field; only ancestor linear transforms do.
 */
const worldDeltaToNodeLocalDelta = (worldDeltaValue, nodeId, runtimeNodeModel, transformRuntimeStore) => {
    assertProjectionSources(runtimeNodeModel, transformRuntimeStore);
    const worldDelta = [Number(worldDeltaValue[0]) || 0, Number(worldDeltaValue[1]) || 0];
    const owner = runtimeNodeModel.getNodeSnapshot(nodeId);
    if (!owner || !owner.parentId) return worldDelta;

    const ancestorHierarchy = getTransformHierarchy(owner.parentId, runtimeNodeModel, transformRuntimeStore);
    // Build the ancestor 2x2 basis by projecting unit vectors through scale/rotation only.
    let axisX = [1, 0];
    let axisY = [0, 1];
    ancestorHierarchy.forEach(entry => {
        axisX = applyLinearTransform(axisX, entry.transform);
        axisY = applyLinearTransform(axisY, entry.transform);
    });

    const determinant = axisX[0] * axisY[1] - axisY[0] * axisX[1];
    if (Math.abs(determinant) <= EPSILON) {
        const error = new Error(`Cannot convert world motion through singular parent Transform2D for node: ${nodeId}`);
        error.code = 'NGVGE_TRANSFORM2D_PARENT_TRANSFORM_SINGULAR';
        error.nodeId = nodeId;
        throw error;
    }
    return [
        (worldDelta[0] * axisY[1] - axisY[0] * worldDelta[1]) / determinant,
        (axisX[0] * worldDelta[1] - worldDelta[0] * axisX[1]) / determinant
    ];
};

const isNodeInAncestorChain = (candidateAncestorId, nodeId, runtimeNodeModel) => {
    if (!candidateAncestorId || !nodeId || !runtimeNodeModel || typeof runtimeNodeModel.getNodeSnapshot !== 'function') {
        return false;
    }
    const visited = new Set();
    let node = runtimeNodeModel.getNodeSnapshot(nodeId);
    let depth = 0;
    while (node && depth < MAX_HIERARCHY_DEPTH) {
        if (visited.has(node.id)) return false;
        visited.add(node.id);
        if (node.id === candidateAncestorId) return true;
        node = node.parentId ? runtimeNodeModel.getNodeSnapshot(node.parentId) : null;
        depth += 1;
    }
    return false;
};

module.exports = {
    MAX_HIERARCHY_DEPTH,
    applyInverseLocalTransformToPoint,
    applyLocalTransformToPoint,
    getHierarchyWorldOrigin,
    getTransformHierarchy,
    isNodeInAncestorChain,
    projectPointThroughHierarchy,
    projectPointsThroughHierarchy,
    unprojectPointThroughHierarchy,
    worldDeltaToNodeLocalDelta
};
