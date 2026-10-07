import {TOOL_IDS, createCoreToolRegistry} from '../../../../src/lib/editor-shell/tool-registry';
import {
    TOOL_ECOSYSTEM_AUTHORITIES,
    TOOL_ECOSYSTEM_LIFECYCLE,
    TOOL_ECOSYSTEM_ORIGINS
} from '../../../../src/lib/editor-shell/tool-ecosystem';
import {createCoreToolEcosystemRegistry} from '../../../../src/lib/editor-shell/tool-ecosystem-manifests';
import {createCoreWorkspaceToolCapabilityHost} from '../../../../src/lib/editor-shell/tool-capability-descriptors';
import {
    TOOL_CAPABILITY_ACCESS,
    WORKSPACE_TOOL_CAPABILITIES
} from '../../../../src/lib/editor-shell/tool-capability';
import {WorkspaceContextService} from '../../../../src/lib/editor-shell/workspace-context';
import {WorkspaceToolPersistenceService} from '../../../../src/lib/editor-shell/workspace-tool-persistence';
import {WORKSPACE_CAPABILITY_PROVIDER_STATES} from '../../../../src/lib/editor-shell/workspace-capability-provider';
import {
    CORE_WORKSPACE_CAPABILITY_PROVIDER_IDS,
    createCoreWorkspaceCapabilityProviderRegistry
} from '../../../../src/lib/editor-shell/workspace-capability-providers';
import {
    WORKSPACE_PROJECT_COMMAND_KINDS,
    createWorkspaceProjectCommandHost
} from '../../../../src/lib/editor-shell/project-command-host';
import {createWorkspaceProjectTransactionReviewService} from '../../../../src/lib/editor-shell/project-transaction-review';
import {
    createWorkspacePrivilegedMutationReviewPolicy
} from '../../../../src/lib/editor-shell/privileged-mutation-review-policy';

const RESOURCE_ID = 'ngvge:resource:33333333-3333-4333-8333-333333333333';

const createDatabase = () => {
    const record = {id: 'asset:project-command-test', resourceId: RESOURCE_ID, kind: 'costume', name: 'Hero', folderId: null};
    const history = [];
    return {
        getAssetIdForResourceId: id => id === RESOURCE_ID ? record.id : null,
        getResource: id => id === RESOURCE_ID ? {...record} : null,
        listFolders: () => [],
        renameAsset: (id, name) => {
            if (id !== record.id) return false;
            record.name = name;
            return true;
        },
        moveAsset: () => true,
        perform: async (label, action) => {
            const before = {...record};
            const result = await action();
            history.push({label, before});
            return result;
        },
        undo: () => {
            const entry = history.pop();
            if (!entry) return false;
            Object.assign(record, entry.before);
            return true;
        },
        getHistoryState: () => ({nextUndoLabel: history.length ? history[history.length - 1].label : null})
    };
};

const createFixture = () => {
    const toolRegistry = createCoreToolRegistry();
    const ecosystemRegistry = createCoreToolEcosystemRegistry(toolRegistry);
    ecosystemRegistry.register({
        schemaVersion: 1,
        toolId: TOOL_IDS.EDITOR,
        title: 'Editor Project Command Test',
        lifecycle: TOOL_ECOSYSTEM_LIFECYCLE.ACTIVE,
        origin: TOOL_ECOSYSTEM_ORIGINS.FIRST_PARTY,
        requiredServices: [],
        persistenceScopes: [],
        authority: TOOL_ECOSYSTEM_AUTHORITIES.PROJECT_COMMAND,
        ossIntake: {status: 'not-applicable'},
        notes: 'WS-9G Project command provider test consumer.'
    });
    const capabilityHost = createCoreWorkspaceToolCapabilityHost({toolRegistry, ecosystemRegistry});
    capabilityHost.registerToolDescriptor({
        schemaVersion: 1,
        toolId: TOOL_IDS.EDITOR,
        requests: [{
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND,
            access: TOOL_CAPABILITY_ACCESS.PROPOSE,
            required: true
        }, {
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND,
            access: TOOL_CAPABILITY_ACCESS.MUTATE,
            required: true
        }]
    });
    const contextService = new WorkspaceContextService();
    contextService.claimWriter('project', 'ngvge.workspace-context-source.ws9g-provider-test')
        .update({projectId: 'ngvge.project-context.g9'});
    const database = createDatabase();
    const projectCommandHost = createWorkspaceProjectCommandHost({
        contextService,
        getResourceDatabase: () => database
    });
    const projectTransactionReviewService = createWorkspaceProjectTransactionReviewService({
        projectCommandHost,
        contextService,
        getResourceDatabase: () => database
    });
    const privilegedMutationReviewPolicy = createWorkspacePrivilegedMutationReviewPolicy({
        projectTransactionReviewService
    });
    const registry = createCoreWorkspaceCapabilityProviderRegistry({
        capabilityHost,
        contextService,
        workspaceToolPersistenceService: new WorkspaceToolPersistenceService(),
        projectLifecycleHost: {getState: () => ({hostId: 'ngvge.project-lifecycle-host@1', phase: 'idle', projectGeneration: 9})},
        projectCommandHost,
        projectTransactionReviewService,
        privilegedMutationReviewPolicy,
        getResourceDatabase: () => database
    });
    return {
        capabilityHost,
        database,
        projectCommandHost,
        projectTransactionReviewService,
        privilegedMutationReviewPolicy,
        registry
    };
};

describe('WS-9G Project command Capability Provider binding', () => {
    test('Project command propose/mutate surfaces become READY when native host is present', () => {
        const {registry} = createFixture();
        expect(registry.getCoverageDiagnostics().surfaces).toEqual(expect.arrayContaining([
            expect.objectContaining({
                capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND,
                access: TOOL_CAPABILITY_ACCESS.PROPOSE,
                providerId: CORE_WORKSPACE_CAPABILITY_PROVIDER_IDS.PROJECT_COMMAND_PROPOSE,
                state: WORKSPACE_CAPABILITY_PROVIDER_STATES.READY
            }),
            expect.objectContaining({
                capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND,
                access: TOOL_CAPABILITY_ACCESS.MUTATE,
                providerId: CORE_WORKSPACE_CAPABILITY_PROVIDER_IDS.PROJECT_COMMAND_MUTATE,
                state: WORKSPACE_CAPABILITY_PROVIDER_STATES.READY
            })
        ]));
    });

    test('admitted Tool can propose then commit only through scoped Provider facades', async () => {
        const {capabilityHost, database, registry} = createFixture();
        const lease = capabilityHost.admit(TOOL_IDS.EDITOR);
        const proposalBinding = registry.bind({
            capabilityLease: lease,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND,
            access: TOOL_CAPABILITY_ACCESS.PROPOSE
        });
        const mutateBinding = registry.bind({
            capabilityLease: lease,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND,
            access: TOOL_CAPABILITY_ACCESS.MUTATE
        });
        const proposal = proposalBinding.facade.createProposal({
            schemaVersion: 1,
            commands: [{
                schemaVersion: 1,
                kind: WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_RENAME,
                resourceId: RESOURCE_ID,
                name: 'Hero Prime'
            }]
        });
        const {evidence} = proposalBinding.facade.prepareMutationReview(proposal.proposalId);
        const transaction = await mutateBinding.facade.execute(proposal.proposalId, {reviewEvidence: evidence});
        expect(transaction.state).toBe('committed');
        expect(database.getResource(RESOURCE_ID).name).toBe('Hero Prime');
        expect(proposalBinding.facade.vm).toBeUndefined();
        expect(mutateBinding.facade.backend).toBeUndefined();
    });

    test('lease revocation invalidates both Project command facades immediately', () => {
        const {capabilityHost, registry} = createFixture();
        const lease = capabilityHost.admit(TOOL_IDS.EDITOR);
        const proposalBinding = registry.bind({
            capabilityLease: lease,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND,
            access: TOOL_CAPABILITY_ACCESS.PROPOSE
        });
        const mutateBinding = registry.bind({
            capabilityLease: lease,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND,
            access: TOOL_CAPABILITY_ACCESS.MUTATE
        });
        lease.release('ws9g-test');
        expect(() => proposalBinding.facade.getSupportedCommands()).toThrow(expect.objectContaining({
            code: 'NGVGE_WORKSPACE_CAPABILITY_PROVIDER_BINDING_REVOKED'
        }));
        expect(() => mutateBinding.facade.getSupportedCommands()).toThrow(expect.objectContaining({
            code: 'NGVGE_WORKSPACE_CAPABILITY_PROVIDER_BINDING_REVOKED'
        }));
    });

    test('Provider becomes unavailable dynamically when Project Command Host transaction adapter disappears', () => {
        const fixture = createFixture();
        const contextService = new WorkspaceContextService();
        const projectCommandHost = createWorkspaceProjectCommandHost({
            contextService,
            getResourceDatabase: () => null
        });
        const projectTransactionReviewService = createWorkspaceProjectTransactionReviewService({
            projectCommandHost,
            contextService,
            getResourceDatabase: () => null
        });
        const registry = createCoreWorkspaceCapabilityProviderRegistry({
            capabilityHost: fixture.capabilityHost,
            contextService,
            workspaceToolPersistenceService: new WorkspaceToolPersistenceService(),
            projectLifecycleHost: {getState: () => ({})},
            projectCommandHost,
            projectTransactionReviewService,
            getResourceDatabase: () => null
        });
        expect(registry.getAvailability(
            WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND,
            TOOL_CAPABILITY_ACCESS.MUTATE
        )).toEqual(expect.objectContaining({
            available: false,
            code: 'NGVGE_WORKSPACE_PROJECT_COMMAND_TRANSACTION_ADAPTER_UNAVAILABLE'
        }));
    });
    test('Provider facades expose Tool-scoped proposal and transaction review snapshots', async () => {
        const {capabilityHost, registry} = createFixture();
        const lease = capabilityHost.admit(TOOL_IDS.EDITOR);
        const proposalBinding = registry.bind({
            capabilityLease: lease,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND,
            access: TOOL_CAPABILITY_ACCESS.PROPOSE
        });
        const mutateBinding = registry.bind({
            capabilityLease: lease,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND,
            access: TOOL_CAPABILITY_ACCESS.MUTATE
        });
        const proposal = proposalBinding.facade.createProposal({
            schemaVersion: 1,
            commands: [{
                schemaVersion: 1,
                kind: WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_RENAME,
                resourceId: RESOURCE_ID,
                name: 'Hero Review'
            }]
        });
        const proposalReview = proposalBinding.facade.reviewProposal(proposal.proposalId);
        expect(proposalReview).toEqual(expect.objectContaining({
            kind: 'proposal',
            canCommit: true,
            toolId: TOOL_IDS.EDITOR
        }));
        const mutationReview = proposalBinding.facade.prepareMutationReview(proposal.proposalId);
        const transaction = await mutateBinding.facade.execute(proposal.proposalId, {
            reviewEvidence: mutationReview.evidence
        });
        const transactionReview = mutateBinding.facade.reviewTransaction(transaction.transactionId);
        expect(transactionReview).toEqual(expect.objectContaining({
            kind: 'transaction',
            transactionState: 'committed',
            canRollback: true,
            toolId: TOOL_IDS.EDITOR
        }));
    });

    test('Project command Provider is unavailable when shared Review/Diagnostics service is missing', () => {
        const fixture = createFixture();
        const registry = createCoreWorkspaceCapabilityProviderRegistry({
            capabilityHost: fixture.capabilityHost,
            contextService: new WorkspaceContextService(),
            workspaceToolPersistenceService: new WorkspaceToolPersistenceService(),
            projectLifecycleHost: {getState: () => ({})},
            projectCommandHost: fixture.projectCommandHost,
            getResourceDatabase: () => fixture.database
        });
        expect(registry.getAvailability(
            WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND,
            TOOL_CAPABILITY_ACCESS.PROPOSE
        )).toEqual(expect.objectContaining({
            available: false,
            code: 'NGVGE_WORKSPACE_PROJECT_TRANSACTION_REVIEW_UNAVAILABLE'
        }));
    });

});
