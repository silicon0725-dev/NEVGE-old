import {
    WORKSPACE_NODE_COMMAND_TYPES,
    WORKSPACE_NODE_DOMAINS,
    createReviewedAgentNodeCommandClient
} from './node-workspace-command';
import {
    AGENT_CHANGESET_STATES,
    WORKSPACE_AGENT_CHANGESET_MODEL_ID
} from './agent-change-set';

const WORKSPACE_AGENT_TRANSACTION_HOST_ID = 'ngvge.workspace-agent-transaction-host@1';
const AGENT_TRANSACTION_SCHEMA_VERSION = 1;

const AGENT_TRANSACTION_STATES = Object.freeze({
    COMMITTED: 'committed',
    ROLLED_BACK: 'rolled-back',
    FAILED: 'failed',
    ROLLBACK_FAILED: 'rollback-failed'
});

let transactionSequence = 0;

const clone = value => JSON.parse(JSON.stringify(value));
const freeze = value => Object.freeze(value);

const getCreatedNodeId = result => {
    if (!result || typeof result !== 'object') return null;
    if (typeof result.nodeId === 'string') return result.nodeId;
    if (result.node && typeof result.node.id === 'string') return result.node.id;
    if (Array.isArray(result.nodeIds) && result.nodeIds.length === 1) return result.nodeIds[0];
    return null;
};

const createInversePatch = (snapshot, patch) => {
    const node = snapshot && snapshot.node;
    if (!node) throw new Error('Agent transaction cannot snapshot Node for reversible patch.');
    const inverse = {};
    const runtime = snapshot.domain === WORKSPACE_NODE_DOMAINS.RUNTIME;
    Object.keys(patch || {}).forEach(key => {
        if (key === 'enabled' || (runtime && key === 'enabledSelf')) {
            inverse.enabled = Boolean(node.enabledSelf ?? node.enabled);
        } else if (key === 'name') {
            inverse.name = node.name;
        } else if (runtime && key === 'source') {
            inverse.source = clone(node.source || {});
        } else if (!runtime && key === 'properties') {
            inverse.properties = {};
            Object.keys(patch.properties || {}).forEach(fieldId => {
                if (!Object.prototype.hasOwnProperty.call(node.properties || {}, fieldId)) {
                    const error = new Error(
                        `Agent cannot rollback a newly introduced project property: ${fieldId}`
                    );
                    error.code = 'NGVGE_AGENT_PATCH_ROLLBACK_UNAVAILABLE';
                    throw error;
                }
                inverse.properties[fieldId] = clone(node.properties[fieldId]);
            });
        } else {
            throw new TypeError(`Agent transaction cannot generate rollback for patch field: ${key}`);
        }
    });
    return inverse;
};

const createWorkspaceAgentTransactionHost = ({workspaceNodeCommandHost}) => {
    const nodeClient = createReviewedAgentNodeCommandClient(workspaceNodeCommandHost);
    const transactions = new Map();

    const executeCompensation = async compensation => {
        if (!compensation) return;
        if (compensation.type === WORKSPACE_NODE_COMMAND_TYPES.DESTROY) {
            await nodeClient.destroyNode({nodeId: compensation.nodeId});
            return;
        }
        if (compensation.type === WORKSPACE_NODE_COMMAND_TYPES.PATCH) {
            await nodeClient.patchNode({nodeId: compensation.nodeId, patch: compensation.patch});
            return;
        }
        if (compensation.type === WORKSPACE_NODE_COMMAND_TYPES.REPARENT) {
            await nodeClient.reparentNode({
                nodeId: compensation.nodeId,
                parentId: compensation.parentId,
                options: compensation.options || {}
            });
            return;
        }
        throw new TypeError(`Unsupported Agent transaction compensation: ${compensation.type}`);
    };

    const prepareOperation = operation => {
        const command = operation.command;
        if (command.type === WORKSPACE_NODE_COMMAND_TYPES.CREATE) {
            return {
                execute: () => nodeClient.createNode({
                    domain: command.domain,
                    typeId: command.typeId,
                    parentId: command.parentId,
                    options: command.options || {}
                }),
                compensationFromResult: result => {
                    const nodeId = getCreatedNodeId(result);
                    if (!nodeId) throw new Error('CreateNode did not return a stable NodeId for rollback.');
                    return {type: WORKSPACE_NODE_COMMAND_TYPES.DESTROY, nodeId};
                }
            };
        }

        if (command.type === WORKSPACE_NODE_COMMAND_TYPES.DUPLICATE) {
            return {
                execute: () => nodeClient.duplicateNode({nodeId: command.nodeId, options: command.options || {}}),
                compensationFromResult: result => {
                    const nodeId = getCreatedNodeId(result);
                    if (!nodeId) throw new Error('DuplicateNode did not return a stable NodeId for rollback.');
                    return {type: WORKSPACE_NODE_COMMAND_TYPES.DESTROY, nodeId};
                }
            };
        }

        const snapshot = nodeClient.getNodeSnapshot({nodeId: command.nodeId});
        if (!snapshot || !snapshot.node) throw new Error(`Agent transaction NodeId is unavailable: ${command.nodeId}`);

        if (command.type === WORKSPACE_NODE_COMMAND_TYPES.PATCH) {
            const inversePatch = createInversePatch(snapshot, command.patch || {});
            return {
                execute: () => nodeClient.patchNode({nodeId: command.nodeId, patch: command.patch || {}}),
                compensationFromResult: () => ({
                    type: WORKSPACE_NODE_COMMAND_TYPES.PATCH,
                    nodeId: command.nodeId,
                    patch: inversePatch
                })
            };
        }

        if (command.type === WORKSPACE_NODE_COMMAND_TYPES.REPARENT) {
            const previousParentId = snapshot.node.parentId || null;
            if (snapshot.domain === WORKSPACE_NODE_DOMAINS.RUNTIME && !previousParentId) {
                const error = new Error(
                    'Agent cannot reparent a Runtime Node whose previous parent is not reversible.'
                );
                error.code = 'NGVGE_AGENT_RUNTIME_REPARENT_ROLLBACK_UNAVAILABLE';
                throw error;
            }
            return {
                execute: () => nodeClient.reparentNode({
                    nodeId: command.nodeId,
                    parentId: command.parentId,
                    options: command.options || {}
                }),
                compensationFromResult: () => ({
                    type: WORKSPACE_NODE_COMMAND_TYPES.REPARENT,
                    nodeId: command.nodeId,
                    parentId: previousParentId,
                    options: {}
                })
            };
        }

        throw new TypeError(`Agent transaction does not support command: ${command.type}`);
    };

    const applyChangeSet = async changeSet => {
        if (!changeSet || changeSet.modelId !== WORKSPACE_AGENT_CHANGESET_MODEL_ID ||
            changeSet.state !== AGENT_CHANGESET_STATES.APPROVED) {
            const error = new Error('Agent transaction requires an explicitly approved ChangeSet.');
            error.code = 'NGVGE_AGENT_CHANGESET_REVIEW_REQUIRED';
            throw error;
        }

        const transactionId = `ngvge.agent.transaction.${++transactionSequence}`;
        const prepared = changeSet.operations.map(prepareOperation);
        const compensations = [];
        const results = [];
        try {
            for (let index = 0; index < prepared.length; index++) {
                const result = await prepared[index].execute();
                results.push(result);
                compensations.push(prepared[index].compensationFromResult(result));
            }
        } catch (error) {
            let rollbackError = null;
            for (let index = compensations.length - 1; index >= 0; index--) {
                try {
                    await executeCompensation(compensations[index]);
                } catch (nextError) {
                    rollbackError = nextError;
                    break;
                }
            }
            const failed = freeze({
                schemaVersion: AGENT_TRANSACTION_SCHEMA_VERSION,
                hostId: WORKSPACE_AGENT_TRANSACTION_HOST_ID,
                transactionId,
                changeSetId: changeSet.changeSetId,
                state: rollbackError ?
                    AGENT_TRANSACTION_STATES.ROLLBACK_FAILED : AGENT_TRANSACTION_STATES.FAILED,
                appliedCount: compensations.length,
                error: error.message,
                rollbackError: rollbackError ? rollbackError.message : null
            });
            transactions.set(transactionId, {publicRecord: failed, compensations: []});
            const wrapped = new Error(`Agent ChangeSet transaction failed: ${error.message}`);
            wrapped.code = rollbackError ? 'NGVGE_AGENT_TRANSACTION_ROLLBACK_FAILED' : 'NGVGE_AGENT_TRANSACTION_FAILED';
            wrapped.transaction = failed;
            throw wrapped;
        }

        const publicRecord = freeze({
            schemaVersion: AGENT_TRANSACTION_SCHEMA_VERSION,
            hostId: WORKSPACE_AGENT_TRANSACTION_HOST_ID,
            transactionId,
            changeSetId: changeSet.changeSetId,
            state: AGENT_TRANSACTION_STATES.COMMITTED,
            appliedCount: results.length
        });
        transactions.set(transactionId, {publicRecord, compensations: compensations.slice()});
        return publicRecord;
    };

    const rollback = async transactionId => {
        const stored = transactions.get(transactionId);
        if (!stored || stored.publicRecord.state !== AGENT_TRANSACTION_STATES.COMMITTED) {
            throw new Error(`Agent transaction is not undoable: ${transactionId}`);
        }
        try {
            for (let index = stored.compensations.length - 1; index >= 0; index--) {
                await executeCompensation(stored.compensations[index]);
            }
        } catch (error) {
            const failed = freeze(Object.assign({}, stored.publicRecord, {
                state: AGENT_TRANSACTION_STATES.ROLLBACK_FAILED,
                rollbackError: error.message
            }));
            transactions.set(transactionId, {publicRecord: failed, compensations: stored.compensations});
            const wrapped = new Error(`Agent transaction rollback failed: ${error.message}`);
            wrapped.code = 'NGVGE_AGENT_TRANSACTION_ROLLBACK_FAILED';
            wrapped.transaction = failed;
            throw wrapped;
        }
        const publicRecord = freeze(Object.assign({}, stored.publicRecord, {
            state: AGENT_TRANSACTION_STATES.ROLLED_BACK
        }));
        transactions.set(transactionId, {publicRecord, compensations: []});
        return publicRecord;
    };

    return freeze({
        hostId: WORKSPACE_AGENT_TRANSACTION_HOST_ID,
        applyChangeSet,
        rollback,
        getTransaction: transactionId => {
            const stored = transactions.get(transactionId);
            return stored ? stored.publicRecord : null;
        }
    });
};

export {
    AGENT_TRANSACTION_SCHEMA_VERSION,
    AGENT_TRANSACTION_STATES,
    WORKSPACE_AGENT_TRANSACTION_HOST_ID,
    createWorkspaceAgentTransactionHost
};
