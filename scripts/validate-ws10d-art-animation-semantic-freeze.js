const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const files = {
    identities: 'src/lib/art-documents/art-document-identities.js',
    raster: 'src/lib/art-documents/animated-raster-document-schema.js',
    vector: 'src/lib/art-documents/vector-art-document-schema.js',
    paint: 'src/lib/art-documents/paint-document-schema.js',
    freeze: 'docs/architecture/workspace/WS-10D-2D-ART-ANIMATION-SEMANTIC-FREEZE.md',
    matrix: 'docs/architecture/workspace/WS-10D-semantic-ownership-matrix.csv'
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

const identities = read(files.identities);
const raster = read(files.raster);
const vector = read(files.vector);
const paint = read(files.paint);
const freeze = read(files.freeze);
const matrix = read(files.matrix);
const semanticSources = `${identities}\n${raster}\n${vector}\n${paint}`;

check('stable-contract-id', () => paint.includes("ngvge.paint-document-contract@1"));
check('vector-schema-id', () => vector.includes("ngvge.vector-art-document@1"));
check('animated-raster-schema-id', () => raster.includes("ngvge.animated-raster-document@1"));
check('layer-frame-cel-identities', () => [
    'ngvge:art-layer:',
    'ngvge:animation-frame:',
    'ngvge:animation-cel:',
    'ngvge:cel-content:'
].every(token => identities.includes(token)));
check('clip-marker-palette-slice-identities', () => [
    'ngvge:animation-clip:',
    'ngvge:animation-marker:',
    'ngvge:palette:',
    'ngvge:slice:'
].every(token => identities.includes(token)));
check('linked-cel-shared-content', () => freeze.includes('Shared `CelContentId`') || freeze.includes('shared `CelContentId`'));
check('raster-modes', () => raster.includes("['bitmap', 'pixel']"));
check('layer-semantics', () => ['alphaLocked', 'clipToLayerId', 'maskTargetLayerId'].every(token => raster.includes(token)));
check('clip-playback', () => ['once', 'loop', 'ping-pong', 'reverse'].every(token => raster.includes(`'${token}'`)));
check('portable-marker-payload', () => raster.includes('normalizePortableJson') && freeze.includes('portable JSON'));
check('indexed-palette-owner', () => raster.includes('Indexed animated raster document requires a Palette semantic owner'));
check('slice-semantics', () => ['nine-slice', 'hitbox', 'hurtbox'].every(token => raster.includes(`'${token}'`)));
check('vector-canonical-svg', () => vector.includes("sourceFormat !== 'svg'") && freeze.includes('canonical SVG'));
check('authoring-not-export', () => freeze.includes('Authoring Source') && freeze.includes('sprite sheet'));
check('editor-state-not-project', () => freeze.includes('onion skin') && freeze.includes('Workspace / Tool session persistence'));
check('reserved-tilemap-not-invented', () => freeze.includes('TileSet / Tilemap authoring schema') && freeze.includes('Reserved'));
check('ownership-matrix', () => matrix.includes('Backend Working Session') && matrix.includes('NGVGE'));
check('no-backend-imports', () => !/(scratch-paint|svgedit|minipaint|piskel|pixelorama)/i.test(semanticSources));
check('no-raw-authority-imports', () => !/(Scratch\.vm|ScratchTarget|renderer|window\.vm|vm\.)/.test(semanticSources));
check('no-production-behavior-switch', () => freeze.includes('No production Paint behavior switches in WS-10D'));

const failed = checks.filter(item => !item.passed);
checks.forEach(item => console.log(`${item.passed ? 'PASS' : 'FAIL'} ${item.name}${item.detail ? ` :: ${item.detail}` : ''}`));
console.log(`WS-10D semantic freeze machine checks: ${checks.length - failed.length}/${checks.length} PASS`);
if (failed.length) process.exit(1);
