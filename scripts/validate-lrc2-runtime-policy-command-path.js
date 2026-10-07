#!/usr/bin/env node
/* eslint-disable strict */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const requireText = (text, pattern, message) => {
    if (!pattern.test(text)) throw new Error(message);
};
const forbidText = (text, pattern, message) => {
    if (pattern.test(text)) throw new Error(message);
};

const modal = read('src/containers/tw-settings-modal.jsx');
const bridge = read('src/lib/runtime-policy/legacy-advanced-settings-bridge.js');
const executor = read('src/lib/runtime-policy/runtime-policy-command-executor.js');
const capability = read('src/lib/runtime-policy/runtime-policy-command-capability.js');
const integration = read('src/lib/runtime-policy/runtime-policy-runtime-integration.js');
const listener = read('src/lib/vm-listener-hoc.jsx');
const contract = read('src/lib/runtime-policy/runtime-policy-contract.js');
const legacyCompatibility = read('src/lib/runtime-policy/legacy-runtime-settings-compatibility.js');

requireText(
    modal,
    /createLegacyAdvancedSettingsBridge/,
    'Legacy Advanced Settings must consume the LRC-2B bridge.'
);
requireText(
    modal,
    /legacyUnboundedCloneRequest[\s\S]*CLONE_BUDGET_MODES\.LEGACY_UNBOUNDED_REQUEST/,
    'Legacy Infinite Clones UI state must reflect the bounded policy request, not backend Infinity.'
);
forbidText(
    modal,
    new RegExp([
        'this\\.props\\.vm\\.',
        '(?:setFramerate|setInterpolation|setRuntimeOptions|setCompilerOptions|',
        'setOpsPerFrame|setStageSize|storeProjectOptions)\\s*\\('
    ].join('')),
    'Legacy Advanced Settings must not directly mutate VM Runtime/Compiler/Stage settings.'
);
forbidText(
    modal,
    /this\.props\.vm\.renderer\.setUseHighQualityRender\s*\(/,
    'Legacy Advanced Settings must not directly mutate the Scratch renderer.'
);

requireText(
    capability,
    /editorSuppliesAuthorityId:\s*false/,
    'Runtime Policy command contract must forbid Editor-supplied Writer Authority identity.'
);
requireText(
    executor,
    /resolver\.authorityRegistry\.getWriter\(domain\)/,
    'Runtime Policy executor must resolve Writer Authority inside the host boundary.'
);
requireText(
    executor,
    /FORBIDDEN_COMMAND_FIELDS[\s\S]*'authorityId'/,
    'Runtime Policy command payload must reject authorityId.'
);
requireText(
    executor,
    /currentPolicy\s*=\s*candidate/,
    'Runtime Policy executor must own committed Runtime Policy state.'
);
requireText(
    integration,
    /Object\.defineProperty\(runtime, RUNTIME_POLICY_RUNTIME_PROPERTY/,
    'Runtime Policy runtime integration must expose a stable client facade on Runtime.'
);
requireText(
    listener,
    /installRuntimePolicyService\(this\.props\.vm\)/,
    'VM Listener must install the Runtime Policy production service.'
);

requireText(
    bridge,
    /LEGACY_RUNTIME_QUARANTINE_ID/,
    'Non-policy Legacy Advanced Settings must be explicitly quarantined.'
);
requireText(
    bridge,
    /setOpsPerFrame:\s*value\s*=>\s*compatibility\.setOpsPerFrame/,
    'OpsPerFrame must delegate into the explicit Legacy compatibility quarantine.'
);
requireText(
    legacyCompatibility,
    /owner:\s*'legacy-scheduler-quarantine'/,
    'OpsPerFrame must remain explicitly owned by Legacy scheduler quarantine.'
);
requireText(
    legacyCompatibility,
    /vm\.setOpsPerFrame\(/,
    'Only the Legacy compatibility owner may project OpsPerFrame to the Scratch backend.'
);
requireText(
    bridge,
    /setStageSize:\s*\(width, height\)\s*=>\s*compatibility\.setStageSize/,
    'Stage size must remain outside Runtime Policy and delegate through compatibility ownership.'
);
requireText(
    legacyCompatibility,
    /LEGACY_PROJECT_VIEWPORT_COMPATIBILITY_ID/,
    'Stage size must have explicit Project/Scene viewport compatibility ownership.'
);
forbidText(
    contract,
    /DOMAIN_FIELDS[\s\S]{0,2400}opsPerFrame/,
    'OpsPerFrame must not become a Native Runtime Policy domain field.'
);

console.log('LRC-2B Runtime Policy production command path: PASS');
console.log('- Editor-supplied Writer Authority: FORBIDDEN');
console.log('- Runtime Policy Host command/executor path: ACTIVE');
console.log('- Scratch backend mutation: ADAPTER OWNED');
console.log('- Legacy Advanced Settings direct VM/Renderer mutation: REMOVED');
console.log('- OpsPerFrame / Warp Timer / Stage Size / legacy project storage: EXPLICIT COMPATIBILITY OWNERS');
