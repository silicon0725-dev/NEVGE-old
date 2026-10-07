const assert = require('assert');
const fs = require('fs');
const path = require('path');

const corpus = require('../test/fixtures/runtime-compatibility/lrc4-corpus');
const {
    COMPATIBILITY_ANALYZER_ID,
    COMPATIBILITY_REPORT_SCHEMA,
    COMPATIBILITY_STATUS,
    RUNTIME_COMPATIBILITY_SERVICE_ID,
    RUNTIME_POLICY_PROFILE_IDS,
    createCompatibilityAnalyzer,
    createRuntimePolicyProfileRegistry,
    createScratchBackendCapabilitySnapshot,
    createScratchProjectCompatibilitySnapshot,
    installLegacyRuntimeSettingsCompatibilityService,
    installRuntimeCompatibilityService,
    installRuntimePolicyService
} = require('../src/lib/runtime-policy');

const ROOT = path.resolve(__dirname, '..');
const evidence = [];
const pass = (requirementId, detail) => evidence.push(Object.freeze({detail, requirementId, status: 'PASS'}));
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

const createVM = (opcodes, options = {}) => {
    const calls = [];
    const blocks = {};
    opcodes.forEach((opcode, index) => {
        blocks[`block-${index}`] = {opcode};
    });
    const loadedExtensions = new Map();
    (options.loadedExtensions || []).forEach(extensionId => {
        loadedExtensions.set(extensionId, `service.${extensionId}`);
    });
    const runtime = {
        compilerOptions: {enabled: true, warpTimer: false},
        extensionManager: {_loadedExtensions: loadedExtensions},
        frameLoop: {framerate: 30, opsPerFrame: 1},
        interpolationEnabled: false,
        runtimeOptions: {
            fencing: true,
            maxClones: 300,
            miscLimits: true,
            offscreenDrawableCulling: false
        },
        stageHeight: options.stageHeight || 360,
        stageWidth: options.stageWidth || 480,
        targets: [{blocks: {_blocks: blocks}, isStage: false}],
        turboMode: false
    };
    const renderer = {
        setUseHighQualityRender: value => calls.push(['setUseHighQualityRender', value]),
        useHighQualityRender: false
    };
    return {
        calls,
        renderer,
        runtime,
        setCompilerOptions: value => calls.push(['setCompilerOptions', value]),
        setFramerate: value => calls.push(['setFramerate', value]),
        setInterpolation: value => calls.push(['setInterpolation', value]),
        setOpsPerFrame: value => calls.push(['setOpsPerFrame', value]),
        setRuntimeOptions: value => calls.push(['setRuntimeOptions', value]),
        setStageSize: (width, height) => calls.push(['setStageSize', width, height]),
        setTurboMode: value => calls.push(['setTurboMode', value])
    };
};

const analyze = (policy, opcodes, options = {}) => {
    const vm = createVM(opcodes, options);
    return createCompatibilityAnalyzer().analyze({
        backend: createScratchBackendCapabilitySnapshot(vm),
        legacy: null,
        policy,
        project: createScratchProjectCompatibilitySnapshot(vm, {
            extensionDescriptors: options.extensionDescriptors
        })
    });
};

const certify = () => {
    const profiles = createRuntimePolicyProfileRegistry();
    const scratch = profiles.createPolicySet(RUNTIME_POLICY_PROFILE_IDS.SCRATCH_COMPATIBLE);
    const highRefresh = profiles.createPolicySet(RUNTIME_POLICY_PROFILE_IDS.NGVGE_HIGH_REFRESH);

    const baseline = analyze(scratch, ['motion_movesteps']);
    assert.strictEqual(baseline.analyzerId, COMPATIBILITY_ANALYZER_ID);
    assert.strictEqual(baseline.schema, COMPATIBILITY_REPORT_SCHEMA);
    assert.deepStrictEqual(Object.keys(baseline.sections).sort(), [
        'backend', 'execution', 'legacy', 'presentation', 'resource'
    ]);
    pass(
        'LRC4-DOD-01',
        'Compatibility reports separate Execution, Presentation, Resource, Backend and Legacy results.'
    );

    const penStamp = analyze(highRefresh, ['motion_movesteps', 'pen_penDown', 'pen_stamp']);
    assert.strictEqual(penStamp.sections.presentation.status, COMPATIBILITY_STATUS.PARTIAL);
    assert(penStamp.sections.presentation.diagnostics.some(diagnostic =>
        diagnostic.code === 'compat.presentation.exact-tick-domain-on-high-refresh'));
    pass('LRC4-DOD-02', 'Pen and Stamp remain exact-tick domains and are not hidden by transform interpolation.');

    const transform = analyze(highRefresh, ['motion_movesteps', 'motion_turnright']);
    assert.strictEqual(transform.sections.presentation.status, COMPATIBILITY_STATUS.COMPATIBLE);
    assert.strictEqual(transform.sections.presentation.domains[0].capability.supportsInterpolation, true);
    pass('LRC4-DOD-03', 'Scratch transform interpolation is reported only for the supported transform domain.');

    const unknown = analyze(highRefresh, ['render3d_drawMesh'], {
        extensionDescriptors: [{extensionId: 'render3d', visualDomains: ['extension.renderer.3d']}],
        loadedExtensions: ['render3d']
    });
    assert.strictEqual(unknown.sections.presentation.status, COMPATIBILITY_STATUS.UNKNOWN);
    assert(unknown.sections.presentation.diagnostics.some(diagnostic =>
        diagnostic.code === 'compat.presentation.capability-missing'));
    pass('LRC4-DOD-04', 'Unsupported/unknown visual domains fail visibly with explicit diagnostics.');

    const missingInterpolationVM = createVM(['motion_movesteps']);
    delete missingInterpolationVM.setInterpolation;
    const separated = createCompatibilityAnalyzer().analyze({
        backend: createScratchBackendCapabilitySnapshot(missingInterpolationVM),
        legacy: null,
        policy: highRefresh,
        project: createScratchProjectCompatibilitySnapshot(missingInterpolationVM)
    });
    assert.strictEqual(separated.sections.presentation.status, COMPATIBILITY_STATUS.COMPATIBLE);
    assert.strictEqual(separated.sections.backend.status, COMPATIBILITY_STATUS.INCOMPATIBLE);
    pass('LRC4-DOD-05', 'Backend capability failure is reported separately from semantic Presentation compatibility.');

    const previewVM = createVM(['pen_penDown', 'motion_movesteps']);
    installRuntimePolicyService(previewVM);
    installLegacyRuntimeSettingsCompatibilityService(previewVM);
    const service = installRuntimeCompatibilityService(previewVM);
    const beforeCalls = previewVM.calls.slice();
    const preview = service.previewPolicy(highRefresh);
    assert.strictEqual(service.id, RUNTIME_COMPATIBILITY_SERVICE_ID);
    assert.strictEqual(preview.sections.presentation.status, COMPATIBILITY_STATUS.PARTIAL);
    assert.deepStrictEqual(previewVM.calls, beforeCalls);
    pass('LRC4-DOD-06', 'Profile impact preview is query-only and does not mutate Scratch backend state.');

    assert.strictEqual(corpus.length, 17);
    assert.deepStrictEqual(corpus.map(record => record.id),
        Array.from({length: 17}, (value, index) => `C${String(index + 1).padStart(2, '0')}`));
    pass('LRC4-DOD-07', 'Representative Scratch Compatibility Corpus C01-C17 is established.');

    const corpusSource = read('test/fixtures/runtime-compatibility/lrc4-corpus.js');
    ['Pen-heavy', 'Stamp-heavy', 'Clone-heavy', 'Wait/timer-sensitive', 'Custom stage size',
        'Custom Scratch extension', '3D/custom renderer extension'].forEach(title => {
        assert.match(corpusSource, new RegExp(title));
    });
    pass('LRC4-DOD-08', 'Corpus covers the frozen LRC-4 semantic and visual risk classes.');

    const vmListener = read('src/lib/vm-listener-hoc.jsx');
    const analyzerSource = read('src/lib/runtime-policy/compatibility-analyzer.js');
    assert.match(vmListener, /installRuntimeCompatibilityService\(this\.props\.vm\)/);
    ['setFramerate(', 'setInterpolation(', 'setRuntimeOptions(', 'setCompilerOptions(', 'setStageSize(']
        .forEach(token => assert.strictEqual(analyzerSource.includes(token), false));
    pass(
        'LRC4-DOD-09',
        'Production Host installs the query service; Analyzer source owns no Runtime mutation setters.'
    );

    const packageJson = JSON.parse(read('package.json'));
    assert(packageJson.scripts['test:legacy-containment:lrc4-analyzer']);
    assert(packageJson.scripts['test:legacy-containment:lrc4']);
    pass('LRC4-DOD-10', 'LRC-4 has focused and cumulative executable verification gates.');

    return Object.freeze({
        analyzerId: COMPATIBILITY_ANALYZER_ID,
        evidence: Object.freeze(evidence.slice()),
        passed: evidence.length,
        status: 'PASS',
        total: 10
    });
};

try {
    const result = certify();
    assert.strictEqual(result.passed, result.total);
    console.log(`LRC-4 Compatibility Analyzer DoD: PASS (${result.passed}/${result.total})`);
    result.evidence.forEach(item => console.log(`  ${item.requirementId}: ${item.status} - ${item.detail}`));
} catch (error) {
    console.error('LRC-4 Compatibility Analyzer DoD: FAIL');
    console.error(error.stack || error);
    process.exitCode = 1;
}
