#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
    REQUIREMENTS,
    certifyTransform2DDoD
} = require('./check-transform2d-dod-certification');

assert.strictEqual(REQUIREMENTS.length, 12, '0009 Master Plan Transform DoD must remain a twelve-item certification contract.');
assert.deepStrictEqual(REQUIREMENTS.map(item => item.id), [
    '0009-DOD-01',
    '0009-DOD-02',
    '0009-DOD-03',
    '0009-DOD-04',
    '0009-DOD-05',
    '0009-DOD-06',
    '0009-DOD-07',
    '0009-DOD-08',
    '0009-DOD-09',
    '0009-DOD-10',
    '0009-DOD-11',
    '0009-DOD-12'
]);
assert.strictEqual(new Set(REQUIREMENTS.map(item => item.title)).size, 12, '0009 DoD requirement titles must remain unique.');

const result = certifyTransform2DDoD();
assert.strictEqual(result.schema, 'ngvge-0009-transform-dod-certificate/v1');
assert.strictEqual(result.valid, true);
assert.strictEqual(result.requirementsChecked, 12);
assert.strictEqual(result.requirementsPassed, 12);
assert.strictEqual(result.evidence.length, 12);
assert(result.evidence.every(item => item.status === 'PASS'));

process.stdout.write('0009-E Transform DoD Certification self-test PASS (12/12).\n');
