/* eslint-disable strict */
'use strict';

module.exports = {
    testEnvironment: 'node',
    transform: {
        '^.+\\.[jt]sx?$': '<rootDir>/scripts/jest-transform-lsc-g1.js'
    }
};
