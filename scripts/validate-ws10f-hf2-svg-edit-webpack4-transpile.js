const fs = require('fs');
const path = require('path');
const webpack = require('webpack');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_ROOT = path.join(ROOT, 'build', '.ws10f-hf2-svg-edit-modern-syntax');
const PACKAGE_ROOT = path.join(FIXTURE_ROOT, 'node_modules', '@svgedit', 'svgcanvas');
const DIST_ROOT = path.join(PACKAGE_ROOT, 'dist');
const OUT = path.join(FIXTURE_ROOT, 'out');
const webpackConfigText = fs.readFileSync(path.join(ROOT, 'webpack.config.js'), 'utf8');

const fail = message => {
    throw new Error(`WS-10F HF2 validation failed: ${message}`);
};

// Keep the allowlist check textual as well as executable so an accidental broad
// "transpile all node_modules" change cannot make this gate pass for the wrong reason.
if (!webpackConfigText.includes('/node_modules[\\\\/]@svgedit[\\\\/]svgcanvas[\\\\/]/')) {
    fail('approved SVG-Edit Babel transpilation allowlist is missing');
}

fs.rmSync(FIXTURE_ROOT, {force: true, recursive: true});
fs.mkdirSync(DIST_ROOT, {recursive: true});
fs.mkdirSync(OUT, {recursive: true});

fs.writeFileSync(path.join(PACKAGE_ROOT, 'package.json'), JSON.stringify({
    name: '@svgedit/svgcanvas',
    version: '7.4.2-hf2-fixture',
    main: 'dist/svgcanvas.js'
}, null, 2));

// Webpack 4's parser rejects optional chaining/nullish coalescing unless this
// node_modules package is passed through Babel first. This intentionally models
// the syntax used by modern SVG-Edit builds.
fs.writeFileSync(path.join(DIST_ROOT, 'svgcanvas.js'), `
export default class SvgCanvasFixture {
    constructor (container, config) {
        this.container = container;
        this.mode = config?.initTool ?? 'select';
    }

    getMode () {
        return this.container?.dataset?.mode ?? this.mode;
    }
}
`);
fs.writeFileSync(path.join(FIXTURE_ROOT, 'entry.js'), `
import SvgCanvas from '@svgedit/svgcanvas';
export default SvgCanvas;
`);

const baseConfig = require('../webpack.config.js')[0];
const keepPlugin = plugin => plugin && plugin.constructor && plugin.constructor.name === 'DefinePlugin';
const config = Object.assign({}, baseConfig, {
    context: FIXTURE_ROOT,
    devtool: false,
    entry: './entry.js',
    mode: 'development',
    resolve: Object.assign({}, baseConfig.resolve, {
        modules: [path.join(FIXTURE_ROOT, 'node_modules'), path.join(ROOT, 'node_modules')],
        alias: Object.assign({}, baseConfig.resolve.alias, {
            '@svgedit/svgcanvas$': path.join(DIST_ROOT, 'svgcanvas.js')
        })
    }),
    optimization: Object.assign({}, baseConfig.optimization, {splitChunks: false}),
    output: Object.assign({}, baseConfig.output, {
        filename: 'bundle.js',
        chunkFilename: '[name].[id].js',
        path: OUT
    }),
    plugins: baseConfig.plugins.filter(keepPlugin)
});

const compiler = webpack(config);
const finish = code => {
    process.exitCode = code;
    if (typeof compiler.close === 'function') {
        return compiler.close(error => {
            if (error) {
                console.error(error.stack || error);
                process.exitCode = 1;
            }
        });
    }
    setImmediate(() => process.exit(code));
};

compiler.run((error, stats) => {
    if (error) {
        console.error(error.stack || error);
        finish(1);
        return;
    }
    if (stats.hasErrors()) {
        console.error(stats.toString({all: false, errors: true, errorDetails: true}));
        finish(1);
        return;
    }
    const bundle = fs.readFileSync(path.join(OUT, 'bundle.js'), 'utf8');
    if (bundle.includes('config?.initTool') || bundle.includes('dataset?.mode')) {
        console.error('WS-10F HF2 validation failed: modern SVG-Edit fixture syntax escaped Babel transpilation');
        finish(1);
        return;
    }
    console.log('WS-10F HF2 Webpack 4 SVG-Edit transpilation gate: PASS');
    console.log(JSON.stringify({
        package: '@svgedit/svgcanvas',
        modeledVersion: '7.4.2',
        syntax: ['optional-chaining', 'nullish-coalescing'],
        webpackMajor: 4,
        errors: 0
    }, null, 2));
    finish(0);
});
