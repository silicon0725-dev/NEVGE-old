#!/usr/bin/env node
'use strict';

const {assertGitMyersDiffContract} = require('../../test/regression/contracts/git-myers-diff');

const result = assertGitMyersDiffContract();
console.log('R2 Git Myers Diff validation passed.');
console.log(JSON.stringify(result, null, 2));
