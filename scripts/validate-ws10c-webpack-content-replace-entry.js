const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'build', '.ws10c-webpack-content-replace-entry');
const baseConfig = require('../webpack.config.js')[0];
const keepPlugin = plugin => plugin && plugin.constructor && plugin.constructor.name === 'DefinePlugin';
const config = Object.assign({}, baseConfig, {
    devtool: false,
    entry: {
        'image-content-payload': './src/lib/project-assets/image-content-payload.js',
        'global-asset-database': './src/lib/project-assets/global-asset-database.js',
        'project-command-host': './src/lib/editor-shell/project-command-host.js',
        'project-transaction-review': './src/lib/editor-shell/project-transaction-review.js',
        'paint-tool-runtime': './src/lib/editor-shell/paint-tool-runtime.js',
        'workspace-paint': './src/components/workspace-paint/workspace-paint.jsx'
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
    console.log('WS-10C real Webpack reviewed Resource content-replace entries smoke: PASS');
    console.log(JSON.stringify({errors: info.errors.length, warnings: info.warnings.length, output: path.relative(ROOT, OUT)}, null, 2));
    finish(0);
});
