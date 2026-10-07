'use strict';

const fs = require('fs');
const Module = require('module');
const path = require('path');
const babel = require('@babel/core');

/**
 * Load one repository ES-module-style source file through the project's existing
 * Babel toolchain without changing production code or requiring Jest.
 *
 * R0 uses this only for isolated bug probes under src/lib/git.
 *
 * @param {string} filename absolute or repository-relative source filename
 * @returns {*} compiled module exports
 */
module.exports = filename => {
    const absoluteFilename = path.resolve(filename);
    if (!fs.existsSync(absoluteFilename)) {
        throw new Error(`Cannot load missing module: ${absoluteFilename}`);
    }

    const transformed = babel.transformFileSync(absoluteFilename, {
        babelrc: false,
        configFile: false,
        filename: absoluteFilename,
        presets: [[require.resolve('@babel/preset-env'), {
            modules: 'commonjs',
            targets: {node: 'current'}
        }]],
        sourceMaps: 'inline'
    });

    const compiledModule = new Module(absoluteFilename, module);
    compiledModule.filename = absoluteFilename;
    compiledModule.paths = Module._nodeModulePaths(path.dirname(absoluteFilename));
    compiledModule._compile(transformed.code, absoluteFilename);
    return compiledModule.exports;
};
