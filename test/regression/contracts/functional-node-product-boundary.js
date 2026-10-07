'use strict';

const assert = require('assert');
const {
    isFacadeArrayLike,
    materializePortableCapabilityValue
} = require('../../../src/lib/first-party-modules/materialize-portable-capability-value');

const createFacadeArray = values => {
    const facade = Object.create(null);
    values.forEach((value, index) => {
        facade[index] = value;
    });
    Object.defineProperty(facade, 'length', {
        configurable: false,
        enumerable: false,
        value: values.length,
        writable: false
    });
    return facade;
};

const assertFunctionalNodeProductBoundaryContract = () => {
    const raw = {
        options: {
            components: createFacadeArray([{
                data: {
                    position: createFacadeArray([0, 0]),
                    scale: createFacadeArray([1, 1])
                },
                typeId: 'ngvge.transform2d@1'
            }])
        }
    };
    assert.strictEqual(isFacadeArrayLike(raw.options.components), true);

    const materialized = materializePortableCapabilityValue(raw);
    assert.strictEqual(Array.isArray(materialized.options.components), true);
    assert.strictEqual(Array.isArray(materialized.options.components[0].data.position), true);
    assert.strictEqual(Array.isArray(materialized.options.components[0].data.scale), true);
    assert.deepStrictEqual(materialized.options.components[0].data.position, [0, 0]);
    assert.deepStrictEqual(materialized.options.components[0].data.scale, [1, 1]);

    const record = {length: 2, name: 'not-an-array'};
    assert.strictEqual(isFacadeArrayLike(record), false);
    assert.deepStrictEqual(materializePortableCapabilityValue(record), record);

    return {
        capabilityArraysMaterialized: true,
        nestedVectorsMaterialized: true,
        recordLengthNotMisclassified: true
    };
};

module.exports = {assertFunctionalNodeProductBoundaryContract};
