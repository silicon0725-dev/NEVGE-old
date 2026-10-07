import {
    PersistentDataValidationError,
    clonePersistentData,
    validatePersistentData
} from '../../../../src/lib/persistence';

describe('NGVGE persistent data contract', () => {
    test('accepts and clones JSON-compatible plain data', () => {
        const source = {
            array: [1, true, null, {name: 'Node'}],
            nested: {value: 42}
        };
        const cloned = clonePersistentData(source);

        expect(cloned).toEqual(source);
        expect(cloned).not.toBe(source);
        expect(cloned.nested).not.toBe(source.nested);
        expect(validatePersistentData(source)).toMatchObject({valid: true});
    });

    test.each([
        ['function', {value: () => true}, 'persistent.value.function'],
        ['undefined', {value: undefined}, 'persistent.value.undefined'],
        ['infinite number', {value: Number.POSITIVE_INFINITY}, 'persistent.number.non-finite'],
        ['class instance', {value: new Date()}, 'persistent.object.non-plain'],
        ['promise instance', {value: Promise.resolve(true)}, 'persistent.object.non-plain']
    ])('rejects %s values instead of silently rewriting them', (label, value, code) => {
        const result = validatePersistentData(value);

        expect(result.valid).toBe(false);
        expect(result.issues.map(issue => issue.code)).toContain(code);
        expect(() => clonePersistentData(value)).toThrow(PersistentDataValidationError);
    });

    test('rejects circular and sparse structures', () => {
        const circular = {};
        circular.self = circular;
        const sparse = [];
        sparse.length = 2;
        sparse[1] = 'value';

        expect(validatePersistentData(circular).issues.map(issue => issue.code))
            .toContain('persistent.object.cycle');
        expect(validatePersistentData(sparse).issues.map(issue => issue.code))
            .toContain('persistent.array.sparse');
    });
});
