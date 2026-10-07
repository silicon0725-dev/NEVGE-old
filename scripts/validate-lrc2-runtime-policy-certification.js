#!/usr/bin/env node
/* eslint-disable max-len, strict */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {AUTHORITY_MODES} = require('../src/core/authority');
const {SCHEMA_PROPERTY_PERSISTENCE} = require('../src/core/schema');
const {
    PRESENTATION_REFRESH_POLICIES,
    RUNTIME_POLICY_AUTHORITY_REGISTRATIONS,
    RUNTIME_POLICY_COMMAND_CONTRACT,
    RUNTIME_POLICY_DOMAIN_IDS,
    RUNTIME_POLICY_PROFILE_IDS,
    RUNTIME_POLICY_SET_SCHEMA,
    RUNTIME_POLICY_SET_SCHEMA_VERSION,
    RUNTIME_POLICY_SET_TYPE_ID,
    SCRATCH_TRANSFORM_PRESENTER_CAPABILITY,
    createRuntimePolicyAuthorityRegistry,
    createRuntimePolicyProfileRegistry,
    createScratchRuntimePolicyAdapter,
    toProjectRuntimePolicyDTO,
    validateRuntimePolicySet
} = require('../src/lib/runtime-policy');

const ROOT = path.resolve(__dirname, '..');
const REQUIREMENTS = Object.freeze([
    Object.freeze({id: 'LRC2-DOD-01', title: 'Runtime Policy has a versioned NGVGE-owned schema'}),
    Object.freeze({id: 'LRC2-DOD-02', title: 'Execution / Presentation / Safety / Compatibility are separate domains'}),
    Object.freeze({id: 'LRC2-DOD-03', title: 'Simulation tick and presentation refresh are independent'}),
    Object.freeze({id: 'LRC2-DOD-04', title: 'Each Runtime Policy domain has exactly one Writer Authority'}),
    Object.freeze({id: 'LRC2-DOD-05', title: 'Scratch backend consumes Runtime Policy through the Compatibility Adapter'}),
    Object.freeze({id: 'LRC2-DOD-06', title: 'Legacy Advanced Settings has no direct Runtime Policy VM/Renderer writer'}),
    Object.freeze({id: 'LRC2-DOD-07', title: 'OpsPerFrame is not a Native Runtime Policy field'}),
    Object.freeze({id: 'LRC2-DOD-08', title: 'miscLimits is not a Native Runtime Policy field'}),
    Object.freeze({id: 'LRC2-DOD-09', title: 'Stage geometry is outside Runtime Policy'}),
    Object.freeze({id: 'LRC2-DOD-10', title: 'Compiler/backend override remains runtime-only'}),
    Object.freeze({id: 'LRC2-DOD-11', title: 'Runtime Policy DTOs exclude Scratch/backend-private handles'}),
    Object.freeze({id: 'LRC2-DOD-12', title: 'Cumulative LRC-2 certification and freeze gates are executable'})
]);

const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const evidence = [];
const pass = (requirementId, detail) => evidence.push(Object.freeze({detail, requirementId, status: 'PASS'}));
const expectInvalidField = (policy, field, value) => {
    const candidate = Object.assign({}, clone(policy), {[field]: value});
    const result = validateRuntimePolicySet(candidate);
    assert.strictEqual(result.valid, false, `${field} must be rejected from Native Runtime Policy.`);
    return result;
};

const createFakeVM = () => {
    const calls = [];
    return {
        calls,
        renderer: {
            setUseHighQualityRender: value => calls.push(['renderer.setUseHighQualityRender', value])
        },
        setCompilerOptions: value => calls.push(['setCompilerOptions', value]),
        setFramerate: value => calls.push(['setFramerate', value]),
        setInterpolation: value => calls.push(['setInterpolation', value]),
        setRuntimeOptions: value => calls.push(['setRuntimeOptions', value])
    };
};

const certify = () => {
    assert.strictEqual(RUNTIME_POLICY_SET_TYPE_ID, 'ngvge.runtime-policy-set');
    assert.strictEqual(RUNTIME_POLICY_SET_SCHEMA_VERSION, 1);
    assert.strictEqual(RUNTIME_POLICY_SET_SCHEMA.typeId, RUNTIME_POLICY_SET_TYPE_ID);
    assert.strictEqual(RUNTIME_POLICY_SET_SCHEMA.version, RUNTIME_POLICY_SET_SCHEMA_VERSION);
    pass('LRC2-DOD-01', 'ngvge.runtime-policy-set@1 is a versioned NGVGE-owned Schema contract.');

    const profileRegistry = createRuntimePolicyProfileRegistry();
    const scratchPolicy = profileRegistry.createPolicySet(RUNTIME_POLICY_PROFILE_IDS.SCRATCH_COMPATIBLE);
    ['execution', 'presentation', 'safety', 'scratchCompatibility'].forEach(domain => {
        assert(scratchPolicy[domain] && typeof scratchPolicy[domain] === 'object', `${domain} domain must exist.`);
    });
    assert.notStrictEqual(scratchPolicy.execution, scratchPolicy.presentation);
    assert.notStrictEqual(scratchPolicy.presentation, scratchPolicy.safety);
    pass('LRC2-DOD-02', 'Execution, Presentation, Safety and Scratch Compatibility are independent policy objects.');

    const highRefresh = profileRegistry.createPolicySet(RUNTIME_POLICY_PROFILE_IDS.NGVGE_HIGH_REFRESH);
    assert.strictEqual(highRefresh.execution.simulationTickRate, 30);
    assert.strictEqual(highRefresh.presentation.refreshPolicy, PRESENTATION_REFRESH_POLICIES.DISPLAY);
    assert.notStrictEqual(
        highRefresh.presentation.refreshPolicy,
        PRESENTATION_REFRESH_POLICIES.EXACT_TICK,
        'High-refresh presentation must not imply exact simulation-tick presentation.'
    );
    assert.strictEqual(SCRATCH_TRANSFORM_PRESENTER_CAPABILITY.supportsInterpolation, true);
    assert.strictEqual(SCRATCH_TRANSFORM_PRESENTER_CAPABILITY.supportsResampling, false);
    pass('LRC2-DOD-03', '30 Hz simulation can coexist with display-refresh presentation; Scratch interpolation is domain-scoped.');

    const authorityRegistry = createRuntimePolicyAuthorityRegistry();
    const domains = Object.values(RUNTIME_POLICY_DOMAIN_IDS);
    assert.strictEqual(RUNTIME_POLICY_AUTHORITY_REGISTRATIONS.length, domains.length);
    assert.strictEqual(new Set(RUNTIME_POLICY_AUTHORITY_REGISTRATIONS.map(item => item.domain)).size, domains.length);
    domains.forEach(domain => {
        const registrations = RUNTIME_POLICY_AUTHORITY_REGISTRATIONS.filter(item => item.domain === domain);
        assert.strictEqual(registrations.length, 1, `Runtime Policy domain must have exactly one registration: ${domain}`);
        assert.strictEqual(registrations[0].mode, AUTHORITY_MODES.WRITER);
        assert.strictEqual(authorityRegistry.getWriter(domain).authorityId, registrations[0].authorityId);
    });
    pass('LRC2-DOD-04', 'All six Runtime Policy domains have one and only one registered Writer Authority.');

    const fakeVM = createFakeVM();
    const adapter = createScratchRuntimePolicyAdapter(fakeVM);
    adapter.applyDomain(scratchPolicy, RUNTIME_POLICY_DOMAIN_IDS.EXECUTION);
    assert.deepStrictEqual(fakeVM.calls, [['setFramerate', 30]]);
    pass('LRC2-DOD-05', 'Scratch VM mutation is exercised through ngvge.scratch-runtime-policy-adapter@1.');

    const modal = read('src/containers/tw-settings-modal.jsx');
    assert.match(modal, /createLegacyAdvancedSettingsBridge/);
    assert.doesNotMatch(modal, /this\.props\.vm\.setFramerate\s*\(/);
    assert.doesNotMatch(modal, /this\.props\.vm\.setInterpolation\s*\(/);
    assert.doesNotMatch(modal, /this\.props\.vm\.setRuntimeOptions\s*\(/);
    assert.doesNotMatch(modal, /this\.props\.vm\.setCompilerOptions\s*\(/);
    assert.doesNotMatch(modal, /this\.props\.vm\.renderer\.setUseHighQualityRender\s*\(/);
    assert.strictEqual(RUNTIME_POLICY_COMMAND_CONTRACT.directBackendMutationFromEditor, false);
    assert.strictEqual(RUNTIME_POLICY_COMMAND_CONTRACT.editorSuppliesAuthorityId, false);
    pass('LRC2-DOD-06', 'Advanced Settings routes policy mutation through the bridge/command path; Editor cannot supply Writer Authority.');

    expectInvalidField(scratchPolicy, 'opsPerFrame', 2);
    const bridgeSource = read('src/lib/runtime-policy/legacy-advanced-settings-bridge.js');
    const legacyCompatibilitySource = read('src/lib/runtime-policy/legacy-runtime-settings-compatibility.js');
    assert.match(bridgeSource, /setOpsPerFrame:\s*value\s*=>\s*compatibility\.setOpsPerFrame/);
    assert.match(legacyCompatibilitySource, /owner:\s*'legacy-scheduler-quarantine'/);
    assert.match(legacyCompatibilitySource, /vm\.setOpsPerFrame\(/);
    pass('LRC2-DOD-07', [
        'opsPerFrame is rejected from Native Policy and remains explicit Legacy scheduler quarantine',
        'behind the LRC-3 compatibility boundary.'
    ].join(' '));

    expectInvalidField(scratchPolicy, 'miscLimits', false);
    const projectDTO = toProjectRuntimePolicyDTO(scratchPolicy);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(projectDTO, 'miscLimits'), false);
    pass('LRC2-DOD-08', 'miscLimits is rejected from Native Policy; only explicit compatibility fields persist.');

    expectInvalidField(scratchPolicy, 'stageWidth', 640);
    expectInvalidField(scratchPolicy, 'stageHeight', 360);
    assert.match(bridgeSource, /setStageSize:\s*\(width, height\)\s*=>\s*compatibility\.setStageSize/);
    assert.match(legacyCompatibilitySource, /LEGACY_PROJECT_VIEWPORT_COMPATIBILITY_ID/);
    assert.match(legacyCompatibilitySource, /vm\.setStageSize\(/);
    pass('LRC2-DOD-09', [
        'Stage geometry is not Runtime Policy and remains isolated behind Project/Scene viewport compatibility ownership.'
    ].join(' '));

    assert.strictEqual(
        RUNTIME_POLICY_SET_SCHEMA.properties.executionBackend.persistence,
        SCHEMA_PROPERTY_PERSISTENCE.RUNTIME_ONLY
    );
    assert.strictEqual(
        RUNTIME_POLICY_SET_SCHEMA.properties.backendHints.persistence,
        SCHEMA_PROPERTY_PERSISTENCE.RUNTIME_ONLY
    );
    assert.strictEqual(Object.prototype.hasOwnProperty.call(projectDTO, 'executionBackend'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(projectDTO, 'backendHints'), false);
    pass('LRC2-DOD-10', 'Execution backend and backend hints are runtime-only and stripped from project persistence.');

    ['vm', 'renderer', 'scratchTarget', 'backendHandle', 'privateBackendHandle', '_twconfig_'].forEach(field => {
        expectInvalidField(scratchPolicy, field, {opaque: true});
    });
    const serializedProjectDTO = JSON.stringify(projectDTO);
    ['vm', 'renderer', 'scratchTarget', 'backendHandle', 'privateBackendHandle', '_twconfig_'].forEach(field => {
        assert.strictEqual(serializedProjectDTO.includes(`"${field}"`), false, `Project Runtime Policy DTO leaked ${field}.`);
    });
    pass('LRC2-DOD-11', 'Persistent Runtime Policy rejects backend/private handles and legacy mixed transport identity.');

    const packageJson = JSON.parse(read('package.json'));
    const scripts = packageJson.scripts || {};
    assert.match(scripts['test:legacy-containment:lrc2-certification'] || '', /lrc2-command-path/);
    assert.match(scripts['test:legacy-containment:lrc2-certification'] || '', /validate-lrc2-runtime-policy-certification/);
    assert.match(scripts['test:legacy-containment:lrc2-certification'] || '', /test:regression/);
    assert.match(scripts['test:legacy-containment:lrc2-certification'] || '', /test:unit/);
    assert.match(scripts['test:legacy-containment:lrc2-certification'] || '', /test:integration/);
    assert.match(scripts['test:legacy-containment:lrc2-certification'] || '', /test:conformance:0009-e/);
    assert.match(scripts['test:legacy-containment:lrc2-freeze'] || '', /lrc2-certification/);
    assert.match(scripts['test:legacy-containment:lrc2-freeze'] || '', /build:dev/);
    pass('LRC2-DOD-12', 'Package scripts provide cumulative semantic/regression certification plus a real Webpack freeze gate.');

    const evidenceByRequirement = new Map(evidence.map(item => [item.requirementId, item]));
    REQUIREMENTS.forEach(requirement => {
        assert(evidenceByRequirement.has(requirement.id), `Missing LRC-2 evidence: ${requirement.id}`);
    });
    assert.strictEqual(evidence.length, REQUIREMENTS.length);

    return Object.freeze({
        evidence: Object.freeze(evidence.slice()),
        requirements: REQUIREMENTS,
        requirementsChecked: REQUIREMENTS.length,
        requirementsPassed: evidence.length,
        schema: 'ngvge-lrc2-runtime-policy-certificate/v1',
        status: 'PASS'
    });
};

if (require.main === module) {
    const result = certify();
    process.stdout.write(`LRC-2 Runtime Policy Certification: PASS ${result.requirementsPassed}/${result.requirementsChecked}\n`);
    result.evidence.forEach(item => process.stdout.write(`- ${item.requirementId}: PASS — ${item.detail}\n`));
}

module.exports = {
    REQUIREMENTS,
    certify
};
