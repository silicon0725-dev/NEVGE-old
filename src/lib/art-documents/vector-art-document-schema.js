import {assertCanonicalResourceId, assertStableSemanticId} from './art-document-identities';

const VECTOR_ART_DOCUMENT_SCHEMA_ID = 'ngvge.vector-art-document@1';
const VECTOR_ART_DOCUMENT_SCHEMA_VERSION = 1;

const isPlainObject = value => (
    value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
);

const freezeDeep = value => {
    if (isPlainObject(value)) {
        Object.keys(value).forEach(key => freezeDeep(value[key]));
        return Object.freeze(value);
    }
    return value;
};

const normalizeVectorArtDocument = value => {
    if (!isPlainObject(value)) throw new TypeError('Vector art document must be an object.');
    const fields = ['schemaId', 'schemaVersion', 'documentId', 'resourceId', 'viewport', 'sourceFormat'];
    const unknown = Object.keys(value).filter(key => !fields.includes(key));
    if (unknown.length) throw new Error(`Vector art document contains unsupported field(s): ${unknown.join(', ')}`);
    if (value.schemaId !== VECTOR_ART_DOCUMENT_SCHEMA_ID) throw new Error(`Unsupported vector art schema id: ${String(value.schemaId)}`);
    if (value.schemaVersion !== VECTOR_ART_DOCUMENT_SCHEMA_VERSION) {
        throw new Error(`Unsupported vector art schema version: ${String(value.schemaVersion)}`);
    }
    if (!isPlainObject(value.viewport) || !Number.isFinite(value.viewport.width) || !Number.isFinite(value.viewport.height) ||
        value.viewport.width <= 0 || value.viewport.height <= 0) {
        throw new TypeError('Vector art viewport must contain positive finite width/height.');
    }
    if (value.sourceFormat !== 'svg') throw new Error('Vector art authoring source format v1 is canonical SVG.');
    return freezeDeep({
        schemaId: VECTOR_ART_DOCUMENT_SCHEMA_ID,
        schemaVersion: VECTOR_ART_DOCUMENT_SCHEMA_VERSION,
        documentId: assertStableSemanticId(value.documentId, 'documentId'),
        resourceId: assertCanonicalResourceId(value.resourceId),
        viewport: {width: value.viewport.width, height: value.viewport.height},
        sourceFormat: 'svg'
    });
};

export {
    VECTOR_ART_DOCUMENT_SCHEMA_ID,
    VECTOR_ART_DOCUMENT_SCHEMA_VERSION,
    normalizeVectorArtDocument
};
