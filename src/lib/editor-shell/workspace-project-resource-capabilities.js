import {
    STABLE_ID_KINDS,
    isStableIdentity
} from '../../core/identity/stable-identity';

const WORKSPACE_PROJECT_READ_CAPABILITY_ID = 'ngvge.workspace-project-read-capability@1';
const WORKSPACE_PROJECT_COMMAND_CAPABILITY_ID = 'ngvge.workspace-project-command-capability@1';
const WORKSPACE_RESOURCE_READ_CAPABILITY_ID = 'ngvge.workspace-resource-read-capability@1';
const WORKSPACE_RESOURCE_COMMAND_CAPABILITY_ID = 'ngvge.workspace-resource-command-capability@1';
const WORKSPACE_PROJECT_SNAPSHOT_SCHEMA_VERSION = 1;
const WORKSPACE_RESOURCE_DESCRIPTOR_SCHEMA_VERSION = 1;
const WORKSPACE_RESOURCE_COMMAND_SCHEMA_VERSION = 1;

const RESOURCE_COMMAND_KINDS = Object.freeze({
    RENAME: 'rename',
    MOVE: 'move',
    DELETE: 'delete'
});

const isPlainObject = value => (
    value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
);

const freezeDeep = value => {
    if (Array.isArray(value)) {
        value.forEach(freezeDeep);
        return Object.freeze(value);
    }
    if (isPlainObject(value)) {
        Object.keys(value).forEach(key => freezeDeep(value[key]));
        return Object.freeze(value);
    }
    return value;
};

const makeCapabilityError = (code, message, ErrorClass = Error) => {
    const error = new ErrorClass(message);
    error.code = code;
    return error;
};

const assertResourceId = resourceId => {
    if (!isStableIdentity(resourceId, STABLE_ID_KINDS.RESOURCE)) {
        throw makeCapabilityError(
            'NGVGE_WORKSPACE_RESOURCE_ID_INVALID',
            'Resource capability operations require a canonical ngvge:resource:* ResourceId.',
            TypeError
        );
    }
    return resourceId;
};

const normalizeProjectSnapshot = ({contextSnapshot, lifecycleState}) => {
    const activeOperation = lifecycleState && lifecycleState.activeOperation ? {
        id: lifecycleState.activeOperation.id,
        kind: lifecycleState.activeOperation.kind,
        nested: Boolean(lifecycleState.activeOperation.nested),
        rootId: lifecycleState.activeOperation.rootId,
        rootKind: lifecycleState.activeOperation.rootKind
    } : null;
    return freezeDeep({
        schemaVersion: WORKSPACE_PROJECT_SNAPSHOT_SCHEMA_VERSION,
        projectId: contextSnapshot && typeof contextSnapshot.projectId === 'string' ? contextSnapshot.projectId : null,
        lifecycle: {
            hostId: lifecycleState && typeof lifecycleState.hostId === 'string' ? lifecycleState.hostId : null,
            phase: lifecycleState && typeof lifecycleState.phase === 'string' ? lifecycleState.phase : 'unavailable',
            projectGeneration: lifecycleState && Number.isInteger(lifecycleState.projectGeneration) ?
                lifecycleState.projectGeneration : null,
            activeOperation
        }
    });
};

const createWorkspaceProjectReadFacade = ({contextService, projectLifecycleHost}) => {
    if (!contextService || typeof contextService.getSnapshot !== 'function') {
        throw new TypeError('Project read capability requires WorkspaceContextService.');
    }
    if (!projectLifecycleHost || typeof projectLifecycleHost.getState !== 'function') {
        throw new TypeError('Project read capability requires ProjectLifecycleHost.');
    }
    const getSnapshot = () => normalizeProjectSnapshot({
        contextSnapshot: contextService.getSnapshot(),
        lifecycleState: projectLifecycleHost.getState()
    });
    return Object.freeze({
        id: WORKSPACE_PROJECT_READ_CAPABILITY_ID,
        getSnapshot
    });
};

const createUnavailableProjectCommandFacade = () => Object.freeze({
    id: WORKSPACE_PROJECT_COMMAND_CAPABILITY_ID,
    getSupportedCommands: () => Object.freeze([])
});

const requireProjectCommandHost = projectCommandHost => {
    if (!projectCommandHost || typeof projectCommandHost.createProposal !== 'function' ||
        typeof projectCommandHost.commit !== 'function' || typeof projectCommandHost.rollback !== 'function' ||
        typeof projectCommandHost.getSupportedCommands !== 'function') {
        throw makeCapabilityError(
            'NGVGE_WORKSPACE_PROJECT_COMMAND_AUTHORITY_NOT_READY',
            'No stable native Project Command Authority is available.'
        );
    }
    return projectCommandHost;
};

const requireProjectTransactionReviewService = projectTransactionReviewService => {
    if (!projectTransactionReviewService || typeof projectTransactionReviewService.reviewProposal !== 'function' ||
        typeof projectTransactionReviewService.reviewTransaction !== 'function') {
        throw makeCapabilityError(
            'NGVGE_WORKSPACE_PROJECT_TRANSACTION_REVIEW_UNAVAILABLE',
            'Project transaction Review/Diagnostics service is unavailable.'
        );
    }
    return projectTransactionReviewService;
};

const requirePrivilegedMutationReviewPolicy = privilegedMutationReviewPolicy => {
    if (!privilegedMutationReviewPolicy || typeof privilegedMutationReviewPolicy.prepareCommitReview !== 'function' ||
        typeof privilegedMutationReviewPolicy.prepareRollbackReview !== 'function' ||
        typeof privilegedMutationReviewPolicy.consumeCommitEvidence !== 'function' ||
        typeof privilegedMutationReviewPolicy.consumeRollbackEvidence !== 'function') {
        throw makeCapabilityError(
            'NGVGE_WORKSPACE_PRIVILEGED_MUTATION_REVIEW_POLICY_UNAVAILABLE',
            'Privileged Project mutation Review Policy is unavailable.'
        );
    }
    return privilegedMutationReviewPolicy;
};

const createWorkspaceProjectCommandProposalFacade = ({
    projectCommandHost,
    projectTransactionReviewService,
    privilegedMutationReviewPolicy,
    capabilityLease,
    toolId
}) => Object.freeze({
    id: `${WORKSPACE_PROJECT_COMMAND_CAPABILITY_ID}.propose`,
    createProposal: input => requireProjectCommandHost(projectCommandHost).createProposal(input, {toolId}),
    getProposal: proposalId => requireProjectCommandHost(projectCommandHost).getProposal(proposalId, {toolId}),
    reviewProposal: proposalId => requireProjectTransactionReviewService(projectTransactionReviewService)
        .reviewProposal(proposalId, {toolId}),
    prepareMutationReview: proposalId => requirePrivilegedMutationReviewPolicy(privilegedMutationReviewPolicy)
        .prepareCommitReview(proposalId, {toolId, capabilityLease}),
    getSupportedCommands: () => requireProjectCommandHost(projectCommandHost).getSupportedCommands()
});

const createWorkspaceProjectCommandMutateFacade = ({
    projectCommandHost,
    projectTransactionReviewService,
    privilegedMutationReviewPolicy,
    capabilityLease,
    toolId
}) => Object.freeze({
    id: `${WORKSPACE_PROJECT_COMMAND_CAPABILITY_ID}.mutate`,
    execute: async (proposalId, {reviewEvidence} = {}) => {
        requirePrivilegedMutationReviewPolicy(privilegedMutationReviewPolicy)
            .consumeCommitEvidence(proposalId, reviewEvidence, {toolId, capabilityLease});
        return await requireProjectCommandHost(projectCommandHost).commit(proposalId, {toolId});
    },
    rollback: async (transactionId, {reviewEvidence} = {}) => {
        requirePrivilegedMutationReviewPolicy(privilegedMutationReviewPolicy)
            .consumeRollbackEvidence(transactionId, reviewEvidence, {toolId, capabilityLease});
        return await requireProjectCommandHost(projectCommandHost).rollback(transactionId, {toolId});
    },
    getTransaction: transactionId => requireProjectCommandHost(projectCommandHost).getTransaction(transactionId, {toolId}),
    reviewTransaction: transactionId => requireProjectTransactionReviewService(projectTransactionReviewService)
        .reviewTransaction(transactionId, {toolId}),
    prepareRollbackReview: transactionId => requirePrivilegedMutationReviewPolicy(privilegedMutationReviewPolicy)
        .prepareRollbackReview(transactionId, {toolId, capabilityLease}),
    getSupportedCommands: () => requireProjectCommandHost(projectCommandHost).getSupportedCommands()
});

const normalizeResourceDescriptor = descriptor => {
    if (!descriptor || typeof descriptor !== 'object') return null;
    const resourceId = assertResourceId(descriptor.resourceId);
    if (descriptor.kind !== 'costume' && descriptor.kind !== 'sound') {
        throw makeCapabilityError(
            'NGVGE_WORKSPACE_RESOURCE_KIND_UNSUPPORTED',
            `Unsupported Resource descriptor kind: ${String(descriptor.kind)}`
        );
    }
    const kind = descriptor.kind === 'sound' ? 'sound' : 'image';
    const normalized = {
        schemaVersion: WORKSPACE_RESOURCE_DESCRIPTOR_SCHEMA_VERSION,
        resourceId,
        kind,
        name: typeof descriptor.name === 'string' ? descriptor.name : '',
        dataFormat: typeof descriptor.dataFormat === 'string' ? descriptor.dataFormat : '',
        folderId: typeof descriptor.folderId === 'string' ? descriptor.folderId : null,
        referenceCount: Number.isInteger(descriptor.referenceCount) ? descriptor.referenceCount : 0
    };
    if (kind === 'image') {
        normalized.bitmapResolution = Number.isFinite(descriptor.bitmapResolution) ? descriptor.bitmapResolution : null;
        normalized.rotationCenterX = Number.isFinite(descriptor.rotationCenterX) ? descriptor.rotationCenterX : null;
        normalized.rotationCenterY = Number.isFinite(descriptor.rotationCenterY) ? descriptor.rotationCenterY : null;
    } else {
        normalized.rate = Number.isFinite(descriptor.rate) ? descriptor.rate : null;
        normalized.sampleCount = Number.isFinite(descriptor.sampleCount) ? descriptor.sampleCount : null;
    }
    return freezeDeep(normalized);
};

const requireResourceDatabase = getResourceDatabase => {
    const database = typeof getResourceDatabase === 'function' ? getResourceDatabase() : null;
    if (!database || typeof database.getResource !== 'function' || typeof database.listResources !== 'function' ||
        typeof database.getAssetIdForResourceId !== 'function') {
        throw makeCapabilityError(
            'NGVGE_WORKSPACE_RESOURCE_AUTHORITY_UNAVAILABLE',
            'Canonical Resource authority is unavailable.'
        );
    }
    return database;
};

const createWorkspaceResourceReadFacade = ({getResourceDatabase}) => Object.freeze({
    id: WORKSPACE_RESOURCE_READ_CAPABILITY_ID,
    getResource: resourceId => {
        assertResourceId(resourceId);
        const descriptor = requireResourceDatabase(getResourceDatabase).getResource(resourceId);
        return normalizeResourceDescriptor(descriptor);
    },
    listResources: () => Object.freeze(
        requireResourceDatabase(getResourceDatabase).listResources()
            .map(normalizeResourceDescriptor)
            .filter(Boolean)
    )
});

const normalizeNullableFolderId = folderId => {
    if (folderId === null || typeof folderId === 'undefined') return null;
    if (typeof folderId !== 'string' || !folderId.trim()) {
        throw makeCapabilityError(
            'NGVGE_WORKSPACE_RESOURCE_COMMAND_FOLDER_INVALID',
            'Resource move command folderId must be a non-empty string or null.',
            TypeError
        );
    }
    return folderId.trim();
};

const normalizeResourceCommand = command => {
    if (!isPlainObject(command)) {
        throw makeCapabilityError(
            'NGVGE_WORKSPACE_RESOURCE_COMMAND_INVALID',
            'Resource command must be a plain object.',
            TypeError
        );
    }
    const allowedFields = ['schemaVersion', 'kind', 'resourceId', 'name', 'folderId'];
    const unknown = Object.keys(command).filter(key => !allowedFields.includes(key));
    if (unknown.length) {
        throw makeCapabilityError(
            'NGVGE_WORKSPACE_RESOURCE_COMMAND_FIELD_UNSUPPORTED',
            `Resource command contains unsupported field(s): ${unknown.join(', ')}`
        );
    }
    if (command.schemaVersion !== WORKSPACE_RESOURCE_COMMAND_SCHEMA_VERSION) {
        throw makeCapabilityError(
            'NGVGE_WORKSPACE_RESOURCE_COMMAND_SCHEMA_INVALID',
            `Resource command schemaVersion must be ${WORKSPACE_RESOURCE_COMMAND_SCHEMA_VERSION}.`,
            TypeError
        );
    }
    if (!Object.values(RESOURCE_COMMAND_KINDS).includes(command.kind)) {
        throw makeCapabilityError(
            'NGVGE_WORKSPACE_RESOURCE_COMMAND_KIND_UNSUPPORTED',
            `Unsupported Resource command kind: ${String(command.kind)}`,
            TypeError
        );
    }
    const resourceId = assertResourceId(command.resourceId);
    if (command.kind === RESOURCE_COMMAND_KINDS.RENAME) {
        if (typeof command.name !== 'string' || !command.name.trim()) {
            throw makeCapabilityError(
                'NGVGE_WORKSPACE_RESOURCE_COMMAND_NAME_INVALID',
                'Resource rename command requires a non-empty name.',
                TypeError
            );
        }
        return freezeDeep({
            schemaVersion: WORKSPACE_RESOURCE_COMMAND_SCHEMA_VERSION,
            kind: command.kind,
            resourceId,
            name: command.name.trim()
        });
    }
    if (command.kind === RESOURCE_COMMAND_KINDS.MOVE) {
        return freezeDeep({
            schemaVersion: WORKSPACE_RESOURCE_COMMAND_SCHEMA_VERSION,
            kind: command.kind,
            resourceId,
            folderId: normalizeNullableFolderId(command.folderId)
        });
    }
    return freezeDeep({
        schemaVersion: WORKSPACE_RESOURCE_COMMAND_SCHEMA_VERSION,
        kind: command.kind,
        resourceId
    });
};

const createWorkspaceResourceCommandProposalFacade = () => Object.freeze({
    id: `${WORKSPACE_RESOURCE_COMMAND_CAPABILITY_ID}.propose`,
    createProposal: normalizeResourceCommand,
    getSupportedCommands: () => Object.freeze(Object.values(RESOURCE_COMMAND_KINDS))
});

const createWorkspaceResourceCommandMutateFacade = ({getResourceDatabase}) => {
    const execute = async command => {
        const normalized = normalizeResourceCommand(command);
        const database = requireResourceDatabase(getResourceDatabase);
        const internalAssetId = database.getAssetIdForResourceId(normalized.resourceId);
        if (!internalAssetId) {
            throw makeCapabilityError(
                'NGVGE_WORKSPACE_RESOURCE_NOT_FOUND',
                `Resource is not available in the current Project: ${normalized.resourceId}`
            );
        }
        if (normalized.kind === RESOURCE_COMMAND_KINDS.MOVE && normalized.folderId !== null) {
            const folders = typeof database.listFolders === 'function' ? database.listFolders() : [];
            if (!folders.some(folder => folder && folder.id === normalized.folderId)) {
                throw makeCapabilityError(
                    'NGVGE_WORKSPACE_RESOURCE_FOLDER_NOT_FOUND',
                    `Resource folder is not available in the current Project: ${normalized.folderId}`
                );
            }
        }
        const run = () => {
            switch (normalized.kind) {
            case RESOURCE_COMMAND_KINDS.RENAME:
                return database.renameAsset(internalAssetId, normalized.name);
            case RESOURCE_COMMAND_KINDS.MOVE:
                return database.moveAsset(internalAssetId, normalized.folderId);
            case RESOURCE_COMMAND_KINDS.DELETE:
                return database.removeAsset(internalAssetId);
            default:
                throw makeCapabilityError(
                    'NGVGE_WORKSPACE_RESOURCE_COMMAND_KIND_UNSUPPORTED',
                    `Unsupported Resource command kind: ${normalized.kind}`
                );
            }
        };
        const changed = typeof database.perform === 'function' ?
            await database.perform(`Workspace Resource ${normalized.kind}`, run) : await Promise.resolve(run());
        return freezeDeep({
            schemaVersion: WORKSPACE_RESOURCE_COMMAND_SCHEMA_VERSION,
            kind: normalized.kind,
            resourceId: normalized.resourceId,
            changed: Boolean(changed)
        });
    };
    return Object.freeze({
        id: `${WORKSPACE_RESOURCE_COMMAND_CAPABILITY_ID}.mutate`,
        execute,
        getSupportedCommands: () => Object.freeze(Object.values(RESOURCE_COMMAND_KINDS))
    });
};

export {
    WORKSPACE_PROJECT_READ_CAPABILITY_ID,
    WORKSPACE_PROJECT_COMMAND_CAPABILITY_ID,
    WORKSPACE_RESOURCE_READ_CAPABILITY_ID,
    WORKSPACE_RESOURCE_COMMAND_CAPABILITY_ID,
    WORKSPACE_PROJECT_SNAPSHOT_SCHEMA_VERSION,
    WORKSPACE_RESOURCE_DESCRIPTOR_SCHEMA_VERSION,
    WORKSPACE_RESOURCE_COMMAND_SCHEMA_VERSION,
    RESOURCE_COMMAND_KINDS,
    normalizeProjectSnapshot,
    normalizeResourceDescriptor,
    normalizeResourceCommand,
    createWorkspaceProjectReadFacade,
    createUnavailableProjectCommandFacade,
    createWorkspaceProjectCommandProposalFacade,
    createWorkspaceProjectCommandMutateFacade,
    createWorkspaceResourceReadFacade,
    createWorkspaceResourceCommandProposalFacade,
    createWorkspaceResourceCommandMutateFacade
};
