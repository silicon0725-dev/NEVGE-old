#!/usr/bin/env node
'use strict';
const {assertRuntimeDetachedPersistenceContract} = require('./contracts/runtime-detached-persistence');
console.log(JSON.stringify(assertRuntimeDetachedPersistenceContract(), null, 2));
