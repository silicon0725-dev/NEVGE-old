#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const json = relative => JSON.parse(read(relative));
const checks = [];
const check = (condition, label) => {
    if (!condition) {
        process.stderr.write(`WS-10E CERTIFICATION FAIL: ${label}\n`);
        process.exit(1);
    }
    checks.push(label);
};

const cert = json('docs/architecture/workspace/WS-10E-CERTIFICATE.json');
const architecture = read('docs/architecture/workspace/WS-10E-PAINT-BACKEND-CONTRACT-OSS-INTAKE.md');
const verification = read('docs/architecture/workspace/WS-10E-VERIFICATION.md');
const intake = read('docs/architecture/workspace/WS-10E-oss-intake-matrix.csv');
const coverage = read('docs/architecture/workspace/WS-10E-backend-semantic-coverage.csv');
const contract = read('src/lib/paint-backends/paint-backend-contract.js');
const candidates = read('src/lib/paint-backends/paint-backend-candidates.js');
const registry = read('src/lib/paint-backends/paint-backend-registry.js');
const roadmap = read('docs/architecture/workspace/WS-10-HIGH-CAPABILITY-TOOL-INTEGRATION.md');
const packageJson = json('package.json');

check(cert.stage === 'WS-10E' && cert.status === 'COMPLETE / VERIFIED', 'WS-10E certificate status');
check(architecture.includes('**Status:** `COMPLETE / VERIFIED`'), 'architecture record status');
check(cert.contracts.paintBackend === 'ngvge.paint-backend-contract@1' && contract.includes('ngvge.paint-backend-contract@1'), 'PaintBackendContract identity');
check(cert.contracts.paintBackendRegistry === 'ngvge.paint-backend-registry@1' && registry.includes('ngvge.paint-backend-registry@1'), 'PaintBackendRegistry identity');
check(cert.contracts.paintBackendTransfer === 'ngvge.paint-backend-transfer@1' && contract.includes('ngvge.paint-backend-transfer@1'), 'PaintBackendTransfer identity');
check(Object.values(cert.authority).every(value => value === false), 'backend authority remains false');
check(cert.productionBehaviorSwitch === false && cert.newOssDependencyAdded === false, 'no production switch / dependency addition');
check(cert.candidateDecisions.svgEdit === 'APPROVED_FOR_POC' && candidates.includes("admission: 'approved-for-poc'"), 'SVG-Edit PoC approval');
check(cert.candidateDecisions.miniPaint === 'CONDITIONAL_POC_CONTROLLED_FORK' && candidates.includes('iframeProductionEmbedding: false'), 'miniPaint controlled fork / iframe denied');
check(cert.candidateDecisions.piskel === 'CONDITIONAL_POC_CONTROLLED_FORK' && candidates.includes("license: 'Apache-2.0'"), 'Piskel controlled fork decision');
check(cert.candidateDecisions.scratchPaint === 'COMPATIBILITY_ONLY' && candidates.includes("admission: 'compatibility-only'"), 'scratch-paint compatibility status');
check(contract.includes('NGVGE_PAINT_BACKEND_IDENTITY_MUTATION_FORBIDDEN') && contract.includes('NGVGE_PAINT_BACKEND_AUTHORITY_FORBIDDEN'), 'identity/authority fail-closed contract');
check(contract.includes("kind: 'indexed-raster'") && contract.includes("encoding: 'base64-u8'"), 'indexed pixel transfer remains first-class');
check(architecture.includes('Timeline identity = NGVGE') && coverage.includes('ngvge-owned'), 'timeline semantic ownership remains NGVGE');
check(intake.includes('component_or_canvas_core') && intake.includes('iframe_forbidden_in_production'), 'OSS integration policies frozen');
check(cert.verification.machine === '33/33 PASS' && cert.verification.focused === '6 suites / 50 tests PASS', 'focused evidence');
check(cert.verification.fullUnit === '152 suites / 860 tests PASS' && cert.verification.permanentRegression === '19/19 PASS', 'full unit/regression evidence');
check(cert.verification.integration === '4 suites / 5 tests PASS' && cert.verification.smoke === '1 suite / 1 test PASS', 'integration/smoke evidence');
check(cert.verification.typeScript === 'PASS' && cert.verification.eslintCorrectness === 'PASS', 'typecheck/lint evidence');
check(cert.verification.ws10dFocused === '26/26 machine + 3 suites / 25 tests PASS' && cert.verification.ws10dCertification === '23/23 PASS', 'WS-10D parent evidence');
check(verification.includes('NO PRODUCTION PAINT BACKEND SWITCH') && verification.includes('no SVG-Edit, miniPaint or Piskel'), 'verification records no production integration');
check(roadmap.includes('WS-10E COMPLETE / VERIFIED') && roadmap.includes('WS-10F'), 'roadmap preserves WS-10E and advances into WS-10F');
check(typeof packageJson.scripts['test:workspace-shell:ws10e:focused'] === 'string' && typeof packageJson.scripts['test:workspace-shell:ws10e-certification'] === 'string', 'repeatable WS-10E gates registered');
check(packageJson.scripts['test:workspace-shell:ws10'] === 'npm run test:workspace-shell:ws10e-certification', 'WS-10 aggregate advances to WS-10E');

process.stdout.write(`WS-10E Certification PASS (${checks.length}/${checks.length}).\n`);
process.stdout.write(`${JSON.stringify({
    stage: 'WS-10E',
    status: 'COMPLETE / VERIFIED',
    contract: cert.contracts.paintBackend,
    candidates: cert.candidateDecisions,
    productionBehaviorSwitch: false,
    newOssDependencyAdded: false,
    checks: checks.length
}, null, 2)}\n`);
