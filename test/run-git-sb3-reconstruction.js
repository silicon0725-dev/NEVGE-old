#!/usr/bin/env node
'use strict';
const {assertGitSb3ReconstructionContract} = require('./contracts/git-sb3-reconstruction');
assertGitSb3ReconstructionContract().then(result => {
    console.log(JSON.stringify(result, null, 2));
}).catch(error => {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
});
