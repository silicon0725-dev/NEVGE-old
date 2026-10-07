/* eslint-disable import/no-commonjs, no-console, strict */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const exists = relative => fs.existsSync(path.join(ROOT, relative));
const walk = relative => {
    const base = path.join(ROOT, relative);
    const out = [];
    const visit = current => {
        for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
            const target = path.join(current, entry.name);
            if (entry.isDirectory()) visit(target);
            else if (/\.(?:js|jsx|ts|tsx)$/.test(entry.name)) out.push(target);
        }
    };
    visit(base);
    return out;
};

const checks = [];
const check = (name, predicate, detail) => {
    let ok = false;
    let error = null;
    try {
        ok = Boolean(predicate());
    } catch (err) {
        error = err;
    }
    checks.push({detail: error ? error.message : detail, name, ok});
};

const constants = read('src/lib/extension-containment/constants.js');
const authority = read('src/lib/extension-containment/extension-containment-authority.js');
const containment = read('src/lib/extension-containment/extension-containment-host.js');
const scratchHost = read('src/lib/extension-containment/scratch-extension-host.js');
const legacyHost = read('src/lib/extension-containment/legacy-addon-host.js');
const addonApi = read('src/addons/api.js');
const vmManager = read('src/lib/vm-manager-hoc.jsx');
const moduleIntegration = read('src/lib/first-party-modules/runtime-integration.js');
const securityManager = read('src/containers/tw-security-manager.jsx');
const stateManager = read('src/lib/tw-state-manager-hoc.jsx');
const debtMatrixPath = 'docs/architecture/extensions/LEX-1-legacy-extension-debt-matrix.csv';
const debtMatrix = exists(debtMatrixPath) ? read(debtMatrixPath) : '';

check('Stable Extension Containment identities exist', () =>
    constants.includes("ngvge.extension-host.ngvge-module@1") &&
    constants.includes("ngvge.extension-host.scratch-extension@1") &&
    constants.includes("ngvge.extension-host.legacy-addon@1") &&
    containment.includes("ngvge.extension-containment-host@1") &&
    containment.includes("ngvge.extension-containment-client@1"),
'Stable host/client identities are present.');

check('Extension Containment has one Writer Authority', () =>
    authority.includes("ngvge.extension.containment") &&
    authority.includes("authority:ngvge.extension-containment-host") &&
    authority.includes('AUTHORITY_MODES.WRITER'),
'Authority registry owns the containment domain with one writer registration.');

check('Three runtime host kinds remain separate', () =>
    constants.includes("LEGACY_ADDON: 'legacy-addon'") &&
    constants.includes("NGVGE_MODULE: 'ngvge-module'") &&
    constants.includes("SCRATCH_EXTENSION: 'scratch-extension'"),
'NGVGE Module, Scratch Extension and Legacy Addon hosts are distinct.');

check('Runtime containment surface is read-only', () =>
    containment.includes("EXTENSION_CONTAINMENT_RUNTIME_PROPERTY = 'ngvgeExtensionContainment'") &&
    containment.includes('Object.freeze({') &&
    containment.includes('listDescriptors') &&
    containment.includes('listDiagnostics') &&
    (() => {
        const start = containment.indexOf('const client = Object.freeze');
        const end = containment.indexOf('const controller =', start);
        const clientSource = containment.slice(start, end);
        return start >= 0 && end > start &&
            !/(?:upsertDescriptor|removeDescriptor|registerHost)\s*[:(]/.test(clientSource);
    })(),
'Runtime publishes query-only containment state; mutation stays controller-private.');

check('NGVGE Module manifests project into containment descriptors', () =>
    moduleIntegration.includes('registerNgvgeModuleDefinitions(vm, builtInDefinitions)') &&
    exists('src/lib/extension-containment/ngvge-module-host.js'),
'First-party module definitions are registered without replacing Module Manager as runtime host.');

check('Legacy Addon raw VM is an explicit quarantine lease', () =>
    addonApi.includes('installLegacyAddonHost(vm).acquireLegacyVM(addonId, addonManifest)') &&
    legacyHost.includes('LEGACY_RAW_VM_QUARANTINE') &&
    legacyHost.includes('LEX_LEGACY_RAW_VM') &&
    legacyHost.includes('LEX_LEGACY_RAW_VM_DENIED'),
'Raw VM access is explicit, diagnostic and denyable.');

check('Custom/untrusted Legacy Addons cannot acquire raw VM', () =>
    legacyHost.includes("manifest.tags.includes('custom')") &&
    legacyHost.includes("error.code = 'LEX_LEGACY_RAW_VM_DENIED'"),
'Custom manifests are denied the raw VM quarantine capability.');

check('Legacy Addon DOM bridge is no longer a window global', () => {
    const sourceFiles = walk('src');
    return sourceFiles.every(file => !fs.readFileSync(file, 'utf8').includes('window.addonAPI')) &&
        addonApi.includes('registerLegacyAddonDomBridge(legacyAddonDomAPI)');
}, 'No source file exposes window.addonAPI; remount support uses the module bridge.');

check('Raw window.vm is forbidden in production', () =>
    vmManager.includes("process.env.NODE_ENV !== 'production'") &&
    vmManager.includes('window.vm = this.props.vm') &&
    vmManager.includes('delete window.vm'),
'Raw window.vm exists only as a non-production diagnostics seam.');

check('Normal GUI does not touch Scratch ExtensionManager private/load authority', () => {
    const files = [...walk('src/containers'), ...walk('src/components')];
    const forbidden = /(?:_loadedExtensions|extensionManager\.(?:loadExtensionURL|refreshBlocks)|extensionManager\.securityManager)/;
    return files.every(file => !forbidden.test(fs.readFileSync(file, 'utf8')));
}, 'Containers/components route ExtensionManager mutation/private state through the Scratch Extension Host.');

check('Scratch Extension Host contains backend-private extension state', () =>
    scratchHost.includes('extensionManager._loadedExtensions') &&
    scratchHost.includes('loadExtensionURL') &&
    scratchHost.includes('unloadExtension') &&
    scratchHost.includes('configureSecurityManager'),
'Backend-private Scratch extension operations are localized in one host.');

check('Security and legacy URL extension ingress use Scratch Extension Host', () =>
    securityManager.includes('installScratchExtensionHost') &&
    securityManager.includes('configureSecurityManager') &&
    stateManager.includes('installScratchExtensionHost') &&
    stateManager.includes('loadExtensionURL'),
'Security configuration and URL extension loading are routed through the host.');

check('Remaining direct extension debt is fail-visible and assigned', () => {
    const required = [
        'src/addons/addons/02agent/tools.ts',
        'src/addons/addons/load-extensions/userscript.js',
        'src/lib/collaboration/asset-events.js',
        'src/lib/collaboration/sync-manager.js',
        'src/lib/collaboration-service.js',
        'src/lib/extension-debug.js',
        'window.vm'
    ];
    return required.every(item => debtMatrix.includes(item));
}, 'Known Legacy/Collaboration/Developer extension debts are recorded with owners instead of hidden.');


const packageJSON = JSON.parse(read('package.json'));
check('LEX-1 focused/certification/Webpack gates are registered', () =>
    typeof packageJSON.scripts['test:extension-containment:lex1'] === 'string' &&
    typeof packageJSON.scripts['test:extension-containment:lex1-certification'] === 'string' &&
    typeof packageJSON.scripts['test:extension-containment:lex1-webpack'] === 'string' &&
    packageJSON.scripts['test:extension-containment:lex1-webpack'].includes('validate-lrc4-webpack-editor-entry.js'),
'Focused, cumulative and real Editor Webpack entry gates are repeatable from package scripts.');

const passed = checks.filter(item => item.ok).length;
for (const item of checks) {
    console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
}
console.log(`\nLEX-1 Machine DoD: ${passed}/${checks.length} PASS`);
if (passed !== checks.length) process.exitCode = 1;
