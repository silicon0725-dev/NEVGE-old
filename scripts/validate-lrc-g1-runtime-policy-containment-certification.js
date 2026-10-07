const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ExtendedJSON = require('@turbowarp/json');

const corpus = require('../test/fixtures/runtime-compatibility/lrc4-corpus');
const {
    CLONE_BUDGET_MODES,
    COMPATIBILITY_STATUS,
    LEGACY_RUNTIME_SOURCE_IDS,
    LEGACY_TWCONFIG_MAGIC,
    PRESENTATION_DOMAIN_MODES,
    PRESENTATION_REFRESH_POLICIES,
    RUNTIME_POLICY_COMMAND_CONTRACT,
    RUNTIME_POLICY_DOMAIN_IDS,
    RUNTIME_POLICY_PROFILE_IDS,
    RUNTIME_POLICY_SET_ID,
    SCRATCH_TRANSFORM_PRESENTATION_DOMAIN,
    createRuntimePolicyProfileRegistry,
    getRuntimePolicyClient,
    installLegacyRuntimeSettingsCompatibilityService,
    installRuntimeCompatibilityService,
    installRuntimePolicyService,
    unwrapRuntimePolicyCommandResult
} = require('../src/lib/runtime-policy');

const ROOT = path.resolve(__dirname, '..');
const evidence = [];
const pass = (requirementId, detail) => evidence.push(Object.freeze({detail, requirementId, status: 'PASS'}));
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

const createVM = (opcodes = [], options = {}) => {
    const calls = [];
    const blocks = {};
    opcodes.forEach((opcode, index) => {
        blocks[`block-${index}`] = {opcode};
    });
    const stage = {
        comments: {},
        createComment: (id, blockId, text) => {
            stage.comments[id] = {id, text};
            calls.push(['createComment', text]);
        },
        isStage: true
    };
    const loadedExtensions = new Map();
    (options.loadedExtensions || []).forEach(extensionId => {
        loadedExtensions.set(extensionId, `service.${extensionId}`);
    });
    const runtime = {
        compilerOptions: {enabled: true, warpTimer: false},
        extensionManager: {_loadedExtensions: loadedExtensions},
        frameLoop: {framerate: 30, opsPerFrame: 1},
        getTargetForStage: () => stage,
        interpolationEnabled: false,
        runtimeOptions: {
            fencing: true,
            maxClones: 300,
            miscLimits: true,
            offscreenDrawableCulling: false
        },
        stageHeight: 360,
        stageWidth: 480,
        targets: [stage, {blocks: {_blocks: blocks}, isStage: false}],
        turboMode: false
    };
    const renderer = {
        setUseHighQualityRender: value => {
            renderer.useHighQualityRender = value;
            calls.push(['setUseHighQualityRender', value]);
        },
        useHighQualityRender: false
    };
    const vm = {
        calls,
        editingTarget: stage,
        renderer,
        runtime,
        emitWorkspaceUpdate: () => calls.push(['emitWorkspaceUpdate']),
        setCompilerOptions: value => {
            Object.assign(runtime.compilerOptions, value);
            calls.push(['setCompilerOptions', value]);
        },
        setFramerate: value => {
            runtime.frameLoop.framerate = value;
            calls.push(['setFramerate', value]);
        },
        setInterpolation: value => {
            runtime.interpolationEnabled = value;
            calls.push(['setInterpolation', value]);
        },
        setOpsPerFrame: value => {
            runtime.frameLoop.opsPerFrame = value;
            calls.push(['setOpsPerFrame', value]);
        },
        setRuntimeOptions: value => {
            Object.assign(runtime.runtimeOptions, value);
            calls.push(['setRuntimeOptions', value]);
        },
        setStageSize: (width, height) => {
            runtime.stageWidth = width;
            runtime.stageHeight = height;
            calls.push(['setStageSize', width, height]);
        },
        setTurboMode: value => {
            runtime.turboMode = value;
            calls.push(['setTurboMode', value]);
        }
    };
    runtime.emitProjectChanged = () => calls.push(['emitProjectChanged']);
    return {stage, vm};
};

const installStack = (vm, options = {}) => {
    installRuntimePolicyService(vm);
    const legacy = installLegacyRuntimeSettingsCompatibilityService(vm);
    const compatibility = installRuntimeCompatibilityService(vm, options);
    return {
        compatibility,
        legacy,
        runtimePolicy: getRuntimePolicyClient(vm.runtime)
    };
};

const highRefreshPresentationPatch = Object.freeze({
    domainPolicies: Object.freeze([Object.freeze({
        domainId: SCRATCH_TRANSFORM_PRESENTATION_DOMAIN,
        interpolation: PRESENTATION_DOMAIN_MODES.IF_SUPPORTED,
        requiresExactTickPresentation: false,
        resampling: PRESENTATION_DOMAIN_MODES.DISABLED
    })]),
    refreshPolicy: PRESENTATION_REFRESH_POLICIES.DISPLAY
});

const makeTwconfigComment = options => [
    'Configuration for https://turbowarp.org/',
    `${ExtendedJSON.stringify(options)}${LEGACY_TWCONFIG_MAGIC}`
].join('\n');

const certify = () => {
    const lrc2Certificate = JSON.parse(read(
        'docs/architecture/legacy-runtime/LRC-2-RUNTIME-POLICY-CERTIFICATE.json'
    ));
    const lrc4Certificate = JSON.parse(read('docs/architecture/legacy-runtime/LRC-4-CERTIFICATE.json'));
    assert.strictEqual(lrc2Certificate.status, 'PASS');
    assert.strictEqual(lrc2Certificate.governanceStatus, 'COMPLETE / CERTIFIED / ARCHITECTURE FROZEN');
    assert.strictEqual(lrc4Certificate.status, 'COMPLETE / VERIFIED');
    assert.match(read('docs/architecture/legacy-runtime/LRC-3-LEGACY-RUNTIME-SETTINGS-COMPATIBILITY-ADAPTER.md'),
        /Status: COMPLETE \/ VERIFIED/);
    pass('LRC-G1-01', 'LRC-2 is frozen and LRC-3/LRC-4 are verified prerequisites for the containment gate.');

    assert.strictEqual(RUNTIME_POLICY_SET_ID, 'ngvge.runtime-policy-set@1');
    assert.strictEqual(RUNTIME_POLICY_COMMAND_CONTRACT.editorSuppliesAuthorityId, false);
    assert.strictEqual(RUNTIME_POLICY_COMMAND_CONTRACT.directBackendMutationFromEditor, false);
    pass('LRC-G1-02', 'Runtime Policy identity and command boundary remain NGVGE-owned and Host-authoritative.');

    const independent = createVM(['motion_movesteps']);
    const independentStack = installStack(independent.vm);
    independent.vm.calls.length = 0;
    unwrapRuntimePolicyCommandResult(independentStack.runtimePolicy.patchDomain(
        RUNTIME_POLICY_DOMAIN_IDS.PRESENTATION,
        highRefreshPresentationPatch
    ));
    assert(independent.vm.calls.some(call => call[0] === 'setInterpolation' && call[1] === true));
    assert.strictEqual(independent.vm.calls.some(call => call[0] === 'setFramerate'), false);
    assert.strictEqual(independentStack.runtimePolicy.getSnapshot().execution.simulationTickRate, 30);
    independent.vm.calls.length = 0;
    unwrapRuntimePolicyCommandResult(independentStack.runtimePolicy.patchDomain(
        RUNTIME_POLICY_DOMAIN_IDS.EXECUTION,
        {simulationTickRate: 60}
    ));
    assert(independent.vm.calls.some(call => call[0] === 'setFramerate' && call[1] === 60));
    assert.strictEqual(independent.vm.calls.some(call => call[0] === 'setInterpolation'), false);
    assert.strictEqual(
        independentStack.runtimePolicy.getSnapshot().presentation.refreshPolicy,
        PRESENTATION_REFRESH_POLICIES.DISPLAY
    );
    pass('LRC-G1-03', 'Execution and Presentation mutate independently through the production command/adapter path.');

    const pureTransform = createVM(['motion_movesteps']);
    const pureTransformStack = installStack(pureTransform.vm);
    const highRefresh = createRuntimePolicyProfileRegistry().createPolicySet(
        RUNTIME_POLICY_PROFILE_IDS.NGVGE_HIGH_REFRESH
    );
    const pureTransformReport = pureTransformStack.compatibility.previewPolicy(highRefresh);
    assert.strictEqual(highRefresh.execution.simulationTickRate, 30);
    assert.strictEqual(highRefresh.presentation.refreshPolicy, PRESENTATION_REFRESH_POLICIES.DISPLAY);
    assert.strictEqual(pureTransformReport.sections.execution.status, COMPATIBILITY_STATUS.COMPATIBLE);
    assert.strictEqual(pureTransformReport.sections.presentation.status, COMPATIBILITY_STATUS.COMPATIBLE);
    pass('LRC-G1-04', '30 Hz Scratch-compatible simulation can coexist with display-refresh transform presentation.');

    const projectFPS = createVM(['motion_movesteps']);
    const projectFPSStack = installStack(projectFPS.vm);
    unwrapRuntimePolicyCommandResult(projectFPSStack.runtimePolicy.patchDomain(
        RUNTIME_POLICY_DOMAIN_IDS.PRESENTATION,
        highRefreshPresentationPatch
    ));
    projectFPSStack.legacy.importLegacyProjectOptions({framerate: 60});
    const projectFPSPolicy = projectFPSStack.runtimePolicy.getSnapshot();
    assert.strictEqual(projectFPSPolicy.execution.simulationTickRate, 60);
    assert.strictEqual(projectFPSPolicy.presentation.refreshPolicy, PRESENTATION_REFRESH_POLICIES.DISPLAY);
    assert.strictEqual(projectFPS.vm.runtime.interpolationEnabled, true);
    pass('LRC-G1-05', 'Legacy project FPS maps only to Execution and cannot silently replace Presentation policy.');

    const precedence = createVM();
    const precedenceStack = installStack(precedence.vm);
    precedenceStack.legacy.setFramerate(120, LEGACY_RUNTIME_SOURCE_IDS.URL_SESSION);
    precedenceStack.legacy.importLegacyProjectOptions({framerate: 60});
    precedenceStack.legacy.setFramerate(144, LEGACY_RUNTIME_SOURCE_IDS.URL_SESSION);
    assert.strictEqual(precedence.vm.runtime.frameLoop.framerate, 60);
    precedenceStack.legacy.importLegacyProjectOptions({});
    assert.strictEqual(precedence.vm.runtime.frameLoop.framerate, 144);
    pass(
        'LRC-G1-06',
        'Per-key Legacy precedence preserves blocked session intent and restores it after project claims clear.'
    );

    const twconfig = createVM();
    twconfig.stage.comments.config = {id: 'config', text: makeTwconfigComment({framerate: 50})};
    const twconfigStack = installStack(twconfig.vm);
    const imported = twconfig.vm.runtime.parseProjectOptions();
    assert.strictEqual(imported.found, true);
    assert.strictEqual(twconfigStack.runtimePolicy.getSnapshot().execution.simulationTickRate, 50);
    twconfig.stage.comments = {};
    unwrapRuntimePolicyCommandResult(twconfigStack.runtimePolicy.patchDomain(
        RUNTIME_POLICY_DOMAIN_IDS.EXECUTION,
        {simulationTickRate: 30}
    ));
    assert.strictEqual(Object.keys(twconfig.stage.comments).length, 0);
    twconfigStack.legacy.exportLegacyProjectOptionsToProject();
    assert(Object.values(twconfig.stage.comments)[0].text.includes(LEGACY_TWCONFIG_MAGIC));
    pass('LRC-G1-07', '_twconfig_ participates only at explicit Legacy import/export boundaries, not Native mutation.');

    const penStamp = createVM(['motion_movesteps', 'pen_penDown', 'pen_stamp']);
    const penStampStack = installStack(penStamp.vm);
    const penStampReport = penStampStack.compatibility.previewPolicy(highRefresh);
    assert.strictEqual(penStampReport.sections.presentation.status, COMPATIBILITY_STATUS.PARTIAL);
    assert(penStampReport.sections.presentation.diagnostics.some(diagnostic => (
        diagnostic.code === 'compat.presentation.exact-tick-domain-on-high-refresh'
    )));
    const penDomain = penStampReport.sections.presentation.domains.find(domain => domain.domainId === 'scratch.pen');
    const stampDomain = penStampReport.sections.presentation.domains.find(
        domain => domain.domainId === 'scratch.stamp'
    );
    assert.strictEqual(penDomain.capability.requiresExactTickPresentation, true);
    assert.strictEqual(stampDomain.capability.requiresExactTickPresentation, true);
    pass(
        'LRC-G1-08',
        'Pen and Stamp exact-tick limitations are detected explicitly and are never hidden by transform interpolation.'
    );

    const backend = createVM(['motion_movesteps']);
    const backendStack = installStack(backend.vm);
    delete backend.vm.setInterpolation;
    const backendReport = backendStack.compatibility.previewPolicy(highRefresh);
    assert.strictEqual(backendReport.sections.presentation.status, COMPATIBILITY_STATUS.COMPATIBLE);
    assert.strictEqual(backendReport.sections.backend.status, COMPATIBILITY_STATUS.INCOMPATIBLE);
    pass(
        'LRC-G1-09',
        'Renderer/backend capability failure is reported separately from semantic Presentation compatibility.'
    );

    const unknown = createVM(['render3d_drawMesh'], {loadedExtensions: ['render3d']});
    const unknownStack = installStack(unknown.vm, {
        extensionDescriptors: [{extensionId: 'render3d', visualDomains: ['extension.renderer.3d']}]
    });
    const unknownReport = unknownStack.compatibility.previewPolicy(highRefresh);
    assert.strictEqual(unknownReport.sections.presentation.status, COMPATIBILITY_STATUS.UNKNOWN);
    assert(unknownReport.sections.presentation.diagnostics.some(diagnostic => (
        diagnostic.code === 'compat.presentation.capability-missing'
    )));
    pass('LRC-G1-10', 'Unknown/custom visual domains fail visibly instead of inheriting project-wide compatibility.');

    const queryOnly = createVM(['pen_penDown', 'motion_movesteps']);
    const queryOnlyStack = installStack(queryOnly.vm);
    const beforePolicy = queryOnlyStack.runtimePolicy.getSnapshot();
    const beforeCalls = queryOnly.vm.calls.slice();
    queryOnlyStack.compatibility.previewPolicy(highRefresh);
    assert.deepStrictEqual(queryOnlyStack.runtimePolicy.getSnapshot(), beforePolicy);
    assert.deepStrictEqual(queryOnly.vm.calls, beforeCalls);
    pass('LRC-G1-11', 'Compatibility analysis and profile preview are query-only and own no mutation authority.');

    const clones = createVM();
    const cloneStack = installStack(clones.vm);
    cloneStack.legacy.importLegacyProjectOptions({runtimeOptions: {maxClones: Infinity}});
    const cloneBudget = cloneStack.runtimePolicy.getSnapshot().safety.cloneBudget;
    assert.strictEqual(cloneBudget.mode, CLONE_BUDGET_MODES.LEGACY_UNBOUNDED_REQUEST);
    assert.strictEqual(cloneBudget.requestedLimit, null);
    assert.strictEqual(clones.vm.runtime.runtimeOptions.maxClones, cloneBudget.hostHardCeiling);
    assert.notStrictEqual(clones.vm.runtime.runtimeOptions.maxClones, Infinity);
    pass('LRC-G1-12', 'Legacy unbounded clone intent remains a bounded compatibility request under Host hard ceiling.');

    assert.strictEqual(corpus.length, 17);
    assert.strictEqual(corpus[0].id, 'C01');
    assert.strictEqual(corpus[16].id, 'C17');
    pass(
        'LRC-G1-13',
        'The C01-C17 representative compatibility corpus remains present for ongoing containment regression.'
    );

    const vmListener = read('src/lib/vm-listener-hoc.jsx');
    const settings = read('src/containers/tw-settings-modal.jsx');
    const policyInstall = vmListener.indexOf('installRuntimePolicyService(this.props.vm)');
    const legacyInstall = vmListener.indexOf('installLegacyRuntimeSettingsCompatibilityService(this.props.vm)');
    const analyzerInstall = vmListener.indexOf('installRuntimeCompatibilityService(this.props.vm)');
    assert(policyInstall >= 0 && legacyInstall > policyInstall && analyzerInstall > legacyInstall);
    ['vm.setFramerate(', 'vm.setInterpolation(', 'vm.setRuntimeOptions(', 'renderer.setUseHighQualityRender(']
        .forEach(token => assert.strictEqual(settings.includes(token), false));
    assert(settings.includes('createLegacyAdvancedSettingsBridge'));
    pass(
        'LRC-G1-14',
        'Production Host installs Policy -> Legacy Adapter -> Analyzer in order; ' +
        'Advanced Settings has no direct policy writer.'
    );

    const packageJson = JSON.parse(read('package.json'));
    assert(packageJson.scripts['test:legacy-containment:lrc-g1-certification']);
    assert(packageJson.scripts['test:legacy-containment:lrc-g1']);
    pass('LRC-G1-15', 'Focused certification and cumulative executable G1 gates are registered.');

    return Object.freeze({
        evidence: Object.freeze(evidence.slice()),
        passed: evidence.length,
        status: 'PASS',
        total: 15
    });
};

try {
    const result = certify();
    assert.strictEqual(result.passed, result.total);
    console.log(`LRC-G1 Runtime Policy Containment Certification: PASS (${result.passed}/${result.total})`);
    result.evidence.forEach(item => console.log(`  ${item.requirementId}: ${item.status} - ${item.detail}`));
} catch (error) {
    console.error('LRC-G1 Runtime Policy Containment Certification: FAIL');
    console.error(error.stack || error);
    process.exitCode = 1;
}
