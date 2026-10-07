import {STABLE_ID_KINDS, assertStableIdentity} from '../../core/identity';
import {createStableNodeId} from '../identity/host-stable-id-factory';
import {getInspectorRegistry} from '../project-inspector/inspector-registry';
import {getPropertyHistory} from '../project-inspector/property-history';
import {installProjectLifecycleHost} from '../project-lifecycle';
import {createScratchTargetTopologySignature} from '../scratch-sprite-adapter/scratch-runtime-update-policy';
import {migrateLegacyTargetDerivedNodeIds} from './legacy-node-identity-migration';
import {getNodeTypeRegistry} from './node-type-registry';

const DATABASE_PROPERTY = 'ngvgeNodeDatabase';
const DATABASE_SECTION_ID = 'ngvge-node-tree';
const DATABASE_VERSION = 4;
const LIFECYCLE_HOOK_ID = 'ngvge.project-lifecycle.node-database@1';

const cloneSerializable = value => JSON.parse(JSON.stringify(value));

const getOriginalTargets = runtime => (
    runtime && Array.isArray(runtime.targets) ?
        runtime.targets.filter(target => target && target.isOriginal) : []
);

const getTargetName = target => (
    target && typeof target.getName === 'function' ? target.getName() : (target && target.sprite ? target.sprite.name : '')
);

const normalizeName = (name, fallback = 'Node') => {
    const value = typeof name === 'string' ? name.trim() : '';
    return value || fallback;
};

const createTargetNode = (target, nodeIdFactory) => ({
    childIds: [],
    enabled: true,
    id: nodeIdFactory(),
    name: getTargetName(target) || (target.isStage ? 'Stage' : 'Sprite'),
    parentId: null,
    properties: {},
    targetId: target.id,
    typeId: target.isStage ? 'ngvge.stage-target' : 'ngvge.sprite-target'
});

const createNodeDatabase = (vm, options = {}) => {
    const runtime = vm.runtime;
    const nodeTypes = getNodeTypeRegistry(runtime);
    const history = getPropertyHistory(runtime);
    const nodes = new Map();
    const listeners = new Set();
    let revision = 0;
    let isApplyingHistory = false;
    const expandedNodeIds = new Set();
    const rawNodeIdFactory = typeof options.nodeIdFactory === 'function' ? options.nodeIdFactory : createStableNodeId;
    const createOwnedNodeId = () => {
        const nodeId = rawNodeIdFactory();
        assertStableIdentity(nodeId, STABLE_ID_KINDS.NODE);
        return nodeId;
    };

    const emit = change => {
        revision += 1;
        listeners.forEach(listener => listener(Object.assign({revision}, change)));
    };

    const markChanged = change => {
        if (runtime && typeof runtime.emitProjectChanged === 'function') runtime.emitProjectChanged();
        emit(change);
    };

    const ensureUniqueName = (name, parentId, ignoreId = null) => {
        const base = normalizeName(name);
        const used = new Set(
            Array.from(nodes.values())
                .filter(node => node.parentId === parentId && node.id !== ignoreId)
                .map(node => node.name)
        );
        if (!used.has(base)) return base;
        let index = 2;
        while (used.has(`${base} ${index}`)) index += 1;
        return `${base} ${index}`;
    };

    const getNode = nodeId => {
        const node = nodes.get(nodeId);
        return node ? cloneSerializable(node) : null;
    };

    const listNodes = () => Array.from(nodes.values()).map(cloneSerializable);

    const getChildren = parentId => {
        const parent = parentId ? nodes.get(parentId) : null;
        const childIds = parent ? parent.childIds : Array.from(nodes.values())
            .filter(node => node.parentId === null)
            .map(node => node.id);
        return childIds
            .map(childId => nodes.get(childId))
            .filter(Boolean)
            .map(cloneSerializable);
    };

    const getParent = nodeId => {
        const node = nodes.get(nodeId);
        return node && node.parentId ? getNode(node.parentId) : null;
    };

    const getNodeForTarget = targetId => {
        const node = Array.from(nodes.values()).find(candidate => candidate.targetId === targetId);
        return node ? cloneSerializable(node) : null;
    };

    const getNearestTargetNode = nodeId => {
        let current = nodes.get(nodeId);
        const visited = new Set();
        while (current && !visited.has(current.id)) {
            visited.add(current.id);
            if (current.targetId) return cloneSerializable(current);
            current = current.parentId ? nodes.get(current.parentId) : null;
        }
        return null;
    };

    const normalizeHierarchy = () => {
        nodes.forEach(node => {
            node.childIds = Array.isArray(node.childIds) ? node.childIds.filter(childId => nodes.has(childId)) : [];
            if (node.parentId && !nodes.has(node.parentId)) node.parentId = null;
        });
        nodes.forEach(node => {
            if (!node.parentId) return;
            const parent = nodes.get(node.parentId);
            if (parent && parent.childIds.indexOf(node.id) === -1) parent.childIds.push(node.id);
        });
    };

    const captureSnapshot = () => ({
        nodes: Array.from(nodes.values()).map(cloneSerializable)
    });

    const applySnapshot = snapshot => {
        isApplyingHistory = true;
        nodes.clear();
        const records = snapshot && Array.isArray(snapshot.nodes) ? snapshot.nodes : [];
        records.forEach(record => {
            if (!record || typeof record.id !== 'string') return;
            nodes.set(record.id, Object.assign({
                childIds: [],
                enabled: true,
                name: 'Node',
                parentId: null,
                properties: {},
                targetId: null,
                typeId: 'ngvge.node2d'
            }, cloneSerializable(record)));
        });
        normalizeHierarchy();
        Array.from(expandedNodeIds).forEach(nodeId => {
            if (!nodes.has(nodeId)) expandedNodeIds.delete(nodeId);
        });
        syncTargets({silent: true});
        isApplyingHistory = false;
        markChanged({type: 'history:apply'});
    };

    const recordMutation = (label, before, after) => {
        if (isApplyingHistory || !history) return;
        history.recordValue({
            after,
            apply: applySnapshot,
            before,
            label,
            metadata: {type: 'node-tree'}
        });
    };

    const mutate = (label, operation) => {
        const before = captureSnapshot();
        const result = operation();
        const after = captureSnapshot();
        recordMutation(label, before, after);
        markChanged({label, type: 'mutation'});
        return result;
    };

    function syncTargets (options = {}) {
        const originalTargets = getOriginalTargets(runtime);
        const targetIds = new Set(originalTargets.map(target => target.id));

        originalTargets.forEach(target => {
            let node = Array.from(nodes.values()).find(candidate => candidate.targetId === target.id) || null;
            if (!node) {
                node = createTargetNode(target, createOwnedNodeId);
                nodes.set(node.id, node);
            } else {
                node.targetId = target.id;
                node.name = getTargetName(target) || node.name;
                node.typeId = target.isStage ? 'ngvge.stage-target' : 'ngvge.sprite-target';
                node.enabled = true;
                node.properties = node.properties || {};
                node.childIds = Array.isArray(node.childIds) ? node.childIds : [];
            }
        });

        const removedTargetNodeIds = Array.from(nodes.values())
            .filter(node => node.targetId && !targetIds.has(node.targetId))
            .map(node => node.id);
        const removeSubtree = nodeId => {
            const node = nodes.get(nodeId);
            if (!node) return;
            node.childIds.slice().forEach(removeSubtree);
            if (node.parentId) {
                const parent = nodes.get(node.parentId);
                if (parent) parent.childIds = parent.childIds.filter(childId => childId !== nodeId);
            }
            nodes.delete(nodeId);
            expandedNodeIds.delete(nodeId);
        };
        removedTargetNodeIds.forEach(removeSubtree);

        normalizeHierarchy();
        Array.from(expandedNodeIds).forEach(nodeId => {
            if (!nodes.has(nodeId)) expandedNodeIds.delete(nodeId);
        });
        if (!options.silent) emit({type: 'targets:sync'});
    }

    const createNode = (typeId, parentId = null, options = {}) => {
        const nodeType = nodeTypes.getType(typeId);
        if (!nodeType || nodeType.hidden) throw new Error(`Unknown or unavailable node type: ${typeId}`);
        if (parentId && !nodes.has(parentId)) throw new Error('Parent node does not exist');
        if (parentId) {
            const parentType = nodeTypes.getType(nodes.get(parentId).typeId);
            if (parentType && parentType.allowChildren === false) {
                throw new Error(`${parentType.label} cannot contain child nodes`);
            }
        }

        return mutate(`Create ${nodeType.label}`, () => {
            const id = createOwnedNodeId();
            const node = {
                childIds: [],
                enabled: options.enabled !== false,
                id,
                name: ensureUniqueName(options.name || nodeType.label, parentId),
                parentId,
                pluginId: nodeType.pluginId || null,
                properties: Object.assign({}, cloneSerializable(nodeType.defaults || {}), cloneSerializable(options.properties || {})),
                targetId: null,
                typeId
            };
            nodes.set(id, node);
            if (parentId) nodes.get(parentId).childIds.push(id);
            return cloneSerializable(node);
        });
    };

    const duplicateNode = nodeId => {
        const sourceNode = nodes.get(nodeId);
        if (!sourceNode || sourceNode.targetId) return null;

        return mutate(`Duplicate ${sourceNode.name}`, () => {
            const cloneSubtree = (sourceId, parentId, isRoot = false) => {
                const source = nodes.get(sourceId);
                if (!source) return null;
                const id = createOwnedNodeId();
                const clone = {
                    childIds: [],
                    enabled: source.enabled !== false,
                    id,
                    name: ensureUniqueName(isRoot ? `${source.name} Copy` : source.name, parentId),
                    parentId,
                    pluginId: source.pluginId || null,
                    properties: cloneSerializable(source.properties || {}),
                    targetId: null,
                    typeId: source.typeId
                };
                nodes.set(id, clone);
                if (parentId) {
                    const parent = nodes.get(parentId);
                    if (parent) parent.childIds.push(id);
                }
                source.childIds.forEach(childId => cloneSubtree(childId, id));
                return clone;
            };

            const duplicate = cloneSubtree(sourceNode.id, sourceNode.parentId, true);
            return duplicate ? cloneSerializable(duplicate) : null;
        });
    };

    const renameNode = (nodeId, name) => {
        const node = nodes.get(nodeId);
        if (!node || node.targetId) return null;
        const nextName = ensureUniqueName(name, node.parentId, node.id);
        if (nextName === node.name) return getNode(nodeId);
        return mutate(`Rename ${node.name}`, () => {
            node.name = nextName;
            return cloneSerializable(node);
        });
    };

    const setNodeEnabled = (nodeId, enabled) => {
        const node = nodes.get(nodeId);
        if (!node || node.targetId) return null;
        const nextEnabled = Boolean(enabled);
        if (node.enabled === nextEnabled) return getNode(nodeId);
        return mutate(`${nextEnabled ? 'Enable' : 'Disable'} ${node.name}`, () => {
            node.enabled = nextEnabled;
            return cloneSerializable(node);
        });
    };

    const setNodeProperty = (nodeId, propertyId, value) => {
        const node = nodes.get(nodeId);
        if (!node || node.targetId || typeof propertyId !== 'string') return null;
        const before = node.properties[propertyId];
        if (before === value) return getNode(nodeId);
        return mutate(`Set ${node.name}.${propertyId}`, () => {
            node.properties[propertyId] = value;
            return cloneSerializable(node);
        });
    };

    const isDescendant = (nodeId, possibleAncestorId) => {
        let current = nodes.get(nodeId);
        const visited = new Set();
        while (current && current.parentId && !visited.has(current.id)) {
            visited.add(current.id);
            if (current.parentId === possibleAncestorId) return true;
            current = nodes.get(current.parentId);
        }
        return false;
    };

    const normalizeMutableRootIds = nodeIds => {
        const uniqueIds = Array.from(new Set(Array.isArray(nodeIds) ? nodeIds : [nodeIds]))
            .filter(nodeId => typeof nodeId === 'string' && nodes.has(nodeId))
            .filter(nodeId => !nodes.get(nodeId).targetId);
        return uniqueIds.filter(nodeId => !uniqueIds.some(otherId => (
            otherId !== nodeId && isDescendant(nodeId, otherId)
        )));
    };

    const canReparentNodes = (nodeIds, parentId = null) => {
        const rootIds = normalizeMutableRootIds(nodeIds);
        if (!rootIds.length) return {error: 'No movable nodes selected', nodeIds: [], ok: false};
        if (parentId && !nodes.has(parentId)) return {error: 'Parent node does not exist', nodeIds: rootIds, ok: false};
        const nextParent = parentId ? nodes.get(parentId) : null;
        if (nextParent) {
            const parentType = nodeTypes.getType(nextParent.typeId);
            if (parentType && parentType.allowChildren === false) {
                return {error: `${parentType.label} cannot contain child nodes`, nodeIds: rootIds, ok: false};
            }
        }
        const invalid = rootIds.some(nodeId => parentId === nodeId || (parentId && isDescendant(parentId, nodeId)));
        if (invalid) return {error: 'A node cannot be parented below itself', nodeIds: rootIds, ok: false};
        return {error: null, nodeIds: rootIds, ok: true};
    };

    const reparentNodes = (nodeIds, parentId = null, index = null) => {
        const validation = canReparentNodes(nodeIds, parentId);
        if (!validation.ok) throw new Error(validation.error);
        const rootIds = validation.nodeIds;
        if (rootIds.every(nodeId => nodes.get(nodeId).parentId === parentId)) {
            return rootIds.map(getNode);
        }
        const names = rootIds.map(nodeId => nodes.get(nodeId).name);
        return mutate(`Reparent ${names.length === 1 ? names[0] : `${names.length} nodes`}`, () => {
            rootIds.forEach(nodeId => {
                const node = nodes.get(nodeId);
                if (!node || !node.parentId) return;
                const previousParent = nodes.get(node.parentId);
                if (previousParent) {
                    previousParent.childIds = previousParent.childIds.filter(childId => childId !== node.id);
                }
            });
            const nextParent = parentId ? nodes.get(parentId) : null;
            let insertIndex = Number.isInteger(index) ? Math.max(0, index) : null;
            rootIds.forEach(nodeId => {
                const node = nodes.get(nodeId);
                if (!node) return;
                node.parentId = parentId;
                if (nextParent) {
                    const resolvedIndex = insertIndex === null ? nextParent.childIds.length :
                        Math.min(insertIndex, nextParent.childIds.length);
                    nextParent.childIds.splice(resolvedIndex, 0, node.id);
                    if (insertIndex !== null) insertIndex += 1;
                }
            });
            return rootIds.map(getNode);
        });
    };

    const setNodesEnabled = (nodeIds, enabled) => {
        const rootIds = normalizeMutableRootIds(nodeIds);
        if (!rootIds.length) return [];
        const subtreeIds = Array.from(new Set(rootIds.reduce((ids, nodeId) => (
            ids.concat(collectSubtreeIds(nodeId))
        ), []))).filter(nodeId => {
            const node = nodes.get(nodeId);
            return node && !node.targetId;
        });
        const nextEnabled = Boolean(enabled);
        if (subtreeIds.every(nodeId => nodes.get(nodeId).enabled === nextEnabled)) {
            return subtreeIds.map(getNode);
        }
        return mutate(`${nextEnabled ? 'Enable' : 'Disable'} ${subtreeIds.length} nodes`, () => {
            subtreeIds.forEach(nodeId => {
                nodes.get(nodeId).enabled = nextEnabled;
            });
            return subtreeIds.map(getNode);
        });
    };

    const duplicateNodes = nodeIds => {
        const rootIds = normalizeMutableRootIds(nodeIds);
        if (!rootIds.length) return [];
        const label = rootIds.length === 1 ? nodes.get(rootIds[0]).name : `${rootIds.length} nodes`;
        return mutate(`Duplicate ${label}`, () => {
            const duplicates = [];
            const cloneSubtree = (sourceId, parentId, isRoot = false) => {
                const source = nodes.get(sourceId);
                if (!source) return null;
                const id = createOwnedNodeId();
                const clone = {
                    childIds: [],
                    enabled: source.enabled !== false,
                    id,
                    name: ensureUniqueName(isRoot ? `${source.name} Copy` : source.name, parentId),
                    parentId,
                    pluginId: source.pluginId || null,
                    properties: cloneSerializable(source.properties || {}),
                    targetId: null,
                    typeId: source.typeId
                };
                nodes.set(id, clone);
                if (parentId) {
                    const parent = nodes.get(parentId);
                    if (parent) parent.childIds.push(id);
                }
                source.childIds.forEach(childId => cloneSubtree(childId, id));
                return clone;
            };
            rootIds.forEach(nodeId => {
                const source = nodes.get(nodeId);
                const duplicate = cloneSubtree(nodeId, source.parentId, true);
                if (duplicate) duplicates.push(cloneSerializable(duplicate));
            });
            return duplicates;
        });
    };

    const reparentNode = (nodeId, parentId = null, index = null) => {
        const node = nodes.get(nodeId);
        if (!node || node.targetId) return null;
        if (parentId === nodeId || isDescendant(parentId, nodeId)) throw new Error('A node cannot be parented below itself');
        if (parentId && !nodes.has(parentId)) throw new Error('Parent node does not exist');
        const nextParent = parentId ? nodes.get(parentId) : null;
        if (nextParent) {
            const parentType = nodeTypes.getType(nextParent.typeId);
            if (parentType && parentType.allowChildren === false) throw new Error(`${parentType.label} cannot contain child nodes`);
        }
        if (node.parentId === parentId) return getNode(nodeId);

        return mutate(`Reparent ${node.name}`, () => {
            if (node.parentId) {
                const previousParent = nodes.get(node.parentId);
                if (previousParent) previousParent.childIds = previousParent.childIds.filter(childId => childId !== node.id);
            }
            node.parentId = parentId;
            if (nextParent) {
                const insertIndex = Number.isInteger(index) ? Math.max(0, Math.min(index, nextParent.childIds.length)) : nextParent.childIds.length;
                nextParent.childIds.splice(insertIndex, 0, node.id);
            }
            return cloneSerializable(node);
        });
    };

    const collectSubtreeIds = nodeId => {
        const ids = [];
        const visit = currentId => {
            const current = nodes.get(currentId);
            if (!current || ids.indexOf(currentId) !== -1) return;
            ids.push(currentId);
            current.childIds.forEach(visit);
        };
        visit(nodeId);
        return ids;
    };

    const deleteNode = nodeId => {
        const node = nodes.get(nodeId);
        if (!node || node.targetId) return false;
        return mutate(`Delete ${node.name}`, () => {
            const subtreeIds = collectSubtreeIds(nodeId);
            if (node.parentId) {
                const parent = nodes.get(node.parentId);
                if (parent) parent.childIds = parent.childIds.filter(childId => childId !== nodeId);
            }
            subtreeIds.forEach(id => {
                nodes.delete(id);
                expandedNodeIds.delete(id);
            });
            return true;
        });
    };

    const deleteNodes = nodeIds => {
        const rootIds = normalizeMutableRootIds(nodeIds);
        if (!rootIds.length) return false;
        const names = rootIds.map(nodeId => nodes.get(nodeId).name);
        return mutate(`Delete ${names.length === 1 ? names[0] : `${names.length} nodes`}`, () => {
            rootIds.forEach(nodeId => {
                const node = nodes.get(nodeId);
                if (!node) return;
                if (node.parentId) {
                    const parent = nodes.get(node.parentId);
                    if (parent) parent.childIds = parent.childIds.filter(childId => childId !== nodeId);
                }
                collectSubtreeIds(nodeId).forEach(id => {
                    nodes.delete(id);
                    expandedNodeIds.delete(id);
                });
            });
            return true;
        });
    };

    const getExpandedNodeIds = () => Array.from(expandedNodeIds);

    const setNodeExpanded = (nodeId, expanded) => {
        if (!nodes.has(nodeId)) return false;
        const nextExpanded = Boolean(expanded);
        const currentlyExpanded = expandedNodeIds.has(nodeId);
        if (currentlyExpanded === nextExpanded) return false;
        if (nextExpanded) expandedNodeIds.add(nodeId);
        else expandedNodeIds.delete(nodeId);
        markChanged({expanded: nextExpanded, nodeId, type: 'editor:expanded'});
        return true;
    };

    const serializeProject = () => {
        syncTargets({silent: true});
        const originalTargets = getOriginalTargets(runtime);
        const targetBindings = originalTargets.map(target => {
            const node = Array.from(nodes.values()).find(candidate => candidate.targetId === target.id);
            return node ? node.id : null;
        });
        const records = Array.from(nodes.values()).map(node => {
            const serialized = cloneSerializable(node);
            delete serialized.targetId;
            return serialized;
        });
        return {
            editorState: {
                expandedNodeIds: getExpandedNodeIds()
            },
            nodes: records,
            targetBindings,
            version: DATABASE_VERSION
        };
    };

    const deserializeProject = data => {
        nodes.clear();
        const migration = migrateLegacyTargetDerivedNodeIds(data, createOwnedNodeId);
        const migratedData = migration.data;
        const records = migratedData && Array.isArray(migratedData.nodes) ? migratedData.nodes : [];
        records.forEach(record => {
            if (!record || typeof record.id !== 'string') return;
            nodes.set(record.id, Object.assign({
                childIds: [],
                enabled: true,
                name: 'Node',
                parentId: null,
                properties: {},
                targetId: null,
                typeId: 'ngvge.node2d'
            }, cloneSerializable(record), {targetId: null}));
        });

        const originalTargets = getOriginalTargets(runtime);
        const bindings = migratedData && Array.isArray(migratedData.targetBindings) ? migratedData.targetBindings : [];
        originalTargets.forEach((target, index) => {
            const bindingId = bindings[index];
            let node = bindingId ? nodes.get(bindingId) : null;
            if (!node) {
                node = createTargetNode(target, createOwnedNodeId);
                nodes.set(node.id, node);
            } else {
                node.targetId = target.id;
                node.name = getTargetName(target) || node.name;
                node.typeId = target.isStage ? 'ngvge.stage-target' : 'ngvge.sprite-target';
                node.childIds = Array.isArray(node.childIds) ? node.childIds : [];
            }
        });
        normalizeHierarchy();
        expandedNodeIds.clear();
        const persistedExpandedNodeIds = migratedData && migratedData.editorState && Array.isArray(migratedData.editorState.expandedNodeIds) ?
            migratedData.editorState.expandedNodeIds : [];
        persistedExpandedNodeIds.forEach(nodeId => {
            if (nodes.has(nodeId)) expandedNodeIds.add(nodeId);
        });
        syncTargets({silent: true});
        emit({type: 'persistence:restore'});
    };

    const reset = options => {
        nodes.clear();
        expandedNodeIds.clear();
        syncTargets({silent: true});
        if (!options || !options.silent) emit({type: 'reset'});
    };

    syncTargets({silent: true});

    return {
        version: DATABASE_VERSION,
        canReparentNodes,
        createNode,
        deleteNode,
        deleteNodes,
        duplicateNode,
        duplicateNodes,
        deserializeProject,
        getChildren,
        getExpandedNodeIds,
        getNearestTargetNode,
        getNode,
        getNodeForTarget,
        getNodeType: nodeTypeId => nodeTypes.getType(nodeTypeId),
        getParent,
        getRevision: () => revision,
        listNodeTypes: options => nodeTypes.listTypes(options),
        listNodes,
        reparentNode,
        reparentNodes,
        renameNode,
        reset,
        serializeProject,
        setNodeEnabled,
        setNodeExpanded,
        setNodeProperty,
        setNodesEnabled,
        subscribe (listener) {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        syncTargets
    };
};

const installNodeDatabase = vm => {
    if (!vm || !vm.runtime) return null;
    const runtime = vm.runtime;
    const current = runtime[DATABASE_PROPERTY];
    if (current && current.version === DATABASE_VERSION) return current;

    const database = createNodeDatabase(vm);
    runtime[DATABASE_PROPERTY] = database;

    const inspectorRegistry = getInspectorRegistry(runtime);
    inspectorRegistry.register({
        clearOnMissing: true,
        hidden: true,
        id: DATABASE_SECTION_ID,
        label: 'Node Tree',
        order: -900,
        deserializeProject: data => database.deserializeProject(data),
        getFields: () => [],
        serializeProject: () => database.serializeProject(),
        setValue: () => {}
    });

    if (vm && typeof vm.on === 'function') {
        let lastTargetTopologySignature = createScratchTargetTopologySignature(vm);
        vm.on('targetsUpdate', () => {
            const nextTargetTopologySignature = createScratchTargetTopologySignature(vm);
            if (nextTargetTopologySignature === lastTargetTopologySignature) return;
            lastTargetTopologySignature = nextTargetTopologySignature;
            database.syncTargets();
        });
    }

    const lifecycle = installProjectLifecycleHost(vm);
    if (lifecycle) {
        lifecycle.registerHook({
            id: LIFECYCLE_HOOK_ID,
            priority: -700,
            beforeLoad: () => database.reset({silent: true})
        });
    }

    return database;
};

const getNodeDatabase = runtime => (
    runtime && runtime[DATABASE_PROPERTY] ? runtime[DATABASE_PROPERTY] : null
);

export {
    DATABASE_PROPERTY,
    DATABASE_SECTION_ID,
    DATABASE_VERSION,
    createNodeDatabase,
    getNodeDatabase,
    installNodeDatabase
};
