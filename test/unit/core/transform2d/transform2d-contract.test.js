const {
    AUTHORITY_MODES,
    PROJECTION_DIRECTIONS,
    createAuthorityRegistry
} = require('../../../../src/core/authority');
const {validatePersistentDTO} = require('../../../../src/core/persistent');
const {validateProtocolDTO} = require('../../../../src/core/protocol');
const {createSchemaRegistry, validateSchemaDescriptor} = require('../../../../src/core/schema');
const {
    TRANSFORM2D_SCHEMA_DESCRIPTOR,
    TRANSFORM2D_SCHEMA_VERSION,
    TRANSFORM2D_SCRATCH_AUTHORITY_ID,
    TRANSFORM2D_SEMANTIC_PROJECTION_ID,
    TRANSFORM2D_STATE_DOMAIN,
    TRANSFORM2D_TYPE_ID,
    TRANSFORM2D_VALIDATION_ERROR,
    createTransform2DPatchComponentCommand,
    normalizeTransform2D,
    normalizeTransform2DPatch,
    registerTransform2DAuthority,
    registerTransform2DSchema,
    validateTransform2D
} = require('../../../../src/core/transform2d');

describe('Transform2D semantic contract', () => {
    test('defines a versioned backend-independent schema', () => {
        expect(TRANSFORM2D_TYPE_ID).toBe('ngvge.transform2d');
        expect(TRANSFORM2D_SCHEMA_VERSION).toBe(1);
        expect(validateSchemaDescriptor(TRANSFORM2D_SCHEMA_DESCRIPTOR).valid).toBe(true);
        expect(TRANSFORM2D_SCHEMA_DESCRIPTOR.properties.position.default).toEqual([0, 0]);
        expect(TRANSFORM2D_SCHEMA_DESCRIPTOR.properties.rotation.unit).toBe('degrees');
        expect(TRANSFORM2D_SCHEMA_DESCRIPTOR.properties.scale.default).toEqual([1, 1]);
    });

    test('normalizes portable persistent values and defaults', () => {
        const normalized = normalizeTransform2D({position: [10, -20]});
        expect(normalized).toEqual({position: [10, -20], rotation: 0, scale: [1, 1]});
        expect(validatePersistentDTO(normalized).valid).toBe(true);
        expect(Object.isFrozen(normalized)).toBe(true);
        expect(Object.isFrozen(normalized.position)).toBe(true);
    });

    test('rejects backend or compatibility fields from component data', () => {
        const result = validateTransform2D({
            position: [0, 0],
            rotation: 0,
            scale: [1, 1],
            targetRuntimeId: 'volatile-target'
        });
        expect(result.valid).toBe(false);
        expect(result.issues.some(issue => issue.code === 'transform2d.field-unknown')).toBe(true);
        expect(() => normalizeTransform2D({targetRuntimeId: 'volatile-target'})).toThrow(expect.objectContaining({
            code: TRANSFORM2D_VALIDATION_ERROR
        }));
    });

    test('rejects non-finite transform values', () => {
        expect(() => normalizeTransform2D({position: [Infinity, 0]})).toThrow(expect.objectContaining({
            code: TRANSFORM2D_VALIDATION_ERROR
        }));
        expect(() => normalizeTransform2D({rotation: NaN})).toThrow(expect.objectContaining({
            code: TRANSFORM2D_VALIDATION_ERROR
        }));
    });

    test('normalizes partial component patches without inventing untouched fields', () => {
        expect(normalizeTransform2DPatch({rotation: 45})).toEqual({rotation: 45});
        expect(() => normalizeTransform2DPatch({})).toThrow(expect.objectContaining({
            code: TRANSFORM2D_VALIDATION_ERROR
        }));
    });

    test('registers the schema in the generic Schema Registry', () => {
        const registry = createSchemaRegistry();
        registerTransform2DSchema(registry);
        expect(registry.get(TRANSFORM2D_TYPE_ID, 1)).toEqual(TRANSFORM2D_SCHEMA_DESCRIPTOR);
    });

    test('registers Scratch as the unique writer and NGVGE as authority projection', () => {
        const registry = createAuthorityRegistry();
        registerTransform2DAuthority(registry);
        expect(registry.getWriter(TRANSFORM2D_STATE_DOMAIN)).toMatchObject({
            authorityId: TRANSFORM2D_SCRATCH_AUTHORITY_ID,
            mode: AUTHORITY_MODES.WRITER
        });
        expect(registry.get(TRANSFORM2D_STATE_DOMAIN, TRANSFORM2D_SEMANTIC_PROJECTION_ID)).toMatchObject({
            mode: AUTHORITY_MODES.PROJECTION,
            projectionDirection: PROJECTION_DIRECTIONS.AUTHORITY_TO_PROJECTION
        });
    });

    test('expresses editor mutation as a portable PatchComponent command', () => {
        const command = createTransform2DPatchComponentCommand({
            componentId: 'runtime-component:transform:abcdefgh',
            nodeId: 'ngvge:node:abcdefgh',
            patch: {position: [25, 50], rotation: 15}
        });
        expect(command.kind).toBe('command');
        expect(command.type).toBe('PatchComponent');
        expect(command.payload.nodeId).toBe('ngvge:node:abcdefgh');
        expect(command.payload.patch).toEqual({position: [25, 50], rotation: 15});
        expect(validateProtocolDTO(command).valid).toBe(true);
    });
});
