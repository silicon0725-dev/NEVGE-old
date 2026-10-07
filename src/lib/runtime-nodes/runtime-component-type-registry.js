const {
    normalizeComponentData,
    normalizeComponentSchemaVersion,
    normalizeExtensionData,
    normalizeRuntimeComponentTypeDescriptor
} = require('./runtime-component-contract');
const {clonePortableData} = require('./portable-data');
const {compareCanonicalStrings} = require('./canonical-order');

const IMPLICIT_COMPONENT_TYPE_DESCRIPTOR_AUTHORITY = Object.freeze({});
const implicitTypeIdsByRegistry = new WeakMap();
const migrationBindingsByRegistry = new WeakMap();
const migrationExecutionGuardsByRegistry = new WeakMap();
const componentTypeRegistryStates = new WeakMap();

const getImplicitTypeIds = registry => implicitTypeIdsByRegistry.get(registry);
const getMigrationBindingsByType = registry => migrationBindingsByRegistry.get(registry);
const getMigrationExecutionGuard = registry => migrationExecutionGuardsByRegistry.get(registry);
const getRegistryState = registry => {
    const state = componentTypeRegistryStates.get(registry);
    if (!state) throw new TypeError('Invalid RuntimeComponentTypeRegistry receiver.');
    return state;
};

const normalizeMigrationOwner = value => (
    typeof value === 'string' && value.trim() ? value.trim() : ''
);

const createMigrationIssueError = (code, message, details = {}) => {
    const error = new Error(message);
    error.code = code;
    Object.assign(error, details);
    return error;
};

const normalizeMigrationVersion = (value, label) => {
    if (Number.isInteger(value) && value >= 1) return value;
    const error = new TypeError(`Runtime component migration ${label} must be a positive integer.`);
    error.code = 'RUNTIME_COMPONENT_MIGRATION_VERSION_INVALID';
    error[label] = value;
    throw error;
};

class RuntimeComponentTypeRegistry {
    constructor (descriptors = []) {
        componentTypeRegistryStates.set(this, {
            descriptors: new Map(),
            listenerErrorCount: 0,
            listeners: new Set(),
            revision: 0,
            usageResolvers: new Map()
        });
        Object.defineProperty(this, '_revision', {
            configurable: false,
            enumerable: false,
            get: () => getRegistryState(this).revision
        });
        implicitTypeIdsByRegistry.set(this, new Set());
        migrationBindingsByRegistry.set(this, new Map());
        migrationExecutionGuardsByRegistry.set(
            this,
            descriptors instanceof RuntimeComponentTypeRegistry ?
                getMigrationExecutionGuard(descriptors) : {stack: []}
        );
        const source = descriptors instanceof RuntimeComponentTypeRegistry ? descriptors.list() : descriptors;
        if (Array.isArray(source)) {
            source.forEach(descriptor => this.register(descriptor));
        }
        if (descriptors instanceof RuntimeComponentTypeRegistry) {
            getImplicitTypeIds(descriptors).forEach(typeId => getImplicitTypeIds(this).add(typeId));
            getMigrationBindingsByType(descriptors).forEach((bindings, typeId) => {
                bindings.forEach(binding => {
                    this._setMigrationBinding(typeId, binding.fromVersion, binding);
                });
            });
            getRegistryState(this).revision = descriptors.getRevision();
        }
        Object.seal(this);
    }

    _emit (change) {
        const state = getRegistryState(this);
        state.revision += 1;
        const payload = Object.freeze(Object.assign({revision: state.revision}, change));
        state.listeners.forEach(listener => {
            try {
                listener(payload);
            } catch (error) {
                state.listenerErrorCount += 1;
            }
        });
        return payload;
    }

    getRevision () {
        return getRegistryState(this).revision;
    }

    getDebugSnapshot () {
        const state = getRegistryState(this);
        return Object.freeze({
            descriptorCount: state.descriptors.size,
            listenerErrorCount: state.listenerErrorCount,
            listenerCount: state.listeners.size,
            revision: state.revision,
            usageResolverCount: state.usageResolvers.size
        });
    }

    subscribe (listener) {
        if (typeof listener !== 'function') return () => {};
        const listeners = getRegistryState(this).listeners;
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    bindUsageResolver (owner, resolver) {
        this._assertMigrationMutationAllowed('bindUsageResolver');
        if (!owner || (typeof owner !== 'object' && typeof owner !== 'function')) {
            throw new TypeError('Runtime component type usage resolver requires an owner token.');
        }
        if (typeof resolver !== 'function') {
            throw new TypeError('Runtime component type usage resolver must be a function.');
        }
        const usageResolvers = getRegistryState(this).usageResolvers;
        usageResolvers.set(owner, resolver);
        return () => {
            this._assertMigrationMutationAllowed('unbindUsageResolver');
            return usageResolvers.delete(owner);
        };
    }

    _assertMigrationMutationAllowed (operation = 'runtime-component-registry-mutation') {
        const guard = getMigrationExecutionGuard(this);
        const frame = guard && guard.stack.length ? guard.stack[guard.stack.length - 1] : null;
        if (!frame) return true;
        const error = createMigrationIssueError(
            'RUNTIME_COMPONENT_MIGRATION_REENTRANT_MUTATION',
            `Runtime semantic mutation "${operation}" is not allowed during component migration execution.`,
            {
                fromVersion: frame.fromVersion,
                operation,
                toVersion: frame.toVersion,
                typeId: frame.typeId
            }
        );
        if (!frame.violation) frame.violation = error;
        throw error;
    }

    _runMigrationExecution (binding, callback) {
        const guard = getMigrationExecutionGuard(this);
        const frame = {
            fromVersion: binding.fromVersion,
            toVersion: binding.toVersion,
            typeId: binding.typeId,
            violation: null
        };
        guard.stack.push(frame);
        try {
            const result = callback();
            if (frame.violation) throw frame.violation;
            return result;
        } finally {
            guard.stack.pop();
        }
    }

    _getUsage (typeId) {
        let count = 0;
        let componentId = null;
        let nodeId = null;
        const schemaVersions = new Set();
        getRegistryState(this).usageResolvers.forEach(resolver => {
            const usage = resolver(typeId);
            if (!usage) return;
            if (typeof usage === 'number') {
                count += Math.max(0, usage);
                return;
            }
            if (typeof usage !== 'object') return;
            const usageCount = Number.isInteger(usage.count) ? Math.max(0, usage.count) : 0;
            count += usageCount;
            if (!componentId && typeof usage.componentId === 'string') componentId = usage.componentId;
            if (!nodeId && typeof usage.nodeId === 'string') nodeId = usage.nodeId;
            if (Number.isInteger(usage.schemaVersion)) schemaVersions.add(usage.schemaVersion);
            if (Array.isArray(usage.schemaVersions)) {
                usage.schemaVersions.forEach(version => {
                    if (Number.isInteger(version)) schemaVersions.add(version);
                });
            }
        });
        return {componentId, count, nodeId, schemaVersions: Array.from(schemaVersions).sort((a, b) => a - b)};
    }

    _assertCardinalityTransitionAvailable (existing, normalized) {
        if (!existing || existing.cardinality === normalized.cardinality) return;
        const usage = this._getUsage(normalized.typeId);
        if (!usage.count) return;
        const error = new Error(
            `Runtime component type descriptor cardinality cannot change while instances are in use: ` +
            `${normalized.typeId} (${existing.cardinality} -> ${normalized.cardinality})`
        );
        error.code = 'RUNTIME_COMPONENT_CARDINALITY_TRANSITION_IN_USE';
        error.componentId = usage.componentId;
        error.existingCardinality = existing.cardinality;
        error.instanceCount = usage.count;
        error.nextCardinality = normalized.cardinality;
        error.nodeId = usage.nodeId;
        error.typeId = normalized.typeId;
        throw error;
    }

    _assertSchemaTransitionAvailable (existing, normalized, options = {}) {
        if (!existing) return;
        const usage = this._getUsage(normalized.typeId);
        if (this.isImplicit(normalized.typeId) && options.registeringImplicit !== true && usage.count) {
            const incompatibleSchemaVersions = usage.schemaVersions.filter(version => (
                version !== normalized.schemaVersion
            ));
            if (incompatibleSchemaVersions.length) {
                throw createMigrationIssueError(
                    'RUNTIME_COMPONENT_SCHEMA_VERSION_CONFLICT',
                    `Runtime component instances conflict with the promoted explicit Descriptor schemaVersion: ` +
                    `${normalized.typeId} (${incompatibleSchemaVersions.join(', ')} != ${normalized.schemaVersion})`,
                    {
                        componentId: usage.componentId,
                        componentSchemaVersion: incompatibleSchemaVersions[0],
                        descriptorSchemaVersion: normalized.schemaVersion,
                        instanceCount: usage.count,
                        nodeId: usage.nodeId,
                        typeId: normalized.typeId
                    }
                );
            }
        }
        if (existing.schemaVersion === normalized.schemaVersion) return;
        if (normalized.schemaVersion < existing.schemaVersion) {
            throw createMigrationIssueError(
                'RUNTIME_COMPONENT_SCHEMA_DOWNGRADE_FORBIDDEN',
                `Runtime component type descriptor schemaVersion cannot be downgraded: ` +
                `${normalized.typeId} (${existing.schemaVersion} -> ${normalized.schemaVersion})`,
                {
                    existingSchemaVersion: existing.schemaVersion,
                    nextSchemaVersion: normalized.schemaVersion,
                    typeId: normalized.typeId
                }
            );
        }
        if (!usage.count) return;
        throw createMigrationIssueError(
            'RUNTIME_COMPONENT_SCHEMA_TRANSITION_IN_USE',
            `Runtime component type descriptor schemaVersion cannot change while instances are in use: ` +
            `${normalized.typeId} (${existing.schemaVersion} -> ${normalized.schemaVersion})`,
            {
                componentId: usage.componentId,
                existingSchemaVersion: existing.schemaVersion,
                instanceCount: usage.count,
                nextSchemaVersion: normalized.schemaVersion,
                nodeId: usage.nodeId,
                typeId: normalized.typeId
            }
        );
    }

    register (descriptor, options = {}) {
        this._assertMigrationMutationAllowed('registerComponentTypeDescriptor');
        const normalized = normalizeRuntimeComponentTypeDescriptor(descriptor);
        const descriptors = getRegistryState(this).descriptors;
        const existing = descriptors.get(normalized.typeId) || null;
        const registeringImplicit = options.implicitAuthority === IMPLICIT_COMPONENT_TYPE_DESCRIPTOR_AUTHORITY;
        const replace = options.replace === true;
        if (existing && !replace) {
            const error = new Error(`Runtime component type descriptor is already registered: ${normalized.typeId}`);
            error.code = 'RUNTIME_COMPONENT_TYPE_DESCRIPTOR_ALREADY_EXISTS';
            error.typeId = normalized.typeId;
            throw error;
        }
        const implicitExisting = this.isImplicit(normalized.typeId);
        if (existing && existing.ownerModuleId !== normalized.ownerModuleId && !implicitExisting) {
            const error = new Error(
                `Runtime component type descriptor "${normalized.typeId}" is owned by "${existing.ownerModuleId}".`
            );
            error.code = 'RUNTIME_COMPONENT_TYPE_DESCRIPTOR_OWNER_MISMATCH';
            error.owner = normalized.ownerModuleId;
            error.typeId = normalized.typeId;
            throw error;
        }
        this._assertCardinalityTransitionAvailable(existing, normalized);
        this._assertSchemaTransitionAvailable(existing, normalized, {registeringImplicit});
        descriptors.set(normalized.typeId, normalized);
        if (registeringImplicit) {
            getImplicitTypeIds(this).add(normalized.typeId);
        } else {
            getImplicitTypeIds(this).delete(normalized.typeId);
        }
        this._emit({
            descriptor: normalized,
            previousDescriptor: existing,
            type: existing ? 'descriptor:replace' : 'descriptor:register',
            typeId: normalized.typeId
        });
        return normalized;
    }

    ensureImplicit (typeId, options = {}) {
        this._assertMigrationMutationAllowed('ensureImplicitComponentTypeDescriptor');
        const normalizedTypeId = typeof typeId === 'string' ? typeId.trim() : '';
        if (!normalizedTypeId) throw new TypeError('Runtime component type descriptor requires typeId.');
        const existing = this.get(normalizedTypeId);
        if (existing) return existing;
        return this.register({
            cardinality: options.cardinality === 'many' ? 'many' : 'one',
            ownerModuleId: options.ownerModuleId || 'ngvge.runtime.compat.implicit',
            schemaVersion: normalizeComponentSchemaVersion(options.schemaVersion),
            typeId: normalizedTypeId
        }, {implicitAuthority: IMPLICIT_COMPONENT_TYPE_DESCRIPTOR_AUTHORITY});
    }

    get (typeId) {
        const normalizedTypeId = typeof typeId === 'string' ? typeId.trim() : '';
        return normalizedTypeId ? getRegistryState(this).descriptors.get(normalizedTypeId) || null : null;
    }

    has (typeId) {
        return Boolean(this.get(typeId));
    }

    isImplicit (typeId) {
        const normalizedTypeId = typeof typeId === 'string' ? typeId.trim() : (
            typeId && typeof typeId.typeId === 'string' ? typeId.typeId.trim() : ''
        );
        return Boolean(normalizedTypeId && getImplicitTypeIds(this).has(normalizedTypeId));
    }

    list () {
        return Array.from(getRegistryState(this).descriptors.values());
    }

    _getMigrationBindings (typeId, create = false) {
        const bindingsByType = getMigrationBindingsByType(this);
        let bindings = bindingsByType.get(typeId) || null;
        if (!bindings && create) {
            bindings = new Map();
            bindingsByType.set(typeId, bindings);
        }
        return bindings;
    }

    _setMigrationBinding (typeId, fromVersion, binding) {
        this._getMigrationBindings(typeId, true).set(fromVersion, binding);
    }

    bindMigration (typeId, fromVersion, migrate, options = {}) {
        this._assertMigrationMutationAllowed('bindComponentMigration');
        const normalizedTypeId = typeof typeId === 'string' ? typeId.trim() : '';
        if (!normalizedTypeId) throw new TypeError('Runtime component migration requires typeId.');
        const descriptor = this.get(normalizedTypeId);
        if (!descriptor) {
            throw createMigrationIssueError(
                'RUNTIME_COMPONENT_MIGRATION_DESCRIPTOR_MISSING',
                `Runtime component migration requires a registered descriptor: ${normalizedTypeId}`,
                {typeId: normalizedTypeId}
            );
        }
        if (this.isImplicit(normalizedTypeId)) {
            throw createMigrationIssueError(
                'RUNTIME_COMPONENT_MIGRATION_DESCRIPTOR_IMPLICIT',
                `Opaque implicit component types cannot own migration bindings: ${normalizedTypeId}`,
                {typeId: normalizedTypeId}
            );
        }
        if (typeof migrate !== 'function') {
            throw new TypeError('Runtime component migration provider must be a function.');
        }
        const normalizedFromVersion = normalizeMigrationVersion(fromVersion, 'fromVersion');
        const ownerModuleId = normalizeMigrationOwner(options.ownerModuleId);
        if (!ownerModuleId || ownerModuleId !== descriptor.ownerModuleId) {
            throw createMigrationIssueError(
                'RUNTIME_COMPONENT_MIGRATION_OWNER_MISMATCH',
                `Runtime component migration for "${normalizedTypeId}" must be bound by descriptor owner ` +
                `"${descriptor.ownerModuleId}".`,
                {owner: ownerModuleId || null, typeId: normalizedTypeId}
            );
        }
        const bindings = this._getMigrationBindings(normalizedTypeId, true);
        const existing = bindings.get(normalizedFromVersion) || null;
        if (existing && options.replace !== true) {
            throw createMigrationIssueError(
                'RUNTIME_COMPONENT_MIGRATION_ALREADY_BOUND',
                `Runtime component migration edge is already bound: ${normalizedTypeId} ` +
                `${normalizedFromVersion} -> ${normalizedFromVersion + 1}`,
                {fromVersion: normalizedFromVersion, typeId: normalizedTypeId}
            );
        }
        if (existing && existing.ownerModuleId !== ownerModuleId) {
            throw createMigrationIssueError(
                'RUNTIME_COMPONENT_MIGRATION_OWNER_MISMATCH',
                `Runtime component migration edge is owned by "${existing.ownerModuleId}".`,
                {fromVersion: normalizedFromVersion, owner: ownerModuleId, typeId: normalizedTypeId}
            );
        }
        const binding = Object.freeze({
            fromVersion: normalizedFromVersion,
            migrate,
            ownerModuleId,
            toVersion: normalizedFromVersion + 1,
            typeId: normalizedTypeId
        });
        bindings.set(normalizedFromVersion, binding);
        this._emit({
            fromVersion: normalizedFromVersion,
            ownerModuleId,
            toVersion: normalizedFromVersion + 1,
            type: existing ? 'migration:replace' : 'migration:bind',
            typeId: normalizedTypeId
        });
        return () => {
            this._assertMigrationMutationAllowed('unbindComponentMigration');
            const currentBindings = this._getMigrationBindings(normalizedTypeId);
            if (!currentBindings || currentBindings.get(normalizedFromVersion) !== binding) return false;
            currentBindings.delete(normalizedFromVersion);
            if (!currentBindings.size) getMigrationBindingsByType(this).delete(normalizedTypeId);
            this._emit({
                fromVersion: normalizedFromVersion,
                ownerModuleId,
                toVersion: normalizedFromVersion + 1,
                type: 'migration:unbind',
                typeId: normalizedTypeId
            });
            return true;
        };
    }

    unbindMigration (typeId, fromVersion, options = {}) {
        this._assertMigrationMutationAllowed('unbindComponentMigration');
        const normalizedTypeId = typeof typeId === 'string' ? typeId.trim() : '';
        if (!normalizedTypeId) return false;
        const normalizedFromVersion = normalizeMigrationVersion(fromVersion, 'fromVersion');
        const bindings = this._getMigrationBindings(normalizedTypeId);
        const binding = bindings ? bindings.get(normalizedFromVersion) : null;
        if (!binding) return false;
        const ownerModuleId = normalizeMigrationOwner(options.ownerModuleId);
        if (!ownerModuleId || ownerModuleId !== binding.ownerModuleId) {
            throw createMigrationIssueError(
                'RUNTIME_COMPONENT_MIGRATION_OWNER_MISMATCH',
                `Runtime component migration edge is owned by "${binding.ownerModuleId}".`,
                {fromVersion: normalizedFromVersion, owner: ownerModuleId || null, typeId: normalizedTypeId}
            );
        }
        bindings.delete(normalizedFromVersion);
        if (!bindings.size) getMigrationBindingsByType(this).delete(normalizedTypeId);
        this._emit({
            fromVersion: normalizedFromVersion,
            ownerModuleId,
            toVersion: normalizedFromVersion + 1,
            type: 'migration:unbind',
            typeId: normalizedTypeId
        });
        return true;
    }

    listMigrations (typeId = null) {
        const normalizedTypeId = typeof typeId === 'string' && typeId.trim() ? typeId.trim() : null;
        const result = [];
        getMigrationBindingsByType(this).forEach((bindings, bindingTypeId) => {
            if (normalizedTypeId && bindingTypeId !== normalizedTypeId) return;
            bindings.forEach(binding => result.push(Object.freeze({
                fromVersion: binding.fromVersion,
                ownerModuleId: binding.ownerModuleId,
                toVersion: binding.toVersion,
                typeId: binding.typeId
            })));
        });
        return result.sort((left, right) => (
            compareCanonicalStrings(left.typeId, right.typeId) || left.fromVersion - right.fromVersion
        ));
    }

    resolveMigrationPath (typeId, fromVersion, toVersion) {
        const normalizedTypeId = typeof typeId === 'string' ? typeId.trim() : '';
        const normalizedFromVersion = normalizeMigrationVersion(fromVersion, 'fromVersion');
        const normalizedToVersion = normalizeMigrationVersion(toVersion, 'toVersion');
        if (!normalizedTypeId) throw new TypeError('Runtime component migration requires typeId.');
        if (normalizedFromVersion > normalizedToVersion) {
            throw createMigrationIssueError(
                'RUNTIME_COMPONENT_SCHEMA_VERSION_UNSUPPORTED',
                `Runtime component record schemaVersion ${normalizedFromVersion} is newer than supported version ` +
                `${normalizedToVersion}: ${normalizedTypeId}`,
                {
                    descriptorVersion: normalizedToVersion,
                    recordVersion: normalizedFromVersion,
                    typeId: normalizedTypeId
                }
            );
        }
        const bindings = this._getMigrationBindings(normalizedTypeId);
        const path = [];
        for (let version = normalizedFromVersion; version < normalizedToVersion; version += 1) {
            const binding = bindings ? bindings.get(version) : null;
            if (!binding) {
                throw createMigrationIssueError(
                    'RUNTIME_COMPONENT_MIGRATION_PATH_MISSING',
                    `Runtime component migration path is missing edge ${version} -> ${version + 1}: ` +
                    normalizedTypeId,
                    {
                        descriptorVersion: normalizedToVersion,
                        fromVersion: version,
                        recordVersion: normalizedFromVersion,
                        toVersion: version + 1,
                        typeId: normalizedTypeId
                    }
                );
            }
            path.push(binding);
        }
        return path;
    }

    migrateImportedRecord (record) {
        if (!record || typeof record !== 'object' || Array.isArray(record)) {
            throw new TypeError('Runtime component migration requires a normalized record.');
        }
        const typeId = typeof record.typeId === 'string' ? record.typeId.trim() : '';
        const descriptor = this.get(typeId);
        if (!descriptor || this.isImplicit(typeId)) {
            return Object.assign({}, record);
        }
        const recordVersion = normalizeComponentSchemaVersion(record.schemaVersion);
        const descriptorVersion = descriptor.schemaVersion;
        if (recordVersion > descriptorVersion) {
            throw createMigrationIssueError(
                'RUNTIME_COMPONENT_SCHEMA_VERSION_UNSUPPORTED',
                `Runtime component record schemaVersion ${recordVersion} is newer than supported version ` +
                `${descriptorVersion}: ${typeId}`,
                {descriptorVersion, recordVersion, typeId}
            );
        }
        if (recordVersion === descriptorVersion) return Object.assign({}, record);

        const path = this.resolveMigrationPath(typeId, recordVersion, descriptorVersion);
        let candidate = {
            data: normalizeComponentData(record.data),
            extensionData: normalizeExtensionData(record.extensionData)
        };
        path.forEach(binding => {
            let output;
            try {
                output = this._runMigrationExecution(binding, () => binding.migrate(
                    clonePortableData(candidate),
                    Object.freeze({
                        fromVersion: binding.fromVersion,
                        toVersion: binding.toVersion,
                        typeId
                    })
                ));
            } catch (cause) {
                if (cause && cause.code === 'RUNTIME_COMPONENT_MIGRATION_REENTRANT_MUTATION') throw cause;
                throw createMigrationIssueError(
                    'RUNTIME_COMPONENT_MIGRATION_FAILED',
                    `Runtime component migration failed for ${typeId} ` +
                    `${binding.fromVersion} -> ${binding.toVersion}: ` +
                    (cause && cause.message ? cause.message : String(cause)),
                    {
                        fromVersion: binding.fromVersion,
                        recordVersion,
                        toVersion: binding.toVersion,
                        typeId
                    }
                );
            }
            try {
                const portable = clonePortableData(output);
                if (!portable || typeof portable !== 'object' || Array.isArray(portable)) {
                    throw new TypeError('Migration output must be a plain object.');
                }
                const fields = Object.keys(portable);
                const forbiddenFields = fields.filter(field => field !== 'data' && field !== 'extensionData');
                if (forbiddenFields.length || !Object.prototype.hasOwnProperty.call(portable, 'data')) {
                    const error = new TypeError(
                        forbiddenFields.length ?
                            `Migration output contains forbidden fields: ${forbiddenFields.join(', ')}` :
                            'Migration output requires data.'
                    );
                    error.fields = forbiddenFields;
                    throw error;
                }
                candidate = {
                    data: normalizeComponentData(portable.data),
                    extensionData: Object.prototype.hasOwnProperty.call(portable, 'extensionData') ?
                        normalizeExtensionData(portable.extensionData) : candidate.extensionData
                };
            } catch (cause) {
                throw createMigrationIssueError(
                    'RUNTIME_COMPONENT_MIGRATION_RESULT_INVALID',
                    `Runtime component migration returned invalid portable data for ${typeId} ` +
                    `${binding.fromVersion} -> ${binding.toVersion}: ` +
                    (cause && cause.message ? cause.message : String(cause)),
                    {
                        fromVersion: binding.fromVersion,
                        recordVersion,
                        toVersion: binding.toVersion,
                        typeId
                    }
                );
            }
        });
        return Object.assign({}, record, {
            data: candidate.data,
            extensionData: candidate.extensionData,
            schemaVersion: descriptorVersion
        });
    }

    unregister (typeId) {
        this._assertMigrationMutationAllowed('unregisterComponentTypeDescriptor');
        const normalizedTypeId = typeof typeId === 'string' ? typeId.trim() : '';
        const descriptors = getRegistryState(this).descriptors;
        if (!normalizedTypeId || !descriptors.has(normalizedTypeId)) return false;
        const usage = this._getUsage(normalizedTypeId);
        if (usage.count) {
            const error = new Error(
                `Runtime component type descriptor cannot be unregistered while instances are in use: ` +
                normalizedTypeId
            );
            error.code = 'RUNTIME_COMPONENT_TYPE_DESCRIPTOR_IN_USE';
            error.componentId = usage.componentId;
            error.instanceCount = usage.count;
            error.nodeId = usage.nodeId;
            error.typeId = normalizedTypeId;
            throw error;
        }
        const existing = descriptors.get(normalizedTypeId);
        const removed = descriptors.delete(normalizedTypeId);
        if (removed) {
            getImplicitTypeIds(this).delete(normalizedTypeId);
            getMigrationBindingsByType(this).delete(normalizedTypeId);
            this._emit({
                descriptor: null,
                previousDescriptor: existing,
                type: 'descriptor:unregister',
                typeId: normalizedTypeId
            });
        }
        return removed;
    }

    clone () {
        return new RuntimeComponentTypeRegistry(this);
    }
}

const createRuntimeComponentTypeRegistry = descriptors => new RuntimeComponentTypeRegistry(descriptors);

const captureRuntimeComponentTypeRegistryCheckpoint = registry => {
    const state = getRegistryState(registry);
    const migrations = new Map();
    getMigrationBindingsByType(registry).forEach((bindings, typeId) => {
        migrations.set(typeId, new Map(bindings));
    });
    return Object.freeze({
        descriptors: new Map(state.descriptors),
        implicitTypeIds: new Set(getImplicitTypeIds(registry)),
        migrations,
        revision: state.revision
    });
};

const restoreRuntimeComponentTypeRegistryCheckpoint = (registry, checkpoint) => {
    if (!checkpoint || !(checkpoint.descriptors instanceof Map) || !(checkpoint.implicitTypeIds instanceof Set)) {
        const error = new Error('Invalid Runtime Component Type Registry checkpoint.');
        error.code = 'RUNTIME_COMPONENT_REGISTRY_CHECKPOINT_INVALID';
        throw error;
    }
    const state = getRegistryState(registry);
    state.descriptors.clear();
    checkpoint.descriptors.forEach((descriptor, typeId) => state.descriptors.set(typeId, descriptor));
    const implicit = getImplicitTypeIds(registry);
    implicit.clear();
    checkpoint.implicitTypeIds.forEach(typeId => implicit.add(typeId));
    const migrationsByType = getMigrationBindingsByType(registry);
    migrationsByType.clear();
    checkpoint.migrations.forEach((bindings, typeId) => migrationsByType.set(typeId, new Map(bindings)));
    // Revisions are intentionally monotonic across failed mutation attempts. Do not roll them back.
    return registry;
};

module.exports = {
    RuntimeComponentTypeRegistry,
    captureRuntimeComponentTypeRegistryCheckpoint,
    createRuntimeComponentTypeRegistry,
    restoreRuntimeComponentTypeRegistryCheckpoint
};
