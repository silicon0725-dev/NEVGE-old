/* eslint-disable global-require */
const baseJest = require('./package.json').jest || {};

module.exports = Object.assign({}, baseJest, {
    rootDir: '.',
    setupFiles: (baseJest.setupFiles || []).concat([
        '<rootDir>/test/unit/support/test-dom-environment.js'
    ])
});
