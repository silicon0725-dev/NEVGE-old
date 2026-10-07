'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const fail = message => {
    const error = new Error(message);
    error.code = 'NGVGE_LRC1_RUNTIME_OPTIONS_AUDIT_FAILED';
    throw error;
};

const auditPath = 'docs/architecture/legacy-runtime/LRC-1-runtime-policy-audit.json';
const audit = JSON.parse(read(auditPath));
const container = read('src/containers/tw-settings-modal.jsx');
const component = read('src/components/tw-settings-modal/settings-modal.jsx');
const stateManager = read('src/lib/tw-state-manager-hoc.jsx');
const vmListener = read('src/lib/vm-listener-hoc.jsx');
const reducer = read('src/reducers/tw.js');
const runtime = read('node_modules/scratch-vm/src/engine/runtime.js');
const frameLoop = read('node_modules/scratch-vm/src/engine/tw-frame-loop.js');
const interpolate = read('node_modules/scratch-vm/src/engine/tw-interpolate.js');
const renderedTarget = read('node_modules/scratch-vm/src/sprites/rendered-target.js');
const sound = read('node_modules/scratch-vm/src/blocks/scratch3_sound.js');
const pen = read('node_modules/scratch-vm/src/extensions/scratch3_pen/index.js');
const music = read('node_modules/scratch-vm/src/extensions/scratch3_music/index.js');
const mouse = read('node_modules/scratch-vm/src/io/mouse.js');
const render = read('node_modules/scratch-render/src/RenderWebGL.js');
const drawable = read('node_modules/scratch-render/src/Drawable.js');

if (audit.schema !== 'ngvge-lrc1-runtime-policy-audit/v1') fail('Unexpected LRC-1 audit schema.');
if (audit.stage !== 'LRC-1') fail('Unexpected LRC-1 stage marker.');

const expectedPolicyIds = [
    'LRC1-POL-001',
    'LRC1-POL-002',
    'LRC1-POL-003',
    'LRC1-POL-004',
    'LRC1-POL-005',
    'LRC1-POL-006',
    'LRC1-POL-007',
    'LRC1-POL-008',
    'LRC1-POL-009',
    'LRC1-POL-010',
    'LRC1-POL-011',
    'LRC1-POL-012',
    'LRC1-PERSIST-001'
];
const ids = audit.policies.map(policy => policy.id);
if (new Set(ids).size !== ids.length) fail('Duplicate LRC-1 policy IDs.');
for (const id of expectedPolicyIds) {
    if (!ids.includes(id)) fail(`Missing required policy audit record: ${id}`);
}
if (ids.length !== expectedPolicyIds.length) {
    fail(`Unexpected LRC-1 policy count: ${ids.length}; expected ${expectedPolicyIds.length}.`);
}

const runtimeHandlers = [
    'handleFramerateChange',
    'handleCustomizeFramerate',
    'handleOpsPerFrameChange',
    'handleCustomizeOpsPerFrame',
    'handleHighQualityPenChange',
    'handleInterpolationChange',
    'handleInfiniteClonesChange',
    'handleRemoveFencingChange',
    'handleRemoveLimitsChange',
    'handleOffscreenDrawableCullingChange',
    'handleWarpTimerChange',
    'handleStageWidthChange',
    'handleStageHeightChange',
    'handleDisableCompilerChange',
    'handleStoreProjectOptions'
];
for (const handler of runtimeHandlers) {
    if (!container.includes(`${handler} (`) && !container.includes(`${handler}()`)) {
        fail(`Advanced Runtime handler disappeared without audit update: ${handler}`);
    }
}

const controlMarkers = [
    'slug="custom-fps"',
    'slug="opf"',
    'slug="interpolation"',
    'slug="high-quality-pen"',
    'slug="offscreen-drawable-culling"',
    'slug="warp-timer"',
    'slug="infinite-clones"',
    'slug="remove-fencing"',
    'slug="remove-misc-limits"',
    'slug="custom-stage-size"',
    'slug="disable-compiler"',
    'StoreProjectOptions'
];
for (const marker of controlMarkers) {
    if (!component.includes(marker)) fail(`Advanced Runtime control disappeared without audit update: ${marker}`);
}

const storedOptionMarkers = [
    'framerate: this.frameLoop.framerate',
    'opsPerFrame: this.frameLoop.opsPerFrame',
    'runtimeOptions: this.runtimeOptions',
    'interpolation: this.interpolationEnabled',
    'turbo: this.turboMode',
    'hq: this.renderer ? this.renderer.useHighQualityRender : false',
    'width: this.stageWidth',
    'height: this.stageHeight'
];
for (const marker of storedOptionMarkers) {
    if (!runtime.includes(marker)) fail(`_twconfig_ stored field changed without LRC-1 audit update: ${marker}`);
}

const runtimeOptionMarkers = [
    'maxClones: Runtime.MAX_CLONES',
    'miscLimits: true',
    'fencing: true',
    'offscreenDrawableCulling: false'
];
for (const marker of runtimeOptionMarkers) {
    if (!runtime.includes(marker)) fail(`Runtime option changed without LRC-1 audit update: ${marker}`);
}

const compilerOptionMarkers = ['enabled: true', 'warpTimer: false'];
for (const marker of compilerOptionMarkers) {
    if (!runtime.includes(marker)) fail(`Compiler option changed without LRC-1 audit update: ${marker}`);
}

// Evidence guards for the highest-risk semantic claims.
if (!frameLoop.includes('for (let i = 0; i <this.opsPerFrame; i++)')) {
    fail('OpsPerFrame execution semantics changed; re-audit LRC1-POL-002.');
}
if (!interpolate.includes('renderer._allDrawables[drawableID]')) {
    fail('Interpolation backend access changed; re-audit LRC1-POL-003.');
}
if (!drawable.includes('if (this._highQuality)')) {
    fail('High-quality drawable rounding semantics changed; re-audit LRC1-POL-004.');
}
if (!render.includes('setOffscreenDrawableCulling (enabled)')) {
    fail('Offscreen culling implementation changed; re-audit LRC1-POL-005.');
}
if (!runtime.includes('return this._cloneCounter < this.runtimeOptions.maxClones')) {
    fail('Clone budget semantics changed; re-audit LRC1-POL-006.');
}
if (!renderedTarget.includes('this.runtime.runtimeOptions.fencing ?')) {
    fail('Fencing position semantics changed; re-audit LRC1-POL-007.');
}
for (const [name, text] of [['sound', sound], ['pen', pen], ['music', music], ['mouse', mouse]]) {
    if (!text.includes('runtimeOptions.miscLimits')) {
        fail(`miscLimits no longer touches ${name}; re-audit LRC1-POL-008 decomposition.`);
    }
}
if (!component.includes('max="1024"') || !reducer.includes('maxClones: 300')) {
    fail('Legacy settings validation/default contract changed; re-audit LRC-1.');
}
if (!stateManager.includes("searchParams.set('fps'")) {
    fail('URL runtime-policy ingress changed; re-audit precedence/persistence.');
}
if (vmListener.includes("'OPSPERFRAME_CHANGED'")) {
    fail('OpsPerFrame GUI event synchronization changed; LRC1-F002 must be re-audited.');
}

process.stdout.write('LRC-1 Legacy Advanced Runtime Options Semantic Audit PASS.\n');
process.stdout.write(JSON.stringify({
    schema: audit.schema,
    auditedRecords: audit.policies.length,
    advancedRuntimeControls: audit.scope.advancedRuntimeControls,
    latentStoredPolicies: audit.scope.latentStoredPolicies,
    persistenceMechanisms: audit.scope.persistenceMechanisms,
    findings: audit.findings.length,
    coverage: {
        containerHandlers: runtimeHandlers.length,
        componentMarkers: controlMarkers.length,
        twconfigFields: storedOptionMarkers.length,
        runtimeOptionFields: runtimeOptionMarkers.length,
        compilerOptionFields: compilerOptionMarkers.length
    },
    next: 'LRC-2 Execution / Presentation / Safety Profile Foundation'
}, null, 2) + '\n');
