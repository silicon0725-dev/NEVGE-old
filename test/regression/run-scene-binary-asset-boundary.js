#!/usr/bin/env node
'use strict';

const {assertSceneBinaryAssetBoundaryContract} = require('./contracts/scene-binary-asset-boundary');

assertSceneBinaryAssetBoundaryContract().then(summary => {
    console.log('Scene binary asset Module boundary regression passed.');
    console.log(JSON.stringify(summary, null, 2));
}).catch(error => {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
});
