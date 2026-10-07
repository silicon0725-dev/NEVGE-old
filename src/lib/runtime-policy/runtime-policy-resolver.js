/* eslint-disable import/no-commonjs, strict */
'use strict';

const {RUNTIME_POLICY_DOMAIN_IDS} = require('./constants');
const {createRuntimePolicyAuthorityRegistry} = require('./runtime-policy-authority');
const {normalizeRuntimePolicySet} = require('./runtime-policy-contract');
const {createRuntimePolicyProfileRegistry} = require('./profile-registry');

const RUNTIME_POLICY_RESOLVER_ID = 'ngvge.runtime-policy-resolver@1';
const POLICY_DOMAIN_KEYS = Object.freeze({
    [RUNTIME_POLICY_DOMAIN_IDS.EXECUTION]: 'execution',
    [RUNTIME_POLICY_DOMAIN_IDS.PRESENTATION]: 'presentation',
    [RUNTIME_POLICY_DOMAIN_IDS.SAFETY]: 'safety',
    [RUNTIME_POLICY_DOMAIN_IDS.SCRATCH_COMPATIBILITY]: 'scratchCompatibility',
    [RUNTIME_POLICY_DOMAIN_IDS.EXECUTION_BACKEND]: 'executionBackend',
    [RUNTIME_POLICY_DOMAIN_IDS.BACKEND_HINTS]: 'backendHints'
});

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const mergeDomain = (base, patch) => {
    if (!isPlainObject(patch)) throw new TypeError('Runtime Policy domain patch must be a plain object.');
    return Object.assign({}, base, patch);
};

class RuntimePolicyResolver {
    constructor (options = {}) {
        this.id = RUNTIME_POLICY_RESOLVER_ID;
        this.profileRegistry = options.profileRegistry || createRuntimePolicyProfileRegistry();
        this.authorityRegistry = options.authorityRegistry || createRuntimePolicyAuthorityRegistry();
        Object.seal(this);
    }

    resolveProfile (profileId) {
        return this.profileRegistry.createPolicySet(profileId);
    }

    resolveDomainPatch (policy, command) {
        const normalized = normalizeRuntimePolicySet(policy);
        if (!isPlainObject(command)) throw new TypeError('Runtime Policy command must be a plain object.');
        const domainKey = POLICY_DOMAIN_KEYS[command.domain];
        if (!domainKey) throw new TypeError(`Unknown Runtime Policy domain: ${command.domain}`);
        const writer = this.authorityRegistry.getWriter(command.domain);
        if (!writer) throw new Error(`Runtime Policy domain has no Writer Authority: ${command.domain}`);
        if (command.authorityId !== writer.authorityId) {
            const error = new Error(`Runtime Policy command is not owned by Writer Authority for ${command.domain}.`);
            error.code = 'NGVGE_RUNTIME_POLICY_WRITER_AUTHORITY_REQUIRED';
            throw error;
        }
        return normalizeRuntimePolicySet(Object.assign({}, normalized, {
            [domainKey]: mergeDomain(normalized[domainKey], command.patch)
        }));
    }
}

const createRuntimePolicyResolver = options => new RuntimePolicyResolver(options);

module.exports = {
    POLICY_DOMAIN_KEYS,
    RUNTIME_POLICY_RESOLVER_ID,
    RuntimePolicyResolver,
    createRuntimePolicyResolver
};
