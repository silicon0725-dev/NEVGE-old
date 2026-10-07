const {
    PERSISTENT_DTO_SCHEMA,
    PersistentDTOValidationError,
    assertPersistentDTO,
    clonePersistentDTO,
    validatePersistentDTO
} = require('../../../../src/core/persistent');

describe('ARC-C001 Persistent DTO foundation', () => {
    test('accepts plain backend-independent DTO data and deep-clones it', () => {
        const source = {
            enabled: true,
            items: [1, null, 'node', {value: 42}],
            nested: {kind: 'semantic'}
        };
        const result = validatePersistentDTO(source);
        const clone = clonePersistentDTO(source);

        expect(result).toMatchObject({schema: PERSISTENT_DTO_SCHEMA, valid: true});
        expect(Object.isFrozen(result)).toBe(true);
        expect(Object.isFrozen(result.issues)).toBe(true);
        expect(clone).toEqual(source);
        expect(clone).not.toBe(source);
        expect(clone.nested).not.toBe(source.nested);
    });

    test.each([
        ['undefined', {value: undefined}, 'persistent.value.undefined'],
        ['function', {value: () => true}, 'persistent.value.function'],
        ['symbol', {value: Symbol('runtime')}, 'persistent.value.symbol'],
        ['bigint', {value: BigInt(1)}, 'persistent.value.bigint'],
        ['non-finite number', {value: Number.NaN}, 'persistent.number.non-finite'],
        ['promise', {value: Promise.resolve(true)}, 'persistent.object.non-plain'],
        ['date', {value: new Date(0)}, 'persistent.object.non-plain'],
        ['map', {value: new Map()}, 'persistent.object.non-plain'],
        ['typed array', {value: new Uint8Array([1])}, 'persistent.object.non-plain']
    ])('rejects %s without sanitizing it', (label, value, code) => {
        const result = validatePersistentDTO(value);
        expect(result.valid).toBe(false);
        expect(result.issues.map(issue => issue.code)).toContain(code);
        expect(() => assertPersistentDTO(value)).toThrow(PersistentDTOValidationError);
        expect(() => clonePersistentDTO(value)).toThrow(PersistentDTOValidationError);
    });

    test('rejects cycles, accessors, non-enumerable fields and sparse/custom arrays', () => {
        const circular = {};
        circular.self = circular;

        const accessor = {};
        Object.defineProperty(accessor, 'value', {enumerable: true, get: () => 1});

        const hidden = {};
        Object.defineProperty(hidden, 'value', {enumerable: false, value: 1});

        const sparse = [];
        sparse.length = 2;
        sparse[1] = 'value';

        const custom = [];
        custom.extra = true;

        expect(validatePersistentDTO(circular).issues.map(issue => issue.code)).toContain('persistent.object.cycle');
        expect(validatePersistentDTO(accessor).issues.map(issue => issue.code)).toContain('persistent.object.accessor');
        expect(validatePersistentDTO(hidden).issues.map(issue => issue.code)).toContain('persistent.object.non-enumerable');
        expect(validatePersistentDTO(sparse).issues.map(issue => issue.code)).toContain('persistent.array.sparse');
        expect(validatePersistentDTO(custom).issues.map(issue => issue.code)).toContain('persistent.array.custom-property');
    });

    test('returns immutable structured issues and honors maxIssues/path', () => {
        const result = validatePersistentDTO({a: undefined, b: undefined}, {maxIssues: 1, path: '$project'});

        expect(result.valid).toBe(false);
        expect(result.issues).toHaveLength(1);
        expect(result.issues[0]).toMatchObject({path: '$project.a', valueType: 'undefined'});
        expect(Object.isFrozen(result.issues[0])).toBe(true);
    });

    test('top-level undefined is opt-in only for compatibility callers', () => {
        expect(validatePersistentDTO(undefined).valid).toBe(false);
        expect(validatePersistentDTO(undefined, {allowTopLevelUndefined: true}).valid).toBe(true);
        expect(clonePersistentDTO(undefined, {allowTopLevelUndefined: true})).toBeUndefined();
    });
});
