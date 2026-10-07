'use strict';

const {
    isFacadeArrayLike,
    materializePortableCapabilityValue
} = require('../../../../src/lib/first-party-modules/materialize-portable-capability-value');

const makeFacadeArray = values => {
    const value = Object.create(null);
    values.forEach((entry, index) => {
        value[index] = entry;
    });
    Object.defineProperty(value, 'length', {
        configurable: true,
        enumerable: false,
        value: values.length,
        writable: false
    });
    return value;
};

describe('portable capability value materialization', () => {
    test('copies service-facade array-like values into real portable arrays recursively', () => {
        const source = Object.create(null);
        source.components = makeFacadeArray([{
            data: {
                position: makeFacadeArray([0, 0]),
                scale: makeFacadeArray([1, 0.5])
            },
            typeId: 'ngvge.transform2d'
        }]);

        const result = materializePortableCapabilityValue(source);

        expect(isFacadeArrayLike(source.components)).toBe(true);
        expect(Array.isArray(result.components)).toBe(true);
        expect(Array.isArray(result.components[0].data.position)).toBe(true);
        expect(Array.isArray(result.components[0].data.scale)).toBe(true);
        expect(result).toEqual({
            components: [{
                data: {position: [0, 0], scale: [1, 0.5]},
                typeId: 'ngvge.transform2d'
            }]
        });
    });

    test('does not reinterpret normal records that merely expose a non-numeric key alongside length', () => {
        const source = {length: 2, name: 'record'};
        expect(isFacadeArrayLike(source)).toBe(false);
        expect(materializePortableCapabilityValue(source)).toEqual(source);
    });
});
