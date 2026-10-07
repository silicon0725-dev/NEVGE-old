/* eslint-disable import/no-commonjs, strict */
'use strict';

const RUNTIME_POLICY_SET_ID = 'ngvge.runtime-policy-set@1';
const RUNTIME_POLICY_SET_TYPE_ID = 'ngvge.runtime-policy-set';
const RUNTIME_POLICY_SET_SCHEMA_VERSION = 1;

const RUNTIME_POLICY_COMMAND_CAPABILITY_ID = 'ngvge.runtime-policy-command';
const RUNTIME_POLICY_COMMAND_CAPABILITY_VERSION = 1;
const RUNTIME_POLICY_RUNTIME_CLIENT_ID = 'ngvge.runtime-policy-client@1';

const RUNTIME_POLICY_PROFILE_IDS = Object.freeze({
    SCRATCH_COMPATIBLE: 'scratch-compatible',
    NGVGE_BALANCED: 'ngvge-balanced',
    NGVGE_HIGH_REFRESH: 'ngvge-high-refresh',
    CUSTOM: 'custom'
});

const RUNTIME_POLICY_DOMAIN_IDS = Object.freeze({
    EXECUTION: 'ngvge.runtime-policy.execution',
    PRESENTATION: 'ngvge.runtime-policy.presentation',
    SAFETY: 'ngvge.runtime-policy.safety',
    SCRATCH_COMPATIBILITY: 'ngvge.runtime-policy.scratch-compatibility',
    EXECUTION_BACKEND: 'ngvge.runtime-policy.execution-backend',
    BACKEND_HINTS: 'ngvge.runtime-policy.backend-hints'
});

const RUNTIME_POLICY_AUTHORITY_IDS = Object.freeze({
    EXECUTION: 'ngvge.runtime-policy.execution-authority',
    PRESENTATION: 'ngvge.runtime-policy.presentation-authority',
    SAFETY: 'ngvge.runtime-policy.safety-authority',
    SCRATCH_COMPATIBILITY: 'ngvge.runtime-policy.scratch-compatibility-authority',
    EXECUTION_BACKEND: 'ngvge.runtime-policy.execution-backend-authority',
    BACKEND_HINTS: 'ngvge.runtime-policy.backend-hints-authority'
});

const SCHEDULER_MODES = Object.freeze({
    SCRATCH_COMPATIBLE: 'scratch-compatible',
    NGVGE_NATIVE: 'ngvge-native'
});

const PRESENTATION_REFRESH_POLICIES = Object.freeze({
    EXACT_TICK: 'exact-tick',
    DISPLAY: 'display',
    FIXED: 'fixed'
});

const RENDER_QUALITY_POLICIES = Object.freeze({
    COMPATIBILITY: 'compatibility',
    BALANCED: 'balanced',
    HIGH: 'high'
});

const PRESENTATION_DOMAIN_MODES = Object.freeze({
    DISABLED: 'disabled',
    IF_SUPPORTED: 'if-supported'
});

const SCRIPT_WATCHDOG_POLICIES = Object.freeze({
    SCRATCH_COMPATIBLE: 'scratch-compatible',
    BOUNDED: 'bounded'
});

const CLONE_BUDGET_MODES = Object.freeze({
    FINITE: 'finite',
    ADAPTIVE: 'adaptive',
    LEGACY_UNBOUNDED_REQUEST: 'legacy-unbounded-request'
});

const EXECUTION_BACKEND_MODES = Object.freeze({
    AUTO: 'auto',
    COMPILER: 'compiler',
    INTERPRETER: 'interpreter'
});

const BACKEND_HINT_VALUES = Object.freeze({
    AUTO: 'auto',
    ON: 'on',
    OFF: 'off'
});

const SCRATCH_TRANSFORM_PRESENTATION_DOMAIN = 'scratch.sprite.transform';

const SCRATCH_COMPATIBILITY_TOKENS = Object.freeze({
    SCRATCH_COMPATIBLE: 'scratch-compatible',
    RELAXED: 'relaxed',
    HIGH_PRECISION: 'high-precision'
});

module.exports = {
    BACKEND_HINT_VALUES,
    CLONE_BUDGET_MODES,
    EXECUTION_BACKEND_MODES,
    PRESENTATION_DOMAIN_MODES,
    PRESENTATION_REFRESH_POLICIES,
    RENDER_QUALITY_POLICIES,
    RUNTIME_POLICY_AUTHORITY_IDS,
    RUNTIME_POLICY_COMMAND_CAPABILITY_ID,
    RUNTIME_POLICY_COMMAND_CAPABILITY_VERSION,
    RUNTIME_POLICY_DOMAIN_IDS,
    RUNTIME_POLICY_PROFILE_IDS,
    RUNTIME_POLICY_RUNTIME_CLIENT_ID,
    RUNTIME_POLICY_SET_ID,
    RUNTIME_POLICY_SET_SCHEMA_VERSION,
    RUNTIME_POLICY_SET_TYPE_ID,
    SCHEDULER_MODES,
    SCRIPT_WATCHDOG_POLICIES,
    SCRATCH_COMPATIBILITY_TOKENS,
    SCRATCH_TRANSFORM_PRESENTATION_DOMAIN
};
