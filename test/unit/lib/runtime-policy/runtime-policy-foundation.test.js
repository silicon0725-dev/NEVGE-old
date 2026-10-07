'use strict';

const {
    AUTHORITY_REGISTRY_WRITER_CONFLICT
} = require('../../../../src/core/authority');
const {
    CLONE_BUDGET_MODES,
    PRESENTATION_REFRESH_POLICIES,
    RUNTIME_POLICY_AUTHORITY_IDS,
    RUNTIME_POLICY_DOMAIN_IDS,
    RUNTIME_POLICY_PROFILE_IDS,
    RUNTIME_POLICY_SET_TYPE_ID,
    SCRATCH_TRANSFORM_PRESENTATION_DOMAIN,
    SCRATCH_TRANSFORM_PRESENTER_CAPABILITY,
    createRuntimePolicyAuthorityRegistry,
    createRuntimePolicyProfileRegistry,
    createRuntimePolicyResolver,
    createRuntimePolicySchemaRegistry,
    normalizeRuntimePolicySet,
    toProjectRuntimePolicyDTO,
    validateRuntimePolicySet
} = require('../../../../src/lib/runtime-policy');

const clone = value => JSON.parse(JSON.stringify(value));

describe('LRC-2 Runtime Policy foundation', () => {
    test('registers a versioned RuntimePolicySet schema with runtime-only backend domains', () => {
        const registry = createRuntimePolicySchemaRegistry();
        const schema = registry.get(RUNTIME_POLICY_SET_TYPE_ID, 1);
        expect(schema).not.toBeNull();
        expect(schema.properties.execution.persistence).toBe('persistent');
        expect(schema.properties.presentation.persistence).toBe('persistent');
        expect(schema.properties.safety.persistence).toBe('persistent');
        expect(schema.properties.scratchCompatibility.persistence).toBe('persistent');
        expect(schema.properties.executionBackend.persistence).toBe('runtime-only');
        expect(schema.properties.backendHints.persistence).toBe('runtime-only');
    });

    test('keeps exactly one writer authority per Runtime Policy domain', () => {
        const registry = createRuntimePolicyAuthorityRegistry();
        Object.values(RUNTIME_POLICY_DOMAIN_IDS).forEach(domain => {
            const writer = registry.getWriter(domain);
            expect(writer).not.toBeNull();
            expect(writer.mode).toBe('writer');
        });
        expect(() => registry.register({
            authorityId: 'ngvge.runtime-policy.illegal-second-writer',
            domain: RUNTIME_POLICY_DOMAIN_IDS.EXECUTION,
            mode: 'writer'
        })).toThrow(expect.objectContaining({code: AUTHORITY_REGISTRY_WRITER_CONFLICT}));
    });

    test('keeps Scratch compatibility simulation at 30 Hz while presentation refresh remains independent', () => {
        const profiles = createRuntimePolicyProfileRegistry();
        const scratch = profiles.createPolicySet(RUNTIME_POLICY_PROFILE_IDS.SCRATCH_COMPATIBLE);
        const highRefresh = profiles.createPolicySet(RUNTIME_POLICY_PROFILE_IDS.NGVGE_HIGH_REFRESH);

        expect(scratch.execution.simulationTickRate).toBe(30);
        expect(scratch.presentation.refreshPolicy).toBe(PRESENTATION_REFRESH_POLICIES.EXACT_TICK);
        expect(highRefresh.execution.simulationTickRate).toBe(30);
        expect(highRefresh.presentation.refreshPolicy).toBe(PRESENTATION_REFRESH_POLICIES.DISPLAY);
    });

    test('declares legacy interpolation only for the Scratch sprite transform visual domain', () => {
        expect(SCRATCH_TRANSFORM_PRESENTER_CAPABILITY.domainId).toBe(SCRATCH_TRANSFORM_PRESENTATION_DOMAIN);
        expect(SCRATCH_TRANSFORM_PRESENTER_CAPABILITY.supportsInterpolation).toBe(true);
        expect(SCRATCH_TRANSFORM_PRESENTER_CAPABILITY.supportsResampling).toBe(false);
        expect(SCRATCH_TRANSFORM_PRESENTER_CAPABILITY.diagnostics[0]).toMatch(/does not imply project-wide/);
    });

    test('rejects legacy mixed fields, non-finite budgets, and backend handles from policy DTOs', () => {
        const base = createRuntimePolicyProfileRegistry().createPolicySet(RUNTIME_POLICY_PROFILE_IDS.SCRATCH_COMPATIBLE);
        for (const forbiddenPatch of [
            {opsPerFrame: 2},
            {miscLimits: false},
            {stageWidth: 640},
            {renderer: {}},
            {_twconfig_: {}}
        ]) {
            const candidate = Object.assign(clone(base), forbiddenPatch);
            expect(validateRuntimePolicySet(candidate).valid).toBe(false);
        }
        const infinite = clone(base);
        infinite.safety.cloneBudget.hostHardCeiling = Infinity;
        expect(validateRuntimePolicySet(infinite).valid).toBe(false);
    });

    test('strips runtime-only execution backend and backend hints from project persistence DTOs', () => {
        const policy = createRuntimePolicyProfileRegistry().createPolicySet(RUNTIME_POLICY_PROFILE_IDS.NGVGE_BALANCED);
        const dto = toProjectRuntimePolicyDTO(policy);
        expect(dto.execution).toBeDefined();
        expect(dto.presentation).toBeDefined();
        expect(dto.safety).toBeDefined();
        expect(dto.scratchCompatibility).toBeDefined();
        expect(dto.executionBackend).toBeUndefined();
        expect(dto.backendHints).toBeUndefined();
        expect(JSON.stringify(dto)).not.toMatch(/compiler|offscreenDrawableCulling/);
    });

    test('requires the registered writer authority for domain mutation', () => {
        const resolver = createRuntimePolicyResolver();
        const policy = resolver.resolveProfile(RUNTIME_POLICY_PROFILE_IDS.SCRATCH_COMPATIBLE);
        const changed = resolver.resolveDomainPatch(policy, {
            authorityId: RUNTIME_POLICY_AUTHORITY_IDS.EXECUTION,
            domain: RUNTIME_POLICY_DOMAIN_IDS.EXECUTION,
            patch: {simulationTickRate: 60}
        });
        expect(changed.execution.simulationTickRate).toBe(60);
        expect(changed.presentation.refreshPolicy).toBe(PRESENTATION_REFRESH_POLICIES.EXACT_TICK);
        expect(() => resolver.resolveDomainPatch(policy, {
            authorityId: 'editor.checkbox',
            domain: RUNTIME_POLICY_DOMAIN_IDS.EXECUTION,
            patch: {simulationTickRate: 60}
        })).toThrow(expect.objectContaining({code: 'NGVGE_RUNTIME_POLICY_WRITER_AUTHORITY_REQUIRED'}));
    });

    test('represents a legacy unbounded clone request as a bounded compatibility request', () => {
        const policy = clone(createRuntimePolicyProfileRegistry().createPolicySet(RUNTIME_POLICY_PROFILE_IDS.SCRATCH_COMPATIBLE));
        policy.safety.cloneBudget = {
            hostHardCeiling: 300,
            mode: CLONE_BUDGET_MODES.LEGACY_UNBOUNDED_REQUEST,
            requestedLimit: null
        };
        expect(() => normalizeRuntimePolicySet(policy)).not.toThrow();
    });
});
