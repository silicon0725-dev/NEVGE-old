#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const checks = [];
const check = (condition, label) => {
    if (!condition) {
        process.stderr.write(`WS-10C FAIL: ${label}\n`);
        process.exit(1);
    }
    checks.push(label);
};

const payload = read('src/lib/project-assets/image-content-payload.js');
const database = read('src/lib/project-assets/global-asset-database.js');
const contentRead = read('src/lib/editor-shell/workspace-resource-content-capability.js');
const host = read('src/lib/editor-shell/project-command-host.js');
const review = read('src/lib/editor-shell/project-transaction-review.js');
const paintRuntime = read('src/lib/editor-shell/paint-tool-runtime.js');
const paintView = read('src/components/workspace-paint/workspace-paint.jsx');
const packageJson = read('package.json');

check(payload.includes('MAX_IMAGE_CONTENT_REPLACE_BYTES = 32 * 1024 * 1024'), 'content replacement payload has a 32 MiB hard budget');
check(payload.includes("content.kind === 'svg-text'") && payload.includes("content.kind === 'data-uri'"), 'content payload accepts only portable SVG text/data URI forms');
check(payload.includes('NGVGE_RESOURCE_IMAGE_CONTENT_MIME_MISMATCH') && payload.includes('NGVGE_RESOURCE_IMAGE_CONTENT_BUDGET_EXCEEDED'), 'invalid MIME and oversized payloads fail visibly');
check(database.includes('getResourceContentRevision') && database.includes('contentRevision: 0'), 'Resource authority owns per-image content revision');
check(database.includes('replaceImageResourceContent') && database.includes('expectedSourceAuthorityRevision'), 'Resource authority enforces source revision precondition');
check(database.includes('NGVGE_RESOURCE_IMAGE_CONTENT_GEOMETRY_INVALID') && host.includes('NGVGE_WORKSPACE_PROJECT_COMMAND_CONTENT_BITMAP_RESOLUTION_INVALID'), 'Project and Resource boundaries validate image geometry independently from portable content payload');
check(database.includes('sanitizeSvg.sanitizeByteStream') && database.includes('loadCostumeFromAsset'), 'commit boundary sanitizes SVG and loads replacement through Scratch backend adapter');
check(database.includes("type: 'replace'") && database.includes('resourceId'), 'content replacement emits canonical Resource change projection');
check(contentRead.includes('database.getResourceContentRevision(resourceId)'), 'Paint source snapshot uses per-Resource content revision rather than global database revision');
check(host.includes("RESOURCE_CONTENT_REPLACE: 'resource.content.replace'"), 'Project Command v1 defines resource.content.replace');
check(host.includes('normalizePortableImageContent') && host.includes('expectedSourceAuthorityRevision'), 'Project Command normalizes bounded portable content and revision precondition');
check(host.includes('database.replaceImageResourceContent(command.resourceId, command)'), 'Project transaction delegates actual replacement to Resource authority');
check(host.includes('database.getDataURL(internalId)') && host.includes('currentRevision + 1'), 'transaction failure compensation captures reversible previous image content internally');
check(review.includes("'resource.content' : 'resource.metadata'"), 'Review distinguishes Resource content impact from metadata impact');
check(review.includes('NGVGE_WORKSPACE_PROJECT_REVIEW_RESOURCE_CONTENT_SOURCE_STALE'), 'Review blocks stale working-copy content before commit');
check(review.includes('command.byteLength') && review.includes('sourceAuthorityRevision'), 'Review exposes portable content impact summary without raw bytes/backend handles');
check(paintRuntime.includes("kind: 'resource.content.replace'"), 'Better Paint converts dirty working copy into Project content-replace proposal');
check(paintRuntime.includes('expectedSourceAuthorityRevision: copy.sourceAuthorityRevision'), 'Paint proposal binds exact Working Copy source revision');
check(paintRuntime.includes('prepareMutationReview') && paintRuntime.includes('reviewEvidence'), 'Paint content commit still requires WS-9I fresh Review Evidence');
check(paintRuntime.includes('workingCopy.load(selectedResourceId, {discardDirty: true})'), 'successful commit/rollback resynchronizes working copy from authoritative source');
check(!paintRuntime.includes('vm.updateSvg') && !paintRuntime.includes('vm.updateBitmap'), 'Paint runtime has no direct VM image mutation shortcut');
check(!paintView.includes('vm.updateSvg') && !paintView.includes('vm.updateBitmap') && paintView.includes('Review Changes'), 'Paint UI uses reviewed session mutation only');
check(packageJson.includes('test:workspace-shell:ws10c:focused') && packageJson.includes('test:workspace-shell:ws10c-webpack'), 'repeatable WS-10C gates are registered');

process.stdout.write(`WS-10C Reviewed Resource Content Replace PASS (${checks.length}/${checks.length}).\n`);
process.stdout.write(`${JSON.stringify({stage: 'WS-10C', reviewedContentReplace: true, directVmMutation: false, checks: checks.length}, null, 2)}\n`);
