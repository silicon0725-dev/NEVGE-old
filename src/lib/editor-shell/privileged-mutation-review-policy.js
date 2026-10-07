import {
    TOOL_CAPABILITY_ACCESS,
    WORKSPACE_TOOL_CAPABILITIES
} from './tool-capability';

const WORKSPACE_PRIVILEGED_MUTATION_REVIEW_POLICY_ID = 'ngvge.workspace-privileged-mutation-review-policy@1';
const WORKSPACE_PRIVILEGED_MUTATION_REVIEW_POLICY_SCHEMA_VERSION = 1;
const WORKSPACE_MUTATION_REVIEW_EVIDENCE_SCHEMA_VERSION = 1;

const WORKSPACE_MUTATION_REVIEW_MODES = Object.freeze({
    NOT_REQUIRED: 'not-required',
    REVIEW_REQUIRED: 'review-required',
    DIRECT_DENIED: 'direct-denied'
});

const WORKSPACE_MUTATION_REVIEW_OPERATIONS = Object.freeze({
    COMMIT: 'commit',
    ROLLBACK: 'rollback'
});

const WORKSPACE_MUTATION_REVIEW_EVIDENCE_STATES = Object.freeze({
    ACTIVE: 'active',
    CONSUMED: 'consumed',
    STALE: 'stale',
    REVOKED: 'revoked'
});

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

const makePolicyError = (code, message, ErrorClass = Error) => {
    const error = new ErrorClass(message);
    error.code = code;
    return error;
};

const requireToolId = toolId => {
    if (typeof toolId !== 'string' || !toolId.trim()) {
        throw new TypeError('Privileged mutation Review Policy requires an admitted ToolId owner.');
    }
    return toolId.trim();
};

const requireCapabilityLease = (capabilityLease, toolId) => {
    if (!capabilityLease || typeof capabilityLease.assert !== 'function' ||
        typeof capabilityLease.isActive !== 'function' || typeof capabilityLease.subscribeRevocation !== 'function' ||
        typeof capabilityLease.id !== 'string') {
        throw new TypeError('Privileged mutation Review Policy requires a Tool Capability lease.');
    }
    if (capabilityLease.toolId !== toolId) {
        throw makePolicyError(
            'NGVGE_WORKSPACE_MUTATION_REVIEW_TOOL_LEASE_MISMATCH',
            'Mutation Review Evidence ToolId must match the admitted Capability lease owner.'
        );
    }
    capabilityLease.assert(WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND, TOOL_CAPABILITY_ACCESS.MUTATE);
    return capabilityLease;
};

const requireReviewService = reviewService => {
    if (!reviewService || typeof reviewService.reviewProposal !== 'function' ||
        typeof reviewService.reviewTransaction !== 'function' || typeof reviewService.getState !== 'function' ||
        typeof reviewService.subscribe !== 'function') {
        throw new TypeError('Privileged mutation Review Policy requires Project Transaction Review/Diagnostics service.');
    }
    return reviewService;
};

const surfaceKey = (capabilityId, access) => `${capabilityId}#${access}`;

const SURFACE_POLICIES = Object.freeze({
    [surfaceKey(WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND, TOOL_CAPABILITY_ACCESS.MUTATE)]: freezeDeep({
        capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND,
        access: TOOL_CAPABILITY_ACCESS.MUTATE,
        mode: WORKSPACE_MUTATION_REVIEW_MODES.REVIEW_REQUIRED,
        code: null,
        message: 'Project mutation requires fresh Review Evidence bound to Tool, Project Context, and Capability lease.'
    }),
    [surfaceKey(WORKSPACE_TOOL_CAPABILITIES.RESOURCE_COMMAND, TOOL_CAPABILITY_ACCESS.MUTATE)]: freezeDeep({
        capabilityId: WORKSPACE_TOOL_CAPABILITIES.RESOURCE_COMMAND,
        access: TOOL_CAPABILITY_ACCESS.MUTATE,
        mode: WORKSPACE_MUTATION_REVIEW_MODES.DIRECT_DENIED,
        code: 'NGVGE_WORKSPACE_RESOURCE_DIRECT_MUTATION_REVIEW_REQUIRED',
        message: 'Direct Resource mutation is disabled for Workspace Tools. Use a reviewed Project transaction for supported mutations.'
    })
});

const createWorkspacePrivilegedMutationReviewPolicy = ({projectTransactionReviewService}) => {
    const reviewService = requireReviewService(projectTransactionReviewService);
    const evidenceById = new Map();
    const evidenceIdsByLease = new Map();
    const leaseSubscriptions = new Map();
    const listeners = new Set();
    let evidenceSequence = 0;
    let revision = 0;
    let disposed = false;

    const assertActive = () => {
        if (disposed) {
            throw makePolicyError(
                'NGVGE_WORKSPACE_MUTATION_REVIEW_POLICY_DISPOSED',
                'Workspace Privileged Mutation Review Policy has been disposed.'
            );
        }
    };

    const emit = (type, detail = null) => {
        revision += 1;
        const event = freezeDeep({
            policyId: WORKSPACE_PRIVILEGED_MUTATION_REVIEW_POLICY_ID,
            revision,
            type,
            detail
        });
        listeners.forEach(listener => {
            try {
                listener(event);
            } catch {
                // Policy observers are diagnostics only and never become mutation authority.
            }
        });
    };

    const getSurfacePolicy = (capabilityId, access) => SURFACE_POLICIES[surfaceKey(capabilityId, access)] || freezeDeep({
        capabilityId,
        access,
        mode: WORKSPACE_MUTATION_REVIEW_MODES.NOT_REQUIRED,
        code: null,
        message: 'This Capability surface does not require privileged mutation Review Evidence.'
    });

    const publicEvidence = state => freezeDeep({
        schemaVersion: WORKSPACE_MUTATION_REVIEW_EVIDENCE_SCHEMA_VERSION,
        evidenceId: state.evidenceId,
        policyId: WORKSPACE_PRIVILEGED_MUTATION_REVIEW_POLICY_ID,
        operation: state.operation,
        capabilityId: WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND,
        access: TOOL_CAPABILITY_ACCESS.MUTATE,
        subjectId: state.subjectId,
        projectId: state.projectId,
        toolId: state.toolId,
        capabilityLeaseId: state.capabilityLeaseId,
        reviewServiceId: state.reviewServiceId,
        reviewRevision: state.reviewRevision,
        state: state.state,
        revokeReason: state.revokeReason
    });

    const trackLease = capabilityLease => {
        if (leaseSubscriptions.has(capabilityLease.id)) return;
        const unsubscribe = capabilityLease.subscribeRevocation(event => {
            const ids = evidenceIdsByLease.get(capabilityLease.id);
            if (ids) {
                ids.forEach(evidenceId => {
                    const state = evidenceById.get(evidenceId);
                    if (!state || state.state !== WORKSPACE_MUTATION_REVIEW_EVIDENCE_STATES.ACTIVE) return;
                    state.state = WORKSPACE_MUTATION_REVIEW_EVIDENCE_STATES.REVOKED;
                    state.revokeReason = event && event.reason ? `capability-lease:${event.reason}` : 'capability-lease-revoked';
                    emit('evidence:revoked', {evidenceId, reason: state.revokeReason});
                });
            }
            const release = leaseSubscriptions.get(capabilityLease.id);
            leaseSubscriptions.delete(capabilityLease.id);
            evidenceIdsByLease.delete(capabilityLease.id);
            if (release) release();
        });
        leaseSubscriptions.set(capabilityLease.id, unsubscribe);
    };

    const registerEvidence = ({operation, subjectId, projectId, toolId, capabilityLease, reviewState}) => {
        const evidenceId = `ngvge.workspace-mutation-review-evidence.${++evidenceSequence}`;
        const state = {
            evidenceId,
            operation,
            subjectId,
            projectId,
            toolId,
            capabilityLeaseId: capabilityLease.id,
            reviewServiceId: reviewState.reviewServiceId,
            reviewRevision: reviewState.revision,
            state: WORKSPACE_MUTATION_REVIEW_EVIDENCE_STATES.ACTIVE,
            revokeReason: null
        };
        evidenceById.set(evidenceId, state);
        if (!evidenceIdsByLease.has(capabilityLease.id)) evidenceIdsByLease.set(capabilityLease.id, new Set());
        evidenceIdsByLease.get(capabilityLease.id).add(evidenceId);
        trackLease(capabilityLease);
        emit('evidence:issued', {evidenceId, operation, subjectId, toolId, projectId});
        return publicEvidence(state);
    };

    const prepareCommitReview = (proposalId, {toolId, capabilityLease} = {}) => {
        assertActive();
        const ownerToolId = requireToolId(toolId);
        const lease = requireCapabilityLease(capabilityLease, ownerToolId);
        const review = reviewService.reviewProposal(proposalId, {toolId: ownerToolId});
        if (!review) {
            throw makePolicyError(
                'NGVGE_WORKSPACE_MUTATION_REVIEW_SUBJECT_NOT_FOUND',
                `Project command proposal is unavailable for Review Evidence: ${proposalId}`
            );
        }
        if (!review.canCommit) {
            throw makePolicyError(
                'NGVGE_WORKSPACE_MUTATION_REVIEW_BLOCKED',
                'Project mutation cannot receive Review Evidence while Proposal Review is blocking commit.'
            );
        }
        const reviewState = reviewService.getState();
        const evidence = registerEvidence({
            operation: WORKSPACE_MUTATION_REVIEW_OPERATIONS.COMMIT,
            subjectId: proposalId,
            projectId: review.projectId,
            toolId: ownerToolId,
            capabilityLease: lease,
            reviewState
        });
        return freezeDeep({review, evidence});
    };

    const prepareRollbackReview = (transactionId, {toolId, capabilityLease} = {}) => {
        assertActive();
        const ownerToolId = requireToolId(toolId);
        const lease = requireCapabilityLease(capabilityLease, ownerToolId);
        const review = reviewService.reviewTransaction(transactionId, {toolId: ownerToolId});
        if (!review) {
            throw makePolicyError(
                'NGVGE_WORKSPACE_MUTATION_REVIEW_SUBJECT_NOT_FOUND',
                `Project transaction is unavailable for Rollback Review Evidence: ${transactionId}`
            );
        }
        if (!review.canRollback) {
            throw makePolicyError(
                'NGVGE_WORKSPACE_MUTATION_REVIEW_BLOCKED',
                'Project rollback cannot receive Review Evidence while Transaction Review blocks rollback.'
            );
        }
        const reviewState = reviewService.getState();
        const evidence = registerEvidence({
            operation: WORKSPACE_MUTATION_REVIEW_OPERATIONS.ROLLBACK,
            subjectId: transactionId,
            projectId: review.projectId,
            toolId: ownerToolId,
            capabilityLease: lease,
            reviewState
        });
        return freezeDeep({review, evidence});
    };

    const resolveEvidenceState = evidence => {
        if (!evidence || typeof evidence !== 'object' || typeof evidence.evidenceId !== 'string') {
            throw makePolicyError(
                'NGVGE_WORKSPACE_MUTATION_REVIEW_EVIDENCE_REQUIRED',
                'Privileged Project mutation requires Review Evidence.',
                TypeError
            );
        }
        const state = evidenceById.get(evidence.evidenceId);
        if (!state) {
            throw makePolicyError(
                'NGVGE_WORKSPACE_MUTATION_REVIEW_EVIDENCE_INVALID',
                `Mutation Review Evidence is unknown: ${evidence.evidenceId}`
            );
        }
        return state;
    };

    const consumeEvidence = (operation, subjectId, evidence, {toolId, capabilityLease} = {}) => {
        assertActive();
        const ownerToolId = requireToolId(toolId);
        const lease = requireCapabilityLease(capabilityLease, ownerToolId);
        const state = resolveEvidenceState(evidence);
        if (state.state !== WORKSPACE_MUTATION_REVIEW_EVIDENCE_STATES.ACTIVE) {
            throw makePolicyError(
                state.state === WORKSPACE_MUTATION_REVIEW_EVIDENCE_STATES.STALE ?
                    'NGVGE_WORKSPACE_MUTATION_REVIEW_EVIDENCE_STALE' :
                    state.state === WORKSPACE_MUTATION_REVIEW_EVIDENCE_STATES.CONSUMED ?
                        'NGVGE_WORKSPACE_MUTATION_REVIEW_EVIDENCE_CONSUMED' :
                        'NGVGE_WORKSPACE_MUTATION_REVIEW_EVIDENCE_REVOKED',
                `Mutation Review Evidence is not active: ${state.evidenceId}`
            );
        }
        if (state.operation !== operation || state.subjectId !== subjectId) {
            throw makePolicyError(
                'NGVGE_WORKSPACE_MUTATION_REVIEW_EVIDENCE_SUBJECT_MISMATCH',
                'Mutation Review Evidence does not authorize this operation or subject.'
            );
        }
        if (state.toolId !== ownerToolId) {
            throw makePolicyError(
                'NGVGE_WORKSPACE_MUTATION_REVIEW_EVIDENCE_OWNER_MISMATCH',
                'Mutation Review Evidence can only be consumed by the Tool that reviewed the mutation.'
            );
        }
        if (state.capabilityLeaseId !== lease.id) {
            throw makePolicyError(
                'NGVGE_WORKSPACE_MUTATION_REVIEW_EVIDENCE_LEASE_MISMATCH',
                'Mutation Review Evidence is bound to a different Capability lease.'
            );
        }
        const currentReviewState = reviewService.getState();
        if (currentReviewState.revision !== state.reviewRevision) {
            state.state = WORKSPACE_MUTATION_REVIEW_EVIDENCE_STATES.STALE;
            state.revokeReason = 'review-source-revision-changed';
            emit('evidence:stale', {evidenceId: state.evidenceId, reason: state.revokeReason});
            throw makePolicyError(
                'NGVGE_WORKSPACE_MUTATION_REVIEW_EVIDENCE_STALE',
                'Mutation Review Evidence is stale because Project/Resource/Review source state changed after review.'
            );
        }
        const review = operation === WORKSPACE_MUTATION_REVIEW_OPERATIONS.COMMIT ?
            reviewService.reviewProposal(subjectId, {toolId: ownerToolId}) :
            reviewService.reviewTransaction(subjectId, {toolId: ownerToolId});
        const allowed = operation === WORKSPACE_MUTATION_REVIEW_OPERATIONS.COMMIT ?
            review && review.canCommit : review && review.canRollback;
        if (!review || !allowed || review.projectId !== state.projectId) {
            state.state = WORKSPACE_MUTATION_REVIEW_EVIDENCE_STATES.STALE;
            state.revokeReason = 'review-precondition-changed';
            emit('evidence:stale', {evidenceId: state.evidenceId, reason: state.revokeReason});
            throw makePolicyError(
                'NGVGE_WORKSPACE_MUTATION_REVIEW_EVIDENCE_STALE',
                'Mutation Review Evidence no longer matches current Project transaction preconditions.'
            );
        }
        state.state = WORKSPACE_MUTATION_REVIEW_EVIDENCE_STATES.CONSUMED;
        state.revokeReason = 'one-shot-consumed';
        emit('evidence:consumed', {evidenceId: state.evidenceId, operation, subjectId});
        return publicEvidence(state);
    };

    const getEvidence = (evidenceId, {toolId = null} = {}) => {
        assertActive();
        const state = evidenceById.get(evidenceId);
        if (!state) return null;
        if (toolId !== null && state.toolId !== toolId) {
            throw makePolicyError(
                'NGVGE_WORKSPACE_MUTATION_REVIEW_EVIDENCE_OWNER_MISMATCH',
                'Mutation Review Evidence can only be queried by its Tool owner.'
            );
        }
        return publicEvidence(state);
    };

    const unsubscribeReview = reviewService.subscribe(event => {
        // Freshness is revision-based and validated lazily at mutation time. We intentionally do not mutate
        // every evidence record here because a diagnostic source event may occur while no Tool is active.
        emit('source:review', {
            reviewRevision: event && Number.isInteger(event.revision) ? event.revision : null,
            type: event && event.type ? event.type : null
        });
    });

    return Object.freeze({
        id: WORKSPACE_PRIVILEGED_MUTATION_REVIEW_POLICY_ID,
        get revision () {
            return revision;
        },
        getSurfacePolicy,
        prepareCommitReview,
        prepareRollbackReview,
        consumeCommitEvidence: (proposalId, evidence, options) => consumeEvidence(
            WORKSPACE_MUTATION_REVIEW_OPERATIONS.COMMIT,
            proposalId,
            evidence,
            options
        ),
        consumeRollbackEvidence: (transactionId, evidence, options) => consumeEvidence(
            WORKSPACE_MUTATION_REVIEW_OPERATIONS.ROLLBACK,
            transactionId,
            evidence,
            options
        ),
        getEvidence,
        getState () {
            assertActive();
            const counts = {
                active: 0,
                consumed: 0,
                stale: 0,
                revoked: 0
            };
            evidenceById.forEach(state => {
                if (Object.prototype.hasOwnProperty.call(counts, state.state)) counts[state.state] += 1;
            });
            return freezeDeep({
                policyId: WORKSPACE_PRIVILEGED_MUTATION_REVIEW_POLICY_ID,
                schemaVersion: WORKSPACE_PRIVILEGED_MUTATION_REVIEW_POLICY_SCHEMA_VERSION,
                revision,
                reviewServiceId: reviewService.id,
                evidenceCounts: counts,
                surfaces: Object.freeze([
                    getSurfacePolicy(WORKSPACE_TOOL_CAPABILITIES.PROJECT_COMMAND, TOOL_CAPABILITY_ACCESS.MUTATE),
                    getSurfacePolicy(WORKSPACE_TOOL_CAPABILITIES.RESOURCE_COMMAND, TOOL_CAPABILITY_ACCESS.MUTATE)
                ])
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
            unsubscribeReview();
            leaseSubscriptions.forEach(unsubscribe => unsubscribe());
            leaseSubscriptions.clear();
            evidenceIdsByLease.clear();
            evidenceById.forEach(state => {
                if (state.state === WORKSPACE_MUTATION_REVIEW_EVIDENCE_STATES.ACTIVE) {
                    state.state = WORKSPACE_MUTATION_REVIEW_EVIDENCE_STATES.REVOKED;
                    state.revokeReason = 'policy-disposed';
                }
            });
            listeners.clear();
            return true;
        }
    });
};

export {
    WORKSPACE_PRIVILEGED_MUTATION_REVIEW_POLICY_ID,
    WORKSPACE_PRIVILEGED_MUTATION_REVIEW_POLICY_SCHEMA_VERSION,
    WORKSPACE_MUTATION_REVIEW_EVIDENCE_SCHEMA_VERSION,
    WORKSPACE_MUTATION_REVIEW_MODES,
    WORKSPACE_MUTATION_REVIEW_OPERATIONS,
    WORKSPACE_MUTATION_REVIEW_EVIDENCE_STATES,
    createWorkspacePrivilegedMutationReviewPolicy
};
