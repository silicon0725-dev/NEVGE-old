/* eslint-disable import/no-commonjs, strict */
'use strict';

const {
    BACKEND_HINT_VALUES,
    CLONE_BUDGET_MODES,
    EXECUTION_BACKEND_MODES,
    PRESENTATION_DOMAIN_MODES,
    PRESENTATION_REFRESH_POLICIES,
    RENDER_QUALITY_POLICIES,
    RUNTIME_POLICY_PROFILE_IDS,
    RUNTIME_POLICY_SET_SCHEMA_VERSION,
    SCHEDULER_MODES,
    SCRIPT_WATCHDOG_POLICIES,
    SCRATCH_TRANSFORM_PRESENTATION_DOMAIN
} = require('./constants');
const {normalizeRuntimePolicySet} = require('./runtime-policy-contract');

const PROFILE_REGISTRY_ID = 'ngvge.runtime-policy-profile-registry@1';

const createBaseSafety = mode => ({
    cloneBudget: {
        hostHardCeiling: 300,
        mode,
        requestedLimit: 300
    },
    executionBudget: {mode: 'host-default'},
    hangDetection: 'host-default',
    hostHardCeilings: {cloneCount: 300},
    resourceBudgets: {},
    scriptWatchdog: mode === CLONE_BUDGET_MODES.FINITE ?
        SCRIPT_WATCHDOG_POLICIES.SCRATCH_COMPATIBLE : SCRIPT_WATCHDOG_POLICIES.BOUNDED
});

const createScratchCompatibility = () => ({
    fencing: true,
    legacyTurboSemantics: false,
    mousePrecision: 'scratch-compatible',
    musicConcurrency: 'scratch-compatible',
    penSizeLimits: true,
    soundEffectLimits: true,
    soundYieldSemantics: 'scratch-compatible'
});

const createPolicy = (profileId, options) => normalizeRuntimePolicySet({
    backendHints: {offscreenDrawableCulling: BACKEND_HINT_VALUES.AUTO},
    execution: {
        deterministicProfile: null,
        legacyScratchTurboMode: false,
        schedulerMode: options.schedulerMode,
        simulationTickRate: 30
    },
    executionBackend: {diagnosticOverride: null, mode: EXECUTION_BACKEND_MODES.AUTO},
    presentation: {
        domainPolicies: options.interpolation ? [{
            domainId: SCRATCH_TRANSFORM_PRESENTATION_DOMAIN,
            interpolation: PRESENTATION_DOMAIN_MODES.IF_SUPPORTED,
            requiresExactTickPresentation: false,
            resampling: PRESENTATION_DOMAIN_MODES.DISABLED
        }] : [],
        refreshPolicy: options.refreshPolicy,
        renderQuality: options.renderQuality,
        targetRefreshRate: null
    },
    profileId,
    safety: createBaseSafety(options.cloneBudgetMode),
    schemaVersion: RUNTIME_POLICY_SET_SCHEMA_VERSION,
    scratchCompatibility: createScratchCompatibility()
});

const BUILT_IN_RUNTIME_POLICY_PROFILES = Object.freeze([
    Object.freeze({
        id: RUNTIME_POLICY_PROFILE_IDS.SCRATCH_COMPATIBLE,
        policy: createPolicy(RUNTIME_POLICY_PROFILE_IDS.SCRATCH_COMPATIBLE, {
            cloneBudgetMode: CLONE_BUDGET_MODES.FINITE,
            interpolation: false,
            refreshPolicy: PRESENTATION_REFRESH_POLICIES.EXACT_TICK,
            renderQuality: RENDER_QUALITY_POLICIES.COMPATIBILITY,
            schedulerMode: SCHEDULER_MODES.SCRATCH_COMPATIBLE
        })
    }),
    Object.freeze({
        id: RUNTIME_POLICY_PROFILE_IDS.NGVGE_BALANCED,
        policy: createPolicy(RUNTIME_POLICY_PROFILE_IDS.NGVGE_BALANCED, {
            cloneBudgetMode: CLONE_BUDGET_MODES.ADAPTIVE,
            interpolation: true,
            refreshPolicy: PRESENTATION_REFRESH_POLICIES.DISPLAY,
            renderQuality: RENDER_QUALITY_POLICIES.BALANCED,
            schedulerMode: SCHEDULER_MODES.NGVGE_NATIVE
        })
    }),
    Object.freeze({
        id: RUNTIME_POLICY_PROFILE_IDS.NGVGE_HIGH_REFRESH,
        policy: createPolicy(RUNTIME_POLICY_PROFILE_IDS.NGVGE_HIGH_REFRESH, {
            cloneBudgetMode: CLONE_BUDGET_MODES.ADAPTIVE,
            interpolation: true,
            refreshPolicy: PRESENTATION_REFRESH_POLICIES.DISPLAY,
            renderQuality: RENDER_QUALITY_POLICIES.HIGH,
            schedulerMode: SCHEDULER_MODES.NGVGE_NATIVE
        })
    }),
    Object.freeze({
        id: RUNTIME_POLICY_PROFILE_IDS.CUSTOM,
        policy: createPolicy(RUNTIME_POLICY_PROFILE_IDS.CUSTOM, {
            cloneBudgetMode: CLONE_BUDGET_MODES.ADAPTIVE,
            interpolation: true,
            refreshPolicy: PRESENTATION_REFRESH_POLICIES.DISPLAY,
            renderQuality: RENDER_QUALITY_POLICIES.BALANCED,
            schedulerMode: SCHEDULER_MODES.NGVGE_NATIVE
        })
    })
]);

class RuntimePolicyProfileRegistry {
    constructor (profiles = BUILT_IN_RUNTIME_POLICY_PROFILES) {
        this.id = PROFILE_REGISTRY_ID;
        this._profiles = new Map();
        profiles.forEach(profile => this.register(profile));
        Object.seal(this);
    }

    register (profile) {
        if (!profile || typeof profile.id !== 'string' || !profile.id.trim()) {
            throw new TypeError('Runtime Policy profile id must be a non-empty string.');
        }
        if (this._profiles.has(profile.id)) throw new Error(`Runtime Policy profile already exists: ${profile.id}`);
        const policy = normalizeRuntimePolicySet(profile.policy);
        if (policy.profileId !== profile.id) {
            throw new TypeError('Runtime Policy profile id must match policy.profileId.');
        }
        const normalized = Object.freeze({id: profile.id, policy});
        this._profiles.set(profile.id, normalized);
        return normalized;
    }

    get (profileId) {
        return this._profiles.get(profileId) || null;
    }

    list () {
        return Object.freeze(Array.from(this._profiles.values()));
    }

    createPolicySet (profileId) {
        const profile = this.get(profileId);
        if (!profile) throw new Error(`Unknown Runtime Policy profile: ${profileId}`);
        return normalizeRuntimePolicySet(profile.policy);
    }
}

const createRuntimePolicyProfileRegistry = profiles => new RuntimePolicyProfileRegistry(profiles);

module.exports = {
    BUILT_IN_RUNTIME_POLICY_PROFILES,
    PROFILE_REGISTRY_ID,
    RuntimePolicyProfileRegistry,
    createRuntimePolicyProfileRegistry
};
