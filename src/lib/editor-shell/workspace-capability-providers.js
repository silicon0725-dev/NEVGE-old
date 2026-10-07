import {
    TOOL_CAPABILITY_ACCESS,
    WORKSPACE_TOOL_CAPABILITIES
} from './tool-capability';
import {createWorkspaceContextReadCapability} from './workspace-context';
import {
    WORKSPACE_TOOL_PERSISTENCE_SERVICE_ID
} from './workspace-tool-persistence';
import {
    WorkspaceCapabilityProviderRegistry
} from './workspace-capability-provider';
import {
    createWorkspaceResourceContentReadFacade
} from './workspace-resource-content-capability';
import {
    createUnavailableProjectCommandFacade,
    createWorkspaceProjectCommandMutateFacade,
    createWorkspaceProjectCommandProposalFacade,
    createWorkspaceProjectReadFacade,
    createWorkspaceResourceCommandMutateFacade,
    createWorkspaceResourceCommandProposalFacade,
    createWorkspaceResourceReadFacade
} from './workspace-project-resource-capabilities';

const CORE_WORKSPACE_CAPABILITY_PROVIDER_IDS = Object.freeze({
    CONTEXT_READ: 'ngvge.workspace-capability-provider.context-read',
    WORKSPACE_STATE_QUERY: 'ngvge.workspace-capability-provider.workspace-state.query',
    WORKSPACE_STATE_MUTATE: 'ngvge.workspace-capability-provider.workspace-state.mutate',
    PROJECT_READ: 'ngvge.workspace-capability-provider.project-read',
    PROJECT_COMMAND_PROPOSE: 'ngvge.workspace-capability-provider.project-command.propose',
    PROJECT_COMMAND_MUTATE: 'ngvge.workspace-capability-provider.project-command.mutate',
    RESOURCE_READ: 'ngvge.workspace-capability-provider.resource-read',
    RESOURCE_CONTENT_READ: 'ngvge.workspace-capability-provider.resource-content-read',
    RESOURCE_COMMAND_PROPOSE: 'ngvge.workspace-capability-provider.resource-command.propose',
    RESOURCE_COMMAND_MUTATE: 'ngvge.workspace-capability-provider.resource-command.mutate'
});

const createWorkspaceStateQueryFacade = ({persistenceService, toolId}) => Object.freeze({
    id: 'ngvge.workspace-state-query-capability@1',
    toolId,
    getState: fallback => persistenceService.getState(toolId, fallback)
});

const createWorkspaceStateMutateFacade = ({persistenceService, toolId}) => Object.freeze({
    id: 'ngvge.workspace-state-mutate-capability@1',
    toolId,
    setState: state => persistenceService.setState(toolId, state),
    removeState: () => persistenceService.removeState(toolId)
});

const createCoreWorkspaceCapabilityProviderRegistry = ({
    capabilityHost,
    contextService,
    workspaceToolPersistenceService,
    projectLifecycleHost = null,
    projectCommandHost = null,
    projectTransactionReviewService = null,
    privilegedMutationReviewPolicy = null,
    getResourceDatabase = () => null
}) => {
    if (!contextService || typeof contextService.getSnapshot !== 'function') {
        throw new TypeError('Core Workspace Capability Providers require WorkspaceContextService.');
    }
    if (!workspaceToolPersistenceService ||
        workspaceToolPersistenceService.id !== WORKSPACE_TOOL_PERSISTENCE_SERVICE_ID) {
        throw new TypeError('Core Workspace Capability Providers require Workspace Tool Persistence service.');
    }

    const registry = new WorkspaceCapabilityProviderRegistry({capabilityHost});

    registry.registerProvider({
        descriptor: {
            schemaVersion: 1,
            providerId: CORE_WORKSPACE_CAPABILITY_PROVIDER_IDS.CONTEXT_READ,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.CONTEXT_READ,
            access: TOOL_CAPABILITY_ACCESS.QUERY,
            description: 'Binds admitted Tools to the portable Workspace Context read facade.'
        },
        createFacade: ({capabilityLease}) => createWorkspaceContextReadCapability({
            contextService,
            capabilityLease
        })
    });

    registry.registerProvider({
        descriptor: {
            schemaVersion: 1,
            providerId: CORE_WORKSPACE_CAPABILITY_PROVIDER_IDS.WORKSPACE_STATE_QUERY,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.WORKSPACE_STATE,
            access: TOOL_CAPABILITY_ACCESS.QUERY,
            description: 'Queries only the admitted Tool own Workspace-scoped persistent state.'
        },
        createFacade: ({toolId}) => createWorkspaceStateQueryFacade({
            persistenceService: workspaceToolPersistenceService,
            toolId
        })
    });

    registry.registerProvider({
        descriptor: {
            schemaVersion: 1,
            providerId: CORE_WORKSPACE_CAPABILITY_PROVIDER_IDS.WORKSPACE_STATE_MUTATE,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.WORKSPACE_STATE,
            access: TOOL_CAPABILITY_ACCESS.MUTATE,
            description: 'Mutates only the admitted Tool own Workspace-scoped persistent state.'
        },
        createFacade: ({toolId}) => createWorkspaceStateMutateFacade({
            persistenceService: workspaceToolPersistenceService,
            toolId
        })
    });

    registry.registerProvider({
        descriptor: {
            schemaVersion: 1,
            providerId: CORE_WORKSPACE_CAPABILITY_PROVIDER_IDS.PROJECT_READ,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_READ,
            access: TOOL_CAPABILITY_ACCESS.QUERY,
            description: 'Queries portable Project context and lifecycle state without serializing Scratch backend data.'
        },
        getAvailability: () => projectLifecycleHost && typeof projectLifecycleHost.getState === 'function' ? true : ({
            available: false,
            code: 'NGVGE_WORKSPACE_PROJECT_READ_PROVIDER_UNAVAILABLE',
            message: 'ProjectLifecycleHost is unavailable.'
        }),
        createFacade: () => createWorkspaceProjectReadFacade({contextService, projectLifecycleHost})
    });

    const projectCommandAvailability = () => {
        if (!projectCommandHost || typeof projectCommandHost.getAvailability !== 'function') {
            return {
                available: false,
                code: 'NGVGE_WORKSPACE_PROJECT_COMMAND_AUTHORITY_NOT_READY',
                message: 'No stable native Project Command Authority is available; Scratch project payload mutation is not exposed.'
            };
        }
        if (!projectTransactionReviewService || typeof projectTransactionReviewService.getState !== 'function' ||
            typeof projectTransactionReviewService.reviewProposal !== 'function' ||
            typeof projectTransactionReviewService.reviewTransaction !== 'function') {
            return {
                available: false,
                code: 'NGVGE_WORKSPACE_PROJECT_TRANSACTION_REVIEW_UNAVAILABLE',
                message: 'Project command Provider requires the shared Project Transaction Review/Diagnostics service.'
            };
        }
        const hostAvailability = projectCommandHost.getAvailability();
        if (!hostAvailability.available) return hostAvailability;
        try {
            projectTransactionReviewService.getState();
        } catch (error) {
            return {
                available: false,
                code: error.code || 'NGVGE_WORKSPACE_PROJECT_TRANSACTION_REVIEW_UNAVAILABLE',
                message: error.message || 'Project Transaction Review/Diagnostics service is unavailable.'
            };
        }
        return hostAvailability;
    };
    const projectCommandMutateAvailability = () => {
        const base = projectCommandAvailability();
        if (!base.available) return base;
        if (!privilegedMutationReviewPolicy || typeof privilegedMutationReviewPolicy.getState !== 'function' ||
            typeof privilegedMutationReviewPolicy.getSurfacePolicy !== 'function') {
            return {
                available: false,
                code: 'NGVGE_WORKSPACE_PRIVILEGED_MUTATION_REVIEW_POLICY_UNAVAILABLE',
                message: 'Project mutation Provider requires the shared Privileged Mutation Review Policy.'
            };
        }
        try {
            privilegedMutationReviewPolicy.getState();
            const policy = privilegedMutationReviewPolicy.getSurfacePolicy(
                WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND,
                TOOL_CAPABILITY_ACCESS.MUTATE
            );
            if (!policy || policy.mode !== 'review-required') {
                return {
                    available: false,
                    code: 'NGVGE_WORKSPACE_PRIVILEGED_MUTATION_REVIEW_POLICY_INVALID',
                    message: 'Project mutation Provider requires review-required policy for sensitive mutation.'
                };
            }
        } catch (error) {
            return {
                available: false,
                code: error.code || 'NGVGE_WORKSPACE_PRIVILEGED_MUTATION_REVIEW_POLICY_UNAVAILABLE',
                message: error.message || 'Privileged Mutation Review Policy is unavailable.'
            };
        }
        return base;
    };

    registry.registerProvider({
        descriptor: {
            schemaVersion: 1,
            providerId: CORE_WORKSPACE_CAPABILITY_PROVIDER_IDS.PROJECT_COMMAND_PROPOSE,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND,
            access: TOOL_CAPABILITY_ACCESS.PROPOSE,
            description: 'Creates Tool-owned Project command proposals through the native Project Command Host when available.'
        },
        getAvailability: projectCommandAvailability,
        createFacade: ({toolId, capabilityLease}) => projectCommandHost ? createWorkspaceProjectCommandProposalFacade({
            projectCommandHost,
            projectTransactionReviewService,
            privilegedMutationReviewPolicy,
            capabilityLease,
            toolId
        }) : createUnavailableProjectCommandFacade()
    });

    registry.registerProvider({
        descriptor: {
            schemaVersion: 1,
            providerId: CORE_WORKSPACE_CAPABILITY_PROVIDER_IDS.PROJECT_COMMAND_MUTATE,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND,
            access: TOOL_CAPABILITY_ACCESS.MUTATE,
            description: 'Commits or rolls back Tool-owned Project transactions through the native Project Command Host when available.'
        },
        getAvailability: projectCommandMutateAvailability,
        createFacade: ({toolId, capabilityLease}) => projectCommandHost ? createWorkspaceProjectCommandMutateFacade({
            projectCommandHost,
            projectTransactionReviewService,
            privilegedMutationReviewPolicy,
            capabilityLease,
            toolId
        }) : createUnavailableProjectCommandFacade()
    });

    const getResourceAuthority = () => (
        typeof getResourceDatabase === 'function' ? getResourceDatabase() : null
    );
    const isResourceReadAuthorityAvailable = database => Boolean(
        database && typeof database.getResource === 'function' &&
        typeof database.listResources === 'function' && typeof database.getAssetIdForResourceId === 'function'
    );
    const isResourceCommandAuthorityAvailable = database => Boolean(
        isResourceReadAuthorityAvailable(database) && typeof database.perform === 'function' &&
        typeof database.renameAsset === 'function' && typeof database.moveAsset === 'function' &&
        typeof database.removeAsset === 'function' && typeof database.listFolders === 'function'
    );
    const resourceReadAvailability = () => {
        const database = getResourceAuthority();
        if (isResourceReadAuthorityAvailable(database)) return true;
        return {
            available: false,
            code: 'NGVGE_WORKSPACE_RESOURCE_AUTHORITY_UNAVAILABLE',
            message: 'Canonical Resource read authority is unavailable.'
        };
    };
    const resourceContentReadAvailability = () => {
        const database = getResourceAuthority();
        if (isResourceReadAuthorityAvailable(database) && typeof database.getDataURL === 'function' &&
            typeof database.getResourceContentRevision === 'function' && typeof database.subscribe === 'function') return true;
        return {
            available: false,
            code: 'NGVGE_WORKSPACE_RESOURCE_CONTENT_AUTHORITY_UNAVAILABLE',
            message: 'Canonical bounded Resource content read authority is unavailable.'
        };
    };
    const resourceCommandAvailability = () => {
        const database = getResourceAuthority();
        if (isResourceCommandAuthorityAvailable(database)) return true;
        return {
            available: false,
            code: 'NGVGE_WORKSPACE_RESOURCE_COMMAND_AUTHORITY_UNAVAILABLE',
            message: 'Canonical Resource command authority is unavailable.'
        };
    };
    const resourceCommandMutateAvailability = () => {
        const base = resourceCommandAvailability();
        if (base !== true && !base.available) return base;
        if (!privilegedMutationReviewPolicy || typeof privilegedMutationReviewPolicy.getSurfacePolicy !== 'function') {
            return {
                available: false,
                code: 'NGVGE_WORKSPACE_PRIVILEGED_MUTATION_REVIEW_POLICY_UNAVAILABLE',
                message: 'Sensitive Resource mutation requires Privileged Mutation Review Policy.'
            };
        }
        const policy = privilegedMutationReviewPolicy.getSurfacePolicy(
            WORKSPACE_TOOL_CAPABILITIES.RESOURCE_COMMAND,
            TOOL_CAPABILITY_ACCESS.MUTATE
        );
        if (policy && policy.mode === 'direct-denied') {
            return {
                available: false,
                code: policy.code || 'NGVGE_WORKSPACE_RESOURCE_DIRECT_MUTATION_REVIEW_REQUIRED',
                message: policy.message || 'Direct Resource mutation is disabled by privileged mutation policy.'
            };
        }
        return base;
    };

    registry.registerProvider({
        descriptor: {
            schemaVersion: 1,
            providerId: CORE_WORKSPACE_CAPABILITY_PROVIDER_IDS.RESOURCE_READ,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.RESOURCE_READ,
            access: TOOL_CAPABILITY_ACCESS.QUERY,
            description: 'Queries canonical ResourceId-addressed portable resource descriptors.'
        },
        getAvailability: resourceReadAvailability,
        createFacade: () => createWorkspaceResourceReadFacade({getResourceDatabase})
    });

    registry.registerProvider({
        descriptor: {
            schemaVersion: 1,
            providerId: CORE_WORKSPACE_CAPABILITY_PROVIDER_IDS.RESOURCE_CONTENT_READ,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.RESOURCE_CONTENT_READ,
            access: TOOL_CAPABILITY_ACCESS.QUERY,
            description: 'Reads bounded portable image Resource content into transient Tool working copies.'
        },
        getAvailability: resourceContentReadAvailability,
        createFacade: () => createWorkspaceResourceContentReadFacade({getResourceDatabase})
    });

    registry.registerProvider({
        descriptor: {
            schemaVersion: 1,
            providerId: CORE_WORKSPACE_CAPABILITY_PROVIDER_IDS.RESOURCE_COMMAND_PROPOSE,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.RESOURCE_COMMAND,
            access: TOOL_CAPABILITY_ACCESS.PROPOSE,
            description: 'Creates validated ResourceId-addressed metadata command proposals without mutating backend objects.'
        },
        getAvailability: resourceCommandAvailability,
        createFacade: createWorkspaceResourceCommandProposalFacade
    });

    registry.registerProvider({
        descriptor: {
            schemaVersion: 1,
            providerId: CORE_WORKSPACE_CAPABILITY_PROVIDER_IDS.RESOURCE_COMMAND_MUTATE,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.RESOURCE_COMMAND,
            access: TOOL_CAPABILITY_ACCESS.MUTATE,
            description: 'Executes a bounded ResourceId-addressed metadata command set through Resource authority.'
        },
        getAvailability: resourceCommandMutateAvailability,
        createFacade: () => createWorkspaceResourceCommandMutateFacade({getResourceDatabase})
    });

    return registry;
};

export {
    CORE_WORKSPACE_CAPABILITY_PROVIDER_IDS,
    createWorkspaceStateQueryFacade,
    createWorkspaceStateMutateFacade,
    createCoreWorkspaceCapabilityProviderRegistry
};
