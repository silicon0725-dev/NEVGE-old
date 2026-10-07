const fs = require('fs');
const path = require('path');
const webpack = require('webpack');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'build', '.ws10g1-webpack-raster-entry');
const baseConfig = require('../webpack.config.js')[0];
const keepPlugin = plugin => plugin && plugin.constructor && plugin.constructor.name === 'DefinePlugin';
const config = Object.assign({}, baseConfig, {
    devtool: false,
    entry: {
        'workspace-raster-editor': './src/components/workspace-paint/workspace-raster-editor.jsx',
        'canvas-raster-backend': './src/lib/paint-backends/canvas-raster-backend.js',
        'canvas-raster-transfer': './src/lib/paint-backends/canvas-raster-transfer.js',
        'native-paint-host-model': './src/lib/editor-shell/native-paint-host.js',
        'native-paint-shell': './src/components/native-paint/native-paint-shell.jsx'
    },
    mode: 'production',
    optimization: Object.assign({}, baseConfig.optimization, {splitChunks: false}),
    output: Object.assign({}, baseConfig.output, {chunkFilename: '[name].[id].js', filename: '[name].js', path: OUT}),
    plugins: baseConfig.plugins.filter(keepPlugin)
});
fs.rmSync(OUT, {force: true, recursive: true});
const compiler = webpack(config);
const finish = code => {
    process.exitCode = code;
    if (typeof compiler.close === 'function') return compiler.close(error => { if (error) { console.error(error.stack || error); process.exitCode = 1; } });
    setImmediate(() => process.exit(code));
};
compiler.run((error, stats) => {
    if (error) { console.error(error.stack || error); finish(1); return; }
    const info = stats.toJson({all: false, errors: true, warnings: true});
    if (stats.hasErrors()) { console.error(stats.toString({all: false, errors: true, errorDetails: true})); finish(1); return; }
    console.log('WS-10G1 Shared Raster Core production entries Webpack smoke: PASS');
    console.log(JSON.stringify({errors: info.errors.length, warnings: info.warnings.length, output: path.relative(ROOT, OUT)}, null, 2));
    finish(0);
});
