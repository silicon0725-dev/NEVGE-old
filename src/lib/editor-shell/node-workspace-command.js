import {getNodeDatabase, installNodeDatabase} from '../project-nodes/node-database';
import {
    RUNTIME_NODE_COMMAND_CAPABILITY_ID,
    createRuntimeNodeEditorClient,
    unwrapRuntimeNodeCommandResult,
    unwrapRuntimeNodeCommandResultAsync
} from '../runtime-nodes';
import {TOOL_IDS} from './tool-registry';

const WORKSPACE_NODE_COMMAND_HOST_ID = 'ngvge.workspace-node-command-host@1';
const WORKSPACE_NODE_COMMAND_CLIENT_ID = 'ngvge.workspace-node-command-client@1';
const PROJECT_NODE_COMPATIBILITY_ADAPTER_ID = 'ngvge.workspace-project-node-compatibility-adapter@1';
const WORKSPACE_NODE_COMMAND_SCHEMA_VERSION = 1;
const SCENE_SYSTEM_MODULE_ID = 'ngvge.scene-system';
const RUNTIME_NODE_MODEL_CAPABILITY_ID = 'ngvge.runtime-node-model';

const WORKSPACE_NODE_COMMAND_TYPES = Object.freeze({
    SELECT: 'SelectNode',
    CREATE: 'CreateNode',
    DESTROY: 'DestroyNode',
    DUPLICATE: 'DuplicateNode',
    PATCH: 'PatchNode',
    REPARENT: 'ReparentNode'
});

const WORKSPACE_NODE_DOMAINS = Object.freeze({
    RUNTIME: 'runtime',
    PROJECT_COMPATIBILITY: 'project-compatibility'
});

const ALLOWED_TOOL_IDS = new Set([TOOL_IDS.NODE_EXPLORER, TOOL_IDS.INSPECTOR, TOOL_IDS.AGENT]);
const INTERACTIVE_TOOL_IDS = new Set([TOOL_IDS.NODE_EXPLORER, TOOL_IDS.INSPECTOR]);
const AGENT_TRANSACTION_AUTHORIZATION = Symbol('ngvge.agent-reviewed-node-command');
const FORBIDDEN_IDENTITY_KEYS = new Set([
    'backendId',
    'editingTargetId',
    'runtimeId',
    'scratchTargetId',
    'target',
    'targetId',
    'vm'
]);

const freezePayload = payload => Object.freeze(Object.assign({}, payload));

const normalizeNodeId = (nodeId, {allowNull = false} = {}) => {
    if (allowNull && (nodeId === null || typeof nodeId === 'undefined' || nodeId === '')) return null;
    if (typeof nodeId !== 'string' || nodeId.length === 0) {
        throw new TypeError('Workspace Node command requires a stable NodeId.');
    }
    return nodeId;
};

const normalizeNodeIds = value => {
    const source = Array.isArray(value) ? value : [value];
    const result = Array.from(new Set(source.map(nodeId => normalizeNodeId(nodeId))));
    if (!result.length) throw new TypeError('Workspace Node command requires at least one stable NodeId.');
    return result;
};

const assertPortableCommand = value => {
    const visit = current => {
        if (!current || typeof current !== 'object') return;
        Object.keys(current).forEach(key => {
            if (FORBIDDEN_IDENTITY_KEYS.has(key)) {
                const error = new Error(`Workspace Node command forbids backend identity field: ${key}`);
                error.code = 'NGVGE_WORKSPACE_NODE_BACKEND_IDENTITY_FORBIDDEN';
                throw error;
            }
            visit(current[key]);
        });
    };
    visit(value);
};

const settleRuntimeResult = result => (
    result && typeof result.then === 'function' ?
        unwrapRuntimeNodeCommandResultAsync(result) :
        unwrapRuntimeNodeCommandResult(result)
);

const createProjectNodeCompatibilityAdapter = nodeDatabase => {
    const requireDatabase = () => {
        if (!nodeDatabase) {
            const error = new Error('Project Node compatibility database is unavailable.');
            error.code = 'NGVGE_WORKSPACE_PROJECT_NODE_COMPATIBILITY_UNAVAILABLE';
            throw error;
        }
        return nodeDatabase;
    };

    const requireNode = nodeId => {
        const node = requireDatabase().getNode(nodeId);
        if (!node || node.targetId) {
            const error = new Error(`Project compatibility NodeId is not editable: ${nodeId}`);
            error.code = 'NGVGE_WORKSPACE_PROJECT_NODE_NOT_EDITABLE';
            throw error;
        }
        return node;
    };

    return Object.freeze({
        adapterId: PROJECT_NODE_COMPATIBILITY_ADAPTER_ID,
        ownsNode: nodeId => Boolean(nodeDatabase && nodeDatabase.getNode(nodeId)),
        getNodeSnapshot (nodeId) {
            const node = requireDatabase().getNode(normalizeNodeId(nodeId));
            return node ? Object.freeze(node) : null;
        },
        createNode ({typeId, parentId = null, options = {}}) {
            const node = requireDatabase().createNode(typeId, parentId, options);
            return freezePayload({node, nodeId: node.id, typeId});
        },
        destroyNodes ({nodeIds}) {
            const ids = normalizeNodeIds(nodeIds);
            ids.forEach(requireNode);
            if (typeof requireDatabase().deleteNodes === 'function') requireDatabase().deleteNodes(ids);
            else ids.forEach(nodeId => requireDatabase().deleteNode(nodeId));
            return freezePayload({destroyed: true, nodeIds: ids});
        },
        duplicateNodes ({nodeIds}) {
            const ids = normalizeNodeIds(nodeIds);
            ids.forEach(requireNode);
            const nodes = typeof requireDatabase().duplicateNodes === 'function' ?
                requireDatabase().duplicateNodes(ids) :
                ids.map(nodeId => requireDatabase().duplicateNode(nodeId)).filter(Boolean);
            return freezePayload({nodes, nodeIds: nodes.map(node => node.id), sourceNodeIds: ids});
        },
        patchNode ({nodeId, patch = {}}) {
            const database = requireDatabase();
            requireNode(nodeId);
            const allowed = new Set(['enabled', 'name', 'properties']);
            Object.keys(patch).forEach(key => {
                if (!allowed.has(key)) throw new TypeError(`Unsupported project compatibility patch field: ${key}`);
            });
            if (Object.prototype.hasOwnProperty.call(patch, 'name')) database.renameNode(nodeId, patch.name);
            if (Object.prototype.hasOwnProperty.call(patch, 'enabled')) database.setNodeEnabled(nodeId, patch.enabled);
            if (patch.properties) {
                Object.keys(patch.properties).forEach(fieldId => {
                    database.setNodeProperty(nodeId, fieldId, patch.properties[fieldId]);
                });
            }
            return freezePayload({node: database.getNode(nodeId), nodeId});
        },
        reparentNodes ({nodeIds, parentId = null, index = null}) {
            const database = requireDatabase();
            const ids = normalizeNodeIds(nodeIds);
            ids.forEach(requireNode);
            if (parentId !== null) normalizeNodeId(parentId);
            if (typeof database.reparentNodes === 'function') database.reparentNodes(ids, parentId, index);
            else ids.forEach(nodeId => database.reparentNode(nodeId, parentId, index));
            return freezePayload({nodeIds: ids, parentId});
        }
    });
};

const createWorkspaceNodeCommandHost = options => {
    const {
        getRuntimeNodeCommandCapability = () => null,
        getRuntimeNodeModel = () => null,
        projectNodeDatabase = null,
        selectionWriter = () => {}
    } = options || {};
    const projectAdapter = createProjectNodeCompatibilityAdapter(projectNodeDatabase);

    const resolveDomain = nodeId => {
        const stableNodeId = normalizeNodeId(nodeId);
        const runtimeNodeModel = getRuntimeNodeModel();
        if (runtimeNodeModel && typeof runtimeNodeModel.getNodeSnapshot === 'function' &&
            runtimeNodeModel.getNodeSnapshot(stableNodeId)) return WORKSPACE_NODE_DOMAINS.RUNTIME;
        if (projectAdapter.ownsNode(stableNodeId)) return WORKSPACE_NODE_DOMAINS.PROJECT_COMPATIBILITY;
        const error = new Error(`Unknown Workspace NodeId: ${stableNodeId}`);
        error.code = 'NGVGE_WORKSPACE_NODE_UNKNOWN';
        throw error;
    };

    const getRuntimeClient = () => {
        const capability = getRuntimeNodeCommandCapability();
        if (!capability) {
            const error = new Error('Runtime Node Engine Protocol capability is unavailable.');
            error.code = 'NGVGE_WORKSPACE_RUNTIME_NODE_COMMAND_UNAVAILABLE';
            throw error;
        }
        return createRuntimeNodeEditorClient(capability);
    };

    const execute = command => {
        if (!command || command.schemaVersion !== WORKSPACE_NODE_COMMAND_SCHEMA_VERSION) {
            throw new TypeError('Workspace Node command requires schemaVersion 1.');
        }
        if (!ALLOWED_TOOL_IDS.has(command.toolId)) {
            throw new TypeError(`Workspace Node command has unsupported ToolId: ${command.toolId}`);
        }
        if (command.toolId === TOOL_IDS.AGENT && command[AGENT_TRANSACTION_AUTHORIZATION] !== true) {
            const error = new Error('Agent Node mutation requires reviewed transaction authorization.');
            error.code = 'NGVGE_AGENT_NODE_REVIEW_REQUIRED';
            throw error;
        }
        if (!Object.values(WORKSPACE_NODE_COMMAND_TYPES).includes(command.type)) {
            throw new TypeError(`Unsupported Workspace Node command: ${command.type}`);
        }
        assertPortableCommand(command);

        if (command.type === WORKSPACE_NODE_COMMAND_TYPES.SELECT) {
            const nodeId = normalizeNodeId(command.nodeId, {allowNull: true});
            selectionWriter(nodeId);
            return freezePayload({nodeId, selected: Boolean(nodeId)});
        }

        if (command.type === WORKSPACE_NODE_COMMAND_TYPES.CREATE) {
            if (!Object.values(WORKSPACE_NODE_DOMAINS).includes(command.domain)) {
                throw new TypeError(`CreateNode requires a stable node domain: ${command.domain}`);
            }
            if (typeof command.typeId !== 'string' || !command.typeId) {
                throw new TypeError('CreateNode requires a stable typeId.');
            }
            if (command.domain === WORKSPACE_NODE_DOMAINS.RUNTIME) {
                return settleRuntimeResult(getRuntimeClient().createNode({
                    options: Object.assign({}, command.options || {}, {
                        parentId: normalizeNodeId(command.parentId)
                    }),
                    typeId: command.typeId
                }));
            }
            return projectAdapter.createNode({
                options: command.options || {},
                parentId: command.parentId || null,
                typeId: command.typeId
            });
        }

        const nodeIds = normalizeNodeIds(command.nodeIds || command.nodeId);
        const domains = Array.from(new Set(nodeIds.map(resolveDomain)));
        if (domains.length !== 1) {
            const error = new Error('Workspace Node command cannot mix runtime and compatibility NodeIds.');
            error.code = 'NGVGE_WORKSPACE_NODE_MIXED_DOMAINS';
            throw error;
        }
        const domain = domains[0];

        if (domain === WORKSPACE_NODE_DOMAINS.RUNTIME) {
            if (nodeIds.length !== 1) {
                const error = new Error(
                    'Runtime Node Engine Protocol commands currently require one NodeId per command.'
                );
                error.code = 'NGVGE_WORKSPACE_RUNTIME_NODE_BATCH_UNSUPPORTED';
                throw error;
            }
            const nodeId = nodeIds[0];
            const client = getRuntimeClient();
            if (command.type === WORKSPACE_NODE_COMMAND_TYPES.DESTROY) {
                return settleRuntimeResult(client.destroyNode({nodeId}));
            }
            if (command.type === WORKSPACE_NODE_COMMAND_TYPES.DUPLICATE) {
                return settleRuntimeResult(client.duplicateNode({nodeId, options: command.options || {}}));
            }
            if (command.type === WORKSPACE_NODE_COMMAND_TYPES.PATCH) {
                return settleRuntimeResult(client.patchNode({nodeId, patch: command.patch || {}}));
            }
            if (command.type === WORKSPACE_NODE_COMMAND_TYPES.REPARENT) {
                return settleRuntimeResult(client.reparentNode({
                    nodeId,
                    options: command.options || {},
                    parentId: normalizeNodeId(command.parentId)
                }));
            }
        }

        if (command.type === WORKSPACE_NODE_COMMAND_TYPES.DESTROY) {
            return projectAdapter.destroyNodes({nodeIds});
        }
        if (command.type === WORKSPACE_NODE_COMMAND_TYPES.DUPLICATE) {
            return projectAdapter.duplicateNodes({nodeIds});
        }
        if (command.type === WORKSPACE_NODE_COMMAND_TYPES.PATCH) {
            if (nodeIds.length !== 1) throw new TypeError('PatchNode requires exactly one NodeId.');
            return projectAdapter.patchNode({nodeId: nodeIds[0], patch: command.patch || {}});
        }
        if (command.type === WORKSPACE_NODE_COMMAND_TYPES.REPARENT) {
            return projectAdapter.reparentNodes({
                index: Object.prototype.hasOwnProperty.call(command, 'index') ? command.index : null,
                nodeIds,
                parentId: command.parentId || null
            });
        }
        throw new TypeError(`Unsupported Workspace Node command path: ${command.type}`);
    };

    const getNodeSnapshot = nodeId => {
        const stableNodeId = normalizeNodeId(nodeId);
        const domain = resolveDomain(stableNodeId);
        const node = domain === WORKSPACE_NODE_DOMAINS.RUNTIME ?
            getRuntimeNodeModel().getNodeSnapshot(stableNodeId) :
            projectAdapter.getNodeSnapshot(stableNodeId);
        return Object.freeze({domain, node});
    };

    return Object.freeze({
        hostId: WORKSPACE_NODE_COMMAND_HOST_ID,
        execute,
        getNodeSnapshot,
        getProjectCompatibilityAdapterId: () => PROJECT_NODE_COMPATIBILITY_ADAPTER_ID,
        resolveDomain
    });
};

const createWorkspaceNodeCommandClient = (host, toolId) => {
    if (!host || typeof host.execute !== 'function') {
        throw new TypeError('Workspace Node command client requires a host.');
    }
    if (!INTERACTIVE_TOOL_IDS.has(toolId)) {
        throw new TypeError(`Unsupported interactive Workspace Node ToolId: ${toolId}`);
    }
    const execute = command => host.execute(Object.assign({
        schemaVersion: WORKSPACE_NODE_COMMAND_SCHEMA_VERSION,
        toolId
    }, command));
    return Object.freeze({
        clientId: WORKSPACE_NODE_COMMAND_CLIENT_ID,
        toolId,
        getNodeSnapshot: ({nodeId}) => host.getNodeSnapshot(nodeId),
        selectNode: ({nodeId}) => execute({type: WORKSPACE_NODE_COMMAND_TYPES.SELECT, nodeId}),
        createNode: ({domain, typeId, parentId, options = {}}) => execute({
            domain, options, parentId, type: WORKSPACE_NODE_COMMAND_TYPES.CREATE, typeId
        }),
        destroyNode: ({nodeId}) => execute({nodeId, type: WORKSPACE_NODE_COMMAND_TYPES.DESTROY}),
        destroyNodes: ({nodeIds}) => execute({nodeIds, type: WORKSPACE_NODE_COMMAND_TYPES.DESTROY}),
        duplicateNode: ({nodeId, options = {}}) => execute({
            nodeId, options, type: WORKSPACE_NODE_COMMAND_TYPES.DUPLICATE
        }),
        duplicateNodes: ({nodeIds, options = {}}) => execute({
            nodeIds, options, type: WORKSPACE_NODE_COMMAND_TYPES.DUPLICATE
        }),
        patchNode: ({nodeId, patch}) => execute({nodeId, patch, type: WORKSPACE_NODE_COMMAND_TYPES.PATCH}),
        reparentNode: ({nodeId, parentId, options = {}}) => execute({
            nodeId, options, parentId, type: WORKSPACE_NODE_COMMAND_TYPES.REPARENT
        }),
        reparentNodes: ({nodeIds, parentId, index = null}) => execute({
            index, nodeIds, parentId, type: WORKSPACE_NODE_COMMAND_TYPES.REPARENT
        })
    });
};

const createReviewedAgentNodeCommandClient = host => {
    if (!host || typeof host.execute !== 'function' || typeof host.getNodeSnapshot !== 'function') {
        throw new TypeError('Reviewed Agent Node command client requires a Workspace Node command host.');
    }
    const execute = command => host.execute(Object.assign({
        schemaVersion: WORKSPACE_NODE_COMMAND_SCHEMA_VERSION,
        toolId: TOOL_IDS.AGENT,
        [AGENT_TRANSACTION_AUTHORIZATION]: true
    }, command));
    return Object.freeze({
        clientId: `${WORKSPACE_NODE_COMMAND_CLIENT_ID}:reviewed-agent`,
        toolId: TOOL_IDS.AGENT,
        getNodeSnapshot: ({nodeId}) => host.getNodeSnapshot(nodeId),
        createNode: ({domain, typeId, parentId, options = {}}) => execute({
            domain, options, parentId, type: WORKSPACE_NODE_COMMAND_TYPES.CREATE, typeId
        }),
        destroyNode: ({nodeId}) => execute({nodeId, type: WORKSPACE_NODE_COMMAND_TYPES.DESTROY}),
        duplicateNode: ({nodeId, options = {}}) => execute({
            nodeId, options, type: WORKSPACE_NODE_COMMAND_TYPES.DUPLICATE
        }),
        patchNode: ({nodeId, patch}) => execute({nodeId, patch, type: WORKSPACE_NODE_COMMAND_TYPES.PATCH}),
        reparentNode: ({nodeId, parentId, options = {}}) => execute({
            nodeId, options, parentId, type: WORKSPACE_NODE_COMMAND_TYPES.REPARENT
        })
    });
};

const createWorkspaceNodeCommandHostForVM = ({vm, selectionWriter}) => {
    const runtime = vm && vm.runtime;
    const projectNodeDatabase = runtime ? (getNodeDatabase(runtime) || installNodeDatabase(vm)) : null;
    const getModuleManager = () => (vm && vm.runtime ? vm.runtime.ngvgeFirstPartyModules : null);
    const isSceneSystemEnabled = moduleManager => {
        if (!moduleManager || typeof moduleManager.getModuleState !== 'function') return false;
        const state = moduleManager.getModuleState(SCENE_SYSTEM_MODULE_ID);
        return Boolean(state && state.enabled);
    };
    return createWorkspaceNodeCommandHost({
        projectNodeDatabase,
        selectionWriter,
        getRuntimeNodeCommandCapability: () => {
            const moduleManager = getModuleManager();
            return isSceneSystemEnabled(moduleManager) ?
                moduleManager.getCapability(RUNTIME_NODE_COMMAND_CAPABILITY_ID) : null;
        },
        getRuntimeNodeModel: () => {
            const moduleManager = getModuleManager();
            return isSceneSystemEnabled(moduleManager) ?
                moduleManager.getCapability(RUNTIME_NODE_MODEL_CAPABILITY_ID) : null;
        }
    });
};

const createWorkspaceNodeCommandClientForVM = ({vm, selectionWriter, toolId}) => (
    createWorkspaceNodeCommandClient(createWorkspaceNodeCommandHostForVM({vm, selectionWriter}), toolId)
);

export {
    PROJECT_NODE_COMPATIBILITY_ADAPTER_ID,
    WORKSPACE_NODE_COMMAND_CLIENT_ID,
    WORKSPACE_NODE_COMMAND_HOST_ID,
    WORKSPACE_NODE_COMMAND_SCHEMA_VERSION,
    WORKSPACE_NODE_COMMAND_TYPES,
    WORKSPACE_NODE_DOMAINS,
    createProjectNodeCompatibilityAdapter,
    createReviewedAgentNodeCommandClient,
    createWorkspaceNodeCommandClient,
    createWorkspaceNodeCommandClientForVM,
    createWorkspaceNodeCommandHost,
    createWorkspaceNodeCommandHostForVM
};
