'use strict';

const {
    AUTHORITY_MODES,
    normalizeAuthorityId,
    normalizeAuthorityRegistration,
    normalizeStateDomainId
} = require('./authority-contract');

const AUTHORITY_REGISTRY_DUPLICATE = 'NGVGE_AUTHORITY_REGISTRY_DUPLICATE';
const AUTHORITY_REGISTRY_WRITER_CONFLICT = 'NGVGE_AUTHORITY_REGISTRY_WRITER_CONFLICT';
const authorityRegistryStates = new WeakMap();

const getState = instance => {
    const state = authorityRegistryStates.get(instance);
    if (!state) throw new TypeError('Invalid AuthorityRegistry receiver.');
    return state;
};

const compareStrings = (a, b) => (a === b ? 0 : (a < b ? -1 : 1));
const compareRegistrations = (a, b) => {
    const domainOrder = compareStrings(a.domain, b.domain);
    if (domainOrder !== 0) return domainOrder;
    const modeOrder = compareStrings(a.mode, b.mode);
    if (modeOrder !== 0) return modeOrder;
    return compareStrings(a.authorityId, b.authorityId);
};

const createDuplicateError = registration => {
    const error = new Error(
        `Authority "${registration.authorityId}" is already registered for domain "${registration.domain}".`
    );
    error.authorityId = registration.authorityId;
    error.code = AUTHORITY_REGISTRY_DUPLICATE;
    error.domain = registration.domain;
    return error;
};

const createWriterConflictError = (domain, activeAuthorityId, requestedAuthorityId) => {
    const error = new Error(
        `State domain "${domain}" already has active writer Authority "${activeAuthorityId}"; ` +
        `cannot register writer "${requestedAuthorityId}".`
    );
    error.activeAuthorityId = activeAuthorityId;
    error.code = AUTHORITY_REGISTRY_WRITER_CONFLICT;
    error.domain = domain;
    error.requestedAuthorityId = requestedAuthorityId;
    return error;
};

class AuthorityRegistry {
    constructor (registrations = []) {
        authorityRegistryStates.set(this, {
            byDomain: new Map(),
            revision: 0
        });
        if (!Array.isArray(registrations)) {
            throw new TypeError('AuthorityRegistry initial registrations must be an array.');
        }
        if (registrations.length) this.registerMany(registrations);
        Object.seal(this);
    }

    getRevision () {
        return getState(this).revision;
    }

    has (domain, authorityId = null) {
        const domainMap = getState(this).byDomain.get(normalizeStateDomainId(domain));
        if (!domainMap) return false;
        if (authorityId === null || typeof authorityId === 'undefined') return domainMap.size > 0;
        return domainMap.has(normalizeAuthorityId(authorityId));
    }

    get (domain, authorityId) {
        const domainMap = getState(this).byDomain.get(normalizeStateDomainId(domain));
        if (!domainMap) return null;
        return domainMap.get(normalizeAuthorityId(authorityId)) || null;
    }

    getWriter (domain) {
        const domainMap = getState(this).byDomain.get(normalizeStateDomainId(domain));
        if (!domainMap) return null;
        for (const registration of domainMap.values()) {
            if (registration.mode === AUTHORITY_MODES.WRITER) return registration;
        }
        return null;
    }

    list (domain = null) {
        const state = getState(this);
        if (domain !== null && typeof domain !== 'undefined') {
            const domainMap = state.byDomain.get(normalizeStateDomainId(domain));
            if (!domainMap) return Object.freeze([]);
            return Object.freeze(Array.from(domainMap.values()).sort(compareRegistrations));
        }
        const registrations = [];
        state.byDomain.forEach(domainMap => {
            domainMap.forEach(registration => registrations.push(registration));
        });
        return Object.freeze(registrations.sort(compareRegistrations));
    }

    register (registration) {
        return this.registerMany([registration])[0];
    }

    registerMany (registrations) {
        if (!Array.isArray(registrations) || registrations.length === 0) {
            throw new TypeError('AuthorityRegistry.registerMany requires a non-empty registration array.');
        }

        const normalized = registrations.map(normalizeAuthorityRegistration);
        const state = getState(this);
        const batchParticipants = new Set();
        const batchWriters = new Map();

        normalized.forEach(registration => {
            const participantKey = `${registration.domain}\u0000${registration.authorityId}`;
            if (batchParticipants.has(participantKey)) throw createDuplicateError(registration);
            batchParticipants.add(participantKey);

            const existingDomain = state.byDomain.get(registration.domain);
            if (existingDomain && existingDomain.has(registration.authorityId)) {
                throw createDuplicateError(registration);
            }

            if (registration.mode !== AUTHORITY_MODES.WRITER) return;
            const existingWriter = this.getWriter(registration.domain);
            if (existingWriter) {
                throw createWriterConflictError(
                    registration.domain,
                    existingWriter.authorityId,
                    registration.authorityId
                );
            }
            const batchWriter = batchWriters.get(registration.domain);
            if (batchWriter) {
                throw createWriterConflictError(
                    registration.domain,
                    batchWriter.authorityId,
                    registration.authorityId
                );
            }
            batchWriters.set(registration.domain, registration);
        });

        normalized.forEach(registration => {
            let domainMap = state.byDomain.get(registration.domain);
            if (!domainMap) {
                domainMap = new Map();
                state.byDomain.set(registration.domain, domainMap);
            }
            domainMap.set(registration.authorityId, registration);
        });
        state.revision += 1;
        return Object.freeze(normalized.slice());
    }

    unregister (domain, authorityId) {
        const normalizedDomain = normalizeStateDomainId(domain);
        const normalizedAuthorityId = normalizeAuthorityId(authorityId);
        const state = getState(this);
        const domainMap = state.byDomain.get(normalizedDomain);
        if (!domainMap) return null;
        const registration = domainMap.get(normalizedAuthorityId) || null;
        if (!registration) return null;
        domainMap.delete(normalizedAuthorityId);
        if (domainMap.size === 0) state.byDomain.delete(normalizedDomain);
        state.revision += 1;
        return registration;
    }

    snapshot () {
        return Object.freeze({
            registrations: this.list(),
            revision: this.getRevision()
        });
    }
}

Object.freeze(AuthorityRegistry.prototype);

const createAuthorityRegistry = registrations => new AuthorityRegistry(registrations || []);

module.exports = {
    AUTHORITY_REGISTRY_DUPLICATE,
    AUTHORITY_REGISTRY_WRITER_CONFLICT,
    AuthorityRegistry,
    createAuthorityRegistry
};
