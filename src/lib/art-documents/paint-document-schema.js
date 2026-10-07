import {
    ANIMATED_RASTER_DOCUMENT_SCHEMA_ID,
    normalizeAnimatedRasterDocument
} from './animated-raster-document-schema';
import {VECTOR_ART_DOCUMENT_SCHEMA_ID, normalizeVectorArtDocument} from './vector-art-document-schema';

const PAINT_DOCUMENT_CONTRACT_ID = 'ngvge.paint-document-contract@1';
const PAINT_DOCUMENT_KINDS = Object.freeze(['vector', 'animated-raster']);

const normalizePaintDocument = value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError('Paint document must be an object.');
    }
    if (value.schemaId === VECTOR_ART_DOCUMENT_SCHEMA_ID) return normalizeVectorArtDocument(value);
    if (value.schemaId === ANIMATED_RASTER_DOCUMENT_SCHEMA_ID) return normalizeAnimatedRasterDocument(value);
    throw new Error(`Unsupported NGVGE Paint document schema: ${String(value.schemaId)}`);
};

export {
    PAINT_DOCUMENT_CONTRACT_ID,
    PAINT_DOCUMENT_KINDS,
    normalizePaintDocument
};
