'use strict';

const {normalizeSchemaDescriptor} = require('./schema-contract');

const SCHEMA_REGISTRY_DUPLICATE = 'NGVGE_SCHEMA_REGISTRY_DUPLICATE_VERSION';
const SCHEMA_REGISTRY_TYPE_ID_INVALID = 'NGVGE_SCHEMA_REGISTRY_TYPE_ID_INVALID';
const SCHEMA_REGISTRY_VERSION_INVALID = 'NGVGE_SCHEMA_REGISTRY_VERSION_INVALID';

const registryStates = new WeakMap();

const getState = registry => {
    const state = registryStates.get(registry);
    if (!state) throw new TypeError('Invalid SchemaRegistry receiver.');
    return state;
};

const normalizeTypeId = value => {
    const typeId = typeof value === 'string' ? value.trim() : '';
    if (!typeId) {
        const error = new TypeError('Schema Registry requires a non-empty typeId.');
        error.code = SCHEMA_REGISTRY_TYPE_ID_INVALID;
        throw error;
    }
    return typeId;
};

const normalizeVersion = value => {
    if (!Number.isInteger(value) || value < 1) {
        const error = new TypeError('Schema Registry version must be a positive integer.');
        error.code = SCHEMA_REGISTRY_VERSION_INVALID;
        throw error;
    }
    return value;
};

const compareStrings = (a, b) => (a === b ? 0 : (a < b ? -1 : 1));
const compareSchemas = (a, b) => (
    a.typeId === b.typeId ? a.version - b.version : compareStrings(a.typeId, b.typeId)
);

class SchemaRegistry {
    constructor (descriptors = []) {
        registryStates.set(this, {
            byType: new Map(),
            revision: 0
        });
        if (!Array.isArray(descriptors)) {
            throw new TypeError('SchemaRegistry initial descriptors must be an array.');
        }
        if (descriptors.length) this.registerMany(descriptors);
        Object.seal(this);
    }

    getRevision () {
        return getState(this).revision;
    }

    has (typeId, version = null) {
        const versions = getState(this).byType.get(normalizeTypeId(typeId));
        if (!versions) return false;
        if (version === null || typeof version === 'undefined') return versions.size > 0;
        return versions.has(normalizeVersion(version));
    }

    get (typeId, version = null) {
        const normalizedTypeId = normalizeTypeId(typeId);
        const versions = getState(this).byType.get(normalizedTypeId);
        if (!versions || !versions.size) return null;
        if (version !== null && typeof version !== 'undefined') {
            return versions.get(normalizeVersion(version)) || null;
        }
        const latestVersion = Math.max(...versions.keys());
        return versions.get(latestVersion) || null;
    }

    getVersions (typeId) {
        const versions = getState(this).byType.get(normalizeTypeId(typeId));
        if (!versions) return Object.freeze([]);
        return Object.freeze(Array.from(versions.keys()).sort((a, b) => a - b));
    }

    list (typeId = null) {
        const state = getState(this);
        if (typeId !== null && typeof typeId !== 'undefined') {
            const versions = state.byType.get(normalizeTypeId(typeId));
            if (!versions) return Object.freeze([]);
            return Object.freeze(Array.from(versions.values()).sort(compareSchemas));
        }
        const schemas = [];
        state.byType.forEach(versions => versions.forEach(schema => schemas.push(schema)));
        return Object.freeze(schemas.sort(compareSchemas));
    }

    register (descriptor) {
        return this.registerMany([descriptor])[0];
    }

    registerMany (descriptors) {
        if (!Array.isArray(descriptors) || descriptors.length === 0) {
            throw new TypeError('SchemaRegistry.registerMany requires a non-empty descriptor array.');
        }
        const normalized = descriptors.map(normalizeSchemaDescriptor);
        const state = getState(this);
        const batchKeys = new Set();

        normalized.forEach(schema => {
            const key = `${schema.typeId}\u0000${schema.version}`;
            if (batchKeys.has(key)) {
                const error = new Error(`Schema version is duplicated in registration batch: ${schema.typeId}@${schema.version}`);
                error.code = SCHEMA_REGISTRY_DUPLICATE;
                error.typeId = schema.typeId;
                error.version = schema.version;
                throw error;
            }
            batchKeys.add(key);
            const existingVersions = state.byType.get(schema.typeId);
            if (existingVersions && existingVersions.has(schema.version)) {
                const error = new Error(`Schema version is already registered: ${schema.typeId}@${schema.version}`);
                error.code = SCHEMA_REGISTRY_DUPLICATE;
                error.typeId = schema.typeId;
                error.version = schema.version;
                throw error;
            }
        });

        normalized.forEach(schema => {
            let versions = state.byType.get(schema.typeId);
            if (!versions) {
                versions = new Map();
                state.byType.set(schema.typeId, versions);
            }
            versions.set(schema.version, schema);
        });
        state.revision += 1;
        return Object.freeze(normalized.slice());
    }

    snapshot () {
        return Object.freeze({
            revision: this.getRevision(),
            schemas: this.list()
        });
    }
}

const createSchemaRegistry = descriptors => new SchemaRegistry(descriptors || []);

module.exports = {
    SCHEMA_REGISTRY_DUPLICATE,
    SCHEMA_REGISTRY_TYPE_ID_INVALID,
    SCHEMA_REGISTRY_VERSION_INVALID,
    SchemaRegistry,
    createSchemaRegistry
};
