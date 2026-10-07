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
import {
    WORKSPACE_PROJECT_COMMAND_KINDS,
    createWorkspaceProjectCommandHost
} from '../../../../src/lib/editor-shell/project-command-host';
import {createWorkspaceProjectTransactionReviewService} from '../../../../src/lib/editor-shell/project-transaction-review';
import {
    WORKSPACE_MUTATION_REVIEW_EVIDENCE_STATES,
    WORKSPACE_MUTATION_REVIEW_MODES,
    WORKSPACE_PRIVILEGED_MUTATION_REVIEW_POLICY_ID,
    createWorkspacePrivilegedMutationReviewPolicy
} from '../../../../src/lib/editor-shell/privileged-mutation-review-policy';
import {
    WORKSPACE_CAPABILITY_PROVIDER_STATES
} from '../../../../src/lib/editor-shell/workspace-capability-provider';
import {
    createCoreWorkspaceCapabilityProviderRegistry
} from '../../../../src/lib/editor-shell/workspace-capability-providers';

const RESOURCE_ID = 'ngvge:resource:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TOOL_ID = TOOL_IDS.EDITOR;

const clone = value => JSON.parse(JSON.stringify(value));

const createResourceDatabase = () => {
    const record = {
        id: 'asset:a',
        resourceId: RESOURCE_ID,
        kind: 'costume',
        name: 'Hero',
        folderId: null
    };
    const folders = [{id: 'folder:actors', name: 'Actors'}];
    const listeners = new Set();
    const history = [];
    const emit = type => listeners.forEach(listener => listener({type}));
    return {
        getAssetIdForResourceId: resourceId => resourceId === RESOURCE_ID ? record.id : null,
        getResource: resourceId => resourceId === RESOURCE_ID ? clone(record) : null,
        listResources: () => [clone(record)],
        listFolders: () => folders.map(clone),
        renameAsset: (internalId, name) => {
            if (internalId !== record.id || record.name === name) return false;
            record.name = name;
            emit('asset:rename');
            return true;
        },
        moveAsset: (internalId, folderId) => {
            if (internalId !== record.id || record.folderId === folderId) return false;
            record.folderId = folderId;
            emit('asset:move');
            return true;
        },
        removeAsset: () => false,
        perform: async (label, action) => {
            const before = clone(record);
            const result = await action();
            history.push({label, before});
            emit('history:push');
            return result;
        },
        undo: () => {
            const entry = history.pop();
            if (!entry) return false;
            Object.assign(record, entry.before);
            emit('history:undo');
            return true;
        },
        getHistoryState: () => ({
            canUndo: history.length > 0,
            nextUndoLabel: history.length ? history[history.length - 1].label : null
        }),
        subscribe: listener => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    };
};

const createFixture = () => {
    const toolRegistry = createCoreToolRegistry();
    const ecosystemRegistry = createCoreToolEcosystemRegistry(toolRegistry);
    ecosystemRegistry.register({
        schemaVersion: 1,
        toolId: TOOL_ID,
        title: 'WS-9I privileged mutation test Tool',
        lifecycle: TOOL_ECOSYSTEM_LIFECYCLE.ACTIVE,
        origin: TOOL_ECOSYSTEM_ORIGINS.FIRST_PARTY,
        requiredServices: [],
        persistenceScopes: [],
        authority: TOOL_ECOSYSTEM_AUTHORITIES.PROJECT_COMMAND,
        ossIntake: {status: 'not-applicable'},
        notes: 'Exercises reviewed Project mutation policy.'
    });
    const capabilityHost = createCoreWorkspaceToolCapabilityHost({toolRegistry, ecosystemRegistry});
    capabilityHost.registerToolDescriptor({
        schemaVersion: 1,
        toolId: TOOL_ID,
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
    const projectWriter = contextService.claimWriter('project', 'ngvge.workspace-context-source.ws9i-test');
    projectWriter.update({projectId: 'ngvge.project-context.g20'});
    const database = createResourceDatabase();
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
    const providerRegistry = createCoreWorkspaceCapabilityProviderRegistry({
        capabilityHost,
        contextService,
        workspaceToolPersistenceService: new WorkspaceToolPersistenceService(),
        projectLifecycleHost: {
            getState: () => ({hostId: 'ngvge.project-lifecycle-host@1', phase: 'idle', projectGeneration: 20})
        },
        projectCommandHost,
        projectTransactionReviewService,
        privilegedMutationReviewPolicy,
        getResourceDatabase: () => database
    });
    const bindLease = lease => ({
        propose: providerRegistry.bind({
            capabilityLease: lease,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND,
            access: TOOL_CAPABILITY_ACCESS.PROPOSE
        }),
        mutate: providerRegistry.bind({
            capabilityLease: lease,
            capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND,
            access: TOOL_CAPABILITY_ACCESS.MUTATE
        })
    });
    const lease = capabilityHost.admit(TOOL_ID);
    const bindings = bindLease(lease);
    return {
        toolRegistry,
        ecosystemRegistry,
        capabilityHost,
        contextService,
        projectWriter,
        database,
        projectCommandHost,
        projectTransactionReviewService,
        privilegedMutationReviewPolicy,
        providerRegistry,
        lease,
        bindings,
        bindLease
    };
};

const createRenameProposal = (proposeFacade, name = 'Hero Prime') => proposeFacade.createProposal({
    schemaVersion: 1,
    label: 'Reviewed rename',
    commands: [{
        schemaVersion: 1,
        kind: WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_RENAME,
        resourceId: RESOURCE_ID,
        name
    }]
});

describe('WS-9I Privileged Tool Mutation Review Policy', () => {
    test('classifies sensitive mutation surfaces without review-washing standard capabilities', () => {
        const {privilegedMutationReviewPolicy} = createFixture();
        expect(privilegedMutationReviewPolicy.id).toBe(WORKSPACE_PRIVILEGED_MUTATION_REVIEW_POLICY_ID);
        expect(privilegedMutationReviewPolicy.getSurfacePolicy(
            WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND,
            TOOL_CAPABILITY_ACCESS.MUTATE
        ).mode).toBe(WORKSPACE_MUTATION_REVIEW_MODES.REVIEW_REQUIRED);
        expect(privilegedMutationReviewPolicy.getSurfacePolicy(
            WORKSPACE_TOOL_CAPABILITIES.RESOURCE_COMMAND,
            TOOL_CAPABILITY_ACCESS.MUTATE
        )).toEqual(expect.objectContaining({
            mode: WORKSPACE_MUTATION_REVIEW_MODES.DIRECT_DENIED,
            code: 'NGVGE_WORKSPACE_RESOURCE_DIRECT_MUTATION_REVIEW_REQUIRED'
        }));
        expect(privilegedMutationReviewPolicy.getSurfacePolicy(
            WORKSPACE_TOOL_CAPABILITIES.WORKSPACE_STATE,
            TOOL_CAPABILITY_ACCESS.MUTATE
        ).mode).toBe(WORKSPACE_MUTATION_REVIEW_MODES.NOT_REQUIRED);
    });

    test('Project mutation refuses execution without Review Evidence', async () => {
        const {bindings, database} = createFixture();
        const proposal = createRenameProposal(bindings.propose.facade);
        await expect(bindings.mutate.facade.execute(proposal.proposalId)).rejects.toEqual(expect.objectContaining({
            code: 'NGVGE_WORKSPACE_MUTATION_REVIEW_EVIDENCE_REQUIRED'
        }));
        expect(database.getResource(RESOURCE_ID).name).toBe('Hero');
    });

    test('fresh Tool/Project/lease-bound Review Evidence authorizes exactly one commit attempt', async () => {
        const {bindings, database, privilegedMutationReviewPolicy, lease} = createFixture();
        const proposal = createRenameProposal(bindings.propose.facade);
        const prepared = bindings.propose.facade.prepareMutationReview(proposal.proposalId);
        expect(prepared.review.canCommit).toBe(true);
        expect(prepared.evidence).toEqual(expect.objectContaining({
            operation: 'commit',
            subjectId: proposal.proposalId,
            projectId: 'ngvge.project-context.g20',
            toolId: TOOL_ID,
            capabilityLeaseId: lease.id
        }));
        const transaction = await bindings.mutate.facade.execute(proposal.proposalId, {
            reviewEvidence: prepared.evidence
        });
        expect(transaction.state).toBe('committed');
        expect(database.getResource(RESOURCE_ID).name).toBe('Hero Prime');
        expect(privilegedMutationReviewPolicy.getEvidence(prepared.evidence.evidenceId, {toolId: TOOL_ID}).state)
            .toBe(WORKSPACE_MUTATION_REVIEW_EVIDENCE_STATES.CONSUMED);
        await expect(bindings.mutate.facade.execute(proposal.proposalId, {
            reviewEvidence: prepared.evidence
        })).rejects.toEqual(expect.objectContaining({
            code: 'NGVGE_WORKSPACE_MUTATION_REVIEW_EVIDENCE_CONSUMED'
        }));
    });

    test('Review Evidence becomes stale when Project Context changes after review', async () => {
        const {bindings, projectWriter} = createFixture();
        const proposal = createRenameProposal(bindings.propose.facade);
        const {evidence} = bindings.propose.facade.prepareMutationReview(proposal.proposalId);
        projectWriter.update({projectId: 'ngvge.project-context.g21'});
        await expect(bindings.mutate.facade.execute(proposal.proposalId, {reviewEvidence: evidence}))
            .rejects.toEqual(expect.objectContaining({
                code: 'NGVGE_WORKSPACE_MUTATION_REVIEW_EVIDENCE_STALE'
            }));
    });

    test('Review Evidence becomes stale when Resource source state changes after review', async () => {
        const {bindings, database} = createFixture();
        const proposal = createRenameProposal(bindings.propose.facade);
        const {evidence} = bindings.propose.facade.prepareMutationReview(proposal.proposalId);
        database.renameAsset('asset:a', 'External Change');
        await expect(bindings.mutate.facade.execute(proposal.proposalId, {reviewEvidence: evidence}))
            .rejects.toEqual(expect.objectContaining({
                code: 'NGVGE_WORKSPACE_MUTATION_REVIEW_EVIDENCE_STALE'
            }));
    });

    test('Review Evidence is lease-bound and revoked with its Capability lease', () => {
        const {bindings, lease, privilegedMutationReviewPolicy} = createFixture();
        const proposal = createRenameProposal(bindings.propose.facade);
        const {evidence} = bindings.propose.facade.prepareMutationReview(proposal.proposalId);
        lease.release('ws9i-revoke-test');
        expect(privilegedMutationReviewPolicy.getEvidence(evidence.evidenceId, {toolId: TOOL_ID})).toEqual(
            expect.objectContaining({
                state: WORKSPACE_MUTATION_REVIEW_EVIDENCE_STATES.REVOKED,
                revokeReason: 'capability-lease:ws9i-revoke-test'
            })
        );
    });

    test('Review Evidence cannot cross Capability lease generations even for the same Tool', async () => {
        const {capabilityHost, bindings, bindLease} = createFixture();
        const proposal = createRenameProposal(bindings.propose.facade);
        const {evidence} = bindings.propose.facade.prepareMutationReview(proposal.proposalId);
        const secondLease = capabilityHost.admit(TOOL_ID);
        const secondBindings = bindLease(secondLease);
        await expect(secondBindings.mutate.facade.execute(proposal.proposalId, {reviewEvidence: evidence}))
            .rejects.toEqual(expect.objectContaining({
                code: 'NGVGE_WORKSPACE_MUTATION_REVIEW_EVIDENCE_LEASE_MISMATCH'
            }));
    });

    test('rollback is also a reviewed privileged mutation with one-shot evidence', async () => {
        const {bindings, database} = createFixture();
        const proposal = createRenameProposal(bindings.propose.facade);
        const commitReview = bindings.propose.facade.prepareMutationReview(proposal.proposalId);
        const transaction = await bindings.mutate.facade.execute(proposal.proposalId, {
            reviewEvidence: commitReview.evidence
        });
        expect(database.getResource(RESOURCE_ID).name).toBe('Hero Prime');
        await expect(bindings.mutate.facade.rollback(transaction.transactionId)).rejects.toEqual(expect.objectContaining({
            code: 'NGVGE_WORKSPACE_MUTATION_REVIEW_EVIDENCE_REQUIRED'
        }));
        const rollbackReview = bindings.mutate.facade.prepareRollbackReview(transaction.transactionId);
        expect(rollbackReview.review.canRollback).toBe(true);
        const rolledBack = await bindings.mutate.facade.rollback(transaction.transactionId, {
            reviewEvidence: rollbackReview.evidence
        });
        expect(rolledBack.state).toBe('rolled-back');
        expect(database.getResource(RESOURCE_ID).name).toBe('Hero');
    });

    test('direct Resource mutation provider is fail-visible under WS-9I policy', () => {
        const {providerRegistry} = createFixture();
        expect(providerRegistry.getAvailability(
            WORKSPACE_TOOL_CAPABILITIES.RESOURCE_COMMAND,
            TOOL_CAPABILITY_ACCESS.MUTATE
        )).toEqual(expect.objectContaining({
            available: false,
            code: 'NGVGE_WORKSPACE_RESOURCE_DIRECT_MUTATION_REVIEW_REQUIRED'
        }));
        expect(providerRegistry.getCoverageDiagnostics().surfaces).toEqual(expect.arrayContaining([
            expect.objectContaining({
                capabilityId: WORKSPACE_TOOL_CAPABILITIES.RESOURCE_COMMAND,
                access: TOOL_CAPABILITY_ACCESS.MUTATE,
                state: WORKSPACE_CAPABILITY_PROVIDER_STATES.PROVIDER_UNAVAILABLE,
                diagnosticCode: 'NGVGE_WORKSPACE_RESOURCE_DIRECT_MUTATION_REVIEW_REQUIRED'
            })
        ]));
    });
});
