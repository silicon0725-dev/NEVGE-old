#!/usr/bin/env node
'use strict';

const {assertRuntimeDetachedPersistenceContract} = require('../../test/regression/contracts/runtime-detached-persistence');

const summary = assertRuntimeDetachedPersistenceContract();
console.log('R1 Runtime detached persistence validation passed.');
console.log(JSON.stringify(summary));
