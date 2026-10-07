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
    RUNTIME_POLICY_RUNTIME_CLIENT_ID,
    SCRATCH_COMPATIBILITY_TOKENS,
    SCRATCH_TRANSFORM_PRESENTATION_DOMAIN
} = require('./constants');
const {normalizeRuntimePolicySet} = require('./runtime-policy-contract');
const {createRuntimePolicyProfileRegistry} = require('./profile-registry');
const {createScratchRuntimePolicyAdapter} = require('./scratch-runtime-policy-adapter');
const {createRuntimePolicyCommandExecutor} = require('./runtime-policy-command-executor');
const {
    createRuntimePolicyCommandCapability,
    createRuntimePolicyEditorClient
} = require('./runtime-policy-command-capability');

const RUNTIME_POLICY_RUNTIME_PROPERTY = 'ngvgeRuntimePolicy';
const clientsByRuntime = new WeakMap();

const clone = value => {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(clone);
    const result = {};
    Object.keys(value).forEach(key => {
        result[key] = clone(value[key]);
    });
    return result;
};

const readFinitePositive = (value, fallback) => (
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
);

const createScratchBackendBootstrapPolicy = vm => {
    if (!vm || !vm.runtime) throw new TypeError('Runtime Policy bootstrap requires a Scratch VM runtime.');
    const runtime = vm.runtime;
    const profiles = createRuntimePolicyProfileRegistry();
    const policy = clone(profiles.createPolicySet(RUNTIME_POLICY_PROFILE_IDS.CUSTOM));
    const runtimeOptions = runtime.runtimeOptions || {};
    const compilerOptions = runtime.compilerOptions || {};
    const renderer = vm.renderer || runtime.renderer || null;

    policy.execution.simulationTickRate = readFinitePositive(
        runtime.frameLoop && runtime.frameLoop.framerate,
        policy.execution.simulationTickRate
    );

    policy.execution.legacyScratchTurboMode = Boolean(runtime.turboMode);

    if (runtime.interpolationEnabled) {
        policy.presentation.refreshPolicy = PRESENTATION_REFRESH_POLICIES.DISPLAY;
        policy.presentation.domainPolicies = [{
            domainId: SCRATCH_TRANSFORM_PRESENTATION_DOMAIN,
            interpolation: PRESENTATION_DOMAIN_MODES.IF_SUPPORTED,
            requiresExactTickPresentation: false,
            resampling: PRESENTATION_DOMAIN_MODES.DISABLED
        }];
    } else {
        policy.presentation.refreshPolicy = PRESENTATION_REFRESH_POLICIES.EXACT_TICK;
        policy.presentation.domainPolicies = [];
    }
    policy.presentation.renderQuality = renderer && renderer.useHighQualityRender ?
        RENDER_QUALITY_POLICIES.HIGH : RENDER_QUALITY_POLICIES.COMPATIBILITY;

    if (runtimeOptions.maxClones === Infinity) {
        policy.safety.cloneBudget = {
            hostHardCeiling: policy.safety.cloneBudget.hostHardCeiling,
            mode: CLONE_BUDGET_MODES.LEGACY_UNBOUNDED_REQUEST,
            requestedLimit: null
        };
    } else if (typeof runtimeOptions.maxClones === 'number' && Number.isFinite(runtimeOptions.maxClones) &&
        runtimeOptions.maxClones > 0) {
        policy.safety.cloneBudget = {
            hostHardCeiling: Math.max(policy.safety.cloneBudget.hostHardCeiling, runtimeOptions.maxClones),
            mode: CLONE_BUDGET_MODES.FINITE,
            requestedLimit: runtimeOptions.maxClones
        };
    }

    if (typeof runtimeOptions.fencing === 'boolean') {
        policy.scratchCompatibility.fencing = runtimeOptions.fencing;
    }
    if (runtimeOptions.miscLimits === false) {
        policy.scratchCompatibility.soundEffectLimits = false;
        policy.scratchCompatibility.soundYieldSemantics = SCRATCH_COMPATIBILITY_TOKENS.RELAXED;
        policy.scratchCompatibility.penSizeLimits = false;
        policy.scratchCompatibility.musicConcurrency = SCRATCH_COMPATIBILITY_TOKENS.RELAXED;
        policy.scratchCompatibility.mousePrecision = SCRATCH_COMPATIBILITY_TOKENS.HIGH_PRECISION;
    }

    policy.executionBackend.mode = compilerOptions.enabled === false ?
        EXECUTION_BACKEND_MODES.INTERPRETER : EXECUTION_BACKEND_MODES.AUTO;
    if (runtimeOptions.offscreenDrawableCulling === true) {
        policy.backendHints.offscreenDrawableCulling = BACKEND_HINT_VALUES.ON;
    } else if (runtimeOptions.offscreenDrawableCulling === false) {
        policy.backendHints.offscreenDrawableCulling = BACKEND_HINT_VALUES.OFF;
    }

    return normalizeRuntimePolicySet(policy);
};

const installRuntimePolicyService = vm => {
    if (!vm || !vm.runtime) return null;
    const runtime = vm.runtime;
    const existing = clientsByRuntime.get(runtime);
    if (existing) return existing;

    const initialPolicy = createScratchBackendBootstrapPolicy(vm);
    const adapter = createScratchRuntimePolicyAdapter(vm);
    const executor = createRuntimePolicyCommandExecutor(initialPolicy, adapter);
    const capability = createRuntimePolicyCommandCapability(executor);
    const editorClient = createRuntimePolicyEditorClient(capability);
    const client = Object.freeze({
        id: RUNTIME_POLICY_RUNTIME_CLIENT_ID,
        applyProfile: editorClient.applyProfile,
        capabilityId: capability.capabilityId,
        executeCommand: capability.executeCommand,
        getSnapshot: editorClient.getSnapshot,
        getStatus: capability.getStatus,
        patchDomain: editorClient.patchDomain,
        subscribe: editorClient.subscribe
    });

    clientsByRuntime.set(runtime, client);
    if (!Object.prototype.hasOwnProperty.call(runtime, RUNTIME_POLICY_RUNTIME_PROPERTY)) {
        Object.defineProperty(runtime, RUNTIME_POLICY_RUNTIME_PROPERTY, {
            configurable: false,
            enumerable: false,
            value: client,
            writable: false
        });
    }
    return client;
};

const getRuntimePolicyClient = runtime => (
    runtime ? clientsByRuntime.get(runtime) || runtime[RUNTIME_POLICY_RUNTIME_PROPERTY] || null : null
);

module.exports = {
    RUNTIME_POLICY_RUNTIME_PROPERTY,
    createScratchBackendBootstrapPolicy,
    getRuntimePolicyClient,
    installRuntimePolicyService
};
