import {AUTHORITY_MODES, createAuthorityRegistry} from '../../core/authority';
import {STABLE_ID_KINDS, isStableIdentity} from '../../core/identity/stable-identity';
import {normalizePortableImageContent} from '../project-assets/image-content-payload';
import {
    RESOURCE_COMMAND_KINDS,
    normalizeResourceCommand
} from './workspace-project-resource-capabilities';

const WORKSPACE_PROJECT_COMMAND_HOST_ID = 'ngvge.workspace-project-command-host@1';
const WORKSPACE_PROJECT_COMMAND_AUTHORITY_ID = 'authority:ngvge.workspace-project-command-host';
const WORKSPACE_PROJECT_COMMAND_DOMAIN_ID = 'ngvge.project.command.transaction';
const WORKSPACE_PROJECT_COMMAND_SCHEMA_VERSION = 1;
const WORKSPACE_PROJECT_COMMAND_PROPOSAL_SCHEMA_VERSION = 1;
const WORKSPACE_PROJECT_TRANSACTION_SCHEMA_VERSION = 1;
const WORKSPACE_PROJECT_COMMAND_MAX_COMMANDS = 64;

const WORKSPACE_PROJECT_COMMAND_KINDS = Object.freeze({
    RESOURCE_RENAME: 'resource.rename',
    RESOURCE_MOVE: 'resource.move',
    RESOURCE_CONTENT_REPLACE: 'resource.content.replace'
});

const WORKSPACE_PROJECT_PROPOSAL_STATES = Object.freeze({
    PROPOSED: 'proposed',
    COMMITTING: 'committing',
    COMMITTED: 'committed',
    FAILED: 'failed'
});

const WORKSPACE_PROJECT_TRANSACTION_STATES = Object.freeze({
    COMMITTED: 'committed',
    FAILED: 'failed',
    ROLLED_BACK: 'rolled-back',
    ROLLBACK_FAILED: 'rollback-failed'
});

const FORBIDDEN_COMMAND_KEYS = new Set([
    'asset',
    'backend',
    'backendHandle',
    'handle',
    'raw',
    'rawVM',
    'renderer',
    'scratchTarget',
    'target',
    'vm'
]);

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

const makeProjectCommandError = (code, message, ErrorClass = Error) => {
    const error = new ErrorClass(message);
    error.code = code;
    return error;
};

const assertPortableCommand = value => {
    const visit = current => {
        if (!current || typeof current !== 'object') return;
        Object.entries(current).forEach(([key, item]) => {
            if (FORBIDDEN_COMMAND_KEYS.has(key)) {
                throw makeProjectCommandError(
                    'NGVGE_WORKSPACE_PROJECT_COMMAND_RAW_AUTHORITY_FORBIDDEN',
                    `Project command contains forbidden raw authority field: ${key}`
                );
            }
            visit(item);
        });
    };
    visit(value);
};

const normalizeLabel = label => {
    if (label === null || typeof label === 'undefined' || label === '') return 'Workspace Project Change';
    if (typeof label !== 'string' || !label.trim()) {
        throw makeProjectCommandError(
            'NGVGE_WORKSPACE_PROJECT_COMMAND_LABEL_INVALID',
            'Project command proposal label must be a non-empty string.',
            TypeError
        );
    }
    return label.trim().slice(0, 120);
};

const normalizeProjectCommand = command => {
    if (!isPlainObject(command)) {
        throw makeProjectCommandError(
            'NGVGE_WORKSPACE_PROJECT_COMMAND_INVALID',
            'Project command must be a plain object.',
            TypeError
        );
    }
    assertPortableCommand(command);
    if (command.schemaVersion !== WORKSPACE_PROJECT_COMMAND_SCHEMA_VERSION) {
        throw makeProjectCommandError(
            'NGVGE_WORKSPACE_PROJECT_COMMAND_SCHEMA_INVALID',
            `Project command schemaVersion must be ${WORKSPACE_PROJECT_COMMAND_SCHEMA_VERSION}.`,
            TypeError
        );
    }
    if (command.kind === WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_RENAME) {
        const normalized = normalizeResourceCommand({
            schemaVersion: 1,
            kind: RESOURCE_COMMAND_KINDS.RENAME,
            resourceId: command.resourceId,
            name: command.name
        });
        return freezeDeep({
            schemaVersion: WORKSPACE_PROJECT_COMMAND_SCHEMA_VERSION,
            kind: WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_RENAME,
            resourceId: normalized.resourceId,
            name: normalized.name
        });
    }
    if (command.kind === WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_MOVE) {
        const normalized = normalizeResourceCommand({
            schemaVersion: 1,
            kind: RESOURCE_COMMAND_KINDS.MOVE,
            resourceId: command.resourceId,
            folderId: command.folderId
        });
        return freezeDeep({
            schemaVersion: WORKSPACE_PROJECT_COMMAND_SCHEMA_VERSION,
            kind: WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_MOVE,
            resourceId: normalized.resourceId,
            folderId: normalized.folderId
        });
    }
    if (command.kind === WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_CONTENT_REPLACE) {
        if (!isStableIdentity(command.resourceId, STABLE_ID_KINDS.RESOURCE)) {
            throw makeProjectCommandError(
                'NGVGE_WORKSPACE_PROJECT_COMMAND_RESOURCE_ID_INVALID',
                'Resource content replacement requires a canonical ngvge:resource:* ResourceId.',
                TypeError
            );
        }
        if (!Number.isInteger(command.expectedSourceAuthorityRevision) || command.expectedSourceAuthorityRevision < 0) {
            throw makeProjectCommandError(
                'NGVGE_WORKSPACE_PROJECT_COMMAND_CONTENT_SOURCE_REVISION_INVALID',
                'Resource content replacement requires a non-negative expectedSourceAuthorityRevision.',
                TypeError
            );
        }
        const normalizedContent = normalizePortableImageContent({
            dataFormat: command.dataFormat,
            content: command.content
        });
        const defaultBitmapResolution = normalizedContent.dataFormat === 'svg' ? 1 : 2;
        const bitmapResolution = typeof command.bitmapResolution === 'undefined' || command.bitmapResolution === null ?
            defaultBitmapResolution : command.bitmapResolution;
        if ((normalizedContent.dataFormat === 'svg' && bitmapResolution !== 1) ||
            (normalizedContent.dataFormat !== 'svg' && bitmapResolution !== 1 && bitmapResolution !== 2)) {
            throw makeProjectCommandError(
                'NGVGE_WORKSPACE_PROJECT_COMMAND_CONTENT_BITMAP_RESOLUTION_INVALID',
                'Resource content replacement bitmapResolution must be 1 for SVG and 1 or 2 for bitmap images.',
                TypeError
            );
        }
        return freezeDeep({
            schemaVersion: WORKSPACE_PROJECT_COMMAND_SCHEMA_VERSION,
            kind: WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_CONTENT_REPLACE,
            resourceId: command.resourceId,
            expectedSourceAuthorityRevision: command.expectedSourceAuthorityRevision,
            dataFormat: normalizedContent.dataFormat,
            bitmapResolution,
            rotationCenterX: Number.isFinite(command.rotationCenterX) ? command.rotationCenterX : 0,
            rotationCenterY: Number.isFinite(command.rotationCenterY) ? command.rotationCenterY : 0,
            byteLength: normalizedContent.byteLength,
            content: normalizedContent.content
        });
    }
    throw makeProjectCommandError(
        'NGVGE_WORKSPACE_PROJECT_COMMAND_KIND_UNSUPPORTED',
        `Unsupported Project command kind: ${String(command.kind)}`,
        TypeError
    );
};

const requireProjectId = contextService => {
    const snapshot = contextService && typeof contextService.getSnapshot === 'function' ? contextService.getSnapshot() : null;
    const projectId = snapshot && typeof snapshot.projectId === 'string' && snapshot.projectId.trim() ?
        snapshot.projectId.trim() : null;
    if (!projectId) {
        throw makeProjectCommandError(
            'NGVGE_WORKSPACE_PROJECT_COMMAND_PROJECT_CONTEXT_UNAVAILABLE',
            'Project command requires an active Workspace Project Context.'
        );
    }
    return projectId;
};

const requireResourceTransactionAuthority = getResourceDatabase => {
    const database = typeof getResourceDatabase === 'function' ? getResourceDatabase() : null;
    if (!database || typeof database.perform !== 'function' || typeof database.undo !== 'function' ||
        typeof database.getHistoryState !== 'function' || typeof database.getResource !== 'function' ||
        typeof database.getAssetIdForResourceId !== 'function' || typeof database.renameAsset !== 'function' ||
        typeof database.moveAsset !== 'function' || typeof database.listFolders !== 'function') {
        throw makeProjectCommandError(
            'NGVGE_WORKSPACE_PROJECT_COMMAND_TRANSACTION_ADAPTER_UNAVAILABLE',
            'Project command Resource transaction adapter is unavailable.'
        );
    }
    return database;
};

const getResourceTransactionAvailability = getResourceDatabase => {
    try {
        requireResourceTransactionAuthority(getResourceDatabase);
        return {available: true, code: null, message: null};
    } catch (error) {
        return {
            available: false,
            code: error.code || 'NGVGE_WORKSPACE_PROJECT_COMMAND_TRANSACTION_ADAPTER_UNAVAILABLE',
            message: error.message
        };
    }
};

const createResourceTransactionAdapter = ({getResourceDatabase}) => {
    const getInternalId = (database, resourceId) => {
        const internalId = database.getAssetIdForResourceId(resourceId);
        if (!internalId) {
            throw makeProjectCommandError(
                'NGVGE_WORKSPACE_PROJECT_COMMAND_RESOURCE_NOT_FOUND',
                `Project command ResourceId is unavailable: ${resourceId}`
            );
        }
        return internalId;
    };

    const prepareInverse = (database, command) => {
        const descriptor = database.getResource(command.resourceId);
        if (!descriptor) {
            throw makeProjectCommandError(
                'NGVGE_WORKSPACE_PROJECT_COMMAND_RESOURCE_NOT_FOUND',
                `Project command ResourceId is unavailable: ${command.resourceId}`
            );
        }
        if (command.kind === WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_RENAME) {
            return freezeDeep({
                schemaVersion: WORKSPACE_PROJECT_COMMAND_SCHEMA_VERSION,
                kind: WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_RENAME,
                resourceId: command.resourceId,
                name: typeof descriptor.name === 'string' ? descriptor.name : ''
            });
        }
        if (command.kind === WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_CONTENT_REPLACE) {
            if (typeof database.getDataURL !== 'function' || typeof database.getResourceContentRevision !== 'function') {
                throw makeProjectCommandError(
                    'NGVGE_WORKSPACE_PROJECT_COMMAND_RESOURCE_CONTENT_ADAPTER_UNAVAILABLE',
                    'Project command image-content adapter is unavailable.'
                );
            }
            if (descriptor.kind !== 'costume') {
                throw makeProjectCommandError(
                    'NGVGE_WORKSPACE_PROJECT_COMMAND_RESOURCE_CONTENT_KIND_UNSUPPORTED',
                    'Project content replacement currently supports image Resources only.'
                );
            }
            const internalId = getInternalId(database, command.resourceId);
            const dataUri = database.getDataURL(internalId);
            const currentRevision = database.getResourceContentRevision(command.resourceId);
            if (typeof dataUri !== 'string' || !dataUri.startsWith('data:') || !Number.isInteger(currentRevision)) {
                throw makeProjectCommandError(
                    'NGVGE_WORKSPACE_PROJECT_COMMAND_RESOURCE_CONTENT_UNAVAILABLE',
                    `Project command Resource content is unavailable: ${command.resourceId}`
                );
            }
            return normalizeProjectCommand({
                schemaVersion: WORKSPACE_PROJECT_COMMAND_SCHEMA_VERSION,
                kind: WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_CONTENT_REPLACE,
                resourceId: command.resourceId,
                expectedSourceAuthorityRevision: currentRevision + 1,
                dataFormat: descriptor.dataFormat,
                bitmapResolution: descriptor.bitmapResolution,
                rotationCenterX: descriptor.rotationCenterX,
                rotationCenterY: descriptor.rotationCenterY,
                content: {kind: 'data-uri', dataUri}
            });
        }
        return freezeDeep({
            schemaVersion: WORKSPACE_PROJECT_COMMAND_SCHEMA_VERSION,
            kind: WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_MOVE,
            resourceId: command.resourceId,
            folderId: typeof descriptor.folderId === 'string' ? descriptor.folderId : null
        });
    };

    const execute = (database, command) => {
        const internalId = getInternalId(database, command.resourceId);
        if (command.kind === WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_RENAME) {
            return Boolean(database.renameAsset(internalId, command.name));
        }
        if (command.kind === WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_CONTENT_REPLACE) {
            if (typeof database.replaceImageResourceContent !== 'function') {
                throw makeProjectCommandError(
                    'NGVGE_WORKSPACE_PROJECT_COMMAND_RESOURCE_CONTENT_ADAPTER_UNAVAILABLE',
                    'Project command image-content replacement adapter is unavailable.'
                );
            }
            return database.replaceImageResourceContent(command.resourceId, command);
        }
        if (command.folderId !== null) {
            const folders = database.listFolders();
            if (!folders.some(folder => folder && folder.id === command.folderId)) {
                throw makeProjectCommandError(
                    'NGVGE_WORKSPACE_PROJECT_COMMAND_RESOURCE_FOLDER_NOT_FOUND',
                    `Project command Resource folder is unavailable: ${command.folderId}`
                );
            }
        }
        return Boolean(database.moveAsset(internalId, command.folderId));
    };

    return Object.freeze({
        domainId: 'ngvge.project-command-adapter.resource-metadata@1',
        getAvailability: () => getResourceTransactionAvailability(getResourceDatabase),
        runTransaction: (label, action) => requireResourceTransactionAuthority(getResourceDatabase).perform(label, action),
        prepareInverse: command => prepareInverse(requireResourceTransactionAuthority(getResourceDatabase), command),
        execute: command => execute(requireResourceTransactionAuthority(getResourceDatabase), command),
        rollbackCommitted (label) {
            const database = requireResourceTransactionAuthority(getResourceDatabase);
            const history = database.getHistoryState();
            if (!history || history.nextUndoLabel !== label) {
                throw makeProjectCommandError(
                    'NGVGE_WORKSPACE_PROJECT_TRANSACTION_ROLLBACK_ORDER_CONFLICT',
                    'Project transaction cannot rollback because a newer Resource history entry exists.'
                );
            }
            if (!database.undo()) {
                throw makeProjectCommandError(
                    'NGVGE_WORKSPACE_PROJECT_TRANSACTION_ROLLBACK_UNAVAILABLE',
                    'Project transaction Resource history rollback is unavailable.'
                );
            }
            return true;
        }
    });
};

const clonePublic = record => freezeDeep(JSON.parse(JSON.stringify(record)));

const createWorkspaceProjectCommandHost = ({contextService, getResourceDatabase = () => null}) => {
    if (!contextService || typeof contextService.getSnapshot !== 'function') {
        throw new TypeError('Workspace Project Command Host requires WorkspaceContextService.');
    }
    const authorityRegistry = createAuthorityRegistry([{
        authorityId: WORKSPACE_PROJECT_COMMAND_AUTHORITY_ID,
        domain: WORKSPACE_PROJECT_COMMAND_DOMAIN_ID,
        mode: AUTHORITY_MODES.WRITER
    }]);
    const resourceAdapter = createResourceTransactionAdapter({getResourceDatabase});
    const proposals = new Map();
    const transactions = new Map();
    const listeners = new Set();
    let proposalSequence = 0;
    let transactionSequence = 0;
    let revision = 0;
    let disposed = false;
    let operationQueue = Promise.resolve();

    const assertActive = () => {
        if (disposed) {
            throw makeProjectCommandError(
                'NGVGE_WORKSPACE_PROJECT_COMMAND_HOST_DISPOSED',
                'Workspace Project Command Host has been disposed.'
            );
        }
    };

    const emit = (type, detail = null) => {
        revision += 1;
        const event = freezeDeep({hostId: WORKSPACE_PROJECT_COMMAND_HOST_ID, revision, type, detail});
        listeners.forEach(listener => {
            try {
                listener(event);
            } catch {
                // Observers are diagnostics only and never become transaction authority.
            }
        });
    };

    const getAvailability = () => {
        if (disposed) {
            return freezeDeep({
                available: false,
                code: 'NGVGE_WORKSPACE_PROJECT_COMMAND_HOST_DISPOSED',
                message: 'Workspace Project Command Host has been disposed.'
            });
        }
        return freezeDeep(resourceAdapter.getAvailability());
    };

    const getSupportedCommands = () => Object.freeze([
        WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_RENAME,
        WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_MOVE,
        WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_CONTENT_REPLACE
    ]);

    const createProposal = (input, {toolId} = {}) => {
        assertActive();
        if (typeof toolId !== 'string' || !toolId.trim()) {
            throw new TypeError('Project command proposal requires an admitted ToolId owner.');
        }
        if (!isPlainObject(input) || input.schemaVersion !== WORKSPACE_PROJECT_COMMAND_PROPOSAL_SCHEMA_VERSION) {
            throw makeProjectCommandError(
                'NGVGE_WORKSPACE_PROJECT_COMMAND_PROPOSAL_SCHEMA_INVALID',
                `Project command proposal schemaVersion must be ${WORKSPACE_PROJECT_COMMAND_PROPOSAL_SCHEMA_VERSION}.`,
                TypeError
            );
        }
        const allowedFields = ['schemaVersion', 'label', 'commands'];
        const unknown = Object.keys(input).filter(key => !allowedFields.includes(key));
        if (unknown.length) {
            throw makeProjectCommandError(
                'NGVGE_WORKSPACE_PROJECT_COMMAND_PROPOSAL_FIELD_UNSUPPORTED',
                `Project command proposal contains unsupported field(s): ${unknown.join(', ')}`
            );
        }
        if (!Array.isArray(input.commands) || input.commands.length < 1 ||
            input.commands.length > WORKSPACE_PROJECT_COMMAND_MAX_COMMANDS) {
            throw makeProjectCommandError(
                'NGVGE_WORKSPACE_PROJECT_COMMAND_PROPOSAL_COMMANDS_INVALID',
                `Project command proposal requires 1-${WORKSPACE_PROJECT_COMMAND_MAX_COMMANDS} commands.`,
                TypeError
            );
        }
        const projectId = requireProjectId(contextService);
        const commands = Object.freeze(input.commands.map(normalizeProjectCommand));
        const proposalId = `ngvge.workspace-project-command-proposal.${++proposalSequence}`;
        const record = {
            schemaVersion: WORKSPACE_PROJECT_COMMAND_PROPOSAL_SCHEMA_VERSION,
            hostId: WORKSPACE_PROJECT_COMMAND_HOST_ID,
            proposalId,
            projectId,
            toolId: toolId.trim(),
            label: normalizeLabel(input.label),
            commands,
            state: WORKSPACE_PROJECT_PROPOSAL_STATES.PROPOSED
        };
        proposals.set(proposalId, record);
        emit('proposal:created', {proposalId, projectId, toolId: record.toolId});
        return clonePublic(record);
    };

    const getProposal = (proposalId, {toolId = null} = {}) => {
        const record = proposals.get(proposalId);
        if (!record) return null;
        if (toolId !== null && record.toolId !== toolId) {
            throw makeProjectCommandError(
                'NGVGE_WORKSPACE_PROJECT_COMMAND_PROPOSAL_OWNER_MISMATCH',
                'Project command proposal can only be queried by its admitted Tool owner.'
            );
        }
        return clonePublic(record);
    };

    const getTransaction = (transactionId, {toolId = null} = {}) => {
        const stored = transactions.get(transactionId);
        if (!stored) return null;
        if (toolId !== null && stored.publicRecord.toolId !== toolId) {
            throw makeProjectCommandError(
                'NGVGE_WORKSPACE_PROJECT_TRANSACTION_OWNER_MISMATCH',
                'Project transaction can only be queried by its admitted Tool owner.'
            );
        }
        return clonePublic(stored.publicRecord);
    };

    const requireOwnedProposal = (proposalId, toolId) => {
        const proposal = proposals.get(proposalId);
        if (!proposal) {
            throw makeProjectCommandError(
                'NGVGE_WORKSPACE_PROJECT_COMMAND_PROPOSAL_NOT_FOUND',
                `Project command proposal is unavailable: ${proposalId}`
            );
        }
        if (proposal.toolId !== toolId) {
            throw makeProjectCommandError(
                'NGVGE_WORKSPACE_PROJECT_COMMAND_PROPOSAL_OWNER_MISMATCH',
                'Project command proposal can only be committed by its admitted Tool owner.'
            );
        }
        if (proposal.state !== WORKSPACE_PROJECT_PROPOSAL_STATES.PROPOSED) {
            throw makeProjectCommandError(
                'NGVGE_WORKSPACE_PROJECT_COMMAND_PROPOSAL_NOT_COMMITTABLE',
                `Project command proposal is not committable from state: ${proposal.state}`
            );
        }
        const currentProjectId = requireProjectId(contextService);
        if (proposal.projectId !== currentProjectId) {
            throw makeProjectCommandError(
                'NGVGE_WORKSPACE_PROJECT_COMMAND_STALE_PROJECT_CONTEXT',
                'Project command proposal belongs to a different Project Context.'
            );
        }
        return proposal;
    };

    const getCommitAvailability = (proposalId, {toolId = null} = {}) => {
        if (disposed) {
            return freezeDeep({
                available: false,
                code: 'NGVGE_WORKSPACE_PROJECT_COMMAND_HOST_DISPOSED',
                message: 'Workspace Project Command Host has been disposed.'
            });
        }
        const proposal = proposals.get(proposalId);
        if (!proposal) {
            return freezeDeep({
                available: false,
                code: 'NGVGE_WORKSPACE_PROJECT_COMMAND_PROPOSAL_NOT_FOUND',
                message: `Project command proposal is unavailable: ${proposalId}`
            });
        }
        if (toolId !== null && proposal.toolId !== toolId) {
            throw makeProjectCommandError(
                'NGVGE_WORKSPACE_PROJECT_COMMAND_PROPOSAL_OWNER_MISMATCH',
                'Project command proposal can only be diagnosed by its admitted Tool owner.'
            );
        }
        if (proposal.state !== WORKSPACE_PROJECT_PROPOSAL_STATES.PROPOSED) {
            return freezeDeep({
                available: false,
                code: 'NGVGE_WORKSPACE_PROJECT_COMMAND_PROPOSAL_NOT_COMMITTABLE',
                message: `Project command proposal is not committable from state: ${proposal.state}`
            });
        }
        let currentProjectId;
        try {
            currentProjectId = requireProjectId(contextService);
        } catch (error) {
            return freezeDeep({
                available: false,
                code: error.code || 'NGVGE_WORKSPACE_PROJECT_COMMAND_PROJECT_CONTEXT_UNAVAILABLE',
                message: error.message
            });
        }
        if (proposal.projectId !== currentProjectId) {
            return freezeDeep({
                available: false,
                code: 'NGVGE_WORKSPACE_PROJECT_COMMAND_STALE_PROJECT_CONTEXT',
                message: 'Project command proposal belongs to a different Project Context.'
            });
        }
        return freezeDeep(resourceAdapter.getAvailability());
    };

    const getRollbackAvailability = (transactionId, {toolId = null} = {}) => {
        if (disposed) {
            return freezeDeep({
                available: false,
                code: 'NGVGE_WORKSPACE_PROJECT_COMMAND_HOST_DISPOSED',
                message: 'Workspace Project Command Host has been disposed.'
            });
        }
        const stored = transactions.get(transactionId);
        if (!stored) {
            return freezeDeep({
                available: false,
                code: 'NGVGE_WORKSPACE_PROJECT_TRANSACTION_NOT_FOUND',
                message: `Project transaction is unavailable: ${transactionId}`
            });
        }
        if (toolId !== null && stored.publicRecord.toolId !== toolId) {
            throw makeProjectCommandError(
                'NGVGE_WORKSPACE_PROJECT_TRANSACTION_OWNER_MISMATCH',
                'Project transaction can only be diagnosed by its admitted Tool owner.'
            );
        }
        if (stored.publicRecord.state !== WORKSPACE_PROJECT_TRANSACTION_STATES.COMMITTED) {
            return freezeDeep({
                available: false,
                code: 'NGVGE_WORKSPACE_PROJECT_TRANSACTION_NOT_ROLLBACKABLE',
                message: `Project transaction is not rollbackable from state: ${stored.publicRecord.state}`
            });
        }
        let currentProjectId;
        try {
            currentProjectId = requireProjectId(contextService);
        } catch (error) {
            return freezeDeep({
                available: false,
                code: error.code || 'NGVGE_WORKSPACE_PROJECT_COMMAND_PROJECT_CONTEXT_UNAVAILABLE',
                message: error.message
            });
        }
        if (currentProjectId !== stored.publicRecord.projectId) {
            return freezeDeep({
                available: false,
                code: 'NGVGE_WORKSPACE_PROJECT_TRANSACTION_STALE_PROJECT_CONTEXT',
                message: 'Project transaction belongs to a different Project Context.'
            });
        }
        const adapterAvailability = resourceAdapter.getAvailability();
        if (!adapterAvailability.available) return freezeDeep(adapterAvailability);
        try {
            const database = requireResourceTransactionAuthority(getResourceDatabase);
            const history = database.getHistoryState();
            if (!history || history.nextUndoLabel !== stored.historyLabel) {
                return freezeDeep({
                    available: false,
                    code: 'NGVGE_WORKSPACE_PROJECT_TRANSACTION_ROLLBACK_ORDER_CONFLICT',
                    message: 'Project transaction cannot rollback because a newer Resource history entry exists.'
                });
            }
        } catch (error) {
            return freezeDeep({
                available: false,
                code: error.code || 'NGVGE_WORKSPACE_PROJECT_TRANSACTION_ROLLBACK_UNAVAILABLE',
                message: error.message
            });
        }
        return freezeDeep({available: true, code: null, message: null});
    };

    const commitNow = async (proposalId, {toolId}) => {
        assertActive();
        const proposal = requireOwnedProposal(proposalId, toolId);
        proposal.state = WORKSPACE_PROJECT_PROPOSAL_STATES.COMMITTING;
        const transactionId = `ngvge.workspace-project-transaction.${++transactionSequence}`;
        const historyLabel = `Workspace Project Transaction ${transactionId}`;
        const inverses = [];
        const results = [];
        let rollbackError = null;
        try {
            await resourceAdapter.runTransaction(historyLabel, async () => {
                try {
                    for (const command of proposal.commands) {
                        const inverse = resourceAdapter.prepareInverse(command);
                        const changed = await Promise.resolve(resourceAdapter.execute(command));
                        results.push(freezeDeep({kind: command.kind, changed: Boolean(changed)}));
                        if (changed) inverses.push(inverse);
                    }
                } catch (error) {
                    for (let index = inverses.length - 1; index >= 0; index--) {
                        try {
                            await Promise.resolve(resourceAdapter.execute(inverses[index]));
                        } catch (nextError) {
                            rollbackError = nextError;
                            break;
                        }
                    }
                    throw error;
                }
            });
        } catch (error) {
            proposal.state = WORKSPACE_PROJECT_PROPOSAL_STATES.FAILED;
            const publicRecord = freezeDeep({
                schemaVersion: WORKSPACE_PROJECT_TRANSACTION_SCHEMA_VERSION,
                hostId: WORKSPACE_PROJECT_COMMAND_HOST_ID,
                transactionId,
                proposalId,
                projectId: proposal.projectId,
                toolId: proposal.toolId,
                state: rollbackError ?
                    WORKSPACE_PROJECT_TRANSACTION_STATES.ROLLBACK_FAILED : WORKSPACE_PROJECT_TRANSACTION_STATES.FAILED,
                appliedCount: results.filter(result => result.changed).length,
                error: error && error.message ? error.message : String(error),
                rollbackError: rollbackError ? rollbackError.message : null
            });
            transactions.set(transactionId, {publicRecord, historyLabel});
            emit('transaction:failed', {transactionId, proposalId});
            const wrapped = makeProjectCommandError(
                rollbackError ?
                    'NGVGE_WORKSPACE_PROJECT_TRANSACTION_ROLLBACK_FAILED' : 'NGVGE_WORKSPACE_PROJECT_TRANSACTION_FAILED',
                `Workspace Project transaction failed: ${publicRecord.error}`
            );
            wrapped.transaction = publicRecord;
            throw wrapped;
        }

        proposal.state = WORKSPACE_PROJECT_PROPOSAL_STATES.COMMITTED;
        const publicRecord = freezeDeep({
            schemaVersion: WORKSPACE_PROJECT_TRANSACTION_SCHEMA_VERSION,
            hostId: WORKSPACE_PROJECT_COMMAND_HOST_ID,
            transactionId,
            proposalId,
            projectId: proposal.projectId,
            toolId: proposal.toolId,
            state: WORKSPACE_PROJECT_TRANSACTION_STATES.COMMITTED,
            appliedCount: results.filter(result => result.changed).length,
            commandCount: proposal.commands.length
        });
        transactions.set(transactionId, {publicRecord, historyLabel});
        emit('transaction:committed', {transactionId, proposalId});
        return publicRecord;
    };

    const commit = (proposalId, options = {}) => {
        const run = () => commitNow(proposalId, options);
        const result = operationQueue.then(run, run);
        operationQueue = result.catch(() => null);
        return result;
    };

    const rollbackNow = async (transactionId, {toolId}) => {
        assertActive();
        const stored = transactions.get(transactionId);
        if (!stored || stored.publicRecord.state !== WORKSPACE_PROJECT_TRANSACTION_STATES.COMMITTED) {
            throw makeProjectCommandError(
                'NGVGE_WORKSPACE_PROJECT_TRANSACTION_NOT_ROLLBACKABLE',
                `Project transaction is not rollbackable: ${transactionId}`
            );
        }
        if (stored.publicRecord.toolId !== toolId) {
            throw makeProjectCommandError(
                'NGVGE_WORKSPACE_PROJECT_TRANSACTION_OWNER_MISMATCH',
                'Project transaction can only be rolled back by its admitted Tool owner.'
            );
        }
        const currentProjectId = requireProjectId(contextService);
        if (currentProjectId !== stored.publicRecord.projectId) {
            throw makeProjectCommandError(
                'NGVGE_WORKSPACE_PROJECT_TRANSACTION_STALE_PROJECT_CONTEXT',
                'Project transaction belongs to a different Project Context.'
            );
        }
        try {
            resourceAdapter.rollbackCommitted(stored.historyLabel);
        } catch (error) {
            const failed = freezeDeep(Object.assign({}, stored.publicRecord, {
                state: WORKSPACE_PROJECT_TRANSACTION_STATES.ROLLBACK_FAILED,
                rollbackError: error.message
            }));
            transactions.set(transactionId, {publicRecord: failed, historyLabel: stored.historyLabel});
            emit('transaction:rollback-failed', {transactionId});
            const wrapped = makeProjectCommandError(
                error.code || 'NGVGE_WORKSPACE_PROJECT_TRANSACTION_ROLLBACK_FAILED',
                `Workspace Project transaction rollback failed: ${error.message}`
            );
            wrapped.transaction = failed;
            throw wrapped;
        }
        const rolledBack = freezeDeep(Object.assign({}, stored.publicRecord, {
            state: WORKSPACE_PROJECT_TRANSACTION_STATES.ROLLED_BACK
        }));
        transactions.set(transactionId, {publicRecord: rolledBack, historyLabel: stored.historyLabel});
        emit('transaction:rolled-back', {transactionId});
        return rolledBack;
    };

    const rollback = (transactionId, options = {}) => {
        const run = () => rollbackNow(transactionId, options);
        const result = operationQueue.then(run, run);
        operationQueue = result.catch(() => null);
        return result;
    };

    const getState = () => freezeDeep({
        hostId: WORKSPACE_PROJECT_COMMAND_HOST_ID,
        authority: authorityRegistry.getWriter(WORKSPACE_PROJECT_COMMAND_DOMAIN_ID),
        revision,
        disposed,
        proposalCount: proposals.size,
        transactionCount: transactions.size,
        supportedCommands: getSupportedCommands(),
        availability: getAvailability()
    });

    return Object.freeze({
        id: WORKSPACE_PROJECT_COMMAND_HOST_ID,
        createProposal,
        commit,
        rollback,
        getProposal,
        getTransaction,
        getCommitAvailability,
        getRollbackAvailability,
        getSupportedCommands,
        getAvailability,
        getState,
        subscribe (listener) {
            if (typeof listener !== 'function') return () => false;
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        dispose () {
            if (disposed) return false;
            disposed = true;
            listeners.clear();
            return true;
        }
    });
};

export {
    WORKSPACE_PROJECT_COMMAND_HOST_ID,
    WORKSPACE_PROJECT_COMMAND_AUTHORITY_ID,
    WORKSPACE_PROJECT_COMMAND_DOMAIN_ID,
    WORKSPACE_PROJECT_COMMAND_SCHEMA_VERSION,
    WORKSPACE_PROJECT_COMMAND_PROPOSAL_SCHEMA_VERSION,
    WORKSPACE_PROJECT_TRANSACTION_SCHEMA_VERSION,
    WORKSPACE_PROJECT_COMMAND_KINDS,
    WORKSPACE_PROJECT_PROPOSAL_STATES,
    WORKSPACE_PROJECT_TRANSACTION_STATES,
    normalizeProjectCommand,
    createWorkspaceProjectCommandHost
};
