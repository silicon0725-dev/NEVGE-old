'use strict';

const {
    CLONE_BUDGET_MODES,
    RUNTIME_POLICY_PROFILE_IDS,
    createRuntimePolicyProfileRegistry,
    createScratchRuntimePolicyAdapter,
    createScratchRuntimePolicyApplicationPlan
} = require('../../../../src/lib/runtime-policy');

const clone = value => JSON.parse(JSON.stringify(value));

const createFakeVM = () => {
    const calls = [];
    return {
        calls,
        setFramerate: value => calls.push(['setFramerate', value]),
        setInterpolation: value => calls.push(['setInterpolation', value]),
        setRuntimeOptions: value => calls.push(['setRuntimeOptions', value])
    };
};

describe('LRC-2 Scratch Runtime Policy adapter seam', () => {
    test('consumes Scratch-compatible policy without exposing legacy mixed settings', () => {
        const vm = createFakeVM();
        const adapter = createScratchRuntimePolicyAdapter(vm);
        const policy = createRuntimePolicyProfileRegistry().createPolicySet(RUNTIME_POLICY_PROFILE_IDS.SCRATCH_COMPATIBLE);
        const plan = adapter.apply(policy);

        expect(plan).toEqual({
            framerate: 30,
            interpolation: false,
            turboMode: false,
            runtimeOptions: {fencing: true, maxClones: 300}
        });
        expect(vm.calls).toEqual([
            ['setFramerate', 30],
            ['setInterpolation', false],
            ['setRuntimeOptions', {fencing: true, maxClones: 300}]
        ]);
        expect(JSON.stringify(plan)).not.toMatch(/miscLimits|opsPerFrame|offscreenDrawableCulling/);
    });

    test('enables legacy Scratch interpolation only from the explicit transform presentation domain policy', () => {
        const policy = createRuntimePolicyProfileRegistry().createPolicySet(RUNTIME_POLICY_PROFILE_IDS.NGVGE_HIGH_REFRESH);
        const plan = createScratchRuntimePolicyApplicationPlan(policy);
        expect(plan.interpolation).toBe(true);
        expect(plan.framerate).toBe(30);
    });

    test('caps a legacy unbounded clone request at the host hard ceiling', () => {
        const policy = clone(createRuntimePolicyProfileRegistry().createPolicySet(RUNTIME_POLICY_PROFILE_IDS.SCRATCH_COMPATIBLE));
        policy.safety.cloneBudget = {
            hostHardCeiling: 512,
            mode: CLONE_BUDGET_MODES.LEGACY_UNBOUNDED_REQUEST,
            requestedLimit: null
        };
        expect(createScratchRuntimePolicyApplicationPlan(policy).runtimeOptions.maxClones).toBe(512);
    });
});
