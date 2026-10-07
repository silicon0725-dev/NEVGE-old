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
const moduleHost = read('src/lib/extension-containment/ngvge-module-host.js');
const addonApi = read('src/addons/api.js');
const loadExtensions = read('src/addons/addons/load-extensions/userscript.js');
const loadExtensionsManifest = read('src/addons/addons/load-extensions/_manifest_entry.js');
const gui = read('src/containers/gui.jsx');
const vmManager = read('src/lib/vm-manager-hoc.jsx');
const collaborationService = read('src/lib/collaboration-service.js');
const collaborationSync = read('src/lib/collaboration/sync-manager.js');
const collaborationAssets = read('src/lib/collaboration/asset-events.js');
const debtMatrix = read('docs/architecture/extensions/LEX-1-legacy-extension-debt-matrix.csv');
const packageJSON = JSON.parse(read('package.json'));
const certificate = JSON.parse(read('docs/architecture/extensions/LEX-G1-CERTIFICATE.json'));

check('LEX-1 implementation and LPL-G1 prerequisite records exist', () =>
    exists('docs/architecture/extensions/LEX-1-CERTIFICATE.json') &&
    exists('docs/architecture/project-lifecycle/LPL-G1-CERTIFICATE.json'),
'LEX-G1 certifies an existing verified containment implementation on the certified project lifecycle baseline.');

check('LEX-G1 machine certificate declares the certified v1 containment identities', () =>
    exists('docs/architecture/extensions/LEX-G1-EXTENSION-ADDONS-CONTAINMENT-CERTIFICATION.md') &&
    certificate.gate === 'LEX-G1' && certificate.status === 'PASS / CERTIFIED' &&
    certificate.identities && certificate.identities.containmentHost === 'ngvge.extension-containment-host@1' &&
    certificate.identities.authorityDomain === 'ngvge.extension.containment' &&
    certificate.identities.writerAuthority === 'authority:ngvge.extension-containment-host' &&
    certificate.machineCertification && certificate.machineCertification.total === 19,
'The signed certificate is present and names the same stable containment identity/authority certified by code.');

check('Extension containment stable identities remain version 1', () =>
    constants.includes('EXTENSION_CONTAINMENT_VERSION = 1') &&
    containment.includes("ngvge.extension-containment-host@1") &&
    containment.includes("ngvge.extension-containment-client@1") &&
    constants.includes("ngvge.extension-host.ngvge-module@1") &&
    constants.includes("ngvge.extension-host.scratch-extension@1") &&
    constants.includes("ngvge.extension-host.legacy-addon@1"),
'LEX-G1 certifies the LEX-1 stable identities without replacing them.');

check('Extension containment domain has exactly one writer authority', () =>
    authority.includes("ngvge.extension.containment") &&
    authority.includes("authority:ngvge.extension-containment-host") &&
    authority.includes('AUTHORITY_MODES.WRITER'),
'The containment host remains the single writer authority.');

check('Three runtime hosts remain separate', () =>
    constants.includes("LEGACY_ADDON: 'legacy-addon'") &&
    constants.includes("NGVGE_MODULE: 'ngvge-module'") &&
    constants.includes("SCRATCH_EXTENSION: 'scratch-extension'") &&
    moduleHost.includes('EXTENSION_HOST_IDS.NGVGE_MODULE') &&
    scratchHost.includes('EXTENSION_HOST_IDS.SCRATCH_EXTENSION') &&
    legacyHost.includes('EXTENSION_HOST_IDS.LEGACY_ADDON'),
'Discovery can be unified later, but runtime hosts remain distinct.');

check('Runtime containment client is query-only and backend-handle-free', () => {
    const start = containment.indexOf('const client = Object.freeze');
    const end = containment.indexOf('const controller =', start);
    const clientSource = containment.slice(start, end);
    return start >= 0 && end > start &&
        clientSource.includes('listDescriptors') && clientSource.includes('listDiagnostics') &&
        !/(?:upsertDescriptor|removeDescriptor|registerHost)\s*[:(]/.test(clientSource) &&
        !/\b(?:vm|renderer|extensionManager)\s*:/.test(clientSource);
}, 'Runtime consumers receive immutable diagnostics/descriptors, not mutation/backend authority.');

check('Scratch Extension Host contains private/load/security backend access', () =>
    scratchHost.includes('extensionManager._loadedExtensions') &&
    scratchHost.includes('extensionManager.loadExtensionURL') &&
    scratchHost.includes('extensionManager.loadExtensionIdSync') &&
    scratchHost.includes('extensionManager.securityManager') &&
    scratchHost.includes('extensionManager.reorderExtension'),
'Scratch backend-private extension operations remain localized in the Scratch Extension Host.');

check('Normal GUI does not directly own Scratch ExtensionManager private/load authority', () => {
    const files = [...walk('src/containers'), ...walk('src/components')];
    const forbidden = /(?:_loadedExtensions|extensionManager\.(?:loadExtensionURL|loadExtensionIdSync|refreshBlocks|reorderExtension)|extensionManager\.securityManager)/;
    return files.every(file => !forbidden.test(fs.readFileSync(file, 'utf8')));
}, 'Containers/components consume the Scratch Extension Host instead of backend-private APIs.');

check('COL-0 does not reopen ExtensionManager authority', () => {
    const combined = [collaborationService, collaborationSync, collaborationAssets].join('\n');
    return !/(?:_loadedExtensions|extensionManager\.(?:loadExtensionURL|loadExtensionIdSync|refreshBlocks|reorderExtension))/.test(combined) &&
        combined.includes('installScratchExtensionHost');
}, 'Collaboration observes/uses the Scratch Extension Host and does not monkey-patch or directly mutate ExtensionManager.');

check('LEX-D002 uses a declared built-in Scratch-extension capability', () =>
    constants.includes("legacy-addon.scratch-extension.load-built-in") &&
    loadExtensionsManifest.includes('legacy-addon.scratch-extension.load-built-in') &&
    loadExtensions.includes('addon.tab.capabilities.scratchExtensions') &&
    loadExtensions.includes('scratchExtensions.loadBuiltIn') &&
    !loadExtensions.includes('traps.vm') &&
    !loadExtensions.includes('extensionManager') &&
    debtMatrix.includes('LEX-D002') && debtMatrix.includes('LEX-D002,src/addons/addons/load-extensions/userscript.js') &&
    debtMatrix.includes('CONTAINED,Legacy Addon Capability + Scratch Extension Host'),
'Legacy automatic extension loading no longer requires raw VM/ExtensionManager access.');

check('Declared Legacy Scratch-extension capability is deny-by-default and built-in-only', () =>
    legacyHost.includes('LEX_LEGACY_CAPABILITY_UNDECLARED') &&
    legacyHost.includes('LEX_LEGACY_EXTENSION_BUILTIN_ONLY') &&
    legacyHost.includes('acquireScratchExtensionCapability') &&
    addonApi.includes('acquireScratchExtensionCapability(addonId, addonManifest)'),
'Only explicitly declared bundled legacy capability can load built-in Scratch extensions.');

check('Legacy raw VM remains explicit quarantine and custom addons are denied', () =>
    addonApi.includes('acquireLegacyVM(addonId, addonManifest)') &&
    legacyHost.includes('LEGACY_RAW_VM_QUARANTINE') &&
    legacyHost.includes('LEX_LEGACY_RAW_VM_LEASE_ACQUIRED') &&
    legacyHost.includes('LEX_LEGACY_RAW_VM_DENIED') &&
    legacyHost.includes("manifest.tags.includes('custom')"),
'Raw VM is compatibility quarantine, not a normal extension capability.');

check('window.addonAPI remains fully retired', () =>
    walk('src').every(file => !fs.readFileSync(file, 'utf8').includes('window.addonAPI')),
'No production source exposes the retired window.addonAPI global.');

check('window.vm remains development-only and production removes it', () =>
    vmManager.includes("process.env.NODE_ENV !== 'production'") &&
    vmManager.includes('window.vm = this.props.vm') &&
    vmManager.includes('delete window.vm'),
'Raw VM browser global remains a diagnostics quarantine seam only.');

check('Extension debug is dynamically loaded only outside production', () =>
    !gui.includes("import '../lib/extension-debug.js';") &&
    gui.includes("process.env.NODE_ENV !== 'production'") &&
    gui.includes("import(/* webpackChunkName: \"extension-debug\" */ '../lib/extension-debug.js')") &&
    debtMatrix.includes('LEX-D006') && debtMatrix.includes('CONTAINED_DEV_ONLY'),
'Developer ExtensionManager tooling is no longer an unconditional production GUI dependency.');

check('Remaining private ExtensionManager debt is restricted to certified quarantine/backends', () => {
    const forbiddenPattern = /(?:_loadedExtensions|extensionManager\.(?:loadExtensionURL|loadExtensionIdSync|refreshBlocks|reorderExtension|securityManager))/;
    const allowed = new Set([
        'src/addons/addons/02agent/tools.ts',
        'src/lib/extension-containment/scratch-extension-host.js',
        'src/lib/extension-debug.js',
        'src/lib/runtime-policy/compatibility-project-scan.js'
    ]);
    const offenders = walk('src')
        .filter(file => forbiddenPattern.test(fs.readFileSync(file, 'utf8')))
        .map(file => path.relative(ROOT, file).replace(/\\/g, '/'))
        .filter(file => !allowed.has(file));
    return offenders.length === 0;
}, 'Private ExtensionManager use outside the host is limited to explicit legacy/developer/backend-compatibility quarantine.');

check('LEX debt matrix closes COL and declared-capability blockers without hiding accepted quarantine', () =>
    ['LEX-D003', 'LEX-D004', 'LEX-D005'].every(id =>
        new RegExp(`${id}[^\\n]*,CONTAINED,`).test(debtMatrix)) &&
    /LEX-D001[^\n]*,QUARANTINED,/.test(debtMatrix) &&
    /LEX-D007[^\n]*,DEV_QUARANTINE,/.test(debtMatrix) &&
    /LEX-D008[^\n]*,EXPLICIT_QUARANTINE,/.test(debtMatrix),
'COL-0 debts are contained; 02Agent/window.vm/raw VM exceptions remain explicit quarantine rather than hidden debt.');

check('NGVGE Module declarations remain capabilities/permissions, not Scratch host authority', () =>
    moduleHost.includes('manifest.capabilities') && moduleHost.includes('manifest.permissions') &&
    moduleHost.includes('EXTENSION_EXECUTION_MODES.NATIVE_HOST') &&
    !moduleHost.includes('extensionManager'),
'NGVGE Modules stay under Module Manager semantics and do not borrow Scratch ExtensionManager authority.');

check('LEX-G1 focused/cumulative/Webpack gates are registered', () =>
    typeof packageJSON.scripts['test:extension-containment:lex-g1-certification'] === 'string' &&
    typeof packageJSON.scripts['test:extension-containment:lex-g1-webpack'] === 'string' &&
    typeof packageJSON.scripts['test:extension-containment:lex-g1'] === 'string',
'Certification can be repeated from package scripts.');

const passed = checks.filter(item => item.ok).length;
for (const item of checks) {
    console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
}
console.log(`\nLEX-G1 Machine Certification: ${passed}/${checks.length} PASS`);
if (passed !== checks.length) process.exitCode = 1;
