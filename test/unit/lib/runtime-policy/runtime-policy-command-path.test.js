'use strict';

const {createEngineCommand} = require('../../../../src/core/protocol');
const {
    BACKEND_HINT_VALUES,
    CLONE_BUDGET_MODES,
    EXECUTION_BACKEND_MODES,
    PRESENTATION_DOMAIN_MODES,
    PRESENTATION_REFRESH_POLICIES,
    RENDER_QUALITY_POLICIES,
    RUNTIME_POLICY_COMMAND_TYPES,
    RUNTIME_POLICY_DOMAIN_IDS,
    RUNTIME_POLICY_PROFILE_IDS,
    SCRATCH_COMPATIBILITY_TOKENS,
    SCRATCH_TRANSFORM_PRESENTATION_DOMAIN,
    createRuntimePolicyCommandCapability,
    createRuntimePolicyCommandExecutor,
    createRuntimePolicyEditorClient,
    createRuntimePolicyProfileRegistry,
    createScratchRuntimePolicyAdapter,
    unwrapRuntimePolicyCommandResult
} = require('../../../../src/lib/runtime-policy');

const createFakeVM = () => {
    const calls = [];
    const runtime = {
        compilerOptions: {enabled: true, warpTimer: false},
        frameLoop: {framerate: 30},
        interpolationEnabled: false,
        turboMode: false,
        runtimeOptions: {
            fencing: true,
            maxClones: 300,
            miscLimits: true,
            offscreenDrawableCulling: false
        }
    };
    const renderer = {
        setUseHighQualityRender: value => calls.push(['renderer.setUseHighQualityRender', value]),
        useHighQualityRender: false
    };
    return {
        calls,
        renderer,
        runtime,
        setCompilerOptions: value => calls.push(['setCompilerOptions', value]),
        setFramerate: value => calls.push(['setFramerate', value]),
        setInterpolation: value => calls.push(['setInterpolation', value]),
        setRuntimeOptions: value => calls.push(['setRuntimeOptions', value]),
        setTurboMode: value => {
            runtime.turboMode = value;
            calls.push(['setTurboMode', value]);
        }
    };
};

const createHarness = () => {
    const vm = createFakeVM();
    const initial = createRuntimePolicyProfileRegistry().createPolicySet(RUNTIME_POLICY_PROFILE_IDS.SCRATCH_COMPATIBLE);
    const executor = createRuntimePolicyCommandExecutor(initial, createScratchRuntimePolicyAdapter(vm));
    const capability = createRuntimePolicyCommandCapability(executor);
    return {client: createRuntimePolicyEditorClient(capability), executor, vm};
};

describe('LRC-2B Runtime Policy production command path', () => {
    test('injects Writer Authority inside the executor rather than accepting authorityId from Editor DTOs', () => {
        const {executor, vm} = createHarness();
        const result = executor.executeCommand(createEngineCommand(RUNTIME_POLICY_COMMAND_TYPES.PATCH_DOMAIN, {
            authorityId: 'editor.checkbox',
            domain: RUNTIME_POLICY_DOMAIN_IDS.EXECUTION,
            patch: {simulationTickRate: 60}
        }));
        expect(result.kind).toBe('error');
        expect(result.code).toMatch(/PAYLOAD_UNSUPPORTED|BACKEND_SEMANTIC_FORBIDDEN/);
        expect(vm.calls).toEqual([]);
    });

    test('patches execution through Engine Protocol and applies only the execution backend domain', () => {
        const {client, vm} = createHarness();
        const payload = unwrapRuntimePolicyCommandResult(client.patchDomain(RUNTIME_POLICY_DOMAIN_IDS.EXECUTION, {
            simulationTickRate: 60
        }));
        expect(payload.policy.execution.simulationTickRate).toBe(60);
        expect(vm.calls).toEqual([['setFramerate', 60]]);
    });


    test('projects legacy Scratch turbo semantics from the frozen execution domain', () => {
        const {client, vm} = createHarness();
        const payload = unwrapRuntimePolicyCommandResult(client.patchDomain(RUNTIME_POLICY_DOMAIN_IDS.EXECUTION, {
            legacyScratchTurboMode: true
        }));
        expect(payload.policy.execution.legacyScratchTurboMode).toBe(true);
        expect(vm.calls).toEqual([['setFramerate', 30], ['setTurboMode', true]]);
    });

    test('keeps presentation mutation independent from simulation tick and scopes interpolation to Scratch transform', () => {
        const {client, vm} = createHarness();
        unwrapRuntimePolicyCommandResult(client.patchDomain(RUNTIME_POLICY_DOMAIN_IDS.PRESENTATION, {
            domainPolicies: [{
                domainId: SCRATCH_TRANSFORM_PRESENTATION_DOMAIN,
                interpolation: PRESENTATION_DOMAIN_MODES.IF_SUPPORTED,
                requiresExactTickPresentation: false,
                resampling: PRESENTATION_DOMAIN_MODES.DISABLED
            }],
            refreshPolicy: PRESENTATION_REFRESH_POLICIES.DISPLAY,
            renderQuality: RENDER_QUALITY_POLICIES.HIGH
        }));
        expect(vm.calls).toEqual([
            ['setInterpolation', true],
            ['renderer.setUseHighQualityRender', true]
        ]);
        expect(client.getSnapshot().execution.simulationTickRate).toBe(30);
    });

    test('maps explicit Scratch compatibility bundle back to the legacy miscLimits backend switch', () => {
        const {client, vm} = createHarness();
        const payload = unwrapRuntimePolicyCommandResult(client.patchDomain(
            RUNTIME_POLICY_DOMAIN_IDS.SCRATCH_COMPATIBILITY,
            {
                mousePrecision: SCRATCH_COMPATIBILITY_TOKENS.HIGH_PRECISION,
                musicConcurrency: SCRATCH_COMPATIBILITY_TOKENS.RELAXED,
                penSizeLimits: false,
                soundEffectLimits: false,
                soundYieldSemantics: SCRATCH_COMPATIBILITY_TOKENS.RELAXED
            }
        ));
        expect(payload.applicationPlan.diagnostics).toEqual([]);
        expect(vm.calls).toEqual([['setRuntimeOptions', {fencing: true, miscLimits: false}]]);
    });

    test('turns legacy infinite clone intent into a bounded safety application', () => {
        const {client, vm} = createHarness();
        unwrapRuntimePolicyCommandResult(client.patchDomain(RUNTIME_POLICY_DOMAIN_IDS.SAFETY, {
            cloneBudget: {
                hostHardCeiling: 512,
                mode: CLONE_BUDGET_MODES.LEGACY_UNBOUNDED_REQUEST,
                requestedLimit: null
            }
        }));
        expect(vm.calls).toEqual([['setRuntimeOptions', {maxClones: 512}]]);
        expect(client.getSnapshot().safety.cloneBudget.mode).toBe(CLONE_BUDGET_MODES.LEGACY_UNBOUNDED_REQUEST);
    });

    test('routes runtime-only compiler and renderer hints without making them project semantics', () => {
        const {client, vm} = createHarness();
        unwrapRuntimePolicyCommandResult(client.patchDomain(RUNTIME_POLICY_DOMAIN_IDS.EXECUTION_BACKEND, {
            mode: EXECUTION_BACKEND_MODES.INTERPRETER
        }));
        unwrapRuntimePolicyCommandResult(client.patchDomain(RUNTIME_POLICY_DOMAIN_IDS.BACKEND_HINTS, {
            offscreenDrawableCulling: BACKEND_HINT_VALUES.ON
        }));
        expect(vm.calls).toEqual([
            ['setCompilerOptions', {enabled: false}],
            ['setRuntimeOptions', {offscreenDrawableCulling: true}]
        ]);
    });

    test('does not commit policy state when backend application fails', () => {
        const initial = createRuntimePolicyProfileRegistry().createPolicySet(RUNTIME_POLICY_PROFILE_IDS.SCRATCH_COMPATIBLE);
        const executor = createRuntimePolicyCommandExecutor(initial, {
            applyDomain: () => {
                throw Object.assign(new Error('backend failed'), {code: 'TEST_BACKEND_FAILURE'});
            }
        });
        const capability = createRuntimePolicyCommandCapability(executor);
        const client = createRuntimePolicyEditorClient(capability);
        const result = client.patchDomain(RUNTIME_POLICY_DOMAIN_IDS.EXECUTION, {simulationTickRate: 60});
        expect(result.kind).toBe('error');
        expect(result.code).toBe('TEST_BACKEND_FAILURE');
        expect(client.getSnapshot().execution.simulationTickRate).toBe(30);
    });
});
