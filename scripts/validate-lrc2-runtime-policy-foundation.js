/* eslint-disable strict */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const fail = message => {
    const error = new Error(message);
    error.code = 'NGVGE_LRC2_RUNTIME_POLICY_FOUNDATION_FAILED';
    throw error;
};
const requireFragments = (name, source, fragments) => fragments.forEach(fragment => {
    if (!source.includes(fragment)) fail(`${name} missing LRC-2 contract: ${fragment}`);
});
const forbidFragments = (name, source, fragments) => fragments.forEach(fragment => {
    if (source.includes(fragment)) fail(`${name} contains forbidden LRC-2 coupling: ${fragment}`);
});

const constants = read('src/lib/runtime-policy/constants.js');
const contract = read('src/lib/runtime-policy/runtime-policy-contract.js');
const schema = read('src/lib/runtime-policy/runtime-policy-schema.js');
const authority = read('src/lib/runtime-policy/runtime-policy-authority.js');
const presenter = read('src/lib/runtime-policy/presenter-capability.js');
const adapter = read('src/lib/runtime-policy/scratch-runtime-policy-adapter.js');
const legacySettings = read('src/containers/tw-settings-modal.jsx');

requireFragments('Runtime Policy constants', constants, [
    "RUNTIME_POLICY_SET_ID = 'ngvge.runtime-policy-set@1'",
    "SCRATCH_COMPATIBLE: 'scratch-compatible'",
    "NGVGE_HIGH_REFRESH: 'ngvge-high-refresh'",
    "SCRATCH_TRANSFORM_PRESENTATION_DOMAIN = 'scratch.sprite.transform'"
]);
requireFragments('Runtime Policy schema', schema, [
    'RUNTIME_POLICY_SET_SCHEMA',
    'SCHEMA_PROPERTY_PERSISTENCE.RUNTIME_ONLY',
    'executionBackend',
    'backendHints'
]);
requireFragments('Runtime Policy Authority', authority, [
    'RUNTIME_POLICY_AUTHORITY_REGISTRATIONS',
    'AUTHORITY_MODES.WRITER',
    'createRuntimePolicyAuthorityRegistry'
]);
requireFragments('Runtime Policy contract', contract, [
    "'opsPerFrame'",
    "'miscLimits'",
    "'stageWidth'",
    "'stageHeight'",
    'toProjectRuntimePolicyDTO',
    'validatePersistentDTO'
]);
requireFragments('Presenter capability', presenter, [
    'domainId: SCRATCH_TRANSFORM_PRESENTATION_DOMAIN',
    'supportsInterpolation: true',
    'supportsResampling: false',
    'does not imply project-wide resampling'
]);
requireFragments('Scratch Policy adapter', adapter, [
    'createScratchRuntimePolicyApplicationPlan',
    'this.vm.setFramerate(plan.framerate)',
    'this.vm.setInterpolation(plan.interpolation)',
    'this.vm.setRuntimeOptions(plan.runtimeOptions)',
    'hostHardCeiling'
]);
forbidFragments('Scratch Policy adapter', adapter, [
    'setOpsPerFrame'
]);

// LRC-2A froze the semantic foundation before the production switch. Later LRC-2 slices may extend
// the Scratch Compatibility Adapter with backend-only mappings without promoting those fields into
// Native Runtime Policy. The foundation gate therefore accepts either the original direct-writer
// state or the certified LRC-2B bridge state while preserving the same schema/authority invariants.
const legacyUiProductionSwitch = legacySettings.includes('createLegacyAdvancedSettingsBridge');
if (legacyUiProductionSwitch) {
    requireFragments('Legacy Advanced Settings LRC-2B bridge', legacySettings, [
        "from '../lib/runtime-policy'",
        'createLegacyAdvancedSettingsBridge'
    ]);
} else {
    requireFragments('Legacy Advanced Settings writer', legacySettings, [
        'this.props.vm.setFramerate(',
        'this.props.vm.setInterpolation(',
        'this.props.vm.setRuntimeOptions('
    ]);
}

process.stdout.write('LRC-2 Runtime Policy Foundation PASS.\n');
process.stdout.write(`${JSON.stringify({
    runtimePolicySchema: 'ngvge.runtime-policy-set@1',
    profileRegistry: 'ngvge.runtime-policy-profile-registry@1',
    resolver: 'ngvge.runtime-policy-resolver@1',
    scratchAdapter: 'ngvge.scratch-runtime-policy-adapter@1',
    simulationPresentationSeparated: true,
    scratchTransformInterpolationDomainScoped: true,
    runtimeOnlyBackendPolicy: true,
    legacyUiProductionSwitch
}, null, 2)}\n`);
