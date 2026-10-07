#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const VM = require('scratch-vm');

const {
    PROJECT_LIFECYCLE_AUTHORITY_ID,
    PROJECT_LIFECYCLE_CLIENT_ID,
    PROJECT_LIFECYCLE_DOMAIN_ID,
    PROJECT_LIFECYCLE_HOST_ID,
    createProjectLifecycleHost,
    installProjectLifecycleHost
} = require('../src/lib/project-lifecycle');
const {createBlankSceneProjectJSON} = require('../src/lib/scene-system/blank-scene-project');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_ROOT = path.join(ROOT, 'src');
const evidence = [];
const pass = (requirementId, detail) => evidence.push(Object.freeze({detail, requirementId, status: 'PASS'}));
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

const walk = directory => fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return [absolute];
});

const collectLifecycleFacadeAssignments = () => {
    const assignments = [];
    const names = 'loadProject|deserializeProject|toJSON|serializeAssets|saveProjectSb3|saveProjectSb3DontZip';
    for (const file of walk(SOURCE_ROOT)) {
        if (!/\.(js|jsx|ts|tsx)$/.test(file)) continue;
        const relative = path.relative(ROOT, file).replace(/\\/g, '/');
        const text = fs.readFileSync(file, 'utf8');
        const pattern = new RegExp(`(?:\\bvm|this\\.vm|this\\.props\\.vm)\\.(${names})\\s*=(?!=)`, 'g');
        let match;
        while ((match = pattern.exec(text))) assignments.push(`${relative}:${match[1]}`);
    }
    return assignments;
};

const captureLifecycleEvents = host => {
    const events = [];
    const unsubscribe = host.subscribe(event => {
        const active = event.state.activeOperation;
        events.push({
            active: active ? Object.assign({}, active) : null,
            generation: event.state.projectGeneration,
            phase: event.state.phase,
            type: event.type
        });
    });
    return {events, unsubscribe};
};

const assertNestedRoot = (events, rootKind, nestedKinds) => {
    const rootStart = events.find(event => (
        event.type === 'operation:start' &&
        event.active &&
        event.active.kind === rootKind &&
        event.active.nested === false
    ));
    assert(rootStart, `Expected root ${rootKind} operation.`);
    nestedKinds.forEach(kind => {
        const nested = events.find(event => (
            event.type === 'operation:start' &&
            event.active &&
            event.active.kind === kind &&
            event.active.nested === true
        ));
        assert(nested, `Expected nested ${kind} operation under ${rootKind}.`);
        assert.strictEqual(nested.active.rootId, rootStart.active.rootId);
        assert.strictEqual(nested.active.rootKind, rootKind);
    });
    return rootStart;
};

const certify = async () => {
    const lpl1Certificate = JSON.parse(read('docs/architecture/project-lifecycle/LPL-1-CERTIFICATE.json'));
    const lrcG1Certificate = JSON.parse(read('docs/architecture/legacy-runtime/LRC-G1-CERTIFICATE.json'));
    const col0Certificate = JSON.parse(read('docs/architecture/collaboration/COL-0-CERTIFICATE.json'));
    assert.strictEqual(lpl1Certificate.status, 'COMPLETE / VERIFIED');
    assert.strictEqual(lrcG1Certificate.status, 'PASS / CERTIFIED');
    assert.strictEqual(col0Certificate.status, 'COMPLETE / VERIFIED');
    pass('LPL-G1-01', 'LRC-G1, LPL-1 and current COL-0 consumer state are verified prerequisites.');

    assert.strictEqual(PROJECT_LIFECYCLE_HOST_ID, 'ngvge.project-lifecycle-host@1');
    assert.strictEqual(PROJECT_LIFECYCLE_CLIENT_ID, 'ngvge.project-lifecycle-client@1');
    assert.strictEqual(PROJECT_LIFECYCLE_DOMAIN_ID, 'ngvge.project.lifecycle');
    assert.strictEqual(PROJECT_LIFECYCLE_AUTHORITY_ID, 'authority:ngvge.project-lifecycle-host');
    pass('LPL-G1-02', 'Project Lifecycle stable identities and Writer Authority remain NGVGE-owned.');

    const assignments = collectLifecycleFacadeAssignments();
    assert.strictEqual(assignments.length, 6);
    assert(assignments.every(record => record.startsWith('src/lib/project-lifecycle/project-lifecycle-host.js:')));
    pass('LPL-G1-03', 'Only Project Lifecycle Host assigns the six public VM lifecycle facade methods.');

    const hostSource = read('src/lib/project-lifecycle/project-lifecycle-host.js');
    assert(hostSource.includes('getState: host.getState'));
    assert(!hostSource.includes('loadProject: host.loadProject,'));
    assert(!hostSource.includes('serializeProjectJSON: host.serializeProjectJSON,'));
    assert(!hostSource.includes('backend: backend'));
    assert(!hostSource.includes('vm: vm'));
    pass('LPL-G1-04', 'Runtime-visible facade remains diagnostics-only and does not publish mutation/backend handles.');

    const persistence = read('src/lib/project-inspector/project-persistence.js');
    const assets = read('src/lib/project-assets/global-asset-database.js');
    const nodes = read('src/lib/project-nodes/node-database.js');
    const modules = read('src/lib/first-party-modules/runtime-integration.js');
    assert(persistence.includes('afterSerializeProjectJSON') && persistence.includes('beforeDeserialize'));
    assert(assets.includes('afterSerializeAssets') && assets.includes('beforeLoad'));
    assert(nodes.includes('ngvge.project-lifecycle.node-database@1') && nodes.includes('beforeLoad'));
    assert(modules.includes('ngvge.project-lifecycle.first-party-modules@1') && modules.includes('beforeLoad'));
    pass('LPL-G1-05', 'Persistence, Assets, Nodes and Module Framework extend lifecycle only through Host hooks.');

    const projectIO = read('src/lib/first-party-modules/vm-project-io-service.js');
    const collaborationSync = read('src/lib/collaboration/sync-manager.js');
    assert(projectIO.includes('lifecycle.deserializeProject'));
    assert(projectIO.includes('lifecycle.saveProjectSb3DontZip'));
    assert(collaborationSync.includes('installProjectLifecycleHost(service.vm).loadProject(projectData)'));
    pass('LPL-G1-06', 'Scene/portable Project I/O and COL-0 project sync consume the same Host lifecycle seam.');

    const vm = new VM();
    const host = installProjectLifecycleHost(vm);
    const secondInstall = installProjectLifecycleHost(vm);
    host.registerHook({
        afterSerializeProjectJSON: (context, serialized) => {
            const json = JSON.parse(serialized);
            json.lplG1Certification = {rootKind: context.rootKind};
            return JSON.stringify(json);
        },
        id: 'ngvge.lpl-g1.serialization-composition@1',
        priority: 1000
    });
    assert.strictEqual(secondInstall, host);
    const observedLoad = captureLifecycleEvents(host);
    await vm.loadProject(createBlankSceneProjectJSON({stageName: 'LPL-G1 Stage'}));
    observedLoad.unsubscribe();
    const loadRoot = assertNestedRoot(observedLoad.events, 'load', ['deserialize']);
    assert.strictEqual(host.getState().projectGeneration, 1);
    const loadComplete = observedLoad.events.filter(event => (
        event.type === 'operation:complete' && event.active === null
    ));
    assert.strictEqual(loadComplete.length, 1);
    assert.strictEqual(loadRoot.active.rootId, loadRoot.active.id);
    pass(
        'LPL-G1-07',
        'Real Scratch loadProject creates one root generation and nests deserialize under the same root.'
    );

    const observedFiles = captureLifecycleEvents(host);
    const files = vm.saveProjectSb3DontZip();
    observedFiles.unsubscribe();
    assert(files['project.json']);
    assertNestedRoot(observedFiles.events, 'serialize-files', ['serialize-json', 'serialize-assets']);
    assert.strictEqual(host.getState().projectGeneration, 1);
    pass('LPL-G1-08', 'File serialization nests project JSON and asset serialization under one serialize-files root.');

    const observedArchive = captureLifecycleEvents(host);
    const archive = await vm.saveProjectSb3();
    observedArchive.unsubscribe();
    assert(archive);
    assertNestedRoot(observedArchive.events, 'serialize-archive', ['serialize-json', 'serialize-assets']);
    assert.strictEqual(host.getState().projectGeneration, 1);
    pass(
        'LPL-G1-09',
        'Archive serialization nests project JSON/assets under one serialize-archive root without changing generation.'
    );

    const serializedJSON = JSON.parse(vm.toJSON());
    assert.strictEqual(serializedJSON.lplG1Certification.rootKind, 'serialize-json');
    const serializedFilesJSON = JSON.parse(Buffer.from(files['project.json']).toString('utf8'));
    assert.strictEqual(serializedFilesJSON.lplG1Certification.rootKind, 'serialize-files');
    pass(
        'LPL-G1-10',
        'Project JSON transforms compose through the Host for direct JSON and nested file serialization contexts.'
    );

    const failedVM = {runtime: {}};
    const failedHost = createProjectLifecycleHost(failedVM, {
        loadProject: () => {
            const error = new Error('Synthetic backend load failure');
            error.code = 'LPL_G1_SYNTHETIC_LOAD_FAILURE';
            return Promise.reject(error);
        }
    });
    await assert.rejects(
        () => failedHost.loadProject({}),
        error => error && error.code === 'LPL_G1_SYNTHETIC_LOAD_FAILURE'
    );
    const failedState = failedHost.getState();
    assert.strictEqual(failedState.phase, 'idle');
    assert.strictEqual(failedState.projectGeneration, 0);
    assert.strictEqual(failedState.failedOperationCount, 1);
    assert.strictEqual(failedState.lastFailedOperation.kind, 'load');
    pass('LPL-G1-11', 'Failed root load returns Host to idle, records failure and never advances projectGeneration.');

    const syncVM = {runtime: {}};
    const syncHost = createProjectLifecycleHost(syncVM, {toJSON: () => '{}'});
    syncHost.registerHook({
        afterSerializeProjectJSON: value => Promise.resolve(value),
        id: 'ngvge.lpl-g1.async-sync-hook-test@1'
    });
    assert.throws(
        () => syncHost.serializeProjectJSON(),
        error => error && error.code === 'PROJECT_LIFECYCLE_ASYNC_SYNC_HOOK'
    );
    assert.strictEqual(syncHost.getState().phase, 'idle');
    assert.strictEqual(syncHost.getState().failedOperationCount, 1);
    pass(
        'LPL-G1-12',
        'Synchronous serialization rejects Promise hooks fail-visibly instead of changing API semantics.'
    );

    const hookOrder = [];
    const hookVM = {runtime: {}};
    const hookHost = createProjectLifecycleHost(hookVM, {toJSON: () => '{}'});
    hookHost.registerHook({
        afterSerializeProjectJSON: (context, value) => {
            hookOrder.push('late');
            return value;
        },
        id: 'ngvge.lpl-g1.hook-late@1',
        priority: 20
    });
    hookHost.registerHook({
        afterSerializeProjectJSON: (context, value) => {
            hookOrder.push('early');
            return value;
        },
        id: 'ngvge.lpl-g1.hook-early@1',
        priority: 10
    });
    hookHost.serializeProjectJSON();
    assert.deepStrictEqual(hookOrder, ['early', 'late']);
    pass(
        'LPL-G1-13',
        'Lifecycle hook order is deterministic by priority and stable id rather than wrapper installation order.'
    );

    const backendCalls = [];
    const seamVM = {runtime: {}};
    const seamHost = createProjectLifecycleHost(seamVM, {
        serializeAssets: () => {
            backendCalls.push('serializeAssets');
            return ['asset'];
        },
        toJSON: () => {
            backendCalls.push('toJSON');
            return '{}';
        }
    });
    assert.deepStrictEqual(seamHost.serializeAssets(), ['asset']);
    assert.strictEqual(seamHost.serializeProjectJSON(), '{}');
    assert.deepStrictEqual(backendCalls, ['serializeAssets', 'toJSON']);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(seamHost, 'backend'), false);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(seamHost, 'vm'), false);
    pass(
        'LPL-G1-14',
        'Project Lifecycle Host consumes a replaceable backend seam without exporting backend identity.'
    );

    const runtimeFacade = vm.runtime.ngvgeProjectLifecycleHost;
    assert(runtimeFacade);
    assert.strictEqual(runtimeFacade.hostId, PROJECT_LIFECYCLE_HOST_ID);
    assert.strictEqual(typeof runtimeFacade.getState, 'function');
    assert.strictEqual(typeof runtimeFacade.loadProject, 'undefined');
    assert.strictEqual(typeof runtimeFacade.serializeAssets, 'undefined');
    pass('LPL-G1-15', 'Runtime diagnostics can observe lifecycle state but cannot invoke lifecycle mutations.');

    const projectSaver = read('src/lib/project-saver-hoc.jsx');
    assert(projectSaver.includes('this.props.vm.toJSON()'));
    assert(assignments.every(record => !record.startsWith('src/lib/project-saver-hoc.jsx:')));
    pass(
        'LPL-G1-16',
        'Legacy GUI callers remain compatibility consumers; calling vm.* does not confer facade ownership.'
    );

    const packageJSON = JSON.parse(read('package.json'));
    assert(packageJSON.scripts['test:project-lifecycle:lpl-g1-certification']);
    assert(packageJSON.scripts['test:project-lifecycle:lpl-g1-webpack']);
    assert(packageJSON.scripts['test:project-lifecycle:lpl-g1']);
    pass('LPL-G1-17', 'Focused, production-entry and cumulative Project Lifecycle G1 gates are registered.');

    return evidence;
};

certify()
    .then(result => {
        result.forEach(item => console.log(`PASS ${item.requirementId} - ${item.detail}`));
        console.log(
            `\nLPL-G1 Project Lifecycle Consolidation Certification: ${result.length}/${result.length} PASS`
        );
    })
    .catch(error => {
        console.error(`FAIL LPL-G1 - ${error.stack || error.message}`);
        process.exit(1);
    });
