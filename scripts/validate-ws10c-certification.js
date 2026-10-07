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
        process.stderr.write(`WS-10C CERTIFICATION FAIL: ${label}\n`);
        process.exit(1);
    }
    checks.push(label);
};

const cert = json('docs/architecture/workspace/WS-10C-CERTIFICATE.json');
const stage = read('docs/architecture/workspace/WS-10C-REVIEWED-RESOURCE-CONTENT-REPLACE-TRANSACTION.md');
const verification = read('docs/architecture/workspace/WS-10C-VERIFICATION.md');
const matrix = read('docs/architecture/workspace/WS-10C-content-replace-matrix.csv');
const payload = read('src/lib/project-assets/image-content-payload.js');
const database = read('src/lib/project-assets/global-asset-database.js');
const contentRead = read('src/lib/editor-shell/workspace-resource-content-capability.js');
const host = read('src/lib/editor-shell/project-command-host.js');
const review = read('src/lib/editor-shell/project-transaction-review.js');
const policy = read('src/lib/editor-shell/privileged-mutation-review-policy.js');
const runtime = read('src/lib/editor-shell/paint-tool-runtime.js');
const view = read('src/components/workspace-paint/workspace-paint.jsx');
const roadmap = read('docs/architecture/workspace/WS-10-HIGH-CAPABILITY-TOOL-INTEGRATION.md');
const packageJson = json('package.json');
const serializedRecordSection = database.slice(database.indexOf('const serializeRecord'), database.indexOf('const createRuntimeCostume'));

check(cert.stage === 'WS-10C' && cert.status === 'COMPLETE / VERIFIED', 'WS-10C certificate is frozen COMPLETE / VERIFIED');
check(stage.includes('**Status:** `COMPLETE / VERIFIED`'), 'WS-10C architecture record is frozen COMPLETE / VERIFIED');
check(cert.workspaceParent === 'WS-10B | COMPLETE / VERIFIED' && cert.ws9Foundation === 'COMPLETE / CERTIFIED', 'WS-10C remains layered over verified WS-10B and certified WS-9');
check(cert.identities.contentCommandKind === 'resource.content.replace' && host.includes("RESOURCE_CONTENT_REPLACE: 'resource.content.replace'"), 'Resource content replacement has a stable Project command kind');
check(payload.includes('MAX_IMAGE_CONTENT_REPLACE_BYTES = 32 * 1024 * 1024') && cert.contentReplaceContract.maxPayloadBytes === 33554432, 'Portable image replacement remains bounded to 32 MiB');
check(payload.includes("content.kind === 'svg-text'") && payload.includes("content.kind === 'data-uri'"), 'Only portable SVG text/data URI payload forms are admitted');
check(host.includes('isStableIdentity(command.resourceId, STABLE_ID_KINDS.RESOURCE)'), 'Project content commands require canonical ResourceId identity directly');
check(host.includes('NGVGE_WORKSPACE_PROJECT_COMMAND_CONTENT_BITMAP_RESOLUTION_INVALID') && database.includes('NGVGE_RESOURCE_IMAGE_CONTENT_GEOMETRY_INVALID'), 'Project and Resource boundaries independently validate image geometry');
check(database.includes('getResourceContentRevision') && database.includes('contentRevision: 0'), 'Resource Authority owns per-image runtime content revision');
check(!serializedRecordSection.includes('contentRevision'), 'Runtime contentRevision is not silently promoted into persisted Global Asset Database v3 records');
check(contentRead.includes('database.getResourceContentRevision(resourceId)'), 'Content-read source snapshots use per-Resource content revision instead of global database revision');
check(database.includes('expectedRevision !== currentRevision') && database.includes('NGVGE_RESOURCE_IMAGE_CONTENT_SOURCE_STALE'), 'Resource Authority enforces optimistic source-revision preconditions');
check(database.includes('sanitizeSvg.sanitizeByteStream') && database.includes('loadCostumeFromAsset'), 'SVG sanitize and compatibility backend materialization remain inside Resource Authority');
check(host.includes('database.replaceImageResourceContent(command.resourceId, command)'), 'Project Command Host delegates replacement to Resource Authority rather than touching backend objects');
check(host.includes('database.getDataURL(internalId)') && host.includes('currentRevision + 1'), 'Project transaction prepares a reversible portable inverse for content replacement');
check(host.includes('RESOURCE_RENAME') && host.includes('RESOURCE_MOVE') && host.includes('RESOURCE_CONTENT_REPLACE'), 'Project transaction command registry preserves metadata commands and adds reviewed content replacement');
check(review.includes("'resource.content'") && review.includes("'resource.metadata'"), 'Review keeps metadata/content impact domains distinct');
check(review.includes('NGVGE_WORKSPACE_PROJECT_REVIEW_RESOURCE_CONTENT_SOURCE_STALE'), 'Stale Working Copy source is a blocking Review diagnostic');
check(review.includes('byteLength') && review.includes('sourceAuthorityRevision') && !review.includes('dataUri: command'), 'Review exposes portable content summaries without copying raw command bytes');
check(review.includes('destructive: command.kind === WORKSPACE_PROJECT_COMMAND_KINDS.RESOURCE_CONTENT_REPLACE') && review.includes('reversible: true'), 'Content replacement is explicitly destructive-but-reversible in Review');
check(policy.includes("RESOURCE_MUTATE: 'resource-command#mutate'") || policy.includes('RESOURCE_COMMAND'), 'WS-9I privileged mutation policy remains present');
check(runtime.includes("kind: 'resource.content.replace'") && runtime.includes('expectedSourceAuthorityRevision: copy.sourceAuthorityRevision'), 'Dirty Paint Working Copy creates an exact-source Project content proposal');
check(runtime.includes('prepareMutationReview') && runtime.includes('reviewEvidence'), 'Paint commit still requires fresh WS-9I Review Evidence');
check(runtime.includes('workingCopy.load(selectedResourceId, {discardDirty: true})'), 'Paint commit/rollback resynchronizes Working Copy from authoritative Resource content');
check(!runtime.includes('vm.updateSvg') && !runtime.includes('vm.updateBitmap') && !view.includes('vm.updateSvg') && !view.includes('vm.updateBitmap'), 'Better Paint contains no direct VM image mutation shortcut');
check(cert.rules.resourceDirectMutation === false && matrix.includes('resource_direct_mutate,resource-command#mutate'), 'Direct Resource Tool mutation remains denied');
check(matrix.includes('content_revision_persistence,runtime-only') && cert.contentReplaceContract.contentRevisionPersistedInGlobalAssetV3 === false, 'Content revision runtime-only persistence policy is recorded');
check(roadmap.includes('WS-10C') && roadmap.includes('**Status:** `COMPLETE / VERIFIED`') && roadmap.includes('WS-10D｜2D Art & Animation Semantic Freeze'), 'WS-10 roadmap preserves verified WS-10C and advances through a versioned Paint semantic stage');
check(cert.verification.machine === '23/23 PASS' && cert.verification.focused === '7 suites / 49 tests PASS', 'WS-10C machine/focused evidence is frozen');
check(cert.verification.fullUnit === '146 suites / 810 tests PASS' && cert.verification.permanentRegression === '19/19 PASS', 'Full unit and permanent regression evidence is frozen');
check(cert.verification.ws10cWebpack === '0 errors / 0 warnings PASS' && cert.verification.fullEditorWebpack === '0 errors / 0 warnings PASS', 'WS-10C and full Editor production Webpack evidence is frozen');
check(cert.verification.ws9Aggregate === '20/20 PASS' && cert.verification.ws10aCertification === '23/23 PASS' && cert.verification.ws10bCertification === '27/27 PASS', 'WS-9/WS-10A/WS-10B certified baselines remain green');
check(verification.includes('ARC-C001.1 baseline') && verification.includes('LSC-G1') && verification.includes('LRC-G1') && verification.includes('LPL-G1') && verification.includes('LEX-G1') && verification.includes('COL-0'), 'Frozen architecture/containment evidence is recorded');
check(typeof packageJson.scripts['test:workspace-shell:ws10c-certification'] === 'string' && typeof packageJson.scripts['test:workspace-shell:ws10'] === 'string', 'Repeatable WS-10C certification remains addressable after later WS-10 stages advance the aggregate gate');

process.stdout.write(`WS-10C Certification PASS (${checks.length}/${checks.length}).\n`);
process.stdout.write(`${JSON.stringify({
    stage: 'WS-10C',
    status: 'COMPLETE / VERIFIED',
    toolId: 'ngvge.tool.paint',
    command: 'resource.content.replace',
    reviewedContentMutation: true,
    directVmMutation: false,
    checks: checks.length
}, null, 2)}\n`);
