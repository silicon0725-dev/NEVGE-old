/* eslint-disable strict */
'use strict';

const babelJest = require('babel-jest');

module.exports = babelJest.createTransformer({
    plugins: [
        '@babel/plugin-syntax-dynamic-import',
        '@babel/plugin-proposal-object-rest-spread',
        '@babel/plugin-proposal-nullish-coalescing-operator'
    ],
    presets: [
        ['@babel/preset-env', {targets: {node: 'current'}}],
        '@babel/preset-react',
        '@babel/preset-typescript'
    ]
});
