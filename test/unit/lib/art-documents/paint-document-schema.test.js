import {
    PAINT_DOCUMENT_CONTRACT_ID,
    normalizePaintDocument
} from '../../../../src/lib/art-documents/paint-document-schema';
import {VECTOR_ART_DOCUMENT_SCHEMA_ID} from '../../../../src/lib/art-documents/vector-art-document-schema';
import {ANIMATED_RASTER_DOCUMENT_SCHEMA_ID} from '../../../../src/lib/art-documents/animated-raster-document-schema';

describe('PaintDocument contract freeze', () => {
    test('dispatches vector documents with canonical SVG source', () => {
        const document = normalizePaintDocument({
            schemaId: VECTOR_ART_DOCUMENT_SCHEMA_ID,
            schemaVersion: 1,
            documentId: 'ngvge:art-document:logo',
            resourceId: 'ngvge:resource:logo',
            viewport: {width: 512, height: 512},
            sourceFormat: 'svg'
        });
        expect(PAINT_DOCUMENT_CONTRACT_ID).toBe('ngvge.paint-document-contract@1');
        expect(document.sourceFormat).toBe('svg');
        expect(Object.isFrozen(document)).toBe(true);
    });

    test('rejects vector backend handles and non-SVG authoring source', () => {
        expect(() => normalizePaintDocument({
            schemaId: VECTOR_ART_DOCUMENT_SCHEMA_ID,
            schemaVersion: 1,
            documentId: 'ngvge:art-document:logo',
            resourceId: 'ngvge:resource:logo',
            viewport: {width: 512, height: 512},
            sourceFormat: 'svg',
            svgCanvas: {}
        })).toThrow(/unsupported field/i);
        expect(() => normalizePaintDocument({
            schemaId: VECTOR_ART_DOCUMENT_SCHEMA_ID,
            schemaVersion: 1,
            documentId: 'ngvge:art-document:logo',
            resourceId: 'ngvge:resource:logo',
            viewport: {width: 512, height: 512},
            sourceFormat: 'backend-json'
        })).toThrow(/canonical SVG/i);
    });

    test('recognizes animated raster documents as the bitmap/pixel authoring family', () => {
        const document = {
            schemaId: ANIMATED_RASTER_DOCUMENT_SCHEMA_ID,
            schemaVersion: 1,
            documentId: 'ngvge:art-document:bitmap',
            resourceId: 'ngvge:resource:bitmap',
            mode: 'bitmap',
            canvas: {width: 16, height: 16, colorMode: 'rgba'},
            layers: [{layerId: 'ngvge:art-layer:base', name: 'Base', type: 'raster'}],
            frames: [{frameId: 'ngvge:animation-frame:base', durationMs: 100}],
            celContents: [{contentId: 'ngvge:cel-content:base', kind: 'rgba-raster'}],
            cels: [{
                celId: 'ngvge:animation-cel:base',
                layerId: 'ngvge:art-layer:base',
                frameId: 'ngvge:animation-frame:base',
                contentId: 'ngvge:cel-content:base'
            }],
            clips: [],
            markers: [],
            palette: null,
            slices: []
        };
        expect(normalizePaintDocument(document).mode).toBe('bitmap');
    });
});
