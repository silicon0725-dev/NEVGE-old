'use strict';

const {getInspectorRegistry} = require('../project-inspector/inspector-registry');
const {STABLE_ID_KINDS, createStableIdentity, isStableIdentity} = require('../../core/identity/stable-identity');
const {TILESET_RESOURCE_TYPE_ID, TILESET_SCHEMA_VERSION, applyTileSetPatch, normalizeTileSet} = require('../../core/tileset');

const TILESET_RESOURCE_RUNTIME_PROPERTY = 'ngvgeTileSetResources';
const TILESET_RESOURCE_PROJECT_SECTION_ID = 'ngvge-tileset-resources';
const TILESET_RESOURCE_DATABASE_VERSION = 1;
const TILESET_RESOURCE_CAPABILITY_ID = 'ngvge.tileset-resource-runtime';
const TILESET_RESOURCE_CAPABILITY_VERSION = 1;

let fallbackIdentityCounter = 0;
const createOpaqueIdentityToken = () => {
    if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }
    fallbackIdentityCounter += 1;
    return `tileset${Date.now().toString(36)}${fallbackIdentityCounter.toString(36)}${Math.random().toString(36).slice(2, 10)}`;
};
const createResourceId = () => createStableIdentity(STABLE_ID_KINDS.RESOURCE, createOpaqueIdentityToken);

const clonePortable = value => JSON.parse(JSON.stringify(value));
const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(key => deepFreeze(value[key]));
    return Object.freeze(value);
};

const normalizeRecord = value => {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return {
        data: normalizeTileSet(source.data),
        name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : 'TileSet',
        resourceId: isStableIdentity(source.resourceId, STABLE_ID_KINDS.RESOURCE) ? source.resourceId : createResourceId(),
        revision: Number.isInteger(source.revision) && source.revision >= 0 ? source.revision : 0,
        schemaVersion: TILESET_SCHEMA_VERSION,
        typeId: TILESET_RESOURCE_TYPE_ID
    };
};

const createTileSetResourceService = vm => {
    if (!vm || !vm.runtime) throw new TypeError('TileSet Resource Service requires VM runtime.');
    const runtime = vm.runtime;
    const records = new Map();
    const listeners = new Set();
    let revision = 0;

    const emit = change => {
        revision += 1;
        const event = deepFreeze(Object.assign({revision}, clonePortable(change || {})));
        listeners.forEach(listener => {
            try { listener(event); } catch { /* advisory */ }
        });
        if (runtime && typeof runtime.emitProjectChanged === 'function' && event.type !== 'restore') {
            runtime.emitProjectChanged();
        }
        return event;
    };

    const getRecord = resourceId => records.get(resourceId) || null;
    const getTileSet = resourceId => {
        const record = getRecord(resourceId);
        return record ? deepFreeze(clonePortable(record)) : null;
    };
    const listTileSets = () => Object.freeze(Array.from(records.values())
        .sort((a, b) => a.name.localeCompare(b.name) || a.resourceId.localeCompare(b.resourceId))
        .map(record => deepFreeze(clonePortable(record))));

    const createTileSet = options => {
        const source = options && typeof options === 'object' ? options : {};
        const record = normalizeRecord({
            data: source.data,
            name: source.name,
            resourceId: source.resourceId
        });
        while (records.has(record.resourceId)) record.resourceId = createResourceId();
        records.set(record.resourceId, record);
        emit({resourceId: record.resourceId, type: 'tileset:create'});
        return getTileSet(record.resourceId);
    };

    const ensureDefaultTileSet = () => {
        const existing = Array.from(records.values())[0];
        return existing ? getTileSet(existing.resourceId) : createTileSet({name: 'TileSet'});
    };

    const patchTileSet = (resourceId, patch) => {
        const record = getRecord(resourceId);
        if (!record) {
            const error = new Error(`TileSet Resource not found: ${resourceId}`);
            error.code = 'NGVGE_TILESET_RESOURCE_NOT_FOUND';
            throw error;
        }
        record.data = applyTileSetPatch(record.data, patch);
        record.revision += 1;
        emit({resourceId, resourceRevision: record.revision, type: 'tileset:patch'});
        return getTileSet(resourceId);
    };

    const renameTileSet = (resourceId, name) => {
        const record = getRecord(resourceId);
        if (!record) return false;
        const next = typeof name === 'string' && name.trim() ? name.trim() : record.name;
        if (next === record.name) return false;
        record.name = next;
        record.revision += 1;
        emit({resourceId, resourceRevision: record.revision, type: 'tileset:rename'});
        return true;
    };

    const deleteTileSet = resourceId => {
        if (!records.has(resourceId)) return false;
        records.delete(resourceId);
        emit({resourceId, type: 'tileset:delete'});
        return true;
    };

    const setTileDefinition = (resourceId, tileId, definitionPatch) => {
        const record = getRecord(resourceId);
        if (!record) throw Object.assign(new Error(`TileSet Resource not found: ${resourceId}`), {code: 'NGVGE_TILESET_RESOURCE_NOT_FOUND'});
        const id = Math.max(0, Math.trunc(Number(tileId) || 0));
        const tiles = record.data.tiles.map(tile => clonePortable(tile));
        const index = tiles.findIndex(tile => tile.id === id);
        const previous = index >= 0 ? tiles[index] : {atlas: [id % record.data.atlas.columns, Math.floor(id / record.data.atlas.columns)], id};
        const next = Object.assign({}, previous, definitionPatch || {}, {id});
        if (index >= 0) tiles[index] = next;
        else tiles.push(next);
        return patchTileSet(resourceId, {tiles});
    };

    const serializeProject = () => {
        if (!records.size) return null;
        return {
            resources: Array.from(records.values()).map(record => clonePortable(record)),
            version: TILESET_RESOURCE_DATABASE_VERSION
        };
    };

    const deserializeProject = data => {
        records.clear();
        const source = data && typeof data === 'object' ? data : {};
        const items = Array.isArray(source.resources) ? source.resources : [];
        items.forEach(item => {
            try {
                const record = normalizeRecord(item);
                if (!records.has(record.resourceId)) records.set(record.resourceId, record);
            } catch { /* invalid resource stays absent */ }
        });
        emit({type: 'restore'});
        return true;
    };

    return Object.freeze({
        capabilityId: TILESET_RESOURCE_CAPABILITY_ID,
        version: TILESET_RESOURCE_CAPABILITY_VERSION,
        createTileSet,
        deleteTileSet,
        deserializeProject,
        ensureDefaultTileSet,
        getStatus: () => deepFreeze({count: records.size, revision}),
        getTileSet,
        listTileSets,
        patchTileSet,
        renameTileSet,
        serializeProject,
        setTileDefinition,
        subscribe: listener => {
            if (typeof listener !== 'function') return () => {};
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    });
};

const installTileSetResourceService = vm => {
    if (!vm || !vm.runtime) return null;
    const runtime = vm.runtime;
    const existing = runtime[TILESET_RESOURCE_RUNTIME_PROPERTY];
    if (existing && existing.version === TILESET_RESOURCE_CAPABILITY_VERSION) return existing;
    const service = createTileSetResourceService(vm);
    runtime[TILESET_RESOURCE_RUNTIME_PROPERTY] = service;
    const registry = getInspectorRegistry(runtime);
    registry.register({
        hidden: true,
        id: TILESET_RESOURCE_PROJECT_SECTION_ID,
        label: 'TileSet Resources',
        order: -950,
        appliesTo: () => false,
        deserializeProject: data => service.deserializeProject(data),
        getFields: () => [],
        serializeProject: () => service.serializeProject(),
        setValue: () => {}
    });
    return service;
};

module.exports = {
    TILESET_RESOURCE_CAPABILITY_ID,
    TILESET_RESOURCE_CAPABILITY_VERSION,
    TILESET_RESOURCE_DATABASE_VERSION,
    TILESET_RESOURCE_PROJECT_SECTION_ID,
    TILESET_RESOURCE_RUNTIME_PROPERTY,
    createTileSetResourceService,
    installTileSetResourceService
};
