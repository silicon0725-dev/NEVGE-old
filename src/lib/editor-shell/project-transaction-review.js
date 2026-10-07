import {
    WORKSPACE_PROJECT_COMMAND_KINDS,
    WORKSPACE_PROJECT_PROPOSAL_STATES,
    WORKSPACE_PROJECT_TRANSACTION_STATES
} from './project-command-host';
import {estimateDataUriBytes} from '../project-assets/image-content-payload';

const WORKSPACE_PROJECT_TRANSACTION_REVIEW_ID = 'ngvge.workspace-project-transaction-review@1';
const WORKSPACE_PROJECT_TRANSACTION_REVIEW_SCHEMA_VERSION = 1;
const WORKSPACE_PROJECT_TRANSACTION_DIAGNOSTIC_SCHEMA_VERSION = 1;

const WORKSPACE_PROJECT_REVIEW_KINDS = Object.freeze({
    PROPOSAL: 'proposal',
    TRANSACTION: 'transaction'
});

const WORKSPACE_PROJECT_REVIEW_STATES = Object.freeze({
    READY: 'ready',
    BLOCKED: 'blocked',
    STALE: 'stale',
    COMPLETED: 'completed',
    FAILED: 'failed'
});

const WORKSPACE_PROJECT_REVIEW_SEVERITIES = Object.freeze({
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error'
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

const makeReviewError = (code, message, ErrorClass = Error) => {
    const error = new ErrorClass(message);
    error.code = code;
    return error;
};

const normalizeDiagnostic = ({code, severity, message, blocking = false, subject = null}) => freezeDeep({
    schemaVersion: WORKSPACE_PROJECT_TRANSACTION_DIAGNOSTIC_SCHEMA_VERSION,
    code,
    severity,
    message,
    blocking: Boolean(blocking),
    subject
});

const requireReviewSources = ({projectCommandHost, contextService, getResourceDatabase}) => {
    if (!projectCommandHost || typeof projectCommandHost.getProposal !== 'function' ||
        typeof projectCommandHost.getTransaction !== 'function' ||
        typeof projectCommandHost.getCommitAvailability !== 'function' ||
        typeof projectCommandHost.getRollbackAvailability !== 'function' ||
        typeof projectCommandHost.subscribe !== 'function') {
        throw new TypeError('Project Transaction Review requires Workspace Project Command Host diagnostics.');
    }
    if (!contextService || typeof contextService.getSnapshot !== 'function' ||
        typeof contextService.subscribe !== 'function') {
        throw new TypeError('Project Transaction Review requires WorkspaceContextService.');
    }
    if (typeof getResourceDatabase !== 'function') {
        throw new TypeError('Project Transaction Review requires a Resource database getter.');
    }
};

const requireToolId = toolId => {
    if (typeof toolId !== 'string' || !toolId.trim()) {
        throw new TypeError('Project Transaction Review requires an admitted ToolId owner.');
    }
    return toolId.trim();
};

const getProjectId = contextService => {
    const snapshot = contextService.getSnapshot();
    return snapshot && typeof snapshot.projectId === 'string' && snapshot.projectId.trim() ? snapshot.projectId.trim() : null;
};

const getResourceDatabaseState = getResourceDatabase => {
    const database = getResourceDatabase();
    if (!database || typeof database.getResource !== 'function' || typeof database.listFolders !== 'function') {
        return {database: null, available: false};
    }
    return {database, available: true};
};

const toResourceState = (descriptor, {contentRevision = null, byteLength = null} = {}) => {
    if (!descriptor || typeof descriptor !== 'object') return null;
    return freezeDeep({
        resourceId: typeof descriptor.resourceId === 'string' ? descriptor.resourceId : null,
        kind: descriptor.kind === 'sound' ? 'sound' : 'image',
        name: typeof descriptor.name === 'string' ? descriptor.name : '',
        folderId: typeof descriptor.folderId === 'string' ? descriptor.folderId : null,
        dataFormat: typeof descriptor.dataFormat === 'string' ? descriptor.dataFormat : null,
        bitmapResolution: Number.isFinite(descriptor.bitmapResolution) ? descriptor.bitmapResolution : null,
        rotationCenterX: Number.isFinite(descriptor.rotationCenterX) ? descriptor.rotationCenterX : null,
        rotationCenterY: Number.isFinite(descriptor.rotationCenterY) ? descriptor.rotationCenterY : null,
        sourceAuthorityRevision: Number.isInteger(contentRevision) ? contentRevision : null,
        byteLength: Number.isFinite(byteLength) ? byteLength : null
    });
};

const applyCommandToShadow = (command, before) => {
    if (!before) return null;
    if (command.kind === WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_RENAME) {
        return freezeDeep(Object.assign({}, before, {name: command.name}));
    }
    if (command.kind === WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_MOVE) {
        return freezeDeep(Object.assign({}, before, {folderId: command.folderId}));
    }
    if (command.kind === WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_CONTENT_REPLACE) {
        return freezeDeep(Object.assign({}, before, {
            dataFormat: command.dataFormat,
            bitmapResolution: command.bitmapResolution,
            rotationCenterX: command.rotationCenterX,
            rotationCenterY: command.rotationCenterY,
            sourceAuthorityRevision: command.expectedSourceAuthorityRevision + 1,
            byteLength: command.byteLength
        }));
    }
    return before;
};

const resourceStateChanged = (before, after) => Boolean(
    before && after && (
        before.name !== after.name || before.folderId !== after.folderId ||
        before.dataFormat !== after.dataFormat || before.bitmapResolution !== after.bitmapResolution ||
        before.rotationCenterX !== after.rotationCenterX || before.rotationCenterY !== after.rotationCenterY ||
        before.sourceAuthorityRevision !== after.sourceAuthorityRevision || before.byteLength !== after.byteLength
    )
);

const createWorkspaceProjectTransactionReviewService = ({
    projectCommandHost,
    contextService,
    getResourceDatabase = () => null
}) => {
    requireReviewSources({projectCommandHost, contextService, getResourceDatabase});
    const listeners = new Set();
    let revision = 0;
    let disposed = false;
    let resourceDatabase = null;
    let unsubscribeResource = null;

    const assertActive = () => {
        if (disposed) {
            throw makeReviewError(
                'NGVGE_WORKSPACE_PROJECT_TRANSACTION_REVIEW_DISPOSED',
                'Workspace Project Transaction Review service has been disposed.'
            );
        }
    };

    const emit = (type, detail = null) => {
        revision += 1;
        const event = freezeDeep({
            reviewServiceId: WORKSPACE_PROJECT_TRANSACTION_REVIEW_ID,
            revision,
            type,
            detail
        });
        listeners.forEach(listener => {
            try {
                listener(event);
            } catch {
                // Review observers never become Project mutation authority.
            }
        });
    };

    const bindResourceDiagnostics = () => {
        const next = getResourceDatabase();
        if (next === resourceDatabase) return next;
        const previous = resourceDatabase;
        if (unsubscribeResource) unsubscribeResource();
        unsubscribeResource = null;
        resourceDatabase = next || null;
        if (resourceDatabase && typeof resourceDatabase.subscribe === 'function') {
            unsubscribeResource = resourceDatabase.subscribe(event => emit('source:resource', {
                type: event && event.type ? event.type : null
            }));
        }
        if (previous !== null) {
            emit('source:resource-binding', {
                available: Boolean(resourceDatabase)
            });
        }
        return resourceDatabase;
    };

    const unsubscribeHost = projectCommandHost.subscribe(event => emit('source:project-command', {
        type: event && event.type ? event.type : null
    }));
    const unsubscribeContext = contextService.subscribe(event => emit('source:context', {
        revision: event && Number.isInteger(event.revision) ? event.revision : null
    }));
    bindResourceDiagnostics();

    const reviewProposal = (proposalId, {toolId} = {}) => {
        assertActive();
        const ownerToolId = requireToolId(toolId);
        const proposal = projectCommandHost.getProposal(proposalId, {toolId: ownerToolId});
        if (!proposal) return null;
        const diagnostics = [];
        const currentProjectId = getProjectId(contextService);
        const commitAvailability = projectCommandHost.getCommitAvailability(proposalId, {toolId: ownerToolId});
        const source = getResourceDatabaseState(() => bindResourceDiagnostics());
        const shadowByResource = new Map();
        const folders = source.available ? source.database.listFolders() : [];
        const folderIds = new Set(folders.filter(Boolean).map(folder => folder.id));
        const commandReviews = proposal.commands.map((command, index) => {
            let before = shadowByResource.get(command.resourceId) || null;
            if (!before && source.available) {
                const descriptor = source.database.getResource(command.resourceId);
                let contentByteLength = null;
                if (descriptor && descriptor.kind === 'costume' && typeof source.database.getAssetIdForResourceId === 'function' &&
                    typeof source.database.getDataURL === 'function') {
                    const internalId = source.database.getAssetIdForResourceId(command.resourceId);
                    const dataUri = internalId ? source.database.getDataURL(internalId) : null;
                    if (typeof dataUri === 'string' && dataUri.startsWith('data:')) contentByteLength = estimateDataUriBytes(dataUri);
                }
                before = toResourceState(descriptor, {
                    contentRevision: typeof source.database.getResourceContentRevision === 'function' ?
                        source.database.getResourceContentRevision(command.resourceId) : null,
                    byteLength: contentByteLength
                });
                if (before) shadowByResource.set(command.resourceId, before);
            }
            const commandDiagnostics = [];
            if (!source.available) {
                commandDiagnostics.push(normalizeDiagnostic({
                    code: 'NGVGE_WORKSPACE_PROJECT_REVIEW_RESOURCE_AUTHORITY_UNAVAILABLE',
                    severity: WORKSPACE_PROJECT_REVIEW_SEVERITIES.ERROR,
                    message: 'Resource authority is unavailable for Project transaction impact preview.',
                    blocking: true,
                    subject: {commandIndex: index, resourceId: command.resourceId}
                }));
            } else if (!before) {
                commandDiagnostics.push(normalizeDiagnostic({
                    code: 'NGVGE_WORKSPACE_PROJECT_REVIEW_RESOURCE_NOT_FOUND',
                    severity: WORKSPACE_PROJECT_REVIEW_SEVERITIES.ERROR,
                    message: `Resource is unavailable in the current Project: ${command.resourceId}`,
                    blocking: true,
                    subject: {commandIndex: index, resourceId: command.resourceId}
                }));
            }
            if (before && command.kind === WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_MOVE &&
                command.folderId !== null && !folderIds.has(command.folderId)) {
                commandDiagnostics.push(normalizeDiagnostic({
                    code: 'NGVGE_WORKSPACE_PROJECT_REVIEW_FOLDER_NOT_FOUND',
                    severity: WORKSPACE_PROJECT_REVIEW_SEVERITIES.ERROR,
                    message: `Resource folder is unavailable in the current Project: ${command.folderId}`,
                    blocking: true,
                    subject: {commandIndex: index, resourceId: command.resourceId}
                }));
            }
            if (before && command.kind === WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_CONTENT_REPLACE) {
                if (typeof source.database.getResourceContentRevision !== 'function' ||
                    typeof source.database.replaceImageResourceContent !== 'function') {
                    commandDiagnostics.push(normalizeDiagnostic({
                        code: 'NGVGE_WORKSPACE_PROJECT_REVIEW_RESOURCE_CONTENT_AUTHORITY_UNAVAILABLE',
                        severity: WORKSPACE_PROJECT_REVIEW_SEVERITIES.ERROR,
                        message: 'Image Resource content replacement authority is unavailable.',
                        blocking: true,
                        subject: {commandIndex: index, resourceId: command.resourceId}
                    }));
                } else if (before.kind !== 'image') {
                    commandDiagnostics.push(normalizeDiagnostic({
                        code: 'NGVGE_WORKSPACE_PROJECT_REVIEW_RESOURCE_CONTENT_KIND_UNSUPPORTED',
                        severity: WORKSPACE_PROJECT_REVIEW_SEVERITIES.ERROR,
                        message: 'Resource content replacement currently supports image Resources only.',
                        blocking: true,
                        subject: {commandIndex: index, resourceId: command.resourceId}
                    }));
                } else if (before.sourceAuthorityRevision !== command.expectedSourceAuthorityRevision) {
                    commandDiagnostics.push(normalizeDiagnostic({
                        code: 'NGVGE_WORKSPACE_PROJECT_REVIEW_RESOURCE_CONTENT_SOURCE_STALE',
                        severity: WORKSPACE_PROJECT_REVIEW_SEVERITIES.ERROR,
                        message: 'Image Resource content changed after the Paint working copy was loaded.',
                        blocking: true,
                        subject: {commandIndex: index, resourceId: command.resourceId}
                    }));
                }
            }
            const after = before ? applyCommandToShadow(command, before) : null;
            const changed = resourceStateChanged(before, after);
            if (before && after && !changed) {
                commandDiagnostics.push(normalizeDiagnostic({
                    code: 'NGVGE_WORKSPACE_PROJECT_REVIEW_NO_OP',
                    severity: WORKSPACE_PROJECT_REVIEW_SEVERITIES.INFO,
                    message: 'Command does not change the current Resource metadata.',
                    blocking: false,
                    subject: {commandIndex: index, resourceId: command.resourceId}
                }));
            }
            if (after) shadowByResource.set(command.resourceId, after);
            diagnostics.push(...commandDiagnostics);
            return freezeDeep({
                schemaVersion: WORKSPACE_PROJECT_TRANSACTION_REVIEW_SCHEMA_VERSION,
                commandIndex: index,
                kind: command.kind,
                domain: command.kind === WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_CONTENT_REPLACE ?
                    'resource.content' : 'resource.metadata',
                resourceId: command.resourceId,
                reversible: true,
                destructive: command.kind === WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_CONTENT_REPLACE,
                changed,
                before,
                after,
                diagnostics: commandDiagnostics
            });
        });

        if (!currentProjectId || currentProjectId !== proposal.projectId) {
            diagnostics.push(normalizeDiagnostic({
                code: 'NGVGE_WORKSPACE_PROJECT_REVIEW_STALE_PROJECT_CONTEXT',
                severity: WORKSPACE_PROJECT_REVIEW_SEVERITIES.ERROR,
                message: 'Proposal belongs to a different or unavailable Project Context.',
                blocking: true,
                subject: {proposalId}
            }));
        }
        if (!commitAvailability.available) {
            diagnostics.push(normalizeDiagnostic({
                code: commitAvailability.code || 'NGVGE_WORKSPACE_PROJECT_REVIEW_COMMIT_UNAVAILABLE',
                severity: WORKSPACE_PROJECT_REVIEW_SEVERITIES.ERROR,
                message: commitAvailability.message || 'Project command proposal cannot be committed.',
                blocking: true,
                subject: {proposalId}
            }));
        }

        const hasBlocking = diagnostics.some(diagnostic => diagnostic.blocking);
        let state = WORKSPACE_PROJECT_REVIEW_STATES.READY;
        if (proposal.state === WORKSPACE_PROJECT_PROPOSAL_STATES.COMMITTED) {
            state = WORKSPACE_PROJECT_REVIEW_STATES.COMPLETED;
        } else if (proposal.state === WORKSPACE_PROJECT_PROPOSAL_STATES.FAILED) {
            state = WORKSPACE_PROJECT_REVIEW_STATES.FAILED;
        } else if (!currentProjectId || currentProjectId !== proposal.projectId) {
            state = WORKSPACE_PROJECT_REVIEW_STATES.STALE;
        } else if (hasBlocking) {
            state = WORKSPACE_PROJECT_REVIEW_STATES.BLOCKED;
        }
        const changedCommandCount = commandReviews.filter(command => command.changed).length;
        const resourceIds = Object.freeze(Array.from(new Set(commandReviews.map(command => command.resourceId))));
        const domains = Object.freeze(Array.from(new Set(commandReviews.map(command => command.domain))));
        return freezeDeep({
            schemaVersion: WORKSPACE_PROJECT_TRANSACTION_REVIEW_SCHEMA_VERSION,
            reviewServiceId: WORKSPACE_PROJECT_TRANSACTION_REVIEW_ID,
            kind: WORKSPACE_PROJECT_REVIEW_KINDS.PROPOSAL,
            proposalId: proposal.proposalId,
            projectId: proposal.projectId,
            toolId: proposal.toolId,
            label: proposal.label,
            proposalState: proposal.state,
            state,
            canCommit: state === WORKSPACE_PROJECT_REVIEW_STATES.READY && commitAvailability.available && !hasBlocking,
            commands: commandReviews,
            impact: {
                domains,
                resourceIds,
                commandCount: commandReviews.length,
                changedCommandCount,
                noOpCommandCount: commandReviews.length - changedCommandCount,
                reversible: true,
                destructive: commandReviews.some(command => command.destructive)
            },
            diagnostics
        });
    };

    const reviewTransaction = (transactionId, {toolId} = {}) => {
        assertActive();
        const ownerToolId = requireToolId(toolId);
        const transaction = projectCommandHost.getTransaction(transactionId, {toolId: ownerToolId});
        if (!transaction) return null;
        const diagnostics = [];
        const currentProjectId = getProjectId(contextService);
        const rollbackAvailability = projectCommandHost.getRollbackAvailability(transactionId, {toolId: ownerToolId});
        if (!currentProjectId || currentProjectId !== transaction.projectId) {
            diagnostics.push(normalizeDiagnostic({
                code: 'NGVGE_WORKSPACE_PROJECT_REVIEW_STALE_PROJECT_CONTEXT',
                severity: WORKSPACE_PROJECT_REVIEW_SEVERITIES.ERROR,
                message: 'Transaction belongs to a different or unavailable Project Context.',
                blocking: true,
                subject: {transactionId}
            }));
        }
        if (transaction.state === WORKSPACE_PROJECT_TRANSACTION_STATES.FAILED) {
            diagnostics.push(normalizeDiagnostic({
                code: 'NGVGE_WORKSPACE_PROJECT_REVIEW_TRANSACTION_FAILED',
                severity: WORKSPACE_PROJECT_REVIEW_SEVERITIES.ERROR,
                message: transaction.error || 'Project transaction failed.',
                blocking: true,
                subject: {transactionId}
            }));
        }
        if (transaction.state === WORKSPACE_PROJECT_TRANSACTION_STATES.ROLLBACK_FAILED) {
            diagnostics.push(normalizeDiagnostic({
                code: 'NGVGE_WORKSPACE_PROJECT_REVIEW_ROLLBACK_FAILED',
                severity: WORKSPACE_PROJECT_REVIEW_SEVERITIES.ERROR,
                message: transaction.rollbackError || 'Project transaction rollback failed.',
                blocking: true,
                subject: {transactionId}
            }));
        }
        if (!rollbackAvailability.available && transaction.state === WORKSPACE_PROJECT_TRANSACTION_STATES.COMMITTED) {
            diagnostics.push(normalizeDiagnostic({
                code: rollbackAvailability.code || 'NGVGE_WORKSPACE_PROJECT_REVIEW_ROLLBACK_UNAVAILABLE',
                severity: WORKSPACE_PROJECT_REVIEW_SEVERITIES.WARNING,
                message: rollbackAvailability.message || 'Project transaction cannot currently be rolled back.',
                blocking: false,
                subject: {transactionId}
            }));
        }
        let state = WORKSPACE_PROJECT_REVIEW_STATES.COMPLETED;
        if (transaction.state === WORKSPACE_PROJECT_TRANSACTION_STATES.FAILED ||
            transaction.state === WORKSPACE_PROJECT_TRANSACTION_STATES.ROLLBACK_FAILED) {
            state = WORKSPACE_PROJECT_REVIEW_STATES.FAILED;
        } else if (!currentProjectId || currentProjectId !== transaction.projectId) {
            state = WORKSPACE_PROJECT_REVIEW_STATES.STALE;
        }
        return freezeDeep({
            schemaVersion: WORKSPACE_PROJECT_TRANSACTION_REVIEW_SCHEMA_VERSION,
            reviewServiceId: WORKSPACE_PROJECT_TRANSACTION_REVIEW_ID,
            kind: WORKSPACE_PROJECT_REVIEW_KINDS.TRANSACTION,
            transactionId: transaction.transactionId,
            proposalId: transaction.proposalId,
            projectId: transaction.projectId,
            toolId: transaction.toolId,
            transactionState: transaction.state,
            state,
            appliedCount: Number.isInteger(transaction.appliedCount) ? transaction.appliedCount : 0,
            commandCount: Number.isInteger(transaction.commandCount) ? transaction.commandCount : null,
            canRollback: rollbackAvailability.available === true,
            rollbackAvailability,
            diagnostics
        });
    };

    return Object.freeze({
        id: WORKSPACE_PROJECT_TRANSACTION_REVIEW_ID,
        get revision () {
            return revision;
        },
        reviewProposal,
        reviewTransaction,
        getState () {
            assertActive();
            bindResourceDiagnostics();
            return freezeDeep({
                reviewServiceId: WORKSPACE_PROJECT_TRANSACTION_REVIEW_ID,
                revision,
                disposed,
                projectCommandAvailability: projectCommandHost.getAvailability(),
                currentProjectId: getProjectId(contextService),
                resourceAuthorityAvailable: getResourceDatabaseState(() => bindResourceDiagnostics()).available
            });
        },
        subscribe (listener) {
            assertActive();
            if (typeof listener !== 'function') return () => false;
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        dispose () {
            if (disposed) return false;
            disposed = true;
            unsubscribeHost();
            unsubscribeContext();
            if (unsubscribeResource) unsubscribeResource();
            unsubscribeResource = null;
            resourceDatabase = null;
            listeners.clear();
            return true;
        }
    });
};

export {
    WORKSPACE_PROJECT_TRANSACTION_REVIEW_ID,
    WORKSPACE_PROJECT_TRANSACTION_REVIEW_SCHEMA_VERSION,
    WORKSPACE_PROJECT_TRANSACTION_DIAGNOSTIC_SCHEMA_VERSION,
    WORKSPACE_PROJECT_REVIEW_KINDS,
    WORKSPACE_PROJECT_REVIEW_STATES,
    WORKSPACE_PROJECT_REVIEW_SEVERITIES,
    createWorkspaceProjectTransactionReviewService
};
