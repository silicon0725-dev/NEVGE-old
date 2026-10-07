'use strict';

const assert = require('assert');
const path = require('path');
const {
    readRepositorySnapshot,
    validateMinimumBaselineSnapshot
} = require('../../../tools/conformance/check-c0011-minimum-baseline');

const assertC0011MinimumBaselineContract = () => {
    const rootDir = path.resolve(__dirname, '../../..');
    const snapshot = readRepositorySnapshot(rootDir);
    const result = validateMinimumBaselineSnapshot(snapshot);

    assert.strictEqual(
        result.valid,
        true,
        `ARC-C001.1 minimum baseline certificate drifted: ${result.issues.map(issue => `${issue.code}: ${issue.message}`).join(' | ')}`
    );
    assert.strictEqual(result.requirementsChecked, 7, 'ARC-C001.1 minimum baseline must remain a seven-requirement contract');

    return {
        certificate: snapshot.certificate.schema,
        requirements: result.requirementsChecked,
        transform0009Decision: snapshot.certificate.transform0009Decision,
        blockingMergePolicyActive: snapshot.certificate.blockingMergePolicyActive
    };
};

module.exports = {
    assertC0011MinimumBaselineContract
};
