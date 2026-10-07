import {
    PAINT_BACKEND_CONTRACT_ID,
    PAINT_BACKEND_TRANSFER_SCHEMA_ID,
    normalizeBackendDescriptor,
    normalizePaintBackendTransfer,
    createPaintBackendBinding
} from '../../../../src/lib/paint-backends/paint-backend-contract';
import {VECTOR_ART_DOCUMENT_SCHEMA_ID} from '../../../../src/lib/art-documents/vector-art-document-schema';
import {ANIMATED_RASTER_DOCUMENT_SCHEMA_ID} from '../../../../src/lib/art-documents/animated-raster-document-schema';

const authority = () => ({
    semanticIdentity: false,
    project: false,
    resource: false,
    transaction: false,
    persistence: false,
    timeline: false
});

const vectorDescriptor = () => ({
    schemaVersion: 1,
    backendId: 'ngvge.paint-backend.test-vector',
    displayName: 'Test Vector',
    kind: 'vector',
    integrationMode: 'library',
    admission: 'approved-for-poc',
    documentSchemaIds: [VECTOR_ART_DOCUMENT_SCHEMA_ID],
    editScope: 'document',
    semanticCoverage: {documentSource: 'adapter', slices: 'ngvge-owned', timeline: 'unsupported'},
    authority: authority(),
    oss: {license: 'MIT'}
});

const rasterDescriptor = kind => ({
    schemaVersion: 1,
    backendId: `ngvge.paint-backend.test-${kind}`,
    displayName: `Test ${kind}`,
    kind,
    integrationMode: 'controlled-fork',
    admission: 'conditional-poc',
    documentSchemaIds: [ANIMATED_RASTER_DOCUMENT_SCHEMA_ID],
    editScope: kind === 'bitmap' ? 'frame' : 'document',
    semanticCoverage: {
        documentSource: 'adapter',
        layers: 'adapter',
        frames: kind === 'pixel' ? 'adapter' : 'ngvge-owned',
        cels: 'adapter',
        linkedCels: 'ngvge-owned',
        clips: 'ngvge-owned',
        markers: 'ngvge-owned',
        palette: kind === 'pixel' ? 'adapter' : 'ngvge-owned',
        slices: 'ngvge-owned',
        timeline: 'ngvge-owned'
    },
    authority: authority()
});

const vectorTransfer = () => ({
    schemaId: PAINT_BACKEND_TRANSFER_SCHEMA_ID,
    schemaVersion: 1,
    document: {
        schemaId: VECTOR_ART_DOCUMENT_SCHEMA_ID,
        schemaVersion: 1,
        documentId: 'ngvge:art-document:vector',
        resourceId: 'ngvge:resource:vector',
        viewport: {width: 480, height: 360},
        sourceFormat: 'svg'
    },
    contentEntries: [{
        semanticId: 'ngvge:art-document:vector',
        role: 'document-source',
        dataFormat: 'svg',
        content: {kind: 'svg-text', text: '<svg xmlns="http://www.w3.org/2000/svg"/>'}
    }],
    activeTarget: {}
});

const rgbaRasterTransfer = () => ({
    schemaId: PAINT_BACKEND_TRANSFER_SCHEMA_ID,
    schemaVersion: 1,
    document: {
        schemaId: ANIMATED_RASTER_DOCUMENT_SCHEMA_ID,
        schemaVersion: 1,
        documentId: 'ngvge:art-document:bitmap',
        resourceId: 'ngvge:resource:bitmap',
        mode: 'bitmap',
        canvas: {width: 2, height: 2, colorMode: 'rgba'},
        layers: [{layerId: 'ngvge:art-layer:paint', name: 'Paint', type: 'raster'}],
        frames: [{frameId: 'ngvge:animation-frame:1', durationMs: 100}],
        celContents: [{contentId: 'ngvge:cel-content:1', kind: 'rgba-raster'}],
        cels: [{
            celId: 'ngvge:animation-cel:1',
            layerId: 'ngvge:art-layer:paint',
            frameId: 'ngvge:animation-frame:1',
            contentId: 'ngvge:cel-content:1'
        }],
        clips: [],
        markers: [],
        palette: null,
        slices: []
    },
    contentEntries: [{
        semanticId: 'ngvge:cel-content:1',
        role: 'cel-content',
        dataFormat: 'png',
        content: {kind: 'data-uri', dataUri: 'data:image/png;base64,AA=='}
    }],
    activeTarget: {
        layerId: 'ngvge:art-layer:paint',
        frameId: 'ngvge:animation-frame:1',
        celId: 'ngvge:animation-cel:1',
        contentId: 'ngvge:cel-content:1'
    }
});

const indexedRasterTransfer = () => ({
    schemaId: PAINT_BACKEND_TRANSFER_SCHEMA_ID,
    schemaVersion: 1,
    document: {
        schemaId: ANIMATED_RASTER_DOCUMENT_SCHEMA_ID,
        schemaVersion: 1,
        documentId: 'ngvge:art-document:pixel',
        resourceId: 'ngvge:resource:pixel',
        mode: 'pixel',
        canvas: {width: 2, height: 2, colorMode: 'indexed'},
        layers: [{layerId: 'ngvge:art-layer:pixel', name: 'Pixel', type: 'raster'}],
        frames: [{frameId: 'ngvge:animation-frame:1', durationMs: 100}],
        celContents: [{contentId: 'ngvge:cel-content:pixel', kind: 'indexed-raster'}],
        cels: [{
            celId: 'ngvge:animation-cel:pixel',
            layerId: 'ngvge:art-layer:pixel',
            frameId: 'ngvge:animation-frame:1',
            contentId: 'ngvge:cel-content:pixel'
        }],
        clips: [],
        markers: [],
        palette: {
            paletteId: 'ngvge:palette:pixel',
            storage: 'embedded',
            entries: [{entryId: 'ngvge:palette-entry:0', index: 0, rgba: {r: 0, g: 0, b: 0, a: 0}}]
        },
        slices: []
    },
    contentEntries: [{
        semanticId: 'ngvge:cel-content:pixel',
        role: 'cel-content',
        dataFormat: 'indexed-u8',
        content: {
            kind: 'indexed-raster',
            width: 2,
            height: 2,
            encoding: 'base64-u8',
            data: 'AAAAAA==',
            paletteId: 'ngvge:palette:pixel'
        }
    }],
    activeTarget: {frameId: 'ngvge:animation-frame:1', contentId: 'ngvge:cel-content:pixel'}
});

const makeImplementation = transfer => ({
    mount: jest.fn(() => ({mounted: true})),
    load: jest.fn(() => ({loaded: true})),
    setActiveTarget: jest.fn(() => ({selected: true})),
    exportTransfer: jest.fn(() => transfer),
    resize: jest.fn(() => ({resized: true})),
    focus: jest.fn(() => true),
    dispose: jest.fn(),
    undo: jest.fn(() => true),
    redo: jest.fn(() => false),
    getHistoryState: jest.fn(() => ({canUndo: true, canRedo: false})),
    subscribe: jest.fn(() => () => {})
});

describe('PaintBackendContract v1', () => {
    test('freezes the contract identity', () => {
        expect(PAINT_BACKEND_CONTRACT_ID).toBe('ngvge.paint-backend-contract@1');
    });

    test('accepts a replaceable vector backend descriptor without authority', () => {
        const descriptor = normalizeBackendDescriptor(vectorDescriptor());
        expect(descriptor.kind).toBe('vector');
        expect(descriptor.semanticCoverage.documentSource).toBe('adapter');
        expect(Object.values(descriptor.authority).every(value => value === false)).toBe(true);
    });

    test('rejects backend semantic/project/resource/transaction/persistence/timeline authority', () => {
        ['semanticIdentity', 'project', 'resource', 'transaction', 'persistence', 'timeline'].forEach(key => {
            const descriptor = vectorDescriptor();
            descriptor.authority[key] = true;
            expect(() => normalizeBackendDescriptor(descriptor)).toThrow(/cannot claim/i);
        });
    });

    test('rejects backend-owned timeline semantics', () => {
        const descriptor = rasterDescriptor('bitmap');
        descriptor.semanticCoverage.timeline = 'adapter';
        expect(() => normalizeBackendDescriptor(descriptor)).toThrow(/Timeline semantics must remain NGVGE-owned/i);
    });

    test('rejects document schema mismatch by backend kind', () => {
        const descriptor = vectorDescriptor();
        descriptor.documentSchemaIds = [ANIMATED_RASTER_DOCUMENT_SCHEMA_ID];
        expect(() => normalizeBackendDescriptor(descriptor)).toThrow(/may only declare/i);
    });

    test('normalizes canonical SVG transfer without backend-local identity', () => {
        const transfer = normalizePaintBackendTransfer(vectorTransfer());
        expect(transfer.document.documentId).toBe('ngvge:art-document:vector');
        expect(transfer.contentEntries[0].content.kind).toBe('svg-text');
    });

    test('normalizes RGBA raster content against CelContentId', () => {
        const transfer = normalizePaintBackendTransfer(rgbaRasterTransfer());
        expect(transfer.contentEntries[0].semanticId).toBe('ngvge:cel-content:1');
        expect(transfer.activeTarget.frameId).toBe('ngvge:animation-frame:1');
    });

    test('supports portable indexed-raster transfer for pixel authoring without flattening to PNG', () => {
        const transfer = normalizePaintBackendTransfer(indexedRasterTransfer());
        expect(transfer.contentEntries[0].dataFormat).toBe('indexed-u8');
        expect(transfer.contentEntries[0].content.paletteId).toBe('ngvge:palette:pixel');
    });

    test('rejects backend-local raster IDs in transfer target', () => {
        const transfer = rgbaRasterTransfer();
        transfer.activeTarget.frameId = 'piskel-frame-1';
        expect(() => normalizePaintBackendTransfer(transfer)).toThrow(/stable ngvge:animation-frame/i);
    });

    test('rejects missing CelContentId and palette mismatch', () => {
        const missing = indexedRasterTransfer();
        missing.contentEntries[0].semanticId = 'ngvge:cel-content:missing';
        expect(() => normalizePaintBackendTransfer(missing)).toThrow(/missing CelContentId/i);

        const palette = indexedRasterTransfer();
        palette.contentEntries[0].content.paletteId = 'ngvge:palette:other';
        expect(() => normalizePaintBackendTransfer(palette)).toThrow(/PaletteId/i);
    });

    test('binding exposes only the frozen surface and preserves document/resource identity', () => {
        const transfer = vectorTransfer();
        const implementation = makeImplementation(transfer);
        const binding = createPaintBackendBinding({descriptor: vectorDescriptor(), implementation});
        expect(binding.load(transfer).document.documentId).toBe('ngvge:art-document:vector');
        expect(binding.exportTransfer().document.resourceId).toBe('ngvge:resource:vector');
        expect(binding.getHistoryState()).toEqual({canUndo: true, canRedo: false});
    });

    test('binding rejects identity replacement during export', () => {
        const transfer = vectorTransfer();
        const exported = vectorTransfer();
        exported.document.documentId = 'ngvge:art-document:other';
        exported.contentEntries[0].semanticId = 'ngvge:art-document:other';
        const binding = createPaintBackendBinding({
            descriptor: vectorDescriptor(),
            implementation: makeImplementation(exported)
        });
        binding.load(transfer);
        expect(() => binding.exportTransfer()).toThrow(/cannot replace NGVGE ArtDocumentId or ResourceId/i);
    });

    test('binding rejects hidden save/project authority surfaces', () => {
        const implementation = makeImplementation(vectorTransfer());
        implementation.saveProject = jest.fn();
        expect(() => createPaintBackendBinding({descriptor: vectorDescriptor(), implementation})).toThrow(/non-contract surface/i);
    });

    test('binding rejects non-portable backend/DOM/function results', () => {
        const implementation = makeImplementation(vectorTransfer());
        implementation.mount = () => ({handle: () => 'raw'});
        const binding = createPaintBackendBinding({descriptor: vectorDescriptor(), implementation});
        expect(() => binding.mount({}, {})).toThrow(/portable JSON/i);
    });

    test('binding fails closed after dispose', () => {
        const binding = createPaintBackendBinding({descriptor: vectorDescriptor(), implementation: makeImplementation(vectorTransfer())});
        expect(binding.dispose()).toBe(true);
        expect(binding.dispose()).toBe(false);
        expect(() => binding.load(vectorTransfer())).toThrow(/disposed/i);
    });

    test('bitmap and pixel descriptors are locked to their NGVGE raster mode', () => {
        const binding = createPaintBackendBinding({
            descriptor: rasterDescriptor('pixel'),
            implementation: makeImplementation(rgbaRasterTransfer())
        });
        expect(() => binding.load(rgbaRasterTransfer())).toThrow(/cannot edit raster mode bitmap/i);
    });
});
