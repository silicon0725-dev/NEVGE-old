import {
    STABLE_ID_KINDS,
    isStableIdentity
} from '../../core/identity/stable-identity';

const WORKSPACE_RESOURCE_CONTENT_READ_CAPABILITY_ID = 'ngvge.workspace-resource-content-read-capability@1';
const WORKSPACE_IMAGE_CONTENT_SCHEMA_VERSION = 1;
const MAX_WORKSPACE_IMAGE_CONTENT_BYTES = 32 * 1024 * 1024;

const CONTENT_AFFECTING_RESOURCE_EVENTS = new Set([
    'create',
    'delete',
    'hydrate',
    'hydrate-error',
    'history:apply',
    'import',
    'replace',
    'reset',
    'restore-metadata'
]);

const freezeDeep = value => {
    if (Array.isArray(value)) {
        value.forEach(freezeDeep);
        return Object.freeze(value);
    }
    if (value && typeof value === 'object' &&
        (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
        Object.keys(value).forEach(key => freezeDeep(value[key]));
        return Object.freeze(value);
    }
    return value;
};

const makeContentError = (code, message, ErrorClass = Error) => {
    const error = new ErrorClass(message);
    error.code = code;
    return error;
};

const assertResourceId = resourceId => {
    if (!isStableIdentity(resourceId, STABLE_ID_KINDS.RESOURCE)) {
        throw makeContentError(
            'NGVGE_WORKSPACE_RESOURCE_CONTENT_ID_INVALID',
            'Resource content reads require a canonical ngvge:resource:* ResourceId.',
            TypeError
        );
    }
    return resourceId;
};

const normalizeImageDataFormat = value => {
    const format = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (format === 'jpeg') return 'jpg';
    if (format === 'svg' || format === 'png' || format === 'jpg') return format;
    throw makeContentError(
        'NGVGE_WORKSPACE_RESOURCE_IMAGE_FORMAT_UNSUPPORTED',
        `Better Paint content read does not support image format: ${format || 'unknown'}`
    );
};

const estimateDataUriBytes = dataUri => {
    const comma = dataUri.indexOf(',');
    if (comma < 0) return dataUri.length;
    const header = dataUri.slice(0, comma).toLowerCase();
    const payloadLength = dataUri.length - comma - 1;
    if (header.includes(';base64')) return Math.floor((payloadLength * 3) / 4);
    return payloadLength;
};

const requireResourceContentDatabase = getResourceDatabase => {
    const database = typeof getResourceDatabase === 'function' ? getResourceDatabase() : null;
    if (!database || typeof database.getResource !== 'function' ||
        typeof database.getAssetIdForResourceId !== 'function' || typeof database.getDataURL !== 'function' ||
        typeof database.getResourceContentRevision !== 'function' || typeof database.subscribe !== 'function') {
        throw makeContentError(
            'NGVGE_WORKSPACE_RESOURCE_CONTENT_AUTHORITY_UNAVAILABLE',
            'Canonical image Resource content authority is unavailable.'
        );
    }
    return database;
};

const normalizeSourceEvent = (database, change) => {
    const source = change && typeof change === 'object' ? change : {};
    let resourceId = isStableIdentity(source.resourceId, STABLE_ID_KINDS.RESOURCE) ? source.resourceId : null;
    if (!resourceId && typeof source.assetId === 'string' && typeof database.getAsset === 'function') {
        const record = database.getAsset(source.assetId);
        if (record && isStableIdentity(record.resourceId, STABLE_ID_KINDS.RESOURCE)) {
            resourceId = record.resourceId;
        }
    }
    return freezeDeep({
        schemaVersion: WORKSPACE_IMAGE_CONTENT_SCHEMA_VERSION,
        sourceAuthorityRevision: resourceId ? database.getResourceContentRevision(resourceId) : null,
        type: typeof source.type === 'string' ? source.type : 'resource:changed',
        resourceId,
        contentMayHaveChanged: CONTENT_AFFECTING_RESOURCE_EVENTS.has(source.type)
    });
};

const createWorkspaceResourceContentReadFacade = ({getResourceDatabase}) => {
    const getImageContent = resourceId => {
        assertResourceId(resourceId);
        const database = requireResourceContentDatabase(getResourceDatabase);
        const descriptor = database.getResource(resourceId);
        if (!descriptor) {
            throw makeContentError(
                'NGVGE_WORKSPACE_RESOURCE_CONTENT_NOT_FOUND',
                `Image Resource content is unavailable: ${resourceId}`
            );
        }
        if (descriptor.kind !== 'costume') {
            throw makeContentError(
                'NGVGE_WORKSPACE_RESOURCE_CONTENT_KIND_UNSUPPORTED',
                'Paint content reads currently accept image Resources only.'
            );
        }
        const dataFormat = normalizeImageDataFormat(descriptor.dataFormat);
        const internalAssetId = database.getAssetIdForResourceId(resourceId);
        if (!internalAssetId) {
            throw makeContentError(
                'NGVGE_WORKSPACE_RESOURCE_CONTENT_NOT_FOUND',
                `Image Resource has no content binding: ${resourceId}`
            );
        }
        const dataUri = database.getDataURL(internalAssetId);
        if (typeof dataUri !== 'string' || !dataUri.startsWith('data:')) {
            throw makeContentError(
                'NGVGE_WORKSPACE_RESOURCE_CONTENT_NOT_LOADED',
                `Image Resource content is not loaded: ${resourceId}`
            );
        }
        const estimatedBytes = estimateDataUriBytes(dataUri);
        if (estimatedBytes > MAX_WORKSPACE_IMAGE_CONTENT_BYTES) {
            throw makeContentError(
                'NGVGE_WORKSPACE_RESOURCE_CONTENT_BUDGET_EXCEEDED',
                `Image Resource content exceeds the WS-10B working-copy read budget (${MAX_WORKSPACE_IMAGE_CONTENT_BYTES} bytes).`
            );
        }
        return freezeDeep({
            schemaVersion: WORKSPACE_IMAGE_CONTENT_SCHEMA_VERSION,
            resourceId,
            kind: 'image',
            dataFormat,
            bitmapResolution: Number.isFinite(descriptor.bitmapResolution) ? descriptor.bitmapResolution : 1,
            rotationCenterX: Number.isFinite(descriptor.rotationCenterX) ? descriptor.rotationCenterX : 0,
            rotationCenterY: Number.isFinite(descriptor.rotationCenterY) ? descriptor.rotationCenterY : 0,
            sourceAuthorityRevision: database.getResourceContentRevision(resourceId),
            byteLength: estimatedBytes,
            content: {
                kind: 'data-uri',
                dataUri
            }
        });
    };

    const subscribe = listener => {
        if (typeof listener !== 'function') throw new TypeError('Resource content listener must be a function.');
        const database = requireResourceContentDatabase(getResourceDatabase);
        return database.subscribe(change => listener(normalizeSourceEvent(database, change)));
    };

    return Object.freeze({
        id: WORKSPACE_RESOURCE_CONTENT_READ_CAPABILITY_ID,
        getImageContent,
        subscribe
    });
};

export {
    WORKSPACE_RESOURCE_CONTENT_READ_CAPABILITY_ID,
    WORKSPACE_IMAGE_CONTENT_SCHEMA_VERSION,
    MAX_WORKSPACE_IMAGE_CONTENT_BYTES,
    CONTENT_AFFECTING_RESOURCE_EVENTS,
    createWorkspaceResourceContentReadFacade
};
