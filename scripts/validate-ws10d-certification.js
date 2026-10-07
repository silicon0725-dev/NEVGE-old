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
        process.stderr.write(`WS-10D CERTIFICATION FAIL: ${label}\n`);
        process.exit(1);
    }
    checks.push(label);
};

const cert = json('docs/architecture/workspace/WS-10D-CERTIFICATE.json');
const stage = read('docs/architecture/workspace/WS-10D-2D-ART-ANIMATION-SEMANTIC-FREEZE.md');
const verification = read('docs/architecture/workspace/WS-10D-VERIFICATION.md');
const matrix = read('docs/architecture/workspace/WS-10D-semantic-ownership-matrix.csv');
const roadmap = read('docs/architecture/workspace/WS-10-HIGH-CAPABILITY-TOOL-INTEGRATION.md');
const identities = read('src/lib/art-documents/art-document-identities.js');
const raster = read('src/lib/art-documents/animated-raster-document-schema.js');
const vector = read('src/lib/art-documents/vector-art-document-schema.js');
const paint = read('src/lib/art-documents/paint-document-schema.js');
const packageJson = json('package.json');

check(cert.stage === 'WS-10D' && cert.status === 'COMPLETE / ARCHITECTURE FROZEN', 'WS-10D certificate status is frozen');
check(stage.includes('**Status:** `COMPLETE / ARCHITECTURE FROZEN`'), 'architecture record is frozen');
check(cert.contracts.paintDocument === 'ngvge.paint-document-contract@1' && paint.includes('ngvge.paint-document-contract@1'), 'PaintDocument contract identity matches code');
check(cert.contracts.vectorDocument === 'ngvge.vector-art-document@1' && vector.includes('ngvge.vector-art-document@1'), 'Vector document identity matches code');
check(cert.contracts.animatedRasterDocument === 'ngvge.animated-raster-document@1' && raster.includes('ngvge.animated-raster-document@1'), 'Animated raster identity matches code');
check(['ngvge:art-layer:', 'ngvge:animation-frame:', 'ngvge:animation-cel:', 'ngvge:cel-content:'].every(token => identities.includes(token)), 'Layer/Frame/Cel/Content stable identities are present');
check(['ngvge:animation-clip:', 'ngvge:animation-marker:', 'ngvge:palette:', 'ngvge:slice:'].every(token => identities.includes(token)), 'Clip/Marker/Palette/Slice stable identities are present');
check(raster.includes("['bitmap', 'pixel']") && raster.includes('clipToLayerId') && raster.includes('maskTargetLayerId'), 'bitmap/pixel and layer semantics are frozen');
check(raster.includes('normalizePortableJson') && raster.includes('Indexed animated raster document requires a Palette semantic owner'), 'portable marker and palette boundaries are frozen');
check(vector.includes("sourceFormat !== 'svg'"), 'vector authoring v1 remains canonical SVG');
check(stage.includes('Static raster is a one-frame instance') || stage.includes('one frame'), 'static raster maps to the same authoring family');
check(stage.includes('Authoring Source') && stage.includes('GIF') && stage.includes('sprite sheet'), 'authoring/export boundary is explicit');
check(stage.includes('Onion Skin') && stage.includes('Workspace / Tool session persistence'), 'editor/session state is excluded from Project semantics');
check(stage.includes('TileSet / Tilemap authoring schema') && stage.includes('reserved for later'), 'deferred tilemap semantics are fail-visible');
check(matrix.includes('Backend Working Session') && matrix.includes('NGVGE'), 'semantic ownership matrix preserves backend isolation');
check(cert.backendAuthority === false && cert.productionBehaviorSwitch === false, 'WS-10D introduces no backend authority or production switch');
check(cert.verification.machine === '26/26 PASS' && cert.verification.focused === '3 suites / 25 tests PASS', 'machine/focused evidence is frozen');
check(cert.verification.fullUnit === '149 suites / 835 tests PASS' && cert.verification.permanentRegression === '19/19 PASS', 'full unit/regression evidence is frozen');
check(cert.verification.ws10cCertification === '34/34 PASS' && cert.verification.ws10cProductionWebpack === '0 errors / 0 warnings PASS', 'verified WS-10C parent remains green');
check(verification.includes('NO PRODUCTION') || verification.includes('no production'), 'verification records zero production switch');
check(roadmap.includes('WS-10D｜2D Art & Animation Semantic Freeze') && roadmap.includes('WS-10E｜Paint Backend Contract & OSS Intake'), 'roadmap advances from semantic freeze to backend intake');
check(typeof packageJson.scripts['test:workspace-shell:ws10d:focused'] === 'string' && typeof packageJson.scripts['test:workspace-shell:ws10d-certification'] === 'string', 'repeatable WS-10D gates are registered');
const aggregateGate = packageJson.scripts['test:workspace-shell:ws10'] || '';
const aggregateMatch = aggregateGate.match(/ws10([a-z])-certification/);
check(Boolean(aggregateMatch) && aggregateMatch[1] >= 'd', 'WS-10 aggregate gate remains at WS-10D or a later certified stage');

process.stdout.write(`WS-10D Certification PASS (${checks.length}/${checks.length}).\n`);
process.stdout.write(`${JSON.stringify({
    stage: 'WS-10D',
    status: 'COMPLETE / ARCHITECTURE FROZEN',
    contract: 'ngvge.paint-document-contract@1',
    backendAuthority: false,
    productionBehaviorSwitch: false,
    checks: checks.length
}, null, 2)}\n`);
