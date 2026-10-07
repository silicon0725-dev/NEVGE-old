const fs = require('fs');
const path = require('path');
const webpack = require('webpack');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'build', '.ws7-webpack-agent-entry');
const baseConfig = require('../webpack.config.js')[0];
const keepPlugin = plugin => plugin && plugin.constructor && plugin.constructor.name === 'DefinePlugin';
const config = Object.assign({}, baseConfig, {
    devtool: false,
    entry: {agent: './src/components/workspace-agent/workspace-agent.jsx'},
    optimization: Object.assign({}, baseConfig.optimization, {splitChunks: false}),
    output: Object.assign({}, baseConfig.output, {
        chunkFilename: '[name].[id].js', filename: '[name].js', path: OUT
    }),
    plugins: baseConfig.plugins.filter(keepPlugin)
});
fs.rmSync(OUT, {force: true, recursive: true});
const compiler = webpack(config);
const finish = exitCode => {
    process.exitCode = exitCode;
    if (typeof compiler.close === 'function') {
        compiler.close(closeError => {
            if (closeError) {
                console.error(closeError.stack || closeError);
                process.exitCode = 1;
            }
        });
        return;
    }
    setImmediate(() => process.exit(exitCode));
};
compiler.run((error, stats) => {
    if (error) {
        console.error(error.stack || error);
        if (error.details) console.error(error.details);
        finish(1);
        return;
    }
    const info = stats.toJson({all: false, errors: true, warnings: true});
    if (stats.hasErrors()) {
        console.error(stats.toString({all: false, colors: false, errors: true, errorDetails: true}));
        finish(1);
        return;
    }
    console.log('WS-7 real Webpack Agent production entry smoke: PASS');
    console.log(JSON.stringify({
        entry: 'src/components/workspace-agent/workspace-agent.jsx',
        errors: info.errors.length,
        output: path.relative(ROOT, OUT),
        warnings: info.warnings.length,
        webpackConfig: 'webpack.config.js[0]'
    }, null, 2));
    finish(0);
});
