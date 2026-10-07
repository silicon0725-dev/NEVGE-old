#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const sourceRoot = path.join(root, 'src');

const walk = directory => fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return [absolute];
});

const checks = [];
const check = (name, pass, detail) => checks.push({detail, name, pass: Boolean(pass)});

const hostPath = 'src/lib/project-lifecycle/project-lifecycle-host.js';
const host = read(hostPath);
const authority = read('src/lib/project-lifecycle/project-lifecycle-authority.js');
const vmListener = read('src/lib/vm-listener-hoc.jsx');
const persistence = read('src/lib/project-inspector/project-persistence.js');
const assets = read('src/lib/project-assets/global-asset-database.js');
const nodes = read('src/lib/project-nodes/node-database.js');
const modules = read('src/lib/first-party-modules/runtime-integration.js');
const collaboration = read('src/lib/collaboration-service.js');
const projectIO = read('src/lib/first-party-modules/vm-project-io-service.js');

check(
    'stable lifecycle host identity',
    host.includes('ngvge.project-lifecycle-host@1') && host.includes('ngvge.project-lifecycle-client@1'),
    'Host/client identity v1 is explicit.'
);
check(
    'single Project Lifecycle writer authority',
    authority.includes("PROJECT_LIFECYCLE_DOMAIN_ID = 'ngvge.project.lifecycle'") &&
        authority.includes("PROJECT_LIFECYCLE_AUTHORITY_ID = 'authority:ngvge.project-lifecycle-host'") &&
        authority.includes('mode: AUTHORITY_MODES.WRITER'),
    'Project lifecycle owns one explicit NGVGE Writer Authority registration.'
);
check(
    'single VM facade owner',
    ['loadProject', 'deserializeProject', 'toJSON', 'serializeAssets', 'saveProjectSb3', 'saveProjectSb3DontZip']
        .every(name => host.includes(`vm.${name} =`)),
    'Project lifecycle VM facade mutations are centralized in project-lifecycle-host.js.'
);

const assignments = [];
for (const file of walk(sourceRoot)) {
    if (!/\.(js|jsx|ts|tsx)$/.test(file)) continue;
    const relative = path.relative(root, file).replace(/\\/g, '/');
    const text = fs.readFileSync(file, 'utf8');
    const pattern = new RegExp(
        '(?:\\bvm|this\\.vm|this\\.props\\.vm)\\.' +
        '(loadProject|deserializeProject|toJSON|serializeAssets|saveProjectSb3|saveProjectSb3DontZip)\\s*=(?!=)',
        'g'
    );
    let match;
    while ((match = pattern.exec(text))) assignments.push(`${relative}:${match[1]}`);
}
check(
    'no secondary lifecycle monkey patches',
    assignments.length === 6 && assignments.every(record => record.startsWith(`${hostPath}:`)),
    assignments.length ? assignments.join(', ') : 'No lifecycle facade assignments found.'
);

check(
    'host installs before lifecycle participants',
    vmListener.indexOf('            installProjectLifecycleHost(this.props.vm);') !== -1 &&
        vmListener.indexOf('            installProjectLifecycleHost(this.props.vm);') <
            vmListener.indexOf('            installGlobalAssetDatabase(this.props.vm);'),
    'VMListener establishes Host ownership before databases/modules/persistence register hooks.'
);
check(
    'project persistence uses lifecycle hooks',
    persistence.includes('afterSerializeProjectJSON') && persistence.includes('beforeDeserialize') &&
        persistence.includes('afterLoad') && !persistence.includes('const originalToJSON = vm.toJSON.bind(vm)'),
    'NGVGE project metadata injection/restore is a lifecycle hook, not a VM wrapper.'
);
check(
    'global assets use lifecycle hooks',
    assets.includes('afterSerializeAssets') && assets.includes('beforeLoad') &&
        !assets.includes('const originalSerializeAssets = vm.serializeAssets.bind(vm)'),
    'Global Asset Database extends serialization through Host hooks.'
);
check(
    'node database reset uses lifecycle hook',
    nodes.includes('ngvge.project-lifecycle.node-database@1') && nodes.includes('beforeLoad'),
    'Node database project reset no longer wraps vm.loadProject.'
);
check(
    'module framework reset uses lifecycle hook',
    modules.includes('ngvge.project-lifecycle.first-party-modules@1') && modules.includes('beforeLoad'),
    'First-party module project reset no longer wraps vm.loadProject.'
);
check(
    'collaboration observes lifecycle instead of owning load',
    collaboration.includes('ngvge.project-lifecycle.collaboration@1') &&
        collaboration.includes('afterLoad') && collaboration.includes('loadError') &&
        !collaboration.includes('const originalLoadProject = this.vm.loadProject.bind(this.vm)'),
    'Collaboration progress/sync behavior is observational lifecycle logic.'
);
check(
    'VM Project I/O routes through lifecycle host',
    projectIO.includes("require('../project-lifecycle')") &&
        projectIO.includes('lifecycle.deserializeProject') && projectIO.includes('lifecycle.saveProjectSb3DontZip'),
    'Scene/module portable project transport consumes Host lifecycle operations.'
);
check(
    'runtime facade is diagnostic-only',
    host.includes('getState: host.getState') &&
        !host.includes('loadProject: host.loadProject,') &&
        !host.includes('serializeProjectJSON: host.serializeProjectJSON,'),
    'runtime.ngvgeProjectLifecycleHost does not publish mutation authority.'
);
check(
    'backend handles stay private',
    !host.includes('backend: backend') && !host.includes('vm: vm'),
    'Host state/public facade does not serialize or publish Scratch VM/backend handles.'
);

const failed = checks.filter(item => !item.pass);
checks.forEach(item => console.log(`${item.pass ? 'PASS' : 'FAIL'} ${item.name} - ${item.detail}`));
console.log(`\nLPL-1 Project Lifecycle Consolidation DoD: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length) process.exit(1);
