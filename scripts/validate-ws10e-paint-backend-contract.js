#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const json = relative => JSON.parse(read(relative));

const files = {
    contract: 'src/lib/paint-backends/paint-backend-contract.js',
    registry: 'src/lib/paint-backends/paint-backend-registry.js',
    candidates: 'src/lib/paint-backends/paint-backend-candidates.js',
    index: 'src/lib/paint-backends/index.js',
    architecture: 'docs/architecture/workspace/WS-10E-PAINT-BACKEND-CONTRACT-OSS-INTAKE.md',
    intake: 'docs/architecture/workspace/WS-10E-oss-intake-matrix.csv',
    coverage: 'docs/architecture/workspace/WS-10E-backend-semantic-coverage.csv',
    roadmap: 'docs/architecture/workspace/WS-10-HIGH-CAPABILITY-TOOL-INTEGRATION.md'
};

const checks = [];
const check = (name, predicate, detail = '') => {
    let passed = false;
    try {
        passed = Boolean(predicate());
    } catch (error) {
        detail = detail || (error && error.message) || String(error);
    }
    checks.push({name, passed, detail});
};

Object.entries(files).forEach(([name, relative]) => {
    check(`file:${name}`, () => fs.existsSync(path.join(root, relative)), relative);
});

const contract = read(files.contract);
const registry = read(files.registry);
const candidates = read(files.candidates);
const architecture = read(files.architecture);
const intake = read(files.intake);
const coverage = read(files.coverage);
const roadmap = read(files.roadmap);
const packageJson = json('package.json');
const dependencyNames = [
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.devDependencies || {}),
    ...Object.keys(packageJson.peerDependencies || {})
].map(value => value.toLowerCase());

check('contract-id', () => contract.includes("ngvge.paint-backend-contract@1"));
check('transfer-id', () => contract.includes("ngvge.paint-backend-transfer@1"));
check('registry-id', () => registry.includes("ngvge.paint-backend-registry@1"));
check('backend-kinds', () => ['vector', 'bitmap', 'pixel'].every(kind => contract.includes(`'${kind}'`)));
check('authority-fail-closed', () => contract.includes('NGVGE_PAINT_BACKEND_AUTHORITY_FORBIDDEN') && contract.includes('Object.values(authority).some(Boolean)'));
check('timeline-ngvge-owned', () => contract.includes('NGVGE_PAINT_BACKEND_TIMELINE_AUTHORITY_FORBIDDEN') && architecture.includes('Timeline identity = NGVGE'));
check('portable-boundary', () => contract.includes('assertPortableJson') && contract.includes('backend/DOM/function handles are forbidden'));
check('stable-transfer-identities', () => contract.includes('NGVGE_PAINT_BACKEND_IDENTITY_MUTATION_FORBIDDEN') && architecture.includes('preserve `ArtDocumentId` and `ResourceId`'));
check('vector-canonical-svg-transfer', () => contract.includes('NGVGE_PAINT_BACKEND_VECTOR_SOURCE_FORMAT_INVALID') && architecture.includes('canonical SVG source'));
check('indexed-pixel-transfer', () => contract.includes("kind: 'indexed-raster'") && contract.includes("encoding: 'base64-u8'") && architecture.includes('not flattened to PNG'));
check('indexed-palette-boundary', () => contract.includes('NGVGE_PAINT_BACKEND_INDEXED_PALETTE_MISMATCH'));
check('backend-surface-whitelist', () => contract.includes('REQUIRED_BACKEND_METHODS') && contract.includes('NGVGE_PAINT_BACKEND_SURFACE_FORBIDDEN'));
check('svg-edit-poc', () => candidates.includes("ngvge.paint-backend.svg-edit") && candidates.includes("admission: 'approved-for-poc'") && candidates.includes("package: '@svgedit/svgcanvas'"));
check('minipaint-controlled-fork', () => candidates.includes("ngvge.paint-backend.minipaint") && candidates.includes("iframeProductionEmbedding: false") && candidates.includes("integrationMode: 'controlled-fork'"));
check('piskel-controlled-fork', () => candidates.includes("ngvge.paint-backend.piskel") && candidates.includes("license: 'Apache-2.0'") && candidates.includes("upstreamLargeUxChangesExpected: false"));
check('scratch-paint-compat-only', () => candidates.includes("ngvge.paint-backend.scratch-paint-compat") && candidates.includes("admission: 'compatibility-only'"));
check('intake-primary-sources', () => ['github.com/SVG-Edit/svgedit', 'github.com/viliusle/miniPaint', 'github.com/piskelapp/piskel'].every(value => intake.includes(value)));
check('coverage-matrix', () => coverage.includes('ngvge.paint-backend.svg-edit') && coverage.includes('ngvge.paint-backend.minipaint') && coverage.includes('ngvge.paint-backend.piskel'));
check('post-ws10e-dependency-admission', () => {
    const laterVectorStage = fs.existsSync(path.join(root, 'docs/architecture/workspace/WS-10F-VECTOR-BACKEND-INTEGRATION.md'));
    const forbidden = dependencyNames.some(name => name.includes('minipaint') || name === 'piskel' || name.includes('piskelapp') || name === 'svgedit');
    const svgCanvas = (packageJson.dependencies || {})['@svgedit/svgcanvas'];
    return !forbidden && (!svgCanvas || (laterVectorStage && svgCanvas === '7.4.2'));
});
check('post-ws10e-production-admission', () => {
    const laterVectorStage = fs.existsSync(path.join(root, 'docs/architecture/workspace/WS-10F-VECTOR-BACKEND-INTEGRATION.md'));
    const productionRoots = ['src/components', 'src/containers', 'src/playground'];
    let foundPaintBackendImport = false;
    let forbiddenOssImport = false;
    productionRoots.forEach(relative => {
        const absolute = path.join(root, relative);
        if (!fs.existsSync(absolute)) return;
        const stack = [absolute];
        while (stack.length) {
            const current = stack.pop();
            const stat = fs.statSync(current);
            if (stat.isDirectory()) fs.readdirSync(current).forEach(entry => stack.push(path.join(current, entry)));
            else if (/\.(js|jsx)$/.test(current)) {
                const source = fs.readFileSync(current, 'utf8');
                if (/paint-backends/.test(source)) foundPaintBackendImport = true;
                if (/from ['"](?:svgedit|minipaint|piskel)/i.test(source)) forbiddenOssImport = true;
            }
        }
    });
    return !forbiddenOssImport && (!foundPaintBackendImport || laterVectorStage);
});
check('no-production-switch-recorded', () => architecture.includes('does **not** integrate') && architecture.includes('No candidate is `production-admitted`'));
check('iframe-production-forbidden', () => architecture.includes('PRODUCTION iframe embedding = FORBIDDEN'));
check('piskel-private-id-forbidden', () => architecture.includes("Piskel's private Frame/Layer IDs"));
check('ws10d-contract-preserved', () => architecture.includes('WS-10D') && architecture.includes('stable semantic'));
check('roadmap-continuation', () => roadmap.includes('WS-10E｜Paint Backend Contract & OSS Intake') && roadmap.includes('**Status:** `COMPLETE / VERIFIED`') && roadmap.includes('WS-10F｜Vector Backend Integration'));

const failed = checks.filter(item => !item.passed);
checks.forEach(item => console.log(`${item.passed ? 'PASS' : 'FAIL'} ${item.name}${item.detail ? ` :: ${item.detail}` : ''}`));
console.log(`WS-10E Paint backend contract machine checks: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length) process.exit(1);
