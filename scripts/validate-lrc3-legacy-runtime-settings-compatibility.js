const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
    LEGACY_PROJECT_VIEWPORT_COMPATIBILITY_ID,
    LEGACY_RUNTIME_PRECEDENCE,
    LEGACY_RUNTIME_SETTINGS_COMPATIBILITY_SERVICE_ID,
    LEGACY_RUNTIME_SOURCE_IDS,
    LEGACY_SCRATCH_PROJECT_OPTIONS_ADAPTER_ID,
    RUNTIME_POLICY_SET_SCHEMA_VERSION,
    RUNTIME_POLICY_SET_TYPE_ID,
    createLegacyProjectOptionsMigrationPlan,
    installLegacyRuntimeSettingsCompatibilityService
} = require('../src/lib/runtime-policy');

const ROOT = path.resolve(__dirname, '..');
const REQUIREMENTS = Object.freeze([
    Object.freeze({id: 'LRC3-DOD-01', title: '_twconfig_ parser no longer owns Runtime setters'}),
    Object.freeze({id: 'LRC3-DOD-02', title: 'Every known Legacy field has an explicit migration owner'}),
    Object.freeze({id: 'LRC3-DOD-03', title: 'Unknown and unsupported Legacy fields fail visibly'}),
    Object.freeze({id: 'LRC3-DOD-04', title: 'Precedence is explicit and resolved per semantic key'}),
    Object.freeze({id: 'LRC3-DOD-05', title: 'Legacy ingress routes through the compatibility service'}),
    Object.freeze({id: 'LRC3-DOD-06', title: 'Native Runtime Policy v1 remains frozen and unmixed'}),
    Object.freeze({id: 'LRC3-DOD-07', title: 'OpsPerFrame and viewport remain outside Native Runtime Policy'}),
    Object.freeze({id: 'LRC3-DOD-08', title: 'Infinity clone intent remains bounded by Host authority'}),
    Object.freeze({id: 'LRC3-DOD-09', title: '_twconfig_ generation is explicit Legacy export only'}),
    Object.freeze({id: 'LRC3-DOD-10', title: 'LRC-3 has a cumulative executable verification gate'})
]);

const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const evidence = [];
const pass = (requirementId, detail) => evidence.push(Object.freeze({detail, requirementId, status: 'PASS'}));

const createFakeVM = () => {
    const calls = [];
    const stage = {comments: {}, isStage: true};
    const runtime = {
        compilerOptions: {enabled: true, warpTimer: false},
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
        turboMode: false
    };
    const renderer = {
        setUseHighQualityRender: value => calls.push(['setUseHighQualityRender', value]),
        useHighQualityRender: false
    };
    const vm = {
        calls,
        renderer,
        runtime,
        setCompilerOptions: value => {
            Object.assign(runtime.compilerOptions, value);
            calls.push(['setCompilerOptions', value]);
        },
        setFramerate: value => {
            runtime.frameLoop.framerate = value;
            calls.push(['setFramerate', value]);
        },
        setInterpolation: value => calls.push(['setInterpolation', value]),
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
    return vm;
};

const certify = () => {
    const compatibilitySource = read('src/lib/runtime-policy/legacy-runtime-settings-compatibility.js');
    const vmListener = read('src/lib/vm-listener-hoc.jsx');
    assert.strictEqual(
        LEGACY_RUNTIME_SETTINGS_COMPATIBILITY_SERVICE_ID,
        'ngvge.legacy-runtime-settings-compatibility@1'
    );
    assert.strictEqual(LEGACY_SCRATCH_PROJECT_OPTIONS_ADAPTER_ID, 'ngvge.legacy-scratch-project-options-adapter@1');
    assert.match(vmListener, /installLegacyRuntimeSettingsCompatibilityService\(this\.props\.vm\)/);
    assert.match(compatibilitySource, /Object\.defineProperty\(runtime, 'parseProjectOptions'/);
    assert.match(compatibilitySource, /Object\.defineProperty\(runtime, 'storeProjectOptions'/);
    assert.match(compatibilitySource, /importLegacyProjectOptionsFromRuntime/);
    pass('LRC3-DOD-01', [
        'The Host installs ngvge.legacy-scratch-project-options-adapter@1 before project use and shadows',
        'runtime.parseProjectOptions with compatibility import rather than the Scratch-owned mixed setter parser.'
    ].join(' '));

    const allKnown = createLegacyProjectOptionsMigrationPlan({
        framerate: 60,
        height: 360,
        hq: true,
        interpolation: true,
        opsPerFrame: 2,
        runtimeOptions: {
            fencing: false,
            maxClones: Infinity,
            miscLimits: false,
            offscreenDrawableCulling: true
        },
        turbo: true,
        width: 640
    });
    const expectedPaths = [
        'framerate',
        'opsPerFrame',
        'turbo',
        'interpolation',
        'runtimeOptions.maxClones',
        'runtimeOptions.fencing',
        'runtimeOptions.miscLimits',
        'runtimeOptions.offscreenDrawableCulling',
        'hq',
        'width',
        'height'
    ];
    expectedPaths.forEach(legacyPath => {
        assert(
            allKnown.records.some(record => record.legacyPath === legacyPath),
            `Missing Legacy migration record for ${legacyPath}`
        );
    });
    assert(
        allKnown.records.some(record => record.legacyPath === 'width' &&
            record.owner === LEGACY_PROJECT_VIEWPORT_COMPATIBILITY_ID)
    );
    pass('LRC3-DOD-02', 'All frozen _twconfig_ fields produce explicit migration records and owner classification.');

    const unknown = createLegacyProjectOptionsMigrationPlan({
        futureLegacyFlag: true,
        runtimeOptions: {futureRuntimeFlag: true}
    });
    assert.strictEqual(unknown.records.length, 2);
    assert(unknown.records.every(record => record.status === 'unsupported'));
    assert.strictEqual(unknown.diagnostics.length, 2);
    assert(unknown.diagnostics.every(diagnostic => diagnostic.severity === 'error'));
    pass('LRC3-DOD-03', 'Unknown top-level and runtimeOptions fields emit error diagnostics and unsupported records.');

    assert(
        LEGACY_RUNTIME_PRECEDENCE.NATIVE_PROJECT > LEGACY_RUNTIME_PRECEDENCE.LEGACY_PROJECT_IMPORT &&
        LEGACY_RUNTIME_PRECEDENCE.LEGACY_PROJECT_IMPORT > LEGACY_RUNTIME_PRECEDENCE.EXPLICIT_SESSION_OVERRIDE &&
        LEGACY_RUNTIME_PRECEDENCE.EXPLICIT_SESSION_OVERRIDE > LEGACY_RUNTIME_PRECEDENCE.WORKSPACE_DEVICE &&
        LEGACY_RUNTIME_PRECEDENCE.WORKSPACE_DEVICE > LEGACY_RUNTIME_PRECEDENCE.BACKEND_AUTOMATIC
    );
    const precedenceVM = createFakeVM();
    const precedenceService = installLegacyRuntimeSettingsCompatibilityService(precedenceVM);
    precedenceService.setFramerate(144, LEGACY_RUNTIME_SOURCE_IDS.URL_SESSION);
    precedenceService.importLegacyProjectOptions({framerate: 60});
    precedenceService.setFramerate(120, LEGACY_RUNTIME_SOURCE_IDS.URL_SESSION);
    assert.strictEqual(precedenceVM.runtime.frameLoop.framerate, 60);
    precedenceService.importLegacyProjectOptions({});
    assert.strictEqual(precedenceVM.runtime.frameLoop.framerate, 120);
    pass('LRC3-DOD-04', [
        'Precedence is explicit per semantic key: Native Project > Legacy Project Import > Session >',
        'Workspace/Device > Backend; lower-level intent resumes when a higher project claim is removed.'
    ].join(' '));

    const ingressFiles = [
        'src/lib/tw-state-manager-hoc.jsx',
        'src/containers/controls.jsx',
        'src/containers/tw-framerate-changer.jsx',
        'src/containers/turbo-mode.jsx',
        'src/containers/blocks.jsx'
    ];
    const forbiddenIngressPatterns = [
        /\b(?:this\.props\.)?vm\.setFramerate\s*\(/,
        /\b(?:this\.props\.)?vm\.setInterpolation\s*\(/,
        /\b(?:this\.props\.)?vm\.setRuntimeOptions\s*\(/,
        /\b(?:this\.props\.)?vm\.setTurboMode\s*\(/,
        /\b(?:this\.props\.)?vm\.setCompilerOptions\s*\(/,
        /\b(?:this\.props\.)?vm\.setOpsPerFrame\s*\(/,
        /\b(?:this\.props\.)?vm\.setStageSize\s*\(/,
        /\b(?:this\.props\.)?vm\.storeProjectOptions\s*\(/,
        /\b(?:this\.props\.)?vm\.renderer\.setUseHighQualityRender\s*\(/
    ];
    ingressFiles.forEach(relativePath => {
        const source = read(relativePath);
        assert.match(source, /installLegacyRuntimeSettingsCompatibilityService/);
        forbiddenIngressPatterns.forEach(pattern => assert.doesNotMatch(source, pattern));
    });
    assert.match(read('src/lib/tw-state-manager-hoc.jsx'), /fps <= 0/);
    assert.match(read('src/lib/tw-state-manager-hoc.jsx'), /clones <= 0/);
    pass('LRC3-DOD-05', 'URL, Green Flag, FPS, Turbo and Blocks ingress no longer own LRC-3 Runtime writers.');

    assert.strictEqual(RUNTIME_POLICY_SET_TYPE_ID, 'ngvge.runtime-policy-set');
    assert.strictEqual(RUNTIME_POLICY_SET_SCHEMA_VERSION, 1);
    const contractSource = read('src/lib/runtime-policy/runtime-policy-contract.js');
    assert.match(contractSource, /opsPerFrame/);
    assert.match(contractSource, /miscLimits/);
    assert.match(contractSource, /stageWidth/);
    assert.match(contractSource, /stageHeight/);
    pass('LRC3-DOD-06', [
        'LRC-3 consumes frozen Runtime Policy v1; Legacy mixed fields remain forbidden,',
        'not added to Schema.'
    ].join(' '));

    assert.strictEqual(allKnown.sourceValues['legacy.scheduler.opsPerFrame'], 2);
    assert.strictEqual(allKnown.sourceValues['project.viewport.width'], 640);
    assert.strictEqual(allKnown.sourceValues['project.viewport.height'], 360);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(allKnown.sourceValues, 'opsPerFrame'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(allKnown.sourceValues, 'stageWidth'), false);
    pass('LRC3-DOD-07', [
        'OpsPerFrame stays in scheduler quarantine and stage geometry routes to',
        'viewport compatibility ownership.'
    ].join(' '));

    const cloneVM = createFakeVM();
    const cloneService = installLegacyRuntimeSettingsCompatibilityService(cloneVM);
    cloneService.importLegacyProjectOptions({runtimeOptions: {maxClones: Infinity}});
    const clonePolicy = cloneVM.runtime.ngvgeRuntimePolicy.getSnapshot();
    assert.strictEqual(clonePolicy.safety.cloneBudget.mode, 'legacy-unbounded-request');
    assert.strictEqual(clonePolicy.safety.cloneBudget.requestedLimit, null);
    assert(Number.isFinite(cloneVM.runtime.runtimeOptions.maxClones));
    assert(cloneVM.runtime.runtimeOptions.maxClones <= clonePolicy.safety.cloneBudget.hostHardCeiling);
    pass('LRC3-DOD-08', [
        'Legacy Infinity is preserved as compatibility intent but backend authority',
        'remains Host-bounded.'
    ].join(' '));

    const sourceFiles = fs.readdirSync(path.join(ROOT, 'src'), {recursive: true})
        .filter(file => typeof file === 'string' && /\.(?:js|jsx)$/.test(file));
    const activeStoreCalls = sourceFiles.filter(relative => {
        const text = read(path.join('src', relative));
        return /\b(?:this\.props\.)?vm\.storeProjectOptions\s*\(/.test(text);
    });
    assert.deepStrictEqual(activeStoreCalls, []);
    assert.match(compatibilitySource, /explicitLegacyExport:\s*true/);
    assert.match(compatibilitySource, /exportLegacyProjectOptionsToProject/);
    pass('LRC3-DOD-09', [
        'Native mutation does not regenerate _twconfig_; only explicit compatibility',
        'export can write it.'
    ].join(' '));

    const packageJson = JSON.parse(read('package.json'));
    const scripts = packageJson.scripts || {};
    assert.match(scripts['test:legacy-containment:lrc3-adapter'] || '', /lrc2-certification/);
    assert.match(
        scripts['test:legacy-containment:lrc3-adapter'] || '',
        /validate-lrc3-legacy-runtime-settings-compatibility/
    );
    assert.match(
        scripts['test:legacy-containment:lrc3-adapter'] || '',
        /legacy-runtime-settings-compatibility\.test/
    );
    assert.match(scripts['test:legacy-containment:lrc3'] || '', /lrc3-adapter/);
    assert.match(
        scripts['test:legacy-containment:lrc3'] || '',
        /validate-lrc3-webpack-editor-entry/
    );
    pass('LRC3-DOD-10', [
        'Package scripts preserve cumulative LRC-2 certification and add focused +',
        'real Webpack editor-entry LRC-3 gates.'
    ].join(' '));

    const evidenceByRequirement = new Map(evidence.map(item => [item.requirementId, item]));
    REQUIREMENTS.forEach(requirement => {
        assert(evidenceByRequirement.has(requirement.id), `Missing LRC-3 evidence: ${requirement.id}`);
    });
    assert.strictEqual(evidence.length, REQUIREMENTS.length);

    return Object.freeze({
        evidence: Object.freeze(evidence.slice()),
        requirements: REQUIREMENTS,
        requirementsChecked: REQUIREMENTS.length,
        requirementsPassed: evidence.length,
        schema: 'ngvge-lrc3-legacy-runtime-settings-compatibility-certificate/v1',
        status: 'PASS'
    });
};

if (require.main === module) {
    const result = certify();
    const summary = [
        'LRC-3 Legacy Runtime Settings Compatibility Certification: PASS',
        `${result.requirementsPassed}/${result.requirementsChecked}`
    ].join(' ');
    process.stdout.write(`${summary}\n`);
    result.evidence.forEach(item => process.stdout.write(`- ${item.requirementId}: PASS — ${item.detail}\n`));
}

module.exports = {
    REQUIREMENTS,
    certify
};
