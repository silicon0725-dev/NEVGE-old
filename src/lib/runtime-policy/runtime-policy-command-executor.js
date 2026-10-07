/* eslint-disable import/no-commonjs, strict */
'use strict';

const {
    PROTOCOL_DTO_KINDS,
    createEngineEvent,
    createProtocolError,
    createQuerySnapshot,
    normalizeProtocolDTO
} = require('../../core/protocol');
const {RUNTIME_POLICY_DOMAIN_IDS} = require('./constants');
const {normalizeRuntimePolicySet} = require('./runtime-policy-contract');
const {createRuntimePolicyResolver} = require('./runtime-policy-resolver');
const {
    RUNTIME_POLICY_COMMAND_EVENT_TYPES,
    RUNTIME_POLICY_COMMAND_TYPES
} = require('./runtime-policy-command-capability');

const RUNTIME_POLICY_COMMAND_EXECUTOR_ID = 'ngvge.runtime-policy-command-executor@1';
const COMMAND_TYPES = new Set(Object.values(RUNTIME_POLICY_COMMAND_TYPES));
const POLICY_DOMAINS = Object.freeze(Object.values(RUNTIME_POLICY_DOMAIN_IDS));
const POLICY_DOMAIN_SET = new Set(POLICY_DOMAINS);
const PAYLOAD_FIELDS = Object.freeze({
    [RUNTIME_POLICY_COMMAND_TYPES.APPLY_PROFILE]: new Set(['profileId']),
    [RUNTIME_POLICY_COMMAND_TYPES.PATCH_DOMAIN]: new Set(['domain', 'patch'])
});
const FORBIDDEN_COMMAND_FIELDS = new Set([
    'authorityId',
    'vm',
    'renderer',
    'scratchTarget',
    'backendHandle',
    'privateBackendHandle',
    'opsPerFrame',
    'miscLimits',
    'stageWidth',
    'stageHeight',
    '_twconfig_'
]);

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const createCommandError = (code, message) => Object.assign(new Error(message), {code});

const collectForbiddenFields = (value, path = '$', matches = []) => {
    if (!value || typeof value !== 'object') return matches;
    if (Array.isArray(value)) {
        value.forEach((entry, index) => collectForbiddenFields(entry, `${path}[${index}]`, matches));
        return matches;
    }
    Object.keys(value).forEach(key => {
        const fieldPath = `${path}.${key}`;
        if (FORBIDDEN_COMMAND_FIELDS.has(key)) matches.push(fieldPath);
        collectForbiddenFields(value[key], fieldPath, matches);
    });
    return matches;
};

const validatePayload = (type, payload) => {
    if (!isPlainObject(payload)) {
        throw createCommandError(
            'NGVGE_RUNTIME_POLICY_COMMAND_PAYLOAD_INVALID',
            'Runtime Policy command payload must be a plain portable object.'
        );
    }
    const unsupported = Object.keys(payload).filter(key => !PAYLOAD_FIELDS[type].has(key));
    if (unsupported.length) {
        throw createCommandError(
            'NGVGE_RUNTIME_POLICY_COMMAND_PAYLOAD_UNSUPPORTED',
            `Runtime Policy command payload contains unsupported field(s): ${unsupported.join(', ')}`
        );
    }
    const forbidden = collectForbiddenFields(payload);
    if (forbidden.length) {
        throw createCommandError(
            'NGVGE_RUNTIME_POLICY_COMMAND_BACKEND_SEMANTIC_FORBIDDEN',
            `Legacy/backend-specific fields must not cross the Runtime Policy command boundary: ${forbidden.join(', ')}`
        );
    }
    return payload;
};

const assertAdapter = adapter => {
    if (!adapter || typeof adapter.applyDomain !== 'function') {
        const error = new TypeError('Runtime Policy command executor requires a Compatibility Adapter.');
        error.code = 'NGVGE_RUNTIME_POLICY_ADAPTER_REQUIRED';
        throw error;
    }
    return adapter;
};

const toProtocolFailure = (error, commandType, domain = null) => createProtocolError(
    error && error.code ? error.code : 'NGVGE_RUNTIME_POLICY_COMMAND_FAILED',
    error && error.message ? error.message : String(error),
    {
        commandType,
        domain,
        executorId: RUNTIME_POLICY_COMMAND_EXECUTOR_ID
    }
);

const createRuntimePolicyCommandExecutor = (initialPolicy, adapter, options = {}) => {
    const compatibilityAdapter = assertAdapter(adapter);
    const resolver = options.resolver || createRuntimePolicyResolver();
    let currentPolicy = normalizeRuntimePolicySet(initialPolicy);
    let commandCount = 0;
    let failureCount = 0;
    let lastError = null;
    const listeners = new Set();

    const emit = change => {
        listeners.forEach(listener => {
            try {
                listener(change);
            } catch (error) {
                // Runtime Policy observers are non-authoritative; observer failures cannot roll back
                // a committed policy.
            }
        });
    };

    const getWriterAuthorityId = domain => {
        const writer = resolver.authorityRegistry.getWriter(domain);
        if (!writer) {
            throw createCommandError(
                'NGVGE_RUNTIME_POLICY_WRITER_AUTHORITY_MISSING',
                `Runtime Policy domain has no Writer Authority: ${domain}`
            );
        }
        return writer.authorityId;
    };

    const applyDomain = (policy, domain) => compatibilityAdapter.applyDomain(policy, domain);

    const applyProfileTransaction = candidate => {
        const previous = currentPolicy;
        const appliedDomains = [];
        const plans = [];
        try {
            POLICY_DOMAINS.forEach(domain => {
                plans.push(applyDomain(candidate, domain));
                appliedDomains.push(domain);
            });
            return Object.freeze(plans.slice());
        } catch (error) {
            for (let index = appliedDomains.length - 1; index >= 0; index--) {
                try {
                    applyDomain(previous, appliedDomains[index]);
                } catch (rollbackError) {
                    // Best-effort compatibility rollback. The original failure remains authoritative.
                }
            }
            throw error;
        }
    };

    const succeed = (commandType, payload) => {
        commandCount += 1;
        lastError = null;
        return createEngineEvent(RUNTIME_POLICY_COMMAND_EVENT_TYPES[commandType], payload);
    };

    const fail = (error, commandType, domain = null) => {
        failureCount += 1;
        lastError = error && error.message ? error.message : String(error);
        return toProtocolFailure(error, commandType, domain);
    };

    const executeCommand = command => {
        let commandType = null;
        let domain = null;
        try {
            const normalized = normalizeProtocolDTO(command);
            if (normalized.kind !== PROTOCOL_DTO_KINDS.COMMAND || !COMMAND_TYPES.has(normalized.type)) {
                throw createCommandError(
                    'NGVGE_RUNTIME_POLICY_COMMAND_UNSUPPORTED',
                    `Runtime Policy executor does not support command type: ${normalized.type || 'unknown'}`
                );
            }
            commandType = normalized.type;
            const payload = validatePayload(commandType, normalized.payload || {});

            if (commandType === RUNTIME_POLICY_COMMAND_TYPES.PATCH_DOMAIN) {
                domain = typeof payload.domain === 'string' ? payload.domain.trim() : '';
                if (!POLICY_DOMAIN_SET.has(domain)) {
                    throw createCommandError(
                        'NGVGE_RUNTIME_POLICY_DOMAIN_UNSUPPORTED',
                        `Unknown Runtime Policy domain: ${domain || 'missing'}`
                    );
                }
                if (!isPlainObject(payload.patch)) {
                    throw createCommandError(
                        'NGVGE_RUNTIME_POLICY_PATCH_INVALID',
                        'Runtime Policy domain patch must be a plain portable object.'
                    );
                }
                const candidate = resolver.resolveDomainPatch(currentPolicy, {
                    authorityId: getWriterAuthorityId(domain),
                    domain,
                    patch: payload.patch
                });
                const applicationPlan = applyDomain(candidate, domain);
                currentPolicy = candidate;
                const eventPayload = Object.freeze({
                    applicationPlan,
                    domain,
                    policy: createQuerySnapshot(currentPolicy)
                });
                emit(Object.freeze({type: 'domain-patched', ...eventPayload}));
                return succeed(commandType, eventPayload);
            }

            const profileId = typeof payload.profileId === 'string' ? payload.profileId.trim() : '';
            if (!profileId) {
                throw createCommandError(
                    'NGVGE_RUNTIME_POLICY_PROFILE_REQUIRED',
                    'ApplyRuntimePolicyProfile requires a profileId.'
                );
            }
            const candidate = resolver.resolveProfile(profileId);
            const applicationPlans = applyProfileTransaction(candidate);
            currentPolicy = candidate;
            const eventPayload = Object.freeze({
                applicationPlans,
                policy: createQuerySnapshot(currentPolicy),
                profileId
            });
            emit(Object.freeze({type: 'profile-applied', ...eventPayload}));
            return succeed(commandType, eventPayload);
        } catch (error) {
            return fail(error, commandType, domain);
        }
    };

    return Object.freeze({
        executeCommand,
        getSnapshot: () => createQuerySnapshot(currentPolicy),
        getStatus: () => Object.freeze({
            commandCount,
            executorId: RUNTIME_POLICY_COMMAND_EXECUTOR_ID,
            failureCount,
            lastError,
            profileId: currentPolicy.profileId
        }),
        subscribe: listener => {
            if (typeof listener !== 'function') throw new TypeError('Runtime Policy listener must be a function.');
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    });
};

module.exports = {
    RUNTIME_POLICY_COMMAND_EXECUTOR_ID,
    createRuntimePolicyCommandExecutor
};
