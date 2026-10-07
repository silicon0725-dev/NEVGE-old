#!/usr/bin/env node
'use strict';
const {assertGitMyersDiffContract} = require('./contracts/git-myers-diff');
console.log(JSON.stringify(assertGitMyersDiffContract(), null, 2));
