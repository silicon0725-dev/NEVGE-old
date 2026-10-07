const {clonePortableData} = require('./portable-data');

const COMPONENT_CARDINALITIES = Object.freeze({
    MANY: 'many',
    ONE: 'one'
});

const LEGACY_COMPONENT_EXTENSION_NAMESPACE = 'ngvge.compat.legacy-component-record';
const COMPONENT_DATA_FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const componentSchemaVersionSpecified = new WeakMap();
const PUBLIC_COMPONENT_FIELDS = new Set(['data', 'enabled', 'id', 'schemaVersion', 'typeId']);
const IMPORT_COMPONENT_FIELDS = new Set([
    'activeInHierarchy', 'allowMultiple', 'data', 'enabled', 'extensionData', 'id', 'ownerId',
    'persistentExtras', 'ready', 'schemaVersion', 'state', 'typeId'
]);

const RUNTIME_COMPONENT_CONTRACT = Object.freeze({
    cardinality: Object.freeze({
        authority: 'component-type-descriptor',
        descriptorField: 'cardinality',
        legacyProjectionField: 'allowMultiple',
        values: Object.freeze([COMPONENT_CARDINALITIES.ONE, COMPONENT_CARDINALITIES.MANY])
    }),
    contractId: 'ngvge.runtime-component',
    contractVersion: '1',
    identity: Object.freeze({
        componentIdImmutable: true,
        componentIdStable: true,
        ownerNodeIdRuntimeDerived: true,
        schemaVersionImmutable: true,
        typeIdImmutable: true,
        uniqueWithinOwnerNode: true
    }),
    mutation: Object.freeze({
        dataMutationAtomic: true,
        dataMutationMethods: Object.freeze(['patchComponent', 'setComponentData']),
        enabledMutationMethod: 'setComponentEnabled',
        identityFieldsMutable: false,
        liveSemanticFieldsGuardedDuringMigration: true
    }),
    ownership: Object.freeze({
        componentDetachMeansOwnerRelationshipRemoved: true,
        nodeDetachDoesNotDetachComponent: true,
        oneOwnerAtATime: true
    }),
    persistence: Object.freeze({
        canonicalTopLevelFields: Object.freeze([
            'allowMultiple', 'data', 'enabled', 'extensionData', 'id', 'schemaVersion', 'typeId'
        ]),
        extensionDataNamespaced: true,
        persistentFields: Object.freeze([
            'allowMultiple', 'data', 'enabled', 'extensionData', 'id', 'schemaVersion', 'typeId'
        ]),
        runtimeOnlyFields: Object.freeze(['activeInHierarchy', 'ownerId', 'ready', 'state'])
    }),
    providerBoundary: Object.freeze({
        hooksLocalOnly: true,
        hooksPortable: false,
        runtimeInstancesExposed: false
    }),
    schemaAuthority: Object.freeze({
        currentWritableVersionAuthority: 'component-type-descriptor',
        migrationDirection: 'upgrade-only',
        migrationEdgesContiguous: true,
        migrationProvidersPortable: false,
        migrationRunsBeforeLiveConstruction: true,
        unknownTypesOpaque: true
    })
});

const normalizeComponentSchemaVersion = value => {
    if (typeof value === 'undefined' || value === null) return 1;
    if (!Number.isInteger(value) || value < 1) {
        const error = new TypeError('Runtime component schemaVersion must be a positive integer.');
        error.code = 'RUNTIME_COMPONENT_SCHEMA_VERSION_INVALID';
        throw error;
    }
    return value;
};

const normalizeComponentCardinality = value => {
    if (value === COMPONENT_CARDINALITIES.MANY) return COMPONENT_CARDINALITIES.MANY;
    if (typeof value === 'undefined' || value === null || value === COMPONENT_CARDINALITIES.ONE) {
        return COMPONENT_CARDINALITIES.ONE;
    }
    const error = new TypeError('Runtime component cardinality must be "one" or "many".');
    error.code = 'RUNTIME_COMPONENT_CARDINALITY_INVALID';
    throw error;
};

const normalizeRuntimeComponentTypeDescriptor = value => {
    const source = clonePortableData(value || {});
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
        throw new TypeError('Runtime component type descriptor must be a plain object.');
    }
    const typeId = typeof source.typeId === 'string' ? source.typeId.trim() : '';
    if (!typeId) throw new TypeError('Runtime component type descriptor requires typeId.');
    const ownerModuleId = typeof source.ownerModuleId === 'string' && source.ownerModuleId.trim() ?
        source.ownerModuleId.trim() : 'anonymous';
    return Object.freeze({
        cardinality: normalizeComponentCardinality(source.cardinality),
        ownerModuleId,
        schemaVersion: normalizeComponentSchemaVersion(source.schemaVersion),
        typeId
    });
};

const assertSafeComponentDataKeys = (value, path = '$.data', seen = new Set()) => {
    if (!value || typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
        value.forEach((item, index) => assertSafeComponentDataKeys(item, `${path}[${index}]`, seen));
        return;
    }
    Object.keys(value).forEach(key => {
        if (COMPONENT_DATA_FORBIDDEN_KEYS.has(key)) {
            const error = new TypeError(`Runtime component data key is forbidden at ${path}.${key}.`);
            error.code = 'RUNTIME_COMPONENT_DATA_KEY_FORBIDDEN';
            error.path = `${path}.${key}`;
            throw error;
        }
        assertSafeComponentDataKeys(value[key], `${path}.${key}`, seen);
    });
};

const normalizeComponentData = value => {
    const source = typeof value === 'undefined' ? {} : clonePortableData(value);
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
        const error = new TypeError('Runtime component data must be a plain object.');
        error.code = 'RUNTIME_COMPONENT_DATA_INVALID';
        throw error;
    }
    assertSafeComponentDataKeys(source);
    return source;
};

const normalizeExtensionData = value => {
    if (typeof value === 'undefined') return {};
    const source = clonePortableData(value);
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
        const error = new TypeError('Runtime component extensionData must be a plain object.');
        error.code = 'RUNTIME_COMPONENT_EXTENSION_DATA_INVALID';
        throw error;
    }
    return source;
};

const validateComponentIdentity = source => {
    const typeId = typeof source.typeId === 'string' ? source.typeId.trim() : '';
    if (!typeId) {
        const error = new TypeError('Runtime component typeId must be a non-empty string.');
        error.code = 'RUNTIME_COMPONENT_TYPE_INVALID';
        throw error;
    }
    if (typeof source.id !== 'undefined' && (typeof source.id !== 'string' || !source.id.trim())) {
        const error = new TypeError('Runtime component id must be a non-empty string when supplied.');
        error.code = 'RUNTIME_COMPONENT_ID_INVALID';
        throw error;
    }
    return typeId;
};

const isComponentSchemaVersionSpecified = value => Boolean(
    value &&
    typeof value === 'object' &&
    (componentSchemaVersionSpecified.has(value) ?
        componentSchemaVersionSpecified.get(value) === true :
        Object.prototype.hasOwnProperty.call(value, 'schemaVersion'))
);

const markComponentSchemaVersionSpecified = (value, specified) => {
    componentSchemaVersionSpecified.set(value, Boolean(specified));
    return value;
};

const normalizePublicComponentOptions = value => {
    const source = clonePortableData(value || {});
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
        throw new TypeError('Runtime component options must be a plain object.');
    }
    const forbidden = Object.keys(source).filter(key => !PUBLIC_COMPONENT_FIELDS.has(key));
    if (forbidden.length) {
        const error = new TypeError(`Public Runtime component options contain forbidden fields: ${forbidden.join(', ')}`);
        error.code = 'RUNTIME_COMPONENT_PUBLIC_EXTRA_FIELDS_FORBIDDEN';
        error.fields = forbidden;
        throw error;
    }
    const typeId = validateComponentIdentity(source);
    const schemaVersionSpecified = isComponentSchemaVersionSpecified(value);
    const normalized = {
        data: normalizeComponentData(source.data),
        enabled: source.enabled !== false,
        schemaVersion: normalizeComponentSchemaVersion(source.schemaVersion),
        typeId
    };
    if (typeof source.id === 'string') normalized.id = source.id.trim();
    return markComponentSchemaVersionSpecified(normalized, schemaVersionSpecified);
};

const normalizeLocalComponentOptions = value => {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const typeId = validateComponentIdentity(source);
    const schemaVersionSpecified = isComponentSchemaVersionSpecified(value);
    const normalized = {
        data: normalizeComponentData(source.data),
        enabled: source.enabled !== false,
        extensionData: normalizeExtensionData(source.extensionData),
        hooks: source.hooks && typeof source.hooks === 'object' ? source.hooks : {},
        schemaVersion: normalizeComponentSchemaVersion(source.schemaVersion),
        typeId
    };
    if (typeof source.id === 'string') normalized.id = source.id.trim();
    if (Object.prototype.hasOwnProperty.call(source, 'allowMultiple') ||
        Object.prototype.hasOwnProperty.call(source, 'persistentExtras')) {
        const error = new TypeError('Component cardinality and persistence extras are not instance creation options.');
        error.code = 'RUNTIME_COMPONENT_INSTANCE_AUTHORITY_FORBIDDEN';
        throw error;
    }
    return markComponentSchemaVersionSpecified(normalized, schemaVersionSpecified);
};

const safeMergeOwnData = (...sources) => {
    const result = {};
    sources.forEach(source => {
        if (!source || typeof source !== 'object' || Array.isArray(source)) return;
        Object.entries(source).forEach(([key, value]) => {
            Object.defineProperty(result, key, {
                configurable: true,
                enumerable: true,
                value,
                writable: true
            });
        });
    });
    return result;
};

const mergeLegacyExtensionData = (extensionData, legacyFields) => {
    const result = normalizeExtensionData(extensionData);
    if (!legacyFields || !Object.keys(legacyFields).length) return result;
    const existing = result[LEGACY_COMPONENT_EXTENSION_NAMESPACE];
    Object.defineProperty(result, LEGACY_COMPONENT_EXTENSION_NAMESPACE, {
        configurable: true,
        enumerable: true,
        value: safeMergeOwnData(
            existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {},
            legacyFields
        ),
        writable: true
    });
    return normalizeExtensionData(result);
};

const normalizeImportedComponentRecord = value => {
    const source = clonePortableData(value || {});
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
        throw new TypeError('Imported Runtime component record must be a plain object.');
    }
    const typeId = validateComponentIdentity(source);
    let legacyFields = {};
    Object.keys(source).forEach(key => {
        if (IMPORT_COMPONENT_FIELDS.has(key)) return;
        Object.defineProperty(legacyFields, key, {
            configurable: true,
            enumerable: true,
            value: source[key],
            writable: true
        });
    });
    if (source.persistentExtras && typeof source.persistentExtras === 'object') {
        legacyFields = safeMergeOwnData(legacyFields, source.persistentExtras);
    }
    const normalized = {
        allowMultiple: source.allowMultiple === true,
        allowMultipleSpecified: Object.prototype.hasOwnProperty.call(source, 'allowMultiple'),
        data: normalizeComponentData(source.data),
        enabled: source.enabled !== false,
        extensionData: mergeLegacyExtensionData(source.extensionData, legacyFields),
        schemaVersion: normalizeComponentSchemaVersion(source.schemaVersion),
        typeId
    };
    if (typeof source.id === 'string') normalized.id = source.id.trim();
    return markComponentSchemaVersionSpecified(normalized, true);
};

// Backward-compatible export name. This is now the strict Public Component normalizer.
const normalizePortableComponentOptions = normalizePublicComponentOptions;

module.exports = {
    COMPONENT_CARDINALITIES,
    LEGACY_COMPONENT_EXTENSION_NAMESPACE,
    RUNTIME_COMPONENT_CONTRACT,
    assertSafeComponentDataKeys,
    isComponentSchemaVersionSpecified,
    normalizeComponentCardinality,
    normalizeComponentData,
    normalizeComponentSchemaVersion,
    normalizeExtensionData,
    normalizeImportedComponentRecord,
    normalizeLocalComponentOptions,
    normalizePortableComponentOptions,
    normalizePublicComponentOptions,
    normalizeRuntimeComponentTypeDescriptor
};
