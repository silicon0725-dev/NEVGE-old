const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const exists = relativePath => fs.existsSync(path.join(ROOT, relativePath));
const checks = [];
const check = (name, condition) => {
    if (!condition) throw new Error(`WS-10P0M check failed: ${name}`);
    checks.push(name);
};

const moduleRegistry = read('src/lib/vendor/scratch-paint/src/modules/paint-module-registry.js');
const defaults = read('src/lib/vendor/scratch-paint/src/modules/default-paint-module-registry.js');
const paintEditor = read('src/lib/vendor/scratch-paint/src/components/paint-editor/paint-editor.jsx');
const host = read('src/containers/native-paint-editor-host.jsx');
const runtimeModules = read('src/lib/vendor/scratch-paint/src/modules/runtime/index.js');
const bridge = read('src/lib/tw-scratch-paint.js');

check('vendored Scratch Paint baseline is present', exists('src/lib/vendor/scratch-paint/NGVGE-VENDOR-BASELINE.md'));
check('upstream GPL-3.0 license is retained', read('src/lib/vendor/scratch-paint/LICENSE').includes('GNU GENERAL PUBLIC LICENSE'));
check('original source package metadata is retained as provenance', exists('src/lib/vendor/scratch-paint/UPSTREAM-package.json'));
check('module registry has stable id', moduleRegistry.includes("ngvge.scratch-paint.module-registry@1"));
check('module registry defines workspace slot', moduleRegistry.includes("'workspace'"));
check('module registry defines tool rail slot', moduleRegistry.includes("'toolRail'"));
check('module registry defines properties toolbar slot', moduleRegistry.includes("'propertiesToolbar'"));
check('module registry defines workspace overlay extension slot', moduleRegistry.includes("'workspaceOverlay'"));
check('module registry defines side panel extension slot', moduleRegistry.includes("'sidePanel'"));
check('module registry defines bottom panel extension slot', moduleRegistry.includes("'bottomPanel'"));
check('default registry installs Paper workspace module', defaults.includes('scratch-paint.workspace.paper@1'));
check('default registry keeps extension slots empty by default', defaults.includes('EmptyPaintModule'));
check('runtime facade exposes workspace module', runtimeModules.includes('workspace: Object.freeze({view, layer, guides})'));
check('runtime facade exposes document module', runtimeModules.includes('document: Object.freeze({bitmap, Formats})'));
check('runtime facade exposes interaction module', runtimeModules.includes('interaction: Object.freeze({selection, group, order, snapping})'));
check('runtime facade exposes history module', runtimeModules.includes('history: Object.freeze({undo})'));
check('runtime facade exposes tool mode module', runtimeModules.includes('tools: Object.freeze({Modes})'));
check('paint editor composes admitted module registry', paintEditor.includes('getPaintModuleComponent'));
check('paint editor exposes stable module registry marker', paintEditor.includes('data-scratch-paint-module-registry'));
check('NGVGE bridge loads vendored modular Scratch Paint', bridge.includes("require('./vendor/scratch-paint/src')"));
check('Native Paint uses modular Scratch Paint working-copy editor', host.includes('WorkspaceScratchPaintEditor'));
check('Native Paint no longer imports custom SVG-Edit editor as primary', !host.includes('workspace-vector-editor.jsx'));
check('Native Paint no longer imports custom Raster Core editor as primary', !host.includes('workspace-raster-editor.jsx'));
check('Vector identity points to modular Scratch Paint', host.includes('Scratch Paint Modular · Vector'));
check('Bitmap identity points to modular Scratch Paint', host.includes('Scratch Paint Modular · Bitmap'));
check('Working Copy authority remains outside Scratch Paint', host.includes('paintSession.applyWorkingCopyEdit'));
check('Review/commit authority remains outside Scratch Paint', host.includes('paintSession.commitReviewedChanges'));

console.log(`WS-10P0M Scratch Paint Modular Foundation gate: ${checks.length}/${checks.length} PASS`);
checks.forEach((name, index) => console.log(`${String(index + 1).padStart(2, '0')}. PASS ${name}`));
