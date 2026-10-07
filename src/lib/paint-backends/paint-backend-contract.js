import {normalizePaintDocument} from '../art-documents/paint-document-schema';
import {
    VECTOR_ART_DOCUMENT_SCHEMA_ID
} from '../art-documents/vector-art-document-schema';
import {
    ANIMATED_RASTER_DOCUMENT_SCHEMA_ID
} from '../art-documents/animated-raster-document-schema';
import {assertStableSemanticId} from '../art-documents/art-document-identities';
import {normalizePortableImageContent} from '../project-assets/image-content-payload';

const PAINT_BACKEND_CONTRACT_ID = 'ngvge.paint-backend-contract@1';
const PAINT_BACKEND_DESCRIPTOR_SCHEMA_VERSION = 1;
const PAINT_BACKEND_TRANSFER_SCHEMA_ID = 'ngvge.paint-backend-transfer@1';
const PAINT_BACKEND_TRANSFER_SCHEMA_VERSION = 1;

const PAINT_BACKEND_KINDS = Object.freeze(['vector', 'bitmap', 'pixel']);
const PAINT_BACKEND_INTEGRATION_MODES = Object.freeze(['library', 'controlled-fork', 'compatibility']);
const PAINT_BACKEND_ADMISSION_STATES = Object.freeze([
    'approved-for-poc',
    'conditional-poc',
    'compatibility-only',
    'rejected'
]);
const PAINT_BACKEND_EDIT_SCOPES = Object.freeze(['document', 'frame', 'cel-content']);
const PAINT_BACKEND_SEMANTIC_COVERAGE = Object.freeze(['adapter', 'ngvge-owned', 'unsupported']);
const PAINT_BACKEND_SEMANTIC_DOMAINS = Object.freeze([
    'documentSource',
    'layers',
    'frames',
    'cels',
    'linkedCels',
    'clips',
    'markers',
    'palette',
    'slices',
    'timeline'
]);

const REQUIRED_BACKEND_METHODS = Object.freeze([
    'mount',
    'load',
    'setActiveTarget',
    'exportTransfer',
    'resize',
    'focus',
    'dispose'
]);
const OPTIONAL_BACKEND_METHODS = Object.freeze([
    'undo',
    'redo',
    'getHistoryState',
    'subscribe'
]);
const ALLOWED_BACKEND_METHODS = new Set([...REQUIRED_BACKEND_METHODS, ...OPTIONAL_BACKEND_METHODS]);

const isPlainObject = value => (
    value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
);

const freezeDeep = value => {
    if (Array.isArray(value)) {
        value.forEach(freezeDeep);
        return Object.freeze(value);
    }
    if (isPlainObject(value)) {
        Object.keys(value).forEach(key => freezeDeep(value[key]));
        return Object.freeze(value);
    }
    return value;
};

const makeContractError = (code, message, ErrorClass = Error) => {
    const error = new ErrorClass(message);
    error.code = code;
    return error;
};

const assertKnownFields = (value, fields, label) => {
    const unknown = Object.keys(value).filter(key => !fields.includes(key));
    if (unknown.length) {
        throw makeContractError(
            'NGVGE_PAINT_BACKEND_FIELD_UNSUPPORTED',
            `${label} contains unsupported field(s): ${unknown.join(', ')}`,
            TypeError
        );
    }
};

const normalizeString = (value, label) => {
    if (typeof value !== 'string' || !value.trim()) {
        throw makeContractError('NGVGE_PAINT_BACKEND_STRING_INVALID', `${label} must be a non-empty string.`, TypeError);
    }
    return value.trim();
};

const normalizeEnum = (value, values, label) => {
    if (!values.includes(value)) {
        throw makeContractError(
            'NGVGE_PAINT_BACKEND_ENUM_INVALID',
            `${label} must be one of: ${values.join(', ')}.`,
            TypeError
        );
    }
    return value;
};

const assertPortableJson = (value, label = 'Paint backend value') => {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw makeContractError('NGVGE_PAINT_BACKEND_PORTABLE_VALUE_INVALID', `${label} numbers must be finite.`, TypeError);
        }
        return value;
    }
    if (Array.isArray(value)) return value.map((item, index) => assertPortableJson(item, `${label}[${index}]`));
    if (isPlainObject(value)) {
        const normalized = {};
        Object.keys(value).forEach(key => {
            normalized[key] = assertPortableJson(value[key], `${label}.${key}`);
        });
        return normalized;
    }
    throw makeContractError(
        'NGVGE_PAINT_BACKEND_PORTABLE_VALUE_INVALID',
        `${label} must contain portable JSON only; backend/DOM/function handles are forbidden.`,
        TypeError
    );
};

const normalizeSemanticCoverage = value => {
    if (!isPlainObject(value)) {
        throw makeContractError(
            'NGVGE_PAINT_BACKEND_COVERAGE_INVALID',
            'Paint backend semanticCoverage must be an object.',
            TypeError
        );
    }
    assertKnownFields(value, PAINT_BACKEND_SEMANTIC_DOMAINS, 'Paint backend semanticCoverage');
    const normalized = {};
    PAINT_BACKEND_SEMANTIC_DOMAINS.forEach(domain => {
        normalized[domain] = normalizeEnum(
            value[domain] || 'unsupported',
            PAINT_BACKEND_SEMANTIC_COVERAGE,
            `semanticCoverage.${domain}`
        );
    });
    if (normalized.timeline !== 'ngvge-owned' && normalized.timeline !== 'unsupported') {
        throw makeContractError(
            'NGVGE_PAINT_BACKEND_TIMELINE_AUTHORITY_FORBIDDEN',
            'Timeline semantics must remain NGVGE-owned; a backend may render/edit through an adapter but cannot own timeline identity.'
        );
    }
    return normalized;
};

const normalizeBackendDescriptor = value => {
    if (!isPlainObject(value)) {
        throw makeContractError('NGVGE_PAINT_BACKEND_DESCRIPTOR_INVALID', 'Paint backend descriptor must be an object.', TypeError);
    }
    assertKnownFields(value, [
        'schemaVersion',
        'backendId',
        'displayName',
        'kind',
        'integrationMode',
        'admission',
        'documentSchemaIds',
        'editScope',
        'semanticCoverage',
        'authority',
        'oss'
    ], 'Paint backend descriptor');
    if (value.schemaVersion !== PAINT_BACKEND_DESCRIPTOR_SCHEMA_VERSION) {
        throw makeContractError(
            'NGVGE_PAINT_BACKEND_DESCRIPTOR_VERSION_UNSUPPORTED',
            `Unsupported Paint backend descriptor version: ${String(value.schemaVersion)}`
        );
    }
    const kind = normalizeEnum(value.kind, PAINT_BACKEND_KINDS, 'backend.kind');
    const documentSchemaIds = Array.isArray(value.documentSchemaIds) ? [...new Set(value.documentSchemaIds)] : [];
    if (!documentSchemaIds.length) {
        throw makeContractError(
            'NGVGE_PAINT_BACKEND_DOCUMENT_SCHEMA_REQUIRED',
            'Paint backend descriptor must declare at least one NGVGE document schema.'
        );
    }
    const allowedSchema = kind === 'vector' ? VECTOR_ART_DOCUMENT_SCHEMA_ID : ANIMATED_RASTER_DOCUMENT_SCHEMA_ID;
    if (documentSchemaIds.some(schemaId => schemaId !== allowedSchema)) {
        throw makeContractError(
            'NGVGE_PAINT_BACKEND_DOCUMENT_SCHEMA_MISMATCH',
            `Paint backend ${kind} may only declare ${allowedSchema}.`
        );
    }
    if (!isPlainObject(value.authority)) {
        throw makeContractError('NGVGE_PAINT_BACKEND_AUTHORITY_INVALID', 'Paint backend authority record is required.', TypeError);
    }
    assertKnownFields(
        value.authority,
        ['semanticIdentity', 'project', 'resource', 'transaction', 'persistence', 'timeline'],
        'Paint backend authority'
    );
    const authority = {
        semanticIdentity: Boolean(value.authority.semanticIdentity),
        project: Boolean(value.authority.project),
        resource: Boolean(value.authority.resource),
        transaction: Boolean(value.authority.transaction),
        persistence: Boolean(value.authority.persistence),
        timeline: Boolean(value.authority.timeline)
    };
    if (Object.values(authority).some(Boolean)) {
        throw makeContractError(
            'NGVGE_PAINT_BACKEND_AUTHORITY_FORBIDDEN',
            'Paint backend descriptors cannot claim NGVGE semantic, Project, Resource, Transaction, Persistence, or Timeline authority.'
        );
    }
    const oss = value.oss === null || typeof value.oss === 'undefined' ? null : assertPortableJson(value.oss, 'backend.oss');
    return freezeDeep({
        schemaVersion: PAINT_BACKEND_DESCRIPTOR_SCHEMA_VERSION,
        backendId: normalizeString(value.backendId, 'backendId'),
        displayName: normalizeString(value.displayName, 'displayName'),
        kind,
        integrationMode: normalizeEnum(value.integrationMode, PAINT_BACKEND_INTEGRATION_MODES, 'backend.integrationMode'),
        admission: normalizeEnum(value.admission, PAINT_BACKEND_ADMISSION_STATES, 'backend.admission'),
        documentSchemaIds,
        editScope: normalizeEnum(value.editScope, PAINT_BACKEND_EDIT_SCOPES, 'backend.editScope'),
        semanticCoverage: normalizeSemanticCoverage(value.semanticCoverage),
        authority,
        oss
    });
};

const normalizeActiveTarget = (value, document) => {
    if (value === null || typeof value === 'undefined') return null;
    if (!isPlainObject(value)) {
        throw makeContractError('NGVGE_PAINT_BACKEND_TARGET_INVALID', 'Paint backend activeTarget must be an object or null.', TypeError);
    }
    assertKnownFields(value, ['layerId', 'frameId', 'celId', 'contentId'], 'Paint backend activeTarget');
    if (document.schemaId === VECTOR_ART_DOCUMENT_SCHEMA_ID) {
        if (Object.keys(value).length) {
            throw makeContractError(
                'NGVGE_PAINT_BACKEND_VECTOR_TARGET_INVALID',
                'Vector backend activeTarget v1 is document-scoped and must not contain raster semantic IDs.'
            );
        }
        return freezeDeep({});
    }
    const normalized = {};
    const collections = {
        layerId: new Set(document.layers.map(item => item.layerId)),
        frameId: new Set(document.frames.map(item => item.frameId)),
        celId: new Set(document.cels.map(item => item.celId)),
        contentId: new Set(document.celContents.map(item => item.contentId))
    };
    Object.keys(value).forEach(kind => {
        const semanticId = assertStableSemanticId(value[kind], kind);
        if (!collections[kind].has(semanticId)) {
            throw makeContractError(
                'NGVGE_PAINT_BACKEND_TARGET_NOT_FOUND',
                `Paint backend activeTarget ${kind} is not present in the NGVGE document: ${semanticId}`
            );
        }
        normalized[kind] = semanticId;
    });
    return freezeDeep(normalized);
};

const normalizeIndexedRasterContent = value => {
    if (!isPlainObject(value)) {
        throw makeContractError(
            'NGVGE_PAINT_BACKEND_INDEXED_CONTENT_INVALID',
            'Indexed raster backend content must be an object.',
            TypeError
        );
    }
    assertKnownFields(value, ['kind', 'width', 'height', 'encoding', 'data', 'paletteId'], 'Indexed raster backend content');
    if (value.kind !== 'indexed-raster') {
        throw makeContractError(
            'NGVGE_PAINT_BACKEND_INDEXED_KIND_INVALID',
            'Indexed raster backend content kind must be indexed-raster.',
            TypeError
        );
    }
    if (!Number.isInteger(value.width) || value.width < 1 || !Number.isInteger(value.height) || value.height < 1) {
        throw makeContractError(
            'NGVGE_PAINT_BACKEND_INDEXED_SIZE_INVALID',
            'Indexed raster backend content width/height must be positive integers.',
            TypeError
        );
    }
    if (value.encoding !== 'base64-u8' || typeof value.data !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(value.data)) {
        throw makeContractError(
            'NGVGE_PAINT_BACKEND_INDEXED_ENCODING_INVALID',
            'Indexed raster backend content v1 requires base64-u8 data.',
            TypeError
        );
    }
    const padding = value.data.endsWith('==') ? 2 : (value.data.endsWith('=') ? 1 : 0);
    const decodedBytes = Math.floor((value.data.length * 3) / 4) - padding;
    if (decodedBytes !== value.width * value.height) {
        throw makeContractError(
            'NGVGE_PAINT_BACKEND_INDEXED_PAYLOAD_INVALID',
            'Indexed raster backend content must contain exactly one palette index per pixel.'
        );
    }
    return freezeDeep({
        kind: 'indexed-raster',
        width: value.width,
        height: value.height,
        encoding: 'base64-u8',
        data: value.data,
        paletteId: assertStableSemanticId(value.paletteId, 'paletteId')
    });
};

const normalizeTransferEntry = (value, document) => {
    if (!isPlainObject(value)) {
        throw makeContractError('NGVGE_PAINT_BACKEND_TRANSFER_ENTRY_INVALID', 'Paint backend content entry must be an object.', TypeError);
    }
    assertKnownFields(value, ['semanticId', 'role', 'dataFormat', 'content'], 'Paint backend content entry');
    const role = normalizeEnum(value.role, ['document-source', 'cel-content'], 'contentEntry.role');
    if (document.schemaId === VECTOR_ART_DOCUMENT_SCHEMA_ID) {
        if (role !== 'document-source' || value.semanticId !== document.documentId) {
            throw makeContractError(
                'NGVGE_PAINT_BACKEND_VECTOR_SOURCE_IDENTITY_MISMATCH',
                'Vector backend source entry must target the NGVGE ArtDocumentId.'
            );
        }
        const portable = normalizePortableImageContent({dataFormat: value.dataFormat, content: value.content});
        if (portable.dataFormat !== 'svg') {
            throw makeContractError('NGVGE_PAINT_BACKEND_VECTOR_SOURCE_FORMAT_INVALID', 'Vector backend source v1 must be canonical SVG.');
        }
        return freezeDeep({
            semanticId: document.documentId,
            role,
            dataFormat: portable.dataFormat,
            content: portable.content
        });
    }
    if (role !== 'cel-content') {
        throw makeContractError(
            'NGVGE_PAINT_BACKEND_RASTER_SOURCE_ROLE_INVALID',
            'Animated raster backend transfer entries must target CelContentId.'
        );
    }
    const contentId = assertStableSemanticId(value.semanticId, 'contentId');
    const descriptor = document.celContents.find(item => item.contentId === contentId);
    if (!descriptor) {
        throw makeContractError(
            'NGVGE_PAINT_BACKEND_CONTENT_ID_NOT_FOUND',
            `Paint backend content entry references missing CelContentId: ${contentId}`
        );
    }
    if (descriptor.kind === 'indexed-raster') {
        const content = normalizeIndexedRasterContent(value.content);
        if (!document.palette || content.paletteId !== document.palette.paletteId) {
            throw makeContractError(
                'NGVGE_PAINT_BACKEND_INDEXED_PALETTE_MISMATCH',
                'Indexed backend content must reference the NGVGE document PaletteId.'
            );
        }
        return freezeDeep({semanticId: contentId, role, dataFormat: 'indexed-u8', content});
    }
    const portable = normalizePortableImageContent({dataFormat: value.dataFormat, content: value.content});
    if (portable.dataFormat === 'svg') {
        throw makeContractError(
            'NGVGE_PAINT_BACKEND_RASTER_SVG_FORBIDDEN',
            'RGBA raster CelContent cannot use SVG as its backend transfer payload.'
        );
    }
    return freezeDeep({
        semanticId: contentId,
        role,
        dataFormat: portable.dataFormat,
        content: portable.content
    });
};

const normalizePaintBackendTransfer = value => {
    if (!isPlainObject(value)) {
        throw makeContractError('NGVGE_PAINT_BACKEND_TRANSFER_INVALID', 'Paint backend transfer must be an object.', TypeError);
    }
    assertKnownFields(value, ['schemaId', 'schemaVersion', 'document', 'contentEntries', 'activeTarget'], 'Paint backend transfer');
    if (value.schemaId !== PAINT_BACKEND_TRANSFER_SCHEMA_ID || value.schemaVersion !== PAINT_BACKEND_TRANSFER_SCHEMA_VERSION) {
        throw makeContractError(
            'NGVGE_PAINT_BACKEND_TRANSFER_VERSION_UNSUPPORTED',
            `Paint backend transfer must use ${PAINT_BACKEND_TRANSFER_SCHEMA_ID} v${PAINT_BACKEND_TRANSFER_SCHEMA_VERSION}.`
        );
    }
    const document = normalizePaintDocument(value.document);
    if (!Array.isArray(value.contentEntries)) {
        throw makeContractError(
            'NGVGE_PAINT_BACKEND_TRANSFER_CONTENT_INVALID',
            'Paint backend transfer contentEntries must be an array.',
            TypeError
        );
    }
    const contentEntries = value.contentEntries.map(entry => normalizeTransferEntry(entry, document));
    const ids = new Set();
    contentEntries.forEach(entry => {
        if (ids.has(entry.semanticId)) {
            throw makeContractError(
                'NGVGE_PAINT_BACKEND_TRANSFER_CONTENT_DUPLICATE',
                `Paint backend transfer contains duplicate semantic content: ${entry.semanticId}`
            );
        }
        ids.add(entry.semanticId);
    });
    if (document.schemaId === VECTOR_ART_DOCUMENT_SCHEMA_ID && contentEntries.length !== 1) {
        throw makeContractError(
            'NGVGE_PAINT_BACKEND_VECTOR_SOURCE_REQUIRED',
            'Vector backend transfer v1 requires exactly one canonical SVG document source.'
        );
    }
    return freezeDeep({
        schemaId: PAINT_BACKEND_TRANSFER_SCHEMA_ID,
        schemaVersion: PAINT_BACKEND_TRANSFER_SCHEMA_VERSION,
        document,
        contentEntries,
        activeTarget: normalizeActiveTarget(value.activeTarget, document)
    });
};

const validateImplementation = implementation => {
    if (!implementation || typeof implementation !== 'object') {
        throw makeContractError('NGVGE_PAINT_BACKEND_IMPLEMENTATION_INVALID', 'Paint backend implementation must be an object.', TypeError);
    }
    const keys = Object.keys(implementation);
    const extra = keys.filter(key => !ALLOWED_BACKEND_METHODS.has(key));
    if (extra.length) {
        throw makeContractError(
            'NGVGE_PAINT_BACKEND_SURFACE_FORBIDDEN',
            `Paint backend implementation exposes non-contract surface(s): ${extra.join(', ')}`
        );
    }
    REQUIRED_BACKEND_METHODS.forEach(method => {
        if (typeof implementation[method] !== 'function') {
            throw makeContractError(
                'NGVGE_PAINT_BACKEND_METHOD_REQUIRED',
                `Paint backend implementation requires ${method}().`,
                TypeError
            );
        }
    });
    OPTIONAL_BACKEND_METHODS.forEach(method => {
        if (typeof implementation[method] !== 'undefined' && typeof implementation[method] !== 'function') {
            throw makeContractError(
                'NGVGE_PAINT_BACKEND_METHOD_INVALID',
                `Paint backend optional surface ${method} must be a function when provided.`,
                TypeError
            );
        }
    });
    return implementation;
};

class PaintBackendBinding {
    constructor ({descriptor, implementation}) {
        this.id = PAINT_BACKEND_CONTRACT_ID;
        this.descriptor = normalizeBackendDescriptor(descriptor);
        this._implementation = validateImplementation(implementation);
        this._disposed = false;
        this._loadedIdentity = null;
        this._loadedDocument = null;
    }

    _assertActive () {
        if (this._disposed) {
            throw makeContractError('NGVGE_PAINT_BACKEND_BINDING_DISPOSED', 'Paint backend binding has been disposed.');
        }
    }

    _assertDocumentSupported (document) {
        if (!this.descriptor.documentSchemaIds.includes(document.schemaId)) {
            throw makeContractError(
                'NGVGE_PAINT_BACKEND_DOCUMENT_UNSUPPORTED',
                `Paint backend ${this.descriptor.backendId} does not support ${document.schemaId}.`
            );
        }
        if (document.schemaId === ANIMATED_RASTER_DOCUMENT_SCHEMA_ID && document.mode !== this.descriptor.kind) {
            throw makeContractError(
                'NGVGE_PAINT_BACKEND_RASTER_MODE_MISMATCH',
                `Paint backend ${this.descriptor.backendId} kind ${this.descriptor.kind} cannot edit raster mode ${document.mode}.`
            );
        }
    }

    mount (container, options = {}) {
        this._assertActive();
        const result = this._implementation.mount(container, assertPortableJson(options, 'Paint backend mount options'));
        if (typeof result !== 'undefined') assertPortableJson(result, 'Paint backend mount result');
        return result;
    }

    load (transfer) {
        this._assertActive();
        const normalized = normalizePaintBackendTransfer(transfer);
        this._assertDocumentSupported(normalized.document);
        this._loadedIdentity = {
            documentId: normalized.document.documentId,
            resourceId: normalized.document.resourceId
        };
        this._loadedDocument = normalized.document;
        const result = this._implementation.load(normalized);
        if (typeof result !== 'undefined') assertPortableJson(result, 'Paint backend load result');
        return normalized;
    }

    setActiveTarget (target) {
        this._assertActive();
        if (!this._loadedIdentity) {
            throw makeContractError('NGVGE_PAINT_BACKEND_DOCUMENT_REQUIRED', 'Load a Paint document before selecting a semantic target.');
        }
        const normalizedTarget = normalizeActiveTarget(target, this._loadedDocument);
        const result = this._implementation.setActiveTarget(normalizedTarget);
        if (typeof result !== 'undefined') assertPortableJson(result, 'Paint backend active target result');
        return result;
    }

    exportTransfer () {
        this._assertActive();
        if (!this._loadedIdentity) {
            throw makeContractError('NGVGE_PAINT_BACKEND_DOCUMENT_REQUIRED', 'Load a Paint document before exporting backend state.');
        }
        const normalized = normalizePaintBackendTransfer(this._implementation.exportTransfer());
        this._assertDocumentSupported(normalized.document);
        if (normalized.document.documentId !== this._loadedIdentity.documentId ||
            normalized.document.resourceId !== this._loadedIdentity.resourceId) {
            throw makeContractError(
                'NGVGE_PAINT_BACKEND_IDENTITY_MUTATION_FORBIDDEN',
                'Paint backend export cannot replace NGVGE ArtDocumentId or ResourceId.'
            );
        }
        return normalized;
    }

    resize (size) {
        this._assertActive();
        const normalized = assertPortableJson(size, 'Paint backend resize request');
        const result = this._implementation.resize(normalized);
        return typeof result === 'undefined' ? undefined : freezeDeep(assertPortableJson(result, 'Paint backend resize result'));
    }

    focus () {
        this._assertActive();
        const result = this._implementation.focus();
        return typeof result === 'undefined' ? undefined : freezeDeep(assertPortableJson(result, 'Paint backend focus result'));
    }

    undo () {
        this._assertActive();
        if (typeof this._implementation.undo !== 'function') return false;
        return Boolean(this._implementation.undo());
    }

    redo () {
        this._assertActive();
        if (typeof this._implementation.redo !== 'function') return false;
        return Boolean(this._implementation.redo());
    }

    getHistoryState () {
        this._assertActive();
        if (typeof this._implementation.getHistoryState !== 'function') return freezeDeep({canUndo: false, canRedo: false});
        return freezeDeep(assertPortableJson(this._implementation.getHistoryState(), 'Paint backend history state'));
    }

    subscribe (listener) {
        this._assertActive();
        if (typeof listener !== 'function') throw new TypeError('Paint backend listener must be a function.');
        if (typeof this._implementation.subscribe !== 'function') return () => {};
        const unsubscribe = this._implementation.subscribe(event => {
            listener(freezeDeep(assertPortableJson(event, 'Paint backend event')));
        });
        return typeof unsubscribe === 'function' ? unsubscribe : () => {};
    }

    dispose () {
        if (this._disposed) return false;
        this._disposed = true;
        this._loadedIdentity = null;
        this._loadedDocument = null;
        this._implementation.dispose();
        return true;
    }
}

const createPaintBackendBinding = options => new PaintBackendBinding(options);

export {
    PAINT_BACKEND_CONTRACT_ID,
    PAINT_BACKEND_DESCRIPTOR_SCHEMA_VERSION,
    PAINT_BACKEND_TRANSFER_SCHEMA_ID,
    PAINT_BACKEND_TRANSFER_SCHEMA_VERSION,
    PAINT_BACKEND_KINDS,
    PAINT_BACKEND_INTEGRATION_MODES,
    PAINT_BACKEND_ADMISSION_STATES,
    PAINT_BACKEND_EDIT_SCOPES,
    PAINT_BACKEND_SEMANTIC_COVERAGE,
    PAINT_BACKEND_SEMANTIC_DOMAINS,
    REQUIRED_BACKEND_METHODS,
    OPTIONAL_BACKEND_METHODS,
    normalizeBackendDescriptor,
    normalizePaintBackendTransfer,
    assertPortableJson,
    PaintBackendBinding,
    createPaintBackendBinding
};
