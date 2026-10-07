#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const loadBabelModule = require('./load-babel-module');

const moduleExports = loadBabelModule(path.resolve(__dirname, '../../src/lib/git/diff-utils.js'));
const MyersDiff = moduleExports.default;

assert(MyersDiff && typeof MyersDiff.compute === 'function', 'MyersDiff.compute must be available.');

const result = MyersDiff.compute('a', 'b');
assert.strictEqual(result.totalAdditions, 1, 'Replacement must contain one addition.');
assert.strictEqual(result.totalDeletions, 1, 'Replacement must contain one deletion.');
assert.strictEqual(result.hunks.length, 1, 'Replacement must produce one hunk.');

console.log('PASS: Myers Diff handles a one-line replacement.');
