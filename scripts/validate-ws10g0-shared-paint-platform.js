#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const checks = [];
const check = (name, pass) => checks.push({name, pass: Boolean(pass)});

const toolProfiles = read('src/lib/editor-shell/paint-tool-profiles.js');
const shell = read('src/components/native-paint/native-paint-shell.jsx');
const rasterPolicy = read('src/lib/paint-platform/raster-authoring-policy.js');
const intake = read('src/lib/paint-backends/raster-backend-intake.js');
const candidates = read('src/lib/paint-backends/paint-backend-candidates.js');
const host = read('src/containers/native-paint-editor-host.jsx');
const shellTests = read('test/unit/components/native-paint-shell.test.jsx');
const toolTests = read('test/unit/lib/editor-shell/paint-tool-profiles.test.js');
const policyTests = read('test/unit/lib/paint-platform/raster-authoring-policy.test.js');
const intakeTests = read('test/unit/lib/paint-backends/raster-backend-intake.test.js');
const webpackEntry = read('scripts/validate-ws10g0-webpack-shared-paint-platform-entry.js');
const packageJson = read('package.json');

check('shared Paint mode vocabulary explicitly contains Vector, Bitmap, and Pixel',
    toolProfiles.includes("VECTOR: 'vector'") && toolProfiles.includes("BITMAP: 'bitmap'") && toolProfiles.includes("PIXEL: 'pixel'"));
check('verified Vector tool order is preserved in the shared profile',
    toolProfiles.includes('PAINT_TOOL_IDS.DIRECT_SELECT') && toolProfiles.includes('PAINT_TOOL_IDS.PATH') &&
    toolProfiles.includes('PAINT_TOOL_IDS.HAND') && toolProfiles.includes('PAINT_TOOL_IDS.ZOOM'));
check('Bitmap profile declares brush/eraser/fill/eyedropper without a Bitmap-specific React shell',
    toolProfiles.includes('PAINT_TOOL_IDS.BRUSH') && toolProfiles.includes('PAINT_TOOL_IDS.ERASER') &&
    toolProfiles.includes('PAINT_TOOL_IDS.FILL') && toolProfiles.includes('PAINT_TOOL_IDS.EYEDROPPER'));
check('Pixel profile declares integer-authoring tools separately from Bitmap brush semantics',
    toolProfiles.includes('PAINT_TOOL_IDS.PENCIL') && toolProfiles.includes("semantic: 'pixel-pencil'"));
check('tool descriptors carry interaction metadata but no backend or Resource identity',
    toolProfiles.includes("semantic: 'selection'") && !toolProfiles.includes('backendId:') &&
    !toolProfiles.includes('resourceId:') && !toolProfiles.includes('documentId:'));

check('Native Paint Shell consumes shared mode/tool descriptors instead of owning Vector labels',
    shell.includes("from '../../lib/editor-shell/paint-tool-profiles'") &&
    shell.includes('getPaintModeLabel(mode)') && shell.includes('getPaintToolLabel(activeTool)'));
check('shared shell zoom chrome is mode-neutral and still uses the existing presentation zoom protocol',
    shell.includes('aria-label={`${modeLabel} zoom`}') &&
    shell.includes("event.target.value === 'fit' ? 'fit' : Number(event.target.value) / 100"));
check('shared shell already has raster glyph vocabulary without importing a raster App Shell',
    ["case 'brush':", "case 'eraser':", "case 'fill':", "case 'eyedropper':"].every(token => shell.includes(token)) &&
    !shell.includes('miniPaint') && !shell.includes('Piskel'));

check('Raster policy explicitly shares implementation surfaces between Bitmap and Pixel',
    rasterPolicy.includes('RASTER_SHARED_ENGINE_SURFACES') &&
    rasterPolicy.includes("'selection-mask-lifecycle'") && rasterPolicy.includes("'working-copy-event-bridge'"));
check('Bitmap policy remains continuous RGBA authoring with smooth sampling',
    rasterPolicy.includes("sourceKind: 'rgba-raster'") && rasterPolicy.includes("coordinateModel: 'continuous'") &&
    rasterPolicy.includes("sampling: 'linear'") && rasterPolicy.includes('softBrush: true'));
check('Pixel policy remains indexed/integer/nearest authoring instead of flattened PNG semantics',
    rasterPolicy.includes("sourceKind: 'indexed-raster'") && rasterPolicy.includes("coordinateModel: 'integer-grid'") &&
    rasterPolicy.includes("sampling: 'nearest'") && rasterPolicy.includes("pixelGrid: 'required'"));
check('Raster policies keep palette/timeline/persistence authority under NGVGE',
    (rasterPolicy.match(/paletteAuthority: 'ngvge'/g) || []).length === 2 &&
    (rasterPolicy.match(/timelineAuthority: 'ngvge'/g) || []).length === 2 &&
    (rasterPolicy.match(/persistenceAuthority: 'ngvge'/g) || []).length === 2);

check('miniPaint intake is controlled extraction and records verified core/tool source paths',
    intake.includes("project: 'viliusle/miniPaint'") && intake.includes("strategy: 'controlled-extraction'") &&
    intake.includes("'src/js/core/base-layers.js'") && intake.includes("'src/js/core/base-selection.js'") &&
    intake.includes("'src/js/tools/brush.js'") && intake.includes("'src/js/tools/fill.js'"));
check('miniPaint intake records the real MIT license filename and observed upstream commit',
    intake.includes("licenseFile: 'MIT-LICENSE.txt'") && candidates.includes("licenseFile: 'MIT-LICENSE.txt'") &&
    intake.includes("observedCommit: 'a79733eb803fc97084ef0ee4faa96b031e69e1c0'"));
check('Piskel intake records drawing, palette, and onion-skin implementation paths',
    intake.includes("'src/js/tools/drawing/SimplePen.js'") &&
    intake.includes("'src/js/service/palette/PaletteService.js'") &&
    intake.includes("'src/js/rendering/OnionSkinRenderer.js'"));
check('Piskel intake remains controlled extraction under Apache-2.0 at the reviewed commit',
    intake.includes("project: 'piskelapp/piskel'") && intake.includes("license: 'Apache-2.0'") &&
    intake.includes("observedCommit: 'a6b9c02daefceb10093f71e92d52d16920ccb16e'") &&
    candidates.includes("licenseFile: 'LICENSE'"));
check('Scratch Paint is retained as AGPL reference-only at the reviewed develop commit',
    intake.includes("strategy: 'compatibility-reference'") && intake.includes("license: 'AGPL-3.0'") &&
    intake.includes("observedCommit: 'f8966f09df9a994c207db10b4ab52f530a1172d8'") &&
    intake.includes("'src/helper/view.js'") && intake.includes("'src/helper/layer.js'") &&
    intake.includes("'src/containers/paper-canvas.jsx'"));

check('all raster intake candidates reject Project/Resource/Transaction/Persistence/Timeline authority',
    ['semantic-identity', 'project', 'resource', 'transaction', 'persistence', 'timeline', 'frame-id', 'layer-id', 'cel-id']
        .every(token => intake.includes(`'${token}'`)));
check('miniPaint App Shell/File authority is explicitly rejected',
    intake.includes("'app-shell'") && intake.includes("'file-open-save'") && intake.includes("'local-persistence'"));
check('Piskel private timeline/frame/layer authority is explicitly rejected',
    intake.includes("'file-manager'") && intake.includes("'history-authority'") &&
    intake.includes("'frame-id'") && intake.includes("'layer-id'"));
check('no miniPaint/Piskel runtime dependency has been wired into the Native host during G0',
    !host.includes('minipaint') && !host.includes('miniPaint') && !host.includes('piskel') && !host.includes('Piskel'));
check('G0 compatibility boundary remains for unsupported formats after Raster Core admission',
    host.includes('NATIVE_PAINT_MODES.LEGACY_RASTER') && host.includes('mode="legacy-raster" compatibility'));

check('permanent Node tests cover shared tool profiles',
    toolTests.includes('preserves the verified Vector tool order') && toolTests.includes('shares interaction-level tools'));
check('permanent Node tests cover Bitmap/Pixel Raster policy split',
    policyTests.includes('coordinateModel') && policyTests.includes('indexed-raster') && policyTests.includes('timelineAuthority'));
check('permanent Node tests cover OSS intake authority rejection',
    intakeTests.includes('globally rejects all ARC-0001 / WS-10D / WS-10E authority leaks'));
check('permanent DOM regression proves the same Native Paint Shell can present Bitmap tools',
    shellTests.includes('renders backend-neutral Bitmap tool descriptors') && shellTests.includes("'Bitmap zoom'"));
check('G0 owns a real production Webpack entry for the changed shared Paint platform',
    webpackEntry.includes("'native-paint-shell': './src/components/native-paint/native-paint-shell.jsx'") &&
    webpackEntry.includes("'paint-tool-profiles': './src/lib/editor-shell/paint-tool-profiles.js'") &&
    webpackEntry.includes("'raster-authoring-policy': './src/lib/paint-platform/raster-authoring-policy.js'") &&
    webpackEntry.includes("'raster-backend-intake': './src/lib/paint-backends/raster-backend-intake.js'"));
check('package scripts expose the G0 production Webpack evidence command',
    packageJson.includes('test:workspace-shell:ws10g0:webpack') &&
    packageJson.includes('validate-ws10g0-webpack-shared-paint-platform-entry.js'));

const failed = checks.filter(item => !item.pass);
checks.forEach(({name, pass}, index) => console.log(`${pass ? 'PASS' : 'FAIL'} ${index + 1}/${checks.length} ${name}`));
console.log(`WS-10G0 Shared Paint Platform / Raster Intake Gate: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length) process.exit(1);
