const {
    SCHEMA_DESCRIPTOR_SCHEMA,
    SCHEMA_PROPERTY_PERSISTENCE,
    SCHEMA_REGISTRY_DUPLICATE,
    SchemaDescriptorValidationError,
    createSchemaRegistry,
    normalizeSchemaDescriptor,
    validateSchemaDescriptor
} = require('../../../../src/core/schema');

const createTransformSchema = (version = 1) => ({
    properties: {
        position: {
            default: [0, 0],
            persistence: SCHEMA_PROPERTY_PERSISTENCE.PERSISTENT,
            type: 'vec2'
        },
        rotation: {
            default: 0,
            maximum: 360,
            minimum: -360,
            type: 'angle',
            unit: 'degrees'
        },
        runtimeDirty: {
            default: false,
            persistence: SCHEMA_PROPERTY_PERSISTENCE.RUNTIME_ONLY,
            type: 'boolean'
        }
    },
    typeId: 'ngvge.transform2d',
    version
});

describe('ARC-C001 Schema Registry Foundation', () => {
    test('normalizes and freezes versioned schema/property metadata', () => {
        const normalized = normalizeSchemaDescriptor(createTransformSchema());

        expect(normalized).toEqual(expect.objectContaining({
            typeId: 'ngvge.transform2d',
            version: 1
        }));
        expect(normalized.properties.rotation).toEqual(expect.objectContaining({
            default: 0,
            maximum: 360,
            minimum: -360,
            nullable: false,
            persistence: 'persistent',
            type: 'angle',
            unit: 'degrees'
        }));
        expect(Object.isFrozen(normalized)).toBe(true);
        expect(Object.isFrozen(normalized.properties)).toBe(true);
        expect(Object.isFrozen(normalized.properties.rotation)).toBe(true);
    });

    test('rejects invalid descriptor shape, version, typeId and unknown metadata', () => {
        expect(validateSchemaDescriptor(null)).toMatchObject({schema: SCHEMA_DESCRIPTOR_SCHEMA, valid: false});
        expect(validateSchemaDescriptor({properties: {}, typeId: 'bad id', version: 0}).issues.map(issue => issue.code))
            .toEqual(expect.arrayContaining(['schema.type-id.format-invalid', 'schema.version.invalid']));
        expect(() => normalizeSchemaDescriptor({
            extra: true,
            properties: {},
            typeId: 'test.schema',
            version: 1
        })).toThrow(SchemaDescriptorValidationError);
    });

    test('rejects unsafe property names and invalid property metadata', () => {
        const result = validateSchemaDescriptor({
            properties: {
                constructor: {type: 'string'},
                value: {maximum: 1, minimum: 2, nullable: 'yes', persistence: 'sometimes', type: ''}
            },
            typeId: 'test.schema',
            version: 1
        });
        expect(result.valid).toBe(false);
        expect(result.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
            'schema.property.name.invalid',
            'schema.property.type.invalid',
            'schema.property.nullable.invalid',
            'schema.property.persistence.invalid',
            'schema.property.range.invalid'
        ]));
    });

    test('requires defaults and validation metadata to remain persistent DTO data', () => {
        const invalidDefault = validateSchemaDescriptor({
            properties: {value: {default: () => true, type: 'callable'}},
            typeId: 'test.default',
            version: 1
        });
        const invalidValidation = validateSchemaDescriptor({
            properties: {value: {type: 'number', validation: {provider: () => true}}},
            typeId: 'test.validation',
            version: 1
        });
        expect(invalidDefault.issues.map(issue => issue.code)).toContain('schema.property.default.invalid');
        expect(invalidValidation.issues.map(issue => issue.code)).toContain('schema.property.validation.invalid');
    });

    test('rejects null defaults unless nullable is explicit', () => {
        expect(validateSchemaDescriptor({
            properties: {value: {default: null, type: 'resource'}},
            typeId: 'test.null',
            version: 1
        }).issues.map(issue => issue.code)).toContain('schema.property.default.nullability-conflict');
        expect(validateSchemaDescriptor({
            properties: {value: {default: null, nullable: true, type: 'resource'}},
            typeId: 'test.nullable',
            version: 1
        }).valid).toBe(true);
    });

    test('registers multiple versions and resolves the highest as current', () => {
        const registry = createSchemaRegistry([createTransformSchema(1)]);
        registry.register(createTransformSchema(3));
        registry.register(createTransformSchema(2));

        expect(registry.get('ngvge.transform2d').version).toBe(3);
        expect(registry.get('ngvge.transform2d', 2).version).toBe(2);
        expect(registry.getVersions('ngvge.transform2d')).toEqual([1, 2, 3]);
        expect(registry.getRevision()).toBe(3);
    });

    test('rejects duplicate type/version registration without replacing authority', () => {
        const registry = createSchemaRegistry([createTransformSchema(1)]);
        expect(() => registry.register(createTransformSchema(1))).toThrow(expect.objectContaining({
            code: SCHEMA_REGISTRY_DUPLICATE,
            typeId: 'ngvge.transform2d',
            version: 1
        }));
        expect(registry.list()).toHaveLength(1);
    });

    test('registerMany is atomic when any descriptor collides or is invalid', () => {
        const registry = createSchemaRegistry([createTransformSchema(1)]);
        expect(() => registry.registerMany([
            {properties: {}, typeId: 'test.good', version: 1},
            createTransformSchema(1)
        ])).toThrow(expect.objectContaining({code: SCHEMA_REGISTRY_DUPLICATE}));
        expect(registry.has('test.good')).toBe(false);

        expect(() => registry.registerMany([
            {properties: {}, typeId: 'test.good', version: 1},
            {properties: {}, typeId: '', version: 1}
        ])).toThrow(SchemaDescriptorValidationError);
        expect(registry.has('test.good')).toBe(false);
    });

    test('returns immutable registry snapshots and deterministically sorted schemas', () => {
        const registry = createSchemaRegistry([
            {properties: {}, typeId: 'z.schema', version: 1},
            {properties: {}, typeId: 'a.schema', version: 2},
            {properties: {}, typeId: 'a.schema', version: 1}
        ]);
        const snapshot = registry.snapshot();
        expect(snapshot.schemas.map(schema => `${schema.typeId}@${schema.version}`)).toEqual([
            'a.schema@1',
            'a.schema@2',
            'z.schema@1'
        ]);
        expect(Object.isFrozen(snapshot)).toBe(true);
        expect(Object.isFrozen(snapshot.schemas)).toBe(true);
    });
});
