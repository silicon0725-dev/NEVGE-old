'use strict';

const assert = require('assert');
const {
    certifyTransform2DDoD
} = require('../../../tools/conformance/check-transform2d-dod-certification');

const assertTransform2DDoDCertificationContract = () => {
    const result = certifyTransform2DDoD();
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.requirementsChecked, 12);
    assert.strictEqual(result.requirementsPassed, 12);
    return {
        certificate: result.schema,
        requirements: result.requirementsChecked,
        passed: result.requirementsPassed
    };
};

module.exports = {
    assertTransform2DDoDCertificationContract
};
