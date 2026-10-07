const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'build', '.ws10b-webpack-paint-content-entry');
const baseConfig = require('../webpack.config.js')[0];
const keepPlugin = plugin => plugin && plugin.constructor && plugin.constructor.name === 'DefinePlugin';
const config = Object.assign({}, baseConfig, {
    devtool: false,
    entry: {
        'resource-content-read': './src/lib/editor-shell/workspace-resource-content-capability.js',
        'paint-working-copy': './src/lib/editor-shell/paint-working-copy.js',
        'scratch-paint-working-copy-adapter': './src/lib/editor-shell/scratch-paint-working-copy-adapter.js',
        'workspace-paint': './src/components/workspace-paint/workspace-paint.jsx',
        'capability-providers': './src/lib/editor-shell/workspace-capability-providers.js'
    },
    optimization: Object.assign({}, baseConfig.optimization, {splitChunks: false}),
    output: Object.assign({}, baseConfig.output, {chunkFilename: '[name].[id].js', filename: '[name].js', path: OUT}),
    plugins: baseConfig.plugins.filter(keepPlugin)
});
fs.rmSync(OUT, {force: true, recursive: true});
const compiler = webpack(config);
const finish = exitCode => {
    process.exitCode = exitCode;
    if (typeof compiler.close === 'function') return compiler.close(error => {
        if (error) { console.error(error.stack || error); process.exitCode = 1; }
    });
    setImmediate(() => process.exit(exitCode));
};
compiler.run((error, stats) => {
    if (error) { console.error(error.stack || error); finish(1); return; }
    const info = stats.toJson({all: false, errors: true, warnings: true});
    if (stats.hasErrors()) { console.error(stats.toString({all: false, errors: true, errorDetails: true})); finish(1); return; }
    console.log('WS-10B real Webpack Paint content/working-copy entries smoke: PASS');
    console.log(JSON.stringify({errors: info.errors.length, warnings: info.warnings.length, output: path.relative(ROOT, OUT)}, null, 2));
    finish(0);
});
