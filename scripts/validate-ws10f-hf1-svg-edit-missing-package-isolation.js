const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const assertions = [];
const check = (name, condition) => {
    assertions.push({name, pass: Boolean(condition)});
    if (!condition) throw new Error(`WS-10F HF1 validation failed: ${name}`);
};

const webpackConfig = read('webpack.config.js');
const fallback = read('src/lib/paint-backends/svg-edit-vector-backend-unavailable.js');
const vectorEditor = read('src/components/workspace-paint/workspace-vector-editor.jsx');
const packageJson = JSON.parse(read('package.json'));

check('exact SVG-Edit dependency remains declared', packageJson.dependencies['@svgedit/svgcanvas'] === '7.4.2');
check('Webpack resolves optional backend before bundling', webpackConfig.includes('resolveOptionalWorkspaceBackend'));
check('SVG-Edit package alias uses the optional resolution', webpackConfig.includes("'@svgedit/svgcanvas$': svgEditCanvasResolution"));
check('missing package resolves to local fail-visible fallback', webpackConfig.includes('svg-edit-vector-backend-unavailable.js'));
check('Vector editor still imports through the approved package specifier', vectorEditor.includes("from '@svgedit/svgcanvas'"));
check('fallback has stable package-unavailable diagnostic', fallback.includes('NGVGE_PAINT_SVG_EDIT_PACKAGE_UNAVAILABLE'));
check('fallback tells developers to sync the locked dependency', fallback.includes('bun install --frozen-lockfile'));
check('fallback cannot mutate project/resource state', !/updateSvg|updateBitmap|loadProject|resource\.content\.replace/.test(fallback));

console.log(`WS-10F HF1 missing-package isolation gate: ${assertions.length}/${assertions.length} PASS`);
console.log(JSON.stringify({assertions}, null, 2));
