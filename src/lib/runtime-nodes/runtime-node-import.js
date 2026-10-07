const {
    GLOBAL_ROOT_NODE_ID,
    NODE_SCOPES,
    RUNTIME_NODE_MODEL_VERSION,
    getSceneRootNodeId
} = require('./constants');
const {cloneSerializable, isObject} = require('./serializable');
const {
    COMPONENT_CARDINALITIES,
    normalizeImportedComponentRecord,
    normalizeRuntimeComponentTypeDescriptor
} = require('./runtime-component-contract');


class RuntimeNodeImportError extends Error {
    constructor (message, errors = []) {
        super(message);
        this.name = 'RuntimeNodeImportError';
        this.code = 'RUNTIME_NODE_IMPORT_INVALID';
        this.errors = errors;
    }
}

const createIssue = (code, message, details = {}) => Object.assign({code, message}, details);

const cloneRecord = record => {
    try {
        return cloneSerializable(record);
    } catch (error) {
        throw new RuntimeNodeImportError('Runtime node snapshot contains non-serializable data.', [
            createIssue('RUNTIME_NODE_IMPORT_NOT_SERIALIZABLE', error.message || String(error))
        ]);
    }
};

const normalizeScene = (scene, index, issues) => {
    if (!scene || typeof scene !== 'object') {
        issues.push(createIssue('RUNTIME_SCENE_INVALID', `Scene record at index ${index} must be an object.`, {index}));
        return null;
    }
    const id = typeof scene.id === 'string' ? scene.id.trim() : '';
    if (!id) {
        issues.push(createIssue('RUNTIME_SCENE_ID_INVALID', `Scene record at index ${index} requires a non-empty id.`, {index}));
        return null;
    }
    return {
        id,
        name: typeof scene.name === 'string' && scene.name.trim() ? scene.name.trim() : 'Scene'
    };
};

const normalizeComponent = (component, nodeId, index, issues) => {
    if (!component || typeof component !== 'object' || Array.isArray(component)) {
        issues.push(createIssue(
            'RUNTIME_COMPONENT_INVALID',
            `Component at index ${index} on node "${nodeId}" must be an object.`,
            {componentIndex: index, nodeId}
        ));
        return null;
    }
    try {
        const normalized = normalizeImportedComponentRecord(component);
        normalized._allowMultipleSpecified = normalized.allowMultipleSpecified;
        delete normalized.allowMultipleSpecified;
        return normalized;
    } catch (error) {
        issues.push(createIssue(
            error.code || 'RUNTIME_COMPONENT_INVALID',
            error.message,
            {componentId: component.id || null, componentIndex: index, nodeId}
        ));
        return null;
    }
};

const resolveComponentTypeDescriptors = (records, componentTypeRegistry, issues) => {
    const byType = new Map();
    records.forEach(record => record.components.forEach(component => {
        const state = byType.get(component.typeId) || {
            explicitCardinalities: new Set(),
            maxSchemaVersion: 1,
            typeId: component.typeId
        };
        if (component._allowMultipleSpecified) {
            state.explicitCardinalities.add(component.allowMultiple ?
                COMPONENT_CARDINALITIES.MANY : COMPONENT_CARDINALITIES.ONE);
        }
        state.maxSchemaVersion = Math.max(state.maxSchemaVersion, component.schemaVersion);
        byType.set(component.typeId, state);
    }));

    const descriptors = [];
    const implicitTypeIds = [];
    byType.forEach(state => {
        const registered = componentTypeRegistry && typeof componentTypeRegistry.get === 'function' ?
            componentTypeRegistry.get(state.typeId) : null;
        const registeredExplicit = registered && !(
            componentTypeRegistry &&
            typeof componentTypeRegistry.isImplicit === 'function' &&
            componentTypeRegistry.isImplicit(state.typeId)
        );
        if (state.explicitCardinalities.size > 1) {
            issues.push(createIssue(
                'RUNTIME_COMPONENT_CARDINALITY_CONFLICT',
                `Imported component type "${state.typeId}" contains conflicting allowMultiple projections.`,
                {typeId: state.typeId}
            ));
            return;
        }
        const explicit = state.explicitCardinalities.size ? Array.from(state.explicitCardinalities)[0] : null;
        if (registered && explicit && registered.cardinality !== explicit) {
            issues.push(createIssue(
                'RUNTIME_COMPONENT_CARDINALITY_CONFLICT',
                `Imported component cardinality conflicts with the registered descriptor for "${state.typeId}".`,
                {typeId: state.typeId}
            ));
            return;
        }
        const descriptor = registered || normalizeRuntimeComponentTypeDescriptor({
            cardinality: explicit || COMPONENT_CARDINALITIES.ONE,
            ownerModuleId: 'ngvge.runtime.compat.import',
            schemaVersion: state.maxSchemaVersion,
            typeId: state.typeId
        });
        descriptors.push(descriptor);
        if (!registered) implicitTypeIds.push(state.typeId);
        records.forEach(record => {
            const matching = record.components.filter(component => component.typeId === state.typeId);
            if (descriptor.cardinality === COMPONENT_CARDINALITIES.ONE && matching.length > 1) {
                issues.push(createIssue(
                    'RUNTIME_COMPONENT_CARDINALITY_VIOLATION',
                    `Node "${record.id}" contains multiple components of cardinality one: ${state.typeId}`,
                    {nodeId: record.id, typeId: state.typeId}
                ));
            }
            matching.forEach(component => {
                component.allowMultiple = descriptor.cardinality === COMPONENT_CARDINALITIES.MANY;
                if (registeredExplicit) {
                    try {
                        if (!componentTypeRegistry ||
                            typeof componentTypeRegistry.migrateImportedRecord !== 'function') {
                            const error = new Error(
                                `Runtime component migration authority is unavailable for: ${state.typeId}`
                            );
                            error.code = 'RUNTIME_COMPONENT_MIGRATION_PATH_MISSING';
                            error.typeId = state.typeId;
                            throw error;
                        }
                        const migrated = componentTypeRegistry.migrateImportedRecord(component);
                        component.data = migrated.data;
                        component.extensionData = migrated.extensionData;
                        component.schemaVersion = migrated.schemaVersion;
                    } catch (error) {
                        issues.push(createIssue(
                            error.code || 'RUNTIME_COMPONENT_MIGRATION_FAILED',
                            error.message || String(error),
                            {
                                componentId: component.id || null,
                                descriptorVersion: Number.isInteger(error.descriptorVersion) ?
                                    error.descriptorVersion : descriptor.schemaVersion,
                                fromVersion: Number.isInteger(error.fromVersion) ? error.fromVersion : undefined,
                                nodeId: record.id,
                                recordVersion: Number.isInteger(error.recordVersion) ?
                                    error.recordVersion : component.schemaVersion,
                                toVersion: Number.isInteger(error.toVersion) ? error.toVersion : undefined,
                                typeId: state.typeId
                            }
                        ));
                    }
                }
                delete component._allowMultipleSpecified;
            });
        });
    });
    return {descriptors, implicitTypeIds};
};

const normalizeNode = (record, index, sceneIds, typeRegistry, issues, warnings) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
        issues.push(createIssue('RUNTIME_NODE_RECORD_INVALID', `Node record at index ${index} must be an object.`, {index}));
        return null;
    }
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const typeId = typeof record.typeId === 'string' ? record.typeId.trim() : '';
    if (!id) {
        issues.push(createIssue('RUNTIME_NODE_ID_INVALID', `Node record at index ${index} requires a non-empty id.`, {index}));
        return null;
    }
    if (!typeId) {
        issues.push(createIssue('RUNTIME_NODE_TYPE_INVALID', `Node "${id}" requires a non-empty typeId.`, {nodeId: id}));
        return null;
    }
    if (id === GLOBAL_ROOT_NODE_ID || Array.from(sceneIds).some(sceneId => id === getSceneRootNodeId(sceneId))) {
        issues.push(createIssue('RUNTIME_NODE_ID_RESERVED', `Node id is reserved by a runtime root: ${id}`, {nodeId: id}));
    }
    const scope = record.scope;
    if (!Object.values(NODE_SCOPES).includes(scope)) {
        issues.push(createIssue('RUNTIME_NODE_SCOPE_INVALID', `Node "${id}" has invalid scope "${scope}".`, {nodeId: id}));
    }
    const sceneId = scope === NODE_SCOPES.SCENE && typeof record.sceneId === 'string' ? record.sceneId.trim() : null;
    if (scope === NODE_SCOPES.SCENE && (!sceneId || !sceneIds.has(sceneId))) {
        issues.push(createIssue(
            'RUNTIME_NODE_SCENE_INVALID',
            `Scene-scoped node "${id}" references an unknown scene.`,
            {nodeId: id, sceneId}
        ));
    }
    if (scope === NODE_SCOPES.GLOBAL && record.sceneId) {
        issues.push(createIssue('RUNTIME_NODE_GLOBAL_SCENE', `Global node "${id}" cannot have a sceneId.`, {nodeId: id}));
    }
    const definition = typeRegistry.get(typeId);
    if (definition && Object.values(NODE_SCOPES).includes(scope) && !definition.allowedScopes.includes(scope)) {
        issues.push(createIssue(
            'RUNTIME_NODE_TYPE_SCOPE_INVALID',
            `Runtime node type "${typeId}" does not support scope "${scope}".`,
            {nodeId: id, typeId}
        ));
    }
    if (!definition) {
        warnings.push(createIssue(
            'RUNTIME_NODE_TYPE_MISSING',
            `Runtime node type is not registered and will use an opaque placeholder: ${typeId}`,
            {nodeId: id, typeId}
        ));
    }
    if (typeof record.parentId !== 'undefined' && record.parentId !== null &&
        (typeof record.parentId !== 'string' || !record.parentId.trim())) {
        issues.push(createIssue('RUNTIME_NODE_PARENT_INVALID', `Node "${id}" has an invalid parentId.`, {nodeId: id}));
    }
    if (typeof record.components !== 'undefined' && !Array.isArray(record.components)) {
        issues.push(createIssue(
            'RUNTIME_NODE_COMPONENTS_INVALID',
            `Node "${id}" must store components in an array.`,
            {nodeId: id}
        ));
    }
    if (typeof record.metadata !== 'undefined' && !isObject(record.metadata)) {
        issues.push(createIssue(
            'RUNTIME_NODE_METADATA_INVALID',
            `Node "${id}" metadata must be an object.`,
            {nodeId: id}
        ));
    }
    if (typeof record.source !== 'undefined' && !isObject(record.source)) {
        issues.push(createIssue(
            'RUNTIME_NODE_SOURCE_INVALID',
            `Node "${id}" source must be an object.`,
            {nodeId: id}
        ));
    }
    const components = Array.isArray(record.components) ? record.components : [];
    const componentIds = new Set();
    const normalizedComponents = components.map((component, componentIndex) => {
        const normalized = normalizeComponent(component, id, componentIndex, issues);
        if (normalized && normalized.id) {
            if (componentIds.has(normalized.id)) {
                issues.push(createIssue(
                    'RUNTIME_COMPONENT_ID_DUPLICATE',
                    `Node "${id}" contains duplicate component id "${normalized.id}".`,
                    {componentId: normalized.id, nodeId: id}
                ));
            }
            componentIds.add(normalized.id);
        }
        return normalized;
    }).filter(Boolean);
    const normalized = cloneRecord(record);
    normalized.id = id;
    normalized.typeId = typeId;
    normalized.name = typeof record.name === 'string' && record.name.trim() ? record.name.trim() : 'Node';
    normalized.scope = scope;
    normalized.sceneId = scope === NODE_SCOPES.SCENE ? sceneId : null;
    const parentIdSpecified = Object.prototype.hasOwnProperty.call(record, 'parentId');
    normalized.parentId = parentIdSpecified ?
        (typeof record.parentId === 'string' ? record.parentId.trim() : null) :
        (scope === NODE_SCOPES.GLOBAL ? GLOBAL_ROOT_NODE_ID : getSceneRootNodeId(sceneId));
    normalized.enabled = record.enabled !== false && record.enabledSelf !== false;
    normalized.metadata = isObject(record.metadata) ? cloneRecord(record.metadata) : {};
    normalized.source = isObject(record.source) ? cloneRecord(record.source) : {};
    normalized.components = normalizedComponents;
    delete normalized.activeInHierarchy;
    delete normalized.childIds;
    delete normalized.state;
    delete normalized.enabledSelf;
    return normalized;
};

const validateParentGraph = (records, sceneIds, issues) => {
    const recordsById = new Map(records.map(record => [record.id, record]));
    records.forEach(record => {
        const parentId = record.parentId;
        if (parentId === null) return;
        if (parentId === GLOBAL_ROOT_NODE_ID) {
            if (record.scope !== NODE_SCOPES.GLOBAL) {
                issues.push(createIssue('RUNTIME_NODE_SCOPE_MISMATCH', `Scene node "${record.id}" cannot use GlobalRoot.`, {nodeId: record.id}));
            }
            return;
        }
        if (record.scope === NODE_SCOPES.SCENE && parentId === getSceneRootNodeId(record.sceneId)) return;
        const parent = recordsById.get(parentId);
        if (!parent) {
            issues.push(createIssue(
                'RUNTIME_NODE_PARENT_MISSING',
                `Node "${record.id}" references missing parent "${parentId}".`,
                {nodeId: record.id, parentId}
            ));
            return;
        }
        if (parent.scope !== record.scope) {
            issues.push(createIssue('RUNTIME_NODE_SCOPE_MISMATCH', `Node "${record.id}" and its parent use different scopes.`, {
                nodeId: record.id,
                parentId
            }));
        }
        if (record.scope === NODE_SCOPES.SCENE && parent.sceneId !== record.sceneId) {
            issues.push(createIssue('RUNTIME_NODE_SCENE_MISMATCH', `Node "${record.id}" and its parent belong to different scenes.`, {
                nodeId: record.id,
                parentId
            }));
        }
    });

    const visitState = new Map();
    const visit = record => {
        const state = visitState.get(record.id);
        if (state === 'visiting') {
            issues.push(createIssue('RUNTIME_NODE_CYCLE', `Runtime node snapshot contains a parent cycle at "${record.id}".`, {
                nodeId: record.id
            }));
            return;
        }
        if (state === 'visited') return;
        visitState.set(record.id, 'visiting');
        const parent = recordsById.get(record.parentId);
        if (parent) visit(parent);
        visitState.set(record.id, 'visited');
    };
    records.forEach(visit);
};

const validateRuntimeNodeSnapshot = (snapshot, options = {}) => {
    const typeRegistry = options.typeRegistry;
    if (!typeRegistry || typeof typeRegistry.get !== 'function') {
        throw new TypeError('Runtime node import validation requires a node type registry.');
    }
    const source = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? cloneRecord(snapshot) : {};
    const issues = [];
    const warnings = [];
    const version = Number.isInteger(source.version) ? source.version : RUNTIME_NODE_MODEL_VERSION;
    if (version > RUNTIME_NODE_MODEL_VERSION) {
        issues.push(createIssue(
            'RUNTIME_NODE_VERSION_UNSUPPORTED',
            `Runtime node state version ${version} is newer than supported version ${RUNTIME_NODE_MODEL_VERSION}.`,
            {version}
        ));
    }
    if (typeof source.scenes !== 'undefined' && !Array.isArray(source.scenes)) {
        issues.push(createIssue('RUNTIME_SCENES_INVALID', 'Runtime node snapshot scenes must be an array.'));
    }
    if (typeof source.nodes !== 'undefined' && !Array.isArray(source.nodes)) {
        issues.push(createIssue('RUNTIME_NODES_INVALID', 'Runtime node snapshot nodes must be an array.'));
    }
    if (typeof source.activeSceneId !== 'undefined' && source.activeSceneId !== null &&
        typeof source.activeSceneId !== 'string') {
        issues.push(createIssue('RUNTIME_ACTIVE_SCENE_TYPE_INVALID', 'activeSceneId must be a string or null.'));
    }
    const scenes = (Array.isArray(source.scenes) ? source.scenes : [])
        .map((scene, index) => normalizeScene(scene, index, issues))
        .filter(Boolean);
    const sceneIds = new Set();
    scenes.forEach(scene => {
        if (sceneIds.has(scene.id)) {
            issues.push(createIssue('RUNTIME_SCENE_ID_DUPLICATE', `Duplicate runtime scene id: ${scene.id}`, {sceneId: scene.id}));
        }
        sceneIds.add(scene.id);
    });
    const activeSceneId = typeof source.activeSceneId === 'string' && source.activeSceneId.trim() ?
        source.activeSceneId.trim() : null;
    if (activeSceneId && !sceneIds.has(activeSceneId)) {
        issues.push(createIssue('RUNTIME_ACTIVE_SCENE_INVALID', `Active runtime scene does not exist: ${activeSceneId}`, {
            sceneId: activeSceneId
        }));
    }
    const records = (Array.isArray(source.nodes) ? source.nodes : [])
        .map((record, index) => normalizeNode(record, index, sceneIds, typeRegistry, issues, warnings))
        .filter(Boolean);
    const componentTypeResolution = resolveComponentTypeDescriptors(
        records,
        options.componentTypeRegistry || null,
        issues
    );
    const nodeIds = new Set();
    records.forEach(record => {
        if (nodeIds.has(record.id)) {
            issues.push(createIssue('RUNTIME_NODE_ID_DUPLICATE', `Duplicate runtime node id: ${record.id}`, {nodeId: record.id}));
        }
        nodeIds.add(record.id);
    });
    validateParentGraph(records, sceneIds, issues);
    if (issues.length) {
        throw new RuntimeNodeImportError(
            `Runtime node snapshot validation failed with ${issues.length} error${issues.length === 1 ? '' : 's'}.`,
            issues
        );
    }
    return {
        activeSceneId,
        componentTypeDescriptors: componentTypeResolution.descriptors,
        implicitComponentTypeIds: componentTypeResolution.implicitTypeIds,
        nodes: records,
        scenes,
        version,
        warnings
    };
};

const getMissingProviderId = typeId => {
    const normalized = typeof typeId === 'string' ? typeId.trim() : '';
    const separator = normalized.lastIndexOf('.');
    return separator > 0 ? normalized.slice(0, separator) : normalized;
};

module.exports = {
    RuntimeNodeImportError,
    getMissingProviderId,
    validateRuntimeNodeSnapshot
};
