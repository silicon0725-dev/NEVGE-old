'use strict';

const {getInspectorRegistry} = require('../project-inspector/inspector-registry');
const {STABLE_ID_KINDS, createStableIdentity, isStableIdentity} = require('../../core/identity/stable-identity');
const {
    PHYSICS_MATERIAL2D_RESOURCE_TYPE_ID,
    PHYSICS_MATERIAL2D_SCHEMA_VERSION,
    applyPhysicsMaterial2DPatch,
    normalizePhysicsMaterial2D
} = require('../../core/physics-material2d');

const PHYSICS_MATERIAL2D_RESOURCE_RUNTIME_PROPERTY = 'ngvgePhysicsMaterial2DResources';
const PHYSICS_MATERIAL2D_RESOURCE_PROJECT_SECTION_ID = 'ngvge-physics-material2d-resources';
const PHYSICS_MATERIAL2D_RESOURCE_DATABASE_VERSION = 1;
const PHYSICS_MATERIAL2D_RESOURCE_CAPABILITY_ID = 'ngvge.physics-material2d-resource-runtime';
const PHYSICS_MATERIAL2D_RESOURCE_CAPABILITY_VERSION = 1;
let counter = 0;
const createToken = () => {
    if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }
    counter += 1;
    return `physicsmaterial${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 10)}`;
};
const createResourceId = () => createStableIdentity(STABLE_ID_KINDS.RESOURCE, createToken);
const clonePortable = value => JSON.parse(JSON.stringify(value));
const freeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(key => freeze(value[key]));
    return Object.freeze(value);
};
const normalizeRecord = value => {
    const source = value && typeof value === 'object' ? value : {};
    return {
        data: normalizePhysicsMaterial2D(source.data),
        name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : 'Physics Material 2D',
        resourceId: isStableIdentity(source.resourceId, STABLE_ID_KINDS.RESOURCE) ? source.resourceId : createResourceId(),
        revision: Number.isInteger(source.revision) && source.revision >= 0 ? source.revision : 0,
        schemaVersion: PHYSICS_MATERIAL2D_SCHEMA_VERSION,
        typeId: PHYSICS_MATERIAL2D_RESOURCE_TYPE_ID
    };
};

const createPhysicsMaterial2DResourceService = vm => {
    if (!vm || !vm.runtime) throw new TypeError('PhysicsMaterial2D Resource Service requires VM runtime.');
    const runtime = vm.runtime;
    const records = new Map();
    const listeners = new Set();
    let revision = 0;
    const emit = event => {
        revision += 1;
        const frozen = freeze(Object.assign({revision}, clonePortable(event || {})));
        listeners.forEach(listener => { try { listener(frozen); } catch { /* advisory */ } });
        if (event && event.type !== 'restore' && typeof runtime.emitProjectChanged === 'function') runtime.emitProjectChanged();
    };
    const snapshot = record => record ? freeze(clonePortable(record)) : null;
    const createMaterial = options => {
        const record = normalizeRecord(options);
        while (records.has(record.resourceId)) record.resourceId = createResourceId();
        records.set(record.resourceId, record);
        emit({resourceId: record.resourceId, type: 'physics-material2d:create'});
        return snapshot(record);
    };
    const ensureDefaultMaterial = () => {
        const first = records.values().next().value;
        return first ? snapshot(first) : createMaterial({name: 'Default Physics Material'});
    };
    const patchMaterial = (resourceId, patch) => {
        const record = records.get(resourceId);
        if (!record) throw Object.assign(new Error(`PhysicsMaterial2D not found: ${resourceId}`), {
            code: 'NGVGE_PHYSICS_MATERIAL2D_RESOURCE_NOT_FOUND'
        });
        record.data = applyPhysicsMaterial2DPatch(record.data, patch);
        record.revision += 1;
        emit({resourceId, resourceRevision: record.revision, type: 'physics-material2d:patch'});
        return snapshot(record);
    };
    return Object.freeze({
        capabilityId: PHYSICS_MATERIAL2D_RESOURCE_CAPABILITY_ID,
        version: PHYSICS_MATERIAL2D_RESOURCE_CAPABILITY_VERSION,
        createMaterial,
        deleteMaterial: resourceId => {
            if (!records.delete(resourceId)) return false;
            emit({resourceId, type: 'physics-material2d:delete'});
            return true;
        },
        deserializeProject: data => {
            records.clear();
            const items = data && Array.isArray(data.resources) ? data.resources : [];
            items.forEach(item => {
                try {
                    const record = normalizeRecord(item);
                    if (!records.has(record.resourceId)) records.set(record.resourceId, record);
                } catch { /* ignore invalid portable record */ }
            });
            emit({type: 'restore'});
            return true;
        },
        ensureDefaultMaterial,
        getMaterial: resourceId => snapshot(records.get(resourceId)),
        getStatus: () => freeze({count: records.size, revision}),
        listMaterials: () => Object.freeze(Array.from(records.values()).map(snapshot)),
        patchMaterial,
        serializeProject: () => records.size ? {
            resources: Array.from(records.values()).map(clonePortable),
            version: PHYSICS_MATERIAL2D_RESOURCE_DATABASE_VERSION
        } : null,
        subscribe: listener => {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    });
};

const installPhysicsMaterial2DResourceService = vm => {
    if (!vm || !vm.runtime) return null;
    const runtime = vm.runtime;
    const existing = runtime[PHYSICS_MATERIAL2D_RESOURCE_RUNTIME_PROPERTY];
    if (existing && existing.version === PHYSICS_MATERIAL2D_RESOURCE_CAPABILITY_VERSION) return existing;
    const service = createPhysicsMaterial2DResourceService(vm);
    runtime[PHYSICS_MATERIAL2D_RESOURCE_RUNTIME_PROPERTY] = service;
    const registry = getInspectorRegistry(runtime);
    registry.register({
        hidden: true,
        id: PHYSICS_MATERIAL2D_RESOURCE_PROJECT_SECTION_ID,
        label: 'PhysicsMaterial2D Resources',
        order: -945,
        appliesTo: () => false,
        deserializeProject: data => service.deserializeProject(data),
        getFields: () => [],
        serializeProject: () => service.serializeProject(),
        setValue: () => {}
    });
    return service;
};

module.exports = {
    PHYSICS_MATERIAL2D_RESOURCE_CAPABILITY_ID,
    PHYSICS_MATERIAL2D_RESOURCE_CAPABILITY_VERSION,
    PHYSICS_MATERIAL2D_RESOURCE_DATABASE_VERSION,
    PHYSICS_MATERIAL2D_RESOURCE_PROJECT_SECTION_ID,
    PHYSICS_MATERIAL2D_RESOURCE_RUNTIME_PROPERTY,
    createPhysicsMaterial2DResourceService,
    installPhysicsMaterial2DResourceService
};
