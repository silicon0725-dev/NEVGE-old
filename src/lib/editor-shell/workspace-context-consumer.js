import {TOOL_CAPABILITY_ACCESS, WORKSPACE_TOOL_CAPABILITIES} from './tool-capability';

const WORKSPACE_CONTEXT_CONSUMER_ADMISSION_ID = 'ngvge.workspace-context-consumer-admission@1';

const admitWorkspaceContextConsumer = ({capabilityHost, providerRegistry, toolId}) => {
    if (!capabilityHost || typeof capabilityHost.admit !== 'function') {
        throw new TypeError('Workspace Context consumer admission requires WorkspaceToolCapabilityHost.');
    }
    if (!providerRegistry || typeof providerRegistry.bind !== 'function') {
        throw new TypeError('Workspace Context consumer admission requires WorkspaceCapabilityProviderRegistry.');
    }
    if (typeof toolId !== 'string' || !toolId.trim()) {
        throw new TypeError('Workspace Context consumer admission requires ToolId.');
    }

    const lease = capabilityHost.admit(toolId);
    let disposed = false;
    let binding = null;
    try {
        binding = providerRegistry.bind({
            capabilityLease: lease,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.CONTEXT_READ,
            access: TOOL_CAPABILITY_ACCESS.QUERY
        });
    } catch (error) {
        if (typeof lease.release === 'function') lease.release('context-consumer-provider-binding-failed');
        throw error;
    }

    return Object.freeze({
        id: WORKSPACE_CONTEXT_CONSUMER_ADMISSION_ID,
        toolId,
        lease,
        providerBinding: binding,
        contextRead: binding.facade,
        isActive: () => !disposed && lease.isActive() && binding.isActive(),
        dispose: (reason = 'context-consumer-disposed') => {
            if (disposed) return false;
            disposed = true;
            const bindingReleased = binding.release(reason);
            const leaseReleased = typeof lease.release === 'function' ? lease.release(reason) : false;
            return bindingReleased || leaseReleased;
        }
    });
};

export {
    WORKSPACE_CONTEXT_CONSUMER_ADMISSION_ID,
    admitWorkspaceContextConsumer
};
