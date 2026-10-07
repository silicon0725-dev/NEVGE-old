/* eslint-disable import/no-commonjs, strict */
'use strict';

const {AUTHORITY_MODES, createAuthorityRegistry} = require('../../core/authority');
const {RUNTIME_POLICY_AUTHORITY_IDS, RUNTIME_POLICY_DOMAIN_IDS} = require('./constants');

const RUNTIME_POLICY_AUTHORITY_REGISTRATIONS = Object.freeze([
    Object.freeze({
        authorityId: RUNTIME_POLICY_AUTHORITY_IDS.EXECUTION,
        domain: RUNTIME_POLICY_DOMAIN_IDS.EXECUTION,
        mode: AUTHORITY_MODES.WRITER
    }),
    Object.freeze({
        authorityId: RUNTIME_POLICY_AUTHORITY_IDS.PRESENTATION,
        domain: RUNTIME_POLICY_DOMAIN_IDS.PRESENTATION,
        mode: AUTHORITY_MODES.WRITER
    }),
    Object.freeze({
        authorityId: RUNTIME_POLICY_AUTHORITY_IDS.SAFETY,
        domain: RUNTIME_POLICY_DOMAIN_IDS.SAFETY,
        mode: AUTHORITY_MODES.WRITER
    }),
    Object.freeze({
        authorityId: RUNTIME_POLICY_AUTHORITY_IDS.SCRATCH_COMPATIBILITY,
        domain: RUNTIME_POLICY_DOMAIN_IDS.SCRATCH_COMPATIBILITY,
        mode: AUTHORITY_MODES.WRITER
    }),
    Object.freeze({
        authorityId: RUNTIME_POLICY_AUTHORITY_IDS.EXECUTION_BACKEND,
        domain: RUNTIME_POLICY_DOMAIN_IDS.EXECUTION_BACKEND,
        mode: AUTHORITY_MODES.WRITER
    }),
    Object.freeze({
        authorityId: RUNTIME_POLICY_AUTHORITY_IDS.BACKEND_HINTS,
        domain: RUNTIME_POLICY_DOMAIN_IDS.BACKEND_HINTS,
        mode: AUTHORITY_MODES.WRITER
    })
]);

const createRuntimePolicyAuthorityRegistry = () => createAuthorityRegistry(RUNTIME_POLICY_AUTHORITY_REGISTRATIONS);

module.exports = {
    RUNTIME_POLICY_AUTHORITY_REGISTRATIONS,
    createRuntimePolicyAuthorityRegistry
};
