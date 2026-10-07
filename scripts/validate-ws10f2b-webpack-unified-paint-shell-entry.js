const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'build', '.ws10f2b-webpack-unified-paint-shell-entry');
const baseConfig = require('../webpack.config.js')[0];
const keepPlugin = plugin => plugin && plugin.constructor && plugin.constructor.name === 'DefinePlugin';
const config = Object.assign({}, baseConfig, {
    devtool: false,
    entry: {
        'native-paint-shell': './src/components/native-paint/native-paint-shell.jsx',
        'native-paint-host': './src/containers/native-paint-editor-host.jsx',
        'workspace-vector-editor': './src/components/workspace-paint/workspace-vector-editor.jsx'
    },
    optimization: Object.assign({}, baseConfig.optimization, {splitChunks: false}),
    output: Object.assign({}, baseConfig.output, {
        chunkFilename: '[name].[id].js',
        filename: '[name].js',
        path: OUT
    }),
    plugins: baseConfig.plugins.filter(keepPlugin)
});
fs.rmSync(OUT, {force: true, recursive: true});
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
    const info = stats.toJson({all: false, errors: true, warnings: true});
    if (stats.hasErrors()) {
        console.error(stats.toString({all: false, errors: true, errorDetails: true}));
        finish(1);
        return;
    }
    console.log('WS-10F2B Unified Paint Shell production entries Webpack smoke: PASS');
    console.log(JSON.stringify({
        errors: info.errors.length,
        warnings: info.warnings.length,
        output: path.relative(ROOT, OUT)
    }, null, 2));
    finish(0);
});
