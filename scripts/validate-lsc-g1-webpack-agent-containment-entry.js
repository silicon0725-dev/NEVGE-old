/* eslint-disable no-console, strict */
'use strict';

const fs = require('fs');
const path = require('path');
const webpack = require('webpack');

const ROOT = path.resolve(__dirname, '..');
const configs = require('../webpack.config.js');
const base = Array.isArray(configs) ? configs[0] : configs;
const OUT = path.join(ROOT, 'build', '.lsc-g1-webpack-agent-containment');

fs.rmSync(OUT, {force: true, recursive: true});
fs.mkdirSync(OUT, {recursive: true});

const config = {
    ...base,
    devtool: false,
    entry: path.join(ROOT, 'src/addons/addons/02agent/hooks/useBridgeClient.ts'),
    mode: 'development',
    name: 'lsc-g1-agent-containment-entry',
    output: {
        ...base.output,
        filename: 'lsc-g1-agent-containment.js',
        path: OUT
    },
    plugins: (base.plugins || []).filter(plugin => {
        const name = plugin && plugin.constructor ? plugin.constructor.name : '';
        return !['CleanWebpackPlugin', 'CopyPlugin', 'HtmlWebpackPlugin'].includes(name);
    })
};

const compiler = webpack(config);
const finish = exitCode => {
    if (typeof compiler.close === 'function') {
        compiler.close(error => {
            if (error) {
                console.error(error.stack || error);
                process.exitCode = 1;
                return;
            }
            process.exitCode = exitCode;
        });
        return;
    }
    setImmediate(() => {
        process.exitCode = exitCode;
    });
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
    console.log('LSC-G1 real Webpack Agent containment production entry: PASS');
    console.log(JSON.stringify({
        entry: 'src/addons/addons/02agent/hooks/useBridgeClient.ts',
        errors: info.errors.length,
        output: path.relative(ROOT, OUT),
        warnings: info.warnings.length,
        webpackConfig: 'webpack.config.js[0]'
    }, null, 2));
    finish(0);
});
