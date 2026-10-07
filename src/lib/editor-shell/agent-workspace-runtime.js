import {WorkspaceAgentModel} from './agent-workspace-model';
import {createWorkspaceAgentTransactionHost} from './agent-transaction-host';

const WORKSPACE_AGENT_RUNTIME_ID = 'ngvge.workspace-agent-runtime@1';

const projectSafeNode = snapshot => {
    if (!snapshot || !snapshot.node) return null;
    const node = snapshot.node;
    return Object.freeze({
        id: node.id,
        name: node.name,
        typeId: node.typeId,
        parentId: node.parentId || null,
        enabled: Boolean(node.enabledSelf ?? node.enabled),
        domain: snapshot.domain
    });
};

const createWorkspaceAgentRuntime = ({workspaceNodeCommandHost, contextReadCapability}) => {
    if (!contextReadCapability || typeof contextReadCapability.getSnapshot !== 'function' ||
        typeof contextReadCapability.subscribe !== 'function') {
        throw new TypeError('Workspace Agent runtime requires admitted Workspace Context read capability.');
    }
    const transactionHost = createWorkspaceAgentTransactionHost({workspaceNodeCommandHost});
    const getCurrentContext = () => {
        const context = contextReadCapability.getSnapshot();
        const nodeId = context.primaryNodeId || null;
        if (!nodeId) return Object.freeze({nodeId: null, node: null});
        const snapshot = workspaceNodeCommandHost.getNodeSnapshot(nodeId);
        return Object.freeze({nodeId, node: projectSafeNode(snapshot)});
    };
    const model = new WorkspaceAgentModel({transactionHost, getCurrentContext});
    let disposed = false;
    const unsubscribeContext = contextReadCapability.subscribe(() => {
        if (!disposed) model.notifyContextChanged();
    });
    return Object.freeze({
        runtimeId: WORKSPACE_AGENT_RUNTIME_ID,
        model,
        transactionHost,
        dispose: () => {
            if (disposed) return false;
            disposed = true;
            unsubscribeContext();
            return true;
        }
    });
};

export {
    WORKSPACE_AGENT_RUNTIME_ID,
    createWorkspaceAgentRuntime
};
