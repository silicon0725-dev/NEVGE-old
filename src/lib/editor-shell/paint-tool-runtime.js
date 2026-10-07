import {WorkspacePaintWorkingCopyModel} from './paint-working-copy';
import {TOOL_CAPABILITY_ACCESS, WORKSPACE_TOOL_CAPABILITIES} from './tool-capability';
import {TOOL_IDS} from './tool-registry';
import {
    SVG_EDIT_VECTOR_BACKEND_ADAPTER_ID,
    SVG_EDIT_VECTOR_BACKEND_PACKAGE
} from '../paint-backends/svg-edit-vector-backend';
import {
    CANVAS_RASTER_BACKEND_ADAPTER_ID,
    CANVAS_RASTER_BACKEND_PACKAGE
} from '../paint-backends/canvas-raster-backend';

const WORKSPACE_PAINT_TOOL_SESSION_ID = 'ngvge.workspace-paint-tool-session@1';
const WORKSPACE_PAINT_BACKEND_ADAPTER_ID = 'ngvge.workspace-paint-backend.scratch-paint@1';
const WORKSPACE_PAINT_BACKEND_PACKAGE = 'scratch-paint@2.1.61';
const WORKSPACE_PAINT_SESSION_SCHEMA_VERSION = 4;

const freezeDeep = value => {
    if (Array.isArray(value)) {
        value.forEach(freezeDeep);
        return Object.freeze(value);
    }
    if (value && typeof value === 'object' &&
        (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
        Object.keys(value).forEach(key => freezeDeep(value[key]));
        return Object.freeze(value);
    }
    return value;
};

const makePaintError = (code, message, ErrorClass = Error) => {
    const error = new ErrorClass(message);
    error.code = code;
    return error;
};

const requireHost = capabilityHost => {
    if (!capabilityHost || typeof capabilityHost.admit !== 'function') {
        throw new TypeError('Workspace Paint session requires WorkspaceToolCapabilityHost.');
    }
    return capabilityHost;
};

const requireProviderRegistry = providerRegistry => {
    if (!providerRegistry || typeof providerRegistry.bind !== 'function') {
        throw new TypeError('Workspace Paint session requires WorkspaceCapabilityProviderRegistry.');
    }
    return providerRegistry;
};

const createWorkspacePaintToolSession = ({capabilityHost, providerRegistry}) => {
    const host = requireHost(capabilityHost);
    const providers = requireProviderRegistry(providerRegistry);
    const lease = host.admit(TOOL_IDS.PAINT);
    const bindings = [];
    const bind = (capabilityId, access) => {
        const binding = providers.bind({capabilityLease: lease, capabilityId, access});
        bindings.push(binding);
        return binding.facade;
    };

    let contextRead;
    let resourceRead;
    let resourceContentRead;
    let projectPropose;
    let projectMutate;
    try {
        contextRead = bind(WORKSPACE_TOOL_CAPABILITIES.CONTEXT_READ, TOOL_CAPABILITY_ACCESS.QUERY);
        resourceRead = bind(WORKSPACE_TOOL_CAPABILITIES.RESOURCE_READ, TOOL_CAPABILITY_ACCESS.QUERY);
        resourceContentRead = bind(WORKSPACE_TOOL_CAPABILITIES.RESOURCE_CONTENT_READ, TOOL_CAPABILITY_ACCESS.QUERY);
        projectPropose = bind(WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND, TOOL_CAPABILITY_ACCESS.PROPOSE);
        projectMutate = bind(WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND, TOOL_CAPABILITY_ACCESS.MUTATE);
    } catch (error) {
        bindings.forEach(binding => binding.release('paint-session-admission-failed'));
        lease.release('paint-session-admission-failed');
        throw error;
    }

    const workingCopy = new WorkspacePaintWorkingCopyModel({resourceContentRead});
    const listeners = new Set();
    let revision = 0;
    let disposed = false;
    let selectedResourceId = null;
    let draftName = '';
    let proposalId = null;
    let proposalReview = null;
    let transactionId = null;
    let transactionReview = null;
    let status = 'idle';
    let lastError = null;

    const assertActive = () => {
        if (disposed || !lease.isActive()) {
            throw makePaintError('NGVGE_WORKSPACE_PAINT_SESSION_DISPOSED', 'Workspace Paint session is not active.');
        }
    };

    const getImages = () => resourceRead.listResources().filter(resource => resource && resource.kind === 'image');

    const getSelectedResource = () => {
        if (!selectedResourceId) return null;
        const resource = resourceRead.getResource(selectedResourceId);
        return resource && resource.kind === 'image' ? resource : null;
    };

    const emit = type => {
        revision += 1;
        const event = freezeDeep({sessionId: WORKSPACE_PAINT_TOOL_SESSION_ID, revision, type});
        listeners.forEach(listener => {
            try {
                listener(event);
            } catch {
                // Tool view observers never become Project/Resource authority.
            }
        });
    };

    const unsubscribeWorkingCopy = workingCopy.subscribe(event => {
        if (event && event.type === 'source:stale') status = 'working-copy-stale';
        else if (event && event.type === 'working-copy:edited') status = 'working-copy-dirty';
        emit(event && event.type ? event.type : 'working-copy:changed');
    });

    const clearProposalState = () => {
        proposalId = null;
        proposalReview = null;
        transactionReview = null;
        status = 'idle';
        lastError = null;
    };

    const ensureWorkingCopySwitchAllowed = nextResourceId => {
        const state = workingCopy.getState();
        if (state.loaded && state.dirty && state.resourceId !== nextResourceId) {
            throw makePaintError(
                'NGVGE_WORKSPACE_PAINT_WORKING_COPY_DIRTY',
                'Discard the current Paint working copy before switching image Resources.'
            );
        }
    };

    const selectResource = resourceId => {
        assertActive();
        if (resourceId === null || typeof resourceId === 'undefined' || resourceId === '') {
            ensureWorkingCopySwitchAllowed(null);
            workingCopy.clear({discardDirty: false});
            selectedResourceId = null;
            draftName = '';
            clearProposalState();
            emit('resource:cleared');
            return null;
        }
        const resource = resourceRead.getResource(resourceId);
        if (!resource) {
            throw makePaintError('NGVGE_WORKSPACE_PAINT_RESOURCE_NOT_FOUND', `Paint Resource is unavailable: ${resourceId}`);
        }
        if (resource.kind !== 'image') {
            throw makePaintError('NGVGE_WORKSPACE_PAINT_RESOURCE_KIND_UNSUPPORTED', 'Better Paint currently accepts image resources only.');
        }
        ensureWorkingCopySwitchAllowed(resource.resourceId);
        if (!workingCopy.getState().loaded || workingCopy.getState().resourceId !== resource.resourceId) {
            workingCopy.load(resource.resourceId);
        }
        selectedResourceId = resource.resourceId;
        draftName = resource.name;
        clearProposalState();
        emit('resource:selected');
        return resource;
    };

    const syncPreferredResource = () => {
        assertActive();
        const snapshot = contextRead.getSnapshot();
        const preferredId = snapshot && snapshot.resourceId ? snapshot.resourceId : null;
        if (preferredId) {
            try {
                const resource = resourceRead.getResource(preferredId);
                if (resource && resource.kind === 'image' && preferredId !== selectedResourceId) {
                    ensureWorkingCopySwitchAllowed(preferredId);
                    workingCopy.load(preferredId);
                    selectedResourceId = preferredId;
                    draftName = resource.name;
                    clearProposalState();
                    emit('context:resource-selected');
                    return;
                }
            } catch (error) {
                if (error && error.code === 'NGVGE_WORKSPACE_PAINT_WORKING_COPY_DIRTY') {
                    emit('context:resource-switch-deferred');
                    return;
                }
                // A stale context projection/content source must not break the Paint session.
            }
        }
        if (selectedResourceId && !getSelectedResource()) {
            const copyState = workingCopy.getState();
            if (!copyState.dirty) workingCopy.clear({discardDirty: true});
            selectedResourceId = copyState.dirty ? selectedResourceId : null;
            draftName = copyState.dirty ? draftName : '';
            clearProposalState();
            emit(copyState.dirty ? 'context:resource-invalidated-dirty' : 'context:resource-invalidated');
        }
    };

    const unsubscribeContext = contextRead.subscribe(() => syncPreferredResource());
    syncPreferredResource();

    const getState = () => {
        assertActive();
        const resource = getSelectedResource();
        const images = getImages();
        return freezeDeep({
            schemaVersion: WORKSPACE_PAINT_SESSION_SCHEMA_VERSION,
            sessionId: WORKSPACE_PAINT_TOOL_SESSION_ID,
            backend: workingCopy.getState().loaded && workingCopy.getState().dataFormat === 'svg' ? {
                adapterId: SVG_EDIT_VECTOR_BACKEND_ADAPTER_ID,
                package: SVG_EDIT_VECTOR_BACKEND_PACKAGE,
                status: 'vector-backend-integrated'
            } : workingCopy.getState().loaded && ['png', 'jpg', 'jpeg'].includes(workingCopy.getState().dataFormat) ? {
                adapterId: CANVAS_RASTER_BACKEND_ADAPTER_ID,
                package: CANVAS_RASTER_BACKEND_PACKAGE,
                status: 'bitmap-raster-core-integrated'
            } : {
                adapterId: WORKSPACE_PAINT_BACKEND_ADAPTER_ID,
                package: WORKSPACE_PAINT_BACKEND_PACKAGE,
                status: 'compatibility-raster-backend'
            },
            revision,
            status,
            selectedResourceId,
            resource,
            imageResources: images,
            draft: {name: draftName},
            workingCopy: workingCopy.getState(),
            proposalId,
            proposalReview,
            transactionId,
            transactionReview,
            lastError
        });
    };

    const getWorkingCopyContent = () => {
        assertActive();
        return workingCopy.getContent();
    };

    const applyWorkingCopyEdit = edit => {
        assertActive();
        proposalId = null;
        proposalReview = null;
        lastError = null;
        return workingCopy.applyEdit(edit);
    };

    const discardWorkingCopy = () => {
        assertActive();
        const state = workingCopy.discard();
        status = 'working-copy-clean';
        lastError = null;
        emit('working-copy:discarded');
        return state;
    };

    const reloadWorkingCopy = () => {
        assertActive();
        const state = workingCopy.reload();
        status = 'working-copy-clean';
        lastError = null;
        emit('working-copy:reloaded');
        return state;
    };

    const setDraftName = name => {
        assertActive();
        if (typeof name !== 'string') throw new TypeError('Paint Resource name draft must be a string.');
        draftName = name;
        proposalId = null;
        proposalReview = null;
        status = 'dirty';
        lastError = null;
        emit('draft:changed');
        return getState();
    };

    const reviewChanges = () => {
        assertActive();
        const resource = getSelectedResource();
        if (!resource) {
            throw makePaintError('NGVGE_WORKSPACE_PAINT_RESOURCE_REQUIRED', 'Select an image Resource before reviewing changes.');
        }
        const nextName = draftName.trim();
        if (!nextName) {
            throw makePaintError('NGVGE_WORKSPACE_PAINT_NAME_INVALID', 'Resource name cannot be empty.', TypeError);
        }
        const commands = [];
        if (nextName !== resource.name) {
            commands.push({
                schemaVersion: 1,
                kind: 'resource.rename',
                resourceId: resource.resourceId,
                name: nextName
            });
        }
        const copyState = workingCopy.getState();
        if (copyState.loaded && copyState.dirty) {
            const copy = workingCopy.getContent();
            commands.push({
                schemaVersion: 1,
                kind: 'resource.content.replace',
                resourceId: resource.resourceId,
                expectedSourceAuthorityRevision: copy.sourceAuthorityRevision,
                dataFormat: copy.dataFormat,
                bitmapResolution: copy.bitmapResolution,
                rotationCenterX: copy.rotationCenterX,
                rotationCenterY: copy.rotationCenterY,
                content: copy.content
            });
        }
        if (!commands.length) {
            throw makePaintError(
                'NGVGE_WORKSPACE_PAINT_NO_CHANGES',
                'There are no Paint metadata or image-content changes to review.'
            );
        }
        const contentChanged = commands.some(command => command.kind === 'resource.content.replace');
        const metadataChanged = commands.some(command => command.kind !== 'resource.content.replace');
        const proposal = projectPropose.createProposal({
            schemaVersion: 1,
            label: contentChanged ?
                `Better Paint: ${metadataChanged ? 'update' : 'replace content for'} ${resource.name}` :
                `Better Paint: rename ${resource.name}`,
            commands
        });
        proposalId = proposal.proposalId;
        proposalReview = projectPropose.reviewProposal(proposalId);
        status = proposalReview && proposalReview.canCommit ? 'review-ready' : 'review-blocked';
        lastError = null;
        emit('proposal:reviewed');
        return proposalReview;
    };

    const commitReviewedChanges = async () => {
        assertActive();
        if (!proposalId || !proposalReview || !proposalReview.canCommit) {
            throw makePaintError(
                'NGVGE_WORKSPACE_PAINT_REVIEW_REQUIRED',
                'Better Paint requires a fresh non-blocking Project transaction Review before commit.'
            );
        }
        status = 'committing';
        emit('transaction:committing');
        try {
            const prepared = projectPropose.prepareMutationReview(proposalId);
            const transaction = await projectMutate.execute(proposalId, {reviewEvidence: prepared.evidence});
            transactionId = transaction.transactionId;
            transactionReview = projectMutate.reviewTransaction(transactionId);
            const resource = getSelectedResource();
            draftName = resource ? resource.name : draftName;
            if (selectedResourceId && workingCopy.getState().loaded) {
                workingCopy.load(selectedResourceId, {discardDirty: true});
            }
            proposalId = null;
            proposalReview = null;
            status = 'committed';
            lastError = null;
            emit('transaction:committed');
            return transaction;
        } catch (error) {
            status = 'failed';
            lastError = {code: error.code || null, message: error.message || String(error)};
            emit('transaction:failed');
            throw error;
        }
    };

    const rollbackLastTransaction = async () => {
        assertActive();
        if (!transactionId) {
            throw makePaintError('NGVGE_WORKSPACE_PAINT_TRANSACTION_REQUIRED', 'No committed Paint transaction is available to rollback.');
        }
        const review = projectMutate.reviewTransaction(transactionId);
        if (!review || !review.canRollback) {
            throw makePaintError(
                'NGVGE_WORKSPACE_PAINT_ROLLBACK_BLOCKED',
                'The last Paint transaction cannot be rolled back in the current Project state.'
            );
        }
        const prepared = projectMutate.prepareRollbackReview(transactionId);
        const transaction = await projectMutate.rollback(transactionId, {reviewEvidence: prepared.evidence});
        transactionReview = projectMutate.reviewTransaction(transactionId);
        const resource = getSelectedResource();
        draftName = resource ? resource.name : draftName;
        if (selectedResourceId && workingCopy.getState().loaded) {
            workingCopy.load(selectedResourceId, {discardDirty: true});
        }
        status = 'rolled-back';
        lastError = null;
        emit('transaction:rolled-back');
        return transaction;
    };

    const subscribe = listener => {
        assertActive();
        if (typeof listener !== 'function') throw new TypeError('Workspace Paint session listener must be a function.');
        listeners.add(listener);
        return () => listeners.delete(listener);
    };

    const dispose = () => {
        if (disposed) return false;
        disposed = true;
        unsubscribeContext();
        unsubscribeWorkingCopy();
        workingCopy.dispose();
        bindings.forEach(binding => binding.release('paint-session-disposed'));
        lease.release('paint-session-disposed');
        listeners.clear();
        return true;
    };

    return Object.freeze({
        id: WORKSPACE_PAINT_TOOL_SESSION_ID,
        backendAdapterId: WORKSPACE_PAINT_BACKEND_ADAPTER_ID,
        toolId: TOOL_IDS.PAINT,
        getState,
        getWorkingCopyContent,
        selectResource,
        applyWorkingCopyEdit,
        discardWorkingCopy,
        reloadWorkingCopy,
        setDraftName,
        reviewChanges,
        commitReviewedChanges,
        rollbackLastTransaction,
        subscribe,
        dispose
    });
};

export {
    WORKSPACE_PAINT_TOOL_SESSION_ID,
    WORKSPACE_PAINT_BACKEND_ADAPTER_ID,
    WORKSPACE_PAINT_BACKEND_PACKAGE,
    WORKSPACE_PAINT_SESSION_SCHEMA_VERSION,
    createWorkspacePaintToolSession
};
